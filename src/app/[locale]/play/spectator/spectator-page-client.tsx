"use client";

/**
 * Spectator Page Client Component
 *
 * Spectator view that:
 * 1. Connects to a room as spectator
 * 2. Displays the current card (reusing existing components)
 * 3. Shows history strip (adaptive layout like host)
 * 4. Allows sending emoji reactions
 *
 * This component reuses existing components from play/_components/
 * to maintain consistency and avoid duplication (DRY principle).
 *
 * ## Layout Strategy (mirrors host-display.tsx)
 * - Wide screens (≥1400px): Vertical history strip on right
 * - Standard screens: Horizontal strip above reaction bar
 *
 * @see SRD §6.3 Spectator Mode
 */

import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Users, WifiOff, AlertCircle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Reuse existing components (single source of truth)
import { CurrentCard } from "@/app/play/_components/current-card";
import { TextPanel } from "@/app/play/_components/text-panel";
import { HistoryStrip } from "@/app/play/_components/history-strip";

// New spectator-specific components
import { ReactionBar } from "@/components/reaction-bar";
import { ReactionsOverlay } from "@/components/reactions-overlay";
import { SoundToggle } from "@/components/sound-toggle";
import { useSpectatorSocket } from "@/lib/realtime/use-spectator-socket";
import { audioManager } from "@/lib/audio/audio-manager";
import type { ItemDefinition } from "@/lib/types/game";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

/** Error codes for more granular error handling */
type SpectatorErrorCode =
  | "room-not-found"
  | "game-ended"
  | "already-connected"
  | "connection-failed";

type SpectatorViewState =
  | { status: "no-room" }
  | { status: "connecting" }
  | { status: "connected" }
  | { status: "error"; message: string; errorCode?: SpectatorErrorCode }
  | { status: "game-ended" };

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface ConnectionBadgeProps {
  status: SpectatorViewState["status"];
  spectatorCount: number;
  roomId: string | null;
}

function ConnectionBadge({
  status,
  spectatorCount,
  roomId,
}: ConnectionBadgeProps) {
  const t = useTranslations("spectator");
  const tGame = useTranslations("game");

  const getStatusConfig = () => {
    switch (status) {
      case "connected":
        return {
          icon: Users,
          text: t("spectatorCount", { count: spectatorCount }),
          bgColor: "bg-green-900/70",
          textColor: "text-green-300",
          iconColor: "text-green-400",
        };
      case "connecting":
        return {
          icon: Loader2,
          text: tGame("connecting"),
          bgColor: "bg-yellow-900/70",
          textColor: "text-yellow-300",
          iconColor: "text-yellow-400 animate-spin",
        };
      case "error":
      case "game-ended":
        return {
          icon: WifiOff,
          text: tGame("disconnected"),
          bgColor: "bg-red-900/70",
          textColor: "text-red-300",
          iconColor: "text-red-400",
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();
  if (!config) return null;

  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex items-center gap-2 rounded-full px-4 py-2 backdrop-blur-sm",
        config.bgColor
      )}
    >
      <Icon className={cn("h-4 w-4", config.iconColor)} />
      <span className={cn("text-sm font-medium", config.textColor)}>
        {config.text}
      </span>
      {roomId && status === "connected" && (
        <span className="font-mono text-xs text-amber-400/60 ml-2">
          {roomId}
        </span>
      )}
    </motion.div>
  );
}

// ============================================================================
// ERROR STATES
// ============================================================================

interface ErrorViewProps {
  errorCode?: SpectatorErrorCode;
  fallbackMessage?: string;
  onRetry?: () => void;
  onGoBack?: () => void;
}

