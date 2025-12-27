"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useGeneratorStore, useCurrentStep, useIsGenerating } from "@/stores/generator-store";
import { StepIndicator } from "./step-indicator";
import { StepItems } from "./step-items";
import { StepBoard } from "./step-board";
import { StepDistribution } from "./step-distribution";
import { StepPreview } from "./step-preview";
import { StepExport } from "./step-export";
import { WizardNavigation } from "./wizard-navigation";
import type { WizardStep } from "@/lib/types";

const stepComponents: Record<WizardStep, React.ComponentType> = {
  items: StepItems,
  board: StepBoard,
  distribution: StepDistribution,
  preview: StepPreview,
  export: StepExport,
};

export function Wizard() {
  const currentStep = useCurrentStep();
  const isGenerating = useIsGenerating();
  const StepComponent = stepComponents[currentStep];

  return (
    <div className="bg-white rounded-2xl shadow-xl shadow-amber-900/5 border border-amber-100 overflow-hidden">
      {/* Step Indicator */}
      <StepIndicator />

      {/* Step Content */}
      <div className="p-6 md:p-8 min-h-[400px] relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {isGenerating ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="inline-block w-12 h-12 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin mb-4" />
                  <p className="text-amber-700">Generating boards...</p>
                </div>
              </div>
            ) : (
              <StepComponent />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <WizardNavigation />
    </div>
  );
}

