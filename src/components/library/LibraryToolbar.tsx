"use client";

import { Check, Search, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { translateTripType } from "@/lib/i18n/tripTypeLabels";
import DayRangeDropdown from "./DayRangeDropdown";

interface LibraryToolbarProps {
  query: string;
  onQueryChange: (query: string) => void;
  dayBounds: { min: number; max: number };
  dayRange: [number, number];
  onDayRangeChange: (value: [number, number]) => void;
  availableTags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
}

/** Search box + day-range filter + trip-type tag chips for `/library` — purely controlled by
 * `LibraryBrowser`, holds no filter state of its own. `availableTags` should already be scoped
 * to tags actually present in the current trips (not the full `TRIP_TYPES` list). */
export default function LibraryToolbar({
  query,
  onQueryChange,
  dayBounds,
  dayRange,
  onDayRangeChange,
  availableTags,
  selectedTags,
  onToggleTag,
}: LibraryToolbarProps) {
  const { t, locale } = useLanguage();

  return (
    <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-zinc-200/80 bg-white/80 p-4 shadow-sm shadow-zinc-900/5 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t("library.toolbar.searchPlaceholder")}
            className="w-full rounded-2xl border border-zinc-200 bg-white py-2.5 pr-4 pl-10 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-violet-500 dark:focus:ring-violet-500/10"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              aria-label={t("library.toolbar.clearSearch")}
              className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <DayRangeDropdown min={dayBounds.min} max={dayBounds.max} value={dayRange} onChange={onDayRangeChange} />
      </div>

      {availableTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {availableTags.map((tag) => {
            const isSelected = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => onToggleTag(tag)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  isSelected
                    ? "border-violet-500 bg-violet-600 text-white shadow-sm shadow-violet-600/20"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-violet-200 hover:bg-violet-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-violet-500/40 dark:hover:bg-violet-500/10"
                }`}
              >
                {isSelected && <Check className="size-3" strokeWidth={3} />}
                {translateTripType(tag, locale)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
