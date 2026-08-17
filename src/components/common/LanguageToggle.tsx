"use client";

import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

/**
 * FR/EN switch, mounted once in `layout.tsx` so it's visible on every page. Writes the locale
 * cookie via `setLocale` (see `LanguageProvider`) and calls `router.refresh()` so any Server
 * Component on the current page (e.g. `/library`, `/[id]`) re-fetches its data in the new
 * language — a full page reload isn't needed for that.
 */
export default function LanguageToggle() {
  const router = useRouter();
  const { locale, setLocale } = useLanguage();

  return (
    <button
      type="button"
      onClick={() => {
        setLocale(locale === "fr" ? "en" : "fr");
        // Re-runs Server Component fetches (library/[id] pages) against the new cookie.
        router.refresh();
      }}
      aria-label={locale === "fr" ? "Switch to English" : "Passer en français"}
      // High z-index so this stays above Leaflet's internal panes/controls on the
      // itinerary page — the map was painting over it at the previous z-[100].
      className="fixed top-4 right-4 z-[999] flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-600 shadow-md transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      <Languages className="size-4" />
      {locale.toUpperCase()}
    </button>
  );
}
