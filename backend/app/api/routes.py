from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core_config import settings
from app.db.session import get_db
from app.db.user_database import user_analysis_session
from app.models.user import User
from app.schemas.analysis import (
    AnalyzeRequest,
    AnalysisResponse,
    ExtractedDocumentResponse,
    HealthResponse,
)
from app.schemas.auth import AuthResponse, UserCreate, UserLogin, UserResponse
from app.services.analysis_service import AnalysisService
from app.services.auth_service import AuthService, create_access_token, get_current_user
from app.services.document_extractor import DocumentExtractionError, DocumentExtractor
from app.services.llm_service import LLMFormatError, LLMUnavailableError


router = APIRouter(prefix="/api", tags=["triador"])


def user_to_response(user: User) -> UserResponse:
    return UserResponse(id=user.id, name=user.name, email=user.email, created_at=user.created_at)


@router.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(
        status="ok",
        app=settings.app_name,
        environment=settings.environment,
        llm_provider=settings.llm_provider,
        database="sqlite" if settings.database_url.startswith("sqlite") else "relational",
    )


@router.post("/auth/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    user = AuthService(db).create_user(payload)
    return AuthResponse(access_token=create_access_token(user), user=user_to_response(user))


@router.post("/auth/login", response_model=AuthResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = AuthService(db).authenticate(payload)
    return AuthResponse(access_token=create_access_token(user), user=user_to_response(user))


@router.get("/auth/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return user_to_response(current_user)


@router.post("/analyses", response_model=AnalysisResponse, status_code=status.HTTP_201_CREATED)
def create_analysis(
    payload: AnalyzeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        with user_analysis_session(current_user.id) as user_db:
            service = AnalysisService(user_db)
            return service.analyze_and_save(payload, user_id=current_user.id)
    except LLMUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except LLMFormatError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.get("/analyses", response_model=list[AnalysisResponse])
def list_analyses(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    with user_analysis_session(current_user.id) as user_db:
        return AnalysisService(user_db).history(user_id=current_user.id)


@router.delete("/analyses/{analysis_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_analysis(
    analysis_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    with user_analysis_session(current_user.id) as user_db:
        deleted = AnalysisService(user_db).delete_analysis(analysis_id, user_id=current_user.id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Análise não encontrada para este usuário.",
        )

    return None


@router.post("/documents/extract", response_model=ExtractedDocumentResponse)
async def extract_document(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
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
