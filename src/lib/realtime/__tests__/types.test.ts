/**
 * Unit Tests: Realtime Protocol Types
 *
 * Tests for WebSocket message type guards, factories, and serialization
 * defined in lib/realtime/types.ts
 *
 * @see SRD §3.4 Realtime Protocol
 */

import { describe, it, expect } from "vitest";
import {
  isWSMessage,
  isGameCommand,
  isStateUpdate,
  isConnectionEvent,
  createRoomMessage,
  joinRoomMessage,
  drawCardMessage,
  pauseGameMessage,
  resumeGameMessage,
  resetGameMessage,
  stateUpdateMessage,
  pingMessage,
  serializeMessage,
  parseMessage,
  type WSMessage,
  type StateUpdatePayload,
} from "../types";

// ============================================================================
// TEST FIXTURES
// ============================================================================

const validStatePayload: StateUpdatePayload = {
  currentItem: {
    id: "01",
    name: "El Sol",
    imageUrl: "/decks/demo/sol.png",
    shortText: "El sol sale para todos.",
  },
  currentIndex: 5,
  totalItems: 36,
  status: "playing",
  historyCount: 5,
};

// ============================================================================
// Message Type Guard Tests
// ============================================================================

describe("isWSMessage", () => {
  describe("room management messages", () => {
    it("should validate CREATE_ROOM message", () => {
      expect(isWSMessage({ type: "CREATE_ROOM" })).toBe(true);
    });

    it("should validate ROOM_CREATED message", () => {
      expect(isWSMessage({ type: "ROOM_CREATED", roomId: "ABCD" })).toBe(true);
    });

    it("should validate JOIN_ROOM message", () => {
      expect(isWSMessage({ type: "JOIN_ROOM", roomId: "ABCD" })).toBe(true);
    });

    it("should validate ROOM_JOINED message", () => {
      expect(isWSMessage({ type: "ROOM_JOINED" })).toBe(true);
    });

    it("should validate ROOM_NOT_FOUND message", () => {
      expect(isWSMessage({ type: "ROOM_NOT_FOUND", roomId: "XXXX" })).toBe(
        true
      );
    });
  });

  describe("connection event messages", () => {
    it("should validate CONTROLLER_CONNECTED message", () => {
      expect(
        isWSMessage({ type: "CONTROLLER_CONNECTED", controllerId: "ctrl-1" })
      ).toBe(true);
    });

    it("should validate CONTROLLER_DISCONNECTED message", () => {
      expect(isWSMessage({ type: "CONTROLLER_DISCONNECTED" })).toBe(true);
    });

    it("should validate HOST_DISCONNECTED message", () => {
      expect(isWSMessage({ type: "HOST_DISCONNECTED" })).toBe(true);
    });

    it("should validate PING message", () => {
      expect(isWSMessage({ type: "PING", timestamp: Date.now() })).toBe(true);
    });

    it("should validate PONG message", () => {
      expect(isWSMessage({ type: "PONG", timestamp: Date.now() })).toBe(true);
    });
  });

  describe("game command messages", () => {
    it("should validate DRAW_CARD message", () => {
      expect(isWSMessage({ type: "DRAW_CARD" })).toBe(true);
    });

    it("should validate PAUSE_GAME message", () => {
      expect(isWSMessage({ type: "PAUSE_GAME" })).toBe(true);
    });

    it("should validate RESUME_GAME message", () => {
      expect(isWSMessage({ type: "RESUME_GAME" })).toBe(true);
    });

    it("should validate RESET_GAME message", () => {
      expect(isWSMessage({ type: "RESET_GAME" })).toBe(true);
    });
  });

  describe("state update messages", () => {
    it("should validate STATE_UPDATE message", () => {
      expect(
        isWSMessage({ type: "STATE_UPDATE", payload: validStatePayload })
      ).toBe(true);
    });

    it("should validate FULL_STATE_SYNC message", () => {
      expect(
        isWSMessage({
          type: "FULL_STATE_SYNC",
          payload: { ...validStatePayload, history: [] },
        })
      ).toBe(true);
    });
  });

  describe("error messages", () => {
    it("should validate ERROR message", () => {
      expect(
        isWSMessage({
          type: "ERROR",
          code: "ROOM_NOT_FOUND",
          message: "Room does not exist",
        })
      ).toBe(true);
    });
  });

  describe("invalid messages", () => {
    it("should return false for unknown message type", () => {
      expect(isWSMessage({ type: "UNKNOWN_TYPE" })).toBe(false);
    });

    it("should return false for missing type", () => {
      expect(isWSMessage({ roomId: "ABCD" })).toBe(false);
    });

    it("should return false for null", () => {
      expect(isWSMessage(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isWSMessage(undefined)).toBe(false);
    });

    it("should return false for primitives", () => {
      expect(isWSMessage("DRAW_CARD")).toBe(false);
      expect(isWSMessage(123)).toBe(false);
      expect(isWSMessage(true)).toBe(false);
    });

    it("should return false for arrays", () => {
      expect(isWSMessage([{ type: "DRAW_CARD" }])).toBe(false);
    });

    it("should return false for non-string type", () => {
      expect(isWSMessage({ type: 123 })).toBe(false);
    });
  });
});

// ============================================================================
// Specialized Type Guards Tests
// ============================================================================

describe("isGameCommand", () => {
  it("should return true for DRAW_CARD", () => {
    const msg: WSMessage = { type: "DRAW_CARD" };
    expect(isGameCommand(msg)).toBe(true);
  });

  it("should return true for PAUSE_GAME", () => {
    const msg: WSMessage = { type: "PAUSE_GAME" };
    expect(isGameCommand(msg)).toBe(true);
  });

  it("should return true for RESUME_GAME", () => {
    const msg: WSMessage = { type: "RESUME_GAME" };
    expect(isGameCommand(msg)).toBe(true);
  });

  it("should return true for RESET_GAME", () => {
    const msg: WSMessage = { type: "RESET_GAME" };
    expect(isGameCommand(msg)).toBe(true);
  });

  it("should return false for non-command messages", () => {
    const msg: WSMessage = { type: "STATE_UPDATE", payload: validStatePayload };
    expect(isGameCommand(msg)).toBe(false);
  });

  it("should return false for connection events", () => {
    const msg: WSMessage = { type: "CONTROLLER_CONNECTED", controllerId: "x" };
    expect(isGameCommand(msg)).toBe(false);
  });
});

describe("isStateUpdate", () => {
  it("should return true for STATE_UPDATE", () => {
    const msg: WSMessage = { type: "STATE_UPDATE", payload: validStatePayload };
    expect(isStateUpdate(msg)).toBe(true);
  });

  it("should return true for FULL_STATE_SYNC", () => {
    const msg: WSMessage = {
      type: "FULL_STATE_SYNC",
      payload: { ...validStatePayload, history: [] },
    };
    expect(isStateUpdate(msg)).toBe(true);
  });

  it("should return false for game commands", () => {
    const msg: WSMessage = { type: "DRAW_CARD" };
    expect(isStateUpdate(msg)).toBe(false);
  });

  it("should return false for connection events", () => {
    const msg: WSMessage = { type: "CONTROLLER_CONNECTED", controllerId: "x" };
    expect(isStateUpdate(msg)).toBe(false);
  });
});

describe("isConnectionEvent", () => {
  it("should return true for CONTROLLER_CONNECTED", () => {
    const msg: WSMessage = { type: "CONTROLLER_CONNECTED", controllerId: "x" };
    expect(isConnectionEvent(msg)).toBe(true);
  });

  it("should return true for CONTROLLER_DISCONNECTED", () => {
    const msg: WSMessage = { type: "CONTROLLER_DISCONNECTED" };
    expect(isConnectionEvent(msg)).toBe(true);
  });

  it("should return true for HOST_DISCONNECTED", () => {
    const msg: WSMessage = { type: "HOST_DISCONNECTED" };
    expect(isConnectionEvent(msg)).toBe(true);
  });

  it("should return false for PING/PONG", () => {
    const ping: WSMessage = { type: "PING", timestamp: Date.now() };
    const pong: WSMessage = { type: "PONG", timestamp: Date.now() };
    expect(isConnectionEvent(ping)).toBe(false);
    expect(isConnectionEvent(pong)).toBe(false);
  });

  it("should return false for game commands", () => {
    const msg: WSMessage = { type: "DRAW_CARD" };
    expect(isConnectionEvent(msg)).toBe(false);
  });
});

// ============================================================================
// Message Factory Tests
// ============================================================================

describe("Message Factories", () => {
  describe("createRoomMessage", () => {
    it("should create valid CREATE_ROOM message", () => {
      const msg = createRoomMessage();
      expect(msg.type).toBe("CREATE_ROOM");
      expect(isWSMessage(msg)).toBe(true);
    });
  });

  describe("joinRoomMessage", () => {
    it("should create valid JOIN_ROOM message with roomId", () => {
      const msg = joinRoomMessage("ABCD");
      expect(msg.type).toBe("JOIN_ROOM");
      expect(msg.roomId).toBe("ABCD");
      expect(isWSMessage(msg)).toBe(true);
    });

    it("should preserve exact roomId", () => {
      const msg = joinRoomMessage("XY12");
      expect(msg.roomId).toBe("XY12");
    });
  });

  describe("drawCardMessage", () => {
    it("should create valid DRAW_CARD message", () => {
      const msg = drawCardMessage();
      expect(msg.type).toBe("DRAW_CARD");
      expect(isWSMessage(msg)).toBe(true);
      expect(isGameCommand(msg)).toBe(true);
    });
  });

  describe("pauseGameMessage", () => {
    it("should create valid PAUSE_GAME message", () => {
      const msg = pauseGameMessage();
      expect(msg.type).toBe("PAUSE_GAME");
      expect(isWSMessage(msg)).toBe(true);
      expect(isGameCommand(msg)).toBe(true);
    });
  });

  describe("resumeGameMessage", () => {
    it("should create valid RESUME_GAME message", () => {
      const msg = resumeGameMessage();
      expect(msg.type).toBe("RESUME_GAME");
      expect(isWSMessage(msg)).toBe(true);
      expect(isGameCommand(msg)).toBe(true);
    });
  });

  describe("resetGameMessage", () => {
    it("should create valid RESET_GAME message", () => {
      const msg = resetGameMessage();
      expect(msg.type).toBe("RESET_GAME");
      expect(isWSMessage(msg)).toBe(true);
      expect(isGameCommand(msg)).toBe(true);
    });
  });

  describe("stateUpdateMessage", () => {
    it("should create valid STATE_UPDATE message with payload", () => {
      const msg = stateUpdateMessage(validStatePayload);
      expect(msg.type).toBe("STATE_UPDATE");
      expect(msg.payload).toEqual(validStatePayload);
      expect(isWSMessage(msg)).toBe(true);
      expect(isStateUpdate(msg)).toBe(true);
    });

    it("should handle null currentItem", () => {
      const payload: StateUpdatePayload = {
        ...validStatePayload,
        currentItem: null,
      };
      const msg = stateUpdateMessage(payload);
      expect(msg.payload.currentItem).toBeNull();
    });
  });

  describe("pingMessage", () => {
    it("should create valid PING message with timestamp", () => {
      const before = Date.now();
      const msg = pingMessage();
      const after = Date.now();

      expect(msg.type).toBe("PING");
      expect(typeof msg.timestamp).toBe("number");
      expect(msg.timestamp).toBeGreaterThanOrEqual(before);
      expect(msg.timestamp).toBeLessThanOrEqual(after);
      expect(isWSMessage(msg)).toBe(true);
    });
  });
});

// ============================================================================
// Serialization Tests
// ============================================================================

describe("serializeMessage", () => {
  it("should serialize to valid JSON string", () => {
    const msg = drawCardMessage();
    const serialized = serializeMessage(msg);

    expect(typeof serialized).toBe("string");
    expect(() => JSON.parse(serialized)).not.toThrow();
  });

  it("should preserve all message properties", () => {
    const msg = stateUpdateMessage(validStatePayload);
    const serialized = serializeMessage(msg);
    const parsed = JSON.parse(serialized);

    expect(parsed.type).toBe("STATE_UPDATE");
    expect(parsed.payload.currentItem.id).toBe("01");
    expect(parsed.payload.currentIndex).toBe(5);
  });

  it("should handle room messages with IDs", () => {
    const msg = joinRoomMessage("ABCD");
    const serialized = serializeMessage(msg);
    const parsed = JSON.parse(serialized);

    expect(parsed.roomId).toBe("ABCD");
  });
});

describe("parseMessage", () => {
  it("should parse valid serialized message", () => {
    const original = drawCardMessage();
    const serialized = serializeMessage(original);
    const parsed = parseMessage(serialized);

    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe("DRAW_CARD");
  });

  it("should return null for invalid JSON", () => {
    expect(parseMessage("not valid json")).toBeNull();
    expect(parseMessage("{broken")).toBeNull();
    expect(parseMessage("")).toBeNull();
  });

  it("should return null for valid JSON but invalid message", () => {
    expect(parseMessage('{"foo": "bar"}')).toBeNull();
    expect(parseMessage('{"type": "UNKNOWN_TYPE"}')).toBeNull();
    expect(parseMessage("123")).toBeNull();
    expect(parseMessage('"string"')).toBeNull();
    expect(parseMessage("null")).toBeNull();
  });

  it("should round-trip complex messages", () => {
    const original = stateUpdateMessage(validStatePayload);
    const serialized = serializeMessage(original);
    const parsed = parseMessage(serialized);

    expect(parsed).not.toBeNull();
    if (parsed && parsed.type === "STATE_UPDATE") {
      expect(parsed.payload.currentItem?.id).toBe("01");
      expect(parsed.payload.currentIndex).toBe(5);
      expect(parsed.payload.totalItems).toBe(36);
      expect(parsed.payload.status).toBe("playing");
    }
  });

  it("should handle messages with null values", () => {
    const payload: StateUpdatePayload = {
      ...validStatePayload,
      currentItem: null,
    };
    const original = stateUpdateMessage(payload);
    const serialized = serializeMessage(original);
    const parsed = parseMessage(serialized);

    expect(parsed).not.toBeNull();
    if (parsed && parsed.type === "STATE_UPDATE") {
      expect(parsed.payload.currentItem).toBeNull();
    }
  });
});

// ============================================================================
// Type Narrowing Tests (compile-time verification)
// ============================================================================

describe("Type Narrowing", () => {
  it("should narrow WSMessage to specific command types", () => {
    const msg: WSMessage = { type: "DRAW_CARD" };

    if (isGameCommand(msg)) {
      // TypeScript should know this is a game command
      // We verify by accessing a common property
      const msgType = msg.type;
      expect(["DRAW_CARD", "PAUSE_GAME", "RESUME_GAME", "RESET_GAME"]).toContain(
        msgType
      );
    }
  });

  it("should narrow and access state update payload", () => {
    const msg: WSMessage = { type: "STATE_UPDATE", payload: validStatePayload };

    if (isStateUpdate(msg)) {
      // TypeScript should know this has a payload
      const _index: number = msg.payload.currentIndex;
      expect(_index).toBe(5);
    }
  });

  it("should narrow connection events correctly", () => {
    const msg: WSMessage = { type: "CONTROLLER_CONNECTED", controllerId: "x" };

    if (isConnectionEvent(msg)) {
      // TypeScript should narrow to connection event types
      if (msg.type === "CONTROLLER_CONNECTED") {
        const _id: string = msg.controllerId;
        expect(_id).toBe("x");
      }
    }
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("Edge Cases", () => {
  it("should handle messages with extra properties (forward compatibility)", () => {
    const msg = { type: "DRAW_CARD", futureField: "ignored" };
    expect(isWSMessage(msg)).toBe(true);
  });

  it("should handle very long room IDs", () => {
    const longId = "A".repeat(100);
    const msg = joinRoomMessage(longId);
    expect(msg.roomId).toBe(longId);
    expect(msg.roomId.length).toBe(100);
  });

  it("should handle unicode in item names", () => {
    const payload: StateUpdatePayload = {
      ...validStatePayload,
      currentItem: {
        id: "01",
        name: "日本語のカード 🎴",
        imageUrl: "/card.png",
        shortText: "Texto con émojis 🌟 y acentós",
      },
    };
    const msg = stateUpdateMessage(payload);
    const serialized = serializeMessage(msg);
    const parsed = parseMessage(serialized);

    expect(parsed).not.toBeNull();
    if (parsed && parsed.type === "STATE_UPDATE") {
      expect(parsed.payload.currentItem?.name).toBe("日本語のカード 🎴");
    }
  });

  it("should handle large history counts", () => {
    const payload: StateUpdatePayload = {
      ...validStatePayload,
      historyCount: 1000000,
    };
    const msg = stateUpdateMessage(payload);
    expect(msg.payload.historyCount).toBe(1000000);
  });
});

