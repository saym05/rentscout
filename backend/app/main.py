"""FastAPI app factory. Routes implement openapi.yml exactly (checked by tests/test_contract.py)."""
import logging
import threading
from collections.abc import Iterator
from typing import Any

from fastapi import Body, Depends, FastAPI, Header, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.adapters.base import SourceAdapter
from app.adapters.demo import default_adapters
from app.config import Settings
from app.db import make_engine, make_session_factory, migrate
from app.domain.demo_data import DEMO_RATES
from app.domain.errors import ApiError
from app.domain.models import (ComparisonResult, ListingDetail, ListingView, RefreshResult, SearchResult,
                               SourceStatus)
from app.domain.search import parse_query
from app.repositories.base import Store
from app.repositories.memory import MemoryStore
from app.repositories.sql import SqlStore
from app.services.listings import ListingService
from app.services.sources import RefreshService, list_sources, seed

log = logging.getLogger("rentscout")


def _envelope(status: int, code: str, message: str, details: list[dict] | None = None) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message, "details": details or []}})


def create_app(settings: Settings | None = None, adapters: list[SourceAdapter] | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    adapters = adapters if adapters is not None else default_adapters(settings.failing_sources)
    rates = DEMO_RATES if settings.rates == "demo" else None
    refresher = RefreshService(adapters, threading.Lock())

    if settings.store == "memory":
        memory = MemoryStore()
        seed(memory)

        def get_store() -> Iterator[Store]:
            yield memory
    else:
        engine = make_engine(settings.database_url)
        migrate(engine)
        sessions = make_session_factory(engine)
        with sessions() as s:
            seed(SqlStore(s))

        def get_store() -> Iterator[Store]:
            with sessions() as s:
                yield SqlStore(s)

    app = FastAPI(title="RentScout API", version="0.1.0")
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["*"], allow_headers=["*"])

    @app.exception_handler(ApiError)
    async def api_error(_: Request, e: ApiError) -> JSONResponse:
        return _envelope(e.status, e.code, e.message, [{"field": d.field, "message": d.message} for d in e.details])

    @app.exception_handler(RequestValidationError)
    async def request_invalid(_: Request, e: RequestValidationError) -> JSONResponse:
        details = [{"field": str(err["loc"][-1]) if err.get("loc") else "body", "message": err["msg"]} for err in e.errors()]
        return _envelope(400, "VALIDATION_ERROR", "Invalid request", details)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, e: StarletteHTTPException) -> JSONResponse:
        code = {404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED"}.get(e.status_code, "HTTP_ERROR")
        return _envelope(e.status_code, code, "Not found" if e.status_code == 404 else str(e.detail))

    @app.exception_handler(Exception)
    async def unexpected(_: Request, e: Exception) -> JSONResponse:
        log.exception("unhandled error")  # logged server-side only; never sent to the client
        return _envelope(500, "INTERNAL_ERROR", "Something went wrong on our side. Please try again.")

    def service(store: Store = Depends(get_store), x_demo_user: str = Header("demo")) -> ListingService:
        return ListingService(store, rates, x_demo_user.strip() or "demo")

    @app.get("/api/health")
    def health() -> dict:
        return {"status": "ok"}

    @app.get("/api/listings", response_model=SearchResult)
    def search_listings(request: Request, svc: ListingService = Depends(service)) -> SearchResult:
        return svc.search(parse_query(dict(request.query_params)))

    @app.post("/api/listings", response_model=ListingView, status_code=201)
    def create_listing(body: Any = Body(...), svc: ListingService = Depends(service)) -> ListingView:
        return svc.create(body)

    @app.get("/api/listings/{id}", response_model=ListingDetail)
    def get_listing(id: str, currency: str | None = None, svc: ListingService = Depends(service)) -> ListingDetail:
        return svc.detail(id, currency)

    @app.put("/api/listings/{id}", response_model=ListingView)
    def update_listing(id: str, body: Any = Body(...), svc: ListingService = Depends(service)) -> ListingView:
        return svc.update(id, body)

    @app.delete("/api/listings/{id}", status_code=204)
    def delete_listing(id: str, svc: ListingService = Depends(service)) -> Response:
        svc.delete(id)
        return Response(status_code=204)

    @app.get("/api/favorites", response_model=list[ListingView])
    def list_favorites(currency: str | None = None, svc: ListingService = Depends(service)) -> list[ListingView]:
        return svc.favorites(currency)

    @app.post("/api/favorites/{listing_id}", status_code=204)
    def add_favorite(listing_id: str, svc: ListingService = Depends(service)) -> Response:
        svc.add_favorite(listing_id)
        return Response(status_code=204)

    @app.delete("/api/favorites/{listing_id}", status_code=204)
    def remove_favorite(listing_id: str, svc: ListingService = Depends(service)) -> Response:
        svc.remove_favorite(listing_id)
        return Response(status_code=204)

    @app.post("/api/compare", response_model=ComparisonResult)
    def compare_listings(body: Any = Body(...), svc: ListingService = Depends(service)) -> ComparisonResult:
        return svc.compare(body)

    @app.get("/api/sources", response_model=list[SourceStatus])
    def get_sources(store: Store = Depends(get_store)) -> list[SourceStatus]:
        return list_sources(store, adapters)

    @app.post("/api/sources/refresh", response_model=RefreshResult)
    def refresh_sources(store: Store = Depends(get_store)) -> RefreshResult:
        return refresher.refresh(store)

    return app
