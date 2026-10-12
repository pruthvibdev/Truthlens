import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    GROQ_API_KEY: Optional[str] = os.getenv("GROQ_API_KEY", os.getenv("VITE_GROQ_API_KEY", ""))
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", os.getenv("VITE_GROQ_MODEL", "openai/gpt-oss-120b"))
    DEFAULT_TEMPERATURE: float = 0.2
    TAVILY_API_KEY: Optional[str] = os.getenv("TAVILY_API_KEY", "")
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
