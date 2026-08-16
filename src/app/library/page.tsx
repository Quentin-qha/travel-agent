import Link from "next/link";
import { ArrowRight, BookOpen, Plus } from "lucide-react";
import type { ItinerarySummary } from "@/components/travel-form/types";
import LibraryBrowser from "@/components/library/LibraryBrowser";

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
          <LibraryBrowser itineraries={itineraries} />
        )}
      </div>
    </main>
  );
}
