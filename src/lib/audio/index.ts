/**
 * Audio Module
 *
 * Exports for the audio feedback system.
 *
 * @module lib/audio
 */

export {
  audioManager,
  type SoundType,
  type AudioStateSnapshot,
} from "./audio-manager";

export {
  useSoundSync,
  type UseSoundSyncConfig,
  type UseSoundSyncReturn,
  type SoundSyncRole,
  type SoundSyncSocketActions,
  type PendingSoundSync,
  // Re-exported from types
  SoundScope,
  SoundSource,
  type SoundChangeScope,
  type SoundSourceType,
} from "./use-sound-sync";
