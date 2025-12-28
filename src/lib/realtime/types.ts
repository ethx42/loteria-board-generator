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

  // ========================================
  // v4.0 Extensions
  // ========================================

  /**
   * Whether history modal is currently open (v4.0).
   * Used for bidirectional sync between Host and Controller.
   */
  readonly isHistoryOpen?: boolean;

  /**
   * Full history data (v4.0).
   * Sent when modal is open or on reconnection for sync.
   */
  readonly history?: readonly ItemDefinition[];
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
// HISTORY MODAL SYNC MESSAGES (v4.0)
// ============================================================================

/**
 * Request to open history modal (bidirectional sync).
 * When Host or Controller opens the history modal, it broadcasts to sync state.
 * @direction Host→Server→Controller OR Controller→Server→Host
 */
export interface OpenHistoryMessage {
  readonly type: "OPEN_HISTORY";
}

/**
 * Request to close history modal (bidirectional sync).
 * When Host or Controller closes the history modal, it broadcasts to sync state.
 * @direction Host→Server→Controller OR Controller→Server→Host
 */
export interface CloseHistoryMessage {
  readonly type: "CLOSE_HISTORY";
}

// ============================================================================
// SPECTATOR & REACTION MESSAGES (v4.0)
// ============================================================================

/**
 * Available reaction emojis.
 * Extensible: add new emojis here and they propagate everywhere.
 */
export const REACTION_EMOJIS = ["👏", "🎉", "❤️", "😮", "🔥", "👀"] as const;

/**
 * Type for valid reaction emojis.
 */
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

/**
 * Type guard for ReactionEmoji.
 */
export function isReactionEmoji(value: unknown): value is ReactionEmoji {
  return (
    typeof value === "string" &&
    REACTION_EMOJIS.includes(value as ReactionEmoji)
  );
}

/**
 * Spectator sends an emoji reaction.
 * @direction Spectator→Server
 */
export interface SendReactionMessage {
  readonly type: "SEND_REACTION";
  readonly emoji: ReactionEmoji;
}

/**
 * Server broadcasts aggregated reaction burst.
 * Batched every 500ms to reduce network traffic.
 * @direction Server→All
 */
export interface ReactionBurstMessage {
  readonly type: "REACTION_BURST";
  readonly reactions: readonly {
    readonly emoji: ReactionEmoji;
    readonly count: number;
  }[];
  readonly timestamp: number;
}

/**
 * Server broadcasts spectator count update.
 * Sent when spectators connect or disconnect.
 * @direction Server→All
 */
export interface SpectatorCountMessage {
  readonly type: "SPECTATOR_COUNT";
  readonly count: number;
}

// ============================================================================
// SOUND PREFERENCE SYNC MESSAGES (v4.0)
// ============================================================================

/**
 * Sound source constants - who initiated the change.
 */
export const SoundSource = {
  HOST: "host",
  CONTROLLER: "controller",
} as const;

export type SoundSourceType = (typeof SoundSource)[keyof typeof SoundSource];

/**
 * Sound scope constants - what devices are affected.
 *
 * - LOCAL: Only affects sender's device (no network message)
 * - HOST_ONLY: Only affects Host device (Controller keeps current state)
 * - BOTH: Affects both Controller and Host devices
 */
export const SoundScope = {
  LOCAL: "local",
  HOST_ONLY: "host_only",
  BOTH: "both",
} as const;

export type SoundChangeScope = (typeof SoundScope)[keyof typeof SoundScope];

/**
 * Sound preference change message.
 *
 * ## Behavior by source and scope:
 *
 * ### Host sends (always scope: "local"):
 * - Controller receives and shows confirmation modal
 * - Controller decides to sync or keep their preference
 *
 * ### Controller sends:
 * - scope: "local" → No network message (Controller-only)
 * - scope: "host_only" → Host changes, Controller stays same
 * - scope: "both" → Both devices change
 *
 * @direction Host→Server→Controller OR Controller→Server→Host
 */
export interface SoundPreferenceMessage {
  readonly type: "SOUND_PREFERENCE";
  readonly enabled: boolean;
  /** Origin device that changed the preference */
  readonly source: SoundSourceType;
  /** Scope of the change */
  readonly scope: SoundChangeScope;
}

/**
 * Sound preference acknowledgment message.
 * Sent by Host to confirm it received and executed a Controller command.
 *
 * @direction Host→Server→Controller
 */
export interface SoundPreferenceAckMessage {
  readonly type: "SOUND_PREFERENCE_ACK";
  readonly enabled: boolean;
  readonly scope: SoundChangeScope;
}

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
  | ErrorMessage
  // v4.0: History Modal Sync
  | OpenHistoryMessage
  | CloseHistoryMessage
  // v4.0: Spectator & Reactions
  | SendReactionMessage
  | ReactionBurstMessage
  | SpectatorCountMessage
  // v4.0: Sound Preference Sync
  | SoundPreferenceMessage
  | SoundPreferenceAckMessage;

