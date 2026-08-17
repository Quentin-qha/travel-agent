export interface City {
  id: string;
  name: string;
  label: string;
  lat: number;
  lon: number;
}

export type TravelerType = "solo" | "couple" | "famille" | "amis" | "groupe";

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

export interface TravelFormData {
  city: City | null;
  dateRange: DateRange;
  travelerType: TravelerType | null;
  travelerCount: number;
  tripTypes: string[];
}

export interface ItineraryActivity {
  name: string;
  location_query: string;
  description: string;
  category: string;
  duration_minutes: number;
  budget_level: string;
  source_url: string;
  lat: number | null;
  lon: number | null;
  image_url: string | null;
}

export interface ItineraryRestaurant {
  name: string;
  location_query: string;
  description: string;
  cuisine: string;
  budget_level: string;
  source_url: string;
  lat: number | null;
  lon: number | null;
  image_url: string | null;
}

export interface ItineraryDay {
  day_number: number;
  date: string;
  activities: ItineraryActivity[];
  restaurants: ItineraryRestaurant[];
}

export interface ItineraryResult {
  id: string | null;
  destination_city: string;
  destination_country: string;
  summary: string;
  trip_types: string[];
  days: ItineraryDay[];
  image_url: string | null;
}

export interface ItineraryViewData {
  // Nullable: itineraries saved before destination_city was required may not have it.
  destination_city: string | null;
  destination_country: string;
  summary: string;
  trip_types: string[];
  days: ItineraryDay[];
  image_url: string | null;
  // Whether the viewer holds a valid edit token for this itinerary.
  can_edit: boolean;
}

export interface ItinerarySummary {
  id: string;
  destination_city: string | null;
  destination_country: string;
  summary: string;
  trip_types: string[];
  day_count: number;
  created_at: string;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

/** Structural check that `value` has the shape of one `ItineraryDay` (used by `isItineraryViewData`). */
function isItineraryDay(value: unknown): value is ItineraryDay {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.day_number === "number" &&
    typeof v.date === "string" &&
    Array.isArray(v.activities) &&
    Array.isArray(v.restaurants)
  );
}

// Guards the two spots where a Server Component trusts an untyped
// `response.json()` from the backend (src/app/[id]/page.tsx,
// src/app/library/page.tsx). The backend schema is still actively changing —
// this catches a shape mismatch as a clear error instead of a broken render.
export function isItineraryViewData(value: unknown): value is ItineraryViewData {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    isNullableString(v.destination_city) &&
    typeof v.destination_country === "string" &&
    typeof v.summary === "string" &&
    Array.isArray(v.trip_types) &&
    Array.isArray(v.days) &&
    v.days.every(isItineraryDay) &&
    isNullableString(v.image_url) &&
    typeof v.can_edit === "boolean"
  );
}

/** Type guard for the array returned by `GET /api/itinerary` (library listing) — see `isItineraryViewData`. */
export function isItinerarySummaryList(value: unknown): value is ItinerarySummary[] {
  if (!Array.isArray(value)) return false;
  return value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const v = item as Record<string, unknown>;
    return (
      typeof v.id === "string" &&
      isNullableString(v.destination_city) &&
      typeof v.destination_country === "string" &&
      typeof v.summary === "string" &&
      Array.isArray(v.trip_types) &&
      typeof v.day_count === "number" &&
      typeof v.created_at === "string"
    );
  });
}

/** `"City, Country"`, or just `"Country"` if `city` is null (old trips saved before it was required). */
export function formatDestination(city: string | null, country: string): string {
  return city ? `${city}, ${country}` : country;
}

export const TRAVELER_TYPES: { id: TravelerType; defaultCount: number }[] = [
  { id: "solo", defaultCount: 1 },
  { id: "couple", defaultCount: 2 },
  { id: "famille", defaultCount: 4 },
  { id: "amis", defaultCount: 4 },
  { id: "groupe", defaultCount: 8 },
];

export const TRIP_TYPES: string[] = [
  "Activités enfants",
  "Architectures",
  "Culture",
  "Hors des sentiers battus",
  "Insolite",
  "Instagrammable",
  "Marchés",
  "Musées",
  "Nature",
  "Photographie",
  "Randonnée",
  "Repos",
  "Roadtrip",
  "Sensation fortes",
  "Shopping",
  "Sport",
  "Street art",
  "Traditionnel",
];

export const MAX_TRIP_TYPES = 5;

export const STEPS = [
  { id: 1, labelKey: "steps.stay" },
  { id: 2, labelKey: "steps.tripType" },
  { id: 3, labelKey: "steps.summary" },
] as const;

export const INITIAL_FORM_DATA: TravelFormData = {
  city: null,
  dateRange: { from: null, to: null },
  travelerType: null,
  travelerCount: 1,
  tripTypes: [],
};

/** Whether the given form step's required fields are filled in — gates the "Next" button in `TravelForm.tsx`. */
export function isStepValid(step: number, data: TravelFormData): boolean {
  switch (step) {
    case 1:
      return (
        data.city !== null &&
        data.dateRange.from !== null &&
        data.dateRange.to !== null &&
        data.travelerType !== null &&
        data.travelerCount > 0
      );
    case 2:
      return data.tripTypes.length > 0 && data.tripTypes.length <= MAX_TRIP_TYPES;
    case 3:
      return true;
    default:
      return false;
  }
}
