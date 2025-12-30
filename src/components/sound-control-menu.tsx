/**
 * Sound Control Menu
 *
 * Controller-specific component for managing sound with clear toggles:
 * - Toggle for this device (Controller)
 * - Toggle for Host screen
 *
 * ## Design Principles:
 * - Two independent toggles with reactive state
 * - Visual state reflects actual sound state
 * - Trigger button matches other control buttons (SecondaryButton style)
 *
 * ## UX Design:
 * - Tap sound button → opens menu
 * - Each toggle shows current state and allows independent control
 * - Both toggles update when "Toggle Both" is used
 *
 * @module components/sound-control-menu
 */

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { Volume2, VolumeX, Smartphone, Monitor, X } from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

export interface SoundControlMenuProps {
  /** Current local (Controller) sound enabled state */
  isLocalEnabled: boolean;

  /** Current Host sound enabled state (null if unknown yet) */
  isHostEnabled: boolean | null;

  /** Toggle sound on this device only */
  onToggleLocal: () => void;

  /** Toggle sound on Host (sends command to Host) */
  onToggleHost: () => void;

  /** Toggle sound on both devices (legacy, still supported) */
  onToggleBoth?: () => void;

  /** Set sound on both devices to a specific state (preferred) */
  onSetBoth?: (enabled: boolean) => void;

  /** Optional class name */
  className?: string;
}

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

const menuVariants = {
  hidden: {
    opacity: 0,
    scale: 0.9,
    y: 10,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 25,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 5,
    transition: {
      duration: 0.15,
    },
  },
};

// ============================================================================
// TOGGLE COMPONENT
// ============================================================================

interface ToggleRowProps {
  icon: React.ReactNode;
  label: string;
  isEnabled: boolean | null;
  onToggle: () => void;
  disabled?: boolean;
}

function ToggleRow({
  icon,
  label,
  isEnabled,
  onToggle,
  disabled = false,
}: ToggleRowProps) {
  // If state is unknown (null), assume enabled (most common default)
  const isOn = isEnabled !== false;
  const isUnknown = isEnabled === null;

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-3">
      {/* Label with icon */}
      <div className="flex items-center gap-3">
        <div
          className={`p-2 rounded-full shrink-0 ${
            isOn ? "bg-green-500/20" : "bg-gray-500/20"
          }`}
        >
          {icon}
        </div>
        <span className="font-medium text-sm text-white">{label}</span>
      </div>

      {/* Toggle Switch - always actionable, even if state unknown */}
      <button
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={isOn}
        aria-label={`Toggle ${label}`}
        className={`
          relative w-12 h-6 rounded-full
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-white/30
          ${
            disabled
              ? "bg-gray-600 cursor-not-allowed"
              : isOn
                ? "bg-green-500"
                : "bg-gray-500"
          }
        `}
      >
        <motion.div
          className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-md"
          animate={{ left: isOn ? "calc(100% - 20px)" : "4px" }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
        {/* Show sync indicator if state came from server */}
        {isUnknown && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
        )}
      </button>
    </div>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SoundControlMenu({
  isLocalEnabled,
  isHostEnabled,
  onToggleLocal,
  onToggleHost,
  onToggleBoth,
  onSetBoth,
  className = "",
}: SoundControlMenuProps) {
  const t = useTranslations("soundControl");
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // ==========================================================================
  // CLICK OUTSIDE & ESCAPE HANDLERS
  // ==========================================================================

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleTriggerClick = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleLocalToggle = useCallback(() => {
    onToggleLocal();
    // Don't close menu - let user see the state change
  }, [onToggleLocal]);

  const handleHostToggle = useCallback(() => {
    onToggleHost();
    // Don't close menu - let user see the state change
  }, [onToggleHost]);

  const handleBothToggle = useCallback(() => {
    // Determine the target state based on current states
    // If any sound is ON, we want to mute all (set to false)
    // If all sounds are OFF, we want to unmute all (set to true)
    const anySoundOn = isLocalEnabled || isHostEnabled === true;
    const targetState = !anySoundOn; // If any is on, turn all off; otherwise turn all on

    if (onSetBoth) {
      // Preferred: set to explicit state
      onSetBoth(targetState);
    } else if (onToggleBoth) {
      // Legacy fallback
      onToggleBoth();
    }

    setIsOpen(false);
  }, [isLocalEnabled, isHostEnabled, onSetBoth, onToggleBoth]);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  // Determine overall sound state for trigger icon
  const anySoundOn = isLocalEnabled || isHostEnabled === true;
  const Icon = anySoundOn ? Volume2 : VolumeX;

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Trigger Button - Matches SecondaryButton style */}
      <button
        ref={triggerRef}
        onClick={handleTriggerClick}
        aria-label={t("menuLabel")}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={`
          flex flex-col items-center justify-center gap-1
          rounded-xl px-4 py-3
          min-w-[72px] min-h-[72px]
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-amber-400
          ${
            isOpen
              ? "bg-amber-600/80 text-amber-100"
              : "bg-amber-900/60 text-amber-200 active:bg-amber-800/80"
          }
        `}
        style={{ touchAction: "manipulation" }}
      >
        <Icon
          className={`h-5 w-5 ${anySoundOn ? "text-green-400" : "text-gray-400"}`}
        />
        <span className="text-xs font-medium">{t("title")}</span>
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={menuRef}
            role="menu"
            aria-label={t("menuLabel")}
            variants={menuVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="
              absolute bottom-full left-1/2 -translate-x-1/2 mb-3
              min-w-[260px]
              bg-gray-900/95 backdrop-blur-md
              border border-white/10
              rounded-xl
              shadow-2xl shadow-black/50
              overflow-hidden
              z-50
            "
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <span className="text-sm font-medium text-white/70">
                {t("title")}
              </span>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-full hover:bg-white/10 transition-colors"
                aria-label={t("close")}
              >
                <X size={14} className="text-white/50" />
              </button>
            </div>

            {/* Toggle Rows */}
            <div className="py-2">
              {/* This Device Toggle */}
              <ToggleRow
                icon={
                  <Smartphone
                    size={16}
                    className={isLocalEnabled ? "text-green-400" : "text-gray-400"}
                  />
                }
                label={t("thisDevice")}
                isEnabled={isLocalEnabled}
                onToggle={handleLocalToggle}
              />

              {/* Host Screen Toggle */}
              <ToggleRow
                icon={
                  <Monitor
                    size={16}
                    className={
                      isHostEnabled === null
                        ? "text-yellow-400"
                        : isHostEnabled
                          ? "text-green-400"
                          : "text-gray-400"
                    }
                  />
                }
                label={t("hostScreen")}
                isEnabled={isHostEnabled}
                onToggle={handleHostToggle}
              />
            </div>

            {/* Toggle Both Button */}
            <div className="px-3 pb-3 pt-1 border-t border-white/10">
              <button
                onClick={handleBothToggle}
                className="
                  w-full py-2.5 rounded-lg
                  bg-white/5 hover:bg-white/10
                  text-sm font-medium text-white/70
                  transition-colors
                  focus:outline-none focus:ring-2 focus:ring-white/20
                "
              >
                {isLocalEnabled || isHostEnabled
                  ? t("muteAll")
                  : t("unmuteAll")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default SoundControlMenu;
