/**
 * Audio Manager
 *
 * Singleton class for managing game audio with Web Audio API.
 * Handles browser autoplay policies and user preference persistence.
 *
 * Features:
 * - Lazy initialization (only loads on first user interaction)
 * - Preference persistence via localStorage
 * - Subscription system for React integration (useSyncExternalStore)
 * - Graceful fallback when audio fails
 * - Multiple sound support for future expansion
 *
 * @module lib/audio/audio-manager
 * @see TABULA_V4_DEVELOPMENT_PLAN §5 Phase 2B
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_VOLUME = 0.5;

/**
 * Available sound types in the game.
 * Add new sound types here as the game expands.
 */
export type SoundType = "cardDraw" | "notification";

/**
 * Sound file paths mapped by type.
 */
const SOUND_PATHS: Record<SoundType, string> = {
  cardDraw: "/sound-effects/notif.mp3",
  notification: "/sound-effects/notif.mp3",
};

// ============================================================================
// STATE SNAPSHOT TYPE
// ============================================================================

/**
 * Immutable snapshot of audio state for React integration.
 */
export interface AudioStateSnapshot {
  readonly enabled: boolean;
  readonly initialized: boolean;
  readonly volume: number;
}

// ============================================================================
// SERVER SNAPSHOT (must be stable reference for SSR)
// ============================================================================

/**
 * Stable server snapshot - must be the same object reference every time
 * to avoid infinite loops in useSyncExternalStore.
 */
const SERVER_SNAPSHOT: AudioStateSnapshot = Object.freeze({
  enabled: true,
  initialized: false,
  volume: DEFAULT_VOLUME,
});

// ============================================================================
// AUDIO MANAGER CLASS
// ============================================================================

/**
 * Singleton Audio Manager for game sounds.
 *
 * Uses Web Audio API for precise control and low latency.
 * Falls back gracefully if audio is unavailable.
 *
 * Implements subscription pattern for React useSyncExternalStore.
 *
 * @example
 * ```ts
 * // Initialize on first user interaction
 * await audioManager.init();
 *
 * // Play sound
 * await audioManager.play("cardDraw");
 *
 * // Subscribe to state changes (React)
 * useSyncExternalStore(
 *   audioManager.subscribe,
 *   audioManager.getSnapshot
 * );
 * ```
 */
class AudioManager {
  private context: AudioContext | null = null;
  private buffers: Map<SoundType, AudioBuffer> = new Map();
  private enabled: boolean;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private volume: number = DEFAULT_VOLUME;

  // Subscription system
  private listeners = new Set<() => void>();
  private snapshot: AudioStateSnapshot;

  constructor() {
    // Always start with sound enabled - no persistence needed
    this.enabled = true;
    this.snapshot = this.createSnapshot();
  }

  // ==========================================================================
  // SUBSCRIPTION SYSTEM (React Integration)
  // ==========================================================================

  /**
   * Creates an immutable snapshot of current state.
   */
  private createSnapshot(): AudioStateSnapshot {
    return {
      enabled: this.enabled,
      initialized: this.initialized,
      volume: this.volume,
    };
  }

  /**
   * Notifies all subscribers of state change.
   * Updates snapshot first to ensure consistency.
   */
  private notifyListeners(): void {
    this.snapshot = this.createSnapshot();
    this.listeners.forEach((listener) => listener());
  }

  /**
   * Subscribe to state changes.
   * For use with React's useSyncExternalStore.
   *
   * @param listener - Callback to invoke on state change
   * @returns Unsubscribe function
   */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /**
   * Get current state snapshot.
   * For use with React's useSyncExternalStore.
   */
  getSnapshot = (): AudioStateSnapshot => {
    return this.snapshot;
  };

