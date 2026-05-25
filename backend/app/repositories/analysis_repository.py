import json
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.analysis import Analysis
from app.schemas.analysis import AnalysisLLMResult


class AnalysisRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, result: AnalysisLLMResult, resume_text: str, job_text: str) -> Analysis:
        analysis = Analysis(
            candidate_name=result.candidate_name,
            skills=json.dumps(result.skills, ensure_ascii=False),
            years_experience=result.years_experience,
            fit_score=result.fit_score,
            summary=result.summary,
            resume_text=resume_text,
            job_text=job_text,
        )
        self.db.add(analysis)
        self.db.commit()
        self.db.refresh(analysis)
        return analysis

def delete_by_id(self, analysis_id: int) -> bool:
    analysis = (
        self.db.query(Analysis)
        .filter(Analysis.id == analysis_id)
        .first()
    )

    if analysis is None:
        return False

    self.db.delete(analysis)
    self.db.commit()

    return True