import logging

from supabase import Client, create_client

from app.core.config import settings
from app.schemas.itinerary import ItineraryRequest, ItineraryResponse

logger = logging.getLogger(__name__)

client: Client = create_client(settings.supabase_url, settings.supabase_service_role_key)


def save_itinerary(request: ItineraryRequest, itinerary: ItineraryResponse) -> None:
    destination_name = itinerary.destination_country
    if itinerary.destination_city:
        destination_name = f"{itinerary.destination_city}, {itinerary.destination_country}"

    itinerary_row = (
        client.table("itinerary")
        .insert(
            {
                "destination_name": destination_name,
                "summary": itinerary.summary,
                "city_lat": request.city.lat,
                "city_lon": request.city.lon,
            }
        )
        .execute()
    )
    itinerary_id = itinerary_row.data[0]["id"]

    for day in itinerary.days:
        day_row = (
            client.table("day_plan")
            .insert(
                {
                    "itinerary_id": itinerary_id,
                    "day_number": day.day_number,
                    "date": day.date.isoformat(),
                }
            )
            .execute()
        )
        day_plan_id = day_row.data[0]["id"]

        if day.activities:
            client.table("activity").insert(
                [
                    {
                        "day_plan_id": day_plan_id,
                        "name": activity.name,
                        "location_query": activity.location_query,
                        "description": activity.description,
                        "category": activity.category,
                        "duration_minutes": activity.duration_minutes,
                        "budget_level": activity.budget_level.value,
                        "source_url": activity.source_url,
                        "lat": activity.lat,
                        "lon": activity.lon,
                        "sort_order": index,
                    }
                    for index, activity in enumerate(day.activities)
                ]
            ).execute()

        if day.restaurants:
            client.table("restaurant").insert(
                [
                    {
                        "day_plan_id": day_plan_id,
                        "name": restaurant.name,
                        "location_query": restaurant.location_query,
                        "description": restaurant.description,
                        "cuisine": restaurant.cuisine,
                        "budget_level": restaurant.budget_level.value,
                        "source_url": restaurant.source_url,
                        "lat": restaurant.lat,
                        "lon": restaurant.lon,
                        "sort_order": index,
                    }
                    for index, restaurant in enumerate(day.restaurants)
                ]
            ).execute()
