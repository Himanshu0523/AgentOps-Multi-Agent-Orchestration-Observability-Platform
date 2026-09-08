from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Service
    agent_port: int = 8000
    agent_host: str = "0.0.0.0"
    
    # MongoDB
    mongodb_uri: str = "mongodb://localhost:27018/agentops?directConnection=true"
    
    # Redis
    redis_url: str = "redis://localhost:6379"
    
    # OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-4"
    
    # LangSmith
    langchain_tracing_v2: bool = False
    langchain_api_key: Optional[str] = None
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()