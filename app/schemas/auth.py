from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator


class UserCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        normalized = " ".join(value.strip().split())
        if len(normalized) < 2:
            raise ValueError("Informe seu nome completo ou nome de exibição.")
        return normalized

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        checks = [
            len(value) >= 8,
            any(char.isupper() for char in value),
            any(char.islower() for char in value),
            any(char.isdigit() for char in value),
            any(not char.isalnum() for char in value),
        ]

        if sum(checks) < 3:
            raise ValueError(
                "A senha deve ter pelo menos 8 caracteres e combinar letras, números ou símbolos."
            )

        return value


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    created_at: datetime


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
