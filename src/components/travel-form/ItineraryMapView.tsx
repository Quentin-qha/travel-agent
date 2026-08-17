"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  Check,
  Clock,
  ForkKnife,
  Maximize2,
  MapPin,
  Minimize2,
  Pencil,
  Share2,
  TriangleAlert,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useDateFnsLocale, useLanguage } from "@/lib/i18n/LanguageProvider";
import { translateTripType } from "@/lib/i18n/tripTypeLabels";
import GenerationLoaderModal from "./GenerationLoaderModal";
import PlaceCardContent from "./PlaceCardContent";
import {
  formatDestination,
  type ItineraryActivity,
  type ItineraryDay,
  type ItineraryRestaurant,
  type ItineraryViewData,
} from "./types";
import type { MapPoint } from "./ItineraryMap";

function MapLoadingFallback() {
  const { t } = useLanguage();
  return (
    <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-sm text-zinc-400 dark:bg-zinc-900">
      {t("itineraryMap.mapLoading")}
    </div>
  );
}

const ItineraryMap = dynamic(() => import("./ItineraryMap"), {
  ssr: false,
  loading: () => <MapLoadingFallback />,
});

interface ItineraryMapViewProps {
  itineraryId: string;
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
      imageUrl: activity.image_url,
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
      imageUrl: restaurant.image_url,
    });
  });

  return points;
}

function allItemKeys(days: ItineraryDay[]): string[] {
  return days.flatMap((day) => [
    ...day.activities.map((_, index) => `${day.day_number}-activity-${index}`),
    ...day.restaurants.map((_, index) => `${day.day_number}-restaurant-${index}`),
  ]);
}

const PARIS_FALLBACK: [number, number] = [48.8566, 2.3522];

function computeFallbackCenter(days: ItineraryDay[]): [number, number] {
  const firstGeocoded = days
    .flatMap((day) => [...day.activities, ...day.restaurants])
    .find((place) => place.lat != null && place.lon != null);
  return firstGeocoded ? [firstGeocoded.lat as number, firstGeocoded.lon as number] : PARIS_FALLBACK;
}

type DaySelection = number | "all";

