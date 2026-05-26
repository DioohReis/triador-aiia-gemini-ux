from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core_config import settings
from app.db.session import Base
from app.models.analysis import Analysis  # noqa: F401 - registra modelo no metadata
from app.models.user import User  # noqa: F401 - registra FK/metadata quando necessário


def _safe_user_database_path(user_id: int) -> Path:
    base_dir = Path(settings.user_database_dir)
    base_dir.mkdir(parents=True, exist_ok=True)
    return base_dir / f"user_{user_id}.db"


def create_user_analysis_session_factory(user_id: int) -> sessionmaker[Session]:
    """Cria uma sessão apontando para o banco individual do usuário.

    O banco principal continua responsável por usuários/autenticação. As análises
    ficam em arquivos SQLite separados por usuário, garantindo que históricos de
    candidatos não se misturem mesmo se o frontend reutilizar a mesma aplicação.
    """
    database_path = _safe_user_database_path(user_id)
    engine = create_engine(
        f"sqlite:///{database_path.as_posix()}",
        connect_args={"check_same_thread": False},
        future=True,
    )
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


@contextmanager
def user_analysis_session(user_id: int) -> Iterator[Session]:
    SessionLocal = create_user_analysis_session_factory(user_id)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
