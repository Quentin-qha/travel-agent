import logging
from typing import Literal

from fastapi import APIRouter, Header, HTTPException, Path, Query, Request

from app.core.limiter import limiter
from app.schemas.itinerary import (
    ItineraryCreateResponse,
    ItineraryDetail,
    ItineraryRequest,
    ItinerarySummary,
    RegenerateItineraryRequest,
)
from app.services.itinerary_agent import generate_itinerary, regenerate_itinerary
from app.services.storage import get_itinerary, list_itineraries

logger = logging.getLogger(__name__)

router = APIRouter(tags=["itinerary"])

LangParam = Literal["fr", "en"]

_lang_query = Query(
    default="fr",
    description=(
        "Language of the returned content. Never changes the generation language (always "
        "internally French) — only picks which already-stored translation to return. If no "
        "English translation exists for this trip yet, silently falls back to French."
    ),
)

_edit_token_header = Header(
    default=None,
    alias="X-Edit-Token",
    description=(
        "Edit token received once in `edit_token` when the trip was created. "
        "Optional on read (determines `can_edit`), required to regenerate."
    ),
)

# Also rejects the request with a clean 422 before it ever reaches storage — previously a
# malformed id fell through to an unhandled exception (raw Postgres/PostgREST error) on read.
UUID_PATTERN = r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"

ItineraryIdPath = Path(
    description="Trip UUID.",
    examples=["f47ac10b-58cc-4372-a567-0e02b2c3d479"],
    pattern=UUID_PATTERN,
)

_common_errors = {
    404: {"description": "No trip with this id."},
    502: {"description": "An upstream service failed (Claude or the database)."},
}

# Generic, client-safe messages for genuinely unexpected failures (SDK/network/DB errors) —
# the real exception is logged server-side via logger.exception, never echoed to the client.
# RuntimeError/ValueError/PermissionError raised deliberately by the agent already carry a
# safe, specific message and are passed through as-is (see the except blocks below).
_GENERATION_FAILED = "La génération du voyage a échoué. Réessaie dans quelques instants."
_REGENERATION_FAILED = "La régénération du voyage a échoué. Réessaie dans quelques instants."


@router.post(
    "/itinerary",
    response_model=ItineraryCreateResponse,
    summary="Generate a new trip",
    response_description="The generated trip, with its id and edit token.",
    responses={
        429: {"description": "Too many requests from this IP — try again later."},
        502: _common_errors[502],
    },
)
@limiter.limit("5/minute;20/hour")
def create_itinerary(
    request: Request, payload: ItineraryRequest, lang: LangParam = _lang_query
) -> ItineraryCreateResponse:
    """Generates a day-by-day travel plan (activities + restaurants, budget, GPS coordinates)
    from a city, dates and a traveler profile, backed by real web search. Can take anywhere
    from 30 seconds to a few minutes.

    Saves the result and returns an `edit_token` that the client must keep — this is the only
    time this token is exposed in the clear. If the save fails, `id` and `edit_token` are
    `null`: the trip is still returned, just without a permanent URL or future regeneration.

    Rate-limited per IP (5/minute, 20/hour) — each call runs a paid Claude + Google Geocoding
    pipeline.
    """
    try:
        return generate_itinerary(payload, lang=lang)
    except RuntimeError as exc:
        # Deliberately raised by the agent (model refusal, truncated output, search cap
        # exceeded...) with a message that's already safe to show the caller.
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Failed to generate itinerary")
        raise HTTPException(status_code=502, detail=_GENERATION_FAILED) from exc


@router.get(
    "/itinerary",
    response_model=list[ItinerarySummary],
    summary="List trips",
    response_description="All trips, newest first.",
)
def list_itineraries_route(lang: LangParam = _lang_query) -> list[ItinerarySummary]:
    """Lists all existing trips in a lightweight shape (no day-by-day detail) — used by the
    library page. No pagination: everything is returned at once, `[]` if no trip exists yet."""
    return list_itineraries(lang)


@router.get(
    "/itinerary/{itinerary_id}",
    response_model=ItineraryDetail,
    summary="Read a trip",
    response_description="The trip's full detail (every day, activity and restaurant).",
    responses={404: _common_errors[404]},
)
def read_itinerary(
    itinerary_id: str = ItineraryIdPath,
    lang: LangParam = _lang_query,
    x_edit_token: str | None = _edit_token_header,
) -> ItineraryDetail:
    """Fetches a trip's full detail by id. Accessible to anyone with the URL (no
    authentication required to read) — passing `X-Edit-Token` just makes `can_edit: true`
    appear in the response if the token matches, otherwise the trip stays readable normally
    with `can_edit: false`."""
    itinerary = get_itinerary(itinerary_id, lang, edit_token=x_edit_token)
    if itinerary is None:
        raise HTTPException(status_code=404, detail="Itinéraire introuvable.")
    return itinerary


@router.post(
    "/itinerary/{itinerary_id}/regenerate",
    response_model=ItineraryDetail,
    summary="Regenerate all or part of a trip",
    response_description="The updated trip, with the same id.",
    responses={
        403: {"description": "`X-Edit-Token` missing or invalid for this trip."},
        404: _common_errors[404],
        502: _common_errors[502],
    },
)
def regenerate_itinerary_route(
    request: RegenerateItineraryRequest,
    itinerary_id: str = ItineraryIdPath,
    lang: LangParam = _lang_query,
    x_edit_token: str | None = _edit_token_header,
) -> ItineraryDetail:
    """Regenerates the trip **in place** — the id and URL never change. Requires the
    creator's `X-Edit-Token` (403 otherwise) — since a valid token is required before any
    Claude call is made, this route isn't separately rate-limited.

    The server alone decides the mode based on `itemKeys`: if all currently existing keys are
    sent, the whole trip is regenerated (a brand new full plan, summary included); otherwise
    only the affected days are touched (one model call per touched day), unchecked items and
    the overall summary stay untouched.
    """
    try:
        return regenerate_itinerary(itinerary_id, request.item_keys, lang=lang, edit_token=x_edit_token)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuntimeError as exc:
        # Deliberately raised by the agent with a message that's already safe to show the caller.
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Failed to regenerate itinerary %s", itinerary_id)
        raise HTTPException(status_code=502, detail=_REGENERATION_FAILED) from exc
