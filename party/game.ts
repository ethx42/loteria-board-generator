/**
 * Partykit Game Server
 *
 * WebSocket server for Tabula game sessions.
 * Handles room management, connection tracking, and event relay.
 *
 * @see SRD §7.5 Partykit Server
 * @see SRD §3.4 Realtime Protocol
 */

import type { Room, Connection, Server } from "partykit/server";
import { createDevLogger } from "../src/lib/utils/dev-logger";
import { isReactionEmoji, type ReactionEmoji } from "../src/lib/realtime/types";

// Scoped logger for GameRoom (only outputs in development)
const baseLog = createDevLogger("GameRoom");

// Helper to add timestamps to logs
function getTimestamp() {
  const now = new Date();
  return `${now.toLocaleTimeString()}.${now
    .getMilliseconds()
    .toString()
    .padStart(3, "0")}`;
}

// Wrap logger with timestamps
const log = {
  log: (roomId: string, msg: string, ...args: unknown[]) =>
    baseLog.log(`[${getTimestamp()}] [${roomId}] ${msg}`, ...args),
  info: (roomId: string, msg: string, ...args: unknown[]) =>
    baseLog.info(`[${getTimestamp()}] [${roomId}] ${msg}`, ...args),
  warn: (roomId: string, msg: string, ...args: unknown[]) =>
    baseLog.warn(`[${getTimestamp()}] [${roomId}] ${msg}`, ...args),
  error: (roomId: string, msg: string, ...args: unknown[]) =>
    baseLog.error(`[${getTimestamp()}] [${roomId}] ${msg}`, ...args),
  debug: (roomId: string, msg: string, ...args: unknown[]) =>
    baseLog.debug(`[${getTimestamp()}] [${roomId}] ${msg}`, ...args),
};

// ============================================================================
// TYPES
// ============================================================================

/**
 * Role of a connected client.
 * v4.0: Added "spectator" role.
 */
type ClientRole = "host" | "controller" | "spectator";

/**
 * Game state stored on server for reconnection sync.
 * v4.0: Extended to include currentItem and history for late-joining spectators.
 */
interface GameStateSnapshot {
  currentIndex: number;
  totalItems: number;
  status: "waiting" | "ready" | "playing" | "paused" | "finished";
  historyCount: number;
  /** v4.0: Whether history modal is open */
  isHistoryOpen?: boolean;
  /** v4.0: Current item for late-joining spectators */
  currentItem?: unknown;
  /** v4.0: History array for late-joining spectators */
  history?: unknown[];
}

/**
 * Rate limiting constants for reactions.
 * Client batches every 400ms, so we allow slightly faster rate limit.
 */
const REACTION_COOLDOWN_MS = 350; // 350ms per spectator (allows batched bursts)
const REACTION_BATCH_MS = 300; // Aggregate every 300ms for faster feedback

/**
 * Room state maintained by the server.
 * v4.0: Extended with spectator and reaction state.
 */
interface RoomState {
  /** Connection ID of the host (null if not connected) */
  hostId: string | null;
  /** Connection ID of the controller (null if not connected) */
  controllerId: string | null;
  /** Cached game state for sync on reconnection */
  gameState: GameStateSnapshot | null;
  /** Timestamp of room creation */
  createdAt: number;

  // ========================================
  // v4.0 Extensions
  // ========================================

  /** Connection IDs of spectators */
  spectatorIds: Set<string>;
  /** Whether history modal is currently open */
  isHistoryOpen: boolean;
  /** Buffer for aggregating reactions before broadcast */
  reactionBuffer: Map<ReactionEmoji, number>;
  /** Timestamp of last reaction broadcast */
  lastReactionBroadcast: number;
  /** Rate limiting: last reaction timestamp per spectator */
  reactionCooldowns: Map<string, number>;
}

// ============================================================================
// MESSAGE TYPES (Server-side, matching client types)
// ============================================================================

interface BaseMessage {
  type: string;
}

// Room Management
interface CreateRoomMessage extends BaseMessage {
  type: "CREATE_ROOM";
}

