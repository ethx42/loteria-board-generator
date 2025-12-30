/**
 * Game Synchronization Hook
 *
 * Integrates the game store with Partykit WebSocket for real-time
 * state synchronization between Host and Controller.
 *
 * @module lib/game/use-game-sync
 * @see SRD §3.4 Realtime Protocol
 */

import { useEffect, useCallback, useRef, useState } from "react";
import { useGameStore } from "@/stores/game-store";
import {
  useGameSocket,
  type ConnectionStatus as SocketConnectionStatus,
} from "@/lib/realtime/partykit-client";
import type { WSMessage, StateUpdatePayload } from "@/lib/realtime/types";
import type { GameSession } from "@/lib/types/game";

// ============================================================================
// TYPES
// ============================================================================

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "error";

interface UseGameSyncOptions {
  /** Room ID to connect to */
  roomId: string;

  /** Called when connection status changes */
  onConnectionChange?: (connected: boolean) => void;

  /** Called when an error occurs */
  onError?: (error: Error) => void;
}

interface GameSyncActions {
  /** Draw the next card */
  drawCard: () => void;

  /** Pause the game */
  pauseGame: () => void;

  /** Resume the game */
  resumeGame: () => void;

  /** Reset the game */
  resetGame: () => void;

  /** Manually connect to the server */
  connect: () => void;

  /** Manually disconnect from the server */
  disconnect: () => void;

  // v4.0: History modal sync
  /** Open history modal (syncs to other party) */
  openHistory: () => void;

  /** Close history modal (syncs to other party) */
  closeHistory: () => void;

  // v4.0: Sound preference sync
  /** Broadcast sound preference change to other party (local scope) */
  sendSoundPreference: (enabled: boolean) => void;

  /** (Controller only) Toggle sound on all devices */
  sendSoundPreferenceAll: (enabled: boolean) => void;
}

interface GameSyncState {
  /** Current connection status */
  connectionStatus: ConnectionStatus;

  /** Whether the socket is connected */
  isConnected: boolean;

  /** Current session state */
  session: GameSession | null;

  /** Any error that occurred */
  error: string | null;

  // v4.0: History modal sync
  /** Whether history modal is open (synced between Host/Controller) */
  isHistoryOpen: boolean;

  // v4.0: Sound preference sync
  /** Pending sound preference change from other party (null if none) */
  pendingSoundSync: { enabled: boolean; source: "host" | "controller" } | null;

  /** Clear the pending sound sync after handling */
  clearPendingSoundSync: () => void;
}

export type UseGameSyncReturn = GameSyncState & GameSyncActions;

// ============================================================================
// HELPER
// ============================================================================

function mapConnectionStatus(status: SocketConnectionStatus): ConnectionStatus {
  switch (status) {
    case "connected":
      return "connected";
    case "connecting":
      return "connecting";
    case "reconnecting":
      return "reconnecting";
    case "disconnected":
    default:
      return "disconnected";
  }
}

// ============================================================================
// HOST SYNC HOOK
// ============================================================================

/**
 * Hook for Host to sync game state with connected Controllers.
 *
 * The Host is the source of truth for game state.
 * It broadcasts state updates to all connected Controllers.
 *
 * @example
 * ```tsx
 * function HostPage() {
 *   const { session, drawCard, connectionStatus } = useHostSync({
 *     roomId: 'ABCD',
 *   });
 *
 *   return <HostDisplay session={session} onDrawCard={drawCard} />;
 * }
 * ```
 */
