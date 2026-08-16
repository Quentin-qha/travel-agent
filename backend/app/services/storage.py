import logging
import secrets

from supabase import Client, create_client

from app.core.config import settings
from app.schemas.itinerary import (
    Activity,
    ActivityContent,
    DayContent,
    DayPlan,
    ItineraryContext,
    ItineraryDetail,
    ItineraryRequest,
    ItineraryResponse,
    ItinerarySummary,
    Restaurant,
    RestaurantContent,
    TranslatedItinerary,
    TravelerType,
)

logger = logging.getLogger(__name__)

client: Client = create_client(settings.supabase_url, settings.supabase_service_role_key)

DEFAULT_LOCALE = "fr"


def _pick_translation(rows: list[dict], locale: str) -> dict:
    """Picks the row matching `locale`, falling back to French when the requested
    locale doesn't have a translation yet (untranslated legacy rows, or an item
    whose translation call failed and was skipped)."""
    by_locale = {row["locale"]: row for row in rows}
    return by_locale.get(locale) or by_locale.get(DEFAULT_LOCALE) or {}


def _insert_activities(
    day_plan_id: str, activities: list[Activity], translated: list[ActivityContent] | None = None
) -> None:
    if not activities:
        return
    rows = (
        client.table("activity")
        .insert(
            [
                {
                    "day_plan_id": day_plan_id,
                    "location_query": activity.location_query,
                    "duration_minutes": activity.duration_minutes,
                    "budget_level": activity.budget_level.value,
                    "source_url": activity.source_url,
                    "lat": activity.lat,
                    "lon": activity.lon,
                    "sort_order": index,
                }
                for index, activity in enumerate(activities)
            ]
        )
        .execute()
    )
    inserted_ids = [row["id"] for row in rows.data]

    translation_rows = []
    for index, (activity, activity_id) in enumerate(zip(activities, inserted_ids)):
        translation_rows.append(
            {
                "activity_id": activity_id,
                "locale": "fr",
                "name": activity.name,
                "description": activity.description,
                "category": activity.category,
            }
        )
        if translated is not None:
            t = translated[index]
            translation_rows.append(
                {
                    "activity_id": activity_id,
                    "locale": "en",
                    "name": t.name,
                    "description": t.description,
                    "category": t.category,
                }
            )
    client.table("activity_translations").insert(translation_rows).execute()


def _insert_restaurants(
    day_plan_id: str, restaurants: list[Restaurant], translated: list[RestaurantContent] | None = None
) -> None:
    if not restaurants:
        return
    rows = (
        client.table("restaurant")
        .insert(
            [
                {
                    "day_plan_id": day_plan_id,
                    "location_query": restaurant.location_query,
                    "budget_level": restaurant.budget_level.value,
                    "source_url": restaurant.source_url,
                    "lat": restaurant.lat,
                    "lon": restaurant.lon,
                    "sort_order": index,
                }
                for index, restaurant in enumerate(restaurants)
            ]
        )
        .execute()
    )
    inserted_ids = [row["id"] for row in rows.data]

    translation_rows = []
    for index, (restaurant, restaurant_id) in enumerate(zip(restaurants, inserted_ids)):
        translation_rows.append(
            {
                "restaurant_id": restaurant_id,
                "locale": "fr",
                "name": restaurant.name,
                "description": restaurant.description,
                "cuisine": restaurant.cuisine,
            }
        )
        if translated is not None:
            t = translated[index]
            translation_rows.append(
                {
                    "restaurant_id": restaurant_id,
                    "locale": "en",
                    "name": t.name,
                    "description": t.description,
                    "cuisine": t.cuisine,
                }
            )
    client.table("restaurant_translations").insert(translation_rows).execute()


def _insert_days(itinerary_id: str, days: list[DayPlan], translated_days: list[DayContent] | None = None) -> None:
    for index, day in enumerate(days):
        day_row = (
            client.table("day_plan")
            .insert({"itinerary_id": itinerary_id, "day_number": day.day_number, "date": day.date.isoformat()})
            .execute()
        )
        day_plan_id = day_row.data[0]["id"]
        translated_day = translated_days[index] if translated_days is not None else None
        _insert_activities(day_plan_id, day.activities, translated_day.activities if translated_day else None)
        _insert_restaurants(day_plan_id, day.restaurants, translated_day.restaurants if translated_day else None)


