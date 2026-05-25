import json
from sqlalchemy.orm import Session

from app.repositories.analysis_repository import AnalysisRepository
from app.schemas.analysis import AnalyzeRequest, AnalysisResponse
from app.services.llm_service import LLMAnalysisService


def to_response(model) -> AnalysisResponse:
    return AnalysisResponse(
        id=model.id,
        candidate_name=model.candidate_name,
        skills=json.loads(model.skills),
        years_experience=model.years_experience,
        fit_score=model.fit_score,
        summary=model.summary,
        created_at=model.created_at,
    )


class AnalysisService:
    def __init__(self, db: Session):
        self.repository = AnalysisRepository(db)
        self.llm = LLMAnalysisService()

    def analyze_and_save(self, payload: AnalyzeRequest, user_id: int) -> AnalysisResponse:
        result = self.llm.analyze(payload.resume_text, payload.job_text)
        saved = self.repository.create(result, payload.resume_text, payload.job_text, user_id=user_id)
        return to_response(saved)

    def history(self, user_id: int) -> list[AnalysisResponse]:
        return [to_response(item) for item in self.repository.list_recent(user_id=user_id)]

    def delete_analysis(self, analysis_id: int, user_id: int) -> bool:
        return self.repository.delete_by_id(analysis_id, user_id=user_id)
