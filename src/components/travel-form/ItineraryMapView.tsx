"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Clock, ExternalLink, MapPin, UtensilsCrossed } from "lucide-react";
import {
  formatDestination,
  type ItineraryActivity,
  type ItineraryDay,
  type ItineraryRestaurant,
  type ItineraryViewData,
} from "./types";
import type { MapPoint } from "./ItineraryMap";

const ItineraryMap = dynamic(() => import("./ItineraryMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-sm text-zinc-400 dark:bg-zinc-900">
      Chargement de la carte…
    </div>
  ),
});

interface ItineraryMapViewProps {
  itinerary: ItineraryViewData;
}

function buildPoints(day: ItineraryDay | undefined): MapPoint[] {
  if (!day) return [];
  const points: MapPoint[] = [];

  day.activities.forEach((activity, index) => {
    if (activity.lat == null || activity.lon == null) return;
    points.push({
      key: `${day.day_number}-activity-${index}`,
      kind: "activity",
      name: activity.name,
      description: activity.description,
      detail: `${activity.duration_minutes} min`,
      budgetLevel: activity.budget_level,
      sourceUrl: activity.source_url,
      lat: activity.lat,
      lon: activity.lon,
    });
  });

  day.restaurants.forEach((restaurant, index) => {
    if (restaurant.lat == null || restaurant.lon == null) return;
    points.push({
      key: `${day.day_number}-restaurant-${index}`,
      kind: "restaurant",
      name: restaurant.name,
      description: restaurant.description,
      detail: restaurant.cuisine,
      budgetLevel: restaurant.budget_level,
      sourceUrl: restaurant.source_url,
      lat: restaurant.lat,
      lon: restaurant.lon,
    });
  });

  return points;
}

const PARIS_FALLBACK: [number, number] = [48.8566, 2.3522];

function computeFallbackCenter(days: ItineraryDay[]): [number, number] {
  const firstGeocoded = days
    .flatMap((day) => [...day.activities, ...day.restaurants])
    .find((place) => place.lat != null && place.lon != null);
  return firstGeocoded ? [firstGeocoded.lat as number, firstGeocoded.lon as number] : PARIS_FALLBACK;
}

type DaySelection = number | "all";