def save_itinerary(
    request: ItineraryRequest, itinerary: ItineraryResponse, translated: TranslatedItinerary | None = None
) -> tuple[str, str]:
    """Returns (itinerary_id, edit_token). The token is only ever handed to the
    creator (stored client-side in a cookie) — it's what lets us tell an owner
    apart from anyone else opening a shared link."""
    edit_token = secrets.token_urlsafe(24)
    itinerary_row = (
        client.table("itinerary")
        .insert(
            {
                "trip_types": request.trip_types,
                "traveler_type": request.traveler_type.value,
                "traveler_count": request.traveler_count,
                "city_lat": request.city.lat,
                "city_lon": request.city.lon,
                "edit_token": edit_token,
            }
        )
        .execute()
    )
    itinerary_id = itinerary_row.data[0]["id"]

    translation_rows = [
        {
            "itinerary_id": itinerary_id,
            "locale": "fr",
            "destination_city": itinerary.destination_city,
            "destination_country": itinerary.destination_country,
            "summary": itinerary.summary,
        }
    ]
    if translated is not None:
        translation_rows.append(
            {
                "itinerary_id": itinerary_id,
                "locale": "en",
                "destination_city": translated.destination_city,
                "destination_country": translated.destination_country,
                "summary": translated.summary,
            }
        )
    client.table("itinerary_translations").insert(translation_rows).execute()

    _insert_days(itinerary_id, itinerary.days, translated.days if translated else None)
    return itinerary_id, edit_token


def check_edit_token(itinerary_id: str, edit_token: str | None) -> bool:
    if not edit_token:
        return False
    resp = client.table("itinerary").select("edit_token").eq("id", itinerary_id).execute()
    if not resp.data:
        return False
    return secrets.compare_digest(edit_token, resp.data[0]["edit_token"])


def get_itinerary(
    itinerary_id: str, locale: str = DEFAULT_LOCALE, edit_token: str | None = None
) -> ItineraryDetail | None:
    itinerary_resp = (
        client.table("itinerary").select("*, itinerary_translations(*)").eq("id", itinerary_id).execute()
    )
    if not itinerary_resp.data:
        return None
    itinerary_row = itinerary_resp.data[0]
    itinerary_text = _pick_translation(itinerary_row.get("itinerary_translations") or [], locale)

    days_resp = (
        client.table("day_plan").select("*").eq("itinerary_id", itinerary_id).order("day_number").execute()
    )

    days: list[DayPlan] = []
    for day_row in days_resp.data:
        activities_resp = (
            client.table("activity")
            .select("*, activity_translations(*)")
            .eq("day_plan_id", day_row["id"])
            .order("sort_order")
            .execute()
        )
        restaurants_resp = (
            client.table("restaurant")
            .select("*, restaurant_translations(*)")
            .eq("day_plan_id", day_row["id"])
            .order("sort_order")
            .execute()
        )

        days.append(
            DayPlan(
                day_number=day_row["day_number"],
                date=day_row["date"],
                activities=[
                    _build_activity(a, locale)
                    for a in activities_resp.data
                ],
                restaurants=[
                    _build_restaurant(r, locale)
                    for r in restaurants_resp.data
                ],
            )
        )

    return ItineraryDetail(
        id=itinerary_row["id"],
        destination_city=itinerary_text.get("destination_city"),
        destination_country=itinerary_text.get("destination_country") or "",
        summary=itinerary_text.get("summary") or "",
        trip_types=itinerary_row.get("trip_types") or [],
        days=days,
        can_edit=bool(edit_token) and secrets.compare_digest(edit_token, itinerary_row["edit_token"]),
    )


def _build_activity(row: dict, locale: str) -> Activity:
    text = _pick_translation(row.get("activity_translations") or [], locale)
    return Activity(
        name=text.get("name") or "",
        description=text.get("description") or "",
        category=text.get("category") or "",
        location_query=row["location_query"],
        duration_minutes=row["duration_minutes"],
        budget_level=row["budget_level"],
        source_url=row["source_url"],
        lat=row["lat"],
        lon=row["lon"],
    )


def _build_restaurant(row: dict, locale: str) -> Restaurant:
    text = _pick_translation(row.get("restaurant_translations") or [], locale)
    return Restaurant(
        name=text.get("name") or "",
        description=text.get("description") or "",
        cuisine=text.get("cuisine") or "",
        location_query=row["location_query"],
        budget_level=row["budget_level"],
        source_url=row["source_url"],
        lat=row["lat"],
        lon=row["lon"],
    )


