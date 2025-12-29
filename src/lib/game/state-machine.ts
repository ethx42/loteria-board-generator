/**
 * Host UI State Machine
 *
 * Implements the state machine for Host Display UI modes.
 * Controls fullscreen behavior and control bar visibility based on
 * controller connection status and user interactions.
 *
 * @module lib/game/state-machine
 * @see SRD §2.4 Host UI State Machine Diagram
 * @see SRD §7.2 Host UI State Machine
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { HostUIState, HostUIEvent } from "@/lib/types/game";
import { INITIAL_HOST_UI_STATE } from "@/lib/types/game";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Duration before temporarily shown controls auto-hide (ms) */
const CONTROLS_TIMEOUT_MS = 3000;

// ============================================================================
// STATE MACHINE REDUCER
// ============================================================================

/**
 * Pure reducer function for Host UI state transitions.
 *
 * State transitions (per SRD §2.4):
 * - standalone → paired: on CONTROLLER_CONNECTED
 * - paired → standalone: on CONTROLLER_DISCONNECTED
 * - paired + hidden controls: ESC toggles controls
 * - paired: HOVER_BOTTOM shows controls temporarily
 * - HOVER_TIMEOUT hides temporary controls
 *
 * @param state - Current state
 * @param event - Event to process
 * @returns New state
 */
export function hostUIReducer(
  state: HostUIState,
  event: HostUIEvent
): HostUIState {
  switch (event.type) {
    // ========================================
    // Connection Events
    // ========================================

    case "CONTROLLER_CONNECTED":
      // Transition to paired mode:
      // - Auto-enter fullscreen (FR-021)
      // - Hide controls (FR-021)
      return {
        mode: "paired",
        isFullscreen: true,
        controlsVisible: false,
        controlsTemporary: false,
      };

    case "CONTROLLER_DISCONNECTED":
      // Transition back to standalone mode:
      // - Maintain current fullscreen state
      // - Show controls (FR-024)
      return {
        mode: "standalone",
        isFullscreen: state.isFullscreen,
        controlsVisible: true,
        controlsTemporary: false,
      };

    // ========================================
    // Fullscreen Events
    // ========================================

    case "ENTER_FULLSCREEN":
      return {
        ...state,
        isFullscreen: true,
      };

    case "EXIT_FULLSCREEN":
      return {
        ...state,
        isFullscreen: false,
      };

    case "TOGGLE_FULLSCREEN":
      return {
        ...state,
        isFullscreen: !state.isFullscreen,
      };

    // ========================================
    // Controls Visibility Events
    // ========================================

    case "TOGGLE_CONTROLS":
      // ESC key toggles in paired mode (FR-023)
      if (state.mode === "paired") {
        return {
          ...state,
          controlsVisible: !state.controlsVisible,
          controlsTemporary: false, // Toggle makes it permanent
        };
      }
      // In standalone, controls are always visible
      return state;

    case "SHOW_CONTROLS":
      return {
        ...state,
        controlsVisible: true,
        controlsTemporary: false,
      };

    case "HIDE_CONTROLS":
      // Only hide in paired mode
      if (state.mode === "paired") {
        return {
          ...state,
          controlsVisible: false,
          controlsTemporary: false,
        };
      }
      return state;

    case "HOVER_BOTTOM":
      // Show controls temporarily on hover (FR-022)
      if (state.mode === "paired" && !state.controlsVisible) {
        return {
          ...state,
          controlsVisible: true,
          controlsTemporary: true,
        };
      }
      // Reset timeout if already visible and temporary
      if (state.mode === "paired" && state.controlsTemporary) {
        return {
          ...state,
          controlsTemporary: true, // Keep temporary flag for timeout reset
        };
      }
      return state;

    case "HOVER_TIMEOUT":
      // Hide controls after timeout (only if temporary)
      if (state.controlsTemporary) {
        return {
          ...state,
          controlsVisible: false,
          controlsTemporary: false,
        };
      }
      return state;

    default:
      return state;
  }
}

// ============================================================================
// EXTERNAL STORE (for useSyncExternalStore)
// ============================================================================

type Listener = () => void;

