"use client";

import { useState } from "react";
import { PartyPopper } from "lucide-react";
import StepBullets from "./StepBullets";
import StepFooter from "./StepFooter";
import CityAutocomplete from "./CityAutocomplete";
import DateRangePicker from "./DateRangePicker";
import TravelerPicker from "./TravelerPicker";
import TripTypeSelect from "./TripTypeSelect";
import SummaryStep from "./SummaryStep";
import { INITIAL_FORM_DATA, isStepValid, STEPS, type TravelFormData } from "./types";

export default function TravelForm() {
  const [currentStep, setCurrentStep] = useState(1);
  const [maxStepReached, setMaxStepReached] = useState(1);
  const [data, setData] = useState<TravelFormData>(INITIAL_FORM_DATA);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);

  const isLastStep = currentStep === STEPS.length;
  const isNextEnabled = isStepValid(currentStep, data);

  function goToStep(step: number) {
    setCurrentStep(step);
  }

  function handlePrevious() {
    setCurrentStep((prev) => Math.max(1, prev - 1));
  }

  function handleNext() {
    if (!isNextEnabled) return;

    if (isLastStep) {
      setIsGenerating(true);
      setTimeout(() => {
        setIsGenerating(false);
        setIsGenerated(true);
      }, 1800);
      return;
    }

    const next = currentStep + 1;
    setCurrentStep(next);
    setMaxStepReached((prev) => Math.max(prev, next));
  }

  function handleRestart() {
    setData(INITIAL_FORM_DATA);
    setCurrentStep(1);
    setMaxStepReached(1);
    setIsGenerated(false);
  }

  return (
    <div className="w-full">
      {!isGenerated && (
        <div className="mb-6">
          <StepBullets currentStep={currentStep} maxStepReached={maxStepReached} onStepClick={goToStep} />
        </div>
      )}

      <div className="rounded-3xl border border-zinc-200/80 bg-white/80 p-5 shadow-xl shadow-zinc-900/5 backdrop-blur-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900/60">
        {isGenerated ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 shadow-lg shadow-fuchsia-500/25">
              <PartyPopper className="size-7 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Ton voyage est prêt !</h2>
            <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
              {data.city?.name} t&apos;attend. On a pris en compte tes préférences pour te proposer un itinéraire sur
              mesure.
            </p>
            <button
              type="button"
              onClick={handleRestart}
              className="mt-2 rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Créer un nouveau voyage
            </button>
          </div>
        ) : (
          <>
            <div>
              {currentStep === 1 && (
                <div className="space-y-6">
                  <Field label="Où veux-tu aller ?">
                    <CityAutocomplete city={data.city} onChange={(city) => setData((d) => ({ ...d, city }))} />
                  </Field>

                  <Field label="Quand ?">
                    <DateRangePicker
                      value={data.dateRange}
                      onChange={(dateRange) => setData((d) => ({ ...d, dateRange }))}
                    />
                  </Field>

                  <Field label="Qui part ?">
                    <TravelerPicker
                      travelerType={data.travelerType}
                      travelerCount={data.travelerCount}
                      onTravelerTypeChange={(travelerType) => setData((d) => ({ ...d, travelerType }))}
                      onTravelerCountChange={(travelerCount) => setData((d) => ({ ...d, travelerCount }))}
                    />
                  </Field>
                </div>
              )}

              {currentStep === 2 && (
                <Field label="Quel type de voyage cherches-tu ?">
                  <TripTypeSelect
                    selected={data.tripTypes}
                    onChange={(tripTypes) => setData((d) => ({ ...d, tripTypes }))}
                  />
                </Field>
              )}

              {currentStep === 3 && <SummaryStep data={data} />}
            </div>

            <div className="mt-8 border-t border-zinc-100 pt-5 dark:border-zinc-800">
              <StepFooter
                isFirstStep={currentStep === 1}
                isLastStep={isLastStep}
                isNextEnabled={isNextEnabled}
                isGenerating={isGenerating}
                onPrevious={handlePrevious}
                onNext={handleNext}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2.5 block text-sm font-semibold text-zinc-700 dark:text-zinc-200">{label}</label>
      {children}
    </div>
  );
}