def list_itineraries(locale: str = DEFAULT_LOCALE) -> list[ItinerarySummary]:
    # day_plan(day_number) embeds each itinerary's day rows just to count them —
    # avoids a second round trip per itinerary for a value we only need the length of.
    resp = (
        client.table("itinerary")
        .select("id, trip_types, created_at, itinerary_translations(*), day_plan(day_number)")
        .order("created_at", desc=True)
        .execute()
    )
    result = []
    for row in resp.data:
        text = _pick_translation(row.get("itinerary_translations") or [], locale)
        result.append(
            ItinerarySummary(
                id=row["id"],
                destination_city=text.get("destination_city"),
                destination_country=text.get("destination_country") or "",
                summary=text.get("summary") or "",
                trip_types=row.get("trip_types") or [],
                day_count=len(row.get("day_plan") or []),
                created_at=row["created_at"],
            )
        )
    return result


def get_itinerary_context(itinerary_id: str) -> ItineraryContext | None:
    """Reconstructs the original request parameters for regeneration.

    Always sourced from the French translation, regardless of any viewer's
    locale — regeneration prompts must be built from the canonical content,
    never from a (possibly missing or lossy) English translation.

    traveler_type/traveler_count default to solo/1 for itineraries saved
    before those columns existed — best effort, not a hard failure.
    """
    itinerary_resp = (
        client.table("itinerary").select("*, itinerary_translations(*)").eq("id", itinerary_id).execute()
    )
    if not itinerary_resp.data:
        return None
    row = itinerary_resp.data[0]
    text = _pick_translation(row.get("itinerary_translations") or [], DEFAULT_LOCALE)

    days_resp = (
        client.table("day_plan").select("date").eq("itinerary_id", itinerary_id).order("day_number").execute()
    )
    if not days_resp.data:
        return None

    return ItineraryContext(
        destination_city=text.get("destination_city"),
        destination_country=text.get("destination_country") or "",
        city_lat=row["city_lat"],
        city_lon=row["city_lon"],
        traveler_type=TravelerType(row["traveler_type"]) if row.get("traveler_type") else TravelerType.solo,
        traveler_count=row.get("traveler_count") or 1,
        trip_types=row.get("trip_types") or [],
        day_dates=[day["date"] for day in days_resp.data],
    )


def replace_days(itinerary_id: str, itinerary: ItineraryResponse, translated: TranslatedItinerary | None = None) -> None:
    """Full regeneration: swap every day for a freshly generated one."""
    client.table("itinerary_translations").delete().eq("itinerary_id", itinerary_id).execute()
    translation_rows = [
        {
            "itinerary_id": itinerary_id,
            "locale": "fr",
            "destination_city": itinerary.destination_city,
            "destination_country": itinerary.destination_country,
            "summary": itinerary.summary,
        }
    ]
    if translated is not None:
        translation_rows.append(
            {
                "itinerary_id": itinerary_id,
                "locale": "en",
                "destination_city": translated.destination_city,
                "destination_country": translated.destination_country,
                "summary": translated.summary,
            }
        )
    client.table("itinerary_translations").insert(translation_rows).execute()

    # Cascades to activity/restaurant rows (and, in turn, their translation rows).
    client.table("day_plan").delete().eq("itinerary_id", itinerary_id).execute()
    _insert_days(itinerary_id, itinerary.days, translated.days if translated else None)


def get_day_plan_ids(itinerary_id: str) -> dict[int, str]:
    """Maps day_number -> day_plan row id, needed to target a single day for partial regeneration."""
    resp = client.table("day_plan").select("id, day_number").eq("itinerary_id", itinerary_id).execute()
    return {row["day_number"]: row["id"] for row in resp.data}


def replace_day_items(
    day_plan_id: str,
    activities: list[Activity],
    restaurants: list[Restaurant],
    translated: DayContent | None = None,
) -> None:
    """Partial regeneration: swap one day's activities/restaurants for a merged kept+new list.

    `translated`, if given, must already be the full merged (kept+new) English content for
    this day, aligned by index with `activities`/`restaurants` — every row for this day is
    deleted and reinserted, so even untouched kept items need their translation re-supplied.
    """
    client.table("activity").delete().eq("day_plan_id", day_plan_id).execute()
    client.table("restaurant").delete().eq("day_plan_id", day_plan_id).execute()
    _insert_activities(day_plan_id, activities, translated.activities if translated else None)
    _insert_restaurants(day_plan_id, restaurants, translated.restaurants if translated else None)
