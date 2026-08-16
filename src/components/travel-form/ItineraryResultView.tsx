"use client";

import { format, parseISO } from "date-fns";
import { Clock, ExternalLink, MapPin, UtensilsCrossed } from "lucide-react";
import { useDateFnsLocale, useLanguage } from "@/lib/i18n/LanguageProvider";
import { translateTripType } from "@/lib/i18n/tripTypeLabels";
import { formatDestination, type ItineraryActivity, type ItineraryRestaurant, type ItineraryViewData } from "./types";

interface ItineraryResultViewProps {
  itinerary: ItineraryViewData;
}

export default function ItineraryResultView({ itinerary }: ItineraryResultViewProps) {
  const { locale } = useLanguage();
  const dateLocale = useDateFnsLocale();

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-sm font-semibold text-violet-600 dark:text-violet-400">
          {formatDestination(itinerary.destination_city, itinerary.destination_country)}
        </p>
        {itinerary.trip_types.length > 0 && (
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
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
        <p className="mx-auto mt-1.5 max-w-lg text-sm text-zinc-600 dark:text-zinc-300">{itinerary.summary}</p>
      </div>

      <div className="space-y-5">
        {itinerary.days.map((day) => (
          <div
            key={day.day_number}
            className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-semibold text-white">
                {day.day_number}
              </span>
              <span className="text-sm font-semibold capitalize text-zinc-800 dark:text-zinc-100">
                {format(parseISO(day.date), "EEEE d MMMM", { locale: dateLocale })}
              </span>
            </div>

            <div className="space-y-2">
              {day.activities.map((activity, index) => (
                <PlaceCard key={index} icon={MapPin} place={activity} detail={`${activity.duration_minutes} min`} />
              ))}
              {day.restaurants.map((restaurant, index) => (
                <PlaceCard
                  key={index}
                  icon={UtensilsCrossed}
                  place={restaurant}
                  detail={restaurant.cuisine}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlaceCard({
  icon: Icon,
  place,
  detail,
}: {
  icon: typeof MapPin;
  place: ItineraryActivity | ItineraryRestaurant;
  detail: string;
}) {
  const { t } = useLanguage();

  return (
    <div className="flex gap-2.5 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/60">
      <Icon className="mt-0.5 size-4 shrink-0 text-violet-500" strokeWidth={2.25} />
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
            className="inline-flex items-center gap-1 text-violet-600 hover:underline dark:text-violet-400"
          >
            <ExternalLink className="size-3.5" />
            {t("itineraryResult.source")}
          </a>
        </div>
      </div>
    </div>
  );
}
