from contextlib import asynccontextmanager

import anyio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.routes.itinerary import router as itinerary_router
from app.api.routes.photo import router as photo_router
from app.core.config import settings
from app.core.limiter import limiter

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

## Rate limiting

`POST /api/itinerary` is rate-limited per IP (5/minute, 20/hour) — it triggers a paid
Claude + Google Geocoding pipeline with no other access control. Exceeding it returns
`429` with a JSON `{"error": "..."}` body.

## Activity/restaurant identifiers

Each activity/restaurant is identified by a key
`"{day}-{activity|restaurant}-{index}"` (e.g. `"2-activity-0"` = 1st activity
of day 2), used to target specific items during a partial regeneration.
A key of `"{day}-day"` (e.g. `"3-day"`) instead rebuilds that whole day from
scratch — the only way to target a day with zero items, since it isn't keyed
to an existing index. Recompute these keys from the most recent `GET`
response — they aren't stable across a regeneration.
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
        "name": "photo",
        "description": (
            "Server-side proxy for Google Places photos, so the Google API key never "
            "reaches the client — see the `image_url` fields under the `itinerary` tag."
        ),
    },
    {
        "name": "health",
        "description": "Simple check that the server is responding.",
    },
]

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Sync `def` routes run in anyio's worker threadpool (default cap: 40). Generation/
    # regeneration hold a thread for a long time (Claude + several sequential Google calls),
    # so the default cap saturates under modest concurrent load — raised here. See the note
    # on settings.thread_pool_size for why this is a mitigation, not a full fix.
    anyio.to_thread.current_default_thread_limiter().total_tokens = settings.thread_pool_size
    yield


app = FastAPI(
    title="Travel Agent API",
    description=DESCRIPTION,
    version="1.0.0",
    openapi_tags=TAGS_METADATA,
    contact={"name": "@quentinHaentjens", "url": "https://github.com/Quentin-qha"},
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(itinerary_router, prefix="/api")
app.include_router(photo_router, prefix="/api")


@app.get(
    "/health",
    tags=["health"],
    summary="Healthcheck",
    response_description="The server is up.",
)
def health() -> dict[str, str]:
    """Basic monitoring endpoint — depends on no external service (neither Claude nor Supabase)."""
    return {"status": "ok"}
