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
 * ## Design:
 * - Pure presentational component
 * - Sound logic handled by parent via useSoundSync hook
 * - Receives callbacks for sound changes
 *
 * @see SRD §5.1 Host Display Layout
 * @see SRD §2.4 Host UI State Machine
 */

import {
  useState,
  useCallback,
  useEffect,
  useSyncExternalStore,
  useRef,
  useMemo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users } from "lucide-react";
import { useTranslations } from "next-intl";
import type { GameSession, ItemDefinition } from "@/lib/types/game";
import type { BoardsManifest } from "@/lib/types/boards";
import type { ReactionBurstMessage } from "@/lib/realtime/types";
import { useHostUIState } from "@/lib/game/state-machine";
import { createDevLogger } from "@/lib/utils/dev-logger";
import { CurrentCard } from "./current-card";
import { TextPanel } from "./text-panel";
import { HistoryStrip } from "./history-strip";
import { ControlsBar } from "./controls-bar";
import { HistoryModal } from "./history-modal";
import { ReactionsOverlay } from "@/components/reactions-overlay";
import { FullscreenPrompt } from "@/components/fullscreen-prompt";
import { BoardStatusIndicator } from "@/components/board-status-indicator";
import { useImagePreloader } from "@/lib/game/image-preloader";
import { useBoardPredictions } from "@/lib/boards/use-board-predictions";

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

  /** v4.0: Sound enabled state (from useSoundSync) */
  isSoundEnabled?: boolean;

  /** v4.0: Callback when sound toggle clicked (from useSoundSync.hostToggle) */
  onSoundToggle?: () => void;

  /** v4.0: Number of spectators watching */
  spectatorCount?: number;

  /** v4.0: Reaction burst from spectators */
  reactions?: ReactionBurstMessage["reactions"];

  /** Whether user prefers reduced motion */
  reducedMotion?: boolean;

  /** v4.0: Current flip state of the card (for spectator sync) */
  isFlipped?: boolean;

  /** v4.0: Callback when card is flipped (for broadcasting to spectators) */
  onFlipChange?: (isFlipped: boolean) => void;

  /** v4.0: Current detailed text expansion state (for sync) */
  isDetailedExpanded?: boolean;

  /** v4.0: Callback when detailed text is expanded (for broadcasting) */
  onDetailedChange?: (isExpanded: boolean) => void;

  /** v4.0: Whether detailed state was synced from controller */
  isDetailedSyncedFromController?: boolean;

  /**
   * v4.0: Optional boards manifest for board prediction tracking.
   * When provided, shows BoardStatusIndicator with completion predictions.
   * Only shown in standalone mode (hidden when controller connected).
   */
  boardsManifest?: BoardsManifest;
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
  isSoundEnabled,
  onSoundToggle,
  spectatorCount = 0,
  reactions = [],
  reducedMotion: forcedReducedMotion,
  isFlipped = false,
  onFlipChange,
  isDetailedExpanded = false,
  onDetailedChange,
  isDetailedSyncedFromController = false,
  boardsManifest,
}: HostDisplayProps) {
  const t = useTranslations("spectator");
  const tDeepDive = useTranslations("deepDive");
  const {
    state: uiState,
    toggleFullscreen,
    enterFullscreen,
    handleHoverBottom,
    onControllerConnected,
    onControllerDisconnected,
  } = useHostUIState();

  const systemReducedMotion = useReducedMotion();
  const reducedMotion = forcedReducedMotion ?? systemReducedMotion;

  // Memoized values (must be before refs that depend on them)
  const currentCard = session.currentIndex + 1;
  const totalCards = session.totalItems;
  const isControllerConnected = session.connection.controllerConnected;
  const history = session.history;
  const currentItem = session.currentItem;

  // v4.0: All called items for prediction = history + currentItem
  // The history only contains PREVIOUS items, but we need to count the current one too
  const allCalledItems = useMemo(() => {
    if (currentItem) {
      return [...history, currentItem];
    }
    return history;
  }, [history, currentItem]);

  // v4.0: Board predictions (only when boardsManifest is provided)
  const boardPredictions = useBoardPredictions(
    boardsManifest?.boards,
    allCalledItems
  );

  // Prefetch upcoming images for faster loading (prefetch next 5 cards)
  // Uses shuffledDeck order to preload the ACTUAL next cards
  useImagePreloader(
    session.deck.items,
    session.shuffledDeck,
    session.currentIndex,
    5 // preload 5 ahead
  );

  // ============================================================================
  // DEBOUNCED DRAW CARD (1 second cooldown to prevent double-tap)
  // ============================================================================

  const DRAW_DEBOUNCE_MS = 1000;
  const [isDrawDebounced, setIsDrawDebounced] = useState(false);
  const drawDebounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const handleDrawCardDebounced = useCallback(() => {
    if (isDrawDebounced) {
      log.debug("Draw card debounced - ignoring");
      return;
    }

    // Check if game allows drawing
    const isFinished = session.status === "finished";
    const canDraw =
      !isFinished &&
      (session.status === "ready" ||
        session.status === "playing" ||
        (session.status === "paused" && currentCard < totalCards));

    if (!canDraw) {
      return;
    }

    // Execute draw
    onDrawCard();

    // Start debounce cooldown
    setIsDrawDebounced(true);
    drawDebounceTimeoutRef.current = setTimeout(() => {
      setIsDrawDebounced(false);
    }, DRAW_DEBOUNCE_MS);
  }, [isDrawDebounced, session.status, currentCard, totalCards, onDrawCard]);

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (drawDebounceTimeoutRef.current) {
        clearTimeout(drawDebounceTimeoutRef.current);
      }
    };
  }, []);

  // ============================================================================
  // KEYBOARD SHORTCUTS (Spacebar for draw, C for controls toggle)
  // ============================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Spacebar: Draw next card
      if (e.key === " " || e.code === "Space") {
        e.preventDefault(); // Prevent page scroll
        handleDrawCardDebounced();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleDrawCardDebounced]);

  // Modal state
  const [isHistoryModalOpen, setHistoryModalOpen] = useState(false);

  // Fullscreen prompt state
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const [isActuallyFullscreen, setIsActuallyFullscreen] = useState(false);
  // Initialize with false to detect first connection when component mounts with controller already connected
  const prevControllerConnectedRef = useRef(false);
  const hasShownInitialPromptRef = useRef(false);

  // Track actual browser fullscreen state (not UI state)
  useEffect(() => {
    const checkFullscreen = () => {
      setIsActuallyFullscreen(!!document.fullscreenElement);
    };

    checkFullscreen();
    document.addEventListener("fullscreenchange", checkFullscreen);
    return () =>
      document.removeEventListener("fullscreenchange", checkFullscreen);
  }, []);

  // Detect controller connection changes and show fullscreen prompt
  useEffect(() => {
    const wasConnected = prevControllerConnectedRef.current;
    const isNowConnected = isControllerConnected;

    // Show prompt on connection change OR on first mount if already connected
    const shouldShowPrompt =
      (!wasConnected && isNowConnected) ||
      (isNowConnected && !hasShownInitialPromptRef.current);

    if (shouldShowPrompt) {
      // Controller just connected (or was already connected on mount)
      log.log("Controller connected, showing fullscreen prompt");
      onControllerConnected();
      setShowFullscreenPrompt(true);
      hasShownInitialPromptRef.current = true;
    } else if (wasConnected && !isNowConnected) {
      // Controller disconnected
      log.log("Controller disconnected");
      onControllerDisconnected();
      setShowFullscreenPrompt(false);
    }

    prevControllerConnectedRef.current = isNowConnected;
  }, [isControllerConnected, onControllerConnected, onControllerDisconnected]);

  // Handle fullscreen prompt actions
  const handleEnterFullscreen = useCallback(() => {
    enterFullscreen();
  }, [enterFullscreen]);

  const handleDismissPrompt = useCallback(() => {
    setShowFullscreenPrompt(false);
  }, []);

  // Callbacks
  const handleOpenHistory = useCallback(() => {
    setHistoryModalOpen(true);
  }, []);

  const handleCloseHistory = useCallback(() => {
    setHistoryModalOpen(false);
  }, []);

  const handleHistoryCardClick = useCallback(
    (item: ItemDefinition, index: number) => {
      log.debug(`History card clicked: ${item.name} at index: ${index}`);
    },
    []
  );

  // Apply theme from deck
  useEffect(() => {
    if (session.deck.theme) {
      const root = document.documentElement;
      root.style.setProperty("--accent-color", session.deck.theme.primaryColor);
      if (session.deck.theme.secondaryColor) {
        root.style.setProperty(
          "--accent-secondary",
          session.deck.theme.secondaryColor
        );
      }
      if (session.deck.theme.fontFamily) {
        root.style.setProperty("--font-display", session.deck.theme.fontFamily);
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
      {/* Background overlay with vignette effect */}
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          background: `
            radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.5) 100%),
            linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.4) 100%)
          `,
        }}
      />

      {/* Theme color ambient glow (subtle) */}
      {currentItem?.themeColor && (
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            background: `radial-gradient(ellipse at 30% 50%, ${currentItem.themeColor}40 0%, transparent 50%)`,
          }}
          aria-hidden="true"
        />
      )}

      {/* Main content area */}
      <div className="relative flex h-screen w-full">
        {/* Left: Main card area */}
        <div
          className={`
            flex flex-1 flex-col items-center justify-center p-4 md:p-6
            ${isWideScreen ? "pr-36" : "pb-36"}
          `}
        >
          {/* Card + Text Layout */}
          <div className="flex w-full max-w-5xl flex-col items-center gap-8 lg:flex-row lg:items-start lg:justify-center lg:gap-16">
            {/* Current Card with flip (host controls flip, broadcasts to spectators) */}
            <CurrentCard
              item={currentItem}
              currentNumber={currentCard}
              totalCards={totalCards}
              showCounter={!isWideScreen}
              reducedMotion={reducedMotion}
              hostFlipState={isFlipped}
              onFlipChange={onFlipChange}
              showTitle={false}
              size={isWideScreen ? "large" : "default"}
            />

            {/* Text Panel (side on desktop) */}
            <TextPanel
              item={currentItem}
              showCategory={true}
              reducedMotion={reducedMotion}
              className="w-full max-w-md lg:max-w-lg lg:mt-4"
              isDetailedExpanded={isDetailedExpanded}
              onDetailedChange={onDetailedChange}
              isDetailedSyncedFromController={isDetailedSyncedFromController}
              detailedTexts={{
                expand: tDeepDive("expand"),
                collapse: tDeepDive("collapse"),
                syncedFromController: tDeepDive("syncedFromController"),
                localOverride: tDeepDive("localOverride"),
              }}
            />
          </div>
        </div>

        {/* History Strip - Adaptive Layout */}
        {isWideScreen ? (
          /* Vertical layout on wide screens (FR-035a) */
          <aside className="absolute right-0 top-0 h-full w-36 border-l border-amber-700/30 bg-gradient-to-l from-amber-950/70 to-amber-950/50 backdrop-blur-md">
            <HistoryStrip
              history={history}
              currentItem={currentItem}
              onCardClick={handleHistoryCardClick}
              onOpenModal={handleOpenHistory}
              forceVertical={true}
              reducedMotion={reducedMotion}
              scrollable={true}
              fadeEdge={true}
              autoScrollToNewest={true}
              className="h-full"
            />
          </aside>
        ) : (
          /* Horizontal layout on standard screens (FR-035b) */
          /* Dynamic bottom position: lower when controls hidden, higher when visible */
          <aside
            className={`
              absolute left-0 right-0 border-t border-amber-700/30 
              bg-gradient-to-t from-amber-950/80 to-amber-950/60 py-3 backdrop-blur-md
              transition-all duration-300 ease-out
              ${uiState.controlsVisible ? "bottom-28" : "bottom-4"}
            `}
          >
            {/* Constrain width to match content area */}
            <div className="mx-auto w-full max-w-4xl px-4">
              <HistoryStrip
                history={history}
                currentItem={currentItem}
                onCardClick={handleHistoryCardClick}
                onOpenModal={handleOpenHistory}
                forceVertical={false}
                reducedMotion={reducedMotion}
                scrollable={true}
                fadeEdge={true}
                autoScrollToNewest={true}
              />
            </div>
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
        onDrawCard={handleDrawCardDebounced}
        isDrawDebounced={isDrawDebounced}
        onPause={onPause}
        onResume={onResume}
        onToggleFullscreen={toggleFullscreen}
        onOpenHistory={handleOpenHistory}
        onHoverBottom={handleHoverBottom}
        onDisconnect={onDisconnect}
        isSoundEnabled={isSoundEnabled}
        onSoundToggle={onSoundToggle}
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

      {/* v4.0: Spectator count indicator */}
      <AnimatePresence>
        {spectatorCount > 0 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className={`fixed top-4 z-30 flex items-center gap-2 rounded-full bg-amber-900/80 px-4 py-2 backdrop-blur-sm ${
              isWideScreen ? "right-36" : "right-4"
            }`}
          >
            <Users className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-medium text-amber-200">
              {t("spectatorCount", { count: spectatorCount })}
            </span>
            {/* Live indicator */}
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* v4.0: Board status indicator (only in standalone mode with boards) */}
      <BoardStatusIndicator
        predictions={boardPredictions}
        isVisible={!isControllerConnected && boardsManifest !== undefined}
        position="top-left"
      />

      {/* v4.0: Reactions overlay */}
      <ReactionsOverlay reactions={reactions} />

      {/* v4.0: Fullscreen prompt (appears when controller connects) */}
      <FullscreenPrompt
        isVisible={showFullscreenPrompt && !isActuallyFullscreen}
        onEnterFullscreen={handleEnterFullscreen}
        onDismiss={handleDismissPrompt}
        autoDismissMs={6000}
        showArrow={uiState.controlsVisible}
        className={
          uiState.controlsVisible
            ? "bottom-48 left-1/2 -translate-x-1/2" // Above controls bar
            : "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" // Center of screen
        }
      />
    </div>
  );
}

export default HostDisplay;
