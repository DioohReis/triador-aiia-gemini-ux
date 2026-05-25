from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AnalyzeRequest(BaseModel):
    resume_text: str = Field(..., min_length=20, max_length=50000)
    job_text: str = Field(..., min_length=20, max_length=50000)


class AnalysisLLMResult(BaseModel):
    candidate_name: str = Field(..., min_length=2, max_length=120)
    skills: list[str] = Field(..., min_length=1, max_length=30)
    years_experience: float = Field(..., ge=0, le=80)
    fit_score: int = Field(..., ge=0, le=100)
    summary: str = Field(..., min_length=20, max_length=800)

    @field_validator("skills", mode="before")
    @classmethod
    def normalize_skills(cls, value):
        if not isinstance(value, list):
            raise ValueError("skills deve ser uma lista")

        normalized: list[str] = []

        for item in value:
            if item is None:
                continue

            skill = str(item).strip()

            if not skill:
                continue

            already_exists = any(
                existing.lower() == skill.lower()
                for existing in normalized
            )

            if not already_exists:
                normalized.append(skill)

        return normalized[:30]


class AnalysisResponse(AnalysisLLMResult):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ExtractedDocumentResponse(BaseModel):
    filename: str
    content_type: str
    text: str
    characters: int


class HealthResponse(BaseModel):
    status: str
    app: str
    environment: str
    llm_provider: str
    database: str
