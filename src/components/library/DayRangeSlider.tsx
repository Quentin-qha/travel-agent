"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";

interface DayRangeSliderProps {
  min: number;
  max: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
}

export default function DayRangeSlider({ min, max, value, onChange }: DayRangeSliderProps) {
  const { t } = useLanguage();
  const [lo, hi] = value;
  const loPercent = ((lo - min) / (max - min)) * 100;
  const hiPercent = ((hi - min) / (max - min)) * 100;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-center text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {lo === hi ? `${lo} ${lo > 1 ? t("common.days") : t("common.day")}` : `${lo}–${hi} ${t("common.days")}`}
      </p>

      <div className="relative h-5">
        <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-zinc-200 dark:bg-zinc-700" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-violet-500"
          style={{ left: `${loPercent}%`, right: `${100 - hiPercent}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={lo}
          onChange={(e) => onChange([Math.min(Number(e.target.value), hi), hi])}
          className="dual-range-thumb absolute inset-0 w-full appearance-none bg-transparent"
          aria-label={t("library.dayFilter.ariaMin")}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={hi}
          onChange={(e) => onChange([lo, Math.max(Number(e.target.value), lo)])}
          className="dual-range-thumb absolute inset-0 w-full appearance-none bg-transparent"
          aria-label={t("library.dayFilter.ariaMax")}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
