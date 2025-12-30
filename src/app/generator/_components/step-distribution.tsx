"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { Check, X, ChevronDown } from "lucide-react";
import { useConfig, useValidations } from "@/stores/generator-store";
import {
  autoDistribute,
  computeConstraints,
  analyzeGameExperience,
} from "@/lib/constraints/engine";
import { getBoardSize } from "@/lib/types";
import { cn } from "@/lib/utils";

// ============================================================================
// TIER STYLING - Minimal color accents
// ============================================================================

const TIER_STYLES = {
  chaotic: { accent: "text-red-500", bg: "bg-red-500" },
  competitive: { accent: "text-amber-500", bg: "bg-amber-500" },
  balanced: { accent: "text-emerald-500", bg: "bg-emerald-500" },
  diverse: { accent: "text-blue-500", bg: "bg-blue-500" },
} as const;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function StepDistribution() {
  const t = useTranslations("generator.review");
  const config = useConfig();
  const validations = useValidations();
  const [showDetails, setShowDetails] = useState(false);

  const boardSize = getBoardSize(config.boardConfig);
  const constraints = useMemo(() => computeConstraints(config), [config]);
  const distribution = useMemo(
    () => autoDistribute(config.items.length, config.numBoards, boardSize),
    [config.items.length, config.numBoards, boardSize]
  );

  const experience = useMemo(
    () =>
      analyzeGameExperience(config.numBoards, boardSize, config.items.length),
    [config.numBoards, boardSize, config.items.length]
  );

  // Group frequencies
  const frequencyGroups = useMemo(() => {
    const freqMap = new Map<number, number>();
    distribution.frequencies.forEach((freq) => {
      freqMap.set(freq, (freqMap.get(freq) || 0) + 1);
    });
    return Array.from(freqMap.entries())
      .map(([frequency, count]) => ({
        frequency,
        count,
        pct: (count / config.items.length) * 100,
      }))
      .sort((a, b) => b.frequency - a.frequency);
  }, [distribution.frequencies, config.items.length]);

  const errors = validations.filter(
    (v) => !v.isValid && v.severity === "error"
  );
  const isValid = errors.length === 0;
  const tierStyle = TIER_STYLES[experience.tier];

  return (
    <div className="max-w-md mx-auto py-4">
      {/* ═══════════════════════════════════════════════════════════════════
          LEVEL 1: HERO - Status + Experience (the story)
          ═══════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        {/* Status indicator - small, not overwhelming */}
        <div
          className={cn(
            "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium mb-6",
            isValid
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          )}
        >
          <div
            className={cn(
              "w-4 h-4 rounded-full flex items-center justify-center",
              isValid ? "bg-emerald-500" : "bg-red-500"
            )}
          >
            {isValid ? (
              <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
            ) : (
              <X className="w-2.5 h-2.5 text-white" strokeWidth={3} />
            )}
          </div>
          {isValid ? t("ready") : t("notReady")}
        </div>

        {/* THE HERO: Compact - 2 lines max */}
        <div className="mb-5">
          <div className="flex items-baseline justify-center gap-1.5">
            <span
              className={cn(
                "text-5xl font-bold tracking-tight",
                tierStyle.accent
              )}
            >
              {Math.round(experience.playersWhoMark)}
            </span>
            <span className="text-lg text-gray-400">
              de {config.numBoards} marcan
            </span>
          </div>
        </div>

        {/* Tier - single pill with inline description */}
        <span
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm",
            experience.tier === "chaotic" && "bg-red-50 text-red-600",
            experience.tier === "competitive" && "bg-amber-50 text-amber-600",
            experience.tier === "balanced" && "bg-emerald-50 text-emerald-600",
            experience.tier === "diverse" && "bg-blue-50 text-blue-600"
          )}
        >
          <span className="font-semibold">
            {t(`experience.tier.${experience.tier}`)}
          </span>
          <span className="opacity-50">·</span>
          <span>{t(`experience.tierDescription.${experience.tier}`)}</span>
        </span>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════
          LEVEL 2: CONTEXT - Configuration summary (supporting data)
          ═══════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex justify-center gap-8 text-center text-sm text-gray-500 mb-8"
      >
        <div>
          <span className="font-medium text-gray-900">{config.numBoards}</span>
          <span className="ml-1">
            {t("summary.players", { count: config.numBoards })}
          </span>
        </div>
        <div className="text-gray-300">•</div>
        <div>
          <span className="font-medium text-gray-900">
            {config.boardConfig.rows}×{config.boardConfig.cols}
          </span>
          <span className="ml-1">{t("summary.grid")}</span>
        </div>
        <div className="text-gray-300">•</div>
        <div>
          <span className="font-medium text-gray-900">
            {config.items.length}
          </span>
          <span className="ml-1">
            {t("summary.totalItems", { count: config.items.length })}
          </span>
        </div>
      </motion.div>

      {/* Errors - only if present */}
      {errors.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-8 space-y-2"
        >
          {errors.map((error, i) => (
            <div
              key={i}
              className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3"
            >
              {error.message}
            </div>
          ))}
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          LEVEL 3: DETAILS - Technical info (progressive disclosure)
          ═══════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="border-t border-gray-100 pt-4"
      >
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors py-2"
        >
          <span>{showDetails ? t("details.hide") : t("details.show")}</span>
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 transition-transform",
              showDetails && "rotate-180"
            )}
          />
        </button>

        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-4 space-y-6 text-sm">
                {/* Distribution bars */}
                {distribution.isValid && frequencyGroups.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">
                      {t("distribution.title")}
                    </div>
                    <div className="space-y-2">
                      {frequencyGroups.map((g, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="w-6 text-right text-xs text-gray-400 font-mono">
                            ×{g.frequency}
                          </span>
                          <div className="flex-1 h-1 bg-gray-100 rounded-full">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${g.pct}%` }}
                              transition={{ delay: 0.2 + i * 0.1 }}
                              className="h-full bg-gray-300 rounded-full"
                            />
                          </div>
                          <span className="w-20 text-right text-xs text-gray-400">
                            {t("distribution.items", { count: g.count })}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between text-xs text-gray-300 mt-3">
                      <span>
                        {t("details.total")}: {constraints.sumFrequencies}
                      </span>
                      <span>
                        {t("details.slots")}: {constraints.T}
                      </span>
                    </div>
                  </div>
                )}

                {/* Validations - compact */}
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">
                    {t("validation.title")}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {validations.map((v, i) => {
                      const key = v.constraint.toLowerCase();
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-2 text-xs"
                        >
                          <div
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              v.isValid
                                ? "bg-emerald-400"
                                : v.severity === "error"
                                ? "bg-red-400"
                                : "bg-amber-400"
                            )}
                          />
                          <span className="text-gray-500 truncate">
                            {t(`validation.${key}`)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
