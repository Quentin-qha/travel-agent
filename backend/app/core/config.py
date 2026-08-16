from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    cors_allow_origins: list[str] = ["http://localhost:3000"]
    claude_model: str = "claude-haiku-4-5"
    anthropic_api_key: str
    google_location_api_key: str
    supabase_url: str
    supabase_service_role_key: str


settings = Settings()
