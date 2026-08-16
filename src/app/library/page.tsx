import Link from "next/link";
import { ArrowRight, BookOpen, Plus } from "lucide-react";
import type { ItinerarySummary } from "@/components/travel-form/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default async function LibraryPage() {
  const response = await fetch(`${API_URL}/api/itinerary`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Erreur ${response.status}`);
  }

  const itineraries: ItinerarySummary[] = await response.json();

  return (
    <main className="min-h-screen bg-gradient-to-b from-violet-50 via-white to-white px-4 py-12 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-950">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <BookOpen className="size-6 text-violet-600 dark:text-violet-400" />
            <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl dark:text-zinc-50">Bibliothèque de voyages</h1>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-700"
          >
            <Plus className="size-4" />
            Nouveau voyage
          </Link>
        </div>

        {itineraries.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-300 bg-white/60 py-16 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Aucun voyage généré pour l&apos;instant.</p>
            <Link
              href="/"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:underline dark:text-violet-400"
            >
              Planifier ton premier voyage
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {itineraries.map((itinerary) => (
              <LibraryCard key={itinerary.id} itinerary={itinerary} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function LibraryCard({ itinerary }: { itinerary: ItinerarySummary }) {
  const title = itinerary.destination_city ?? itinerary.destination_country;

  return (
    <Link
      href={`/${itinerary.id}`}
      className="group flex flex-col rounded-2xl border border-zinc-200/80 bg-white/80 p-5 shadow-sm shadow-zinc-900/5 backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-900/10 dark:border-zinc-800 dark:bg-zinc-900/60"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
          {itinerary.destination_city && (
            <p className="text-xs text-zinc-400 dark:text-zinc-500">{itinerary.destination_country}</p>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
          {itinerary.day_count} jour{itinerary.day_count > 1 ? "s" : ""}
        </span>
      </div>

      <p className="line-clamp-3 flex-1 text-sm text-zinc-600 dark:text-zinc-300">{itinerary.summary}</p>

      <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-violet-600 group-hover:underline dark:text-violet-400">
        Voir le voyage
        <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
