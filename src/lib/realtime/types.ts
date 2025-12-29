/**
 * Realtime Protocol Types
 *
 * WebSocket message types for Host-Controller communication via Partykit.
 * Implements a discriminated union pattern for type-safe message handling.
 *
 * Message Direction Legend:
 * - C→S: Client to Server (Partykit)
 * - S→C: Server to Client
 * - S→A: Server to All (broadcast)
 *
 * @module lib/realtime/types
 * @see SRD §3.4 Realtime Protocol
 */

import type { GameStatus, ItemDefinition } from "../types/game";

// ============================================================================
// ROOM MANAGEMENT MESSAGES
// ============================================================================

/**
 * Host requests creation of a new game room.
 * @direction C→S (Host only)
 */
export interface CreateRoomMessage {
  readonly type: "CREATE_ROOM";
}

/**
 * Server confirms room creation with assigned ID.
 * @direction S→C (to Host)
 */
export interface RoomCreatedMessage {
  readonly type: "ROOM_CREATED";
  readonly roomId: string;
}

/**
 * Controller requests to join an existing room.
 * @direction C→S (Controller only)
 */
export interface JoinRoomMessage {
  readonly type: "JOIN_ROOM";
  readonly roomId: string;
}

/**
 * Server confirms successful room join.
 * @direction S→C (to Controller)
 */
export interface RoomJoinedMessage {
  readonly type: "ROOM_JOINED";
}

/**
 * Server rejects room join attempt.
 * @direction S→C (to Controller)
 */
export interface RoomNotFoundMessage {
  readonly type: "ROOM_NOT_FOUND";
  readonly roomId: string;
}

// ============================================================================
// CONNECTION EVENT MESSAGES
// ============================================================================

/**
 * Notifies all clients that a controller has connected.
 * @direction S→A (broadcast)
 */
export interface ControllerConnectedMessage {
  readonly type: "CONTROLLER_CONNECTED";
  readonly controllerId: string;
}

/**
 * Notifies all clients that the controller has disconnected.
 * @direction S→A (broadcast)
 */
export interface ControllerDisconnectedMessage {
  readonly type: "CONTROLLER_DISCONNECTED";
}

/**
 * Notifies controller that the host has disconnected.
 * @direction S→C (to Controller)
 */
export interface HostDisconnectedMessage {
  readonly type: "HOST_DISCONNECTED";
}

/**
 * Ping message for connection health monitoring.
 * @direction C→S (both Host and Controller)
 */
export interface PingMessage {
  readonly type: "PING";
  readonly timestamp: number;
}

/**
 * Pong response to ping.
 * @direction S→C
 */
export interface PongMessage {
  readonly type: "PONG";
  readonly timestamp: number;
}

// ============================================================================
// GAME COMMAND MESSAGES (Controller → Host via Server)
// ============================================================================

/**
 * Controller requests to draw the next card.
 * @direction C→S→Host
 */
export interface DrawCardMessage {
  readonly type: "DRAW_CARD";
}

/**
 * Controller requests to pause the game.
 * @direction C→S→Host
 */
export interface PauseGameMessage {
  readonly type: "PAUSE_GAME";
}

/**
 * Controller requests to resume the game.
 * @direction C→S→Host
 */
export interface ResumeGameMessage {
  readonly type: "RESUME_GAME";
}

/**
 * Controller requests to reset the game (reshuffle and restart).
 * @direction C→S→Host
 */
export interface ResetGameMessage {
  readonly type: "RESET_GAME";
}

// ============================================================================
// STATE UPDATE MESSAGES (Host → Controller via Server)
// ============================================================================

/**
 * Payload for state updates sent from Host to Controller.
 * Contains only the data needed by the Controller UI.
 */
export interface StateUpdatePayload {
  /** Currently displayed item (null before first draw) */
  readonly currentItem: ItemDefinition | null;

  /** Current index in the shuffled deck (-1 before first draw) */
  readonly currentIndex: number;

  /** Total number of items in the deck */
  readonly totalItems: number;

  /** Current game status */
  readonly status: GameStatus;

  /** Number of cards in history */
  readonly historyCount: number;
}

/**
 * Host broadcasts current game state to Controller.
 * @direction Host→S→Controller
 */
export interface StateUpdateMessage {
  readonly type: "STATE_UPDATE";
  readonly payload: StateUpdatePayload;
}

/**
 * Full state sync sent on Controller reconnection.
 * Includes history for the history modal.
 * @direction S→C (to Controller on reconnect)
 */
export interface FullStateSyncMessage {
  readonly type: "FULL_STATE_SYNC";
  readonly payload: StateUpdatePayload & {
    /** Complete history for modal display */
    readonly history: readonly ItemDefinition[];
  };
}

// ============================================================================
// ERROR MESSAGES
// ============================================================================

/**
 * Generic error message from server.
 * @direction S→C
 */
export interface ErrorMessage {
  readonly type: "ERROR";
  readonly code: ErrorCode;
  readonly message: string;
}

/**
 * Error codes for WebSocket errors.
 */
export type ErrorCode =
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "INVALID_MESSAGE"
  | "UNAUTHORIZED"
  | "INTERNAL_ERROR";

// ============================================================================
// DISCRIMINATED UNION
// ============================================================================

/**
 * Union of all WebSocket message types.
 * Use with type narrowing for exhaustive handling:
 *
 * @example
 * ```ts
 * function handleMessage(msg: WSMessage) {
 *   switch (msg.type) {
 *     case "DRAW_CARD":
 *       // msg is DrawCardMessage here
 *       break;
 *     case "STATE_UPDATE":
 *       // msg is StateUpdateMessage here
 *       console.log(msg.payload.currentItem);
 *       break;
 *     // ... handle all cases
 *   }
 * }
 * ```
 */
