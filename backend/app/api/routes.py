from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core_config import settings
from app.db.session import get_db
from app.schemas.analysis import (
    AnalyzeRequest,
    AnalysisResponse,
    ExtractedDocumentResponse,
    HealthResponse,
)
from app.services.analysis_service import AnalysisService
from app.services.document_extractor import DocumentExtractionError, DocumentExtractor
from app.services.llm_service import LLMFormatError, LLMUnavailableError


router = APIRouter(prefix="/api", tags=["triador"])


@router.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(
        status="ok",
        app=settings.app_name,
        environment=settings.environment,
        llm_provider=settings.llm_provider,
        database="sqlite" if settings.database_url.startswith("sqlite") else "relational",
    )


@router.post("/analyses", response_model=AnalysisResponse, status_code=status.HTTP_201_CREATED)
def create_analysis(payload: AnalyzeRequest, db: Session = Depends(get_db)):
    service = AnalysisService(db)
    try:
        return service.analyze_and_save(payload)
    except LLMUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except LLMFormatError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.get("/analyses", response_model=list[AnalysisResponse])
def list_analyses(db: Session = Depends(get_db)):
    return AnalysisService(db).history()


@router.delete("/analyses/{analysis_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_analysis(analysis_id: int, db: Session = Depends(get_db)):
    deleted = AnalysisService(db).delete_analysis(analysis_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Análise não encontrada.",
        )

    return None


@router.post("/documents/extract", response_model=ExtractedDocumentResponse)
async def extract_document(file: UploadFile = File(...)):
    content = await file.read()
    extractor = DocumentExtractor()

    try:
        text = extractor.extract(file.filename or "arquivo", content)
    except DocumentExtractionError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return ExtractedDocumentResponse(
        filename=file.filename or "arquivo",
        content_type=file.content_type or "application/octet-stream",
        characters=len(text),
        text=text,
    )
