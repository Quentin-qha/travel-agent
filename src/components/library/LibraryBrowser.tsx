"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Plus } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { TRIP_TYPES, type ItinerarySummary } from "@/components/travel-form/types";
import LibraryToolbar from "./LibraryToolbar";
import LibraryCard from "./LibraryCard";

export default function LibraryBrowser({ itineraries }: { itineraries: ItinerarySummary[] }) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");

  const dayBounds = useMemo(() => {
    if (itineraries.length === 0) return { min: 0, max: 0 };
    const counts = itineraries.map((it) => it.day_count);
    return { min: Math.min(...counts), max: Math.max(...counts) };
  }, [itineraries]);

  const [dayRange, setDayRange] = useState<[number, number]>(() => [dayBounds.min, dayBounds.max]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const availableTags = useMemo(() => {
    const present = new Set(itineraries.flatMap((it) => it.trip_types));
    return TRIP_TYPES.filter((type) => present.has(type));
  }, [itineraries]);

  function toggleTag(tag: string) {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return itineraries.filter((it) => {
      const matchesQuery =
        !normalizedQuery ||
        `${it.destination_city ?? ""} ${it.destination_country}`.toLowerCase().includes(normalizedQuery);
      const matchesDayCount = it.day_count >= dayRange[0] && it.day_count <= dayRange[1];
      const matchesTags = selectedTags.length === 0 || it.trip_types.some((type) => selectedTags.includes(type));
      return matchesQuery && matchesDayCount && matchesTags;
    });
  }, [itineraries, query, dayRange, selectedTags]);

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <BookOpen className="size-6 text-violet-600 dark:text-violet-400" />
          <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl dark:text-zinc-50">{t("library.heading")}</h1>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-700"
        >
          <Plus className="size-4" />
          {t("library.newTrip")}
        </Link>
      </div>

      {itineraries.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-300 bg-white/60 py-16 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("library.emptyState")}</p>
          <Link
            href="/"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:underline dark:text-violet-400"
          >
            {t("library.planFirst")}
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      ) : (
        <>
          <LibraryToolbar
            query={query}
            onQueryChange={setQuery}
            dayBounds={dayBounds}
            dayRange={dayRange}
            onDayRangeChange={setDayRange}
            availableTags={availableTags}
            selectedTags={selectedTags}
            onToggleTag={toggleTag}
          />

          {filtered.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-300 bg-white/60 py-16 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("library.browser.noResults")}</p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setDayRange([dayBounds.min, dayBounds.max]);
                  setSelectedTags([]);
                }}
                className="mt-3 text-sm font-medium text-violet-600 hover:underline dark:text-violet-400"
              >
                {t("library.browser.resetFilters")}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((itinerary) => (
                <LibraryCard key={itinerary.id} itinerary={itinerary} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
