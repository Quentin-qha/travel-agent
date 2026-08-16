from fastapi import APIRouter, HTTPException

from app.schemas.itinerary import ItineraryCreateResponse, ItineraryDetail, ItineraryRequest
from app.services.itinerary_agent import generate_itinerary
from app.services.storage import get_itinerary

router = APIRouter()


@router.post("/itinerary", response_model=ItineraryCreateResponse)
def create_itinerary(request: ItineraryRequest) -> ItineraryCreateResponse:
    try:
        return generate_itinerary(request)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/itinerary/{itinerary_id}", response_model=ItineraryDetail)
def read_itinerary(itinerary_id: str) -> ItineraryDetail:
    itinerary = get_itinerary(itinerary_id)
    if itinerary is None:
        raise HTTPException(status_code=404, detail="Itinéraire introuvable.")
    return itinerary
