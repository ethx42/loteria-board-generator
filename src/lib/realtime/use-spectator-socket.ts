/**
 * Spectator Socket Hook
 *
 * WebSocket connection for spectators to watch the game and send reactions.
 * Spectators receive STATE_UPDATE broadcasts but cannot control the game.
 *
 * @module lib/realtime/use-spectator-socket
 * @see SRD §6.3 Spectator Mode
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PartySocket from "partysocket";
import {
  type StateUpdatePayload,
  type ReactionEmoji,
  type ReactionBurstMessage,
  parseMessage,
  serializeMessage,
  sendReactionMessage,
  pingMessage,
  REACTION_EMOJIS,
} from "./types";
import { createDevLogger } from "@/lib/utils/dev-logger";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Connection status for spectator.
 */
export type SpectatorConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

/**
 * Game state visible to spectators.
 */
export interface SpectatorGameState {
  /** Currently displayed item (null before first draw) */
  readonly currentItem: StateUpdatePayload["currentItem"];
  /** Current index in the shuffled deck (-1 before first draw) */
  readonly currentIndex: number;
  /** Total number of items in the deck */
  readonly totalItems: number;
  /** Current game status */
  readonly status: StateUpdatePayload["status"];
  /** Number of cards in history */
  readonly historyCount: number;
  /** Full history (when available) */
  readonly history?: StateUpdatePayload["history"];
}

/**
 * Configuration for spectator socket.
 */
export interface SpectatorSocketConfig {
  /** Partykit host URL (defaults to localhost:1999 in dev) */
  host?: string;
  /** Room ID to spectate */
  roomId: string | null;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Return type for useSpectatorSocket hook.
 */
export interface UseSpectatorSocketReturn {
  /** Current connection status */
  connectionStatus: SpectatorConnectionStatus;
  /** Error message if connection failed */
  error: string | null;
  /** Current game state (null until received) */
  gameState: SpectatorGameState | null;
  /** Number of spectators connected */
  spectatorCount: number;
  /** Latest reaction burst (clears after processing) */
  reactions: ReactionBurstMessage["reactions"];
  /** Send a reaction emoji (with optional count for batched reactions) */
  sendReaction: (emoji: ReactionEmoji, count?: number) => void;
  /** Connect to the room */
  connect: () => void;
  /** Disconnect from the room */
  disconnect: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Partykit port for development */
const PARTYKIT_DEV_PORT = "1999";

/** Ping interval for connection health (ms) */
const PING_INTERVAL = 30000;

/** Client-side rate limit for reactions (ms) - matches server */
const REACTION_COOLDOWN_MS = 350;

/** Reconnection config */
const RECONNECT_CONFIG = {
  maxRetries: 10,
  minDelay: 1000,
  maxDelay: 10000,
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Gets the Partykit host URL.
 */
function getPartyHost(configHost?: string): string {
  if (configHost) return configHost;

  if (
    typeof process !== "undefined" &&
    process.env?.NEXT_PUBLIC_PARTYKIT_HOST
  ) {
    return process.env.NEXT_PUBLIC_PARTYKIT_HOST;
  }

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    return `${hostname}:${PARTYKIT_DEV_PORT}`;
  }

  return `localhost:${PARTYKIT_DEV_PORT}`;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * React hook for spectator socket connection.
 *
 * Spectators can:
 * - Watch the game in real-time (receive STATE_UPDATE)
 * - Send emoji reactions (rate-limited to 1/second)
 * - See spectator count
 *
 * Spectators cannot:
 * - Send game commands (DRAW_CARD, PAUSE, etc.)
 * - Open/close history modal
 *
 * @example
 * ```tsx
 * const { connectionStatus, gameState, sendReaction, reactions } =
 *   useSpectatorSocket({ roomId: "ABCD" });
 *
 * // Display current card
 * <CurrentCard item={gameState?.currentItem} />
 *
 * // Send reaction
 * <button onClick={() => sendReaction("👏")}>👏</button>
 * ```
 */
export function useSpectatorSocket(
  config: SpectatorSocketConfig
): UseSpectatorSocketReturn {
  // State
  const [connectionStatus, setConnectionStatus] =
    useState<SpectatorConnectionStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<SpectatorGameState | null>(null);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [reactions, setReactions] = useState<ReactionBurstMessage["reactions"]>(
    []
  );

  // Refs
  const socketRef = useRef<PartySocket | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastReactionRef = useRef<number>(0);
  const configRef = useRef(config);

  // Keep config ref in sync (effect runs after render)
  useEffect(() => {
    configRef.current = config;
  });

  // Logger
  const logger = useMemo(() => createDevLogger("SpectatorSocket"), []);

  const log = useCallback(
    (message: string, ...args: unknown[]) => {
      if (configRef.current.debug) {
        logger.debug(message, ...args);
      }
    },
    [logger]
  );

  // ==========================================================================
  // MESSAGE HANDLING
  // ==========================================================================

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      const message = parseMessage(event.data);

      if (!message) {
        log("Failed to parse message:", event.data);
        return;
      }

      log("Received:", message.type);

      switch (message.type) {
        case "ROOM_JOINED":
          setConnectionStatus("connected");
          setError(null);
          break;

        case "ERROR":
          if (message.code === "ROOM_NOT_FOUND") {
            setConnectionStatus("error");
            setError("Game not found. Check the room code.");
            socketRef.current?.close();
          } else {
            setError(message.message);
          }
          break;

        case "STATE_UPDATE":
        case "FULL_STATE_SYNC":
          setGameState({
            currentItem: message.payload.currentItem,
            currentIndex: message.payload.currentIndex,
            totalItems: message.payload.totalItems,
            status: message.payload.status,
            historyCount: message.payload.historyCount,
            history: message.payload.history,
          });
          break;

        case "SPECTATOR_COUNT":
          setSpectatorCount(message.count);
          break;

        case "REACTION_BURST":
          setReactions(message.reactions);
          // Clear reactions after a short delay to allow animation
          setTimeout(() => setReactions([]), 100);
          break;

        case "HOST_DISCONNECTED":
          setConnectionStatus("error");
          setError("The game has ended.");
          break;

        case "PONG":
          // Connection alive
          break;
      }
    },
    [log]
  );

