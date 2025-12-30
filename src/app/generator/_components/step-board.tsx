"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Grid3X3,
  Key,
  ChevronDown,
  ChevronUp,
  X,
  Users,
  Zap,
  Scale,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { useGeneratorStore, useConfig } from "@/stores/generator-store";
import { cn } from "@/lib/utils";
import { getBoardSize } from "@/lib/types";
import {
  calculateItemRecommendations,
  analyzeGameExperience,
  type ExperienceTier,
} from "@/lib/constraints/engine";
import { useTranslations } from "next-intl";

interface GridPreset {
  rows: number;
  cols: number;
}

const gridPresets: GridPreset[] = [
  { rows: 3, cols: 3 },
  { rows: 4, cols: 4 },
  { rows: 5, cols: 5 },
];

const tierConfig: Record<
  ExperienceTier,
  {
    icon: typeof Zap;
    gradient: string;
    label: string;
    labelKey: string;
  }
> = {
  chaotic: {
    icon: Zap,
    gradient: "from-red-500 to-orange-500",
    label: "Chaotic",
    labelKey: "chaotic",
  },
  competitive: {
    icon: Zap,
    gradient: "from-amber-500 to-yellow-500",
    label: "Competitive",
    labelKey: "competitive",
  },
  balanced: {
    icon: Scale,
    gradient: "from-blue-500 to-cyan-500",
    label: "Balanced",
    labelKey: "balanced",
  },
  diverse: {
    icon: Sparkles,
    gradient: "from-emerald-500 to-teal-500",
    label: "Diverse",
    labelKey: "diverse",
  },
};

