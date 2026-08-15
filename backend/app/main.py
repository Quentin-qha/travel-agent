from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.itinerary import router as itinerary_router
from app.core.config import settings

app = FastAPI(title="Travel Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(itinerary_router, prefix="/api")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
