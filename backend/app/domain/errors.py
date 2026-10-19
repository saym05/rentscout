from dataclasses import dataclass, field


@dataclass
class FieldError:
    field: str
    message: str


@dataclass
class ApiError(Exception):
    status: int
    code: str
    message: str
    details: list[FieldError] = field(default_factory=list)


def not_found(what: str) -> ApiError:
    return ApiError(404, "NOT_FOUND", f"{what} not found")


def validation(message: str, details: list[FieldError]) -> ApiError:
    return ApiError(400, "VALIDATION_ERROR", message, details)
