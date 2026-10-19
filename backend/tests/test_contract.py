"""Every route in the app is in openapi.yml and vice versa; responses validate against its schemas."""
from pathlib import Path

import yaml
from fastapi.testclient import TestClient

from app.main import create_app
from tests.conftest import make_settings

SPEC = yaml.safe_load((Path(__file__).parents[2] / "openapi.yml").read_text())
METHODS = {"get", "post", "put", "delete", "patch"}


def test_routes_match_openapi(tmp_path):
    app = create_app(make_settings("memory", tmp_path))
    implemented = {(r.path, m.lower()) for r in app.routes if r.path.startswith("/api")
                   for m in getattr(r, "methods", set()) if m.lower() in METHODS}
    implemented = {(p.replace("{id}", "{id}"), m) for p, m in implemented}
    documented = {(p, m) for p, ops in SPEC["paths"].items() for m in ops if m in METHODS}
    assert implemented == documented


def resolve(schema):
    while "$ref" in schema:
        schema = SPEC["components"]["schemas"][schema["$ref"].split("/")[-1]]
    return schema


def check(value, schema, path="$"):
    """Small validator for the subset of OpenAPI 3.0 used by openapi.yml."""
    schema = resolve(schema)
    if value is None:
        assert schema.get("nullable"), f"{path} is null but not nullable"
        return
    if "allOf" in schema:  # merge the parts into one object schema
        merged = {"properties": {}, "required": []}
        for part in map(resolve, schema["allOf"]):
            if "properties" not in part and "allOf" not in part:
                check(value, part, path)
                return
            merged["properties"].update(part.get("properties", {}))
            merged["required"] += part.get("required", [])
        schema = merged
    t = schema.get("type")
    if "enum" in schema:
        assert value in schema["enum"], f"{path}={value!r} not in enum"
    if t == "object" or "properties" in schema:
        assert isinstance(value, dict), path
        for k in schema.get("required", []):
            assert k in value, f"{path}.{k} missing"
        for k, v in value.items():
            if k in schema.get("properties", {}):
                check(v, schema["properties"][k], f"{path}.{k}")
            elif "additionalProperties" in schema:
                check(v, schema["additionalProperties"], f"{path}.{k}")
            else:
                raise AssertionError(f"{path}.{k} not in schema")
    elif t == "array":
        assert isinstance(value, list), path
        for i, v in enumerate(value):
            check(v, schema["items"], f"{path}[{i}]")
    elif t == "string":
        assert isinstance(value, str), path
    elif t == "integer":
        assert isinstance(value, int) and not isinstance(value, bool), path
    elif t == "number":
        assert isinstance(value, (int, float)) and not isinstance(value, bool), path
    elif t == "boolean":
        assert isinstance(value, bool), path


def response_schema(path, method, status):
    r = SPEC["paths"][path][method]["responses"][str(status)]
    if "$ref" in r:
        r = SPEC["components"]["responses"][r["$ref"].split("/")[-1]]
    return r["content"]["application/json"]["schema"]


def test_responses_match_schemas(tmp_path):
    c = TestClient(create_app(make_settings("memory", tmp_path)))
    cases = [
        ("/api/health", "get", c.get("/api/health")),
        ("/api/listings", "get", c.get("/api/listings", params={"currency": "USD"})),
        ("/api/listings", "get", c.get("/api/listings", params={"minPrice": -1})),
        ("/api/listings/{id}", "get", c.get("/api/listings/demo-berlin-2")),
        ("/api/listings/{id}", "get", c.get("/api/listings/nope")),
        ("/api/listings/{id}", "put", c.put("/api/listings/demo-berlin-2", json={"title": "x"})),
        ("/api/compare", "post", c.post("/api/compare", json={"ids": ["demo-berlin-1", "demo-london-1"]})),
        ("/api/sources", "get", c.get("/api/sources")),
        ("/api/sources/refresh", "post", c.post("/api/sources/refresh")),
    ]
    c.post("/api/favorites/demo-berlin-1")
    cases.append(("/api/favorites", "get", c.get("/api/favorites")))
    from tests.conftest import VALID
    cases.append(("/api/listings", "post", c.post("/api/listings", json=VALID)))
    for path, method, r in cases:
        check(r.json(), response_schema(path, method, r.status_code), f"{method} {path} {r.status_code}")
