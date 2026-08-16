from fastapi import APIRouter, Header, HTTPException

from app.schemas.itinerary import (
    ItineraryCreateResponse,
    ItineraryDetail,
    ItineraryRequest,
    ItinerarySummary,
    RegenerateItineraryRequest,
)
from app.services.itinerary_agent import generate_itinerary, regenerate_itinerary
from app.services.storage import get_itinerary, list_itineraries

router = APIRouter()


@router.post("/itinerary", response_model=ItineraryCreateResponse)
def create_itinerary(request: ItineraryRequest, lang: str = "fr") -> ItineraryCreateResponse:
    try:
        return generate_itinerary(request, lang=lang)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/itinerary", response_model=list[ItinerarySummary])
def list_itineraries_route(lang: str = "fr") -> list[ItinerarySummary]:
    return list_itineraries(lang)


@router.get("/itinerary/{itinerary_id}", response_model=ItineraryDetail)
def read_itinerary(
    itinerary_id: str, lang: str = "fr", x_edit_token: str | None = Header(default=None)
) -> ItineraryDetail:
    itinerary = get_itinerary(itinerary_id, lang, edit_token=x_edit_token)
    if itinerary is None:
        raise HTTPException(status_code=404, detail="Itinéraire introuvable.")
    return itinerary


@router.post("/itinerary/{itinerary_id}/regenerate", response_model=ItineraryDetail)
def regenerate_itinerary_route(
    itinerary_id: str,
    request: RegenerateItineraryRequest,
    lang: str = "fr",
    x_edit_token: str | None = Header(default=None),
) -> ItineraryDetail:
    try:
        return regenerate_itinerary(itinerary_id, request.item_keys, lang=lang, edit_token=x_edit_token)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
