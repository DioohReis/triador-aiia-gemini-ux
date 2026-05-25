from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Triador aiia"
    environment: str = "local"
    database_url: str = "sqlite:///./triador.db"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001"
    secret_key: str = "triador-local-dev-secret-change-me"

    # Use "mock" para testar sem custos. Use "gemini" para IA real do Google Gemini.
    llm_provider: Literal["mock", "openai", "gemini"] = "mock"

    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"

    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
