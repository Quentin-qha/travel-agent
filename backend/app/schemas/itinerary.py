from datetime import date
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class TravelerType(str, Enum):
    solo = "solo"
    couple = "couple"
    famille = "famille"
    amis = "amis"
    groupe = "groupe"


class City(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    label: str
    lat: float
    lon: float


class DateRange(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    from_date: date = Field(alias="from")
    to_date: date = Field(alias="to")


class ItineraryRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    city: City
    date_range: DateRange = Field(alias="dateRange")
    traveler_type: TravelerType = Field(alias="travelerType")
    traveler_count: int = Field(alias="travelerCount", gt=0)
    trip_types: list[str] = Field(alias="tripTypes")


class BudgetLevel(str, Enum):
    free = "gratuit"
    low = "€"
    medium = "€€"
    high = "€€€"


class Activity(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    location_query: str
    description: str
    category: str
    duration_minutes: int
    budget_level: BudgetLevel
    source_url: str
    lat: float | None = None
    lon: float | None = None
    # Google Places photo URL — filled in after geocoding, never by the model.
    image_url: str | None = None


class Restaurant(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    location_query: str
    description: str
    cuisine: str
    budget_level: BudgetLevel
    source_url: str
    lat: float | None = None
    lon: float | None = None
    # Google Places photo URL — filled in after geocoding, never by the model.
    image_url: str | None = None


class DayPlan(BaseModel):
    model_config = ConfigDict(extra="forbid")

    day_number: int
    date: date
    activities: list[Activity]
    restaurants: list[Restaurant]


class ItineraryResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    destination_city: str
    destination_country: str
    summary: str
    days: list[DayPlan]
    # Cover photo for the destination — filled in after geocoding, never by the model.
    image_url: str | None = None


class ItineraryCreateResponse(ItineraryResponse):
    id: str | None = None
    # Echoed back from the request (Claude never sees/produces this) so the
    # frontend can display the chosen ambiances without a second round trip.
    trip_types: list[str] = Field(default_factory=list)
    # Only ever sent once, right after creation — the frontend stores it in a
    # cookie and never sees it again (GET/regenerate return can_edit instead).
    edit_token: str | None = None


class ItineraryDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    # Nullable here (unlike ItineraryResponse.destination_city) to tolerate rows
    # saved before destination_city was a required field.
    destination_city: str | None = None
    destination_country: str
    summary: str
    trip_types: list[str] = Field(default_factory=list)
    days: list[DayPlan]
    image_url: str | None = None
    # Whether the requester's edit_token matched this itinerary's — never the
    # raw token itself, so a shared link can't leak edit rights.
    can_edit: bool = False


class ItinerarySummary(BaseModel):
    """Lightweight listing shape — no activities/restaurants, just enough for a library card."""

    model_config = ConfigDict(extra="forbid")

    id: str
    destination_city: str | None = None
    destination_country: str
    summary: str
    trip_types: list[str] = Field(default_factory=list)
    day_count: int
    created_at: str


class RegenerateItineraryRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    # Card keys from the UI, e.g. "2-activity-0" — every item currently
    # persisted must be identifiable this way (see ItineraryEditor parsing).
    item_keys: list[str] = Field(alias="itemKeys", min_length=1)


class ItineraryContext(BaseModel):
    """Original request parameters reconstructed from storage, for regeneration."""

    model_config = ConfigDict(extra="forbid")

    destination_city: str | None
    destination_country: str
    city_lat: float
    city_lon: float
    traveler_type: TravelerType
    traveler_count: int
    trip_types: list[str]
    day_dates: list[date]


class DayItemsResponse(BaseModel):
    """Structured output for a scoped, single-day partial regeneration."""

    model_config = ConfigDict(extra="forbid")

    activities: list[Activity]
    restaurants: list[Restaurant]


class ActivityContent(BaseModel):
    """Just the linguistic fields of an Activity — the shape a translation call fills in."""

    model_config = ConfigDict(extra="forbid")

    name: str
    description: str
    category: str


class RestaurantContent(BaseModel):
    """Just the linguistic fields of a Restaurant — the shape a translation call fills in."""

    model_config = ConfigDict(extra="forbid")

    name: str
    description: str
    cuisine: str


class DayContent(BaseModel):
    """Translated activities/restaurants for a single day, same order as the source day."""

    model_config = ConfigDict(extra="forbid")

    activities: list[ActivityContent]
    restaurants: list[RestaurantContent]


class TranslatedItinerary(BaseModel):
    """Structured output for translating a full ItineraryResponse to English."""

    model_config = ConfigDict(extra="forbid")

    destination_city: str
    destination_country: str
    summary: str
    days: list[DayContent]
