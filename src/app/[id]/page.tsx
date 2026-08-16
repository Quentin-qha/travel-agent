import { notFound } from "next/navigation";
import ItineraryMapView from "@/components/travel-form/ItineraryMapView";
import TravelFormPage from "@/components/travel-form/TravelFormPage";
import { getServerLocale } from "@/lib/i18n/locale";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CatchAllPage(props: PageProps<"/[id]">) {
  const { id } = await props.params;

  if (!UUID_PATTERN.test(id)) {
    return <TravelFormPage name={decodeURIComponent(id)} />;
  }

  const locale = await getServerLocale();
  const response = await fetch(`${API_URL}/api/itinerary/${id}?lang=${locale}`, { cache: "no-store" });

  if (response.status === 404) {
    notFound();
  }

  if (!response.ok) {
    throw new Error(`Erreur ${response.status}`);
  }

  const itinerary = await response.json();

  // Forces a clean remount on language change — drops any local edit-mode
  // state, which is correct since the underlying content just changed language.
  return <ItineraryMapView key={locale} itineraryId={id} itinerary={itinerary} />;
}
