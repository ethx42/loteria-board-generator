# Software Requirements Document (SRD)

## Project: **Tabula v4.0** — Enhanced Game Experience

**Version:** 4.0  
**Status:** Draft for Implementation  
**Last Updated:** December 2024  
**Author:** Adrián (Principal Engineer)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Schema Inconsistencies Resolution](#2-schema-inconsistencies-resolution)
3. [Feature 1: Synchronized History Modal](#3-feature-1-synchronized-history-modal)
4. [Feature 2: Audio Feedback System](#4-feature-2-audio-feedback-system)
5. [Feature 3: Board Prediction Engine](#5-feature-3-board-prediction-engine)
6. [Feature 4: Spectator Mode with Reactions](#6-feature-4-spectator-mode-with-reactions)
7. [Feature 5: Internationalization (i18n)](#7-feature-5-internationalization-i18n)
8. [Technical Specifications](#8-technical-specifications)
9. [Implementation Roadmap](#9-implementation-roadmap)
10. [Appendices](#10-appendices)

---

## 1. Executive Summary

### 1.1 Purpose

This document defines the technical requirements for Tabula v4.0, introducing five major features:

1. **Synchronized History Modal** — Bidirectional state sync between Host and Controller for history display
2. **Audio Feedback System** — Non-intrusive sound effects for card draw events
3. **Board Prediction Engine** — Real-time tracking of board completion status
4. **Spectator Mode with Reactions** — View-only mode with emoji reactions
5. **Internationalization (i18n)** — Multi-language support infrastructure

### 1.2 Design Philosophy

All implementations follow these principles:

| Principle         | Application                                       |
| ----------------- | ------------------------------------------------- |
| **Minimalism**    | UI additions must be non-invasive and toggle-able |
| **Extensibility** | All systems designed for future expansion         |
| **Performance**   | No degradation of real-time sync (<200ms latency) |
| **Accessibility** | WCAG AA compliance maintained                     |
| **Clean Code**    | SOLID principles, DRY, testable units             |

### 1.3 Tech Stack Reference

| Technology    | Version | Purpose                       |
| ------------- | ------- | ----------------------------- |
| Next.js       | 16.x    | App Router, Server Components |
| React         | 19.x    | UI Components                 |
| TypeScript    | 5.x     | Type Safety (strict mode)     |
| PartyKit      | latest  | WebSocket Rooms               |
| next-intl     | 3.x     | Internationalization          |
| Tailwind CSS  | 4.x     | Styling                       |
| Zustand       | 5.x     | State Management              |
| Framer Motion | 12.x    | Animations                    |
| Vitest        | latest  | Testing                       |

---

## 2. Schema Inconsistencies Resolution

### 2.1 Problem Statement

The project has two JSON schemas for boards that are inconsistent:

**Original Lotería JSON:**

```json
{
  "game": "Lotería Barranquilla",
  "total_boards": 15,
  "board_size": "4x4",
  "items_per_board": 16,
  "algorithm": "Spread Distribution",
  "boards": [{
    "board_number": 1,
    "items": ["03 BOLLO DE MAÍZ", ...],
    "grid": [[...], ...]
  }]
}
```

**Generator Output JSON:**

```json
{
  "game": "Lotería",
  "generatedAt": "2025-12-27T18:15:49.509Z",
  "config": {
    "totalItems": 36,
    "numBoards": 100,
    "boardSize": "4×4"
  },
  "stats": { ... },
  "boards": [{
    "id": "board-1",
    "number": 1,
    "items": ["MOJARRA FRITA", ...],
    "grid": [[...], ...]
  }]
}
```

### 2.2 Detected Inconsistencies

| Field            | Original             | Generator                 | Resolution                                |
| ---------------- | -------------------- | ------------------------- | ----------------------------------------- |
| Board identifier | `board_number`       | `number` + `id`           | Use `number` (display) + `id` (reference) |
| Board count      | `total_boards`       | `config.numBoards`        | Normalize to `totalBoards`                |
| Board size       | `board_size: "4x4"`  | `config.boardSize: "4×4"` | Normalize to `boardSize` with `x`         |
| Items per board  | `items_per_board`    | (implicit)                | Calculate from `items.length`             |
| Algorithm        | `algorithm`          | `stats.solver`            | Keep both, different purposes             |
| Item format      | `"03 BOLLO DE MAÍZ"` | `"BOLLO DE MAÍZ"`         | Support both via parser                   |
| Metadata         | None                 | `generatedAt`, `stats`    | Optional fields                           |

### 2.3 Unified Schema Definition

```typescript
// lib/types/boards.ts

/**
 * BoardsManifest
 *
 * Unified schema for board sets. Supports both manually created
 * and generator-output formats.
 */
export interface BoardsManifest {
  /** Game name for display */
  readonly game: string;

  /** Total number of boards in this set */
  readonly totalBoards: number;

  /** Board dimensions (e.g., "4x4", "5x5") */
  readonly boardSize: BoardSize;

  /** Algorithm used for generation (optional) */
  readonly algorithm?: string;

  /** Generation timestamp (optional, ISO 8601) */
  readonly generatedAt?: string;

  /** Generation statistics (optional) */
  readonly stats?: GenerationStats;

  /** Array of board definitions */
  readonly boards: readonly BoardDefinition[];
}

export type BoardSize = "3x3" | "4x4" | "5x5" | "6x6";

export interface GenerationStats {
  readonly maxOverlap: number;
  readonly avgOverlap: number;
  readonly solver: string;
  readonly generationTimeMs: number;
}

export interface BoardDefinition {
  /** Unique identifier for this board */
  readonly id: string;

  /** Display number (1-indexed) */
  readonly number: number;

  /** Flat array of item identifiers on this board */
  readonly items: readonly string[];

  /** 2D grid layout for visual display */
  readonly grid: readonly (readonly string[])[];
}
```

### 2.4 Normalization Utilities

```typescript
// lib/boards/normalize.ts

/**
 * Extracts item ID from potentially prefixed item string.
 * Handles both "03 BOLLO DE MAÍZ" and "BOLLO DE MAÍZ" formats.
 */
export function extractItemId(item: string): string {
  // Match leading numbers with optional space
  const match = item.match(/^(\d{2})\s+(.+)$/);
  if (match) {
    return match[1]; // Return the numeric prefix as ID
  }
  // No prefix, use the full string as ID
  return item;
}

/**
 * Extracts item name from potentially prefixed item string.
 */
export function extractItemName(item: string): string {
  const match = item.match(/^(\d{2})\s+(.+)$/);
  if (match) {
    return match[2]; // Return the name part
  }
  return item; // Already just a name
}

/**
 * Normalizes legacy JSON format to unified schema.
 */
export function normalizeBoards(data: unknown): BoardsManifest {
  // Implementation handles both formats
}
```

---

## 3. Feature 1: Synchronized History Modal

### 3.1 Overview

Enable bidirectional synchronization of the History Modal state between Host and Controller, allowing either device to open/close the modal with changes reflected on both.

### 3.2 Functional Requirements

| ID           | Requirement                                                 | Priority |
| ------------ | ----------------------------------------------------------- | -------- |
| **HIST-001** | Controller shall be able to open the History Modal          | Critical |
| **HIST-002** | Controller shall receive full history data (not just count) | Critical |
| **HIST-003** | Opening modal on one device shall open it on the other      | High     |
| **HIST-004** | Closing modal on one device shall close it on the other     | High     |
| **HIST-005** | Modal state shall survive reconnection                      | Medium   |
| **HIST-006** | History data shall be paginated if >50 items                | Low      |

### 3.3 WebSocket Protocol Extension

```typescript
// lib/realtime/types.ts - New Message Types

/**
 * Request to open the history modal.
 * @direction Host→Server→Controller OR Controller→Server→Host
 */
export interface OpenHistoryMessage {
  readonly type: "OPEN_HISTORY";
}

/**
 * Request to close the history modal.
 * @direction Host→Server→Controller OR Controller→Server→Host
 */
export interface CloseHistoryMessage {
  readonly type: "CLOSE_HISTORY";
}

/**
 * Extended StateUpdatePayload with full history.
 * Sent when history modal is open or on reconnection.
 */
export interface ExtendedStateUpdatePayload extends StateUpdatePayload {
  /** Complete history array (when modal is open) */
  readonly history?: readonly ItemDefinition[];

  /** Whether history modal is currently open */
  readonly isHistoryOpen: boolean;
}

// Update StateUpdateMessage to use extended payload
export interface StateUpdateMessage {
  readonly type: "STATE_UPDATE";
  readonly payload: ExtendedStateUpdatePayload;
}

// Add to WSMessage union
export type WSMessage =
  | /* ...existing... */
  | OpenHistoryMessage
  | CloseHistoryMessage;
```

### 3.4 State Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    HISTORY MODAL SYNC STATE MACHINE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐                    ┌─────────────────┐                │
│  │  Modal CLOSED   │                    │   Modal OPEN    │                │
│  │  (both devices) │                    │  (both devices) │                │
│  └────────┬────────┘                    └────────┬────────┘                │
│           │                                      │                          │
│           │ OPEN_HISTORY (from either)           │ CLOSE_HISTORY (from either)
│           ├──────────────────────────────────────┤                          │
│           │                                      │                          │
│           ▼                                      ▼                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        PARTYKIT SERVER                               │   │
│  │  1. Receive OPEN_HISTORY or CLOSE_HISTORY                           │   │
│  │  2. Update room state (isHistoryOpen)                               │   │
│  │  3. Broadcast to all connections (Host + Controller)                │   │
│  │  4. If opening: Request Host to send full history                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  SYNC GUARANTEE:                                                            │
│  - Single source of truth: Host's history array                            │
│  - Modal state tracked on server for reconnection                          │
│  - History sent as part of STATE_UPDATE when modal is open                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.5 Component Updates

#### RemoteController Changes

```typescript
// app/play/_components/remote-controller.tsx

interface ControllerGameState {
  // ... existing fields
  history: readonly ItemDefinition[]; // NEW: full history array
  isHistoryOpen: boolean; // NEW: modal sync state
}

// Modal opens with actual data
<HistoryModal
  isOpen={gameState.isHistoryOpen}
  onClose={handleCloseHistory}
  history={gameState.history}
  currentItem={gameState.currentItem}
/>;
```

#### HostDisplay Changes

```typescript
// app/play/_components/host-display.tsx

// Listen for OPEN_HISTORY and CLOSE_HISTORY from controller
useEffect(() => {
  const unsubscribe = onMessage((message) => {
    if (message.type === "OPEN_HISTORY") {
      setHistoryModalOpen(true);
      broadcastState(); // Include history in next update
    }
    if (message.type === "CLOSE_HISTORY") {
      setHistoryModalOpen(false);
    }
  });
  return unsubscribe;
}, [onMessage]);
```

### 3.6 Server Updates (PartyKit)

```typescript
// party/game.ts - Add to RoomState

interface RoomState {
  // ... existing fields
  isHistoryOpen: boolean;
}

// Handle OPEN_HISTORY and CLOSE_HISTORY
case "OPEN_HISTORY":
case "CLOSE_HISTORY":
  this.state.isHistoryOpen = msg.type === "OPEN_HISTORY";
  // Broadcast to all connections
  this.room.broadcast(JSON.stringify(msg));
  break;
```

---

## 4. Feature 2: Audio Feedback System

### 4.1 Overview

Add an optional, non-intrusive sound effect when a new card is drawn. The system provides a simple on/off toggle with preference persistence.

### 4.2 Functional Requirements

| ID          | Requirement                                             | Priority |
| ----------- | ------------------------------------------------------- | -------- |
| **AUD-001** | System shall play a sound effect on card draw           | Critical |
| **AUD-002** | Sound shall be toggleable via UI control                | Critical |
| **AUD-003** | Sound preference shall persist in localStorage          | High     |
| **AUD-004** | Sound shall not auto-play on page load (browser policy) | Critical |
| **AUD-005** | Sound shall respect system mute settings                | Medium   |
| **AUD-006** | Sound shall work on both Host and Controller            | High     |

### 4.3 Sound Design Requirements

Based on UX research of successful notification systems (Slack, Duolingo, Apple):

| Property            | Specification                        |
| ------------------- | ------------------------------------ |
| **Duration**        | 200-400ms maximum                    |
| **Frequency Range** | 400-1200Hz (mid-range, non-piercing) |
| **Attack**          | Soft (no harsh transient)            |
| **Decay**           | Quick fade to prevent overlap        |
| **Volume**          | 50% of max by default                |
| **Character**       | Warm, organic (wood/chime-like)      |

### 4.4 Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          AUDIO SYSTEM ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐     ┌──────────────────────────────────────────┐  │
│  │   AudioManager      │     │              React Components            │  │
│  │   (Singleton)       │     │                                          │  │
│  │                     │     │  ┌────────────────────────────────────┐  │  │
│  │  - context: Audio   │◀────│  │ useCardDrawSound()                 │  │  │
│  │  - enabled: boolean │     │  │                                    │  │  │
│  │  - initialized: bool│     │  │ const { playCardSound, toggle,    │  │  │
│  │                     │     │  │         isEnabled } = ...          │  │  │
│  │  + init()           │     │  └────────────────────────────────────┘  │  │
│  │  + playCardDraw()   │     │                                          │  │
│  │  + setEnabled()     │     │  ┌────────────────────────────────────┐  │  │
│  │  + getEnabled()     │     │  │ SoundToggle Component              │  │  │
│  │                     │     │  │                                    │  │  │
│  └─────────────────────┘     │  │ [🔊] / [🔇] (simple toggle)        │  │  │
│           │                  │  └────────────────────────────────────┘  │  │
│           │                  └──────────────────────────────────────────┘  │
│           ▼                                                                 │
│  ┌─────────────────────┐                                                   │
│  │  localStorage       │                                                   │
│  │  "tabula:sound"     │                                                   │
│  │  = "enabled"|"off"  │                                                   │
│  └─────────────────────┘                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.5 Implementation

```typescript
// lib/audio/audio-manager.ts

const STORAGE_KEY = "tabula:sound";

class AudioManager {
  private context: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private enabled: boolean;
  private initialized = false;

  constructor() {
    // Read preference from localStorage
    this.enabled = this.loadPreference();
  }

  private loadPreference(): boolean {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored !== "off"; // Default to enabled
  }

  private savePreference(): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, this.enabled ? "enabled" : "off");
  }

  /**
   * Initialize the audio context.
   * Must be called from a user interaction (click, tap).
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      this.context = new AudioContext();

      // Load the sound file
      const response = await fetch("/sounds/card-draw.mp3");
      const arrayBuffer = await response.arrayBuffer();
      this.buffer = await this.context.decodeAudioData(arrayBuffer);

      this.initialized = true;
    } catch (error) {
      console.warn("Failed to initialize audio:", error);
    }
  }

  /**
   * Play the card draw sound effect.
   */
  async playCardDraw(): Promise<void> {
    if (!this.enabled || !this.context || !this.buffer) return;

    // Resume if suspended (browser autoplay policy)
    if (this.context.state === "suspended") {
      await this.context.resume();
    }

    const source = this.context.createBufferSource();
    source.buffer = this.buffer;
    source.connect(this.context.destination);
    source.start(0);
  }

  /**
   * Toggle sound on/off.
   */
  toggle(): boolean {
    this.enabled = !this.enabled;
    this.savePreference();
    return this.enabled;
  }

  /**
   * Get current enabled state.
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Set enabled state.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.savePreference();
  }
}

// Singleton export
export const audioManager = new AudioManager();
```

### 4.6 React Hook

```typescript
// lib/audio/use-card-draw-sound.ts

import { useCallback, useEffect, useState } from "react";
import { audioManager } from "./audio-manager";

export function useCardDrawSound() {
  const [isEnabled, setIsEnabled] = useState(true);

  // Sync state on mount
  useEffect(() => {
    setIsEnabled(audioManager.isEnabled());
  }, []);

  // Initialize audio context on first user interaction
  const initAudio = useCallback(async () => {
    await audioManager.init();
  }, []);

  // Play the sound
  const playCardSound = useCallback(async () => {
    await audioManager.playCardDraw();
  }, []);

  // Toggle sound
  const toggle = useCallback(() => {
    const newState = audioManager.toggle();
    setIsEnabled(newState);
    return newState;
  }, []);

  return {
    isEnabled,
    playCardSound,
    toggle,
    initAudio,
  };
}
```

### 4.7 UI Component

```typescript
// components/sound-toggle.tsx

import { Volume2, VolumeX } from "lucide-react";
import { useCardDrawSound } from "@/lib/audio/use-card-draw-sound";

export function SoundToggle() {
  const { isEnabled, toggle, initAudio } = useCardDrawSound();

  const handleClick = async () => {
    await initAudio(); // Ensure context is ready
    toggle();
  };

  return (
    <button
      onClick={handleClick}
      className="rounded-full p-2 text-amber-300 hover:bg-amber-800/50 
                 transition-colors cursor-pointer"
      aria-label={isEnabled ? "Mute sounds" : "Enable sounds"}
      title={isEnabled ? "Sound on" : "Sound off"}
    >
      {isEnabled ? (
        <Volume2 className="h-5 w-5" />
      ) : (
        <VolumeX className="h-5 w-5" />
      )}
    </button>
  );
}
```

### 4.8 Integration Points

1. **ControlsBar**: Add `<SoundToggle />` near other controls
2. **doDrawCard()**: Call `playCardSound()` after successful draw
3. **First interaction**: Call `initAudio()` on first button click

---

## 5. Feature 3: Board Prediction Engine

### 5.1 Overview

Track the completion status of physical boards in real-time, showing which boards are close to winning without cluttering the main game UI.

### 5.2 Functional Requirements

| ID          | Requirement                                        | Priority |
| ----------- | -------------------------------------------------- | -------- |
| **BRD-001** | System shall calculate completion % for each board | Critical |
| **BRD-002** | Display shall be minimal and non-invasive          | Critical |
| **BRD-003** | System shall highlight boards >80% complete        | High     |
| **BRD-004** | UI shall be collapsible/hideable                   | High     |
| **BRD-005** | Calculation shall update in real-time on card draw | High     |
| **BRD-006** | System shall support variable board sizes          | Medium   |

### 5.3 Data Model

```typescript
// lib/boards/prediction.ts

/**
 * Prediction result for a single board.
 */
export interface BoardPrediction {
  /** Board identifier */
  readonly id: string;

  /** Display number (1-indexed) */
  readonly number: number;

  /** Total slots on the board */
  readonly totalSlots: number;

  /** Number of slots that have been called */
  readonly filledSlots: number;

  /** Completion percentage (0-100) */
  readonly percentComplete: number;

  /** Items still needed to complete */
  readonly remainingItems: readonly string[];

  /** True if board is 100% complete */
  readonly isComplete: boolean;

  /** True if board is ≥80% complete */
  readonly isAlmostComplete: boolean;
}

/**
 * Summary of all boards.
 */
export interface PredictionSummary {
  /** Total boards being tracked */
  readonly totalBoards: number;

  /** Boards that are complete */
  readonly completedBoards: readonly BoardPrediction[];

  /** Boards that are ≥80% complete */
  readonly almostCompleteBoards: readonly BoardPrediction[];

  /** Top N boards by completion */
  readonly topBoards: readonly BoardPrediction[];
}
```

### 5.4 Algorithm

```typescript
// lib/boards/prediction.ts

/**
 * Calculate board prediction from called items.
 * Time complexity: O(B * I) where B=boards, I=items per board
 * Space complexity: O(C) where C=called items
 */
export function calculateBoardPredictions(
  boards: readonly BoardDefinition[],
  calledItems: ReadonlySet<string>
): PredictionSummary {
  const predictions: BoardPrediction[] = boards.map((board) => {
    const totalSlots = board.items.length;
    const filledSlots = board.items.filter((item) =>
      calledItems.has(normalizeItemId(item))
    ).length;

    const percentComplete = Math.round((filledSlots / totalSlots) * 100);
    const remainingItems = board.items.filter(
      (item) => !calledItems.has(normalizeItemId(item))
    );

    return {
      id: board.id,
      number: board.number,
      totalSlots,
      filledSlots,
      percentComplete,
      remainingItems,
      isComplete: percentComplete === 100,
      isAlmostComplete: percentComplete >= 80,
    };
  });

  // Sort by completion descending
  const sorted = [...predictions].sort(
    (a, b) => b.percentComplete - a.percentComplete
  );

  return {
    totalBoards: boards.length,
    completedBoards: sorted.filter((p) => p.isComplete),
    almostCompleteBoards: sorted.filter(
      (p) => p.isAlmostComplete && !p.isComplete
    ),
    topBoards: sorted.slice(0, 5),
  };
}

/**
 * Normalize item ID for comparison.
 * Handles "03 BOLLO DE MAÍZ" → "03" extraction.
 */
function normalizeItemId(item: string): string {
  const match = item.match(/^(\d{2})\s+/);
  return match ? match[1] : item.toUpperCase().trim();
}
```

### 5.5 React Integration

```typescript
// lib/boards/use-board-predictions.ts

import { useMemo } from "react";
import { calculateBoardPredictions, PredictionSummary } from "./prediction";
import type { BoardDefinition, ItemDefinition } from "@/lib/types";

export function useBoardPredictions(
  boards: readonly BoardDefinition[] | undefined,
  history: readonly ItemDefinition[]
): PredictionSummary | null {
  return useMemo(() => {
    if (!boards || boards.length === 0) return null;

    const calledItemIds = new Set(history.map((item) => item.id));
    return calculateBoardPredictions(boards, calledItemIds);
  }, [boards, history]);
}
```

### 5.6 UI Design (Minimal)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     BOARD STATUS INDICATOR (Minimalist)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  COLLAPSED STATE (default):                                                 │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  📊 2 boards close to winning                              [Expand ▼] │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  EXPANDED STATE (on click):                                                 │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  📊 Board Status                                         [Collapse ▲] │  │
│  │  ────────────────────────────────────────────────────────────────────  │  │
│  │  🏆 #7   ████████████████████░░ 94%  (1 left: TINAJERO)              │  │
│  │  📈 #3   ████████████████░░░░░░ 81%  (3 left)                        │  │
│  │  ────────────────────────────────────────────────────────────────────  │  │
│  │  15 boards total • 0 complete • 2 close                              │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  POSITIONING:                                                               │
│  - Fixed position, bottom-left corner                                      │
│  - Semi-transparent background                                             │
│  - Z-index below controls bar                                              │
│  - Hidden in paired mode (controller connected)                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.7 Component Implementation

```typescript
// components/board-status-indicator.tsx

interface BoardStatusIndicatorProps {
  predictions: PredictionSummary | null;
  isVisible: boolean;
}

export function BoardStatusIndicator({
  predictions,
  isVisible,
}: BoardStatusIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!predictions || !isVisible) return null;

  const { almostCompleteBoards, completedBoards, totalBoards } = predictions;
  const hasNotableBoards =
    almostCompleteBoards.length > 0 || completedBoards.length > 0;

  if (!hasNotableBoards) return null;

  return (
    <div className="fixed bottom-20 left-4 z-30">
      <motion.div
        layout
        className="rounded-xl bg-amber-950/80 backdrop-blur-sm 
                   border border-amber-800/30 overflow-hidden
                   max-w-xs"
      >
        {/* Header - always visible */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-2 flex items-center justify-between
                     text-amber-200 hover:bg-amber-900/50 transition-colors
                     cursor-pointer"
        >
          <span className="flex items-center gap-2 text-sm">
            <BarChart3 className="h-4 w-4" />
            {completedBoards.length > 0
              ? `🎉 ${completedBoards.length} winner${
                  completedBoards.length > 1 ? "s" : ""
                }!`
              : `${almostCompleteBoards.length} board${
                  almostCompleteBoards.length > 1 ? "s" : ""
                } close`}
          </span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* Expanded content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-amber-800/30"
            >
              <div className="px-4 py-3 space-y-2">
                {/* Winners */}
                {completedBoards.map((board) => (
                  <BoardRow key={board.id} board={board} isWinner />
                ))}

                {/* Almost complete */}
                {almostCompleteBoards.slice(0, 3).map((board) => (
                  <BoardRow key={board.id} board={board} />
                ))}

                {/* Summary */}
                <div className="text-xs text-amber-400/60 pt-2 border-t border-amber-800/20">
                  {totalBoards} boards • {completedBoards.length} complete
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
```

---

## 6. Feature 4: Spectator Mode with Reactions

### 6.1 Overview

Allow multiple users to watch a game session passively with the ability to send emoji reactions that appear as animated overlays on the Host display.

### 6.2 Functional Requirements

| ID           | Requirement                                                  | Priority |
| ------------ | ------------------------------------------------------------ | -------- |
| **SPEC-001** | Multiple spectators shall connect without affecting gameplay | Critical |
| **SPEC-002** | Spectators shall receive game state updates                  | Critical |
| **SPEC-003** | Spectators shall NOT be able to send game commands           | Critical |
| **SPEC-004** | Spectators shall be able to send emoji reactions             | High     |
| **SPEC-005** | Reactions shall be rate-limited (1 per second per user)      | High     |
| **SPEC-006** | Reactions shall animate across the Host display              | High     |
| **SPEC-007** | Reaction bursts shall be aggregated on server                | High     |
| **SPEC-008** | System shall display spectator count                         | Medium   |
| **SPEC-009** | Emoji set shall be extensible                                | Medium   |

### 6.3 Client Roles Extension

```typescript
// lib/realtime/types.ts

/**
 * Extended client role to include spectators.
 */
export type ClientRole = "host" | "controller" | "spectator";

/**
 * Available reaction emojis.
 * Extensible: add new emojis here and they propagate everywhere.
 */
export const REACTION_EMOJIS = ["👏", "🎉", "❤️", "😮", "🔥", "👀"] as const;

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

/**
 * Spectator sends a reaction.
 * @direction Spectator→Server→All
 */
export interface SendReactionMessage {
  readonly type: "SEND_REACTION";
  readonly emoji: ReactionEmoji;
}

/**
 * Server broadcasts aggregated reactions.
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
 * Server broadcasts spectator count change.
 * @direction Server→All
 */
export interface SpectatorCountMessage {
  readonly type: "SPECTATOR_COUNT";
  readonly count: number;
}
```

### 6.4 Server Implementation

```typescript
// party/game.ts - Extended for spectators

interface RoomState {
  // ... existing fields
  spectatorIds: Set<string>;
  reactionBuffer: Map<ReactionEmoji, number>;
  lastReactionBroadcast: number;
  reactionCooldowns: Map<string, number>; // spectatorId → timestamp
}

const REACTION_COOLDOWN_MS = 1000;  // 1 second per spectator
const REACTION_BATCH_MS = 500;      // Aggregate every 500ms

private handleSpectatorConnect(conn: Connection): void {
  this.state.spectatorIds.add(conn.id);

  // Confirm join
  send(conn, { type: "ROOM_JOINED", role: "spectator" });

  // Send current game state
  if (this.state.gameState) {
    send(conn, {
      type: "STATE_UPDATE",
      payload: this.state.gameState,
    });
  }

  // Broadcast updated spectator count
  this.broadcastSpectatorCount();
}

private handleReaction(msg: SendReactionMessage, sender: Connection): void {
  // Verify sender is a spectator
  if (!this.state.spectatorIds.has(sender.id)) {
    return; // Silently ignore
  }

  // Rate limiting
  const now = Date.now();
  const lastReaction = this.state.reactionCooldowns.get(sender.id) ?? 0;
  if (now - lastReaction < REACTION_COOLDOWN_MS) {
    return; // Silently ignore (rate limited)
  }
  this.state.reactionCooldowns.set(sender.id, now);

  // Add to buffer
  const current = this.state.reactionBuffer.get(msg.emoji) ?? 0;
  this.state.reactionBuffer.set(msg.emoji, current + 1);

  // Batch broadcast
  if (now - this.state.lastReactionBroadcast > REACTION_BATCH_MS) {
    this.flushReactionBuffer();
  }
}

private flushReactionBuffer(): void {
  if (this.state.reactionBuffer.size === 0) return;

  const reactions = Array.from(this.state.reactionBuffer.entries())
    .map(([emoji, count]) => ({ emoji, count }));

  this.room.broadcast(JSON.stringify({
    type: "REACTION_BURST",
    reactions,
    timestamp: Date.now(),
  }));

  this.state.reactionBuffer.clear();
  this.state.lastReactionBroadcast = Date.now();
}

private broadcastSpectatorCount(): void {
  this.room.broadcast(JSON.stringify({
    type: "SPECTATOR_COUNT",
    count: this.state.spectatorIds.size,
  }));
}
```

### 6.5 Reaction Animation Component

```typescript
// components/reactions-overlay.tsx

interface FloatingReaction {
  id: string;
  emoji: ReactionEmoji;
  x: number;
  startY: number;
  delay: number;
}

interface ReactionsOverlayProps {
  reactions: ReactionBurstMessage["reactions"];
}

export function ReactionsOverlay({ reactions }: ReactionsOverlayProps) {
  const [floating, setFloating] = useState<FloatingReaction[]>([]);

  // Generate floating emojis when new reactions arrive
  useEffect(() => {
    if (reactions.length === 0) return;

    const newFloating: FloatingReaction[] = [];
    let idCounter = 0;

    for (const { emoji, count } of reactions) {
      // Cap at 20 per burst for performance
      const displayCount = Math.min(count, 20);

      for (let i = 0; i < displayCount; i++) {
        newFloating.push({
          id: `${Date.now()}-${idCounter++}`,
          emoji,
          x: 15 + Math.random() * 70, // 15-85% of screen width
          startY: 80 + Math.random() * 10, // Near bottom
          delay: i * 0.03,
        });
      }
    }

    setFloating((prev) => [...prev, ...newFloating]);

    // Cleanup after animation
    const timeoutId = setTimeout(() => {
      setFloating((prev) =>
        prev.filter((r) => !newFloating.some((n) => n.id === r.id))
      );
    }, 2500);

    return () => clearTimeout(timeoutId);
  }, [reactions]);

  const totalCount = reactions.reduce((sum, r) => sum + r.count, 0);
  const isExplosive = totalCount >= 10;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[200] overflow-hidden"
      aria-hidden="true"
    >
      <AnimatePresence>
        {floating.map((reaction) => (
          <motion.span
            key={reaction.id}
            className="absolute text-4xl select-none"
            style={{
              left: `${reaction.x}%`,
              bottom: `${reaction.startY}%`,
            }}
            initial={{
              opacity: 1,
              scale: isExplosive ? 1.5 : 1,
              y: 0,
            }}
            animate={{
              opacity: 0,
              scale: isExplosive ? 0.5 : 0.8,
              y: -300,
              rotate: isExplosive ? (Math.random() - 0.5) * 60 : 0,
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: isExplosive ? 1.2 : 1.8,
              delay: reaction.delay,
              ease: [0.25, 0.46, 0.45, 0.94], // ease-out-quad
            }}
          >
            {reaction.emoji}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}
```

### 6.6 Spectator View

```typescript
// app/play/spectator/page.tsx

export default function SpectatorPage() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get("room");

  const { connectionStatus, gameState, spectatorCount, sendReaction } =
    useSpectatorSocket({ roomId });

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-950 to-amber-900">
      {/* Status bar */}
      <header className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2 text-amber-300/70">
          <Eye className="h-4 w-4" />
          <span>Watching {roomId}</span>
        </div>
        <div className="flex items-center gap-2 text-amber-400/50 text-sm">
          <Users className="h-4 w-4" />
          <span>{spectatorCount} watching</span>
        </div>
      </header>

      {/* Game view (read-only) */}
      <main className="flex flex-col items-center justify-center p-4">
        <SpectatorCard item={gameState?.currentItem} />

        <div className="mt-4 text-center">
          <span className="text-amber-200 font-serif text-xl">
            {gameState?.currentItem?.name ?? "Waiting for game..."}
          </span>
          <span className="block text-amber-400/60 text-sm mt-1">
            Card {(gameState?.currentIndex ?? 0) + 1} of{" "}
            {gameState?.totalItems ?? 0}
          </span>
        </div>
      </main>

      {/* Reaction bar */}
      <footer className="fixed bottom-0 inset-x-0 p-4 bg-amber-950/80 backdrop-blur-sm">
        <div className="flex items-center justify-center gap-3">
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => sendReaction(emoji)}
              className="text-3xl p-2 rounded-full hover:bg-amber-800/50 
                         active:scale-90 transition-all cursor-pointer"
              aria-label={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}
```

---

## 7. Feature 5: Internationalization (i18n)

### 7.1 Overview

Implement a robust internationalization system using `next-intl` to support multiple languages. This is a foundational feature that should be implemented early to avoid technical debt.

### 7.2 Functional Requirements

| ID           | Requirement                                   | Priority |
| ------------ | --------------------------------------------- | -------- |
| **I18N-001** | All user-facing strings shall be externalized | Critical |
| **I18N-002** | Spanish (es) shall be the default language    | Critical |
| **I18N-003** | English (en) shall be supported               | Critical |
| **I18N-004** | Language shall be detected from browser       | High     |
| **I18N-005** | Language shall be switchable at runtime       | High     |
| **I18N-006** | Language preference shall persist             | Medium   |
| **I18N-007** | System shall support pluralization rules      | Medium   |
| **I18N-008** | System shall support ICU message format       | Low      |

### 7.3 Directory Structure

```
src/
├── i18n/
│   ├── config.ts           # i18n configuration
│   ├── request.ts          # Server-side request config
│   └── routing.ts          # Locale routing config
├── messages/
│   ├── es.json             # Spanish translations
│   └── en.json             # English translations
├── app/
│   └── [locale]/           # Locale-prefixed routes
│       ├── layout.tsx
│       ├── page.tsx
│       └── play/
│           └── ...
└── components/
    └── language-switcher.tsx
```

### 7.4 Configuration

```typescript
// src/i18n/config.ts

export const locales = ["es", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "es";

export const localeNames: Record<Locale, string> = {
  es: "Español",
  en: "English",
};

export const localeFlags: Record<Locale, string> = {
  es: "🇪🇸",
  en: "🇺🇸",
};
```

```typescript
// src/i18n/request.ts

import { getRequestConfig } from "next-intl/server";
import { locales, defaultLocale } from "./config";

export default getRequestConfig(async ({ locale }) => {
  // Validate locale
  if (!locales.includes(locale as any)) {
    locale = defaultLocale;
  }

  return {
    messages: (await import(`../messages/${locale}.json`)).default,
    timeZone: "America/Bogota",
    now: new Date(),
  };
});
```

### 7.5 Translation Files Structure

```json
// messages/es.json
{
  "common": {
    "loading": "Cargando...",
    "error": "Error",
    "retry": "Reintentar",
    "close": "Cerrar",
    "back": "Volver"
  },
  "game": {
    "title": "Tabula",
    "waitingForController": "Esperando controlador...",
    "connected": "Conectado",
    "disconnected": "Desconectado",
    "card": {
      "current": "Carta {current} de {total}",
      "draw": "Sacar carta",
      "drawFirst": "Sacar primera carta"
    },
    "status": {
      "waiting": "Esperando",
      "ready": "Listo",
      "playing": "Jugando",
      "paused": "Pausado",
      "finished": "¡Terminado!"
    },
    "controls": {
      "pause": "Pausar",
      "resume": "Reanudar",
      "reset": "Reiniciar",
      "history": "Historial",
      "fullscreen": "Pantalla completa",
      "exitFullscreen": "Salir de pantalla completa",
      "endSession": "Terminar sesión"
    }
  },
  "pairing": {
    "title": "Conectar controlador",
    "scanQr": "Escanea el código QR",
    "orEnterCode": "O ingresa el código",
    "roomCode": "Código de sala: {code}",
    "playStandalone": "Jugar sin controlador"
  },
  "history": {
    "title": "Historial de cartas",
    "cardsPlayed": "{count, plural, =0 {Ninguna carta} =1 {# carta} other {# cartas}} jugadas",
    "clickToExpand": "Clic en una carta para ver detalles",
    "empty": "Aún no se han sacado cartas"
  },
  "spectator": {
    "watching": "Viendo sala {room}",
    "spectatorCount": "{count, plural, =1 {# espectador} other {# espectadores}}",
    "react": "Reaccionar"
  },
  "boards": {
    "status": "Estado de tableros",
    "complete": "{count, plural, =1 {# tablero completo} other {# tableros completos}}",
    "almostComplete": "{count} cerca de ganar",
    "remaining": "{count} restantes"
  },
  "errors": {
    "connectionLost": "Conexión perdida",
    "reconnecting": "Reconectando...",
    "roomNotFound": "Sala no encontrada",
    "controllerAlreadyConnected": "Ya hay un controlador conectado"
  }
}
```

```json
// messages/en.json
{
  "common": {
    "loading": "Loading...",
    "error": "Error",
    "retry": "Retry",
    "close": "Close",
    "back": "Back"
  },
  "game": {
    "title": "Tabula",
    "waitingForController": "Waiting for controller...",
    "connected": "Connected",
    "disconnected": "Disconnected",
    "card": {
      "current": "Card {current} of {total}",
      "draw": "Draw card",
      "drawFirst": "Draw first card"
    },
    "status": {
      "waiting": "Waiting",
      "ready": "Ready",
      "playing": "Playing",
      "paused": "Paused",
      "finished": "Finished!"
    },
    "controls": {
      "pause": "Pause",
      "resume": "Resume",
      "reset": "Reset",
      "history": "History",
      "fullscreen": "Fullscreen",
      "exitFullscreen": "Exit fullscreen",
      "endSession": "End session"
    }
  },
  "pairing": {
    "title": "Connect controller",
    "scanQr": "Scan the QR code",
    "orEnterCode": "Or enter the code",
    "roomCode": "Room code: {code}",
    "playStandalone": "Play without controller"
  },
  "history": {
    "title": "Card History",
    "cardsPlayed": "{count, plural, =0 {No cards} =1 {# card} other {# cards}} played",
    "clickToExpand": "Click a card to see details",
    "empty": "No cards have been drawn yet"
  },
  "spectator": {
    "watching": "Watching room {room}",
    "spectatorCount": "{count, plural, =1 {# viewer} other {# viewers}}",
    "react": "React"
  },
  "boards": {
    "status": "Board Status",
    "complete": "{count, plural, =1 {# board complete} other {# boards complete}}",
    "almostComplete": "{count} almost winning",
    "remaining": "{count} remaining"
  },
  "errors": {
    "connectionLost": "Connection lost",
    "reconnecting": "Reconnecting...",
    "roomNotFound": "Room not found",
    "controllerAlreadyConnected": "A controller is already connected"
  }
}
```

### 7.6 Usage in Components

```typescript
// Example component with i18n

import { useTranslations } from "next-intl";

export function DrawButton({ onDraw, disabled, isFirstCard }) {
  const t = useTranslations("game.card");

  return (
    <button onClick={onDraw} disabled={disabled} className="...">
      {isFirstCard ? t("drawFirst") : t("draw")}
    </button>
  );
}

// With interpolation
export function CardCounter({ current, total }) {
  const t = useTranslations("game.card");

  return <span>{t("current", { current, total })}</span>;
}

// With pluralization
export function HistoryHeader({ count }) {
  const t = useTranslations("history");

  return <h2>{t("cardsPlayed", { count })}</h2>;
}
```

### 7.7 Language Switcher Component

```typescript
// components/language-switcher.tsx

import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { locales, localeNames, localeFlags } from "@/i18n/config";

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (newLocale: string) => {
    // Replace current locale in path
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
  };

  return (
    <select
      value={locale}
      onChange={(e) => handleChange(e.target.value)}
      className="bg-amber-900/50 text-amber-200 rounded-lg px-3 py-1.5
                 border border-amber-700/50 cursor-pointer"
      aria-label="Select language"
    >
      {locales.map((loc) => (
        <option key={loc} value={loc}>
          {localeFlags[loc]} {localeNames[loc]}
        </option>
      ))}
    </select>
  );
}
```

---

## 8. Technical Specifications

### 8.1 File Structure (New/Modified)

```
src/
├── i18n/                           # NEW: i18n configuration
│   ├── config.ts
│   ├── request.ts
│   └── routing.ts
├── messages/                       # NEW: Translation files
│   ├── es.json
│   └── en.json
├── lib/
│   ├── audio/                      # NEW: Audio system
│   │   ├── audio-manager.ts
│   │   └── use-card-draw-sound.ts
│   ├── boards/                     # NEW: Board prediction
│   │   ├── normalize.ts
│   │   ├── prediction.ts
│   │   └── use-board-predictions.ts
│   ├── realtime/
│   │   └── types.ts               # MODIFIED: Add new message types
│   └── types/
│       └── boards.ts              # NEW: Unified board types
├── app/
│   └── [locale]/                  # MODIFIED: Locale prefix
│       └── play/
│           ├── spectator/         # NEW: Spectator view
│           │   └── page.tsx
│           └── ...
├── components/
│   ├── board-status-indicator.tsx # NEW
│   ├── language-switcher.tsx      # NEW
│   ├── reactions-overlay.tsx      # NEW
│   └── sound-toggle.tsx           # NEW
└── public/
    └── sounds/
        └── card-draw.mp3          # NEW: Sound effect file

party/
└── game.ts                        # MODIFIED: Add spectator + reactions
```

### 8.2 Dependencies to Add

```json
{
  "dependencies": {
    "next-intl": "^3.22.0"
  }
}
```

### 8.3 Environment Variables

```env
# .env.local (no changes required for core features)
# Existing NEXT_PUBLIC_PARTYKIT_HOST remains
```

### 8.4 Performance Budgets

| Metric                    | Budget | Notes                          |
| ------------------------- | ------ | ------------------------------ |
| WebSocket message latency | <200ms | Including reaction broadcasts  |
| Audio initialization      | <100ms | Lazy load on first interaction |
| Board prediction calc     | <50ms  | For 100 boards                 |
| Reaction animation FPS    | 60fps  | Cap at 20 simultaneous emojis  |
| i18n bundle overhead      | <10KB  | Per locale                     |

### 8.5 Testing Requirements

| Feature          | Test Type   | Coverage Target |
| ---------------- | ----------- | --------------- |
| History Sync     | Integration | 90%             |
| Audio Manager    | Unit        | 85%             |
| Board Prediction | Unit        | 95%             |
| Spectator Flow   | E2E         | 80%             |
| i18n             | Integration | 85%             |

---

## 9. Implementation Roadmap

### Phase 1: Foundation (Week 1)

| Day | Task                                     | Priority |
| --- | ---------------------------------------- | -------- |
| 1-2 | Implement i18n infrastructure            | Critical |
| 2-3 | Extract all strings to translation files | Critical |
| 3-4 | Add language switcher                    | High     |
| 4-5 | Test and fix i18n edge cases             | High     |

### Phase 2: History Sync (Week 2)

| Day | Task                                         | Priority |
| --- | -------------------------------------------- | -------- |
| 1   | Add OPEN_HISTORY/CLOSE_HISTORY messages      | Critical |
| 2   | Update PartyKit server                       | Critical |
| 2-3 | Update Host to broadcast full history        | High     |
| 3-4 | Update Controller to receive/display history | High     |
| 5   | Test bidirectional sync                      | High     |

### Phase 3: Audio & Boards (Week 2-3)

| Day | Task                                  | Priority |
| --- | ------------------------------------- | -------- |
| 1   | Create AudioManager singleton         | High     |
| 1-2 | Add sound toggle UI                   | High     |
| 2   | Integrate sound with card draw        | High     |
| 3   | Implement board prediction algorithm  | Medium   |
| 4   | Create BoardStatusIndicator component | Medium   |
| 5   | Test with real board data             | Medium   |

### Phase 4: Spectator Mode (Week 3-4)

| Day | Task                                    | Priority |
| --- | --------------------------------------- | -------- |
| 1-2 | Extend PartyKit for spectator role      | High     |
| 2-3 | Create spectator view page              | High     |
| 3-4 | Implement reaction system (server)      | High     |
| 4-5 | Implement ReactionsOverlay (client)     | High     |
| 5   | Performance testing with 50+ spectators | High     |

### Phase 5: Polish (Week 4)

| Day | Task                       | Priority |
| --- | -------------------------- | -------- |
| 1-2 | UI/UX refinements          | Medium   |
| 2-3 | Accessibility audit        | High     |
| 3-4 | Documentation update       | Medium   |
| 4-5 | Final testing and bugfixes | High     |

---

## 10. Appendices

### Appendix A: WebSocket Message Reference (v4.0)

| Message Type              | Direction        | Purpose                       |
| ------------------------- | ---------------- | ----------------------------- |
| `CREATE_ROOM`             | Host→Server      | Create new room               |
| `ROOM_CREATED`            | Server→Host      | Confirm room creation         |
| `JOIN_ROOM`               | Client→Server    | Join existing room            |
| `ROOM_JOINED`             | Server→Client    | Confirm join                  |
| `CONTROLLER_CONNECTED`    | Server→All       | Controller joined             |
| `CONTROLLER_DISCONNECTED` | Server→All       | Controller left               |
| `DRAW_CARD`               | Controller→Host  | Draw next card                |
| `PAUSE_GAME`              | Controller→Host  | Pause game                    |
| `RESUME_GAME`             | Controller→Host  | Resume game                   |
| `RESET_GAME`              | Controller→Host  | Reset game                    |
| `STATE_UPDATE`            | Host→All         | Game state sync               |
| **`OPEN_HISTORY`**        | Any→All          | **NEW**: Open history modal   |
| **`CLOSE_HISTORY`**       | Any→All          | **NEW**: Close history modal  |
| **`SEND_REACTION`**       | Spectator→Server | **NEW**: Send emoji           |
| **`REACTION_BURST`**      | Server→All       | **NEW**: Aggregated reactions |
| **`SPECTATOR_COUNT`**     | Server→All       | **NEW**: Viewer count         |

### Appendix B: Sound Effect Specifications

| Property    | Specification       |
| ----------- | ------------------- |
| Format      | MP3 (fallback: OGG) |
| Duration    | 280ms               |
| Sample Rate | 44.1kHz             |
| Bit Rate    | 128kbps             |
| File Size   | <50KB               |

### Appendix C: Emoji Reaction Set

| Emoji | Meaning     | Use Case          |
| ----- | ----------- | ----------------- |
| 👏    | Applause    | Good card reveal  |
| 🎉    | Celebration | Exciting moment   |
| ❤️    | Love        | Favorite card     |
| 😮    | Surprise    | Unexpected card   |
| 🔥    | Fire        | Streak/hot moment |
| 👀    | Eyes        | Anticipation      |

**Extensibility Note**: To add new emojis:

1. Add to `REACTION_EMOJIS` array in `types.ts`
2. Spectator UI automatically updates
3. Server handles any valid emoji from the array

---

**Document Version:** 4.0  
**Status:** Ready for Implementation  
**Review Date:** December 2024

---

_Tabula v4.0 — Your digital game table, now with even more features_

