/**
 * Host UI State Machine Tests
 *
 * Tests for the Host UI state machine transitions as defined in SRD §2.4.
 *
 * @see SRD §2.4 Host UI State Machine Diagram
 * @see SRD §7.2 Host UI State Machine
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  hostUIReducer,
  createHostUIStore,
  resetHostUIStore,
} from "../state-machine";
import type { HostUIState, HostUIEvent } from "@/lib/types/game";
import { INITIAL_HOST_UI_STATE } from "@/lib/types/game";

describe("Host UI State Machine", () => {
  describe("hostUIReducer", () => {
    describe("Initial State", () => {
      it("should start in standalone mode", () => {
        expect(INITIAL_HOST_UI_STATE.mode).toBe("standalone");
      });

      it("should have controls visible initially", () => {
        expect(INITIAL_HOST_UI_STATE.controlsVisible).toBe(true);
      });

      it("should not be in fullscreen initially", () => {
        expect(INITIAL_HOST_UI_STATE.isFullscreen).toBe(false);
      });

      it("should not have temporary controls initially", () => {
        expect(INITIAL_HOST_UI_STATE.controlsTemporary).toBe(false);
      });
    });

    describe("Connection State Transitions", () => {
      it("should transition to paired mode on CONTROLLER_CONNECTED", () => {
        const state = INITIAL_HOST_UI_STATE;
        const event: HostUIEvent = { type: "CONTROLLER_CONNECTED" };

        const newState = hostUIReducer(state, event);

        expect(newState.mode).toBe("paired");
      });

      it("should auto-fullscreen when controller connects (FR-021)", () => {
        const state = INITIAL_HOST_UI_STATE;
        const event: HostUIEvent = { type: "CONTROLLER_CONNECTED" };

        const newState = hostUIReducer(state, event);

        expect(newState.isFullscreen).toBe(true);
      });

      it("should hide controls when controller connects (FR-021)", () => {
        const state = INITIAL_HOST_UI_STATE;
        const event: HostUIEvent = { type: "CONTROLLER_CONNECTED" };

        const newState = hostUIReducer(state, event);

        expect(newState.controlsVisible).toBe(false);
      });

      it("should transition back to standalone on CONTROLLER_DISCONNECTED", () => {
        const pairedState: HostUIState = {
          mode: "paired",
          isFullscreen: true,
          controlsVisible: false,
          controlsTemporary: false,
        };
        const event: HostUIEvent = { type: "CONTROLLER_DISCONNECTED" };

        const newState = hostUIReducer(pairedState, event);

        expect(newState.mode).toBe("standalone");
      });

      it("should maintain fullscreen after controller disconnect", () => {
        const pairedState: HostUIState = {
          mode: "paired",
          isFullscreen: true,
          controlsVisible: false,
          controlsTemporary: false,
        };
        const event: HostUIEvent = { type: "CONTROLLER_DISCONNECTED" };

        const newState = hostUIReducer(pairedState, event);

        expect(newState.isFullscreen).toBe(true);
      });

      it("should show controls on controller disconnect (FR-024)", () => {
        const pairedState: HostUIState = {
          mode: "paired",
          isFullscreen: true,
          controlsVisible: false,
          controlsTemporary: false,
        };
        const event: HostUIEvent = { type: "CONTROLLER_DISCONNECTED" };

        const newState = hostUIReducer(pairedState, event);

        expect(newState.controlsVisible).toBe(true);
      });
    });

    describe("Fullscreen Transitions", () => {
      it("should enter fullscreen on ENTER_FULLSCREEN", () => {
        const state: HostUIState = {
          ...INITIAL_HOST_UI_STATE,
          isFullscreen: false,
        };
        const event: HostUIEvent = { type: "ENTER_FULLSCREEN" };

        const newState = hostUIReducer(state, event);

        expect(newState.isFullscreen).toBe(true);
      });

      it("should exit fullscreen on EXIT_FULLSCREEN", () => {
        const state: HostUIState = {
          ...INITIAL_HOST_UI_STATE,
          isFullscreen: true,
        };
        const event: HostUIEvent = { type: "EXIT_FULLSCREEN" };

        const newState = hostUIReducer(state, event);

        expect(newState.isFullscreen).toBe(false);
      });

      it("should toggle fullscreen on TOGGLE_FULLSCREEN", () => {
        const state: HostUIState = {
          ...INITIAL_HOST_UI_STATE,
          isFullscreen: false,
        };

        let newState = hostUIReducer(state, { type: "TOGGLE_FULLSCREEN" });
        expect(newState.isFullscreen).toBe(true);

        newState = hostUIReducer(newState, { type: "TOGGLE_FULLSCREEN" });
        expect(newState.isFullscreen).toBe(false);
      });
    });

    describe("Controls Visibility - Standalone Mode", () => {
      it("should not hide controls in standalone mode", () => {
        const state: HostUIState = {
          ...INITIAL_HOST_UI_STATE,
          mode: "standalone",
          controlsVisible: true,
        };
        const event: HostUIEvent = { type: "HIDE_CONTROLS" };

        const newState = hostUIReducer(state, event);

        expect(newState.controlsVisible).toBe(true);
      });

      it("should not toggle controls in standalone mode", () => {
        const state: HostUIState = {
          ...INITIAL_HOST_UI_STATE,
          mode: "standalone",
          controlsVisible: true,
        };
        const event: HostUIEvent = { type: "TOGGLE_CONTROLS" };

        const newState = hostUIReducer(state, event);

        expect(newState.controlsVisible).toBe(true);
      });
    });

    describe("Controls Visibility - Paired Mode", () => {
      it("should toggle controls on TOGGLE_CONTROLS in paired mode (FR-023)", () => {
        const pairedHiddenControls: HostUIState = {
          mode: "paired",
          isFullscreen: true,
          controlsVisible: false,
          controlsTemporary: false,
        };

        let newState = hostUIReducer(pairedHiddenControls, {
          type: "TOGGLE_CONTROLS",
        });
        expect(newState.controlsVisible).toBe(true);

        newState = hostUIReducer(newState, { type: "TOGGLE_CONTROLS" });
        expect(newState.controlsVisible).toBe(false);
      });

      it("should show controls on SHOW_CONTROLS", () => {
        const state: HostUIState = {
          mode: "paired",
          isFullscreen: true,
          controlsVisible: false,
          controlsTemporary: false,
        };
        const event: HostUIEvent = { type: "SHOW_CONTROLS" };

        const newState = hostUIReducer(state, event);

        expect(newState.controlsVisible).toBe(true);
        expect(newState.controlsTemporary).toBe(false);
      });

      it("should hide controls on HIDE_CONTROLS in paired mode", () => {
        const state: HostUIState = {
          mode: "paired",
          isFullscreen: true,
          controlsVisible: true,
          controlsTemporary: false,
        };
        const event: HostUIEvent = { type: "HIDE_CONTROLS" };

        const newState = hostUIReducer(state, event);

        expect(newState.controlsVisible).toBe(false);
      });
    });

    describe("Hover Behavior (FR-022)", () => {
      it("should show controls temporarily on HOVER_BOTTOM in paired mode", () => {
        const pairedHiddenControls: HostUIState = {
          mode: "paired",
          isFullscreen: true,
          controlsVisible: false,
          controlsTemporary: false,
        };
        const event: HostUIEvent = { type: "HOVER_BOTTOM" };

        const newState = hostUIReducer(pairedHiddenControls, event);

        expect(newState.controlsVisible).toBe(true);
        expect(newState.controlsTemporary).toBe(true);
      });

      it("should not affect controls in standalone mode on HOVER_BOTTOM", () => {
        const state = INITIAL_HOST_UI_STATE;
        const event: HostUIEvent = { type: "HOVER_BOTTOM" };

        const newState = hostUIReducer(state, event);

        expect(newState).toBe(state);
      });

      it("should hide controls on HOVER_TIMEOUT after temporary show", () => {
        const temporaryState: HostUIState = {
          mode: "paired",
          isFullscreen: true,
          controlsVisible: true,
          controlsTemporary: true,
        };
        const event: HostUIEvent = { type: "HOVER_TIMEOUT" };

        const newState = hostUIReducer(temporaryState, event);

        expect(newState.controlsVisible).toBe(false);
        expect(newState.controlsTemporary).toBe(false);
      });

      it("should not hide permanent controls on HOVER_TIMEOUT", () => {
        const permanentState: HostUIState = {
          mode: "paired",
          isFullscreen: true,
          controlsVisible: true,
          controlsTemporary: false,
        };
        const event: HostUIEvent = { type: "HOVER_TIMEOUT" };

        const newState = hostUIReducer(permanentState, event);

        expect(newState.controlsVisible).toBe(true);
      });

      it("should make controls permanent when toggled (not temporary)", () => {
        const temporaryState: HostUIState = {
          mode: "paired",
          isFullscreen: true,
          controlsVisible: true,
          controlsTemporary: true,
        };

        // Hide controls first via TOGGLE_CONTROLS
        const hidden = hostUIReducer(temporaryState, {
          type: "TOGGLE_CONTROLS",
        });
        expect(hidden.controlsVisible).toBe(false);
        expect(hidden.controlsTemporary).toBe(false);

        // Show again via toggle - should be permanent
        const visible = hostUIReducer(hidden, { type: "TOGGLE_CONTROLS" });
        expect(visible.controlsVisible).toBe(true);
        expect(visible.controlsTemporary).toBe(false);
      });
    });

    describe("State Immutability", () => {
      it("should return new state object when state changes", () => {
        const state = INITIAL_HOST_UI_STATE;
        const event: HostUIEvent = { type: "CONTROLLER_CONNECTED" };

        const newState = hostUIReducer(state, event);

        expect(newState).not.toBe(state);
      });

      it("should return same state object when no change needed", () => {
        const standaloneState: HostUIState = {
          mode: "standalone",
          isFullscreen: false,
          controlsVisible: true,
          controlsTemporary: false,
        };
        const event: HostUIEvent = { type: "HOVER_BOTTOM" };

        const newState = hostUIReducer(standaloneState, event);

        expect(newState).toBe(standaloneState);
      });
    });
  });

  describe("createHostUIStore", () => {
    let store: ReturnType<typeof createHostUIStore>;

    beforeEach(() => {
      store = createHostUIStore();
    });

    it("should initialize with default state", () => {
      expect(store.getState()).toEqual(INITIAL_HOST_UI_STATE);
    });

    it("should accept custom initial state", () => {
      const customState: HostUIState = {
        mode: "paired",
        isFullscreen: true,
        controlsVisible: false,
        controlsTemporary: false,
      };
      const customStore = createHostUIStore(customState);

      expect(customStore.getState()).toEqual(customState);
    });

    it("should update state on dispatch", () => {
      store.dispatch({ type: "CONTROLLER_CONNECTED" });

      expect(store.getState().mode).toBe("paired");
    });

    it("should notify listeners on state change", () => {
      const listener = vi.fn();
      store.subscribe(listener);

      store.dispatch({ type: "CONTROLLER_CONNECTED" });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("should not notify listeners when state unchanged", () => {
      // First make it standalone with controls visible
      const standaloneStore = createHostUIStore({
        mode: "standalone",
        isFullscreen: false,
        controlsVisible: true,
        controlsTemporary: false,
      });

      const listener = vi.fn();
      standaloneStore.subscribe(listener);

      // HOVER_BOTTOM should not change state in standalone mode
      standaloneStore.dispatch({ type: "HOVER_BOTTOM" });

      expect(listener).not.toHaveBeenCalled();
    });

    it("should allow unsubscribing", () => {
      const listener = vi.fn();
      const unsubscribe = store.subscribe(listener);

      unsubscribe();
      store.dispatch({ type: "CONTROLLER_CONNECTED" });

      expect(listener).not.toHaveBeenCalled();
    });

    it("should support multiple listeners", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      store.subscribe(listener1);
      store.subscribe(listener2);

      store.dispatch({ type: "CONTROLLER_CONNECTED" });

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });

  describe("resetHostUIStore", () => {
    beforeEach(() => {
      resetHostUIStore();
    });

    afterEach(() => {
      resetHostUIStore();
    });

    it("should reset the global store", () => {
      // This test ensures resetHostUIStore clears the singleton
      // Actual testing of useHostUIState would require a React testing environment
      expect(() => resetHostUIStore()).not.toThrow();
    });
  });
});