  /**
   * Get server snapshot (for SSR).
   * Returns a stable frozen object to prevent infinite loops.
   * MUST return the same object reference every time.
   */
  getServerSnapshot = (): AudioStateSnapshot => {
    return SERVER_SNAPSHOT;
  };


  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  /**
   * Initializes the audio context and loads sound files.
   * Must be called from a user interaction handler (click, tap).
   *
   * Safe to call multiple times (idempotent).
   *
   * @returns Promise that resolves when initialization is complete
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInit();
    return this.initPromise;
  }

  /**
   * Internal initialization logic.
   */
  private async doInit(): Promise<void> {
    console.log("[AudioManager] doInit() starting");
    try {
      // Create AudioContext (handles browser prefixes)
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;

      if (!AudioContextClass) {
        console.warn("[AudioManager] Web Audio API not supported");
        return;
      }

      this.context = new AudioContextClass();
      console.log("[AudioManager] AudioContext created, state:", this.context.state);

      // Load all sound files in parallel
      await Promise.all(
        Object.entries(SOUND_PATHS).map(async ([type, path]) => {
          try {
            console.log(`[AudioManager] Loading sound: ${type} from ${path}`);
            const response = await fetch(path);
            if (!response.ok) {
              console.warn(
                `[AudioManager] Failed to fetch ${path}: ${response.status}`
              );
              return;
            }
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.context!.decodeAudioData(arrayBuffer);
            this.buffers.set(type as SoundType, audioBuffer);
            console.log(`[AudioManager] Loaded sound: ${type}, buffer duration: ${audioBuffer.duration}s`);
          } catch (error) {
            console.warn(`[AudioManager] Failed to load ${path}:`, error);
          }
        })
      );

      this.initialized = true;
      console.log("[AudioManager] Initialization complete, buffers:", this.buffers.size);
      this.notifyListeners(); // Notify subscribers of initialization
    } catch (error) {
      console.warn("[AudioManager] Initialization failed:", error);
      // Silent fail - audio is enhancement, not critical
    }
  }

  // ==========================================================================
  // PLAYBACK
  // ==========================================================================

  /**
   * Plays the specified sound.
   * Handles suspended AudioContext (autoplay policy).
   *
   * @param type - Sound type to play (defaults to "cardDraw")
   */
  async play(type: SoundType = "cardDraw"): Promise<void> {
    console.log("[AudioManager] play() called", {
      type,
      enabled: this.enabled,
      hasContext: !!this.context,
      initialized: this.initialized,
    });

    if (!this.enabled) {
      console.log("[AudioManager] Sound disabled, skipping");
      return;
    }
    if (!this.context) {
      console.log("[AudioManager] No context, skipping");
      return;
    }

    const buffer = this.buffers.get(type);
    if (!buffer) {
      console.log("[AudioManager] No buffer for type:", type);
      return;
    }

    try {
      // Resume if suspended (autoplay policy)
      if (this.context.state === "suspended") {
        await this.context.resume();
      }

      // Create source and gain nodes
      const source = this.context.createBufferSource();
      source.buffer = buffer;

      const gainNode = this.context.createGain();
      gainNode.gain.value = this.volume;

      // Connect and play
      source.connect(gainNode);
      gainNode.connect(this.context.destination);
      source.start(0);
    } catch (error) {
      console.warn("[AudioManager] Playback failed:", error);
    }
  }

  /**
   * Plays the card draw sound.
   * Convenience method for the most common sound.
   */
  async playCardDraw(): Promise<void> {
    return this.play("cardDraw");
  }

  // ==========================================================================
  // STATE MANAGEMENT
  // ==========================================================================

  /**
   * Toggles sound on/off.
   *
   * @returns New enabled state
   */
  toggle(): boolean {
    this.enabled = !this.enabled;
    console.log(`[AudioManager] toggle() -> ${this.enabled}`);
    this.notifyListeners();
    return this.enabled;
  }

  /**
   * Checks if sound is enabled.
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Sets enabled state.
   *
   * @param enabled - Whether sound should be enabled
   */
  setEnabled(enabled: boolean): void {
    console.log(`[AudioManager] setEnabled(${enabled}) - current: ${this.enabled}`);
    if (this.enabled === enabled) {
      console.log("[AudioManager] No change, skipping");
      return;
    }
    this.enabled = enabled;
    console.log(`[AudioManager] State changed to: ${this.enabled}`);
    this.notifyListeners();
  }

  /**
   * Sets the volume level.
   *
   * @param volume - Volume level (0.0 to 1.0)
   */
  setVolume(volume: number): void {
    const newVolume = Math.max(0, Math.min(1, volume));
    if (this.volume === newVolume) return;
    this.volume = newVolume;
    this.notifyListeners();
  }

  /**
   * Gets the current volume level.
   */
  getVolume(): number {
    return this.volume;
  }

  /**
   * Checks if audio has been initialized.
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

/**
 * Global AudioManager instance.
 * Use this singleton throughout the application.
 */
export const audioManager = new AudioManager();