interface JoinRoomMessage extends BaseMessage {
  type: "JOIN_ROOM";
  roomId: string;
}

// Game Commands (from Controller)
interface DrawCardMessage extends BaseMessage {
  type: "DRAW_CARD";
}

interface PauseGameMessage extends BaseMessage {
  type: "PAUSE_GAME";
}

interface ResumeGameMessage extends BaseMessage {
  type: "RESUME_GAME";
}

interface ResetGameMessage extends BaseMessage {
  type: "RESET_GAME";
}

// State Updates (from Host)
// v4.0: Added history array for late-joining spectators
interface StateUpdateMessage extends BaseMessage {
  type: "STATE_UPDATE";
  payload: {
    currentItem: unknown;
    currentIndex: number;
    totalItems: number;
    status: string;
    historyCount: number;
    history?: unknown[];
  };
}

// Ping/Pong
interface PingMessage extends BaseMessage {
  type: "PING";
  timestamp: number;
}

// v4.0: History Modal Sync
interface OpenHistoryMessage extends BaseMessage {
  type: "OPEN_HISTORY";
}

interface CloseHistoryMessage extends BaseMessage {
  type: "CLOSE_HISTORY";
}

// v4.0: Spectator Reactions
interface SendReactionMessage extends BaseMessage {
  type: "SEND_REACTION";
  emoji: string;
  /** Number of reactions (for batched reactions from client) */
  count?: number;
}

// v4.0: Sound Preference Sync
interface SoundPreferenceMessage extends BaseMessage {
  type: "SOUND_PREFERENCE";
  enabled: boolean;
  source: "host" | "controller";
  scope: "local" | "host_only" | "both";
}

// v4.0: Sound Preference ACK (Host → Controller)
interface SoundPreferenceAckMessage extends BaseMessage {
  type: "SOUND_PREFERENCE_ACK";
  enabled: boolean;
  scope: "local" | "host_only" | "both";
}

type IncomingMessage =
  | CreateRoomMessage
  | JoinRoomMessage
  | DrawCardMessage
  | PauseGameMessage
  | ResumeGameMessage
  | ResetGameMessage
  | StateUpdateMessage
  | PingMessage
  // v4.0 messages
  | OpenHistoryMessage
  | CloseHistoryMessage
  | SendReactionMessage
  | SoundPreferenceMessage
  | SoundPreferenceAckMessage;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generates a 4-character session ID.
 * Uses alphanumeric characters excluding confusing ones (0, O, I, l).
 *
 * Note: Currently unused as room IDs are provided by the client or
 * generated via the URL routing. Kept for potential future use.
 */
function _generateSessionId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Export for testing
export { _generateSessionId as generateSessionId };

/**
 * Gets the role from connection URL query params.
 * v4.0: Added support for "spectator" role.
 */
