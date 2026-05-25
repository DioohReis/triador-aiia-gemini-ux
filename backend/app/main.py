from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.routes import router
from app.core_config import settings
from app.db.session import Base, engine
from app.models.analysis import Analysis  # noqa: F401 - garante registro do modelo no metadata
from app.models.user import User  # noqa: F401 - garante registro do modelo no metadata


def _parse_cors_origins(value: str) -> list[str]:
    return [origin.strip() for origin in value.split(",") if origin.strip()]


def _ensure_lightweight_sqlite_migrations() -> None:
    """Mantém deploys existentes compatíveis sem ferramenta de migration pesada.

    Em produção real, Alembic seria a escolha correta. Para o desafio e para o
    SQLite do Render, esta migration incremental evita quebrar bancos já criados
    antes da chegada do login.
    """
    if not settings.database_url.startswith("sqlite"):
        return

    with engine.begin() as connection:
        columns = connection.execute(text("PRAGMA table_info(analyses)")).fetchall()
        column_names = {row[1] for row in columns}
        if "user_id" not in column_names:
            connection.execute(text("ALTER TABLE analyses ADD COLUMN user_id INTEGER"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_analyses_user_id ON analyses (user_id)"))


app = FastAPI(
    title="Triador API",
    description="API para triagem de currículos com LLM.",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_cors_origins(settings.cors_origins),
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event() -> None:
    Base.metadata.create_all(bind=engine)
    _ensure_lightweight_sqlite_migrations()


@app.get("/")
def root():
    return {
        "name": settings.app_name,
        "status": "online",
        "docs": "/docs",
        "health": "/api/health",
        "version": "1.1.0",
    }


app.include_router(router)
