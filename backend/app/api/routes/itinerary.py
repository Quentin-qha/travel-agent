from fastapi import APIRouter, HTTPException

from app.schemas.itinerary import ItineraryRequest, ItineraryResponse
from app.services.itinerary_agent import generate_itinerary

router = APIRouter()


@router.post("/itinerary", response_model=ItineraryResponse)
def create_itinerary(request: ItineraryRequest) -> ItineraryResponse:
    try:
        return generate_itinerary(request)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