export function useHostSync(options: UseGameSyncOptions): UseGameSyncReturn {
  const { roomId, onConnectionChange, onError } = options;

  // Store state
  const session = useGameStore((state) => state.session);
  const drawCardStore = useGameStore((state) => state.drawCard);
  const pauseGameStore = useGameStore((state) => state.pauseGame);
  const resumeGameStore = useGameStore((state) => state.resumeGame);
  const resetSessionStore = useGameStore((state) => state.resetSession);
  const updateConnection = useGameStore((state) => state.updateConnection);
  const storeError = useGameStore((state) => state.error);
  const setError = useGameStore((state) => state.setError);

  // v4.0: History modal sync state
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // v4.0: Sound preference sync state
  const [pendingSoundSync, setPendingSoundSync] = useState<{
    enabled: boolean;
    source: "host" | "controller";
  } | null>(null);

  // WebSocket connection
  const socket = useGameSocket({
    roomId,
    role: "host",
  });

  const prevSessionRef = useRef<GameSession | null>(null);

  // Handle incoming messages from Controller
  useEffect(() => {
    const unsubscribe = socket.onMessage((message: WSMessage) => {
      switch (message.type) {
        case "CONTROLLER_CONNECTED":
          updateConnection(true, true, message.controllerId);
          break;

        case "CONTROLLER_DISCONNECTED":
          updateConnection(true, false, null);
          break;

        case "DRAW_CARD":
          drawCardStore();
          break;

        case "PAUSE_GAME":
          pauseGameStore();
          break;

        case "RESUME_GAME":
          resumeGameStore();
          break;

        case "RESET_GAME":
          resetSessionStore();
          break;

        // v4.0: History modal sync from Controller
        case "OPEN_HISTORY":
          setIsHistoryOpen(true);
          break;

        case "CLOSE_HISTORY":
          setIsHistoryOpen(false);
          break;

        // v4.0: Sound preference sync from Controller
        case "SOUND_PREFERENCE":
          if (message.source === "controller" && (message.scope === "both" || message.scope === "host_only")) {
            // Controller commands Host to change sound
            // Execute silently - Controller has precedence
            setPendingSoundSync({ enabled: message.enabled, source: "controller" });
          }
          // Note: scope: "local" from Controller is never relayed to Host
          break;
      }
    });

    return unsubscribe;
  }, [
    socket,
    drawCardStore,
    pauseGameStore,
    resumeGameStore,
    resetSessionStore,
    updateConnection,
  ]);

  // Broadcast state updates when session changes
  useEffect(() => {
    if (!session || socket.status !== "connected") return;

    // Only send if session actually changed
    if (prevSessionRef.current === session) return;
    prevSessionRef.current = session;

    // Create state update payload (matches StateUpdatePayload interface)
    const stateUpdate: StateUpdatePayload = {
      currentItem: session.currentItem,
      currentIndex: session.currentIndex,
      totalItems: session.totalItems,
      status: session.status,
      historyCount: session.history.length,
    };

    socket.sendStateUpdate(stateUpdate);
  }, [session, socket]);

  // Track connection changes
  useEffect(() => {
    const isConnected = socket.status === "connected";
    onConnectionChange?.(isConnected);
  }, [socket.status, onConnectionChange]);

  // Error handling
  useEffect(() => {
    if (socket.error) {
      const error = new Error(socket.error);
      setError(socket.error);
      onError?.(error);
    }
  }, [socket.error, setError, onError]);

  // Actions (Host performs directly, then broadcasts)
  const drawCard = useCallback(() => {
    drawCardStore();
  }, [drawCardStore]);

  const pauseGame = useCallback(() => {
    pauseGameStore();
  }, [pauseGameStore]);

  const resumeGame = useCallback(() => {
    resumeGameStore();
  }, [resumeGameStore]);

  const resetGame = useCallback(() => {
    resetSessionStore();
  }, [resetSessionStore]);

  // v4.0: History modal sync actions
  const openHistory = useCallback(() => {
    setIsHistoryOpen(true);
    socket.openHistory();
  }, [socket]);

  const closeHistory = useCallback(() => {
    setIsHistoryOpen(false);
    socket.closeHistory();
  }, [socket]);

  // v4.0: Sound preference sync actions
  // Host always sends with "local" scope - Controller decides whether to sync
  const sendSoundPreference = useCallback(
    (enabled: boolean) => {
      socket.sendSoundPreference(enabled, "host", "local");
    },
    [socket]
  );

  // Host doesn't have "both" functionality (Controller has precedence)
  const sendSoundPreferenceAll = useCallback(
    (_enabled: boolean) => {
      // No-op for Host - only Controller can command all devices
    },
    []
  );

  const clearPendingSoundSync = useCallback(() => {
    setPendingSoundSync(null);
  }, []);

  const connectionStatus = mapConnectionStatus(socket.status);

  return {
    session,
    connectionStatus,
    isConnected: socket.status === "connected",
    error: storeError,
    isHistoryOpen,
    pendingSoundSync,
    clearPendingSoundSync,
    drawCard,
    pauseGame,
    resumeGame,
    resetGame,
    openHistory,
    closeHistory,
    sendSoundPreference,
    sendSoundPreferenceAll,
    connect: socket.connect,
    disconnect: socket.disconnect,
  };
}

// ============================================================================
// CONTROLLER SYNC HOOK
// ============================================================================

/**
 * Hook for Controller to send commands and receive state updates.
 *
 * The Controller sends commands to the Host and receives state updates.
 * It does not modify local state directly - all changes come from Host.
 *
 * @example
 * ```tsx
 * function ControllerPage() {
 *   const { session, drawCard, connectionStatus } = useControllerSync({
 *     roomId: 'ABCD',
 *   });
 *
 *   return <RemoteController session={session} onDrawCard={drawCard} />;
 * }
 * ```
 */
