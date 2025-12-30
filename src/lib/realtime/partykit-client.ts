/**
 * Partykit Client
 *
 * React hook for WebSocket communication with the Partykit game server.
 * Provides connection management, auto-reconnection, and type-safe messaging.
 *
 * @module lib/realtime/partykit-client
 * @see SRD §7.5 Partykit Server
 * @see SRD §3.4 Realtime Protocol
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PartySocket from "partysocket";
import {
  type WSMessage,
  type StateUpdatePayload,
  type ControllerMessage,
  type HostMessage,
  parseMessage,
  serializeMessage,
  drawCardMessage,
  pauseGameMessage,
  resumeGameMessage,
  resetGameMessage,
  flipCardMessage,
  stateUpdateMessage,
  pingMessage,
  openHistoryMessage,
  closeHistoryMessage,
  toggleDetailedMessage,
  soundPreferenceMessage,
} from "./types";
import { createDevLogger } from "@/lib/utils/dev-logger";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Role of the client connecting to the game room.
 */
export type ClientRole = "host" | "controller";

/**
 * Connection status states.
 */
export type ConnectionStatus =
  | "disconnected" // Not connected
  | "connecting" // Attempting to connect
  | "connected" // Successfully connected
  | "reconnecting"; // Lost connection, attempting to reconnect

/**
 * Configuration for the game socket connection.
 */
export interface GameSocketConfig {
  /** Partykit host URL (defaults to localhost:1999 in dev) */
  host?: string;
  /** Room ID (session code) to connect to */
  roomId: string;
  /** Role of this client */
  role: ClientRole;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * State exposed by the useGameSocket hook.
 */
export interface GameSocketState {
  /** Current connection status */
  status: ConnectionStatus;
  /** Error message if connection failed */
  error: string | null;
  /** Room ID once connected */
  roomId: string | null;
  /** Whether a controller is connected (host only) */
  controllerConnected: boolean;
  /** Whether the host is connected (controller only) */
  hostConnected: boolean;
  /** Latest state update from host (controller only) */
  lastStateUpdate: StateUpdatePayload | null;
}

/**
 * Actions available from the useGameSocket hook.
 */
export interface GameSocketActions {
  /** Connect to the game room */
  connect: () => void;
  /** Disconnect from the game room */
  disconnect: () => void;

  // Controller actions
  /** Send DRAW_CARD command (controller only) */
  drawCard: () => void;
  /** Send PAUSE_GAME command (controller only) */
  pauseGame: () => void;
  /** Send RESUME_GAME command (controller only) */
  resumeGame: () => void;
  /** Send RESET_GAME command (controller only) */
  resetGame: () => void;
  /** Send FLIP_CARD command to sync card flip state (controller only) */
  flipCard: (isFlipped: boolean) => void;

  // Host actions
  /** Send state update to controller (host only) */
  sendStateUpdate: (payload: StateUpdatePayload) => void;

  // v4.0: History modal sync (bidirectional)
  /** Open history modal on all connected clients */
  openHistory: () => void;
  /** Close history modal on all connected clients */
  closeHistory: () => void;

  // v4.0: Detailed text toggle (bidirectional)
  /** Toggle detailed text accordion on all connected clients */
  toggleDetailed: (isExpanded: boolean) => void;

  // v4.0: Sound preference sync
  /** Broadcast sound preference change to other party */
  sendSoundPreference: (
    enabled: boolean,
    source: "host" | "controller",
    scope?: "local" | "host_only" | "both"
  ) => void;

  /** Send ACK confirming sound preference was applied (Host only) */
  sendSoundPreferenceAck?: (enabled: boolean, scope: "local" | "host_only" | "both") => void;
}

/**
 * Message handler callback type.
 */
export type MessageHandler = (message: WSMessage) => void;

/**
 * Complete hook return type.
 */
export type UseGameSocketReturn = GameSocketState &
  GameSocketActions & {
    /** Subscribe to incoming messages */
    onMessage: (handler: MessageHandler) => () => void;
  };

// ============================================================================
// CONSTANTS
// ============================================================================

/** Partykit port for development */
const PARTYKIT_DEV_PORT = "1999";

/** Ping interval for connection health (ms) */
const PING_INTERVAL = 30000;

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
 * In development, uses the same hostname as the current page (so mobile works).
 * In production, this should be your deployed Partykit URL.
 */
function getPartyHost(configHost?: string): string {
  if (configHost) return configHost;

  // Check for environment variable
  if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_PARTYKIT_HOST) {
    return process.env.NEXT_PUBLIC_PARTYKIT_HOST;
  }