/**
 * Message types that can be sent by the Host.
 */
export type HostMessage =
  | CreateRoomMessage
  | StateUpdateMessage
  | OpenHistoryMessage
  | CloseHistoryMessage
  | SoundPreferenceMessage
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
  | OpenHistoryMessage
  | CloseHistoryMessage
  | PingMessage;

/**
 * Message types that can be sent by a Spectator.
 */
export type SpectatorMessage = SendReactionMessage | PingMessage;

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
  | OpenHistoryMessage
  | CloseHistoryMessage
  | ReactionBurstMessage
  | SpectatorCountMessage
  | PongMessage
  | ErrorMessage;

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * All valid message type strings.
 * Used by type guard and for validation.
 */
const VALID_MESSAGE_TYPES = new Set([
  // Room Management
  "CREATE_ROOM",
  "ROOM_CREATED",
  "JOIN_ROOM",
  "ROOM_JOINED",
  "ROOM_NOT_FOUND",
  // Connection Events
  "CONTROLLER_CONNECTED",
  "CONTROLLER_DISCONNECTED",
  "HOST_DISCONNECTED",
  "PING",
  "PONG",
  // Game Commands
  "DRAW_CARD",
  "PAUSE_GAME",
  "RESUME_GAME",
  "RESET_GAME",
  // State Updates
  "STATE_UPDATE",
  "FULL_STATE_SYNC",
  // Errors
  "ERROR",
  // v4.0: History Modal Sync
  "OPEN_HISTORY",
  "CLOSE_HISTORY",
  // v4.0: Spectator & Reactions
  "SEND_REACTION",
  "REACTION_BURST",
  "SPECTATOR_COUNT",
  // v4.0: Sound Preference Sync
  "SOUND_PREFERENCE",
]);

/**
 * Type guard to check if a message is a valid WSMessage.
 */
export function isWSMessage(value: unknown): value is WSMessage {
  if (!value || typeof value !== "object") return false;

  const msg = value as Record<string, unknown>;

  if (typeof msg.type !== "string") return false;

  return VALID_MESSAGE_TYPES.has(msg.type);
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

/**
 * Type guard for history modal messages.
 */
export function isHistoryModalMessage(
  msg: WSMessage
): msg is OpenHistoryMessage | CloseHistoryMessage {
  return msg.type === "OPEN_HISTORY" || msg.type === "CLOSE_HISTORY";
}

/**
 * Type guard for spectator-related messages.
 */
export function isSpectatorMessage(
  msg: WSMessage
): msg is SendReactionMessage | ReactionBurstMessage | SpectatorCountMessage {
  return (
    msg.type === "SEND_REACTION" ||
    msg.type === "REACTION_BURST" ||
    msg.type === "SPECTATOR_COUNT"
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

// ============================================================================
// v4.0 MESSAGE FACTORIES
// ============================================================================

/**
 * Creates an OPEN_HISTORY message.
 */
export function openHistoryMessage(): OpenHistoryMessage {
  return { type: "OPEN_HISTORY" };
}

/**
 * Creates a CLOSE_HISTORY message.
 */
export function closeHistoryMessage(): CloseHistoryMessage {
  return { type: "CLOSE_HISTORY" };
}

/**
 * Creates a SEND_REACTION message.
 */
export function sendReactionMessage(emoji: ReactionEmoji): SendReactionMessage {
  return { type: "SEND_REACTION", emoji };
}

/**
 * Creates a REACTION_BURST message.
 */
export function reactionBurstMessage(
  reactions: ReactionBurstMessage["reactions"]
): ReactionBurstMessage {
  return { type: "REACTION_BURST", reactions, timestamp: Date.now() };
}

/**
 * Creates a SPECTATOR_COUNT message.
 */
export function spectatorCountMessage(count: number): SpectatorCountMessage {
  return { type: "SPECTATOR_COUNT", count };
}

/**
 * Creates a SOUND_PREFERENCE message.
 */
export function soundPreferenceMessage(
  enabled: boolean,
  source: SoundSourceType,
  scope: SoundChangeScope = SoundScope.LOCAL
): SoundPreferenceMessage {
  return { type: "SOUND_PREFERENCE", enabled, source, scope };
}

/**
 * Creates a SOUND_PREFERENCE_ACK message.
 */
export function soundPreferenceAckMessage(
  enabled: boolean,
  scope: SoundChangeScope
): SoundPreferenceAckMessage {
  return { type: "SOUND_PREFERENCE_ACK", enabled, scope };
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

