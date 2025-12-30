"use client";

/**
 * ControlsBar Component
 *
 * Game control buttons with auto-hide behavior in paired mode.
 * Features:
 * - Draw Card, Pause/Resume, History, Fullscreen buttons
 * - Auto-hides in paired mode
 * - Appears on bottom hover with timeout
 * - ESC toggles visibility
 *
 * @see SRD §2.4 Host UI State Machine
 * @see FR-020 through FR-024
 */

import { useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  SkipForward,
  Maximize2,
  Minimize2,
  History,
  Power,
  Wifi,
  WifiOff,
} from "lucide-react";
import type { GameStatus } from "@/lib/types/game";
import { SoundToggle } from "@/components/sound-toggle";

// ============================================================================
// TYPES
// ============================================================================

interface ControlsBarProps {
  /** Current game status */
  gameStatus: GameStatus;

  /** Whether controls are currently visible */
  isVisible: boolean;

  /** Whether in fullscreen mode */
  isFullscreen: boolean;

  /** Whether controller is connected */
  isControllerConnected: boolean;

  /** Current card number */
  currentCard: number;

  /** Total cards in deck */
  totalCards: number;

  /** Callback to draw next card */
  onDrawCard: () => void;

  /** Whether draw is currently debounced (1 second cooldown) */
  isDrawDebounced?: boolean;

  /** Callback to pause game */
  onPause: () => void;

  /** Callback to resume game */
  onResume: () => void;

  /** Callback to toggle fullscreen */
  onToggleFullscreen: () => void;

  /** Callback to open history modal */
  onOpenHistory: () => void;

  /** Callback when hovering bottom area */
  onHoverBottom: () => void;

  /** Callback to disconnect/end session */
  onDisconnect?: () => void;

  /** v4.0: Sound enabled state (from useSoundSync) */
  isSoundEnabled?: boolean;

  /** v4.0: Callback when sound toggle clicked (from useSoundSync.hostToggle) */
  onSoundToggle?: () => void;

  /** Whether reduced motion is preferred */
  reducedMotion?: boolean;

  /** Custom className */
  className?: string;
}

// ============================================================================
// ANIMATION VARIANTS (SRD §5.4)
// ============================================================================

const barVariants = {
  hidden: {
    y: "100%",
    opacity: 0,
  },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: "easeOut",
    },
  },
};

const reducedMotionBarVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

// ============================================================================
// BUTTON COMPONENT
// ============================================================================

interface ControlButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  size?: "normal" | "large";
}

