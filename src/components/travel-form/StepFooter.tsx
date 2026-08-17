"use client";

import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

interface StepFooterProps {
  isFirstStep: boolean;
  isLastStep: boolean;
  isNextEnabled: boolean;
  isGenerating: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

/** Previous/Next navigation for the form. The "Next" button becomes "Generate" (with a loading
 * label) on the last step — same element throughout, `TravelForm.tsx` decides what it does. */
export default function StepFooter({
  isFirstStep,
  isLastStep,
  isNextEnabled,
  isGenerating,
  onPrevious,
  onNext,
}: StepFooterProps) {
  const { t } = useLanguage();

  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={onPrevious}
        disabled={isFirstStep}
        className={`flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 ${
          isFirstStep ? "cursor-not-allowed opacity-50" : "opacity-100"
        }`}
      >
        <ChevronLeft className="size-4" />
        {t("stepFooter.previous")}
      </button>

      <button
        type="button"
        onClick={onNext}
        disabled={!isNextEnabled || isGenerating}
        className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40 ${
          isLastStep
            ? "bg-gradient-to-r from-violet-600 to-fuchsia-500 shadow-lg shadow-fuchsia-500/25 hover:from-violet-500 hover:to-fuchsia-400"
            : "bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        }`}
      >
        {isLastStep ? (
          <>
            <Sparkles className="size-4" />
            {isGenerating ? t("stepFooter.generating") : t("stepFooter.generate")}
          </>
        ) : (
          <>
            <span>{t("stepFooter.next")}</span>
            <ChevronRight className="size-4" />
          </>
        )}
      </button>
    </div>
  );
}
