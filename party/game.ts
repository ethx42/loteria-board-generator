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

// ============================================================================
// TYPES
// ============================================================================

/**
 * Role of a connected client
 */
type ClientRole = "host" | "controller";

/**
 * Minimal game state stored on server for reconnection sync
 */
interface GameStateSnapshot {
  currentIndex: number;
  totalItems: number;
  status: "waiting" | "ready" | "playing" | "paused" | "finished";
  historyCount: number;
}

/**
 * Room state maintained by the server
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
interface StateUpdateMessage extends BaseMessage {
  type: "STATE_UPDATE";
  payload: {
    currentItem: unknown;
    currentIndex: number;
    totalItems: number;
    status: string;
    historyCount: number;
  };
}

// Ping/Pong
interface PingMessage extends BaseMessage {
  type: "PING";
  timestamp: number;
}

type IncomingMessage =
  | CreateRoomMessage
  | JoinRoomMessage
  | DrawCardMessage
  | PauseGameMessage
  | ResumeGameMessage
  | ResetGameMessage
  | StateUpdateMessage
  | PingMessage;

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
 */
function getClientRole(conn: Connection): ClientRole | null {
  try {
    const url = new URL(conn.uri, "http://localhost");
    const role = url.searchParams.get("role");
    if (role === "host" || role === "controller") {
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
function broadcastExcept(
  room: Room,
  message: object,
  exceptId?: string
): void {
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
 * Each room has exactly one host and at most one controller.
 */
export default class GameRoom implements Server {
  private state: RoomState = {
    hostId: null,
    controllerId: null,
    gameState: null,
    createdAt: Date.now(),
  };

  constructor(public room: Room) {}

  /**
   * Called when a client connects to the room.
   */
  onConnect(conn: Connection): void {
    const role = getClientRole(conn);

    if (!role) {
      send(conn, {
        type: "ERROR",
        code: "INVALID_ROLE",
        message: "Connection must specify role (host or controller)",
      });
      conn.close(4000, "Invalid role");
      return;
    }

    if (role === "host") {
      this.handleHostConnect(conn);
    } else {
      this.handleControllerConnect(conn);
    }
  }

  /**
   * Called when a client disconnects.
   */
  onClose(conn: Connection): void {
    if (conn.id === this.state.hostId) {
      this.handleHostDisconnect();
    } else if (conn.id === this.state.controllerId) {
      this.handleControllerDisconnect();
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

      // State updates from Host - forward to Controller
      case "STATE_UPDATE":
        this.handleStateUpdate(msg, sender);
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

    console.log(`[${this.room.id}] Host connected: ${conn.id}`);
  }

  private handleControllerConnect(conn: Connection): void {
    // Check if there's already a controller
    if (this.state.controllerId) {
      const existingController = this.room.getConnection(
        this.state.controllerId
      );
      if (existingController) {
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
    }

    // Check if host exists
    if (!this.state.hostId) {
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

    console.log(`[${this.room.id}] Controller connected: ${conn.id}`);
  }

  private handleHostDisconnect(): void {
    console.log(`[${this.room.id}] Host disconnected`);

    this.state.hostId = null;

    // Notify controller
    if (this.state.controllerId) {
      const controller = this.room.getConnection(this.state.controllerId);
      send(controller, { type: "HOST_DISCONNECTED" });
    }
  }

  private handleControllerDisconnect(): void {
    console.log(`[${this.room.id}] Controller disconnected`);

    this.state.controllerId = null;

    // Broadcast to all (host will receive this)
    this.room.broadcast(JSON.stringify({ type: "CONTROLLER_DISCONNECTED" }));
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

    // Cache state for reconnection sync
    this.state.gameState = {
      currentIndex: msg.payload.currentIndex,
      totalItems: msg.payload.totalItems,
      status: msg.payload.status as GameStateSnapshot["status"],
      historyCount: msg.payload.historyCount,
    };

    // Forward to controller
    if (this.state.controllerId) {
      const controller = this.room.getConnection(this.state.controllerId);
      if (controller) {
        controller.send(JSON.stringify(msg));
      }
    }
  }
}

// ============================================================================
// SERVER OPTIONS
// ============================================================================

// Note: Partykit hibernation and other options are configured in partykit.json
// or via the Server.options property (see ServerOptions type)
