from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core_config import settings
from app.db.session import Base, engine
from app.models.analysis import Analysis  # noqa: F401 - registra o modelo no metadata


app = FastAPI(
    title="Triador API",
    description="API para triagem de currículos com LLM.",
    version="1.0.0",
)


def get_cors_origins() -> list[str]:
    return [
        origin.strip()
        for origin in settings.cors_origins.split(",")
        if origin.strip()
    ]


app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event():
    Base.metadata.create_all(bind=engine)


@app.get("/")
def root():
    return {
        "name": "Triador API",
        "status": "online",
        "docs": "/docs",
        "health": "/api/health",
    }


app.include_router(router, prefix="/api")
