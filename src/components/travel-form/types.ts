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
}

export interface ItineraryViewData {
  // Nullable: itineraries saved before destination_city was required may not have it.
  destination_city: string | null;
  destination_country: string;
  summary: string;
  trip_types: string[];
  days: ItineraryDay[];
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
