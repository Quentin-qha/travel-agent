import type { ItinerarySummary } from "@/components/travel-form/types";
import LibraryBrowser from "@/components/library/LibraryBrowser";
import { getServerLocale } from "@/lib/i18n/locale";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default async function LibraryPage() {
  const locale = await getServerLocale();
  const response = await fetch(`${API_URL}/api/itinerary?lang=${locale}`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Erreur ${response.status}`);
  }

  const itineraries: ItinerarySummary[] = await response.json();

  return (
    <main className="min-h-screen bg-gradient-to-b from-violet-50 via-white to-white px-4 py-12 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-950">
      <div className="mx-auto max-w-5xl">
        <LibraryBrowser itineraries={itineraries} />
      </div>
    </main>
  );
}