  // In the browser, use the same hostname as the current page
  // This allows mobile devices on the same network to connect
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    return `${hostname}:${PARTYKIT_DEV_PORT}`;
  }

  // Fallback for SSR or non-browser environments
  return `localhost:${PARTYKIT_DEV_PORT}`;
}

/**
 * Generates a 4-character session ID.
 * Uses alphanumeric characters excluding confusing ones (0, O, I, l).
 */
export function generateSessionId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * React hook for game socket connection.
 *
 * @example
 * ```tsx
 * // Host usage
 * const socket = useGameSocket({
 *   roomId: "ABCD",
 *   role: "host",
 * });
 *
 * useEffect(() => {
 *   socket.connect();
 *   return () => socket.disconnect();
 * }, []);
 *
 * // Listen for controller commands
 * socket.onMessage((msg) => {
 *   if (msg.type === "DRAW_CARD") {
 *     // Handle draw card
 *   }
 * });
 * ```
 *
 * @example
 * ```tsx
 * // Controller usage
 * const socket = useGameSocket({
 *   roomId: sessionCode,
 *   role: "controller",
 * });
 *
 * socket.connect();
 *
 * // Send commands
 * <button onClick={socket.drawCard}>Draw Card</button>
 * ```
 */
export function useGameSocket(config: GameSocketConfig): UseGameSocketReturn {
  // State
  const [state, setState] = useState<GameSocketState>({
    status: "disconnected",
    error: null,
    roomId: null,
    controllerConnected: false,
    hostConnected: false,
    lastStateUpdate: null,
  });

  // Refs
  const socketRef = useRef<PartySocket | null>(null);
  const handlersRef = useRef<Set<MessageHandler>>(new Set());
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const configRef = useRef(config);

  // CRITICAL: Update config ref synchronously during render, not in useEffect
  // This ensures connect() always uses the current roomId, not a stale one
  configRef.current = config;

  // Create scoped dev logger (only outputs in development)
  // Memoized to prevent recreating on every render
  const logger = useMemo(
    () => createDevLogger(`GameSocket:${config.role}`),
    [config.role]
  );

  // Debug logger - uses dev-only logging
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

      // Handle internal messages
      switch (message.type) {
        case "ROOM_CREATED":
          setState((s) => ({
            ...s,
            status: "connected",
            roomId: message.roomId,
            error: null,
          }));
          break;

        case "ROOM_JOINED":
          setState((s) => ({
            ...s,
            status: "connected",
            hostConnected: true,
            error: null,
          }));
          break;

        case "ROOM_NOT_FOUND":
          setState((s) => ({
            ...s,
            status: "disconnected",
            error: `Room "${message.roomId}" not found`,
          }));
          socketRef.current?.close();
          break;

        case "CONTROLLER_CONNECTED":
          setState((s) => ({
            ...s,
            controllerConnected: true,
          }));
          break;

        case "CONTROLLER_DISCONNECTED":
          setState((s) => ({
            ...s,
            controllerConnected: false,
          }));
          break;

        case "HOST_DISCONNECTED":
          setState((s) => ({
            ...s,
            hostConnected: false,
            error: "Host disconnected",
          }));
          break;

        case "STATE_UPDATE":
        case "FULL_STATE_SYNC":
          setState((s) => ({
            ...s,
            lastStateUpdate: message.payload,
          }));
          break;

        case "ERROR":
          setState((s) => ({
            ...s,
            error: message.message,
          }));
          break;

        case "PONG":
          // Connection is alive, nothing to do
          break;
      }

      // Notify all handlers
      for (const handler of handlersRef.current) {
        try {
          handler(message);
        } catch (err) {
          logger.error("Message handler error", err);
        }
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
    const { roomId, role, host } = configRef.current;
    
    logger.info(`>>> CONNECT CALLED for room: ${roomId}, role: ${role}`);

    // Close any existing socket and stop its auto-reconnection
    if (socketRef.current) {
      logger.warn(`>>> Closing EXISTING socket (was connected to: ${socketRef.current.room})`);
      // Use code 1000 to indicate clean close and prevent auto-reconnection
      socketRef.current.close(1000, "Switching rooms");
      socketRef.current = null;
    }

    const partyHost = getPartyHost(host);
    
    logger.info(`>>> Creating NEW socket for room: ${roomId}, host: ${partyHost}`);

    setState((s) => ({
      ...s,
      status: "connecting",
      error: null,
    }));

    const socket = new PartySocket({
      host: partyHost,
      room: roomId,
      party: "game",
      query: { role },
      maxRetries: RECONNECT_CONFIG.maxRetries,
      minReconnectionDelay: RECONNECT_CONFIG.minDelay,
      maxReconnectionDelay: RECONNECT_CONFIG.maxDelay,
    });

    socket.addEventListener("open", () => {
      logger.info(`>>> WebSocket OPENED - URL: ${socket.url}`);
      setState((s) => ({
        ...s,
        status: "connected",
        roomId,
      }));
      startPingInterval();
    });

    socket.addEventListener("close", (event) => {
      log("Disconnected:", event.code, event.reason);
      stopPingInterval();

      // PartySocket handles reconnection automatically
      if (event.code !== 1000) {
        // Abnormal close
        setState((s) => ({
          ...s,
          status: "reconnecting",
        }));
      } else {
        setState((s) => ({
          ...s,
          status: "disconnected",
          controllerConnected: false,
          hostConnected: false,
        }));
      }
    });

    socket.addEventListener("error", (error) => {
      // Try to get more details about the error
      const errorDetails = {
        type: (error as Event).type,
        url: socket.url,
        readyState: socket.readyState,
        message: (error as ErrorEvent).message || "No message",
      };
      logger.error(`WebSocket error - URL: ${socket.url}, readyState: ${socket.readyState}`, errorDetails);
      setState((s) => ({
        ...s,
        error: "Connection error",
      }));
    });

    socket.addEventListener("message", handleMessage);

    socketRef.current = socket;
  }, [handleMessage, log, startPingInterval, stopPingInterval]);

  const disconnect = useCallback(() => {
    log("Disconnecting");
    stopPingInterval();

    if (socketRef.current) {
      socketRef.current.close(1000, "Client disconnect");
      socketRef.current = null;
    }

    setState({
      status: "disconnected",
      error: null,
      roomId: null,
      controllerConnected: false,
      hostConnected: false,
      lastStateUpdate: null,
    });
  }, [log, stopPingInterval]);

  // Close socket when roomId changes (prevents stale connections trying to reconnect to old room)
  const previousRoomIdRef = useRef(config.roomId);
  useEffect(() => {
    logger.debug(`>>> RoomId effect - prev: ${previousRoomIdRef.current}, current: ${config.roomId}`);
    if (previousRoomIdRef.current !== config.roomId) {
      logger.warn(`>>> ROOM CHANGED from ${previousRoomIdRef.current} to ${config.roomId} - closing socket`);
      if (socketRef.current) {
        logger.warn(`>>> Closing socket due to room change`);
        socketRef.current.close(1000, "Room changed");
        socketRef.current = null;
      }
      previousRoomIdRef.current = config.roomId;
    }
  }, [config.roomId, logger]);

  // Cleanup on unmount
  useEffect(() => {
    logger.debug(">>> Socket hook MOUNTED");
    return () => {
      logger.warn(`>>> Socket hook CLEANUP - socketRef exists: ${!!socketRef.current}`);
      stopPingInterval();
      if (socketRef.current) {
        logger.warn(`>>> CLOSING socket in cleanup (room: ${socketRef.current.room})`);
        socketRef.current.close(1000, "Component unmount");
        socketRef.current = null;
      }
    };
  }, [stopPingInterval, logger]);

  // ==========================================================================
  // COMMAND SENDERS (Controller)
  // ==========================================================================

  const sendCommand = useCallback(
    (msg: ControllerMessage) => {
      if (socketRef.current?.readyState !== WebSocket.OPEN) {
        log("Cannot send, not connected");
        return;
      }
      log("Sending:", msg.type);
      socketRef.current.send(serializeMessage(msg));
    },
    [log]
  );

  const drawCard = useCallback(() => {
    sendCommand(drawCardMessage());
  }, [sendCommand]);

  const pauseGame = useCallback(() => {
    sendCommand(pauseGameMessage());
  }, [sendCommand]);

  const resumeGame = useCallback(() => {
    sendCommand(resumeGameMessage());
  }, [sendCommand]);

  const resetGame = useCallback(() => {
    sendCommand(resetGameMessage());
  }, [sendCommand]);

  const flipCard = useCallback((isFlipped: boolean) => {
    sendCommand(flipCardMessage(isFlipped));
  }, [sendCommand]);

  // ==========================================================================
  // STATE SENDER (Host)
  // ==========================================================================

  const sendHostMessage = useCallback(
    (msg: HostMessage) => {
      if (socketRef.current?.readyState !== WebSocket.OPEN) {
        log("Cannot send, not connected");
        return;
      }
      log("Sending:", msg.type);
      socketRef.current.send(serializeMessage(msg));
    },
    [log]
  );

  const sendStateUpdate = useCallback(
    (payload: StateUpdatePayload) => {
      sendHostMessage(stateUpdateMessage(payload));
    },
    [sendHostMessage]
  );

  // ==========================================================================
  // v4.0: HISTORY MODAL SYNC (Bidirectional)
  // ==========================================================================

  const openHistory = useCallback(() => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      log("Cannot send, not connected");
      return;
    }
    log("Sending: OPEN_HISTORY");
    socketRef.current.send(serializeMessage(openHistoryMessage()));
  }, [log]);

  const closeHistory = useCallback(() => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      log("Cannot send, not connected");
      return;
    }
    log("Sending: CLOSE_HISTORY");
    socketRef.current.send(serializeMessage(closeHistoryMessage()));
  }, [log]);

  // ==========================================================================
  // v4.0: DETAILED TEXT TOGGLE SYNC
  // ==========================================================================

  const toggleDetailed = useCallback(
    (isExpanded: boolean) => {
      if (socketRef.current?.readyState !== WebSocket.OPEN) {
        log("Cannot send, not connected");
        return;
      }
      log("Sending: TOGGLE_DETAILED", isExpanded);
      socketRef.current.send(
        serializeMessage(toggleDetailedMessage(isExpanded))
      );
    },
    [log]
  );

  // ==========================================================================
  // v4.0: SOUND PREFERENCE SYNC
  // ==========================================================================

  const sendSoundPreference = useCallback(
    (
      enabled: boolean,
      source: "host" | "controller",
      scope: "local" | "host_only" | "both" = "local"
    ) => {
      if (socketRef.current?.readyState !== WebSocket.OPEN) {
        log("Cannot send, not connected");
        return;
      }
      log(
        `Sending: SOUND_PREFERENCE (enabled: ${enabled}, source: ${source}, scope: ${scope})`
      );
      socketRef.current.send(
        serializeMessage(soundPreferenceMessage(enabled, source, scope))
      );
    },
    [log]
  );

  const sendSoundPreferenceAck = useCallback(
    (enabled: boolean, scope: "local" | "host_only" | "both") => {
      log(`sendSoundPreferenceAck called (enabled: ${enabled}, scope: ${scope}, readyState: ${socketRef.current?.readyState})`);
      if (socketRef.current?.readyState !== WebSocket.OPEN) {
        log("Cannot send ACK, not connected");
        return;
      }
      log(`Sending: SOUND_PREFERENCE_ACK (enabled: ${enabled}, scope: ${scope})`);
      socketRef.current.send(
        serializeMessage({ type: "SOUND_PREFERENCE_ACK", enabled, scope })
      );
    },
    [log]
  );

  // ==========================================================================
  // MESSAGE SUBSCRIPTION
  // ==========================================================================

  const onMessage = useCallback((handler: MessageHandler) => {
    handlersRef.current.add(handler);

    // Return unsubscribe function
    return () => {
      handlersRef.current.delete(handler);
    };
  }, []);

  // ==========================================================================
  // RETURN (Memoized to prevent unnecessary re-renders)
  // ==========================================================================

  // Memoize the return object to maintain referential equality
  // This prevents useEffects with [socket] as dependency from re-running
  // when unrelated state changes occur
  return useMemo(
    () => ({
      // State
      ...state,

      // Actions
      connect,
      disconnect,

      // Controller commands
      drawCard,
      pauseGame,
      resumeGame,
      resetGame,
      flipCard,

      // Host commands
      sendStateUpdate,

      // v4.0: History modal sync (bidirectional)
      openHistory,
      closeHistory,

      // v4.0: Detailed text toggle (bidirectional)
      toggleDetailed,

      // v4.0: Sound preference sync
      sendSoundPreference,
      sendSoundPreferenceAck,

      // Message subscription
      onMessage,
    }),
    [
      state,
      connect,
      disconnect,
      drawCard,
      pauseGame,
      resumeGame,
      resetGame,
      flipCard,
      sendStateUpdate,
      openHistory,
      closeHistory,
      toggleDetailed,
      sendSoundPreference,
      sendSoundPreferenceAck,
      onMessage,
    ]
  );
}

// ============================================================================
// CONVENIENCE HOOKS
// ============================================================================

/**
 * Hook for host-specific socket usage.
 * Creates a new room and waits for controller.
 */
export function useHostSocket(config: Omit<GameSocketConfig, "role">) {
  return useGameSocket({ ...config, role: "host" });
}

/**
 * Hook for controller-specific socket usage.
 * Joins an existing room.
 */
export function useControllerSocket(config: Omit<GameSocketConfig, "role">) {
  return useGameSocket({ ...config, role: "controller" });
}