  // ==========================================================================
  // CONNECTION MANAGEMENT
  // ==========================================================================

  const startPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }

    pingIntervalRef.current = setInterval(() => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(serializeMessage(pingMessage()));
      }
    }, PING_INTERVAL);
  }, []);

  const stopPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    const { roomId, host } = configRef.current;

    if (!roomId) {
      setError("No room code provided");
      return;
    }

    logger.info(`Connecting as spectator to room: ${roomId}`);

    // Close existing socket
    if (socketRef.current) {
      socketRef.current.close(1000, "Reconnecting");
      socketRef.current = null;
    }

    const partyHost = getPartyHost(host);

    setConnectionStatus("connecting");
    setError(null);

    const socket = new PartySocket({
      host: partyHost,
      room: roomId,
      party: "game",
      query: { role: "spectator" },
      maxRetries: RECONNECT_CONFIG.maxRetries,
      minReconnectionDelay: RECONNECT_CONFIG.minDelay,
      maxReconnectionDelay: RECONNECT_CONFIG.maxDelay,
    });

    socket.addEventListener("open", () => {
      logger.info(`Connected to room: ${roomId}`);
      setConnectionStatus("connected");
      startPingInterval();
    });

    socket.addEventListener("close", (event) => {
      log("Disconnected:", event.code, event.reason);
      stopPingInterval();

      if (event.code !== 1000) {
        setConnectionStatus("reconnecting");
      } else {
        setConnectionStatus("disconnected");
        setGameState(null);
      }
    });

    socket.addEventListener("error", () => {
      logger.error("WebSocket error");
      setError("Connection error. Please try again.");
    });

    socket.addEventListener("message", handleMessage);

    socketRef.current = socket;
  }, [handleMessage, log, logger, startPingInterval, stopPingInterval]);

  const disconnect = useCallback(() => {
    log("Disconnecting");
    stopPingInterval();

    if (socketRef.current) {
      socketRef.current.close(1000, "Client disconnect");
      socketRef.current = null;
    }

    setConnectionStatus("disconnected");
    setError(null);
    setGameState(null);
    setSpectatorCount(0);
  }, [log, stopPingInterval]);

  // ==========================================================================
  // REACTION SENDING
  // ==========================================================================

  const sendReaction = useCallback(
    (emoji: ReactionEmoji, count: number = 1) => {
      if (socketRef.current?.readyState !== WebSocket.OPEN) {
        log("Cannot send reaction, not connected");
        return;
      }

      // Validate emoji
      if (!REACTION_EMOJIS.includes(emoji)) {
        log("Invalid emoji:", emoji);
        return;
      }

      // Validate count
      const safeCount = Math.min(Math.max(1, Math.floor(count)), 10); // Max 10 per message

      // Client-side rate limiting (but allow batched sends)
      const now = Date.now();
      if (now - lastReactionRef.current < REACTION_COOLDOWN_MS) {
        log("Rate limited");
        return;
      }

      lastReactionRef.current = now;
      log("Sending reaction:", emoji, "count:", safeCount);
      socketRef.current.send(
        serializeMessage(sendReactionMessage(emoji, safeCount))
      );
    },
    [log]
  );

  // ==========================================================================
  // AUTO-CONNECT ON ROOMID CHANGE
  // ==========================================================================

  // Auto-connect when roomId is provided
  // Uses queueMicrotask to defer connection and avoid synchronous setState in effect
  useEffect(() => {
    if (config.roomId) {
      queueMicrotask(() => {
        connect();
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.close(1000, "Cleanup");
        socketRef.current = null;
      }
      stopPingInterval();
    };
  }, [config.roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return useMemo(
    () => ({
      connectionStatus,
      error,
      gameState,
      spectatorCount,
      reactions,
      sendReaction,
      connect,
      disconnect,
    }),
    [
      connectionStatus,
      error,
      gameState,
      spectatorCount,
      reactions,
      sendReaction,
      connect,
      disconnect,
    ]
  );
}
