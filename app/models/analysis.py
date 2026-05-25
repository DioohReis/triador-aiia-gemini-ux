from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True, nullable=True)
    candidate_name: Mapped[str] = mapped_column(String(160), nullable=False)
    skills: Mapped[str] = mapped_column(Text, nullable=False)  # JSON serializado para manter o escopo enxuto
    years_experience: Mapped[float] = mapped_column(nullable=False)
    fit_score: Mapped[int] = mapped_column(Integer, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    resume_text: Mapped[str] = mapped_column(Text, nullable=False)
    job_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    owner = relationship("User", back_populates="analyses")
