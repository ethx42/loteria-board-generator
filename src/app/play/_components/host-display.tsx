"use client";

/**
 * HostDisplay Component
 *
 * Main Host Display that composes all game UI components:
 * - CurrentCard with flip animation
 * - TextPanel for educational content
 * - HistoryStrip for previously called cards
 * - ControlsBar with auto-hide behavior
 * - HistoryModal for full history view
 *
 * Implements the Host UI State Machine for mode management.
 *
 * @see SRD §5.1 Host Display Layout
 * @see SRD §2.4 Host UI State Machine
 */

import { useState, useCallback, useEffect, useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { GameSession, ItemDefinition } from "@/lib/types/game";
import { useHostUIState } from "@/lib/game/state-machine";
import { createDevLogger } from "@/lib/utils/dev-logger";
import { CurrentCard } from "./current-card";
import { TextPanel } from "./text-panel";
import { HistoryStrip } from "./history-strip";
import { ControlsBar } from "./controls-bar";
import { HistoryModal } from "./history-modal";

const log = createDevLogger("HostDisplay");

// ============================================================================
// TYPES
// ============================================================================

interface HostDisplayProps {
  /** Current game session */
  session: GameSession;

  /** Callback to draw next card */
  onDrawCard: () => void;

  /** Callback to pause game */
  onPause: () => void;

  /** Callback to resume game */
  onResume: () => void;

  /** Callback to reset game */
  onReset: () => void;

  /** Callback to end session */
  onDisconnect?: () => void;

  /** Whether user prefers reduced motion */
  reducedMotion?: boolean;
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook to detect user's reduced motion preference
 * Uses useSyncExternalStore pattern to avoid setState in effect
 */
function useReducedMotion(): boolean {
  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const subscribe = useCallback((callback: () => void) => {
    if (typeof window === "undefined") return () => {};
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    mediaQuery.addEventListener("change", callback);
    return () => mediaQuery.removeEventListener("change", callback);
  }, []);

  // For SSR, return false
  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// ============================================================================
// COMPONENT
// ============================================================================

export function HostDisplay({
  session,
  onDrawCard,
  onPause,
  onResume,
  onReset,
  onDisconnect,
  reducedMotion: forcedReducedMotion,
}: HostDisplayProps) {
  const {
    state: uiState,
    toggleFullscreen,
    handleHoverBottom,
  } = useHostUIState();

  const systemReducedMotion = useReducedMotion();
  const reducedMotion = forcedReducedMotion ?? systemReducedMotion;

  // Modal state
  const [isHistoryModalOpen, setHistoryModalOpen] = useState(false);

  // Memoized values
  const currentCard = session.currentIndex + 1;
  const totalCards = session.totalItems;
  const isControllerConnected = session.connection.controllerConnected;
  const history = session.history;
  const currentItem = session.currentItem;

  // Callbacks
  const handleOpenHistory = useCallback(() => {
    setHistoryModalOpen(true);
  }, []);

  const handleCloseHistory = useCallback(() => {
    setHistoryModalOpen(false);
  }, []);

  const handleHistoryCardClick = useCallback(
    (item: ItemDefinition, index: number) => {
      // Could navigate to specific card or show details
      log.debug(`History card clicked: ${item.name} at index: ${index}`);
    },
    []
  );

  // Apply theme from deck
  useEffect(() => {
    if (session.deck.theme) {
      const root = document.documentElement;
      root.style.setProperty(
        "--accent-color",
        session.deck.theme.primaryColor
      );
      if (session.deck.theme.secondaryColor) {
        root.style.setProperty(
          "--accent-secondary",
          session.deck.theme.secondaryColor
        );
      }
      if (session.deck.theme.fontFamily) {
        root.style.setProperty(
          "--font-display",
          session.deck.theme.fontFamily
        );
      }
    }
  }, [session.deck.theme]);

  // Determine layout based on screen width
  const [isWideScreen, setIsWideScreen] = useState(false);

  useEffect(() => {
    const checkWidth = () => {
      setIsWideScreen(window.innerWidth >= 1400);
    };
    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  return (
    <div
      className={`
        relative min-h-screen w-full overflow-hidden
        bg-gradient-to-br from-amber-950 via-amber-900 to-amber-950
        ${uiState.isFullscreen ? "fullscreen-mode" : ""}
      `}
      style={{
        backgroundImage: session.deck.theme?.backgroundUrl
          ? `url(${session.deck.theme.backgroundUrl})`
          : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Background overlay */}
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />

      {/* Main content area */}
      <div className="relative flex h-screen w-full">
        {/* Left: Main card area */}
        <div
          className={`
            flex flex-1 flex-col items-center justify-center p-4
            ${isWideScreen ? "pr-80" : "pb-32"}
          `}
        >
          {/* Card + Text Layout */}
          <div className="flex w-full max-w-5xl flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-center lg:gap-12">
            {/* Current Card with flip */}
            <CurrentCard
              item={currentItem}
              currentNumber={currentCard}
              totalCards={totalCards}
              showCounter={!isWideScreen}
              reducedMotion={reducedMotion}
            />

            {/* Text Panel (side on desktop) */}
            <TextPanel
              item={currentItem}
              currentNumber={currentCard}
              totalCards={totalCards}
              showCounter={isWideScreen}
              showCategory={true}
              reducedMotion={reducedMotion}
              className="w-full max-w-md lg:mt-8"
            />
          </div>
        </div>

        {/* History Strip - Adaptive Layout */}
        {isWideScreen ? (
          /* Vertical layout on wide screens (FR-035a) */
          <aside className="absolute right-0 top-0 h-full w-32 border-l border-amber-700/20 bg-amber-950/50 backdrop-blur-sm">
            <HistoryStrip
              history={history}
              currentItem={currentItem}
              onCardClick={handleHistoryCardClick}
              onOpenModal={handleOpenHistory}
              forceVertical={true}
              reducedMotion={reducedMotion}
              className="h-full"
            />
          </aside>
        ) : (
          /* Horizontal layout on standard screens (FR-035b) */
          <aside className="absolute bottom-28 left-0 right-0 border-t border-amber-700/20 bg-amber-950/50 py-2 backdrop-blur-sm">
            <HistoryStrip
              history={history}
              currentItem={currentItem}
              onCardClick={handleHistoryCardClick}
              onOpenModal={handleOpenHistory}
              forceVertical={false}
              reducedMotion={reducedMotion}
            />
          </aside>
        )}
      </div>

      {/* Game Status Overlay */}
      <AnimatePresence>
        {session.status === "waiting" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <div className="text-center">
              <div className="mb-4 h-12 w-12 animate-pulse rounded-full bg-amber-500 mx-auto" />
              <h2 className="font-serif text-2xl font-bold text-amber-100">
                Waiting for Controller
              </h2>
              <p className="mt-2 text-amber-300/70">
                Connect a device to start the game
              </p>
              <p className="mt-4 font-mono text-3xl text-amber-400">
                Room: {session.id}
              </p>
            </div>
          </motion.div>
        )}

        {session.status === "finished" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <div className="text-center">
              <h2 className="font-serif text-4xl font-bold text-amber-100">
                🎉 ¡Tabula!
              </h2>
              <p className="mt-4 text-xl text-amber-300">
                All {totalCards} cards have been called
              </p>
              <button
                onClick={onReset}
                className="mt-6 rounded-full bg-amber-500 px-6 py-3 font-semibold text-amber-950 transition-colors hover:bg-amber-400"
              >
                Play Again
              </button>
            </div>
          </motion.div>
        )}

        {session.status === "paused" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute left-1/2 top-4 z-30 -translate-x-1/2"
          >
            <div className="rounded-full bg-amber-800/90 px-6 py-2 backdrop-blur-sm">
              <span className="font-semibold text-amber-100">
                ⏸ Game Paused
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls Bar */}
      <ControlsBar
        gameStatus={session.status}
        isVisible={uiState.controlsVisible}
        isFullscreen={uiState.isFullscreen}
        isControllerConnected={isControllerConnected}
        currentCard={currentCard}
        totalCards={totalCards}
        onDrawCard={onDrawCard}
        onPause={onPause}
        onResume={onResume}
        onToggleFullscreen={toggleFullscreen}
        onOpenHistory={handleOpenHistory}
        onHoverBottom={handleHoverBottom}
        onDisconnect={onDisconnect}
        reducedMotion={reducedMotion}
      />

      {/* History Modal */}
      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={handleCloseHistory}
        history={history}
        currentItem={currentItem}
        reducedMotion={reducedMotion}
      />
    </div>
  );
}

export default HostDisplay;

