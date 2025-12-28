"use client";

/**
 * SoundToggle Component
 *
 * Controlled toggle button for enabling/disabling game audio.
 * Must receive state and handler from parent (typically via useSoundSync).
 *
 * @module components/sound-toggle
 * @see TABULA_V4_DEVELOPMENT_PLAN §5 Phase 2B
 */

import { useTranslations } from "next-intl";
import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

interface SoundToggleProps {
  /** Current enabled state (required - controlled component) */
  isEnabled: boolean;

  /** Click handler (required - controlled component) */
  onClick: () => void;

  /** Additional CSS classes */
  className?: string;

  /** Size variant */
  size?: "sm" | "md" | "lg";

  /** Show label next to icon */
  showLabel?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Controlled sound toggle button component.
 *
 * @example
 * ```tsx
 * // With useSoundSync (recommended)
 * const sound = useSoundSync({ role: "host", socket });
 *
 * <SoundToggle
 *   isEnabled={sound.isEnabled}
 *   onClick={sound.hostToggle}
 * />
 * ```
 */
export function SoundToggle({
  isEnabled,
  onClick,
  className,
  size = "md",
  showLabel = false,
}: SoundToggleProps) {
  const t = useTranslations("game");

  const sizeClasses = {
    sm: "h-8 w-8 [&_svg]:h-4 [&_svg]:w-4",
    md: "h-10 w-10 [&_svg]:h-5 [&_svg]:w-5",
    lg: "h-12 w-12 [&_svg]:h-6 [&_svg]:w-6",
  };

  const label = isEnabled ? t("controls.muteSound") : t("controls.enableSound");
  const title = isEnabled ? t("controls.soundOn") : t("controls.soundOff");

  return (
    <button
      onClick={onClick}
      className={cn(
        // Base styles
        "inline-flex items-center justify-center gap-2",
        "rounded-full transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-amber-950",
        // Color states
        isEnabled
          ? "text-amber-300 hover:bg-amber-800/50 hover:text-amber-200"
          : "text-amber-500/60 hover:bg-amber-800/50 hover:text-amber-400",
        // Size
        !showLabel && sizeClasses[size],
        showLabel && "px-3 py-2",
        // Custom classes
        className
      )}
      aria-label={label}
      title={title}
      aria-pressed={isEnabled}
    >
      {isEnabled ? (
        <Volume2 className="shrink-0" />
      ) : (
        <VolumeX className="shrink-0" />
      )}
      {showLabel && (
        <span className="text-sm font-medium">
          {isEnabled ? t("controls.soundOn") : t("controls.soundOff")}
        </span>
      )}
    </button>
  );
}

export default SoundToggle;
