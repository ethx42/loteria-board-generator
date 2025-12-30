"use client";

import { motion } from "framer-motion";
import { Users, Grid3X3, List, BarChart3, Eye, Download, Check } from "lucide-react";
import { useCurrentStep, useGeneratorStore } from "@/stores/generator-store";
import { cn } from "@/lib/utils";
import type { WizardStep } from "@/lib/types";

interface StepInfo {
  id: WizardStep;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * Players-First Flow
 * 
 * 1. Players: How many will play? (context for all calculations)
 * 2. Grid: What board size? (shows item recommendations)
 * 3. Items: Add items (with progress toward goal)
 * 4. Distribution: Fine-tune
 * 5. Preview: Generate
 * 6. Export: Download
 */
const steps: StepInfo[] = [
  { id: "players", title: "Players", icon: Users },
  { id: "board", title: "Grid", icon: Grid3X3 },
  { id: "items", title: "Items", icon: List },
  { id: "distribution", title: "Review", icon: BarChart3 },
  { id: "preview", title: "Preview", icon: Eye },
  { id: "export", title: "Export", icon: Download },
];

const stepOrder: WizardStep[] = ["players", "board", "items", "distribution", "preview", "export"];

export function StepIndicator() {
  const currentStep = useCurrentStep();
  const setStep = useGeneratorStore((s) => s.setStep);
  const currentIndex = stepOrder.indexOf(currentStep);

  return (
    <div className="bg-gradient-to-r from-amber-100/80 to-orange-100/80 px-6 py-4 border-b border-amber-200/50">
      <div className="flex items-center justify-between max-w-2xl mx-auto">
        {steps.map((step, index) => {
          const isActive = step.id === currentStep;
          const isCompleted = index < currentIndex;
          const isPast = index < currentIndex;
          const Icon = step.icon;

          return (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => isPast && setStep(step.id)}
                disabled={!isPast}
                className={cn(
                  "flex flex-col items-center gap-1.5 transition-all",
                  isPast && "cursor-pointer hover:opacity-80",
                  !isPast && !isActive && "cursor-default"
                )}
              >
                <div
                  className={cn(
                    "relative w-10 h-10 rounded-full flex items-center justify-center transition-all",
                    isActive && "bg-amber-600 text-white shadow-lg shadow-amber-600/30",
                    isCompleted && "bg-amber-500 text-white",
                    !isActive && !isCompleted && "bg-amber-200/50 text-amber-400"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                  {isActive && (
                    <motion.div
                      layoutId="activeStep"
                      className="absolute inset-0 rounded-full ring-4 ring-amber-600/20"
                    />
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium hidden sm:block",
                    isActive && "text-amber-900",
                    isCompleted && "text-amber-700",
                    !isActive && !isCompleted && "text-amber-400"
                  )}
                >
                  {step.title}
                </span>
              </button>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "w-8 md:w-16 h-0.5 mx-2",
                    index < currentIndex ? "bg-amber-500" : "bg-amber-200/50"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

