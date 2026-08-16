"use client";

import { Check } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { STEPS } from "./types";

interface StepBulletsProps {
  currentStep: number;
  maxStepReached: number;
  onStepClick: (step: number) => void;
}

export default function StepBullets({ currentStep, maxStepReached, onStepClick }: StepBulletsProps) {
  const { t } = useLanguage();

  return (
    <div className="flex items-center justify-center">
      {STEPS.map((step, index) => {
        const isCompleted = step.id < currentStep;
        const isCurrent = step.id === currentStep;
        const isClickable = step.id <= maxStepReached;

        return (
          <div key={step.id} className="flex flex-1 items-center last:flex-initial sm:max-w-52">
            <button
              type="button"
              onClick={() => isClickable && onStepClick(step.id)}
              disabled={!isClickable}
              className={`group flex shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-2 transition ${
                isClickable ? "cursor-pointer" : "cursor-not-allowed"
              }`}
            >
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition sm:size-8 ${
                  isCurrent
                    ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                    : isCompleted
                      ? "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
                      : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
                }`}
              >
                {isCompleted ? <Check className="size-3.5" strokeWidth={3} /> : step.id}
              </span>
              <span
                className={`hidden whitespace-nowrap text-sm font-medium transition sm:inline ${
                  isCurrent
                    ? "text-zinc-900 dark:text-zinc-100"
                    : isClickable
                      ? "text-zinc-500 group-hover:text-zinc-700 dark:text-zinc-400 dark:group-hover:text-zinc-200"
                      : "text-zinc-300 dark:text-zinc-600"
                }`}
              >
                {t(step.labelKey)}
              </span>
            </button>

            {index < STEPS.length - 1 && (
              <span
                className={`mx-1 h-px flex-1 sm:mx-2 ${
                  step.id < currentStep ? "bg-violet-300 dark:bg-violet-500/40" : "bg-zinc-200 dark:bg-zinc-800"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
