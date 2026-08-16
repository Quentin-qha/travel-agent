import logging

from supabase import Client, create_client

from app.core.config import settings
from app.schemas.itinerary import Activity, DayPlan, ItineraryDetail, ItineraryRequest, ItineraryResponse, Restaurant

logger = logging.getLogger(__name__)

client: Client = create_client(settings.supabase_url, settings.supabase_service_role_key)


def save_itinerary(request: ItineraryRequest, itinerary: ItineraryResponse) -> str:
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

    return itinerary_id


def get_itinerary(itinerary_id: str) -> ItineraryDetail | None:
    itinerary_resp = client.table("itinerary").select("*").eq("id", itinerary_id).execute()
    if not itinerary_resp.data:
        return None
    itinerary_row = itinerary_resp.data[0]

    days_resp = (
        client.table("day_plan").select("*").eq("itinerary_id", itinerary_id).order("day_number").execute()
    )

    days: list[DayPlan] = []
    for day_row in days_resp.data:
        activities_resp = (
            client.table("activity").select("*").eq("day_plan_id", day_row["id"]).order("sort_order").execute()
        )
        restaurants_resp = (
            client.table("restaurant").select("*").eq("day_plan_id", day_row["id"]).order("sort_order").execute()
        )

        days.append(
            DayPlan(
                day_number=day_row["day_number"],
                date=day_row["date"],
                activities=[
                    Activity(
                        name=a["name"],
                        location_query=a["location_query"],
                        description=a["description"],
                        category=a["category"],
                        duration_minutes=a["duration_minutes"],
                        budget_level=a["budget_level"],
                        source_url=a["source_url"],
                        lat=a["lat"],
                        lon=a["lon"],
                    )
                    for a in activities_resp.data
                ],
                restaurants=[
                    Restaurant(
                        name=r["name"],
                        location_query=r["location_query"],
                        description=r["description"],
                        cuisine=r["cuisine"],
                        budget_level=r["budget_level"],
                        source_url=r["source_url"],
                        lat=r["lat"],
                        lon=r["lon"],
                    )
                    for r in restaurants_resp.data
                ],
            )
        )

    return ItineraryDetail(
        id=itinerary_row["id"],
        destination=itinerary_row["destination_name"],
        summary=itinerary_row["summary"],
        days=days,
    )
