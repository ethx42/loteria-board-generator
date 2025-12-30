"use client";

import { useState, useMemo, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { Users, Sparkles, Users2, Crown, SlidersHorizontal } from "lucide-react";
import { useGeneratorStore, useConfig } from "@/stores/generator-store";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface PlayerPreset {
  value: number;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
}

const presets: PlayerPreset[] = [
  { value: 8, labelKey: "small", icon: Users },
  { value: 15, labelKey: "medium", icon: Users2 },
  { value: 30, labelKey: "large", icon: Crown },
];

const presetValues = new Set(presets.map(p => p.value));

export function StepPlayers() {
  const config = useConfig();
  const { setNumBoards } = useGeneratorStore();
  const t = useTranslations("generator.players");

  // Slider is shown when:
  // 1. User explicitly clicked "Custom", OR
  // 2. Current value is not a preset value
  const isCustomValue = !presetValues.has(config.numBoards);
  const [showSlider, setShowSlider] = useState(isCustomValue);
  
  // Keep slider visible if user navigates back with a custom value
  useEffect(() => {
    if (isCustomValue) {
      setShowSlider(true);
    }
  }, [isCustomValue]);

  const handleSliderChange = (value: number[]) => {
    setNumBoards(value[0]);
  };

  const handlePresetClick = (value: number) => {
    setNumBoards(value);
    setShowSlider(false); // Hide slider when a preset is selected
  };

  const handleCustomClick = () => {
    setShowSlider(true);
  };

  // Visual feedback for player count
  const playerCategory = useMemo(() => {
    if (config.numBoards <= 10) return "intimate";
    if (config.numBoards <= 20) return "social";
    if (config.numBoards <= 40) return "event";
    return "large";
  }, [config.numBoards]);

  const categoryColors = {
    intimate: "from-blue-500 to-indigo-600",
    social: "from-amber-500 to-orange-600",
    event: "from-rose-500 to-pink-600",
    large: "from-purple-500 to-violet-600",
  };

  return (
    <div className="space-y-10">
      {/* Header - Clear hierarchy: Icon → Title → Subtitle */}
      <header className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-200/80 to-orange-200/80 shadow-sm">
          <Users className="w-7 h-7 text-amber-700" />
        </div>
        
        {/* Title: Largest, boldest, highest contrast */}
        <h2 className="text-2xl font-semibold text-amber-900 tracking-tight">
          {t("title")}
        </h2>
        
        {/* Subtitle: Smaller, lighter, supporting text */}
        <p className="text-sm text-amber-700/70 max-w-sm mx-auto leading-relaxed">
          {t("description")}
        </p>
      </header>

      {/* Big Number Display - The hero element */}
      <div className="flex justify-center py-4">
        <div 
          className={cn(
            "w-36 h-36 rounded-full flex items-center justify-center",
            "bg-gradient-to-br shadow-lg",
            categoryColors[playerCategory]
          )}
        >
          <div className="text-center">
            {/* Number: Dominant, white, large */}
            <span className="text-5xl font-bold text-white tabular-nums leading-none">
              {config.numBoards}
            </span>
            {/* Unit label: Subdued, small */}
            <p className="text-white/70 text-xs font-medium uppercase tracking-wider mt-1">
              {t("playersLabel")}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Presets - Primary action area */}
      <div className="flex justify-center gap-3 flex-wrap">
        {presets.map((preset) => {
          const isActive = config.numBoards === preset.value;
          const Icon = preset.icon;
          
          return (
            <button
              key={preset.value}
              onClick={() => handlePresetClick(preset.value)}
              className={cn(
                "flex flex-col items-center gap-1.5 px-5 py-3 rounded-xl border transition-all min-w-[90px]",
                isActive
                  ? "border-amber-400 bg-white shadow-md ring-2 ring-amber-200"
                  : "border-amber-200/60 bg-white/70 hover:bg-white hover:border-amber-300 hover:shadow-sm"
              )}
            >
              <Icon className={cn(
                "w-5 h-5",
                isActive ? "text-amber-600" : "text-amber-400"
              )} />
              {/* Number: Bold, prominent */}
              <span className={cn(
                "text-xl font-bold tabular-nums leading-none",
                isActive ? "text-amber-700" : "text-amber-800"
              )}>
                {preset.value}
              </span>
              {/* Label: Small, muted, uppercase for category feel */}
              <span className={cn(
                "text-[10px] font-medium uppercase tracking-wide",
                isActive ? "text-amber-600" : "text-amber-500/70"
              )}>
                {t(preset.labelKey)}
              </span>
            </button>
          );
        })}
        
        {/* Custom button */}
        <button
          onClick={handleCustomClick}
          className={cn(
            "flex flex-col items-center gap-1.5 px-5 py-3 rounded-xl border transition-all min-w-[90px]",
            showSlider && isCustomValue
              ? "border-amber-400 bg-white shadow-md ring-2 ring-amber-200"
              : "border-dashed border-amber-300/60 bg-white/50 hover:bg-white/70 hover:border-amber-400"
          )}
        >
          <SlidersHorizontal className={cn(
            "w-5 h-5",
            showSlider && isCustomValue ? "text-amber-600" : "text-amber-400"
          )} />
          <span className={cn(
            "text-xl font-bold tabular-nums leading-none",
            showSlider && isCustomValue ? "text-amber-700" : "text-amber-600/70"
          )}>
            {isCustomValue ? config.numBoards : "—"}
          </span>
          <span className={cn(
            "text-[10px] font-medium uppercase tracking-wide",
            showSlider && isCustomValue ? "text-amber-600" : "text-amber-500/70"
          )}>
            {t("custom")}
          </span>
        </button>
      </div>

      {/* Slider - revealed on demand */}
      {showSlider && (
        <div className="max-w-sm mx-auto space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <Slider
            value={[config.numBoards]}
            onValueChange={handleSliderChange}
            min={2}
            max={100}
            step={1}
            className="py-2"
          />
          
          {/* Range labels */}
          <div className="flex justify-between text-xs text-amber-600/60">
            <span>2 {t("playersLabel")}</span>
            <span>100 {t("playersLabel")}</span>
          </div>
        </div>
      )}

      {/* Hint card - Contextual, less prominent */}
      <aside className="max-w-sm mx-auto">
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-white/60 border border-amber-200/50 shadow-sm">
          <Sparkles className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-800/80 leading-relaxed">
            <span className="font-medium text-amber-900">
              {t("hint.title", { count: config.numBoards })}
            </span>
            {" "}
            {t("hint.description")}
          </p>
        </div>
      </aside>
    </div>
  );
}
