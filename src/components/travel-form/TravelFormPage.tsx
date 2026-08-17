"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import TravelForm from "./TravelForm";

interface TravelFormPageProps {
  name?: string;
}

export default function TravelFormPage({ name }: TravelFormPageProps) {
  const { t } = useLanguage();
  const displayName = name ? name.charAt(0).toUpperCase() + name.slice(1) : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-violet-50 via-white to-white px-4 py-12 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-950">
      <div className="w-full max-w-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl dark:text-zinc-50">
            {displayName ? t("travelFormPage.greeting", { name: displayName }) : t("travelFormPage.title")}
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">{t("travelFormPage.subtitle")}</p>
          <Link
            href="/library"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:underline dark:text-violet-400"
          >
            <BookOpen className="size-3.5" />
            {t("travelFormPage.libraryLink")}
          </Link>
        </div>

        <TravelForm />
      </div>
    </main>
  );
}
