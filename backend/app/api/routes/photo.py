import logging

import httpx
from fastapi import APIRouter, HTTPException, Path, Query, Response

from app.core.config import settings
from app.core.redact import redact_api_key

logger = logging.getLogger(__name__)

router = APIRouter(tags=["photo"])

GOOGLE_PLACE_PHOTO_URL = "https://maps.googleapis.com/maps/api/place/photo"


@router.get(
    "/photo/{photo_reference}",
    summary="Proxy a Google Places photo",
    response_description="The image bytes.",
    responses={404: {"description": "No photo found for this reference."}},
)
def get_place_photo(
    photo_reference: str = Path(description="Google Places photo reference, as embedded in `image_url`."),
    maxwidth: int = Query(default=800, ge=100, le=1600, description="Max width in pixels, forwarded to Google."),
) -> Response:
    """Fetches a Google Places photo server-side and streams the bytes back.

    `image_url` fields never contain a Google Places photo directly — they point here instead.
    The Google API key is attached only to the outgoing request to Google from this server; it
    never appears in the response and never reaches the client. See the security note in
    `services/itinerary_agent.py::_fetch_place_photo_url`.
    """
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