function ControlButton({
  icon,
  label,
  onClick,
  disabled = false,
  variant = "secondary",
  size = "normal",
}: ControlButtonProps) {
  const variantStyles = {
    primary:
      "bg-amber-500 hover:bg-amber-400 text-amber-950 disabled:bg-amber-700/50",
    secondary:
      "bg-amber-900/80 hover:bg-amber-800/90 text-amber-100 disabled:bg-amber-900/40",
    danger:
      "bg-red-900/80 hover:bg-red-800/90 text-red-100 disabled:bg-red-900/40",
  };

  const sizeStyles = {
    normal: "h-12 w-12 md:h-14 md:w-14",
    large: "h-14 w-14 md:h-16 md:w-16",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center justify-center rounded-full
        backdrop-blur-sm transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-amber-950
        disabled:cursor-not-allowed disabled:opacity-50
        ${variantStyles[variant]}
        ${sizeStyles[size]}
      `}
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ControlsBar({
  gameStatus,
  isVisible,
  isFullscreen,
  isControllerConnected,
  currentCard,
  totalCards,
  onDrawCard,
  isDrawDebounced = false,
  onPause,
  onResume,
  onToggleFullscreen,
  onOpenHistory,
  onHoverBottom,
  onDisconnect,
  isSoundEnabled,
  onSoundToggle,
  reducedMotion = false,
  className = "",
}: ControlsBarProps) {
  const variants = reducedMotion ? reducedMotionBarVariants : barVariants;

  const canDraw =
    gameStatus === "ready" ||
    gameStatus === "playing" ||
    (gameStatus === "paused" && currentCard < totalCards);

  const isFinished = gameStatus === "finished";
  const isPaused = gameStatus === "paused";
  const isPlaying = gameStatus === "playing";

  // Draw button is disabled if can't draw, game finished, or debounce active
  const isDrawDisabled = !canDraw || isFinished || isDrawDebounced;

  const handleDrawCard = useCallback(() => {
    if (canDraw && !isDrawDebounced) {
      onDrawCard();
    }
  }, [canDraw, isDrawDebounced, onDrawCard]);

  return (
    <>
      {/* Hover detection zone at bottom of screen */}
      <div
        className="fixed inset-x-0 bottom-0 h-16 z-40"
        onMouseEnter={onHoverBottom}
        aria-hidden="true"
      />

      <AnimatePresence>
        {isVisible && (
          <motion.div
            variants={variants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className={`
              fixed inset-x-0 bottom-0 z-50
              bg-gradient-to-t from-amber-950/95 via-amber-950/80 to-transparent
              pb-6 pt-12
              ${className}
            `}
          >
            <div className="mx-auto flex max-w-4xl items-center justify-center gap-4 px-4">
              {/* Connection Status Indicator */}
              <div
                className={`
                  flex h-10 items-center gap-2 rounded-full px-4
                  ${isControllerConnected ? "bg-green-900/50" : "bg-amber-900/50"}
                `}
              >
                {isControllerConnected ? (
                  <>
                    <Wifi className="h-4 w-4 text-green-400" />
                    <span className="text-sm text-green-300">Connected</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-4 w-4 text-amber-400" />
                    <span className="text-sm text-amber-300">Standalone</span>
                  </>
                )}
              </div>

              <div className="h-8 w-px bg-amber-700/50" aria-hidden="true" />

              {/* History Button */}
              <ControlButton
                icon={<History className="h-5 w-5" />}
                label="View History"
                onClick={onOpenHistory}
                disabled={currentCard === 0}
              />

              {/* Pause/Resume Button */}
              {isPlaying ? (
                <ControlButton
                  icon={<Pause className="h-5 w-5" />}
                  label="Pause Game"
                  onClick={onPause}
                />
              ) : isPaused ? (
                <ControlButton
                  icon={<Play className="h-5 w-5" />}
                  label="Resume Game"
                  onClick={onResume}
                />
              ) : null}

              {/* Draw Card Button (Primary) */}
              <div className="relative">
                <ControlButton
                  icon={<SkipForward className="h-6 w-6" />}
                  label={
                    isDrawDebounced
                      ? "Please wait..."
                      : currentCard === 0
                        ? "Draw First Card"
                        : "Draw Next Card"
                  }
                  onClick={handleDrawCard}
                  disabled={isDrawDisabled}
                  variant="primary"
                  size="large"
                />
                {/* Cooldown indicator ring */}
                {isDrawDebounced && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="h-16 w-16 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400 md:h-[72px] md:w-[72px]" />
                  </div>
                )}
              </div>

              {/* Fullscreen Toggle */}
              <ControlButton
                icon={
                  isFullscreen ? (
                    <Minimize2 className="h-5 w-5" />
                  ) : (
                    <Maximize2 className="h-5 w-5" />
                  )
                }
                label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                onClick={onToggleFullscreen}
              />

              {/* Sound Toggle (v4.0) */}
              {isSoundEnabled !== undefined && onSoundToggle && (
                <SoundToggle
                  size="md"
                  className="h-12 w-12 md:h-14 md:w-14 bg-amber-900/80 hover:bg-amber-800/90"
                  isEnabled={isSoundEnabled}
                  onClick={onSoundToggle}
                />
              )}

              {/* Disconnect Button */}
              {onDisconnect && (
                <>
                  <div className="h-8 w-px bg-amber-700/50" aria-hidden="true" />
                  <ControlButton
                    icon={<Power className="h-5 w-5" />}
                    label="End Session"
                    onClick={onDisconnect}
                    variant="danger"
                  />
                </>
              )}
            </div>

            {/* Game Status / Progress Bar */}
            <div className="mx-auto mt-4 max-w-md px-4">
              <div className="flex items-center justify-between text-sm text-amber-300/70">
                <span>
                  {isFinished
                    ? "Game Complete"
                    : isPaused
                      ? "Paused"
                      : `Card ${currentCard}/${totalCards}`}
                </span>
                <span className="font-mono">
                  {Math.round((currentCard / totalCards) * 100)}%
                </span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-amber-900/50">
                <motion.div
                  className="h-full bg-amber-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${(currentCard / totalCards) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>

            {/* Keyboard hints */}
            <div className="mt-4 flex items-center justify-center gap-4 text-xs text-amber-400/40">
              <span>
                <kbd className="rounded bg-amber-800/30 px-1.5 py-0.5">Space</kbd> draw card
              </span>
              <span className="text-amber-700/30">|</span>
              <span>
                <kbd className="rounded bg-amber-800/30 px-1.5 py-0.5">C</kbd> toggle controls
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default ControlsBar;

