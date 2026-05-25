# from pydantic_settings import BaseSettings
# from functools import lru_cache

# class Settings(BaseSettings):
#     # App
#     APP_NAME: str = "AI Platform"
#     APP_ENV: str = "development"
#     APP_PORT: int = 8000
#     FRONTEND_URL: str = "http://localhost:5173"

#     # Database
#     POSTGRES_HOST: str = "localhost"
#     POSTGRES_PORT: int = 5432
#     POSTGRES_USER: str = "aiplatform"
#     POSTGRES_PASSWORD: str = "aiplatform_secret"
#     POSTGRES_DB: str = "aiplatform"

#     # Redis
#     REDIS_HOST: str = "localhost"
#     REDIS_PORT: int = 6379
#     REDIS_PASSWORD: str = ""

#     # ChromaDB
#     CHROMA_HOST: str = "localhost"
#     CHROMA_PORT: int = 8001
#     CHROMA_PERSIST_DIR: str = "./chroma_data"

#     # Ollama
#     OLLAMA_BASE_URL: str = "http://localhost:11434"
#     OLLAMA_DEFAULT_MODEL: str = "llama3"

#     # JWT
#     JWT_SECRET: str = "your-super-secret-jwt-key-change-in-production"
#     JWT_ALGORITHM: str = "HS256"
#     JWT_EXPIRY_MINUTES: int = 1440

#     # GitHub
#     GITHUB_TOKEN: str = ""

#     # Monitoring
#     PROMETHEUS_PORT: int = 9090
#     GRAFANA_PORT: int = 3001

#     @property
#     def DATABASE_URL(self) -> str:
#         return (
#             f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
#             f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
#         )

#     @property
#     def REDIS_URL(self) -> str:
#         if self.REDIS_PASSWORD:
#             return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}"
#         return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}"

#     class Config:
#         env_file = ".env"
#         case_sensitive = True

# @lru_cache()
# def get_settings() -> Settings:
#     return Settings()



### `apps/backend/app/config.py` (MODIFIED)


import os
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_NAME: str = "AI Platform"
    APP_ENV: str = "development"
    APP_PORT: int = 8000
    FRONTEND_URL: str = "http://localhost:5173"

    # Additional allowed origins (comma-separated)
    ADDITIONAL_ORIGINS: str = ""

    # Database
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "aiplatform"
    POSTGRES_PASSWORD: str = "aiplatform_secret"
    POSTGRES_DB: str = "aiplatform"

    # External DATABASE_URL (Render provides this)
    DATABASE_URL: str = ""

    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = ""

    # ChromaDB
    CHROMA_HOST: str = "localhost"
    CHROMA_PORT: int = 8001
    CHROMA_PERSIST_DIR: str = "./chroma_data"

    # Workspace
    WORKSPACE_DIR: str = ""

    # Ollama
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_DEFAULT_MODEL: str = "llama3"

    # JWT
    JWT_SECRET: str = "your-super-secret-jwt-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_MINUTES: int = 1440

    # GitHub
    GITHUB_TOKEN: str = ""

    # Monitoring
    PROMETHEUS_PORT: int = 9090
    GRAFANA_PORT: int = 3001

    @property
    def effective_database_url(self) -> str:
        """Get database URL, preferring DATABASE_URL env var for Render compatibility"""
        if self.DATABASE_URL:
            url = self.DATABASE_URL
            # Convert postgresql:// to postgresql+asyncpg://
            if url.startswith("postgresql://"):
                url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
            elif url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql+asyncpg://", 1)
            # Remove any existing +asyncpg to avoid double
            if "+asyncpg+asyncpg" in url:
                url = url.replace("+asyncpg+asyncpg", "+asyncpg")
            return url
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def DATABASE_URL(self) -> str:
        """Backward compatible property"""
        return self.effective_database_url

    @property
    def REDIS_URL(self) -> str:
        if self.REDIS_PASSWORD:
            return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}"
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}"

    @property
    def effective_workspace_dir(self) -> str:
        """Get workspace directory, preferring WORKSPACE_DIR env var"""
        if self.WORKSPACE_DIR:
            return self.WORKSPACE_DIR
        # Default: compute relative to project root
        return os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..", "..", "workspace")
        )

    @property
    def effective_chroma_host(self) -> str:
        """Get ChromaDB host - empty string means use PersistentClient"""
        return self.CHROMA_HOST

    @property
    def allowed_origins(self) -> list:
        """Get all allowed CORS origins"""
        origins = [self.FRONTEND_URL, "http://localhost:5173"]
        if self.ADDITIONAL_ORIGINS:
            for origin in self.ADDITIONAL_ORIGINS.split(","):
                origin = origin.strip()
                if origin:
                    origins.append(origin)
        # In development, allow all localhost
        if self.APP_ENV == "development":
            origins.append("http://localhost:3000")
        return origins

    class Config:
        env_file = ".env"
        case_sensitive = True
        # Allow DATABASE_URL to be set even though there's a property with same name
        # pydantic-settings will use the field, not the property


@lru_cache()
def get_settings() -> Settings:
    return Settings()