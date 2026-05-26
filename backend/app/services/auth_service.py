import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core_config import settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import UserCreate, UserLogin

security = HTTPBearer(auto_error=False)
PBKDF2_ITERATIONS = 120_000
TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _secret_key() -> str:
    return settings.secret_key or os.getenv("SECRET_KEY") or "triador-local-dev-secret-change-me"


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations, salt, digest_hex = stored_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        candidate = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            int(iterations),
        ).hex()
        return hmac.compare_digest(candidate, digest_hex)
    except ValueError:
        return False


def create_access_token(user: User) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "iat": now,
        "exp": now + TOKEN_TTL_SECONDS,
    }
    signing_input = f"{_b64url_encode(json.dumps(header, separators=(',', ':')).encode())}.{_b64url_encode(json.dumps(payload, separators=(',', ':')).encode())}"
    signature = hmac.new(_secret_key().encode("utf-8"), signing_input.encode("utf-8"), hashlib.sha256).digest()
    return f"{signing_input}.{_b64url_encode(signature)}"


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        header_b64, payload_b64, signature_b64 = token.split(".")
        signing_input = f"{header_b64}.{payload_b64}"
        expected_signature = hmac.new(_secret_key().encode("utf-8"), signing_input.encode("utf-8"), hashlib.sha256).digest()
        received_signature = _b64url_decode(signature_b64)
        if not hmac.compare_digest(expected_signature, received_signature):
            raise ValueError("Assinatura inválida")
        payload = json.loads(_b64url_decode(payload_b64))
        if int(payload.get("exp", 0)) < int(time.time()):
            raise ValueError("Token expirado")
        return payload
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessão inválida ou expirada.") from exc


class AuthService:
    def __init__(self, db: Session):
        self.db = db

    def get_by_email(self, email: str) -> User | None:
        statement = select(User).where(User.email == email.lower().strip())
        return self.db.scalars(statement).first()

    def create_user(self, payload: UserCreate) -> User:
        email = payload.email.lower().strip()
        if self.get_by_email(email):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Este e-mail já está cadastrado.")

        user = User(
            name=payload.name.strip(),
            email=email,
            password_hash=hash_password(payload.password),
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def authenticate(self, payload: UserLogin) -> User:
        user = self.get_by_email(payload.email)
        if not user or not verify_password(payload.password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="E-mail ou senha inválidos.")
        return user


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Faça login para continuar.")

    payload = decode_access_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessão inválida.")

    user = db.get(User, int(user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessão expirada. Faça login novamente.")

    return user
