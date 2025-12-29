"use client";

/**
 * RemoteController Component
 *
 * Mobile-optimized controller interface for untethered game control.
 * Designed for one-handed operation with thumb-reachable controls.
 *
 * Layout Zones (per SRD §5.2):
 * - Top: Connection status
 * - Middle: Mini card preview
 * - Main: Giant draw button (thumb zone)
 * - Bottom: Secondary controls (pause, history, counter)
 *
 * @see SRD §5.2 Remote Controller Layout
 * @see SRD §5.12 Touch targets (min 44x44px)
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pause, Play, History, RotateCcw, LogOut } from "lucide-react";
import type { GameStatus, ItemDefinition } from "@/lib/types/game";
import { ConnectionStatusIndicator, type ConnectionStatus } from "./connection-status";
import { DrawButton } from "./draw-button";
import { MiniCard } from "./mini-card";
import { HistoryModal } from "./history-modal";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Simplified game state received from WebSocket updates
 */
export interface ControllerGameState {
  currentItem: ItemDefinition | null;
  currentIndex: number;
  totalItems: number;
  status: GameStatus;
  historyCount: number;
}

interface RemoteControllerProps {
  /** Room ID for display */
  roomId: string;

  /** Game state received from host */
  gameState: ControllerGameState;

  /** Connection status */
  connectionStatus: ConnectionStatus;

  /** Callback to draw next card */
  onDrawCard: () => void;

  /** Callback to pause game */
  onPause: () => void;

  /** Callback to resume game */
  onResume: () => void;

  /** Callback to reset game */
  onReset: () => void;

  /** Callback to retry connection */
  onRetryConnection?: () => void;

  /** Callback to disconnect and go back */
  onDisconnect?: () => void;

  /** Whether reduced motion is preferred */
  reducedMotion?: boolean;
}

// ============================================================================
// SECONDARY BUTTON COMPONENT
// ============================================================================

interface SecondaryButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}

function SecondaryButton({
  icon,
  label,
  onClick,
  disabled = false,
  active = false,
}: SecondaryButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex flex-col items-center justify-center gap-1
        rounded-xl px-4 py-3
        min-w-[72px] min-h-[72px]
        transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-amber-400
        ${
          disabled
            ? "bg-amber-900/30 text-amber-600/50 cursor-not-allowed"
            : active
              ? "bg-amber-600/80 text-amber-100"
              : "bg-amber-900/60 text-amber-200 active:bg-amber-800/80"
        }
      `}
      aria-label={label}
      style={{
        // Ensure minimum touch target of 44x44px (§5.12)
        touchAction: "manipulation",
      }}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function RemoteController({
  roomId,
  gameState,
  connectionStatus,
  onDrawCard,
  onPause,
  onResume,
  onReset,
  onRetryConnection,
  onDisconnect,
  reducedMotion = false,
}: RemoteControllerProps) {
  const [isHistoryOpen, setHistoryOpen] = useState(false);

  // Derived state
  const currentCard = gameState.currentIndex + 1;
  const totalCards = gameState.totalItems;
  const isFirstCard = currentCard === 0;
  const isPaused = gameState.status === "paused";
  const isPlaying = gameState.status === "playing";
  const isFinished = gameState.status === "finished";
  const canDraw = !isFinished && !isPaused && connectionStatus === "connected";

  // Callbacks
  const handleOpenHistory = useCallback(() => {
    setHistoryOpen(true);
  }, []);

  const handleCloseHistory = useCallback(() => {
    setHistoryOpen(false);
  }, []);

  const handlePauseResume = useCallback(() => {
    if (isPaused) {
      onResume();
    } else {
      onPause();
    }
  }, [isPaused, onPause, onResume]);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-amber-950 via-amber-900 to-amber-950 safe-area-inset">
      {/* ====== TOP ZONE: Connection Status ====== */}
      <header className="flex items-center justify-center px-4 py-4">
        <ConnectionStatusIndicator
          status={connectionStatus}
          roomId={roomId}
          onRetry={onRetryConnection}
          reducedMotion={reducedMotion}
        />
      </header>

      {/* ====== MIDDLE ZONE: Mini Card Preview ====== */}
      <section className="flex flex-1 flex-col items-center justify-center px-4 py-4">
        <MiniCard
          item={gameState.currentItem}
          reducedMotion={reducedMotion}
        />

        {/* Short text preview (if available) */}
        <AnimatePresence mode="wait">
          {gameState.currentItem?.shortText && (
            <motion.p
              key={gameState.currentItem.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4 max-w-[280px] text-center font-serif text-sm leading-relaxed text-amber-200/80"
            >
              {gameState.currentItem.shortText.slice(0, 100)}
              {gameState.currentItem.shortText.length > 100 ? "..." : ""}
            </motion.p>
          )}
        </AnimatePresence>
      </section>

      {/* ====== MAIN ZONE: Giant Draw Button (Thumb Zone) ====== */}
      <section className="flex items-center justify-center px-8 py-6">
        <DrawButton
          onDraw={onDrawCard}
          disabled={!canDraw}
          gameState={gameState.status}
          isFirstCard={isFirstCard}
          reducedMotion={reducedMotion}
        />
      </section>

      {/* ====== BOTTOM ZONE: Secondary Controls ====== */}
      <footer className="border-t border-amber-800/30 bg-amber-950/50 px-4 py-4 backdrop-blur-sm">
        {/* Control buttons */}
        <div className="mx-auto flex max-w-md items-center justify-center gap-3">
          {/* Pause/Resume */}
          <SecondaryButton
            icon={
              isPaused ? (
                <Play className="h-5 w-5" />
              ) : (
                <Pause className="h-5 w-5" />
              )
            }
            label={isPaused ? "Resume" : "Pause"}
            onClick={handlePauseResume}
            disabled={!isPlaying && !isPaused}
            active={isPaused}
          />

          {/* History */}
          <SecondaryButton
            icon={<History className="h-5 w-5" />}
            label="History"
            onClick={handleOpenHistory}
            disabled={gameState.historyCount === 0}
          />

          {/* Reset (only show when finished) */}
          {isFinished && (
            <SecondaryButton
              icon={<RotateCcw className="h-5 w-5" />}
              label="New Game"
              onClick={onReset}
            />
          )}

          {/* Disconnect */}
          {onDisconnect && (
            <SecondaryButton
              icon={<LogOut className="h-5 w-5" />}
              label="Leave"
              onClick={onDisconnect}
            />
          )}
        </div>

        {/* Progress indicator */}
        <div className="mx-auto mt-4 max-w-md">
          <div className="flex items-center justify-between text-xs text-amber-400/70">
            <span>Progress</span>
            <span className="font-mono">
              {currentCard} / {totalCards}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-amber-900/50">
            <motion.div
              className="h-full bg-amber-500"
              initial={{ width: 0 }}
              animate={{ width: `${totalCards > 0 ? (currentCard / totalCards) * 100 : 0}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      </footer>

      {/* History Modal - Note: Controller doesn't have full history, just count */}
      {/* In a full implementation, we'd request history from host or cache it locally */}
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={handleCloseHistory}
        history={[]} // Controller doesn't have history items, only count
        currentItem={gameState.currentItem}
        reducedMotion={reducedMotion}
      />
    </div>
  );
}

export default RemoteController;