export default function ItineraryMapView({ itineraryId, itinerary: initialItinerary }: ItineraryMapViewProps) {
  const { t, locale } = useLanguage();
  const dateLocale = useDateFnsLocale();
  const [itinerary, setItinerary] = useState(initialItinerary);
  const [selectedDay, setSelectedDay] = useState<DaySelection>("all");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const itemRefs = useRef(new Map<string, HTMLDivElement>());
  const dayRefs = useRef(new Map<number, HTMLDivElement>());
  const sidebarRef = useRef<HTMLDivElement>(null);
  const stickyHeaderRef = useRef<HTMLDivElement>(null);

  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedForRegen, setSelectedForRegen] = useState<Set<string>>(new Set());
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);
  const [showCopiedToast, setShowCopiedToast] = useState(false);

  const activeDays = useMemo(
    () => (selectedDay === "all" ? itinerary.days : itinerary.days.filter((day) => day.day_number === selectedDay)),
    [itinerary.days, selectedDay],
  );

  const points = useMemo(() => activeDays.flatMap((day) => buildPoints(day)), [activeDays]);

  const fallbackCenter = useMemo(() => computeFallbackCenter(itinerary.days), [itinerary.days]);

  const itemKeys = useMemo(() => allItemKeys(itinerary.days), [itinerary.days]);
  const selectedCount = selectedForRegen.size;
  const regenerateLabel =
    selectedCount === 0
      ? t("itineraryMap.noneSelected")
      : selectedCount === itemKeys.length
        ? t("itineraryMap.regenerate")
        : t("itineraryMap.changeSelected", { count: selectedCount });

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

  function handleStartEdit() {
    setIsEditing(true);
    setSelectedForRegen(new Set(itemKeys));
    setRegenError(null);
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setSelectedForRegen(new Set());
    setRegenError(null);
  }

  async function handleCopyShareLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      return;
    }
    setShowCopiedToast(true);
    setTimeout(() => setShowCopiedToast(false), 2000);
  }

  function toggleItemForRegen(key: string) {
    setSelectedForRegen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleRegenerate() {
    if (selectedForRegen.size === 0 || isRegenerating) return;

    setIsRegenerating(true);
    setRegenError(null);

    try {
      // The edit token is attached server-side by this route handler, read
      // from its HttpOnly cookie — the client never touches it.
      const response = await fetch(`/api/itinerary/${itineraryId}/regenerate?lang=${locale}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemKeys: Array.from(selectedForRegen) }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail ?? t("common.error.status", { status: response.status }));
      }

      const updated: ItineraryViewData = await response.json();
      setItinerary(updated);
      setIsEditing(false);
      setSelectedForRegen(new Set());
      setSelectedKey(null);
    } catch (err) {
      setRegenError(err instanceof Error ? err.message : t("common.error.generic"));
    } finally {
      setIsRegenerating(false);
    }
  }

  return (
    <div className="flex h-svh flex-col lg:flex-row">
      {isRegenerating && <GenerationLoaderModal />}
      <div
        ref={sidebarRef}
        className="flex h-svh w-full flex-col overflow-y-auto lg:w-[420px] lg:shrink-0 lg:border-r lg:border-zinc-200 dark:lg:border-zinc-800"
      >
        <div
          ref={stickyHeaderRef}
          className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 px-5 py-4 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/90"
        >
          {isEditing && (
            <div className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-violet-50 px-3 py-2 dark:bg-violet-500/10">
              <span className="text-xs font-medium text-violet-700 dark:text-violet-300">
                {t("itineraryMap.editMode")}
              </span>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={selectedCount === 0 || isRegenerating}
                  className="rounded-full bg-violet-600 px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
                >
                  {isRegenerating ? t("itineraryMap.regenerating") : regenerateLabel}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={isRegenerating}
                  title={t("itineraryMap.cancel")}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          )}

          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center">
              <p className="text-3xl font-semibold">
                {t("itineraryMap.yourTripTo")}{" "}
                <b className="text-bold">{formatDestination(itinerary.destination_city, itinerary.destination_country)}</b>
              </p>
              <span className="mb-2 shrink-0 whitespace-nowrap text-sm text-zinc-600 dark:text-zinc-500">
                {itinerary.days.length} {itinerary.days.length > 1 ? t("common.days") : t("common.day")}
              </span>
            </div>

            {!isEditing && (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  title={t("itineraryMap.copyLink")}
                  className="flex size-8 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                >
                  <Share2 className="size-4" />
                </button>
                {itinerary.can_edit && (
                  <button
                    type="button"
                    onClick={handleStartEdit}
                    title={t("itineraryMap.editTrip")}
                    className="flex size-8 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  >
                    <Pencil className="size-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {itinerary.trip_types.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {itinerary.trip_types.map((tripType) => (
                <span
                  key={tripType}
                  className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
                >
                  {translateTripType(tripType, locale)}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 px-4 py-4">
          <div className="mb-4">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{itinerary.summary}</p>

            {itinerary.image_url && (
              <div className="relative mt-3 aspect-video w-full overflow-hidden rounded-xl">
                <Image
                  src={itinerary.image_url}
                  alt={formatDestination(itinerary.destination_city, itinerary.destination_country)}
                  fill
                  sizes="(min-width: 1024px) 420px, 100vw"
                  className="object-cover"
                />
              </div>
            )}

            {regenError && (
              <div className="mt-2.5 flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                <span>{regenError}</span>
              </div>
            )}
          </div>

          {isEditing && (
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedForRegen(selectedCount === itemKeys.length ? new Set() : new Set(itemKeys))}
                className="text-xs font-medium text-violet-600 hover:underline dark:text-violet-400"
              >
                {selectedCount === itemKeys.length ? t("itineraryMap.deselectAll") : t("itineraryMap.selectAll")}
              </button>
            </div>
          )}
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
                    {t("itineraryMap.dayLabel")} {day.day_number} —{" "}
                    {format(parseISO(day.date), "EEEE d MMMM", { locale: dateLocale })}
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
                          detailIcon={Clock}
                          selected={selectedKey === cardKey}
                          onSelect={() => selectItem(cardKey, day.day_number)}
                          registerRef={(el) => {
                            if (el) itemRefs.current.set(cardKey, el);
                            else itemRefs.current.delete(cardKey);
                          }}
                          editable={isEditing}
                          checked={selectedForRegen.has(cardKey)}
                          onToggleCheck={() => toggleItemForRegen(cardKey)}
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
                          detailIcon={ForkKnife}
                          selected={selectedKey === cardKey}
                          onSelect={() => selectItem(cardKey, day.day_number)}
                          registerRef={(el) => {
                            if (el) itemRefs.current.set(cardKey, el);
                            else itemRefs.current.delete(cardKey);
                          }}
                          editable={isEditing}
                          checked={selectedForRegen.has(cardKey)}
                          onToggleCheck={() => toggleItemForRegen(cardKey)}
                        />
                      );
                    })}
                    {isDayEmpty && <p className="text-sm text-zinc-400">{t("itineraryMap.emptyDay")}</p>}
                  </div>
                </div>
              </div>
            );
          })}
          {/* Keeps list content clear of the fixed bottom map panel on mobile. */}
          <div className="h-[40vh] shrink-0 lg:hidden" aria-hidden />
        </div>
      </div>

      <div
        className={
          isMapExpanded
            ? "fixed inset-0 z-40 h-svh w-full lg:relative lg:inset-auto lg:z-auto lg:h-svh lg:flex-1"
            : "fixed inset-x-0 bottom-0 z-30 h-[40vh] w-full lg:relative lg:inset-auto lg:z-auto lg:h-svh lg:flex-1"
        }
      >
        <ItineraryMap points={points} selectedKey={selectedKey} onSelect={setSelectedKey} fallbackCenter={fallbackCenter} />

        <div className="absolute top-3 left-3 z-[1000] flex max-w-[calc(100%-1.5rem)] items-center gap-1.5 rounded-full bg-white/95 p-1.5 shadow-lg shadow-zinc-900/10 backdrop-blur-sm dark:bg-zinc-900/95">
          <div className="flex min-w-0 gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => handleDayButtonClick("all")}
              className={`flex h-9 shrink-0 items-center justify-center rounded-full px-4 text-sm font-semibold transition ${
                selectedDay === "all"
                  ? "bg-violet-600 text-white shadow"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {t("itineraryMap.all")}
            </button>
            {itinerary.days.map((day) => {
              const isActive = day.day_number === selectedDay;
              return (
                <button
                  key={day.day_number}
                  type="button"
                  onClick={() => handleDayButtonClick(day.day_number)}
                  title={format(parseISO(day.date), "EEEE d MMMM", { locale: dateLocale })}
                  className={`flex h-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition ${
                    isActive
                      ? "bg-violet-600 px-4 text-white shadow"
                      : "size-9 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  {isActive ? `${t("itineraryMap.dayLabel")} ${day.day_number}` : day.day_number}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setIsMapExpanded((expanded) => !expanded)}
            title={t(isMapExpanded ? "itineraryMap.collapseMap" : "itineraryMap.expandMap")}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-zinc-600 transition hover:bg-zinc-100 lg:hidden dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {isMapExpanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
        </div>
      </div>

      {showCopiedToast && (
        <div className="fixed bottom-6 left-1/2 z-[2000] flex -translate-x-1/2 items-center gap-2 rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900">
          <Check className="size-4 text-emerald-400 dark:text-emerald-600" />
          {t("itineraryMap.linkCopied")}
        </div>
      )}
    </div>
  );
}

function SidebarCard({
  cardKey,
  icon: Icon,
  iconColor,
  place,
  detail,
  detailIcon: DetailIcon,
  selected,
  onSelect,
  registerRef,
  editable,
  checked,
  onToggleCheck,
}: {
  cardKey: string;
  icon: typeof MapPin;
  iconColor: string;
  place: ItineraryActivity | ItineraryRestaurant;
  detail: string;
  detailIcon: typeof Clock;
  selected: boolean;
  onSelect: (key: string) => void;
  registerRef: (el: HTMLDivElement | null) => void;
  editable: boolean;
  checked: boolean;
  onToggleCheck: () => void;
}) {
  return (
    <div
      ref={registerRef}
      onClick={() => (editable ? onToggleCheck() : onSelect(cardKey))}
      className={`flex cursor-pointer gap-2.5 rounded-xl border p-3 transition ${
        editable
          ? checked
            ? "border-violet-400 bg-violet-50 dark:border-violet-500/50 dark:bg-violet-500/10"
            : "border-transparent bg-zinc-50 opacity-60 dark:bg-zinc-800/60"
          : selected
            ? "border-violet-400 bg-violet-50 dark:border-violet-500/50 dark:bg-violet-500/10"
            : "border-transparent bg-zinc-50 hover:border-zinc-200 dark:bg-zinc-800/60 dark:hover:border-zinc-700"
      }`}
    >
      {editable && (
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggleCheck}
          onClick={(event) => event.stopPropagation()}
          className="mt-1 size-4 shrink-0 accent-violet-600"
        />
      )}
      <PlaceCardContent icon={Icon} iconColor={iconColor} place={place} detail={detail} detailIcon={DetailIcon} />
    </div>
  );
}
