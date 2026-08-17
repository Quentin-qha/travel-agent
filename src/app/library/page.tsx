import { isItinerarySummaryList } from "@/components/travel-form/types";
import LibraryBrowser from "@/components/library/LibraryBrowser";
import { getServerLocale } from "@/lib/i18n/locale";
import { API_URL } from "@/lib/apiUrl";

/**
 * `/library` — Server Component that does the one data fetch (`GET /api/itinerary`, in the
 * viewer's locale) and hands the full, unfiltered list to `LibraryBrowser` (Client Component)
 * for search/filter/rendering. Kept as a Server Component specifically so this fetch runs
 * server-side; the interactive filtering itself can't live here (needs `useLanguage()` and
 * client state).
 */
export default async function LibraryPage() {
  const locale = await getServerLocale();
  const response = await fetch(`${API_URL}/api/itinerary?lang=${locale}`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Erreur ${response.status}`);
  }

  const data = await response.json();
  if (!isItinerarySummaryList(data)) {
    throw new Error("Réponse de l'API invalide pour la bibliothèque.");
  }
  const itineraries = data;

  return (
    <main className="min-h-screen bg-gradient-to-b from-violet-50 via-white to-white px-4 py-12 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-950">
      <div className="mx-auto max-w-5xl">
        <LibraryBrowser itineraries={itineraries} />
      </div>
    </main>
  );
}