function getClientRole(conn: Connection): ClientRole | null {
  try {
    const url = new URL(conn.uri, "http://localhost");
    const role = url.searchParams.get("role");
    if (role === "host" || role === "controller" || role === "spectator") {
      return role;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Safely parses JSON message.
 */
function parseMessage(data: string): IncomingMessage | null {
  try {
    const parsed = JSON.parse(data);
    if (parsed && typeof parsed.type === "string") {
      return parsed as IncomingMessage;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Sends a message to a specific connection.
 */
function send(conn: Connection | undefined, message: object): void {
  if (conn) {
    conn.send(JSON.stringify(message));
  }
}

/**
 * Broadcasts a message to all connections except the sender.
 */
function broadcastExcept(room: Room, message: object, exceptId?: string): void {
  const data = JSON.stringify(message);
  for (const conn of room.getConnections()) {
    if (conn.id !== exceptId) {
      conn.send(data);
    }
  }
}

// ============================================================================
// PARTYKIT SERVER
// ============================================================================

/**
 * GameRoom Server
 *
 * Manages a single game session room.
 * Each room has exactly one host, at most one controller, and multiple spectators.
 * v4.0: Added spectator support and reaction handling.
 */
export default class GameRoom implements Server {
  private state: RoomState = {
    hostId: null,
    controllerId: null,
    gameState: null,
    createdAt: Date.now(),
    // v4.0 extensions
    spectatorIds: new Set(),
    isHistoryOpen: false,
    reactionBuffer: new Map(),
    lastReactionBroadcast: 0,
    reactionCooldowns: new Map(),
  };

  /** Timer for batching reactions */
  private reactionTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(public room: Room) {}

  /**
   * Called when a client connects to the room.
   * v4.0: Added spectator handling.
   */
  onConnect(conn: Connection): void {
    const role = getClientRole(conn);

    log.info(
      this.room.id,
      `Connection attempt - role: ${role || "NONE"}, uri: ${conn.uri}`
    );

    if (!role) {
      log.warn(this.room.id, `Invalid role, closing connection`);
      send(conn, {
        type: "ERROR",
        code: "INVALID_ROLE",
        message:
          "Connection must specify role (host, controller, or spectator)",
      });
      conn.close(4000, "Invalid role");
      return;
    }

    switch (role) {
      case "host":
        this.handleHostConnect(conn);
        break;
      case "controller":
        this.handleControllerConnect(conn);
        break;
      case "spectator":
        this.handleSpectatorConnect(conn);
        break;
    }
  }

  /**
   * Called when a client disconnects.
   * v4.0: Added spectator disconnect handling.
   */
  onClose(conn: Connection): void {
    log.info(this.room.id, `Connection closed - id: ${conn.id}`);

    if (conn.id === this.state.hostId) {
      this.handleHostDisconnect();
    } else if (conn.id === this.state.controllerId) {
      this.handleControllerDisconnect();
    } else if (this.state.spectatorIds.has(conn.id)) {
      this.handleSpectatorDisconnect(conn.id);
    } else {
      log.debug(this.room.id, `Unknown connection closed: ${conn.id}`);
    }

    // Clean up resources when no connections remain
    this.cleanupIfEmpty();
  }

  /**
   * Cleans up resources when no active connections remain.
   * Prevents memory leaks from pending timers.
   */
  private cleanupIfEmpty(): void {
    const hasConnections =
      this.state.hostId !== null ||
      this.state.controllerId !== null ||
      this.state.spectatorIds.size > 0;

    if (!hasConnections) {
      // Clear reaction timer to prevent memory leak
      if (this.reactionTimer) {
        clearTimeout(this.reactionTimer);
        this.reactionTimer = null;
        log.debug(
          this.room.id,
          "Cleaned up reaction timer - no active connections"
        );
      }

      // Clear reaction buffer and cooldowns
      this.state.reactionBuffer.clear();
      this.state.reactionCooldowns.clear();
    }
  }

  /**
   * Called when a message is received from a client.
   */
  onMessage(message: string, sender: Connection): void {
    const msg = parseMessage(message);

    if (!msg) {
      send(sender, {
        type: "ERROR",
        code: "INVALID_MESSAGE",
        message: "Could not parse message",
      });
      return;
    }

    // Route message based on type
    switch (msg.type) {
      // Ping/Pong for connection health
      case "PING":
        send(sender, { type: "PONG", timestamp: msg.timestamp });
        break;

      // Game commands from Controller - forward to Host
      case "DRAW_CARD":
      case "PAUSE_GAME":
      case "RESUME_GAME":
      case "RESET_GAME":
        this.forwardToHost(msg, sender);
        break;

      // State updates from Host - forward to Controller (and spectators)
      case "STATE_UPDATE":
        this.handleStateUpdate(msg, sender);
        break;

      // v4.0: History modal sync (bidirectional)
      case "OPEN_HISTORY":
        this.handleOpenHistory(sender);
        break;

      case "CLOSE_HISTORY":
        this.handleCloseHistory(sender);
        break;

      // v4.0: Spectator reactions
      case "SEND_REACTION":
        this.handleReaction(msg as SendReactionMessage, sender);
        break;

      // v4.0: Sound preference sync (Host ↔ Controller only)
      case "SOUND_PREFERENCE":
        this.handleSoundPreference(msg as SoundPreferenceMessage, sender);
        break;

      // v4.0: Sound preference ACK (Host → Controller)
      case "SOUND_PREFERENCE_ACK":
        this.handleSoundPreferenceAck(msg as SoundPreferenceAckMessage, sender);
        break;

      default:
        // Unknown message type
        send(sender, {
          type: "ERROR",
          code: "UNKNOWN_MESSAGE_TYPE",
          message: `Unknown message type: ${msg.type}`,
        });
    }
  }

  // ==========================================================================
  // CONNECTION HANDLERS
  // ==========================================================================

  private handleHostConnect(conn: Connection): void {
    // Check if there's already a host
    if (this.state.hostId) {
      const existingHost = this.room.getConnection(this.state.hostId);
      if (existingHost) {
        // Another host is already connected
        send(conn, {
          type: "ERROR",
          code: "HOST_ALREADY_EXISTS",
          message: "Another host is already connected to this room",
        });
        conn.close(4001, "Host already exists");
        return;
      }
      // Previous host is gone, allow takeover
    }

    this.state.hostId = conn.id;

    // Confirm room creation
    send(conn, {
      type: "ROOM_CREATED",
      roomId: this.room.id,
    });

    // If controller is already connected, notify host
    if (this.state.controllerId) {
      send(conn, {
        type: "CONTROLLER_CONNECTED",
        controllerId: this.state.controllerId,
      });
    }

    log.info(this.room.id, `Host connected: ${conn.id}`);
  }

  private handleControllerConnect(conn: Connection): void {
    log.info(this.room.id, `Controller attempting to connect: ${conn.id}`);
    log.debug(
      this.room.id,
      `Current state - hostId: ${this.state.hostId}, controllerId: ${this.state.controllerId}`
    );

    // Check if there's already a controller
    if (this.state.controllerId) {
      const existingController = this.room.getConnection(
        this.state.controllerId
      );
      if (existingController) {
        log.warn(this.room.id, `Controller already connected, rejecting`);
        // Offer takeover option
        send(conn, {
          type: "ERROR",
          code: "CONTROLLER_ALREADY_CONNECTED",
          message: "Another controller is already connected",
        });
        // Don't close - let client decide to take over
        return;
      }
      // Previous controller is gone, allow new one
      log.info(this.room.id, `Previous controller gone, allowing new one`);
    }

    // Check if host exists
    if (!this.state.hostId) {
      log.warn(this.room.id, `No host found, rejecting controller`);
      send(conn, {
        type: "ERROR",
        code: "ROOM_NOT_FOUND",
        message: "No host found in this room",
      });
      conn.close(4004, "Room not found");
      return;
    }

    this.state.controllerId = conn.id;

    // Confirm join
    send(conn, { type: "ROOM_JOINED" });

    // Broadcast controller connected to all (including host)
    broadcastExcept(
      this.room,
      {
        type: "CONTROLLER_CONNECTED",
        controllerId: conn.id,
      },
      conn.id
    );

    // Send current game state to controller if available
    if (this.state.gameState) {
      send(conn, {
        type: "FULL_STATE_SYNC",
        payload: this.state.gameState,
      });
    }

    log.info(this.room.id, `Controller connected: ${conn.id}`);
  }

  private handleHostDisconnect(): void {
    log.error(this.room.id, `Host disconnected`);

    this.state.hostId = null;

    // Notify controller
    if (this.state.controllerId) {
      const controller = this.room.getConnection(this.state.controllerId);
      send(controller, { type: "HOST_DISCONNECTED" });
    }

    // Notify all spectators and close their connections
    const spectatorCount = this.state.spectatorIds.size;
    for (const spectatorId of this.state.spectatorIds) {
      const spectator = this.room.getConnection(spectatorId);
      if (spectator) {
        send(spectator, { type: "HOST_DISCONNECTED" });
        // Close connection with custom code so client knows not to reconnect
        spectator.close(4001, "Host disconnected");
      }
    }

    // Clear spectator list
    this.state.spectatorIds.clear();

    log.info(
      this.room.id,
      `Notified ${spectatorCount} spectators of host disconnect`
    );
  }

  private handleControllerDisconnect(): void {
    log.error(this.room.id, `Controller disconnected`);

    this.state.controllerId = null;

    // Broadcast to all (host will receive this)
    this.room.broadcast(JSON.stringify({ type: "CONTROLLER_DISCONNECTED" }));
  }

  // ==========================================================================
  // v4.0: SPECTATOR CONNECTION HANDLERS
  // ==========================================================================

  /**
   * Handles a spectator connecting to the room.
   */
  private handleSpectatorConnect(conn: Connection): void {
    // Check if host exists (spectators need an active game to watch)
    if (!this.state.hostId) {
      log.warn(this.room.id, `No host found, rejecting spectator`);
      send(conn, {
        type: "ERROR",
        code: "ROOM_NOT_FOUND",
        message: "No active game found in this room",
      });
      conn.close(4004, "Room not found");
      return;
    }

    // Add to spectators set
    this.state.spectatorIds.add(conn.id);

    // Confirm join with spectator role
    send(conn, { type: "ROOM_JOINED" });

    // Send current game state if available
    if (this.state.gameState) {
      send(conn, {
        type: "STATE_UPDATE",
        payload: this.state.gameState,
      });
    }

    // Broadcast updated spectator count
    this.broadcastSpectatorCount();

    log.info(
      this.room.id,
      `Spectator connected: ${conn.id} (total: ${this.state.spectatorIds.size})`
    );
  }

  /**
   * Handles a spectator disconnecting.
   */
  private handleSpectatorDisconnect(connId: string): void {
    this.state.spectatorIds.delete(connId);

    // Clean up reaction cooldown for this spectator
    this.state.reactionCooldowns.delete(connId);

    // Broadcast updated count
    this.broadcastSpectatorCount();

    log.info(
      this.room.id,
      `Spectator disconnected: ${connId} (remaining: ${this.state.spectatorIds.size})`
    );
  }

  /**
   * Broadcasts current spectator count to all clients.
   */
  private broadcastSpectatorCount(): void {
    this.room.broadcast(
      JSON.stringify({
        type: "SPECTATOR_COUNT",
        count: this.state.spectatorIds.size,
      })
    );
  }

  // ==========================================================================
  // MESSAGE HANDLERS
  // ==========================================================================

  /**
   * Forwards a command from Controller to Host.
   */
  private forwardToHost(msg: IncomingMessage, sender: Connection): void {
    // Verify sender is the controller
    if (sender.id !== this.state.controllerId) {
      send(sender, {
        type: "ERROR",
        code: "UNAUTHORIZED",
        message: "Only the controller can send game commands",
      });
      return;
    }

    // Verify host exists
    if (!this.state.hostId) {
      send(sender, {
        type: "ERROR",
        code: "HOST_NOT_CONNECTED",
        message: "Host is not connected",
      });
      return;
    }

    // Forward to host
    const host = this.room.getConnection(this.state.hostId);
    if (host) {
      host.send(JSON.stringify(msg));
    }
  }

  /**
   * Handles state update from Host.
   * v4.0: Also forwards to spectators.
   */
  private handleStateUpdate(msg: StateUpdateMessage, sender: Connection): void {
    // Verify sender is the host
    if (sender.id !== this.state.hostId) {
      send(sender, {
        type: "ERROR",
        code: "UNAUTHORIZED",
        message: "Only the host can send state updates",
      });
      return;
    }

    // Cache state for reconnection sync (including currentItem and history for late-joining spectators)
    this.state.gameState = {
      currentIndex: msg.payload.currentIndex,
      totalItems: msg.payload.totalItems,
      status: msg.payload.status as GameStateSnapshot["status"],
      historyCount: msg.payload.historyCount,
      isHistoryOpen: this.state.isHistoryOpen,
      currentItem: msg.payload.currentItem,
      history: msg.payload.history,
    };

    // Forward to controller
    if (this.state.controllerId) {
      const controller = this.room.getConnection(this.state.controllerId);
      if (controller) {
        controller.send(JSON.stringify(msg));
      }
    }

    // v4.0: Forward to spectators
    const msgStr = JSON.stringify(msg);
    for (const spectatorId of this.state.spectatorIds) {
      const spectator = this.room.getConnection(spectatorId);
      if (spectator) {
        spectator.send(msgStr);
      }
    }
  }

  // ==========================================================================
  // v4.0: HISTORY MODAL HANDLERS
  // ==========================================================================

  /**
   * Handles OPEN_HISTORY message.
   * Syncs history modal state between Host and Controller.
   */
  private handleOpenHistory(sender: Connection): void {
    // Only Host or Controller can open history
    if (
      sender.id !== this.state.hostId &&
      sender.id !== this.state.controllerId
    ) {
      return; // Silently ignore from spectators
    }

    this.state.isHistoryOpen = true;

    // Broadcast to the other party
    if (sender.id === this.state.hostId && this.state.controllerId) {
      const controller = this.room.getConnection(this.state.controllerId);
      send(controller, { type: "OPEN_HISTORY" });
    } else if (sender.id === this.state.controllerId && this.state.hostId) {
      const host = this.room.getConnection(this.state.hostId);
      send(host, { type: "OPEN_HISTORY" });
    }

    log.debug(
      this.room.id,
      `History modal opened by ${
        sender.id === this.state.hostId ? "host" : "controller"
      }`
    );
  }

  /**
   * Handles CLOSE_HISTORY message.
   * Syncs history modal state between Host and Controller.
   */
  private handleCloseHistory(sender: Connection): void {
    // Only Host or Controller can close history
    if (
      sender.id !== this.state.hostId &&
      sender.id !== this.state.controllerId
    ) {
      return; // Silently ignore from spectators
    }

    this.state.isHistoryOpen = false;

    // Broadcast to the other party
    if (sender.id === this.state.hostId && this.state.controllerId) {
      const controller = this.room.getConnection(this.state.controllerId);
      send(controller, { type: "CLOSE_HISTORY" });
    } else if (sender.id === this.state.controllerId && this.state.hostId) {
      const host = this.room.getConnection(this.state.hostId);
      send(host, { type: "CLOSE_HISTORY" });
    }

    log.debug(
      this.room.id,
      `History modal closed by ${
        sender.id === this.state.hostId ? "host" : "controller"
      }`
    );
  }

  // ==========================================================================
  // v4.0: REACTION HANDLERS
  // ==========================================================================

  /**
   * Handles SEND_REACTION from a spectator.
   * Implements rate limiting and batching.
   * Supports optional count field for batched reactions from client.
   */
  private handleReaction(msg: SendReactionMessage, sender: Connection): void {
    // Only spectators can send reactions
    if (!this.state.spectatorIds.has(sender.id)) {
      return; // Silently ignore from non-spectators
    }

    // Validate emoji
    if (!isReactionEmoji(msg.emoji)) {
      return; // Invalid emoji, silently ignore
    }

    // Rate limiting per spectator (allows batched count through)
    const now = Date.now();
    const lastReaction = this.state.reactionCooldowns.get(sender.id) ?? 0;
    if (now - lastReaction < REACTION_COOLDOWN_MS) {
      return; // Rate limited, silently ignore
    }
    this.state.reactionCooldowns.set(sender.id, now);

    // Get count from message (default to 1, max 10 per message for safety)
    const count = Math.min(Math.max(1, msg.count ?? 1), 10);

    // Add to buffer with count
    const currentCount =
      this.state.reactionBuffer.get(msg.emoji as ReactionEmoji) ?? 0;
    this.state.reactionBuffer.set(
      msg.emoji as ReactionEmoji,
      currentCount + count
    );

    log.debug(
      this.room.id,
      `Buffered ${count}x ${msg.emoji} from ${sender.id}`
    );

    // Schedule batch broadcast if not already scheduled
    if (!this.reactionTimer) {
      this.reactionTimer = setTimeout(() => {
        this.flushReactionBuffer();
      }, REACTION_BATCH_MS);
    }
  }

  /**
   * Broadcasts accumulated reactions to all clients.
   */
  private flushReactionBuffer(): void {
    this.reactionTimer = null;

    if (this.state.reactionBuffer.size === 0) return;

    // Build reactions array
    const reactions: { emoji: ReactionEmoji; count: number }[] = [];
    for (const [emoji, count] of this.state.reactionBuffer.entries()) {
      reactions.push({ emoji, count });
    }

    // Clear buffer
    this.state.reactionBuffer.clear();
    this.state.lastReactionBroadcast = Date.now();

    // Broadcast to all
    this.room.broadcast(
      JSON.stringify({
        type: "REACTION_BURST",
        reactions,
        timestamp: Date.now(),
      })
    );

    log.debug(
      this.room.id,
      `Broadcast reaction burst: ${JSON.stringify(reactions)}`
    );
  }

  // ==========================================================================
  // v4.0: SOUND PREFERENCE SYNC HANDLER
  // ==========================================================================

  /**
   * Handles SOUND_PREFERENCE message.
   * Relays sound preference changes between Host and Controller.
   * Spectators are excluded (they manage sound independently).
   *
   * ## Scope Behavior:
   *
   * ### Host sends (source: "host", scope: "local"):
   * - Controller receives, shows confirmation modal
   * - Controller decides to sync or not
   *
   * ### Controller sends (source: "controller"):
   * - scope: "local" → Not relayed (Controller-only change)
   * - scope: "host_only" → Host receives and executes (Controller unchanged)
   * - scope: "both" → Host receives and executes (Controller already changed)
   */
  private handleSoundPreference(
    msg: SoundPreferenceMessage,
    sender: Connection
  ): void {
    // Only Host or Controller can send sound preferences
    if (
      sender.id !== this.state.hostId &&
      sender.id !== this.state.controllerId
    ) {
      return; // Silently ignore from spectators
    }

    // Host sends to Controller (always relayed for optional sync)
    if (sender.id === this.state.hostId && this.state.controllerId) {
      const controller = this.room.getConnection(this.state.controllerId);
      send(controller, msg);
      log.debug(
        this.room.id,
        `Sound preference relayed to controller: enabled=${msg.enabled}`
      );
    }
    // Controller sends to Host
    else if (sender.id === this.state.controllerId && this.state.hostId) {
      // Relay if scope affects Host (host_only or both)
      if (msg.scope === "host_only" || msg.scope === "both") {
        const host = this.room.getConnection(this.state.hostId);
        send(host, msg);
        log.debug(
          this.room.id,
          `Sound preference command sent to host: enabled=${msg.enabled}, scope=${msg.scope}`
        );
      }
      // scope: "local" → No relay needed, Controller-only change
    }
  }

  /**
   * Handles SOUND_PREFERENCE_ACK message.
   * Relays ACK from Host to Controller so Controller knows Host's new state.
   *
   * @direction Host→Server→Controller
   */
  private handleSoundPreferenceAck(
    msg: SoundPreferenceAckMessage,
    sender: Connection
  ): void {
    log.log(
      this.room.id,
      `Received SOUND_PREFERENCE_ACK from Host: enabled=${msg.enabled}`
    );

    // Only Host can send ACK
    if (sender.id !== this.state.hostId) {
      log.warn(this.room.id, `ACK rejected - sender is not host`);
      return;
    }

    // Relay to Controller
    if (this.state.controllerId) {
      const controller = this.room.getConnection(this.state.controllerId);
      if (controller) {
        send(controller, msg);
        log.log(
          this.room.id,
          `ACK relayed to controller: enabled=${msg.enabled}`
        );
      } else {
        log.warn(
          this.room.id,
          `Cannot relay ACK - controller connection not found`
        );
      }
    } else {
      log.warn(this.room.id, `Cannot relay ACK - no controller connected`);
    }
  }
}

// ============================================================================
// SERVER OPTIONS
// ============================================================================

// Note: Partykit hibernation and other options are configured in partykit.json
// or via the Server.options property (see ServerOptions type)
