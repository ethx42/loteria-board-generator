"use client";

import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGeneratorStore, useCurrentStep } from "@/stores/generator-store";

export function WizardNavigation() {
  const currentStep = useCurrentStep();
  const { nextStep, prevStep, canGoNext, canGoPrev } = useGeneratorStore();

  const isLastStep = currentStep === "export";
  const isPreviewStep = currentStep === "distribution";

  return (
    <div className="flex items-center justify-between px-6 py-4 bg-amber-50/50 border-t border-amber-100">
      <Button
        variant="ghost"
        onClick={prevStep}
        disabled={!canGoPrev()}
        className="text-amber-700 hover:text-amber-900 hover:bg-amber-100"
      >
        <ChevronLeft className="w-4 h-4 mr-1" />
        Back
      </Button>

      {!isLastStep && (
        <Button
          onClick={nextStep}
          disabled={!canGoNext()}
          className="bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-600/20"
        >
          {isPreviewStep ? (
            <>
              <Sparkles className="w-4 h-4 mr-1" />
              Generate Boards
            </>
          ) : (
            <>
              Continue
              <ChevronRight className="w-4 h-4 ml-1" />
            </>
          )}
        </Button>
      )}
    </div>
  );
}

