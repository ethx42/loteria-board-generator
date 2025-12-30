"use client";

/**
 * SoundSyncModal Component
 *
 * Modal shown on Controller when Host changes sound preference.
 * Gives user control to sync or keep their own preference.
 *
 * UX Heuristics Applied:
 * - User Control & Freedom: User decides whether to sync
 * - Visibility of System Status: Clear explanation of what happened
 * - Recognition over Recall: Clear action buttons with descriptive text
 * - Error Prevention: "Don't ask again" option to prevent interruption
 * - Aesthetic & Minimalist Design: Clean, focused modal
 *
 * @module components/sound-sync-modal
 * @see TABULA_V4_DEVELOPMENT_PLAN §5 Phase 2B
 */

import { useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { Volume2, VolumeX, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface SoundSyncModalProps {
  /** Whether the modal is open */
  isOpen: boolean;

  /** Whether host enabled or disabled sound */
  hostSoundEnabled: boolean;

  /** Called when user accepts the sync */
  onAccept: () => void;

  /** Called when user declines the sync */
  onDecline: () => void;

  /** Called when user wants to dismiss and not be asked again */
  onDismiss: () => void;

  /** Whether reduced motion is preferred */
  reducedMotion?: boolean;
}

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const modalVariants = {
  hidden: {
    opacity: 0,
    scale: 0.9,
    y: 20,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 30,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    y: 20,
    transition: {
      duration: 0.15,
    },
  },
};

const reducedMotionVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Modal for syncing sound preference between Host and Controller.
 *
 * Shown when Host changes their sound setting, giving Controller
 * user the option to sync or keep their own preference.
 *
 * @example
 * ```tsx
 * <SoundSyncModal
 *   isOpen={showSyncModal}
 *   hostSoundEnabled={false}
 *   onAccept={() => {
 *     setEnabled(false);
 *     setShowSyncModal(false);
 *   }}
 *   onDecline={() => setShowSyncModal(false)}
 *   onDismiss={() => {
 *     setDismissed(true);
 *     setShowSyncModal(false);
 *   }}
 * />
 * ```
 */
export function SoundSyncModal({
  isOpen,
  hostSoundEnabled,
  onAccept,
  onDecline,
  onDismiss,
  reducedMotion = false,
}: SoundSyncModalProps) {
  const t = useTranslations("game");

  const variants = reducedMotion ? reducedMotionVariants : modalVariants;

  // Prevent closing on backdrop click during animation
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onDecline();
      }
    },
    [onDecline]
  );

  // Icon and colors based on host action
  const Icon = hostSoundEnabled ? Volume2 : VolumeX;
  const iconBgColor = hostSoundEnabled
    ? "bg-green-500/20 text-green-400"
    : "bg-amber-500/20 text-amber-400";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          onClick={handleBackdropClick}
          role="dialog"
          aria-modal="true"
          aria-labelledby="sound-sync-title"
        >
          <motion.div
            variants={variants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              "relative w-full max-w-sm rounded-2xl",
              "bg-gradient-to-br from-amber-950 to-amber-900",
              "p-6 shadow-2xl ring-1 ring-white/10"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={onDecline}
              className={cn(
                "absolute right-3 top-3 rounded-full p-1.5",
                "text-amber-400/60 hover:text-amber-200 hover:bg-amber-800/50",
                "transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
              )}
              aria-label={t("soundSync.keepCurrent")}
            >
              <X className="h-4 w-4" />
            </button>

            {/* Icon */}
            <div className="flex justify-center mb-4">
              <div
                className={cn(
                  "rounded-full p-4",
                  iconBgColor
                )}
              >
                <Icon className="h-8 w-8" />
              </div>
            </div>

            {/* Title */}
            <h2
              id="sound-sync-title"
              className="text-center font-serif text-xl font-bold text-amber-100 mb-2"
            >
              {hostSoundEnabled ? t("soundSync.hostUnmutedTitle") : t("soundSync.hostMutedTitle")}
            </h2>

            {/* Description */}
            <p className="text-center text-sm text-amber-200/80 mb-6 leading-relaxed">
              {hostSoundEnabled
                ? t("soundSync.hostUnmutedDescription")
                : t("soundSync.hostMutedDescription")}
            </p>

            {/* Action buttons */}
            <div className="space-y-3">
              {/* Primary action - sync with host */}
              <button
                onClick={onAccept}
                className={cn(
                  "w-full py-3 px-4 rounded-xl font-medium",
                  "transition-all duration-200",
                  "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-amber-950",
                  hostSoundEnabled
                    ? "bg-green-600 hover:bg-green-500 text-white focus:ring-green-400"
                    : "bg-amber-600 hover:bg-amber-500 text-white focus:ring-amber-400"
                )}
              >
                {hostSoundEnabled ? t("soundSync.enableHere") : t("soundSync.muteHere")}
              </button>

              {/* Secondary action - keep current */}
              <button
                onClick={onDecline}
                className={cn(
                  "w-full py-3 px-4 rounded-xl font-medium",
                  "bg-amber-900/60 text-amber-200",
                  "hover:bg-amber-800/70 transition-colors",
                  "focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-amber-950"
                )}
              >
                {t("soundSync.keepCurrent")}
              </button>
            </div>

            {/* Dismiss option */}
            <button
              onClick={onDismiss}
              className={cn(
                "w-full mt-4 py-2 text-xs text-amber-400/50",
                "hover:text-amber-400/80 transition-colors",
                "focus:outline-none focus:underline"
              )}
            >
              {t("soundSync.dismiss")}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default SoundSyncModal;

