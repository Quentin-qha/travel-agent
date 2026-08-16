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


class DayPlan(BaseModel):
    model_config = ConfigDict(extra="forbid")

    day_number: int
    date: date
    activities: list[Activity]
    restaurants: list[Restaurant]


class ItineraryResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    destination_city: str | None = None
    destination_country: str
    summary: str
    days: list[DayPlan]


class ItineraryCreateResponse(ItineraryResponse):
    id: str | None = None


class ItineraryDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    destination: str
    summary: str
    days: list[DayPlan]