function ErrorView({
  errorCode,
  fallbackMessage,
  onRetry,
  onGoBack,
}: ErrorViewProps) {
  const t = useTranslations("spectator.errors");
  const router = useRouter();

  // Get contextual content based on error code
  const getErrorContent = () => {
    switch (errorCode) {
      case "room-not-found":
        return {
          icon: WifiOff,
          iconBg: "bg-amber-800/30",
          iconColor: "text-amber-400",
          title: t("roomNotFound"),
          description: t("roomNotFoundDesc"),
          showRetry: true,
          showGoBack: true,
        };
      case "game-ended":
        return {
          icon: Users,
          iconBg: "bg-green-900/30",
          iconColor: "text-green-400",
          title: t("gameEnded"),
          description: t("gameEndedDesc"),
          showRetry: false,
          showGoBack: true,
        };
      case "already-connected":
        return {
          icon: AlertCircle,
          iconBg: "bg-yellow-900/30",
          iconColor: "text-yellow-400",
          title: t("alreadyConnected"),
          description: t("alreadyConnectedDesc"),
          showRetry: false,
          showGoBack: true,
        };
      default:
        return {
          icon: AlertCircle,
          iconBg: "bg-red-900/30",
          iconColor: "text-red-400",
          title: t("connectionFailed"),
          description: fallbackMessage || t("connectionFailedDesc"),
          showRetry: true,
          showGoBack: true,
        };
    }
  };

  const content = getErrorContent();
  const Icon = content.icon;

  const handleGoBack = () => {
    if (onGoBack) {
      onGoBack();
    } else {
      router.push("/play/join");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-linear-to-br from-amber-950 via-amber-900 to-amber-950 p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-md"
      >
        {/* Icon */}
        <div
          className={cn(
            "mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full",
            content.iconBg
          )}
        >
          <Icon className={cn("h-10 w-10", content.iconColor)} />
        </div>

        {/* Title */}
        <h1 className="mb-3 font-serif text-2xl font-bold text-amber-100">
          {content.title}
        </h1>

        {/* Description */}
        <p className="text-amber-300/70 mb-8">{content.description}</p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {content.showRetry && onRetry && (
            <button
              onClick={onRetry}
              className="w-full sm:w-auto rounded-full bg-amber-500 px-6 py-3 font-semibold text-amber-950 transition-colors hover:bg-amber-400"
            >
              {t("tryAgain")}
            </button>
          )}
          {content.showGoBack && (
            <button
              onClick={handleGoBack}
              className="w-full sm:w-auto rounded-full border-2 border-amber-500/50 px-6 py-3 font-semibold text-amber-200 transition-colors hover:border-amber-400 hover:text-amber-100"
            >
              {t("goBack")}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function NoRoomView() {
  const t = useTranslations("pairing");
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-linear-to-br from-amber-950 via-amber-900 to-amber-950 p-6">
      <div className="text-center max-w-md">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-800/30">
          <Users className="h-10 w-10 text-amber-400" />
        </div>
        <h1 className="mb-4 font-serif text-2xl font-bold text-amber-100">
          {t("enterCode")}
        </h1>
        <p className="text-amber-300/70 mb-6">
          Scan the QR code on the host screen or enter the room code.
        </p>
        <button
          onClick={() => router.push("/play/join")}
          className="rounded-full bg-amber-500 px-6 py-3 font-semibold text-amber-950 transition-colors hover:bg-amber-400"
        >
          Enter Room Code
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SpectatorPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations("spectator");
  const tGame = useTranslations("game");
  const tDeepDive = useTranslations("deepDive");

  // Get room ID from URL
  const roomId = searchParams?.get("room") ?? null;

  // Connect to spectator socket
  const {
    connectionStatus,
    error,
    gameState,
    spectatorCount,
    reactions,
    sendReaction,
    connect,
  } = useSpectatorSocket({
    roomId,
    debug: true,
  });

  // ==========================================================================
  // SYNC + OVERRIDE FLIP PATTERN
  // ==========================================================================

  // Local flip state: null = synced with host, boolean = local override
  const [localFlipOverride, setLocalFlipOverride] = useState<boolean | null>(
    null
  );

  // Host's flip state from server
  const hostFlipState = gameState?.isFlipped ?? false;

  // Effective flip state: use local override if set, otherwise host state
  const effectiveFlipState =
    localFlipOverride !== null ? localFlipOverride : hostFlipState;

  // Is the spectator's view different from what host is showing?
  const isOutOfSync =
    localFlipOverride !== null && localFlipOverride !== hostFlipState;

  // Reset local override when card changes (resync with host)
  // Track previous card ID to detect changes
  const currentItemId = gameState?.currentItem?.id;
  const previousItemIdRef = useRef(currentItemId);
  useEffect(() => {
    if (currentItemId !== previousItemIdRef.current) {
      // New card - reset local override using queueMicrotask for React Compiler compliance
      queueMicrotask(() => {
        setLocalFlipOverride(null);
      });
      previousItemIdRef.current = currentItemId;
    }
  }, [currentItemId]);

  // Handle spectator clicking to flip (local override)
  const handleLocalFlip = useCallback((newFlipState: boolean) => {
    setLocalFlipOverride(newFlipState);
  }, []);

  // ==========================================================================
  // SYNC + OVERRIDE DETAILED TEXT PATTERN
  // ==========================================================================

  // Local detailed state: null = synced with host, boolean = local override
  const [localDetailedOverride, setLocalDetailedOverride] = useState<
    boolean | null
  >(null);

  // Host's detailed state from server
  const hostDetailedState = gameState?.isDetailedExpanded ?? false;

  // Effective detailed state: use local override if set, otherwise host state
  const effectiveDetailedState =
    localDetailedOverride !== null ? localDetailedOverride : hostDetailedState;

  // Is the spectator's detailed view different from what host is showing?
  const isDetailedOutOfSync =
    localDetailedOverride !== null &&
    localDetailedOverride !== hostDetailedState;

  // Reset local detailed override when card changes (resync with host)
  useEffect(() => {
    if (currentItemId !== previousItemIdRef.current) {
      // New card - reset local detailed override using queueMicrotask
      queueMicrotask(() => {
        setLocalDetailedOverride(null);
      });
    }
  }, [currentItemId]);

  // Handle spectator clicking to toggle detailed text (local override)
  const handleLocalDetailedToggle = useCallback((newState: boolean) => {
    setLocalDetailedOverride(newState);
  }, []);

  // ==========================================================================
  // LOCAL AUDIO (independent, no sync with host)
  // ==========================================================================

  // Sound enabled by default (no localStorage persistence per user request)
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);

  // Track previous card index to detect new card draws
  const prevCardIndexRef = useRef(gameState?.currentIndex ?? -1);

  // Play sound when a new card is drawn
  useEffect(() => {
    const currentIndex = gameState?.currentIndex ?? -1;

    // Only play if index increased (new card drawn) and sound is enabled
    if (currentIndex > prevCardIndexRef.current && currentIndex >= 0) {
      if (isSoundEnabled) {
        // Play card sound (init is idempotent)
        audioManager.init().then(() => {
          audioManager.playCardDraw();
        });
      }
    }

    prevCardIndexRef.current = currentIndex;
  }, [gameState?.currentIndex, isSoundEnabled]);

  // Toggle sound handler
  const handleToggleSound = useCallback(() => {
    setIsSoundEnabled((prev) => {
      const newEnabled = !prev;
      audioManager.setEnabled(newEnabled);
      return newEnabled;
    });
  }, []);

  // Convert game state history to ItemDefinition array for HistoryStrip
  const history = gameState?.history;
  const historyItems: ItemDefinition[] = useMemo(() => {
    if (!history) return [];
    // Filter out null items
    return history.filter((item): item is ItemDefinition => item !== null);
  }, [history]);

  // Derive view state from connection status (no effect needed)
  const viewState: SpectatorViewState = useMemo(() => {
    if (!roomId) {
      return { status: "no-room" };
    }

    // Helper to detect error code from error message
    const detectErrorCode = (msg: string): SpectatorErrorCode => {
      if (msg.includes("not found") || msg.includes("closed")) {
        return "room-not-found";
      }
      if (msg.includes("ended") || msg.includes("finished")) {
        return "game-ended";
      }
      if (msg.includes("already") || msg.includes("another tab")) {
        return "already-connected";
      }
      return "connection-failed";
    };

    switch (connectionStatus) {
      case "connecting":
      case "reconnecting":
        return { status: "connecting" };
      case "connected":
        return { status: "connected" };
      case "error": {
        const errorCode = error ? detectErrorCode(error) : "connection-failed";
        if (errorCode === "game-ended") {
          return { status: "game-ended" };
        }
        return {
          status: "error",
          message: error ?? "Connection failed",
          errorCode,
        };
      }
      case "disconnected":
        if (error) {
          const errorCode = detectErrorCode(error);
          if (errorCode === "game-ended") {
            return { status: "game-ended" };
          }
          return {
            status: "error",
            message: error,
            errorCode,
          };
        }
        return { status: "connecting" }; // Default while waiting
      default:
        return { status: "connecting" };
    }
  }, [connectionStatus, error, roomId]);

  // Retry connection
  const handleRetry = useCallback(() => {
    if (roomId) {
      connect();
    } else {
      router.push("/play/join");
    }
  }, [roomId, connect, router]);

  // ========================================================================
  // ADAPTIVE LAYOUT (mirrors host-display.tsx)
  // ========================================================================

  // Breakpoint aligned with Tailwind's lg (1024px)
  // At lg+: side-by-side layout with vertical history strip on right
  // Below lg: mobile layout with horizontal history strip
  const [isWideScreen, setIsWideScreen] = useState(false);

  useEffect(() => {
    const checkWidth = () => {
      // Align with Tailwind lg breakpoint (1024px)
      setIsWideScreen(window.innerWidth >= 1024);
    };
    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  // ========================================================================
  // RENDER
  // ========================================================================

  // No room ID provided
  if (viewState.status === "no-room") {
    return <NoRoomView />;
  }

  // Error state
  if (viewState.status === "error" || viewState.status === "game-ended") {
    return (
      <ErrorView
        errorCode={
          viewState.status === "error" ? viewState.errorCode : "game-ended"
        }
        fallbackMessage={
          viewState.status === "error" ? viewState.message : undefined
        }
        onRetry={handleRetry}
      />
    );
  }

  // Game status
  const isGameActive =
    gameState?.status === "playing" || gameState?.status === "ready";
  const isGameFinished = gameState?.status === "finished";
  const isWaitingForHost =
    gameState?.status === "waiting" ||
    (!gameState && viewState.status === "connected");
  const currentCard =
    gameState?.currentIndex !== undefined ? gameState.currentIndex + 1 : 0;
  const totalCards = gameState?.totalItems ?? 0;

  // Calculate bottom padding based on whether history exists
  const hasHistory = historyItems.length > 0;

  return (
    <div className="h-screen w-screen overflow-hidden bg-linear-to-br from-amber-950 via-amber-900 to-amber-950 flex flex-col">
      {/* Background overlay */}
      <div
        className="fixed inset-0 bg-black/30 pointer-events-none"
        aria-hidden="true"
      />

      {/* ===== HEADER (relative, in flow) ===== */}
      <header className="relative z-20 shrink-0 flex items-center justify-between p-3 sm:p-4">
        <ConnectionBadge
          status={viewState.status}
          spectatorCount={spectatorCount}
          roomId={roomId}
        />

        {/* Right side: Watching indicator + Sound toggle */}
        <div className="flex items-center gap-3">
          {/* Watching indicator */}
          <div className="flex items-center gap-2 text-amber-400/60">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            <span className="text-sm">{t("watching")}</span>
          </div>

          {/* Sound toggle - local control, non-intrusive */}
          <SoundToggle
            isEnabled={isSoundEnabled}
            onClick={handleToggleSound}
            size="sm"
          />
        </div>
      </header>

      {/* ===== MAIN CONTENT (flex-1, takes remaining space) ===== */}
      <main
        className={cn(
          "relative z-10 flex-1 flex items-center justify-center overflow-auto p-4",
          isWideScreen && "pr-36" // Only add right padding for wide screen history strip
        )}
      >
        <AnimatePresence mode="wait">
          {viewState.status === "connecting" ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <div className="mb-4 mx-auto h-12 w-12 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
              <p className="font-serif text-xl text-amber-200">
                {tGame("connecting")}
              </p>
            </motion.div>
          ) : isWaitingForHost ? (
            /* Waiting for host to start the game */
            <motion.div
              key="waiting"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-center max-w-md px-6"
            >
              {/* Pulsing waiting indicator */}
              <div className="mb-6 mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-800/30">
                <div className="h-12 w-12 animate-pulse rounded-full bg-amber-500/60" />
              </div>

              <h2 className="font-serif text-2xl font-bold text-amber-100 mb-3">
                {t("waitingForHost")}
              </h2>

              <p className="text-amber-300/70 mb-6">{t("hostSettingUp")}</p>

              {/* Spectator count */}
              {spectatorCount > 0 && (
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-900/50 px-4 py-2 text-sm text-amber-200">
                  <Users className="h-4 w-4" />
                  <span>
                    {t("spectatorsWaiting", { count: spectatorCount })}
                  </span>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-5xl"
            >
              {/* Card + Text Layout - Responsive */}
              <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-center lg:gap-10">
                {/* Card - syncs with host but allows local flip/detailed override */}
                {/* Use "large" size on mobile/tablet where TextPanel is hidden */}
                <CurrentCard
                  item={gameState?.currentItem ?? null}
                  currentNumber={currentCard}
                  totalCards={totalCards}
                  showCounter={true}
                  size={isWideScreen ? "default" : "large"}
                  hostFlipState={effectiveFlipState}
                  onFlipChange={handleLocalFlip}
                  showTitle={false}
                  isOutOfSync={isOutOfSync}
                  outOfSyncText={t("personalView")}
                />

                {/* TextPanel - hidden on small screens, visible on lg+ */}
                <div className="hidden lg:block">
                  <TextPanel
                    item={gameState?.currentItem ?? null}
                    showCategory={true}
                    className="w-full max-w-md"
                    isDetailedExpanded={effectiveDetailedState}
                    onDetailedChange={handleLocalDetailedToggle}
                    isDetailedLocalOverride={isDetailedOutOfSync}
                    detailedTexts={{
                      expand: tDeepDive("expand"),
                      collapse: tDeepDive("collapse"),
                      syncedFromController: tDeepDive("syncedFromController"),
                      localOverride: tDeepDive("localOverride"),
                    }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ===== WIDE SCREEN: Vertical History Strip (fixed right, below header) ===== */}
      {isWideScreen && hasHistory && (
        <aside className="fixed right-0 top-14 bottom-0 w-32 z-10 border-l border-amber-700/20 bg-amber-950/40">
          <HistoryStrip
            history={historyItems}
            currentItem={gameState?.currentItem ?? null}
            forceVertical={true}
            scrollable={true}
            fadeEdge={true}
            autoScrollToNewest={true}
            className="h-full pt-4"
          />
        </aside>
      )}

      {/* ===== STANDARD SCREENS: History Strip (in flow, above reaction bar) ===== */}
      {!isWideScreen && hasHistory && (
        <aside className="relative z-10 shrink-0 border-t border-amber-700/30 bg-linear-to-t from-amber-950/60 to-amber-950/30 py-3 mb-2">
          {/* 
            Width constraint: 
            - Mobile: full width (px-4 provides edge padding)
            - Tablet+: max-w-3xl (~768px) to match card + text layout
          */}
          <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
            <HistoryStrip
              history={historyItems}
              currentItem={gameState?.currentItem ?? null}
              forceVertical={false}
              scrollable={true}
              fadeEdge={true}
              autoScrollToNewest={true}
            />
          </div>
        </aside>
      )}

      {/* ===== SPACER for fixed ReactionBar ===== */}
      <div className="h-16 shrink-0" aria-hidden="true" />

      {/* ===== REACTION BAR (fixed at bottom via component's own styles) ===== */}
      <ReactionBar
        onReact={sendReaction}
        isEnabled={viewState.status === "connected" && isGameActive}
      />

      {/* ===== REACTIONS OVERLAY (shows reactions from all spectators) ===== */}
      <ReactionsOverlay reactions={reactions} />

      {/* Game finished overlay */}
      <AnimatePresence>
        {isGameFinished && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <div className="text-center p-6">
              <h2 className="font-serif text-4xl font-bold text-amber-100">
                🎉 ¡Tabula!
              </h2>
              <p className="mt-4 text-xl text-amber-300">
                {tGame("status.finished")}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