export default function ItineraryMapView({ itinerary }: ItineraryMapViewProps) {
  const [selectedDay, setSelectedDay] = useState<DaySelection>(itinerary.days[0]?.day_number ?? 1);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const itemRefs = useRef(new Map<string, HTMLDivElement>());
  const dayRefs = useRef(new Map<number, HTMLDivElement>());
  const sidebarRef = useRef<HTMLDivElement>(null);
  const stickyHeaderRef = useRef<HTMLDivElement>(null);

  const activeDays = useMemo(
    () => (selectedDay === "all" ? itinerary.days : itinerary.days.filter((day) => day.day_number === selectedDay)),
    [itinerary.days, selectedDay],
  );

  const points = useMemo(() => activeDays.flatMap((day) => buildPoints(day)), [activeDays]);

  const fallbackCenter = useMemo(() => computeFallbackCenter(itinerary.days), [itinerary.days]);

  useEffect(() => {
    if (!selectedKey) return;
    itemRefs.current.get(selectedKey)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedKey]);

  function selectItem(key: string, dayNumber: number) {
    // Clicking an item never narrows the "Tout" overview back down to a single day.
    setSelectedDay((current) => (current === "all" ? current : dayNumber));
    setSelectedKey(key);
  }

  function handleDayButtonClick(day: DaySelection) {
    setSelectedDay(day);
    setSelectedKey(null);

    const container = sidebarRef.current;
    if (!container) return;

    if (day === "all") {
      container.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const target = dayRefs.current.get(day);
    if (!target) return;

    const headerHeight = stickyHeaderRef.current?.getBoundingClientRect().height ?? 0;
    const delta = target.getBoundingClientRect().top - container.getBoundingClientRect().top - headerHeight - 16;
    container.scrollTo({ top: container.scrollTop + delta, behavior: "smooth" });
  }

  return (
    <div className="flex h-svh flex-col lg:flex-row">
      <div
        ref={sidebarRef}
        className="order-2 flex w-full flex-col overflow-y-auto lg:order-1 lg:h-svh lg:w-[420px] lg:shrink-0 lg:border-r lg:border-zinc-200 dark:lg:border-zinc-800"
      >
        <div
          ref={stickyHeaderRef}
          className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 px-5 py-4 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/90"
        >
          <p className="text-3xl font-semibold">
            Votre voyage à{" "}
            <b className="text-bold">{formatDestination(itinerary.destination_city, itinerary.destination_country)}</b>
          </p>
          {itinerary.trip_types.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {itinerary.trip_types.map((tripType) => (
                <span
                  key={tripType}
                  className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
                >
                  {tripType}
                </span>
              ))}
            </div>
          )}
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{itinerary.summary}</p>
        </div>

        <div className="flex-1 px-4 py-4">
          {itinerary.days.map((day, dayIndex) => {
            const isLastDay = dayIndex === itinerary.days.length - 1;
            const isActiveDay = day.day_number === selectedDay;
            const isDayEmpty = day.activities.length === 0 && day.restaurants.length === 0;

            return (
              <div
                key={day.day_number}
                ref={(el) => {
                  if (el) dayRefs.current.set(day.day_number, el);
                  else dayRefs.current.delete(day.day_number);
                }}
                className="flex gap-3"
              >
                <div className="flex flex-col items-center">
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition ${
                      isActiveDay
                        ? "bg-violet-600 text-white shadow"
                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {day.day_number}
                  </span>
                  {!isLastDay && <div className="my-1 w-px flex-1 bg-zinc-200 dark:bg-zinc-700" />}
                </div>

                <div className={`min-w-0 flex-1 ${isLastDay ? "" : "pb-6"}`}>
                  <p className="mb-3 pt-1 text-sm font-semibold capitalize text-zinc-800 dark:text-zinc-100">
                    Jour {day.day_number} — {format(parseISO(day.date), "EEEE d MMMM", { locale: fr })}
                  </p>

                  <div className="space-y-2">
                    {day.activities.map((activity, index) => {
                      const cardKey = `${day.day_number}-activity-${index}`;
                      return (
                        <SidebarCard
                          key={cardKey}
                          cardKey={cardKey}
                          icon={MapPin}
                          iconColor="text-violet-500"
                          place={activity}
                          detail={`${activity.duration_minutes} min`}
                          selected={selectedKey === cardKey}
                          onSelect={() => selectItem(cardKey, day.day_number)}
                          registerRef={(el) => {
                            if (el) itemRefs.current.set(cardKey, el);
                            else itemRefs.current.delete(cardKey);
                          }}
                        />
                      );
                    })}
                    {day.restaurants.map((restaurant, index) => {
                      const cardKey = `${day.day_number}-restaurant-${index}`;
                      return (
                        <SidebarCard
                          key={cardKey}
                          cardKey={cardKey}
                          icon={UtensilsCrossed}
                          iconColor="text-amber-500"
                          place={restaurant}
                          detail={restaurant.cuisine}
                          selected={selectedKey === cardKey}
                          onSelect={() => selectItem(cardKey, day.day_number)}
                          registerRef={(el) => {
                            if (el) itemRefs.current.set(cardKey, el);
                            else itemRefs.current.delete(cardKey);
                          }}
                        />
                      );
                    })}
                    {isDayEmpty && <p className="text-sm text-zinc-400">Rien de prévu ce jour-là.</p>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative order-1 h-[45vh] w-full lg:order-2 lg:h-svh lg:flex-1">
        <ItineraryMap points={points} selectedKey={selectedKey} onSelect={setSelectedKey} fallbackCenter={fallbackCenter} />

        <div className="absolute top-3 left-3 z-[1000] flex gap-1.5 rounded-full bg-white/95 p-1.5 shadow-lg shadow-zinc-900/10 backdrop-blur-sm dark:bg-zinc-900/95">
          <button
            type="button"
            onClick={() => handleDayButtonClick("all")}
            className={`flex h-9 items-center justify-center rounded-full px-4 text-sm font-semibold transition ${
              selectedDay === "all"
                ? "bg-violet-600 text-white shadow"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            Tout
          </button>
          {itinerary.days.map((day) => {
            const isActive = day.day_number === selectedDay;
            return (
              <button
                key={day.day_number}
                type="button"
                onClick={() => handleDayButtonClick(day.day_number)}
                title={format(parseISO(day.date), "EEEE d MMMM", { locale: fr })}
                className={`flex h-9 items-center justify-center rounded-full text-sm font-semibold transition ${
                  isActive
                    ? "bg-violet-600 px-4 text-white shadow"
                    : "size-9 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {isActive ? `Jour ${day.day_number}` : day.day_number}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SidebarCard({
  cardKey,
  icon: Icon,
  iconColor,
  place,
  detail,
  selected,
  onSelect,
  registerRef,
}: {
  cardKey: string;
  icon: typeof MapPin;
  iconColor: string;
  place: ItineraryActivity | ItineraryRestaurant;
  detail: string;
  selected: boolean;
  onSelect: (key: string) => void;
  registerRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={registerRef}
      onClick={() => onSelect(cardKey)}
      className={`flex cursor-pointer gap-2.5 rounded-xl border p-3 transition ${
        selected
          ? "border-violet-400 bg-violet-50 dark:border-violet-500/50 dark:bg-violet-500/10"
          : "border-transparent bg-zinc-50 hover:border-zinc-200 dark:bg-zinc-800/60 dark:hover:border-zinc-700"
      }`}
    >
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
            <Clock className="size-3.5" />
            {detail}
          </span>
          <a
            href={place.source_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="inline-flex items-center gap-1 text-violet-600 hover:underline dark:text-violet-400"
          >
            <ExternalLink className="size-3.5" />
            Source
          </a>
        </div>
      </div>
    </div>
  );
}
