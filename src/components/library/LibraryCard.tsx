import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { ItinerarySummary } from "@/components/travel-form/types";

export default function LibraryCard({ itinerary }: { itinerary: ItinerarySummary }) {
  const { t } = useLanguage();
  const title = itinerary.destination_city ?? itinerary.destination_country;

  return (
    <Link
      href={`/${itinerary.id}`}
      className="group flex flex-col rounded-2xl border border-zinc-200/80 bg-white/80 p-5 shadow-sm shadow-zinc-900/5 backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-900/10 dark:border-zinc-800 dark:bg-zinc-900/60"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
          {itinerary.destination_city && (
            <p className="text-xs text-zinc-400 dark:text-zinc-500">{itinerary.destination_country}</p>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
          {itinerary.day_count} {itinerary.day_count > 1 ? t("common.days") : t("common.day")}
        </span>
      </div>

      {/* {itinerary.trip_types.length > 0 && (
        <div className=" flex flex-wrap gap-1.5">
          {itinerary.trip_types.map((type) => (
            <span
              key={type}
              className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
            >
              {type}
            </span>
          ))}
        </div>
      )} */}

      <div className="flex-1">
        <p className="line-clamp-3 text-sm text-zinc-600 dark:text-zinc-300">{itinerary.summary}</p>
      </div>


      <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-violet-600 group-hover:underline dark:text-violet-400">
        {t("library.card.viewTrip")}
        <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
