"use client";

import { useState, useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Wand2, 
  AlertCircle, 
  CheckCircle2, 
  Info, 
  Target,
  Zap,
  Scale,
  Sparkles,
  List
} from "lucide-react";
import { useGeneratorStore, useConfig } from "@/stores/generator-store";
import { parseItemsFromText } from "@/lib/parser/items-parser";
import { DEFAULT_ITEMS, getBoardSize } from "@/lib/types";
import { 
  calculateItemRecommendations, 
  analyzeGameExperience,
  type ExperienceTier 
} from "@/lib/constraints/engine";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const tierConfig: Record<ExperienceTier, {
  icon: typeof Zap;
  bgColor: string;
  borderColor: string;
  textColor: string;
  progressColor: string;
}> = {
  chaotic: {
    icon: Zap,
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    textColor: "text-red-700",
    progressColor: "bg-red-500",
  },
  competitive: {
    icon: Zap,
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    textColor: "text-amber-700",
    progressColor: "bg-amber-500",
  },
  balanced: {
    icon: Scale,
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    textColor: "text-blue-700",
    progressColor: "bg-blue-500",
  },
  diverse: {
    icon: Sparkles,
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    textColor: "text-emerald-700",
    progressColor: "bg-emerald-500",
  },
};

export function StepItems() {
  const config = useConfig();
  const { setItemsFromStrings, loadDefaults } = useGeneratorStore();
  const t = useTranslations("generator.items");

  // Convert current items to text for the textarea
  const initialText = useMemo(
    () => config.items.map((item) => item.name).join("\n"),
    [config.items]
  );

  const [text, setText] = useState(initialText);

  // Parse and validate in real-time
  const parseResult = useMemo(() => parseItemsFromText(text), [text]);

  // Calculate recommendations based on players + grid
  const boardSize = getBoardSize(config.boardConfig);
  const recommendations = useMemo(
    () => calculateItemRecommendations(config.numBoards, boardSize),
    [config.numBoards, boardSize]
  );

  // Current experience
  const experience = useMemo(
    () => analyzeGameExperience(config.numBoards, boardSize, parseResult.uniqueCount),
    [config.numBoards, boardSize, parseResult.uniqueCount]
  );

  // Progress calculations
  const targetItems = recommendations.balanced;
  const currentItems = parseResult.uniqueCount;
  const progressPercent = Math.min(100, (currentItems / targetItems) * 100);
  const hasMinimum = currentItems >= boardSize;
  const reachedTarget = currentItems >= targetItems;

  const currentTierConfig = tierConfig[experience.tier];
  const TierIcon = currentTierConfig.icon;

  const handleTextChange = (value: string) => {
    setText(value);

    // Auto-apply valid changes
    const result = parseItemsFromText(value);
    if (result.success && result.items.length > 0) {
      setItemsFromStrings(result.items);
    }
  };

  const handleLoadDefaults = () => {
    const defaultText = DEFAULT_ITEMS.map((item) => item.name).join("\n");
    setText(defaultText);
    loadDefaults();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 mb-4">
          <List className="w-8 h-8 text-amber-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {t("title")}
        </h2>
        <p className="text-gray-500 max-w-md mx-auto">
          {t("description", { target: targetItems, players: config.numBoards })}
        </p>
      </div>

      {/* Progress Card */}
      <div className={cn(
        "rounded-2xl p-5 border-2 transition-all",
        currentTierConfig.bgColor,
        currentTierConfig.borderColor
      )}>
        {/* Header with tier info */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              experience.tier === "chaotic" && "bg-red-100",
              experience.tier === "competitive" && "bg-amber-100",
              experience.tier === "balanced" && "bg-blue-100",
              experience.tier === "diverse" && "bg-emerald-100"
            )}>
              <TierIcon className={cn("w-5 h-5", currentTierConfig.textColor)} />
            </div>
            <div>
              <p className={cn("font-semibold", currentTierConfig.textColor)}>
                {t(`tier.${experience.tier}`)}
              </p>
              <p className="text-xs text-gray-500">
                ~{experience.playersWhoMark} {t("playersMarkEachItem")}
              </p>
            </div>
          </div>
          
          <div className="text-right">
            <p className="text-3xl font-bold text-gray-900 tabular-nums">
              {currentItems}
              <span className="text-lg text-gray-400">/{targetItems}</span>
            </p>
            <p className="text-xs text-gray-500">{t("items")}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden mb-3">
          <div
            className={cn(
              "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
              currentTierConfig.progressColor
            )}
            style={{ width: `${progressPercent}%` }}
          />
          
          {/* Milestone markers */}
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-gray-400"
            style={{ left: `${(boardSize / targetItems) * 100}%` }}
          />
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-amber-500"
            style={{ left: `${(recommendations.competitive / targetItems) * 100}%` }}
          />
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-emerald-500"
            style={{ left: `${(recommendations.diverse / targetItems) * 100}%` }}
          />
        </div>

        {/* Milestone labels */}
        <div className="flex justify-between text-[10px] text-gray-500">
          <span>Min: {boardSize}</span>
          <span className={currentItems >= recommendations.competitive ? "text-amber-600 font-medium" : ""}>
            {t("competitive")}: {recommendations.competitive}
          </span>
          <span className={currentItems >= recommendations.balanced ? "text-blue-600 font-medium" : ""}>
            {t("balanced")}: {recommendations.balanced}
          </span>
          <span className={currentItems >= recommendations.diverse ? "text-emerald-600 font-medium" : ""}>
            {t("diverse")}: {recommendations.diverse}
          </span>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex justify-center">
        <Button
          variant="outline"
          size="sm"
          onClick={handleLoadDefaults}
          className="border-amber-200 text-amber-700 hover:bg-amber-50"
        >
          <Wand2 className="w-4 h-4 mr-2" />
          {t("loadDefaults")}
        </Button>
      </div>

      {/* Text input */}
      <div className="relative">
        <Textarea
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder={t("placeholder")}
          className="min-h-[200px] font-mono text-sm resize-y"
        />
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-3 items-center justify-center">
        {parseResult.success ? (
          <Badge
            variant="secondary"
            className="bg-emerald-100 text-emerald-700 border-emerald-200"
          >
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {parseResult.uniqueCount} {t("itemsValid")}
          </Badge>
        ) : (
          <Badge variant="destructive">
            <AlertCircle className="w-3 h-3 mr-1" />
            {t("invalidInput")}
          </Badge>
        )}

        {parseResult.rawCount !== parseResult.uniqueCount && parseResult.rawCount > 0 && (
          <Badge variant="outline" className="text-amber-600 border-amber-200">
            {parseResult.rawCount - parseResult.uniqueCount} {t("duplicatesRemoved")}
          </Badge>
        )}
        
        {!hasMinimum && parseResult.uniqueCount > 0 && (
          <Badge variant="outline" className="text-red-600 border-red-200">
            {t("needMore", { count: boardSize - parseResult.uniqueCount })}
          </Badge>
        )}
      </div>

      {/* Warnings */}
      {parseResult.warnings.length > 0 && (
        <Alert className="border-amber-200 bg-amber-50">
          <Info className="w-4 h-4 text-amber-600" />
          <AlertDescription className="text-amber-700 text-sm">
            {parseResult.warnings.map((w, i) => (
              <div key={i}>{w.message}</div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {/* Errors */}
      {parseResult.errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            {parseResult.errors.map((e, i) => (
              <div key={i}>{e.message}</div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {/* Item preview */}
      {parseResult.items.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2 text-center">
            {t("preview", { count: parseResult.items.length })}
          </h3>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-3 bg-gray-50 rounded-xl border border-gray-100 justify-center">
            {parseResult.items.slice(0, 50).map((item, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="bg-white text-gray-700 border border-gray-200 text-xs"
              >
                {item.length > 25 ? item.slice(0, 25) + "..." : item}
              </Badge>
            ))}
            {parseResult.items.length > 50 && (
              <Badge variant="outline" className="text-gray-400">
                +{parseResult.items.length - 50} {t("more")}
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
