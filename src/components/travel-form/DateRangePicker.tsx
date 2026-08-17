"use client";

import { useEffect, useRef, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfWeek,
  endOfWeek,
  subMonths,
} from "date-fns";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useDateFnsLocale, useLanguage } from "@/lib/i18n/LanguageProvider";
import type { DateRange } from "./types";

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

/**
 * Two-month calendar dropdown for picking a trip's date range. Click behavior: first click
 * (or clicking after a full range is already set) starts a new `from`; second click sets `to`
 * (swapping if it's before `from`). Past dates are disabled.
 */
export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const { t } = useLanguage();
  const dateLocale = useDateFnsLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(value.from ?? new Date());
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleDayClick(day: Date) {
    const { from, to } = value;
    if (!from || (from && to)) {
      onChange({ from: day, to: null });
    } else if (isBefore(day, from)) {
      onChange({ from: day, to: from });
    } else {
      onChange({ from, to: day });
    }
  }

  const previewTo = value.from && !value.to ? hoverDate : null;

  function renderMonth(monthDate: Date) {
    const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });
    const today = startOfDay(new Date());

    return (
      <div className="w-full">
        <p className="mb-2 text-center text-sm font-semibold capitalize text-zinc-700 dark:text-zinc-200">
          {format(monthDate, "MMMM yyyy", { locale: dateLocale })}
        </p>
        <div className="grid grid-cols-7 gap-y-1 text-center">
          {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
            <span key={i} className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
              {d}
            </span>
          ))}
          {days.map((day) => {
            const disabled = isBefore(day, today);
            const inCurrentMonth = isSameMonth(day, monthDate);
            const isStart = value.from && isSameDay(day, value.from);
            const isEnd = value.to && isSameDay(day, value.to);
            const effectiveEnd = value.to ?? previewTo;
            const inRange =
              value.from &&
              effectiveEnd &&
              !isBefore(effectiveEnd, value.from) &&
              isWithinInterval(day, { start: value.from, end: effectiveEnd });

            return (
              <button
                key={day.toISOString()}
                type="button"
                disabled={disabled || !inCurrentMonth}
                onClick={() => handleDayClick(day)}
                onMouseEnter={() => setHoverDate(day)}
                className={`relative mx-auto flex size-9 items-center justify-center rounded-full text-sm transition ${
                  !inCurrentMonth ? "invisible" : ""
                } ${disabled ? "cursor-not-allowed text-zinc-300 dark:text-zinc-700" : "cursor-pointer"} ${
                  isStart || isEnd
                    ? "bg-violet-600 font-semibold text-white hover:bg-violet-600"
                    : inRange
                      ? "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300"
                      : !disabled
                        ? "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        : ""
                }`}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const label =
    value.from && value.to
      ? `${format(value.from, "d MMM", { locale: dateLocale })} – ${format(value.to, "d MMM yyyy", { locale: dateLocale })}`
      : value.from
        ? `${format(value.from, "d MMM yyyy", { locale: dateLocale })} – ?`
        : t("dateRangePicker.placeholder");

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex w-full items-center gap-2.5 rounded-2xl border bg-white px-4 py-3 text-left text-sm outline-none transition dark:bg-zinc-900 ${
          isOpen
            ? "border-violet-400 ring-4 ring-violet-100 dark:border-violet-500 dark:ring-violet-500/10"
            : "border-zinc-200 dark:border-zinc-700"
        }`}
      >
        <Calendar
          className={`size-4.5 shrink-0 ${value.from ? "text-violet-600 dark:text-violet-400" : "text-zinc-400"}`}
        />
        <span className={value.from ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-500"}>
          {label}
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-20 mt-2 min-w-[22rem] rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl shadow-black/5 sm:min-w-[30rem] dark:border-zinc-700 dark:bg-zinc-900">
          <div className="mb-1 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setVisibleMonth((m) => subMonths(m, 1))}
              className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label={t("dateRangePicker.prevMonth")}
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setVisibleMonth((m) => addMonths(m, 1))}
              className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label={t("dateRangePicker.nextMonth")}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="hidden gap-6 sm:flex">
            {renderMonth(visibleMonth)}
            {renderMonth(addMonths(visibleMonth, 1))}
          </div>
          <div className="sm:hidden">{renderMonth(visibleMonth)}</div>

          <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => onChange({ from: null, to: null })}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              {t("dateRangePicker.clear")}
            </button>
            <button
              type="button"
              disabled={!value.from || !value.to}
              onClick={() => setIsOpen(false)}
              className="rounded-full bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("dateRangePicker.confirm")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
