"use client";

import { useEffect, useState } from "react";
import { MapPin, Plane } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

const STEP_INTERVAL_MS = 2400;

export default function GenerationLoaderModal() {
  const { tList } = useLanguage();
  const loadingSteps = tList("generationLoader.steps");
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex((i) => (i + 1) % loadingSteps.length);
    }, STEP_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadingSteps.length]);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-8 bg-white/90 backdrop-blur-sm dark:bg-zinc-950/90">
      <div className="relative flex size-28 items-center justify-center">
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="4 7"
            strokeLinecap="round"
            className="text-violet-200 dark:text-violet-900"
          />
        </svg>

        <div className="absolute inset-0 animate-orbit">
          <div className="absolute top-0 left-1/2 -translate-x-1/2">
            <Plane className="size-6 rotate-40 text-violet-600 dark:text-violet-400" />
          </div>
        </div>

        <div className="flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 shadow-lg shadow-fuchsia-500/25">
          <MapPin className="size-6 text-white" />
        </div>
      </div>

      <p
        key={stepIndex}
        className="animate-fade-in text-sm font-medium text-zinc-600 dark:text-zinc-300"
      >
        {loadingSteps[stepIndex]}
      </p>
    </div>
  );
}
