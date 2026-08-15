"use client";

import { Minus, Plus, Users } from "lucide-react";
import { TRAVELER_TYPES, type TravelerType } from "./types";

interface TravelerPickerProps {
  travelerType: TravelerType | null;
  travelerCount: number;
  onTravelerTypeChange: (type: TravelerType) => void;
  onTravelerCountChange: (count: number) => void;
}

export default function TravelerPicker({
  travelerType,
  travelerCount,
  onTravelerTypeChange,
  onTravelerCountChange,
}: TravelerPickerProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
      <div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {TRAVELER_TYPES.map((type) => {
            const isSelected = travelerType === type.id;
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => {
                  onTravelerTypeChange(type.id);
                  if (travelerType !== type.id) onTravelerCountChange(type.defaultCount);
                }}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-3 text-sm font-medium transition ${
                  isSelected
                    ? "border-violet-500 bg-violet-600 text-white shadow-lg shadow-violet-600/20"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-violet-200 hover:bg-violet-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-violet-500/40 dark:hover:bg-violet-500/10"
                }`}
              >
                <Users className="size-4.5" strokeWidth={2.25} />
                {type.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
        <span className="whitespace-nowrap text-xs font-medium text-zinc-500 dark:text-zinc-400">Voyageurs</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onTravelerCountChange(Math.max(1, travelerCount - 1))}
            disabled={travelerCount <= 1}
            className="flex size-7 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Minus className="size-3.5" />
          </button>
          <span className="w-5 text-center text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {travelerCount}
          </span>
          <button
            type="button"
            onClick={() => onTravelerCountChange(Math.min(20, travelerCount + 1))}
            disabled={travelerCount >= 20}
            className="flex size-7 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