export type WSMessage =
  // Room Management
  | CreateRoomMessage
  | RoomCreatedMessage
  | JoinRoomMessage
  | RoomJoinedMessage
  | RoomNotFoundMessage
  // Connection Events
  | ControllerConnectedMessage
  | ControllerDisconnectedMessage
  | HostDisconnectedMessage
  | PingMessage
  | PongMessage
  // Game Commands
  | DrawCardMessage
  | PauseGameMessage
  | ResumeGameMessage
  | ResetGameMessage
  // State Updates
  | StateUpdateMessage
  | FullStateSyncMessage
  // Errors
  | ErrorMessage;

/**
 * Message types that can be sent by the Host.
 */
export type HostMessage =
  | CreateRoomMessage
  | StateUpdateMessage
  | PingMessage;

/**
 * Message types that can be sent by the Controller.
 */
export type ControllerMessage =
  | JoinRoomMessage
  | DrawCardMessage
  | PauseGameMessage
  | ResumeGameMessage
  | ResetGameMessage
  | PingMessage;

/**
 * Message types that originate from the Server.
 */
export type ServerMessage =
  | RoomCreatedMessage
  | RoomJoinedMessage
  | RoomNotFoundMessage
  | ControllerConnectedMessage
  | ControllerDisconnectedMessage
  | HostDisconnectedMessage
  | StateUpdateMessage
  | FullStateSyncMessage
  | PongMessage
  | ErrorMessage;

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if a message is a valid WSMessage.
 */
export function isWSMessage(value: unknown): value is WSMessage {
  if (!value || typeof value !== "object") return false;

  const msg = value as Record<string, unknown>;

  if (typeof msg.type !== "string") return false;

  // Check against known message types
  const validTypes = new Set([
    "CREATE_ROOM",
    "ROOM_CREATED",
    "JOIN_ROOM",
    "ROOM_JOINED",
    "ROOM_NOT_FOUND",
    "CONTROLLER_CONNECTED",
    "CONTROLLER_DISCONNECTED",
    "HOST_DISCONNECTED",
    "PING",
    "PONG",
    "DRAW_CARD",
    "PAUSE_GAME",
    "RESUME_GAME",
    "RESET_GAME",
    "STATE_UPDATE",
    "FULL_STATE_SYNC",
    "ERROR",
  ]);

  return validTypes.has(msg.type);
}

/**
 * Type guard for game command messages.
 */
export function isGameCommand(
  msg: WSMessage
): msg is DrawCardMessage | PauseGameMessage | ResumeGameMessage | ResetGameMessage {
  return (
    msg.type === "DRAW_CARD" ||
    msg.type === "PAUSE_GAME" ||
    msg.type === "RESUME_GAME" ||
    msg.type === "RESET_GAME"
  );
}

/**
 * Type guard for state update messages.
 */
export function isStateUpdate(
  msg: WSMessage
): msg is StateUpdateMessage | FullStateSyncMessage {
  return msg.type === "STATE_UPDATE" || msg.type === "FULL_STATE_SYNC";
}

/**
 * Type guard for connection event messages.
 */
export function isConnectionEvent(
  msg: WSMessage
): msg is ControllerConnectedMessage | ControllerDisconnectedMessage | HostDisconnectedMessage {
  return (
    msg.type === "CONTROLLER_CONNECTED" ||
    msg.type === "CONTROLLER_DISCONNECTED" ||
    msg.type === "HOST_DISCONNECTED"
  );
}

// ============================================================================
// MESSAGE FACTORIES
// ============================================================================

/**
 * Creates a CREATE_ROOM message.
 */
export function createRoomMessage(): CreateRoomMessage {
  return { type: "CREATE_ROOM" };
}

/**
 * Creates a JOIN_ROOM message.
 */
export function joinRoomMessage(roomId: string): JoinRoomMessage {
  return { type: "JOIN_ROOM", roomId };
}

/**
 * Creates a DRAW_CARD message.
 */
export function drawCardMessage(): DrawCardMessage {
  return { type: "DRAW_CARD" };
}

/**
 * Creates a PAUSE_GAME message.
 */
export function pauseGameMessage(): PauseGameMessage {
  return { type: "PAUSE_GAME" };
}

/**
 * Creates a RESUME_GAME message.
 */
export function resumeGameMessage(): ResumeGameMessage {
  return { type: "RESUME_GAME" };
}

/**
 * Creates a RESET_GAME message.
 */
export function resetGameMessage(): ResetGameMessage {
  return { type: "RESET_GAME" };
}

/**
 * Creates a STATE_UPDATE message.
 */
export function stateUpdateMessage(
  payload: StateUpdatePayload
): StateUpdateMessage {
  return { type: "STATE_UPDATE", payload };
}

/**
 * Creates a PING message.
 */
export function pingMessage(): PingMessage {
  return { type: "PING", timestamp: Date.now() };
}

/**
 * Serializes a message for WebSocket transmission.
 */
export function serializeMessage(msg: WSMessage): string {
  return JSON.stringify(msg);
}

/**
 * Parses a WebSocket message string.
 * Returns null if parsing fails or message is invalid.
 */
export function parseMessage(data: string): WSMessage | null {
  try {
    const parsed = JSON.parse(data);
    if (isWSMessage(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

