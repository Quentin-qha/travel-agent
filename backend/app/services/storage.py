import logging

from supabase import Client, create_client

from app.core.config import settings
from app.schemas.itinerary import (
    Activity,
    DayPlan,
    ItineraryContext,
    ItineraryDetail,
    ItineraryRequest,
    ItineraryResponse,
    ItinerarySummary,
    Restaurant,
    TravelerType,
)

logger = logging.getLogger(__name__)

client: Client = create_client(settings.supabase_url, settings.supabase_service_role_key)


def _insert_activities(day_plan_id: str, activities: list[Activity]) -> None:
    if not activities:
        return
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
            for index, activity in enumerate(activities)
        ]
    ).execute()


def _insert_restaurants(day_plan_id: str, restaurants: list[Restaurant]) -> None:
    if not restaurants:
        return
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
            for index, restaurant in enumerate(restaurants)
        ]
    ).execute()


def _insert_days(itinerary_id: str, days: list[DayPlan]) -> None:
    for day in days:
        day_row = (
            client.table("day_plan")
            .insert({"itinerary_id": itinerary_id, "day_number": day.day_number, "date": day.date.isoformat()})
            .execute()
        )
        day_plan_id = day_row.data[0]["id"]
        _insert_activities(day_plan_id, day.activities)
        _insert_restaurants(day_plan_id, day.restaurants)


def save_itinerary(request: ItineraryRequest, itinerary: ItineraryResponse) -> str:
    itinerary_row = (
        client.table("itinerary")
        .insert(
            {
                "destination_city": itinerary.destination_city,
                "destination_country": itinerary.destination_country,
                "summary": itinerary.summary,
                "trip_types": request.trip_types,
                "traveler_type": request.traveler_type.value,
                "traveler_count": request.traveler_count,
                "city_lat": request.city.lat,
                "city_lon": request.city.lon,
            }
        )
        .execute()
    )
    itinerary_id = itinerary_row.data[0]["id"]
    _insert_days(itinerary_id, itinerary.days)
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
        destination_city=itinerary_row["destination_city"],
        destination_country=itinerary_row["destination_country"],
        summary=itinerary_row["summary"],
        trip_types=itinerary_row.get("trip_types") or [],
        days=days,
    )


def list_itineraries() -> list[ItinerarySummary]:
    # day_plan(day_number) embeds each itinerary's day rows just to count them —
    # avoids a second round trip per itinerary for a value we only need the length of.
    resp = (
        client.table("itinerary")
        .select("id, destination_city, destination_country, summary, trip_types, created_at, day_plan(day_number)")
        .order("created_at", desc=True)
        .execute()
    )
    return [
        ItinerarySummary(
            id=row["id"],
            destination_city=row["destination_city"],
            destination_country=row["destination_country"],
            summary=row["summary"],
            trip_types=row.get("trip_types") or [],
            day_count=len(row.get("day_plan") or []),
            created_at=row["created_at"],
        )
        for row in resp.data
    ]


def get_itinerary_context(itinerary_id: str) -> ItineraryContext | None:
    """Reconstructs the original request parameters for regeneration.

    traveler_type/traveler_count default to solo/1 for itineraries saved
    before those columns existed — best effort, not a hard failure.
    """
    itinerary_resp = client.table("itinerary").select("*").eq("id", itinerary_id).execute()
    if not itinerary_resp.data:
        return None
    row = itinerary_resp.data[0]

    days_resp = (
        client.table("day_plan").select("date").eq("itinerary_id", itinerary_id).order("day_number").execute()
    )
    if not days_resp.data:
        return None

    return ItineraryContext(
        destination_city=row["destination_city"],
        destination_country=row["destination_country"],
        city_lat=row["city_lat"],
        city_lon=row["city_lon"],
        traveler_type=TravelerType(row["traveler_type"]) if row.get("traveler_type") else TravelerType.solo,
        traveler_count=row.get("traveler_count") or 1,
        trip_types=row.get("trip_types") or [],
        day_dates=[day["date"] for day in days_resp.data],
    )


def replace_days(itinerary_id: str, itinerary: ItineraryResponse) -> None:
    """Full regeneration: swap every day for a freshly generated one."""
    client.table("itinerary").update(
        {
            "destination_city": itinerary.destination_city,
            "destination_country": itinerary.destination_country,
            "summary": itinerary.summary,
        }
    ).eq("id", itinerary_id).execute()

    # Cascades to activity/restaurant rows.
    client.table("day_plan").delete().eq("itinerary_id", itinerary_id).execute()
    _insert_days(itinerary_id, itinerary.days)


def get_day_plan_ids(itinerary_id: str) -> dict[int, str]:
    """Maps day_number -> day_plan row id, needed to target a single day for partial regeneration."""
    resp = client.table("day_plan").select("id, day_number").eq("itinerary_id", itinerary_id).execute()
    return {row["day_number"]: row["id"] for row in resp.data}


def replace_day_items(day_plan_id: str, activities: list[Activity], restaurants: list[Restaurant]) -> None:
    """Partial regeneration: swap one day's activities/restaurants for a merged kept+new list."""
    client.table("activity").delete().eq("day_plan_id", day_plan_id).execute()
    client.table("restaurant").delete().eq("day_plan_id", day_plan_id).execute()
    _insert_activities(day_plan_id, activities)
    _insert_restaurants(day_plan_id, restaurants)