export function StepBoard() {
  const config = useConfig();
  const { setBoardConfig, setSeed } = useGeneratorStore();
  const [showAdvanced, setShowAdvanced] = useState(config.seed !== undefined);
  const t = useTranslations("generator.board");

  const boardSize = getBoardSize(config.boardConfig);

  // Calculate recommendations based on players + grid
  const recommendations = useMemo(
    () => calculateItemRecommendations(config.numBoards, boardSize),
    [config.numBoards, boardSize]
  );

  // Current experience (if items exist)
  const currentExperience = useMemo(
    () =>
      analyzeGameExperience(
        config.numBoards,
        boardSize,
        config.items.length || recommendations.balanced
      ),
    [config.numBoards, boardSize, config.items.length, recommendations.balanced]
  );

  const handlePresetClick = (preset: GridPreset) => {
    setBoardConfig({ rows: preset.rows, cols: preset.cols });
  };

  const handleRowsChange = (value: string) => {
    const rows = Math.max(2, Math.min(10, parseInt(value) || 2));
    setBoardConfig({ ...config.boardConfig, rows });
  };

  const handleColsChange = (value: string) => {
    const cols = Math.max(2, Math.min(10, parseInt(value) || 2));
    setBoardConfig({ ...config.boardConfig, cols });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 mb-4">
          <Grid3X3 className="w-8 h-8 text-amber-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{t("title")}</h2>
        <p className="text-gray-500 max-w-md mx-auto">
          {t("description", { players: config.numBoards })}
        </p>
      </div>

      {/* Grid Presets */}
      <div className="flex justify-center gap-4">
        {gridPresets.map((preset) => {
          const isActive =
            config.boardConfig.rows === preset.rows &&
            config.boardConfig.cols === preset.cols;
          const slots = preset.rows * preset.cols;

          return (
            <button
              key={`${preset.rows}x${preset.cols}`}
              onClick={() => handlePresetClick(preset)}
              className={cn(
                "group relative flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all",
                isActive
                  ? "border-amber-500 bg-amber-50 shadow-xl shadow-amber-500/10"
                  : "border-gray-200 bg-white hover:border-amber-300 hover:shadow-lg"
              )}
            >
              {/* Mini grid visualization */}
              <div
                className="grid gap-1"
                style={{
                  gridTemplateColumns: `repeat(${preset.cols}, 1fr)`,
                }}
              >
                {Array.from({ length: slots }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-3 h-3 rounded-sm transition-colors",
                      isActive
                        ? "bg-amber-400"
                        : "bg-gray-200 group-hover:bg-amber-200"
                    )}
                  />
                ))}
              </div>

              <div className="text-center">
                <span
                  className={cn(
                    "text-2xl font-bold",
                    isActive ? "text-amber-600" : "text-gray-700"
                  )}
                >
                  {preset.rows}×{preset.cols}
                </span>
                <p
                  className={cn(
                    "text-sm",
                    isActive ? "text-amber-600" : "text-gray-400"
                  )}
                >
                  {slots} {t("itemsPerBoard")}
                </p>
              </div>

              {isActive && (
                <Badge className="absolute -top-2 -right-2 bg-amber-500">
                  ✓
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Custom Grid (collapsed by default) */}
      <details className="group">
        <summary className="flex items-center justify-center gap-2 text-sm text-gray-500 cursor-pointer hover:text-gray-700">
          <span>{t("customSize")}</span>
          <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
        </summary>
        <div className="flex justify-center gap-4 items-center mt-4">
          <div className="w-20">
            <Label htmlFor="rows" className="text-xs text-gray-500">
              {t("rows")}
            </Label>
            <Input
              id="rows"
              type="number"
              min={2}
              max={10}
              value={config.boardConfig.rows}
              onChange={(e) => handleRowsChange(e.target.value)}
              className="text-center"
            />
          </div>
          <span className="text-gray-400 mt-5">×</span>
          <div className="w-20">
            <Label htmlFor="cols" className="text-xs text-gray-500">
              {t("columns")}
            </Label>
            <Input
              id="cols"
              type="number"
              min={2}
              max={10}
              value={config.boardConfig.cols}
              onChange={(e) => handleColsChange(e.target.value)}
              className="text-center"
            />
          </div>
        </div>
      </details>

      {/* Recommendations Card - THE KEY INSIGHT */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-amber-400" />
          <span className="font-medium text-amber-400">
            {t("forPlayers", { count: config.numBoards })}
          </span>
        </div>

        <p className="text-slate-300 text-sm mb-6">
          {t("recommendation.intro", { slots: boardSize })}
        </p>

        {/* Three tier recommendations */}
        <div className="grid grid-cols-3 gap-3">
          {(["competitive", "balanced", "diverse"] as const).map((tier) => {
            const tierInfo = tierConfig[tier];
            const TierIcon = tierInfo.icon;
            const itemCount = recommendations[tier];
            const playersWhoMark = recommendations.playersAtTier[tier];

            return (
              <div
                key={tier}
                className={cn(
                  "relative rounded-xl p-4 text-center",
                  tier === "balanced"
                    ? "bg-gradient-to-br from-blue-600/30 to-cyan-600/30 ring-2 ring-blue-400/50"
                    : "bg-white/5"
                )}
              >
                {tier === "balanced" && (
                  <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-blue-500 text-[10px]">
                    {t("recommended")}
                  </Badge>
                )}

                <TierIcon
                  className={cn(
                    "w-6 h-6 mx-auto mb-2",
                    tier === "competitive" && "text-amber-400",
                    tier === "balanced" && "text-blue-400",
                    tier === "diverse" && "text-emerald-400"
                  )}
                />

                <p className="text-3xl font-bold mb-1">{itemCount}</p>
                <p className="text-xs text-slate-400 mb-2">{t("items")}</p>

                <div className="text-xs text-slate-300">
                  <span className="font-medium">~{playersWhoMark}</span>{" "}
                  {t("playersMarkEach")}
                </div>
              </div>
            );
          })}
        </div>

        {/* Visual explanation */}
        <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-center gap-2 text-sm text-slate-400">
          <span>{t("moreItems")}</span>
          <ArrowRight className="w-4 h-4" />
          <span className="text-emerald-400">{t("moreVariety")}</span>
        </div>
      </div>

      {/* Advanced Options */}
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm transition-colors mx-auto"
        >
          {showAdvanced ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
          {t("advanced")}
        </button>

        {showAdvanced && (
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3 max-w-md mx-auto">
            <Label className="text-gray-700 font-medium flex items-center gap-2">
              <Key className="w-4 h-4" />
              {t("seed.title")}
              <span className="text-xs font-normal text-gray-400">
                ({t("seed.optional")})
              </span>
            </Label>
            <p className="text-xs text-gray-500">{t("seed.description")}</p>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="e.g. 847291"
                value={config.seed ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "") {
                    setSeed(undefined);
                  } else {
                    const num = parseInt(value);
                    if (!isNaN(num) && num > 0) {
                      setSeed(num);
                    }
                  }
                }}
                className="font-mono"
              />
              {config.seed !== undefined && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSeed(undefined)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
