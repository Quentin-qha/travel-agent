"use client";

import { Check } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { translateTripType } from "@/lib/i18n/tripTypeLabels";
import { MAX_TRIP_TYPES, TRIP_TYPES } from "./types";

interface TripTypeSelectProps {
  selected: string[];
  onChange: (selected: string[]) => void;
}

/** Multi-select "vibes" chips (max `MAX_TRIP_TYPES`) — the `trip_types` sent to the backend
 * and stored as-is (French labels, never translated in storage; see `translateTripType`). */
export default function TripTypeSelect({ selected, onChange }: TripTypeSelectProps) {
  const { t, locale } = useLanguage();

  function toggle(type: string) {
    if (selected.includes(type)) {
      onChange(selected.filter((t) => t !== type));
    } else if (selected.length < MAX_TRIP_TYPES) {
      onChange([...selected, type]);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {t("tripTypeSelect.helper", { max: MAX_TRIP_TYPES })}
        </p>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            selected.length === MAX_TRIP_TYPES
              ? "bg-violet-600 text-white"
              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
          }`}
        >
          {selected.length}/{MAX_TRIP_TYPES}
        </span>
      </div>

      <div className="flex flex-wrap gap-2.5">
        {TRIP_TYPES.map((type) => {
          const isSelected = selected.includes(type);
          const isDisabled = !isSelected && selected.length >= MAX_TRIP_TYPES;
          return (
            <button
              key={type}
              type="button"
              onClick={() => toggle(type)}
              disabled={isDisabled}
              className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition ${
                isSelected
                  ? "border-violet-500 bg-violet-600 text-white shadow-md shadow-violet-600/20"
                  : isDisabled
                    ? "cursor-not-allowed border-zinc-100 text-zinc-300 dark:border-zinc-800 dark:text-zinc-600"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-violet-200 hover:bg-violet-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-violet-500/40 dark:hover:bg-violet-500/10"
              }`}
            >
              {isSelected && <Check className="size-3.5" strokeWidth={3} />}
              {translateTripType(type, locale)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
