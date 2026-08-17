"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

/** App Router error boundary — catches any uncaught rendering error below it, logs it, and
 * shows a retry/home UI instead of a blank crashed page. `reset()` re-tries the failed render. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useLanguage();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-to-b from-violet-50 via-white to-white px-4 text-center dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-950">
      <TriangleAlert className="size-10 text-red-500" />
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{t("errorPage.title")}</h1>
      <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">{t("errorPage.description")}</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
        >
          {t("errorPage.retry")}
        </button>
        <Link
          href="/"
          className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {t("errorPage.home")}
        </Link>
      </div>
    </main>
  );
}