/**
 * Creates a standalone state store for the Host UI state machine.
 * This can be used outside of React or shared across components.
 */
export function createHostUIStore(
  initialState: HostUIState = INITIAL_HOST_UI_STATE
) {
  let state = initialState;
  const listeners = new Set<Listener>();

  const getState = () => state;

  const subscribe = (listener: Listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const dispatch = (event: HostUIEvent) => {
    const nextState = hostUIReducer(state, event);
    if (nextState !== state) {
      state = nextState;
      listeners.forEach((listener) => listener());
    }
  };

  return { getState, subscribe, dispatch };
}

// ============================================================================
// REACT HOOK
// ============================================================================

/** Singleton store for app-wide Host UI state */
let globalStore: ReturnType<typeof createHostUIStore> | null = null;

function getGlobalStore() {
  if (!globalStore) {
    globalStore = createHostUIStore();
  }
  return globalStore;
}

/**
 * React hook for Host UI state management.
 *
 * Features:
 * - Subscribes to state changes
 * - Handles ESC key for control toggle (FR-023)
 * - Manages hover timeout for temporary controls (FR-022)
 * - Syncs fullscreen API with state
 *
 * @returns State and dispatch function
 *
 * @example
 * ```tsx
 * function HostDisplay() {
 *   const { state, dispatch } = useHostUIState();
 *
 *   return (
 *     <div className={state.isFullscreen ? 'fullscreen' : ''}>
 *       {state.controlsVisible && <ControlsBar />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useHostUIState() {
  const store = getGlobalStore();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subscribe to store using useSyncExternalStore
  const state = useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState // Server snapshot (same as client for this use case)
  );

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Handle hover timeout for temporary controls
  useEffect(() => {
    if (state.controlsTemporary) {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout
      timeoutRef.current = setTimeout(() => {
        store.dispatch({ type: "HOVER_TIMEOUT" });
      }, CONTROLS_TIMEOUT_MS);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [state.controlsTemporary, store]);

  // ESC key handler for control toggle (FR-023)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        store.dispatch({ type: "TOGGLE_CONTROLS" });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [store]);

  // Sync fullscreen API with state
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;

      if (isCurrentlyFullscreen !== state.isFullscreen) {
        store.dispatch({
          type: isCurrentlyFullscreen ? "ENTER_FULLSCREEN" : "EXIT_FULLSCREEN",
        });
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [state.isFullscreen, store]);

  // Dispatch wrapped with useCallback for stable reference
  const dispatch = useCallback(
    (event: HostUIEvent) => {
      store.dispatch(event);
    },
    [store]
  );

  // Action helpers
  const actions = {
    toggleFullscreen: useCallback(async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        } else {
          await document.exitFullscreen();
        }
      } catch {
        // Fullscreen may not be available, just update state
        dispatch({ type: "TOGGLE_FULLSCREEN" });
      }
    }, [dispatch]),

    enterFullscreen: useCallback(async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        dispatch({ type: "ENTER_FULLSCREEN" });
      }
    }, [dispatch]),

    exitFullscreen: useCallback(async () => {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        }
      } catch {
        dispatch({ type: "EXIT_FULLSCREEN" });
      }
    }, [dispatch]),

    showControls: useCallback(() => {
      dispatch({ type: "SHOW_CONTROLS" });
    }, [dispatch]),

    hideControls: useCallback(() => {
      dispatch({ type: "HIDE_CONTROLS" });
    }, [dispatch]),

    toggleControls: useCallback(() => {
      dispatch({ type: "TOGGLE_CONTROLS" });
    }, [dispatch]),

    handleHoverBottom: useCallback(() => {
      dispatch({ type: "HOVER_BOTTOM" });
    }, [dispatch]),

    onControllerConnected: useCallback(() => {
      dispatch({ type: "CONTROLLER_CONNECTED" });
    }, [dispatch]),

    onControllerDisconnected: useCallback(() => {
      dispatch({ type: "CONTROLLER_DISCONNECTED" });
    }, [dispatch]),
  };

  return {
    state,
    dispatch,
    ...actions,
  };
}

/**
 * Reset the global store (useful for testing)
 */
export function resetHostUIStore() {
  globalStore = null;
}
