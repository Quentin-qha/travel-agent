"use client";

import { format } from "date-fns";
import { Calendar, MapPin, Sparkles, Tags, Users } from "lucide-react";
import { useDateFnsLocale, useLanguage } from "@/lib/i18n/LanguageProvider";
import { translateTripType } from "@/lib/i18n/tripTypeLabels";
import { TRAVELER_TYPES, type TravelFormData } from "./types";

interface SummaryStepProps {
  data: TravelFormData;
}

export default function SummaryStep({ data }: SummaryStepProps) {
  const { t, locale } = useLanguage();
  const dateLocale = useDateFnsLocale();
  const travelerLabel = TRAVELER_TYPES.find((type) => type.id === data.travelerType)
    ? t(`travelerTypes.${data.travelerType}`)
    : "—";

  const rows = [
    {
      icon: MapPin,
      label: t("summaryStep.destination"),
      value: data.city?.name ?? "—",
    },
    {
      icon: Calendar,
      label: t("summaryStep.dates"),
      value:
        data.dateRange.from && data.dateRange.to
          ? `${format(data.dateRange.from, "d MMM", { locale: dateLocale })} – ${format(data.dateRange.to, "d MMM yyyy", { locale: dateLocale })}`
          : "—",
    },
    {
      icon: Users,
      label: t("summaryStep.travelers"),
      value: `${travelerLabel} · ${data.travelerCount} ${data.travelerCount > 1 ? t("summaryStep.people") : t("summaryStep.person")}`,
    },
    {
      icon: Tags,
      label: t("summaryStep.moods"),
      value: data.tripTypes.length > 0 ? data.tripTypes.map((type) => translateTripType(type, locale)).join(", ") : "—",
    },
  ];

  return (
    <div>
      <div className="mb-5 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <Sparkles className="size-4 text-violet-500" />
        {t("summaryStep.heading")}
      </div>

      <dl className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-700 dark:bg-zinc-900">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
            <row.icon className="mt-0.5 size-4.5 shrink-0 text-violet-500" strokeWidth={2.25} />
            <div className="min-w-0">
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                {row.label}
              </dt>
              <dd className="mt-0.5 truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{row.value}</dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}
