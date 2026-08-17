import type { ComponentType, ReactNode } from "react";
import type { ItineraryActivity, ItineraryRestaurant } from "./types";

interface PlaceCardContentProps {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  iconColor?: string;
  place: ItineraryActivity | ItineraryRestaurant;
  detail: string;
  detailIcon: ComponentType<{ className?: string }>;
  // Trailing content on the detail line — e.g. the "source" link in the
  // read-only result view. Omitted in the editable sidebar.
  children?: ReactNode;
}

// Shared between ItineraryResultView's PlaceCard (read-only, with a source
// link) and ItineraryMapView's SidebarCard (selectable/editable) — the two
// only differ in their outer wrapper (click handling, checkbox, ref
// registration vs. a plain source link), not in how a place's info renders.
export default function PlaceCardContent({
  icon: Icon,
  iconColor = "text-violet-500",
  place,
  detail,
  detailIcon: DetailIcon,
  children,
}: PlaceCardContentProps) {
  return (
    <>
      <Icon className={`mt-0.5 size-4 shrink-0 ${iconColor}`} strokeWidth={2.25} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{place.name}</span>
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
            {place.budget_level}
          </span>
        </div>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{place.description}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400 dark:text-zinc-500">
          <span className="inline-flex items-center gap-1">
            <DetailIcon className="size-3.5" />
            {detail}
          </span>
          {children}
        </div>
      </div>
    </>
  );
}
