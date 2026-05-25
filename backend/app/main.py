from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core_config import settings
from app.db.session import Base, engine
from app.models.analysis import Analysis  # noqa: F401 - garante registro do modelo no metadata


def _parse_cors_origins(value: str) -> list[str]:
    return [origin.strip() for origin in value.split(",") if origin.strip()]


app = FastAPI(
    title="Triador API",
    description="API para triagem de currículos com LLM.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_cors_origins(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event() -> None:
    Base.metadata.create_all(bind=engine)


@app.get("/")
def root():
    return {
        "name": settings.app_name,
        "status": "online",
        "docs": "/docs",
        "health": "/api/health",
    }


app.include_router(router)
