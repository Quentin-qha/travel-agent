from datetime import date
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, model_validator

# Hard cap on trip length — also bounds worst-case prompt size/cost per request
# (each day adds a line to the prompt and a full day's worth of Claude/geocoding work).
MAX_TRIP_DAYS = 31


class TravelerType(str, Enum):
    """Traveler configuration — influences pacing and the kind of suggestions."""

    solo = "solo"
    couple = "couple"
    famille = "famille"
    amis = "amis"
    groupe = "groupe"


class City(BaseModel):
    """Destination city, as selected via the client-side autocomplete."""

    model_config = ConfigDict(extra="forbid", json_schema_extra={
        "examples": [{"id": "osm-123", "name": "Lisbon", "label": "Lisbon, Portugal", "lat": 38.7223, "lon": -9.1393}]
    })

    id: str = Field(description="Free-form client-side identifier (e.g. from the autocomplete provider).")
    name: str = Field(description="Short city name, without the country.", examples=["Lisbon"])
    label: str = Field(description="Full displayed label.", examples=["Lisbon, Portugal"])
    lat: float = Field(description="City-center latitude — used as the origin for the 10km distance filter.")
    lon: float = Field(description="City-center longitude.")


class DateRange(BaseModel):
    """Trip bounds, inclusive on both ends."""

    model_config = ConfigDict(
        populate_by_name=True,
        extra="forbid",
        json_schema_extra={"examples": [{"from": "2026-09-10", "to": "2026-09-13"}]},
    )

    from_date: date = Field(alias="from", description="Arrival date (YYYY-MM-DD).")
    to_date: date = Field(
        alias="to",
        description=f"Departure date (YYYY-MM-DD), included in the plan. Must be on or after `from`, at most {MAX_TRIP_DAYS} days later.",
    )

    @model_validator(mode="after")
    def _validate_span(self) -> "DateRange":
        if self.to_date < self.from_date:
            raise ValueError("La date de fin doit être postérieure ou égale à la date de départ.")
        if (self.to_date - self.from_date).days + 1 > MAX_TRIP_DAYS:
            raise ValueError(f"Le voyage ne peut pas dépasser {MAX_TRIP_DAYS} jours.")
        return self


class ItineraryRequest(BaseModel):
    """Body of `POST /api/itinerary` — the creation form's parameters."""

    model_config = ConfigDict(
        populate_by_name=True,
        extra="forbid",
        json_schema_extra={
            "examples": [
                {
                    "city": {"id": "osm-123", "name": "Lisbon", "label": "Lisbon, Portugal", "lat": 38.7223, "lon": -9.1393},
                    "dateRange": {"from": "2026-09-10", "to": "2026-09-13"},
                    "travelerType": "couple",
                    "travelerCount": 2,
                    "tripTypes": ["food", "culture"],
                }
            ]
        },
    )

    city: City
    date_range: DateRange = Field(alias="dateRange")
    traveler_type: TravelerType = Field(alias="travelerType", description="Traveler configuration.")
    traveler_count: int = Field(
        alias="travelerCount", gt=0, le=20, description="Number of travelers, from 1 to 20."
    )
    trip_types: list[str] = Field(
        alias="tripTypes",
        description="Desired ambiances, freely chosen client-side (e.g. 'food', 'nature'). Can be empty.",
    )


class BudgetLevel(str, Enum):
    """Estimated cost. Always stays in this form (never translated), even when `lang=en`."""

    free = "gratuit"
    low = "€"
    medium = "€€"
    high = "€€€"


class Activity(BaseModel):
    """One activity for a day — place, time slot, budget and source."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(description="Displayed name, can be descriptive.", examples=["Torre de Belém"])
    location_query: str = Field(
        description="Short, exact place name used for geocoding — distinct from `name`, which can stay descriptive.",
        examples=["Torre de Belém"],
    )
    description: str
    category: str = Field(examples=["monument"])
    duration_minutes: int = Field(description="Estimated duration, travel time included where relevant.", examples=[90])
    budget_level: BudgetLevel
    source_url: str = Field(description="URL of the web source actually consulted for this place.")
    lat: float | None = Field(default=None, description="Latitude geocoded server-side — never produced by the model.")
    lon: float | None = Field(default=None, description="Longitude geocoded server-side.")
    image_url: str | None = Field(
        default=None,
        description=(
            "Photo of the place, filled in afterwards if found. Always a same-origin `/api/photo/...` "
            "URL served by this API — never a raw Google URL, so no Google API key is ever exposed here."
        ),
    )


class Restaurant(BaseModel):
    """A restaurant suggested for a day — same shape as an activity, without a duration."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(examples=["Pastéis de Belém"])
    location_query: str = Field(description="Short, exact place name used for geocoding.")
    description: str
    cuisine: str = Field(examples=["Portuguese"])
    budget_level: BudgetLevel
    source_url: str = Field(description="URL of the web source actually consulted for this place.")
    lat: float | None = Field(default=None, description="Latitude geocoded server-side.")
    lon: float | None = Field(default=None, description="Longitude geocoded server-side.")
    image_url: str | None = Field(
        default=None,
        description=(
            "Photo of the place, filled in afterwards if found. Always a same-origin `/api/photo/...` "
            "URL served by this API — never a raw Google URL, so no Google API key is ever exposed here."
        ),
    )


