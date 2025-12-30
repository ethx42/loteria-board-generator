/**
 * Sound Synchronization Hook
 *
 * Single source of truth for sound state and sync across devices.
 * Uses useSyncExternalStore for reactive subscription to AudioManager.
 *
 * ## Design Principles:
 * - Single Source of Truth: AudioManager is the source, React subscribes
 * - DRY: All sound logic in one place
 * - Dependency Inversion: Receives socket actions as props
 *
 * ## Sound Sync Behavior:
 *
 * ### Host initiates change:
 * - Host toggles sound locally
 * - Broadcasts to Controller (scope: local)
 * - Controller shows modal, user decides
 *
 * ### Controller initiates change:
 * - "This device only" (local): Only Controller changes
 * - "Host only" (host_only): Only Host changes
 * - "Both devices" (both): Both change
 *
 * ### Spectators:
 * - Always independent, no sync
 *
 * @module lib/audio/use-sound-sync
 */

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { audioManager, type AudioStateSnapshot } from "./audio-manager";
import {
  SoundScope,
  SoundSource,
  type SoundChangeScope,
  type SoundSourceType,
} from "@/lib/realtime/types";

// ============================================================================
// RE-EXPORTS
// ============================================================================

export { SoundScope, SoundSource };
export type { SoundChangeScope, SoundSourceType };

// ============================================================================
// CONSTANTS
// ============================================================================

const SESSION_STORAGE_KEY = "tabula:sound-sync-dismissed";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Role of the device in the sound sync system.
 */
export type SoundSyncRole = "host" | "controller" | "spectator";

/**
 * Pending sync request from another device.
 */
export interface PendingSoundSync {
  /** Whether sound should be enabled */
  readonly enabled: boolean;
  /** Which device initiated the change */
  readonly source: SoundSourceType;
  /** Scope of the change */
  readonly scope: SoundChangeScope;
}

/**
 * Socket actions interface (dependency injection).
 */
export interface SoundSyncSocketActions {
  /** Send sound preference via WebSocket */
  sendSoundPreference: (
    enabled: boolean,
    source: SoundSourceType,
    scope: SoundChangeScope
  ) => void;
}

/**
 * Configuration for the useSoundSync hook.
 */
export interface UseSoundSyncConfig {
  /** Role of this device */
  role: SoundSyncRole;

  /** Socket actions (optional, required for sync) */
  socket?: SoundSyncSocketActions;

  /** External pending sync (from parent component) */
  externalPendingSync?: PendingSoundSync | null;

  /** Callback when external pending sync is handled */
  onClearExternalPendingSync?: () => void;
}

/**
 * Return type of the useSoundSync hook.
 */
export interface UseSoundSyncReturn {
  // ========== State (from AudioManager subscription) ==========
  /** Whether sound is enabled locally */
  isEnabled: boolean;

  /** Whether audio has been initialized */
  isInitialized: boolean;

  /** Current volume level */
  volume: number;

  /** Whether there's a pending sync request to show modal */
  hasPendingSync: boolean;

  /** Details of pending sync (from Host, for Controller modal) */
  pendingSync: PendingSoundSync | null;

  /** Whether user dismissed sync prompts for this session */
  isSyncDismissed: boolean;

  // ========== Core Audio Actions ==========
  /** Initialize audio (required before playing) */
  initAudio: () => Promise<void>;

  /** Play the card draw sound */
  playCardSound: () => Promise<void>;

  // ========== Host Actions ==========
  /** (Host) Toggle sound and broadcast to Controller */
  hostToggle: () => boolean;

  // ========== Controller Actions ==========
  /** (Controller) Toggle sound on this device only */
  controllerToggleLocal: () => boolean;

  /** (Controller) Set sound on Host only (explicit enable/disable) */
  controllerSetHostOnly: (enabled: boolean) => void;

  /** (Controller) Toggle sound on both devices */
  controllerToggleBoth: () => boolean;

  /** (Controller) Set sound on both devices to a specific state */
  controllerSetBoth: (enabled: boolean) => void;

  // ========== Sync Modal Actions ==========
  /** Accept pending sync (apply other device's preference) */
  acceptSync: () => void;

  /** Decline pending sync (keep local preference) */
  declineSync: () => void;

  /** Dismiss sync prompts for this session (persisted) */
  dismissSyncForSession: () => void;

  // ========== Direct State Control ==========
  /** Set enabled state directly (for Host receiving Controller command) */
  setEnabled: (enabled: boolean) => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if sync was dismissed in session storage.
 */
function loadSyncDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(SESSION_STORAGE_KEY) === "true";
}

/**
 * Save sync dismissed state to session storage.
 */