export function useControllerSync(options: UseGameSyncOptions): UseGameSyncReturn {
  const { roomId, onConnectionChange, onError } = options;

  // Store state
  const session = useGameStore((state) => state.session);
  const loadSession = useGameStore((state) => state.loadSession);
  const storeError = useGameStore((state) => state.error);
  const setError = useGameStore((state) => state.setError);

  // v4.0: History modal sync state and data
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState<readonly import("@/lib/types/game").ItemDefinition[]>([]);

  // v4.0: Sound preference sync state
  const [pendingSoundSync, setPendingSoundSync] = useState<{
    enabled: boolean;
    source: "host" | "controller";
  } | null>(null);

  // WebSocket connection
  const socket = useGameSocket({
    roomId,
    role: "controller",
  });

  // Handle incoming state updates from Host
  useEffect(() => {
    const unsubscribe = socket.onMessage((message: WSMessage) => {
      if (message.type === "STATE_UPDATE" && session) {
        const { payload } = message;

        // Update local session with Host state
        loadSession({
          ...session,
          currentIndex: payload.currentIndex,
          currentItem: payload.currentItem,
          status: payload.status,
          totalItems: payload.totalItems,
        });

        // v4.0: Sync history modal state
        if (payload.isHistoryOpen !== undefined) {
          setIsHistoryOpen(payload.isHistoryOpen);
        }

        // v4.0: Store history data when modal is open
        if (payload.history) {
          setHistoryData(payload.history);
        }
      }

      // Handle full state sync (includes history)
      if (message.type === "FULL_STATE_SYNC" && session) {
        const { payload } = message;

        loadSession({
          ...session,
          currentIndex: payload.currentIndex,
          currentItem: payload.currentItem,
          status: payload.status,
          totalItems: payload.totalItems,
          history: payload.history,
        });

        // v4.0: Sync history data
        setHistoryData(payload.history);
      }

      // v4.0: History modal sync from Host
      if (message.type === "OPEN_HISTORY") {
        setIsHistoryOpen(true);
      }

      if (message.type === "CLOSE_HISTORY") {
        setIsHistoryOpen(false);
      }

      // v4.0: Sound preference sync from Host
      if (message.type === "SOUND_PREFERENCE" && message.source === "host") {
        setPendingSoundSync({ enabled: message.enabled, source: "host" });
      }
    });

    return unsubscribe;
  }, [socket, session, loadSession]);

  // Track connection changes
  useEffect(() => {
    const isConnected = socket.status === "connected";
    onConnectionChange?.(isConnected);
  }, [socket.status, onConnectionChange]);

  // Error handling
  useEffect(() => {
    if (socket.error) {
      const error = new Error(socket.error);
      setError(socket.error);
      onError?.(error);
    }
  }, [socket.error, setError, onError]);

  // Actions (Controller sends commands to Host)
  const drawCard = useCallback(() => {
    socket.drawCard();
  }, [socket]);

  const pauseGame = useCallback(() => {
    socket.pauseGame();
  }, [socket]);

  const resumeGame = useCallback(() => {
    socket.resumeGame();
  }, [socket]);

  const resetGame = useCallback(() => {
    socket.resetGame();
  }, [socket]);

  // v4.0: History modal sync actions
  const openHistory = useCallback(() => {
    setIsHistoryOpen(true);
    socket.openHistory();
  }, [socket]);

  const closeHistory = useCallback(() => {
    setIsHistoryOpen(false);
    socket.closeHistory();
  }, [socket]);

  // v4.0: Sound preference sync actions
  // Controller uses "local" scope for single-device change (not relayed)
  const sendSoundPreference = useCallback(
    (enabled: boolean) => {
      // Local scope: just change on Controller, no network message needed
      // (The server ignores scope: "local" from Controller anyway)
      socket.sendSoundPreference(enabled, "controller", "local");
    },
    [socket]
  );

  // Controller uses "both" scope to command both devices
  const sendSoundPreferenceAll = useCallback(
    (enabled: boolean) => {
      socket.sendSoundPreference(enabled, "controller", "both");
    },
    [socket]
  );

  const clearPendingSoundSync = useCallback(() => {
    setPendingSoundSync(null);
  }, []);

  const connectionStatus = mapConnectionStatus(socket.status);

  // v4.0: Extend session with history data for controller
  const sessionWithHistory = session
    ? { ...session, history: historyData.length > 0 ? historyData : session.history }
    : null;

  return {
    session: sessionWithHistory,
    connectionStatus,
    isConnected: socket.status === "connected",
    error: storeError,
    isHistoryOpen,
    pendingSoundSync,
    clearPendingSoundSync,
    drawCard,
    pauseGame,
    resumeGame,
    resetGame,
    openHistory,
    closeHistory,
    sendSoundPreference,
    sendSoundPreferenceAll,
    connect: socket.connect,
    disconnect: socket.disconnect,
  };
}

// ============================================================================
// COMBINED HOOK
// ============================================================================

interface UseGameSyncOptionsWithRole extends UseGameSyncOptions {
  /** Role: host or controller */
  role: "host" | "controller";
}

/**
 * Combined hook that handles both Host and Controller roles.
 *
 * @param options - Configuration including role
 * @returns State and actions appropriate for the role
 */
export function useGameSync(options: UseGameSyncOptionsWithRole): UseGameSyncReturn {
  const { role, ...rest } = options;

  // We have to use conditional logic here, but both hooks are always called
  // to satisfy React's rules of hooks
  const hostResult = useHostSync(rest);
  const controllerResult = useControllerSync(rest);

  return role === "host" ? hostResult : controllerResult;
}