class DayPlan(BaseModel):
    """One day of the trip: its activities and restaurants, grouped by geographic proximity."""

    model_config = ConfigDict(extra="forbid")

    day_number: int = Field(description="Day number within the trip, starting at 1.", examples=[1])
    # Field(description=...) here breaks pydantic (field name "date" clashes with its own type
    # annotation "date" during class construction) — kept as a bare annotation, see class docstring.
    date: date
    activities: list[Activity]
    restaurants: list[Restaurant] = Field(description="1 to 2 restaurants close to that day's activities.")


class ItineraryResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    destination_city: str = Field(description="Short city name, without the country.", examples=["Lisbon"])
    destination_country: str = Field(examples=["Portugal"])
    summary: str = Field(description="Trip summary generated by the model.")
    days: list[DayPlan]
    # Cover photo for the destination — filled in after geocoding, never by the model.
    image_url: str | None = Field(
        default=None,
        description="Cover photo for the destination — a same-origin `/api/photo/...` URL, never a raw Google URL.",
    )


class ItineraryCreateResponse(ItineraryResponse):
    """Response of `POST /api/itinerary`. Contains everything in `ItineraryResponse`, plus the id
    and the edit token — the ONLY response that ever exposes this token in the clear."""

    id: str | None = Field(
        default=None,
        description=(
            "Permanent trip id. `null` only if the database save failed (storage service "
            "unavailable) — the trip was still generated normally but has neither a permanent "
            "URL nor future regeneration available."
        ),
    )
    # Echoed back from the request (Claude never sees/produces this) so the
    # frontend can display the chosen ambiances without a second round trip.
    trip_types: list[str] = Field(
        default_factory=list, description="Ambiances chosen at creation, echoed back as-is."
    )
    edit_token: str | None = Field(
        default=None,
        description=(
            "Edit token, returned ONCE here — the client must keep it (e.g. a cookie). "
            "Send it back in the `X-Edit-Token` header to be authorized to regenerate this trip "
            "later. `null` if `id` is `null`. Never returned in the clear by any other route again."
        ),
    )


class ItineraryDetail(BaseModel):
    """Response of `GET /api/itinerary/{id}` and of regeneration — a trip's full detail."""

    model_config = ConfigDict(extra="forbid")

    id: str
    # Nullable here (unlike ItineraryResponse.destination_city) to tolerate rows
    # saved before destination_city was a required field.
    destination_city: str | None = Field(
        default=None, description="Nullable to tolerate old trips saved before this field was required."
    )
    destination_country: str
    summary: str
    trip_types: list[str] = Field(default_factory=list, description="Ambiances chosen at creation.")
    days: list[DayPlan]
    image_url: str | None = Field(
        default=None,
        description="Cover photo for the destination — a same-origin `/api/photo/...` URL, never a raw Google URL.",
    )
    # Whether the requester's edit_token matched this itinerary's — never the
    # raw token itself, so a shared link can't leak edit rights.
    can_edit: bool = Field(
        default=False,
        description=(
            "`true` if the sent `X-Edit-Token` header matches this trip's token. "
            "Never the token itself — a shared link without the token stays readable but gets `false` here."
        ),
    )


class ItinerarySummary(BaseModel):
    """Lightweight trip shape for `GET /api/itinerary` — no `days`, just enough for a library card."""

    model_config = ConfigDict(extra="forbid")

    id: str
    destination_city: str | None = None
    destination_country: str
    summary: str
    trip_types: list[str] = Field(default_factory=list)
    day_count: int = Field(description="Number of days in the trip, without loading the full detail.")
    created_at: str = Field(description="Creation timestamp (ISO 8601).")


class RegenerateItineraryRequest(BaseModel):
    """Body of `POST /api/itinerary/{id}/regenerate`."""

    model_config = ConfigDict(
        populate_by_name=True, extra="forbid", json_schema_extra={"examples": [{"itemKeys": ["2-activity-0"]}]}
    )

    # Card keys from the UI, e.g. "2-activity-0" — every item currently
    # persisted must be identifiable this way (see ItineraryEditor parsing).
    item_keys: list[str] = Field(
        alias="itemKeys",
        min_length=1,
        description=(
            "Keys of the items to replace, format `\"{day}-{activity|restaurant}-{index}\"` "
            "(e.g. `\"2-activity-0\"`), obtained from the most recent GET response. "
            "Alternatively `\"{day}-day\"` (e.g. `\"3-day\"`) rebuilds that whole day from "
            "scratch — the model isn't constrained to the previous item count, and this is "
            "the only way to target a day that currently has zero items. "
            "If these keys cover ALL existing items, the whole trip is regenerated; "
            "otherwise only the affected days are touched and the rest is kept."
        ),
    )


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