function saveSyncDismissed(dismissed: boolean): void {
  if (typeof window === "undefined") return;
  if (dismissed) {
    sessionStorage.setItem(SESSION_STORAGE_KEY, "true");
  } else {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Hook for synchronized sound management across devices.
 *
 * Uses useSyncExternalStore for reactive subscription to AudioManager singleton.
 * This ensures all components using this hook stay in sync automatically.
 *
 * @example
 * ```tsx
 * // In Host Page
 * const sound = useSoundSync({
 *   role: "host",
 *   socket: { sendSoundPreference: socket.sendSoundPreference },
 *   externalPendingSync: pendingFromController,
 *   onClearExternalPendingSync: () => setPending(null),
 * });
 *
 * // Handle Controller command silently
 * useEffect(() => {
 *   if (sound.pendingSync?.source === "controller") {
 *     sound.setEnabled(sound.pendingSync.enabled);
 *     sound.declineSync(); // Clear without modal
 *   }
 * }, [sound.pendingSync]);
 *
 * // In ControlsBar
 * <SoundToggle onClick={sound.hostToggle} isEnabled={sound.isEnabled} />
 * ```
 */
export function useSoundSync(config: UseSoundSyncConfig): UseSoundSyncReturn {
  const { role, socket, externalPendingSync, onClearExternalPendingSync } =
    config;

  // ==========================================================================
  // SUBSCRIBE TO AUDIO MANAGER (Single Source of Truth)
  // ==========================================================================

  const audioState: AudioStateSnapshot = useSyncExternalStore(
    audioManager.subscribe,
    audioManager.getSnapshot,
    audioManager.getServerSnapshot
  );

  // Check if dismissed (from session storage)
  const isSyncDismissed = loadSyncDismissed();

  // ==========================================================================
  // CORE AUDIO ACTIONS
  // ==========================================================================

  const initAudio = useCallback(async () => {
    await audioManager.init();
  }, []);

  const playCardSound = useCallback(async () => {
    // Ensure audio is initialized before playing
    // This is safe to call multiple times (idempotent)
    await audioManager.init();
    await audioManager.playCardDraw();
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    audioManager.setEnabled(enabled);
  }, []);

  // ==========================================================================
  // HOST ACTIONS
  // ==========================================================================

  /**
   * Host toggles sound and broadcasts to Controller for optional sync.
   */
  const hostToggle = useCallback(() => {
    const newState = audioManager.toggle();

    // Broadcast to Controller (scope: local means Controller decides)
    if (role === SoundSource.HOST && socket) {
      socket.sendSoundPreference(newState, SoundSource.HOST, SoundScope.LOCAL);
    }

    return newState;
  }, [role, socket]);

  // ==========================================================================
  // CONTROLLER ACTIONS
  // ==========================================================================

  /**
   * Controller toggles sound on this device only.
   * No network message - purely local.
   */
  const controllerToggleLocal = useCallback(() => {
    return audioManager.toggle();
    // No network message for local scope
  }, []);

  /**
   * Controller sets sound on Host only (explicit enable/disable).
   * Controller's sound stays unchanged.
   */
  const controllerSetHostOnly = useCallback(
    (enabled: boolean) => {
      if (role === SoundSource.CONTROLLER && socket) {
        socket.sendSoundPreference(
          enabled,
          SoundSource.CONTROLLER,
          SoundScope.HOST_ONLY
        );
      }
      // Do NOT change local state - only Host changes
    },
    [role, socket]
  );

  /**
   * Controller toggles sound on both devices.
   */
  const controllerToggleBoth = useCallback(() => {
    const newState = audioManager.toggle();

    if (role === SoundSource.CONTROLLER && socket) {
      socket.sendSoundPreference(
        newState,
        SoundSource.CONTROLLER,
        SoundScope.BOTH
      );
    }

    return newState;
  }, [role, socket]);

  /**
   * Controller sets sound on both devices to a specific state.
   * Use this instead of toggle when you know the target state.
   */
  const controllerSetBoth = useCallback(
    (enabled: boolean) => {
      audioManager.setEnabled(enabled);

      if (role === SoundSource.CONTROLLER && socket) {
        socket.sendSoundPreference(
          enabled,
          SoundSource.CONTROLLER,
          SoundScope.BOTH
        );
      }
    },
    [role, socket]
  );

  // ==========================================================================
  // SYNC MODAL ACTIONS
  // ==========================================================================

  /**
   * Accept pending sync from Host.
   */
  const acceptSync = useCallback(() => {
    if (externalPendingSync) {
      audioManager.setEnabled(externalPendingSync.enabled);
    }
    onClearExternalPendingSync?.();
  }, [externalPendingSync, onClearExternalPendingSync]);

  /**
   * Decline pending sync, keep local preference.
   */
  const declineSync = useCallback(() => {
    onClearExternalPendingSync?.();
  }, [onClearExternalPendingSync]);

  /**
   * Dismiss sync prompts for this session (persisted in sessionStorage).
   */
  const dismissSyncForSession = useCallback(() => {
    saveSyncDismissed(true);
    onClearExternalPendingSync?.();
  }, [onClearExternalPendingSync]);

  // ==========================================================================
  // DERIVED STATE
  // ==========================================================================

  // Only show modal for Controller when Host sends preference
  const shouldShowModal =
    role === SoundSource.CONTROLLER &&
    externalPendingSync !== null &&
    externalPendingSync !== undefined &&
    externalPendingSync.source === SoundSource.HOST &&
    !isSyncDismissed;

  // Memoize return object to maintain referential equality
  // This prevents useEffects with [sound] as dependency from re-running
  return useMemo(
    () => ({
      // State (from AudioManager subscription)
      isEnabled: audioState.enabled,
      isInitialized: audioState.initialized,
      volume: audioState.volume,
      hasPendingSync: shouldShowModal,
      pendingSync: shouldShowModal ? externalPendingSync : null,
      isSyncDismissed,

      // Core audio actions
      initAudio,
      playCardSound,

      // Host actions
      hostToggle,

      // Controller actions
      controllerToggleLocal,
      controllerSetHostOnly,
      controllerToggleBoth,
      controllerSetBoth,

      // Sync modal actions
      acceptSync,
      declineSync,
      dismissSyncForSession,

      // Direct state control
      setEnabled,
    }),
    [
      audioState.enabled,
      audioState.initialized,
      audioState.volume,
      shouldShowModal,
      externalPendingSync,
      isSyncDismissed,
      initAudio,
      playCardSound,
      hostToggle,
      controllerToggleLocal,
      controllerSetHostOnly,
      controllerToggleBoth,
      controllerSetBoth,
      acceptSync,
      declineSync,
      dismissSyncForSession,
      setEnabled,
    ]
  );
}

export default useSoundSync;
