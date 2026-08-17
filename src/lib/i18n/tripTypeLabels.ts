import type { Locale } from "./translations";

// Keyed by the exact French values in TRIP_TYPES (src/components/travel-form/types.ts) —
// those values are sent to the backend, stored in Supabase, and used for equality-based
// filtering, so they must never change. This map only affects display text.
const TRIP_TYPE_LABELS_EN: Record<string, string> = {
  "Activités enfants": "Kids activities",
  Architectures: "Architecture",
  Culture: "Culture",
  "Hors des sentiers battus": "Off the beaten path",
  Insolite: "Unusual",
  Instagrammable: "Instagrammable",
  Marchés: "Markets",
  Musées: "Museums",
  Nature: "Nature",
  Photographie: "Photography",
  Randonnée: "Hiking",
  Repos: "Relaxation",
  Roadtrip: "Road trip",
  "Sensation fortes": "Thrills",
  Shopping: "Shopping",
  Sport: "Sport",
  "Street art": "Street art",
  Traditionnel: "Traditional",
};

/**
 * Display-only English label for a `TRIP_TYPES` value (e.g. `"Randonnée"` -> `"Hiking"`).
 * Never use this for storage/filtering/API calls — those always use the raw French value;
 * this only changes what's rendered on screen when `locale === "en"`. Falls back to the
 * French value itself if it isn't in the map (e.g. legacy/unknown value).
 */
export function translateTripType(value: string, locale: Locale): string {
  if (locale !== "en") return value;
  return TRIP_TYPE_LABELS_EN[value] ?? value;
}
