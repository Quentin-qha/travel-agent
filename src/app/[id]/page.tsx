import { notFound } from "next/navigation";
import ItineraryMapView from "@/components/travel-form/ItineraryMapView";
import TravelFormPage from "@/components/travel-form/TravelFormPage";
import { isItineraryViewData } from "@/components/travel-form/types";
import { getServerLocale } from "@/lib/i18n/locale";
import { getServerEditToken } from "@/lib/editTokenServer";
import { API_URL } from "@/lib/apiUrl";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Catch-all route for any single path segment. Two very different pages share this file
 * depending on whether the segment is a trip UUID:
 * - UUID -> fetches the trip server-side (with the edit-token cookie, if any, forwarded as
 *   `X-Edit-Token`) and renders the full `ItineraryMapView` detail page. 404s via `notFound()`
 *   if the backend doesn't have that id.
 * - anything else (e.g. `/quentin`) -> treated as a visitor's name and renders `TravelFormPage`
 *   with a personalized greeting, not an error.
 */
export default async function CatchAllPage(props: PageProps<"/[id]">) {
  const { id } = await props.params;

  if (!UUID_PATTERN.test(id)) {
    return <TravelFormPage name={decodeURIComponent(id)} />;
  }

  const locale = await getServerLocale();
  const editToken = await getServerEditToken(id);
  const response = await fetch(`${API_URL}/api/itinerary/${id}?lang=${locale}`, {
    cache: "no-store",
    headers: editToken ? { "X-Edit-Token": editToken } : undefined,
  });

  if (response.status === 404) {
    notFound();
  }

  if (!response.ok) {
    throw new Error(`Erreur ${response.status}`);
  }

  const itinerary = await response.json();
  if (!isItineraryViewData(itinerary)) {
    throw new Error("Réponse de l'API invalide pour cet itinéraire.");
  }

  // Forces a clean remount on language change — drops any local edit-mode
  // state, which is correct since the underlying content just changed language.
  return <ItineraryMapView key={locale} itineraryId={id} itinerary={itinerary} />;
}
