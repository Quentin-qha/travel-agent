from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    cors_allow_origins: list[str] = ["http://localhost:3000"]
    # This server's own externally-reachable base URL — used to build absolute
    # photo proxy URLs (see api/routes/photo.py) so the Google API key never
    # has to be embedded in a URL handed to a client.
    api_base_url: str = "http://localhost:8000"
    # FastAPI runs sync `def` routes in a bounded worker threadpool (anyio default: 40).
    # Generation/regeneration hold a thread for tens of seconds to minutes (Claude + several
    # sequential Google calls), so the default cap saturates under modest concurrent load —
    # raised here as a cheap mitigation (see main.py's lifespan). Not a substitute for making
    # the I/O path actually async if real concurrent traffic materializes.
    thread_pool_size: int = 100
    claude_model: str = "claude-haiku-4-5"
    anthropic_api_key: str
    google_location_api_key: str
    supabase_url: str
    supabase_service_role_key: str


settings = Settings()
