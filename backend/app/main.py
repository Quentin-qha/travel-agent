from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.itinerary import router as itinerary_router
from app.core.config import settings

DESCRIPTION = """
Generates a day-by-day travel plan (activities + restaurants, budget and GPS
coordinates) from a city, dates and a traveler profile — backed by real web
search, never invented data.

## Content language

Every route below accepts a `lang` parameter (`fr` by default, or `en`). It
never changes the language the trip is generated in — generation always
happens in French internally — it only picks which already-stored
translation to return on read. If a trip has no English translation yet, the
API silently falls back to French instead of returning an empty field.

## Edit token authentication

There is no user account system. Each created itinerary receives a random
edit token, returned **once** in `edit_token` by `POST /api/itinerary` — the
client must keep it (e.g. a cookie). To regenerate an itinerary, that token
must be sent back in the `X-Edit-Token` header; without it, or with an
invalid one, regeneration fails with `403`. Reading an itinerary
(`GET /api/itinerary/{id}`) also accepts this header and returns a `can_edit`
boolean in response (never the token itself) — a shared link stays readable
without the token, just not editable.

## Activity/restaurant identifiers

Each activity/restaurant is identified by a key
`"{day}-{activity|restaurant}-{index}"` (e.g. `"2-activity-0"` = 1st activity
of day 2), used to target specific items during a partial regeneration.
Recompute these keys from the most recent `GET` response — they aren't
stable across a regeneration.
"""

TAGS_METADATA = [
    {
        "name": "itinerary",
        "description": (
            "Generation, reading, listing and regeneration (full or "
            "partial) of trips. See the general description above for "
            "`lang`, edit token authentication, and the item key format."
        ),
    },
    {
        "name": "health",
        "description": "Simple check that the server is responding.",
    },
]

app = FastAPI(
    title="Travel Agent API",
    description=DESCRIPTION,
    version="1.0.0",
    openapi_tags=TAGS_METADATA,
    contact={"name": "@quentinHaentjens", "url": "https://github.com/Quentin-qha"},
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(itinerary_router, prefix="/api")


@app.get(
    "/health",
    tags=["health"],
    summary="Healthcheck",
    response_description="The server is up.",
)
def health() -> dict[str, str]:
    """Basic monitoring endpoint — depends on no external service (neither Claude nor Supabase)."""
    return {"status": "ok"}
