import logging

import httpx
from fastapi import APIRouter, HTTPException, Path, Query, Request, Response

from app.core.config import settings
from app.core.limiter import limiter
from app.core.redact import redact_api_key
from app.services.storage import photo_reference_exists

logger = logging.getLogger(__name__)

router = APIRouter(tags=["photo"])

GOOGLE_PLACE_PHOTO_URL = "https://maps.googleapis.com/maps/api/place/photo"


@router.get(
    "/photo/{photo_reference}",
    summary="Proxy a Google Places photo",
    response_description="The image bytes.",
    responses={
        404: {"description": "No photo found for this reference."},
        429: {"description": "Too many requests from this IP."},
    },
)
@limiter.limit("60/minute")
def get_place_photo(
    request: Request,
    photo_reference: str = Path(description="Google Places photo reference, as embedded in `image_url`."),
    maxwidth: int = Query(default=800, ge=100, le=1600, description="Max width in pixels, forwarded to Google."),
) -> Response:
    """Fetches a Google Places photo server-side and streams the bytes back.

    `image_url` fields never contain a Google Places photo directly — they point here instead.
    The Google API key is attached only to the outgoing request to Google from this server; it
    never appears in the response and never reaches the client. See the security note in
    `services/itinerary_agent.py::_fetch_place_photo_url`.

    Rate-limited per IP (60/minute) and only serves references that actually belong to a
    stored `image_url` — not an open relay for arbitrary Google Photos requests billed to
    our API key. See the security note on `storage.photo_reference_exists`.
    """
    if not photo_reference_exists(photo_reference):
        raise HTTPException(status_code=404, detail="Photo introuvable.")

    try:
        resp = httpx.get(
            GOOGLE_PLACE_PHOTO_URL,
            params={"maxwidth": maxwidth, "photo_reference": photo_reference, "key": settings.google_location_api_key},
            timeout=10,
            follow_redirects=True,
        )
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning("Place photo request failed for %r: %s", photo_reference, redact_api_key(str(exc)))
        raise HTTPException(status_code=404, detail="Photo introuvable.") from exc

    return Response(
        content=resp.content,
        media_type=resp.headers.get("content-type", "image/jpeg"),
        headers={"Cache-Control": "public, max-age=86400"},
    )
