/**
 * Game Store
 *
 * Central state management for Tabula game sessions using Zustand.
 * Manages session lifecycle, game actions, and state persistence.
 *
 * @module stores/game-store
 * @see SRD §3.2 GameSession
 * @see SRD §4.2 Game Core Logic
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  GameSession,
  DeckDefinition,
  ItemDefinition,
  GameStatus,
  GameGeneratedBoard,
} from "@/lib/types/game";
import { cryptoShuffle, seededShuffle } from "@/lib/shuffle/crypto-shuffle";

// ============================================================================
// TYPES
// ============================================================================

interface GameState {
  /** Current game session (null if no active session) */
  session: GameSession | null;

  /** Connection status for real-time sync */
  isConnected: boolean;

  /** Loading state */
  isLoading: boolean;

  /** Error message (if any) */
  error: string | null;
}

interface GameActions {
  // Session Lifecycle
  createSession: (
    deck: DeckDefinition,
    boards?: readonly GameGeneratedBoard[],
    roomId?: string
  ) => void;
  loadSession: (session: GameSession) => void;
  resetSession: () => void;
  clearSession: () => void;

  // Game Actions
  drawCard: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  setStatus: (status: GameStatus) => void;

  // Connection
  setConnected: (connected: boolean) => void;
  updateConnection: (
    hostConnected: boolean,
    controllerConnected: boolean,
    controllerId?: string | null
  ) => void;

  // Error handling
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;

  // Selectors (computed values)
  getCurrentItem: () => ItemDefinition | null;
  getHistory: () => readonly ItemDefinition[];
  getRemainingCount: () => number;
  getProgress: () => { current: number; total: number; percentage: number };
}

export type GameStore = GameState & GameActions;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate a 4-character room ID
 */
function generateRoomId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Create a new game session from a deck
 */
function createGameSession(
  deck: DeckDefinition,
  boards: readonly GameGeneratedBoard[] = [],
  roomId?: string
): GameSession {
  const { shuffled, seedUsed } = cryptoShuffle(
    deck.items.map((item) => item.id)
  );

  return {
    id: roomId || generateRoomId(),
    deck,
    boards,
    shuffledDeck: shuffled,
    currentIndex: -1,
    currentItem: null,
    history: [],
    totalItems: deck.items.length,
    shuffleSeed: seedUsed,
    status: "ready",
    connection: {
      hostConnected: true,
      controllerConnected: false,
      controllerId: null,
      lastPing: Date.now(),
    },
  };
}

// ============================================================================
// STORE DEFINITION
// ============================================================================

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      // ========================================
      // Initial State
      // ========================================
      session: null,
      isConnected: false,
      isLoading: false,
      error: null,

      // ========================================
      // Session Lifecycle
      // ========================================

      createSession: (deck, boards = [], roomId) => {
        const session = createGameSession(deck, boards, roomId);
        set({ session, error: null });
      },

      loadSession: (session) => {
        set({ session, error: null });
      },

      resetSession: () => {
        const { session } = get();
        if (!session) return;

        // Reshuffle with new seed
        const { shuffled, seedUsed } = cryptoShuffle(
          session.deck.items.map((item) => item.id)
        );

        set({
          session: {
            ...session,
            shuffledDeck: shuffled,
            currentIndex: -1,
            currentItem: null,
            history: [],
            shuffleSeed: seedUsed,
            status: "ready",
          },
        });
      },

      clearSession: () => {
        set({ session: null, error: null });
      },

      // ========================================
      // Game Actions
      // ========================================

      drawCard: () => {
        const { session } = get();
        if (!session) return;

        const nextIndex = session.currentIndex + 1;

        // Check if we've reached the end
        if (nextIndex >= session.totalItems) {
          set({
            session: {
              ...session,
              status: "finished",
            },
          });
          return;
        }

        // Get the next item
        const nextItemId = session.shuffledDeck[nextIndex];
        const nextItem =
          session.deck.items.find((item) => item.id === nextItemId) || null;

        // Update history (add current item if exists)
        const newHistory =
          session.currentItem !== null
            ? [...session.history, session.currentItem]
            : session.history;

        // Determine new status
        const isLastCard = nextIndex === session.totalItems - 1;
        const newStatus: GameStatus = isLastCard ? "finished" : "playing";

        set({
          session: {
            ...session,
            currentIndex: nextIndex,
            currentItem: nextItem,
            history: newHistory,
            status: newStatus,
          },
        });
      },

      pauseGame: () => {
        const { session } = get();
        if (!session || session.status !== "playing") return;

        set({
          session: {
            ...session,
            status: "paused",
          },
        });
      },

      resumeGame: () => {
        const { session } = get();
        if (!session || session.status !== "paused") return;

        set({
          session: {
            ...session,
            status: "playing",
          },
        });
      },

      setStatus: (status) => {
        const { session } = get();
        if (!session) return;

        set({
          session: {
            ...session,
            status,
          },
        });
      },

      // ========================================
      // Connection
      // ========================================

      setConnected: (connected) => {
        set({ isConnected: connected });
      },

      updateConnection: (hostConnected, controllerConnected, controllerId) => {
        const { session } = get();
        if (!session) return;

        set({
          session: {
            ...session,
            connection: {
              ...session.connection,
              hostConnected,
              controllerConnected,
              controllerId: controllerId ?? session.connection.controllerId,
              lastPing: Date.now(),
            },
          },
        });
      },

      // ========================================
      // Error Handling
      // ========================================

      setError: (error) => set({ error }),
      setLoading: (isLoading) => set({ isLoading }),

      // ========================================
      // Selectors
      // ========================================

      getCurrentItem: () => {
        const { session } = get();
        return session?.currentItem ?? null;
      },

      getHistory: () => {
        const { session } = get();
        return session?.history ?? [];
      },

      getRemainingCount: () => {
        const { session } = get();
        if (!session) return 0;
        return session.totalItems - (session.currentIndex + 1);
      },

      getProgress: () => {
        const { session } = get();
        if (!session) return { current: 0, total: 0, percentage: 0 };

        const current = session.currentIndex + 1;
        const total = session.totalItems;
        const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

        return { current, total, percentage };
      },
    }),
    {
      name: "tabula-game-session",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        session: state.session,
      }),
    }
  )
);

// ============================================================================
// SELECTOR HOOKS
// ============================================================================

/**
 * Select only the session from the store
 */
export const useSession = () => useGameStore((state) => state.session);

/**
 * Select current item
 */
export const useCurrentItem = () =>
  useGameStore((state) => state.session?.currentItem ?? null);

/**
 * Select game status
 */
export const useGameStatus = () =>
  useGameStore((state) => state.session?.status ?? "waiting");

/**
 * Select connection state
 */
export const useConnectionState = () =>
  useGameStore((state) => state.session?.connection ?? null);

/**
 * Select progress
 */
export const useProgress = () => {
  const session = useGameStore((state) => state.session);
  if (!session) return { current: 0, total: 0, percentage: 0 };

  const current = session.currentIndex + 1;
  const total = session.totalItems;
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return { current, total, percentage };
};

