"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock } from "lucide-react";
import DayRangeSlider from "./DayRangeSlider";

interface DayRangeDropdownProps {
  min: number;
  max: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
}

const PANEL_WIDTH = 256; // matches w-64

export default function DayRangeDropdown({ min, max, value, onChange }: DayRangeDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function updatePosition() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition({ top: rect.bottom + 8, left: rect.right - PANEL_WIDTH });
    }

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setIsOpen(false);
    }

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  if (min >= max) return null;

  const [lo, hi] = value;
  const isFiltered = lo !== min || hi !== max;
  const label = !isFiltered ? "Durée" : lo === hi ? `${lo} jour${lo > 1 ? "s" : ""}` : `${lo}–${hi} jours`;

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex h-full w-full min-w-[8.5rem] items-center gap-2.5 rounded-2xl border bg-white px-4 py-2.5 text-left text-sm outline-none transition sm:w-auto dark:bg-zinc-900 ${
          isOpen
            ? "border-violet-400 ring-4 ring-violet-100 dark:border-violet-500 dark:ring-violet-500/10"
            : "border-zinc-200 dark:border-zinc-700"
        }`}
      >
        <Clock className={`size-4.5 shrink-0 ${isFiltered ? "text-violet-600 dark:text-violet-400" : "text-zinc-400"}`} />
        <span
          className={`whitespace-nowrap ${isFiltered ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-500"}`}
        >
          {label}
        </span>
      </button>

      {isOpen &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            style={{ top: position.top, left: position.left, width: PANEL_WIDTH }}
            className="fixed z-50 rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl shadow-black/5 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <DayRangeSlider min={min} max={max} value={value} onChange={onChange} />

            {isFiltered && (
              <button
                type="button"
                onClick={() => onChange([min, max])}
                className="mt-3 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Réinitialiser
              </button>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
