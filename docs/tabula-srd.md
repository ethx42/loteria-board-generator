# Software Requirements Document (SRD)

## Project: **Tabula** — Distributed Lotería Game System

**Version:** 3.0  
**Status:** Approved for Development  
**Last Updated:** December 2024

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Data Models](#3-data-models)
4. [Functional Requirements](#4-functional-requirements)
5. [UI/UX Specifications](#5-uiux-specifications)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Technical Implementation](#7-technical-implementation)
8. [Implementation Roadmap](#8-implementation-roadmap)

---

## 1. Executive Summary

**Tabula** is a web-based digital companion for playing traditional Lotería. It replaces the physical act of drawing cards with a digital randomization engine while adding an **educational dimension** — each card reveals a short text designed to spark conversations.

> *"Tabula"* — from Latin, meaning "board" or "tablet". Evokes both the game boards and the concept of *tabula rasa*: each game session is a fresh start, a new story waiting to be told.

The system features a **dual-interface architecture**:

- **Host Display** (Laptop/TV): Projects the game visuals in cinematic presentation mode
- **Remote Controller** (Mobile): Allows the moderator to control the game flow untethered

### 1.1 Design Principles

| Principle                 | Application                                                       |
| ------------------------- | ----------------------------------------------------------------- |
| **Single Responsibility** | Each component has one reason to change                           |
| **Open/Closed**           | Extensible themes without modifying core logic                    |
| **Dependency Inversion**  | UI depends on abstractions, not concrete realtime implementations |
| **KISS**                  | Minimal viable data model, no premature optimization              |
| **DRY**                   | Shared components between Host and Controller views               |

---

## 2. System Architecture

### 2.1 High-Level Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ARCHITECTURE OVERVIEW                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         NEXT.JS 16 APP                               │   │
│  │                                                                       │   │
│  │   /generator (existing)              /play (new)                     │   │
│  │   ┌─────────────────┐               ┌─────────────────────────────┐  │   │
│  │   │ Board Generator │               │ Game Controller             │  │   │
│  │   │ - Items Input   │   exports     │                             │  │   │
│  │   │ - Distribution  │──────────────▶│ - Session Management        │  │   │
│  │   │ - HiGHS Solver  │   DeckDef     │ - Host Display              │  │   │
│  │   │ - Export        │               │ - Remote Controller         │  │   │
│  │   └─────────────────┘               └─────────────────────────────┘  │   │
│  │                                              │                        │   │
│  └──────────────────────────────────────────────┼────────────────────────┘   │
│                                                 │                            │
│                                                 ▼                            │
│                                    ┌─────────────────────┐                  │
│                                    │   PARTYKIT (Edge)   │                  │
│                                    │                     │                  │
│                                    │  - Room Management  │                  │
│                                    │  - State Sync       │                  │
│                                    │  - Event Relay      │                  │
│                                    └─────────────────────┘                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Technology Stack

| Layer          | Technology    | Version | Purpose                                           |
| -------------- | ------------- | ------- | ------------------------------------------------- |
| **Framework**  | Next.js       | 16.x    | App Router, Server Components, Image Optimization |
| **Runtime**    | React         | 19.x    | UI Components, Concurrent Features                |
| **Language**   | TypeScript    | 5.x     | Type Safety                                       |
| **Styling**    | Tailwind CSS  | 4.x     | Utility-first CSS, CSS Variables                  |
| **Animation**  | Framer Motion | 12.x    | Physics-based animations                          |
| **State**      | Zustand       | 5.x     | Local state management                            |
| **Realtime**   | Partykit      | latest  | Edge-native WebSocket rooms                       |
| **Components** | Radix UI      | latest  | Accessible primitives                             |
| **Icons**      | Lucide React  | latest  | Icon system                                       |

### 2.3 Design Patterns Applied

| Pattern           | Usage                                        |
| ----------------- | -------------------------------------------- |
| **State Machine** | Host UI modes (standalone, paired, override) |
| **Observer**      | Realtime state synchronization               |
| **Strategy**      | Shuffle algorithms (crypto vs seeded)        |
| **Facade**        | Unified realtime client interface            |
| **Adapter**       | DeckDefinition → GameSession transformation  |
| **Composite**     | Nested UI component structure                |

### 2.4 Host UI State Machine Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HOST UI STATE MACHINE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────┐                                               │
│  │     STANDALONE          │                                               │
│  │  ───────────────────    │                                               │
│  │  • Windowed or FS       │                                               │
│  │  • Controls: VISIBLE    │                                               │
│  │  • No controller        │                                               │
│  └───────────┬─────────────┘                                               │
│              │                                                              │
│              │ CONTROLLER_CONNECTED                                         │
│              ▼                                                              │
│  ┌─────────────────────────┐         ┌─────────────────────────┐           │
│  │     PAIRED              │         │     OVERRIDE            │           │
│  │  ───────────────────    │ TOGGLE  │  ───────────────────    │           │
│  │  • Fullscreen: AUTO     │◀───────▶│  • Fullscreen: ON       │           │
│  │  • Controls: HIDDEN     │ ESC key │  • Controls: VISIBLE    │           │
│  │  • Controller active    │ or hover│  • Temporary mode       │           │
│  └───────────┬─────────────┘         └──────────┬──────────────┘           │
│              │                                   │                          │
│              │ CONTROLLER_DISCONNECTED           │ 3s timeout               │
│              │                                   │ (auto-hide)              │
│              ▼                                   │                          │
│  ┌─────────────────────────┐                    │                          │
│  │     STANDALONE          │◀───────────────────┘                          │
│  │  (fullscreen maintained)│                                               │
│  │  • Controls: VISIBLE    │                                               │
│  └─────────────────────────┘                                               │
│                                                                             │
│  NOTES:                                                                     │
│  • ESC key always toggles controls in PAIRED mode                          │
│  • Hover on bottom edge shows controls temporarily (3s timeout)            │
│  • User can manually exit fullscreen at any time                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Models

### 3.1 Core Types

```typescript
/**
 * ItemDefinition
 * Represents a single card in the Lotería deck.
 * Follows Single Responsibility: only card data, no behavior.
 */
interface ItemDefinition {
  /** Unique identifier (e.g., "01", "sol-01") */
  id: string;

  /** Display name (e.g., "El Sol") */
  name: string;

  /** Path to card image. Next.js Image handles optimization. */
  imageUrl: string;

  /** Short educational text shown alongside the card */
  shortText: string;

  /** Extended text shown on card flip (optional) */
  longText?: string;

  /** Category for grouping (optional) */
  category?: string;

  /** Dominant color for UI accents (optional, can be extracted) */
  themeColor?: string;
}

/**
 * DeckDefinition
 * Complete deck configuration. Immutable during gameplay.
 */
interface DeckDefinition {
  /** Unique deck identifier */
  id: string;

  /** Display name */
  name: string;

  /** Optional description */
  description?: string;

  /** Language code (ISO 639-1) */
  language: string;

  /** Ordered array of items in the deck */
  items: ItemDefinition[];

  /** Visual theme (optional) */
  theme?: DeckTheme;
}

/**
 * DeckTheme
 * Visual customization for the deck.
 */
interface DeckTheme {
  primaryColor: string;
  secondaryColor?: string;
  fontFamily?: string;
  backgroundUrl?: string;
}

/**
 * GeneratedBoard
 * Output from the Generator. References items by ID only.
 */
interface GeneratedBoard {
  id: string;
  boardNumber: number;
  itemIds: string[];
  grid: string[][];
}
```

### 3.2 Game Session Types

```typescript
/**
 * GameSession
 * Runtime state during active gameplay.
 * Managed by the Host, synchronized to Controller.
 */
interface GameSession {
  /** Unique session/room identifier (e.g., "ABCD") */
  id: string;

  /** Complete deck data */
  deck: DeckDefinition;

  /** Generated boards (if playing with boards) */
  boards: GeneratedBoard[];

  /** Shuffled item IDs (the draw pile) */
  shuffledDeck: string[];

  /** Current position in the shuffled deck */
  currentIndex: number;

  /** Currently displayed item (resolved from ID) */
  currentItem: ItemDefinition | null;

  /** Previously called items */
  history: ItemDefinition[];

  /** Total items in deck */
  totalItems: number;

  /** Seed used for shuffle (for reproducibility) */
  shuffleSeed: number;

  /** Session status */
  status: GameStatus;

  /** Connection state */
  connection: ConnectionState;
}

type GameStatus =
  | "waiting" // Waiting for controller
  | "ready" // Controller connected, game not started
  | "playing" // Game in progress
  | "paused" // Game paused
  | "finished"; // All cards drawn

interface ConnectionState {
  hostConnected: boolean;
  controllerConnected: boolean;
  controllerId: string | null;
  lastPing: number;
}
```

### 3.3 UI State Types

```typescript
/**
 * HostUIState
 * State machine for Host Display UI modes.
 */
interface HostUIState {
  /** Current UI mode */
  mode: "standalone" | "paired";

  /** Fullscreen state */
  isFullscreen: boolean;

  /** Controls visibility */
  controlsVisible: boolean;

  /** Controls temporarily shown (hover/timeout) */
  controlsTemporary: boolean;
}

/**
 * HostUIEvent
 * Events that trigger UI state transitions.
 */
type HostUIEvent =
  | { type: "CONTROLLER_CONNECTED" }
  | { type: "CONTROLLER_DISCONNECTED" }
  | { type: "ENTER_FULLSCREEN" }
  | { type: "EXIT_FULLSCREEN" }
  | { type: "SHOW_CONTROLS" }
  | { type: "HIDE_CONTROLS" }
  | { type: "CONTROLS_TIMEOUT" };
```

### 3.4 Realtime Protocol

```typescript
/**
 * WebSocket Event Protocol
 * C→S: Client to Server (Partykit)
 * S→C: Server to Client
 * S→A: Server to All (broadcast)
 */

// Room Management
type CreateRoom = { type: "CREATE_ROOM" }; // C→S (Host)
type RoomCreated = { type: "ROOM_CREATED"; roomId: string }; // S→C (Host)
type JoinRoom = { type: "JOIN_ROOM"; roomId: string }; // C→S (Controller)
type RoomJoined = { type: "ROOM_JOINED" }; // S→C (Controller)

// Connection Events
type ControllerConnected = { type: "CONTROLLER_CONNECTED" }; // S→A
type ControllerDisconnected = { type: "CONTROLLER_DISCONNECTED" }; // S→A

// Game Commands (Controller → Host via Server)
type DrawCard = { type: "DRAW_CARD" };
type PauseGame = { type: "PAUSE_GAME" };
type ResumeGame = { type: "RESUME_GAME" };
type ResetGame = { type: "RESET_GAME" };

// State Updates (Host → Controller via Server)
type StateUpdate = {
  type: "STATE_UPDATE";
  payload: {
    currentItem: ItemDefinition | null;
    currentIndex: number;
    totalItems: number;
    status: GameStatus;
  };
};

type WSMessage =
  | CreateRoom
  | RoomCreated
  | JoinRoom
  | RoomJoined
  | ControllerConnected
  | ControllerDisconnected
  | DrawCard
  | PauseGame
  | ResumeGame
  | ResetGame
  | StateUpdate;
```

### 3.5 Example Deck JSON

```json
{
  "id": "deck-example",
  "name": "Lotería Universal",
  "description": "A universal deck for family play",
  "language": "es",
  "items": [
    {
      "id": "01",
      "name": "El Sol",
      "imageUrl": "/decks/universal/sol.png",
      "shortText": "El sol sale para todos, pero no todos lo ven igual.",
      "longText": "En muchas culturas antiguas, el sol representaba el renacimiento diario. Los egipcios lo adoraban como Ra, los aztecas como Tonatiuh.",
      "category": "Naturaleza"
    },
    {
      "id": "02",
      "name": "La Luna",
      "imageUrl": "/decks/universal/luna.png",
      "shortText": "La luna llena ilumina los secretos de la noche.",
      "longText": "La luna ha guiado a navegantes, inspirado a poetas y marcado calendarios desde tiempos inmemoriales.",
      "category": "Naturaleza"
    },
    {
      "id": "03",
      "name": "La Estrella",
      "imageUrl": "/decks/universal/estrella.png",
      "shortText": "Cada estrella es un sol en otro lugar del universo.",
      "category": "Naturaleza"
    }
  ],
  "theme": {
    "primaryColor": "#8B4513",
    "fontFamily": "Recoleta, serif"
  }
}
```

---

## 4. Functional Requirements

### 4.1 Session Management & Pairing

| ID         | Requirement                                                                                                    | Priority |
| ---------- | -------------------------------------------------------------------------------------------------------------- | -------- |
| **FR-001** | System shall generate a unique 4-character Session ID upon Host initialization                                 | Critical |
| **FR-002** | Host shall display a QR Code containing the Controller URL with embedded Session ID                            | Critical |
| **FR-003** | Controller shall auto-join the session when QR URL is scanned                                                  | Critical |
| **FR-004** | Upon Controller connection, Host shall: (a) enter fullscreen, (b) hide controls, (c) show connection indicator | Critical |
| **FR-005** | System shall support manual Session ID entry via URL parameter (`/play/join?code=ABCD`)                        | High     |
| **FR-006** | System shall auto-reconnect within 5 seconds if connection drops                                               | High     |
| **FR-007** | If Host disconnects: Controller shows "Reconnecting..." for 10s, then "Connection Lost" with retry button      | High     |
| **FR-008** | If Host disconnects while Controller was connected: Host UI shows controls automatically upon reload           | High     |

### 4.2 Game Core Logic

| ID          | Requirement                                                                                                                       | Priority |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------- | -------- |
| **FR-010**  | System shall load DeckDefinition from JSON                                                                                        | Critical |
| **FR-010a** | System shall include a built-in demo deck for immediate play without configuration                                                | Critical |
| **FR-010b** | System shall allow users to upload their own DeckDefinition JSON files                                                            | Critical |
| **FR-011**  | System shall shuffle deck using CSPRNG with saved seed                                                                            | Critical |
| **FR-012**  | Upon DRAW_CARD command, system shall: (a) advance index, (b) update currentItem, (c) add previous to history, (d) broadcast state | Critical |
| **FR-013**  | System shall track remaining card count                                                                                           | High     |
| **FR-014**  | System shall support PAUSE and RESUME commands                                                                                    | Medium   |
| **FR-015**  | System shall support RESET to reshuffle and restart                                                                               | Medium   |
| **FR-016**  | System shall preload next 3 card images in background for instant display                                                         | High     |
| **FR-017**  | DeckDefinition theme (if provided) shall be applied at session start via CSS variables                                            | Medium   |

### 4.3 Host UI Modes

| ID         | Requirement                                                                 | Priority |
| ---------- | --------------------------------------------------------------------------- | -------- |
| **FR-020** | In Standalone mode: controls visible, windowed or fullscreen by user choice | Critical |
| **FR-021** | In Paired mode: auto-fullscreen, controls hidden by default                 | Critical |
| **FR-022** | In Paired mode: controls appear on bottom hover (3s timeout)                | High     |
| **FR-023** | In Paired mode: ESC key toggles controls visibility                         | High     |
| **FR-024** | If Controller disconnects: controls become visible, fullscreen maintained   | High     |

### 4.4 Card Display

| ID          | Requirement                                                                 | Priority |
| ----------- | --------------------------------------------------------------------------- | -------- |
| **FR-030**  | Host shall display current card image (vertical, 2:3 aspect ratio)          | Critical |
| **FR-031**  | Host shall display card name prominently                                    | Critical |
| **FR-032**  | Host shall display shortText alongside the card (not below)                 | Critical |
| **FR-033**  | Host shall display card counter (current/total)                             | High     |
| **FR-034**  | Card shall flip on click to reveal longText (if available)                  | Medium   |
| **FR-035**  | Recent strip shall show as many past cards as space allows (dynamic sizing) | High     |
| **FR-035a** | On wide screens (≥1400px): strip displays vertically on right side          | High     |
| **FR-035b** | On standard screens: strip displays horizontally at bottom                  | High     |
| **FR-035c** | Visual hierarchy must clearly indicate recency (newest = most prominent)    | High     |

### 4.5 History & Feedback

| ID         | Requirement                                                                      | Priority |
| ---------- | -------------------------------------------------------------------------------- | -------- |
| **FR-040** | System shall provide "History Modal" showing all called cards in grid            | High     |
| **FR-041** | History modal accessible from both Host and Controller                           | High     |
| **FR-042** | Controller shall display mini-card sync with Host current card                   | High     |
| **FR-043** | Recent strip shall animate new cards entering from the right                     | Medium   |
| **FR-044** | History modal shall show cards in chronological order (first called at top-left) | Medium   |
| **FR-045** | Clicking a card in History modal shall show its educational text                 | Low      |

---

## 5. UI/UX Specifications

### 5.1 Host Display Layout

**Layout A: Wide Screens (≥1400px) — Vertical History Strip**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      HOST DISPLAY (Wide Screen - Fullscreen)                │
│                                                                             │
│  ┌───────────────────────────────────────────────────────┐  ┌───────────┐  │
│  │                                                       │  │  ┌─────┐  │  │
│  │   ┌─────────────────┐   ┌──────────────────────────┐  │  │  │ NEW │  │  │
│  │   │                 │   │                          │  │  │  │ EST │  │  │
│  │   │                 │   │       "EL SOL"           │  │  │  └─────┘  │  │
│  │   │                 │   │                          │  │  │  ┌─────┐  │  │
│  │   │   CARD IMAGE    │   │  ─────────────────────   │  │  │  │     │  │  │
│  │   │   (vertical)    │   │                          │  │  │  │     │  │  │
│  │   │                 │   │  "El sol sale para       │  │  │  └─────┘  │  │
│  │   │   aspect-ratio  │   │   todos, pero no todos   │  │  │  ┌─────┐  │  │
│  │   │   2:3           │   │   lo ven igual."         │  │  │  │     │  │  │
│  │   │                 │   │                          │  │  │  │     │  │  │
│  │   │   click to flip │   │                 [12/36]  │  │  │  └─────┘  │  │
│  │   │                 │   │                          │  │  │     ⋮     │  │
│  │   └─────────────────┘   └──────────────────────────┘  │  │  ┌─────┐  │  │
│  │                                                       │  │  │ OLD │  │  │
│  │                                         ● Connected   │  │  │ EST │  │  │
│  └───────────────────────────────────────────────────────┘  │  └─────┘  │  │
│                                                             └───────────┘  │
│  ══════════════════════════════════════════════════════════════════════════│
│  │ Controls Bar (hidden in paired mode, hover to reveal)                  ││
│  │ [Draw Card]  [Pause]  [History]  [Fullscreen]  [Disconnect]           ││
│  ══════════════════════════════════════════════════════════════════════════│
└─────────────────────────────────────────────────────────────────────────────┘
                                                              ▲
                                                              │
                                                    History Strip (vertical)
                                                    Newest at top
                                                    Shows all that fit
```

**Layout B: Standard Screens (<1400px) — Horizontal History Strip**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    HOST DISPLAY (Standard Screen - Fullscreen)              │
│                                                                             │
│     ┌─────────────────┐          ┌────────────────────────────────────┐    │
│     │                 │          │                                    │    │
│     │                 │          │         "EL SOL"                   │    │
│     │                 │          │                                    │    │
│     │                 │          │  ─────────────────────────────────  │    │
│     │   CARD IMAGE    │          │                                    │    │
│     │   (vertical)    │          │  "El sol sale para todos,         │    │
│     │                 │          │   pero no todos lo ven igual."    │    │
│     │   aspect-ratio  │          │                                    │    │
│     │   2:3           │          │                                    │    │
│     │                 │          │                          [12/36]   │    │
│     │   click to      │          │                                    │    │
│     │   flip          │          └────────────────────────────────────┘    │
│     │                 │                                     ● Connected    │
│     └─────────────────┘                                                     │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ ┌────┐ ┌────┐ ┌────┐ ┌────┐  ···  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ │  │
│  │ │OLD │ │    │ │    │ │    │  ···  │    │ │    │ │    │ │    │ │NEW │ │  │
│  │ └────┘ └────┘ └────┘ └────┘  ···  └────┘ └────┘ └────┘ └────┘ └────┘ │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│     ▲                      History Strip (horizontal)                 ▲    │
│  oldest ──────────────────────────────────────────────────────── newest    │
│                                                                             │
│  ══════════════════════════════════════════════════════════════════════════│
│  │ Controls Bar (hidden in paired mode, hover to reveal)                  ││
│  │ [Draw Card]  [Pause]  [History]  [Fullscreen]  [Disconnect]           ││
│  ══════════════════════════════════════════════════════════════════════════│
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Remote Controller Layout

```
┌─────────────────────────────────────────┐
│         REMOTE CONTROLLER (Mobile)      │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │      Connection Status          │   │
│  │      ● Connected to ABCD        │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │                                 │   │
│  │         Mini Card               │   │
│  │         (current)               │   │
│  │                                 │   │
│  │         "El Sol"                │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │                                 │   │
│  │                                 │   │
│  │         SACAR CARTA             │   │
│  │                                 │   │
│  │         (Giant Button)          │   │
│  │         Haptic Feedback         │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌───────────┐      ┌───────────┐      │
│  │  Pause    │      │  History  │      │
│  └───────────┘      └───────────┘      │
│                                         │
│              [12 / 36]                  │
│                                         │
└─────────────────────────────────────────┘
```

### 5.3 Visual Design System

#### Color Palette (CSS Variables)

```css
:root {
  /* Core palette */
  --color-background: #1a1a1a;
  --color-surface: #2a2a2a;
  --color-primary: #d4a574;
  --color-primary-muted: #8b7355;
  --color-text: #f5f5f5;
  --color-text-muted: #a0a0a0;

  /* Semantic */
  --color-success: #4ade80;
  --color-warning: #fbbf24;
  --color-error: #f87171;

  /* Spacing scale */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;

  /* Typography */
  --font-display: "Recoleta", Georgia, serif;
  --font-body: "Inter", system-ui, sans-serif;

  /* Animation */
  --duration-fast: 150ms;
  --duration-normal: 300ms;
  --duration-slow: 500ms;
  --easing-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Deck theme override example */
[data-theme="vintage"] {
  --color-primary: #8b4513;
  --color-background: #2d1f14;
}
```

### 5.4 Animation Specifications

| Element                  | Animation                                   | Timing                              |
| ------------------------ | ------------------------------------------- | ----------------------------------- |
| **Card Entrance**        | rotateY(-90°) → rotateY(0°)                 | spring(stiffness: 200, damping: 20) |
| **Card Exit**            | rotateY(0°) → rotateY(90°)                  | spring(stiffness: 200, damping: 20) |
| **Text Panel**           | opacity: 0, x: 50 → opacity: 1, x: 0        | 500ms ease, 300ms delay             |
| **Card Flip**            | rotateY(0°) ↔ rotateY(180deg)               | spring(stiffness: 300, damping: 30) |
| **Strip Card Enter**     | scale: 0, opacity: 0 → scale: 1, opacity: 1 | spring, from main card position     |
| **Strip Cards Shift**    | translateX/Y to new position                | 300ms ease-out                      |
| **Strip Card Exit**      | opacity: 1 → opacity: 0, scale: 0.8         | 200ms ease-in                       |
| **Controls Reveal**      | y: 100% → y: 0                              | 300ms ease-out                      |
| **Connection Indicator** | pulse animation                             | 2s infinite                         |

### 5.5 Responsive Breakpoints

| Breakpoint     | Target         | Layout Adjustments                |
| -------------- | -------------- | --------------------------------- |
| **< 640px**    | Mobile         | Controller layout, stack elements |
| **640-1024px** | Tablet         | Condensed Host layout             |
| **> 1024px**   | Desktop/TV     | Full Host layout with side text   |
| **> 1920px**   | Large displays | Increased spacing and typography  |

### 5.6 History Strip Component (Adaptive Layout)

The History Strip displays ALL past cards that fit in the available space, with clear visual hierarchy indicating recency.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    HISTORY STRIP - ADAPTIVE LAYOUT                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LAYOUT A: VERTICAL (Wide screens ≥1400px)                                 │
│  Position: Right side of screen, full height                               │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                                                                       │ │
│  │   ┌──────────────────────────────────┐          ┌────────────────┐   │ │
│  │   │                                  │          │  ┌──────────┐  │   │ │
│  │   │                                  │          │  │ NEWEST   │←─│───│─│─ Most recent
│  │   │         MAIN CARD                │          │  │ opacity:1│  │   │ │   (top)
│  │   │         + TEXT PANEL             │          │  └──────────┘  │   │ │
│  │   │                                  │          │  ┌──────────┐  │   │ │
│  │   │                                  │          │  │ 2nd      │  │   │ │
│  │   │                                  │          │  │ op: 0.85 │  │   │ │
│  │   │                                  │          │  └──────────┘  │   │ │
│  │   │                                  │          │  ┌──────────┐  │   │ │
│  │   │                                  │          │  │ 3rd      │  │   │ │
│  │   │                                  │          │  │ op: 0.70 │  │   │ │
│  │   │                                  │          │  └──────────┘  │   │ │
│  │   │                                  │          │  ┌──────────┐  │   │ │
│  │   │                                  │          │  │ 4th      │  │   │ │
│  │   │                                  │          │  │ op: 0.55 │  │   │ │
│  │   │                                  │          │  └──────────┘  │   │ │
│  │   │                                  │          │       ⋮        │   │ │
│  │   │                                  │          │  ┌──────────┐  │   │ │
│  │   └──────────────────────────────────┘          │  │ OLDEST   │←─│───│─│─ Oldest
│  │                                                 │  │ op: 0.40 │  │   │ │   (bottom)
│  │                                                 │  └──────────┘  │   │ │
│  │                                                 └────────────────┘   │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  LAYOUT B: HORIZONTAL (Standard screens <1400px)                           │
│  Position: Bottom of screen, full width                                    │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                                                                       │ │
│  │   ┌──────────────────────────────────────────────────────────────┐   │ │
│  │   │                                                              │   │ │
│  │   │                    MAIN CARD + TEXT PANEL                    │   │ │
│  │   │                                                              │   │ │
│  │   └──────────────────────────────────────────────────────────────┘   │ │
│  │                                                                       │ │
│  │   ┌────────────────────────────────────────────────────────────────┐ │ │
│  │   │                                                                │ │ │
│  │   │ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐  ···  ┌────┐ ┌────┐ ┌────┐ │ │ │
│  │   │ │OLD │ │    │ │    │ │    │ │    │  ···  │    │ │    │ │NEW │ │ │ │
│  │   │ │EST │ │    │ │    │ │    │ │    │  ···  │    │ │    │ │EST │ │ │ │
│  │   │ └────┘ └────┘ └────┘ └────┘ └────┘  ···  └────┘ └────┘ └────┘ │ │ │
│  │   │ op:0.4                                               op:1.0  │ │ │
│  │   │  ▲                                                      ▲    │ │ │
│  │   │  │                                                      │    │ │ │
│  │   │ oldest ─────────────────────────────────────────── newest    │ │ │
│  │   │ (left)                                              (right)  │ │ │
│  │   └────────────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**DYNAMIC SIZING:**

```typescript
// Calculate how many cards fit in available space
function calculateStripCapacity(
  containerSize: number, // Height (vertical) or Width (horizontal)
  cardSize: number, // 90px (vertical) or 60px (horizontal)
  gap: number, // 8px
  padding: number // 16px each side
): number {
  const availableSpace = containerSize - padding * 2;
  const cardWithGap = cardSize + gap;
  return Math.floor((availableSpace + gap) / cardWithGap);
}

// Example calculations:
// Vertical (1080px height): (1080 - 32 + 8) / (90 + 8) ≈ 10 cards
// Horizontal (1920px width): (1920 - 32 + 8) / (60 + 8) ≈ 27 cards
```

**VISUAL HIERARCHY (Cognitive Ergonomics):**

| Position                 | Opacity             | Scale | Border     | Meaning              |
| ------------------------ | ------------------- | ----- | ---------- | -------------------- |
| **Newest** (top/right)   | 1.0                 | 1.0   | 2px accent | Most recently called |
| **2nd**                  | 0.85                | 0.95  | 1px muted  | -                    |
| **3rd**                  | 0.70                | 0.90  | 1px muted  | -                    |
| **4th+**                 | Linear fade to 0.40 | 0.85  | none       | Progressively older  |
| **Oldest** (bottom/left) | 0.40                | 0.80  | none       | First called         |

```css
/* Opacity gradient formula */
.history-strip-card {
  --position: var(--card-index); /* 0 = newest */
  --total: var(--visible-cards);

  /* Opacity: 1.0 for newest, fading to 0.4 for oldest */
  opacity: calc(1 - (var(--position) / var(--total)) * 0.6);

  /* Scale: 1.0 for newest, down to 0.8 for oldest */
  transform: scale(calc(1 - (var(--position) / var(--total)) * 0.2));
}

/* Accent border for newest card */
.history-strip-card[data-newest="true"] {
  border: 2px solid var(--color-primary);
  box-shadow: 0 0 12px var(--color-primary-muted);
}
```

**BEHAVIOR:**

1. **New card enters:**
   - Animates from main display to strip (newest position)
   - All other cards shift (down in vertical, left in horizontal)
   - If at capacity: oldest card fades out and is removed from view
2. **Overflow handling:**

   - Only visible cards rendered (virtualized if >50)
   - "View All" indicator appears if cards exceed visible capacity
   - Click anywhere on strip opens History Modal

3. **Reading direction:**
   - Vertical: Top = newest, Bottom = oldest (like a stack)
   - Horizontal: Right = newest, Left = oldest (like a timeline)

**RESPONSIVE BREAKPOINTS:**

| Screen Width | Layout              | Card Size | Typical Capacity |
| ------------ | ------------------- | --------- | ---------------- |
| ≥1400px      | Vertical (right)    | 80×120px  | 6-10 cards       |
| 1024-1399px  | Horizontal (bottom) | 60×90px   | 12-18 cards      |
| 768-1023px   | Horizontal (bottom) | 50×75px   | 10-14 cards      |
| <768px       | Horizontal (bottom) | 40×60px   | 6-8 cards        |

### 5.7 History Modal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              HISTORY MODAL                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Trigger: Click "History" button or click on Recent Strip                  │
│  Available on: Host Display AND Remote Controller                          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                           [✕ Close] │   │
│  │                                                                       │   │
│  │   Called Cards (12 of 36)                                            │   │
│  │                                                                       │   │
│  │   ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                   │   │
│  │   │  1  │ │  2  │ │  3  │ │  4  │ │  5  │ │  6  │                   │   │
│  │   │     │ │     │ │     │ │     │ │     │ │     │                   │   │
│  │   │ Sol │ │Luna │ │Star │ │Moon │ │ ... │ │ ... │                   │   │
│  │   └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘                   │   │
│  │                                                                       │   │
│  │   ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                   │   │
│  │   │  7  │ │  8  │ │  9  │ │ 10  │ │ 11  │ │ 12  │                   │   │
│  │   │     │ │     │ │     │ │     │ │     │ │     │ ← current         │   │
│  │   │ ... │ │ ... │ │ ... │ │ ... │ │ ... │ │ ... │   (highlighted)   │   │
│  │   └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘                   │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  LAYOUT:                                                                    │
│  • Desktop: 6 columns grid                                                 │
│  • Tablet: 4 columns grid                                                  │
│  • Mobile: 3 columns grid                                                  │
│                                                                             │
│  INTERACTIONS:                                                              │
│  • Click card → Expand to show shortText                                   │
│  • Current card has highlight border                                       │
│  • Chronological order: first called at position 1                        │
│  • Scroll if more cards than fit in viewport                              │
│                                                                             │
│  EXPANDED CARD VIEW (on click):                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │   ┌───────────────┐                                                  │   │
│  │   │               │    "El Sol"                                      │   │
│  │   │    [IMAGE]    │                                                  │   │
│  │   │               │    "El sol sale para todos,                      │   │
│  │   │               │     pero no todos lo ven igual."                 │   │
│  │   └───────────────┘                                                  │   │
│  │                                         [← Back to grid]             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.8 Aspect Ratio Handling

The Host Display must adapt to various screen aspect ratios while maintaining visual quality.

**Strategy: Fixed Card + Fluid Layout**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ASPECT RATIO ADAPTATION                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  16:9 (Standard TV/Monitor)                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ┌────────┐  ┌──────────────────────────────────┐                   │   │
│  │  │  CARD  │  │  TEXT PANEL                      │                   │   │
│  │  │  2:3   │  │  max-width: 400px                │                   │   │
│  │  │        │  │                                  │                   │   │
│  │  └────────┘  └──────────────────────────────────┘                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  21:9 (Ultra-wide)                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ███  ┌────────┐  ┌──────────────────────────────────┐  ███         │   │
│  │  ███  │  CARD  │  │  TEXT PANEL                      │  ███         │   │
│  │  ███  │  2:3   │  │  Centered with generous margins  │  ███         │   │
│  │  ███  └────────┘  └──────────────────────────────────┘  ███         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       ▲                                                        ▲            │
│       └── Decorative margins (gradient/pattern) ───────────────┘            │
│                                                                             │
│  16:10 (MacBook/Laptop)                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ┌────────┐  ┌──────────────────────────────────┐                   │   │
│  │  │        │  │  TEXT PANEL                      │                   │   │
│  │  │  CARD  │  │  More vertical space available   │                   │   │
│  │  │  2:3   │  │  Can show longer shortText       │                   │   │
│  │  │        │  │                                  │                   │   │
│  │  └────────┘  └──────────────────────────────────┘                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**CSS Implementation:**

```css
.host-display {
  display: grid;
  grid-template-columns: minmax(200px, 40vh) minmax(300px, 1fr);
  gap: var(--space-12);
  max-width: 1400px;
  margin: 0 auto;
  padding: var(--space-8);
}

.card-container {
  aspect-ratio: 2 / 3;
  max-height: 70vh;
  width: auto;
}

/* Ultra-wide adjustment */
@media (min-aspect-ratio: 2/1) {
  .host-display {
    max-width: 1200px;
    padding-inline: 15%;
  }
}

/* Container query for text panel */
@container (min-width: 400px) {
  .text-panel {
    font-size: 1.25rem;
  }
}
```

### 5.9 Session Entry & QR Pairing UI

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SESSION ENTRY OPTIONS                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  OPTION A: QR Code Scan (Primary)                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │  Host Display shows:                                                  │   │
│  │  ┌─────────────┐                                                      │   │
│  │  │ ▓▓▓▓▓▓▓▓▓▓▓ │   "Scan to connect"                                 │   │
│  │  │ ▓▓▓▓▓▓▓▓▓▓▓ │                                                      │   │
│  │  │ ▓▓▓▓▓▓▓▓▓▓▓ │   Session: ABCD                                     │   │
│  │  │ ▓▓▓▓▓▓▓▓▓▓▓ │                                                      │   │
│  │  └─────────────┘   Or enter code at: game.example.com/join           │   │
│  │                                                                       │   │
│  │  QR encodes: https://game.example.com/play/join?code=ABCD            │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  OPTION B: Manual URL Entry (Fallback)                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │  User navigates to: /play/join                                        │   │
│  │                                                                       │   │
│  │  ┌───────────────────────────────────────────────────────────────┐   │   │
│  │  │  Enter Session Code                                            │   │   │
│  │  │                                                                 │   │   │
│  │  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                               │   │   │
│  │  │  │  A  │ │  B  │ │  C  │ │  D  │  ← 4-character input          │   │   │
│  │  │  └─────┘ └─────┘ └─────┘ └─────┘                               │   │   │
│  │  │                                                                 │   │   │
│  │  │              [ Connect ]                                        │   │   │
│  │  └───────────────────────────────────────────────────────────────┘   │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  URL PATTERNS:                                                              │
│  • /play/new          → Create new session (Host)                          │
│  • /play/join         → Manual code entry page (Controller)                │
│  • /play/join?code=X  → Auto-join session X (Controller via QR)            │
│  • /play/ABCD         → Session page (auto-detect Host vs returning user)  │
│  • /play/ABCD/host    → Force Host view                                    │
│  • /play/ABCD/control → Force Controller view                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.10 Deck Selection UI

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DECK SELECTION (Host)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  /play/new shows:                                                           │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │  Select a Deck                                                        │   │
│  │                                                                       │   │
│  │  ┌──────────────────────────────────────────────────────────────┐    │   │
│  │  │  🎴  DEMO DECK                                      [Play →] │    │   │
│  │  │                                                               │    │   │
│  │  │  A ready-to-play deck with 36 items.                         │    │   │
│  │  │  Perfect for testing or quick games.                         │    │   │
│  │  └──────────────────────────────────────────────────────────────┘    │   │
│  │                                                                       │   │
│  │  ─────────────────── OR ───────────────────                          │   │
│  │                                                                       │   │
│  │  ┌──────────────────────────────────────────────────────────────┐    │   │
│  │  │  📁  UPLOAD YOUR OWN DECK                                     │    │   │
│  │  │                                                               │    │   │
│  │  │  ┌────────────────────────────────────────────────────────┐  │    │   │
│  │  │  │                                                        │  │    │   │
│  │  │  │     Drag & drop your deck.json here                    │  │    │   │
│  │  │  │     or click to browse                                 │  │    │   │
│  │  │  │                                                        │  │    │   │
│  │  │  └────────────────────────────────────────────────────────┘  │    │   │
│  │  │                                                               │    │   │
│  │  │  Accepted format: JSON following DeckDefinition schema       │    │   │
│  │  └──────────────────────────────────────────────────────────────┘    │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  FLOW:                                                                      │
│  1. User clicks "Demo Deck" → Immediate session creation                   │
│     OR                                                                      │
│     User uploads custom JSON → Validation                                  │
│  2. System validates deck structure (if custom)                            │
│  3. If valid → Create session → Show QR pairing screen                     │
│  4. If invalid → Show validation errors with specific issues               │
│                                                                             │
│  STORAGE:                                                                   │
│  • Demo deck: bundled in /public/decks/demo/manifest.json                  │
│  • User decks: stored in browser localStorage (optional persistence)       │
│  • No server-side storage required                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.11 Error States UI

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ERROR STATES                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ERROR: CONNECTION_LOST (Controller)                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │         ⟳  Reconnecting...                                           │   │
│  │                                                                       │   │
│  │         Attempting to reconnect to session ABCD                      │   │
│  │         (auto-retry for 10 seconds)                                  │   │
│  │                                                                       │   │
│  │  ─────────────────────────────────────────────────────────────────   │   │
│  │                                                                       │   │
│  │         ⚠️  Connection Lost                                          │   │
│  │                                                                       │   │
│  │         Unable to reach the game session.                            │   │
│  │         The host may have closed the game.                           │   │
│  │                                                                       │   │
│  │         [ Try Again ]    [ New Session ]                             │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ERROR: SESSION_NOT_FOUND                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │         ❌  Session Not Found                                        │   │
│  │                                                                       │   │
│  │         The session "ABCD" doesn't exist or has expired.             │   │
│  │                                                                       │   │
│  │         [ Enter Different Code ]    [ Create New Session ]           │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ERROR: INVALID_DECK                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │         ❌  Invalid Deck File                                        │   │
│  │                                                                       │   │
│  │         The uploaded file has the following issues:                  │   │
│  │                                                                       │   │
│  │         • Missing required field: "items"                            │   │
│  │         • Item "03" missing "shortText"                              │   │
│  │                                                                       │   │
│  │         [ Upload Different File ]                                    │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ERROR: CONTROLLER_ALREADY_CONNECTED                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │         ⚠️  Controller Already Connected                             │   │
│  │                                                                       │   │
│  │         Another device is already controlling this session.          │   │
│  │                                                                       │   │
│  │         [ Take Over Control ]    [ Watch Only ]                      │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.12 Accessibility

| Requirement             | Implementation                                  |
| ----------------------- | ----------------------------------------------- |
| **Keyboard Navigation** | All controls focusable, Enter/Space to activate |
| **Screen Reader**       | ARIA labels on all interactive elements         |
| **Focus Indicators**    | Visible focus rings on all focusable elements   |
| **Color Contrast**      | WCAG AA minimum (4.5:1 for text)                |
| **Reduced Motion**      | Respect `prefers-reduced-motion`                |
| **Touch Targets**       | Minimum 44x44px for mobile controls             |

---

## 6. Non-Functional Requirements

### 6.1 Performance

| ID          | Requirement                            | Target          |
| ----------- | -------------------------------------- | --------------- |
| **NFR-001** | WebSocket message latency              | < 200ms         |
| **NFR-002** | Card animation frame rate              | 60fps           |
| **NFR-003** | Image load time (LCP)                  | < 2.5s          |
| **NFR-004** | Time to Interactive                    | < 3s            |
| **NFR-005** | Bundle size (JS)                       | < 200KB gzipped |
| **NFR-006** | Card transition (with preloaded image) | < 50ms          |
| **NFR-007** | Preload queue size                     | Next 3 cards    |

### 6.2 Reliability

| ID          | Requirement                             | Target                 |
| ----------- | --------------------------------------- | ---------------------- |
| **NFR-010** | Auto-reconnection on disconnect         | Within 30s             |
| **NFR-011** | State recovery after reconnect          | Full state sync        |
| **NFR-012** | Graceful degradation without Controller | Standalone mode        |
| **NFR-013** | Session persistence on page refresh     | Via URL + localStorage |

### 6.3 Compatibility

| ID          | Requirement     | Target                                        |
| ----------- | --------------- | --------------------------------------------- |
| **NFR-020** | Browser support | Chrome 90+, Safari 15+, Firefox 90+, Edge 90+ |
| **NFR-021** | Mobile support  | iOS Safari 15+, Chrome Mobile 90+             |
| **NFR-022** | Screen sizes    | 375px to 3840px width                         |
| **NFR-023** | Aspect ratios   | 16:9, 16:10, 21:9                             |

### 6.4 Constraints

| ID          | Constraint                                                               |
| ----------- | ------------------------------------------------------------------------ |
| **NFR-030** | **NO AUDIO**: System shall not emit any sound effects or voice synthesis |
| **NFR-031** | **OFFLINE BOARDS**: Generated boards work offline after initial load     |
| **NFR-032** | **NO ACCOUNTS**: No user authentication required                         |

---

## 7. Technical Implementation

### 7.1 Shuffle Algorithm

```typescript
/**
 * Cryptographically Secure Shuffle with Reproducibility
 *
 * Uses Web Crypto API for true randomness, but saves seed
 * for replay/audit capability.
 */

interface ShuffleResult<T> {
  shuffled: T[];
  seedUsed: number;
}

/**
 * Seeded PRNG using Mulberry32 algorithm
 * Fast, good distribution, deterministic
 */
function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates shuffle with CSPRNG seed generation
 */
export function cryptoShuffle<T>(array: T[]): ShuffleResult<T> {
  // Generate cryptographically secure seed
  const seedBuffer = new Uint32Array(1);
  crypto.getRandomValues(seedBuffer);
  const seed = seedBuffer[0];

  return seededShuffle(array, seed);
}

/**
 * Fisher-Yates shuffle with provided seed
 * Deterministic: same seed = same result
 */
export function seededShuffle<T>(array: T[], seed: number): ShuffleResult<T> {
  const result = [...array];
  const random = mulberry32(seed);

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return { shuffled: result, seedUsed: seed };
}
```

### 7.2 Host UI State Machine

```typescript
/**
 * Host UI State Machine
 * Implements State pattern for UI mode management
 */

type HostUIState = {
  mode: "standalone" | "paired";
  isFullscreen: boolean;
  controlsVisible: boolean;
};

type HostUIEvent =
  | { type: "CONTROLLER_CONNECTED" }
  | { type: "CONTROLLER_DISCONNECTED" }
  | { type: "TOGGLE_FULLSCREEN" }
  | { type: "TOGGLE_CONTROLS" }
  | { type: "HOVER_BOTTOM" }
  | { type: "HOVER_TIMEOUT" };

const initialState: HostUIState = {
  mode: "standalone",
  isFullscreen: false,
  controlsVisible: true,
};

function hostUIReducer(state: HostUIState, event: HostUIEvent): HostUIState {
  switch (event.type) {
    case "CONTROLLER_CONNECTED":
      return {
        mode: "paired",
        isFullscreen: true,
        controlsVisible: false,
      };

    case "CONTROLLER_DISCONNECTED":
      return {
        ...state,
        mode: "standalone",
        controlsVisible: true,
      };

    case "TOGGLE_FULLSCREEN":
      return {
        ...state,
        isFullscreen: !state.isFullscreen,
      };

    case "TOGGLE_CONTROLS":
      return {
        ...state,
        controlsVisible: !state.controlsVisible,
      };

    case "HOVER_BOTTOM":
      if (state.mode === "paired") {
        return { ...state, controlsVisible: true };
      }
      return state;

    case "HOVER_TIMEOUT":
      if (state.mode === "paired") {
        return { ...state, controlsVisible: false };
      }
      return state;

    default:
      return state;
  }
}
```

### 7.3 Image Preloader

```typescript
/**
 * Image Preloader
 * Preloads upcoming card images for instant display
 */

interface PreloaderConfig {
  queueSize: number; // Default: 3
}

class ImagePreloader {
  private cache = new Map<string, HTMLImageElement>();
  private loading = new Set<string>();

  constructor(private config: PreloaderConfig = { queueSize: 3 }) {}

  /**
   * Preload the next N images based on current index
   */
  preloadUpcoming(
    deck: ItemDefinition[],
    shuffledIds: string[],
    currentIndex: number
  ): void {
    const upcomingIds = shuffledIds.slice(
      currentIndex + 1,
      currentIndex + 1 + this.config.queueSize
    );

    for (const id of upcomingIds) {
      const item = deck.find((i) => i.id === id);
      if (item && !this.cache.has(id) && !this.loading.has(id)) {
        this.preloadImage(id, item.imageUrl);
      }
    }
  }

  private preloadImage(id: string, url: string): void {
    this.loading.add(id);

    const img = new Image();
    img.onload = () => {
      this.cache.set(id, img);
      this.loading.delete(id);
    };
    img.onerror = () => {
      this.loading.delete(id);
      console.warn(`Failed to preload image: ${url}`);
    };
    img.src = url;
  }

  /**
   * Check if an image is ready
   */
  isReady(id: string): boolean {
    return this.cache.has(id);
  }

  /**
   * Get cached image element (for canvas rendering if needed)
   */
  getImage(id: string): HTMLImageElement | undefined {
    return this.cache.get(id);
  }

  /**
   * Clear cache (on session end)
   */
  clear(): void {
    this.cache.clear();
    this.loading.clear();
  }
}

// React hook
export function useImagePreloader(
  deck: ItemDefinition[],
  shuffledIds: string[],
  currentIndex: number
) {
  const preloaderRef = useRef(new ImagePreloader());

  useEffect(() => {
    preloaderRef.current.preloadUpcoming(deck, shuffledIds, currentIndex);
  }, [currentIndex, deck, shuffledIds]);

  useEffect(() => {
    return () => preloaderRef.current.clear();
  }, []);

  return preloaderRef.current;
}
```

### 7.4 Deck Validator

```typescript
/**
 * Deck Validator
 * Validates DeckDefinition structure before session creation
 */

interface ValidationError {
  field: string;
  message: string;
  itemId?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export function validateDeck(deck: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (!deck || typeof deck !== "object") {
    return {
      valid: false,
      errors: [{ field: "root", message: "Invalid deck format" }],
    };
  }

  const d = deck as Record<string, unknown>;

  // Required fields
  if (!d.id || typeof d.id !== "string") {
    errors.push({ field: "id", message: "Deck must have a string id" });
  }

  if (!d.name || typeof d.name !== "string") {
    errors.push({ field: "name", message: "Deck must have a name" });
  }

  if (!d.language || typeof d.language !== "string") {
    errors.push({
      field: "language",
      message: "Deck must have a language code",
    });
  }

  if (!Array.isArray(d.items) || d.items.length === 0) {
    errors.push({
      field: "items",
      message: "Deck must have at least one item",
    });
    return { valid: false, errors };
  }

  // Validate each item
  const itemIds = new Set<string>();
  for (let i = 0; i < d.items.length; i++) {
    const item = d.items[i] as Record<string, unknown>;
    const itemPrefix = `items[${i}]`;

    if (!item.id || typeof item.id !== "string") {
      errors.push({
        field: `${itemPrefix}.id`,
        message: "Item must have an id",
        itemId: String(i),
      });
    } else if (itemIds.has(item.id as string)) {
      errors.push({
        field: `${itemPrefix}.id`,
        message: "Duplicate item id",
        itemId: item.id as string,
      });
    } else {
      itemIds.add(item.id as string);
    }

    if (!item.name || typeof item.name !== "string") {
      errors.push({
        field: `${itemPrefix}.name`,
        message: "Item must have a name",
        itemId: item.id as string,
      });
    }

    if (!item.imageUrl || typeof item.imageUrl !== "string") {
      errors.push({
        field: `${itemPrefix}.imageUrl`,
        message: "Item must have an imageUrl",
        itemId: item.id as string,
      });
    }

    if (!item.shortText || typeof item.shortText !== "string") {
      errors.push({
        field: `${itemPrefix}.shortText`,
        message: "Item must have shortText",
        itemId: item.id as string,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}
```

### 7.5 Partykit Server

```typescript
// party/game.ts
import type { Party, Connection, Server } from "partykit/server";

interface RoomState {
  hostId: string | null;
  controllerId: string | null;
  gameState: GameSessionState | null;
}

export default class GameRoom implements Server {
  private state: RoomState = {
    hostId: null,
    controllerId: null,
    gameState: null,
  };

  constructor(public room: Party) {}

  onConnect(conn: Connection) {
    const url = new URL(conn.uri, "http://localhost");
    const role = url.searchParams.get("role");

    if (role === "host") {
      this.state.hostId = conn.id;
      conn.send(JSON.stringify({ type: "ROOM_CREATED", roomId: this.room.id }));
    } else if (role === "controller") {
      this.state.controllerId = conn.id;
      this.room.broadcast(JSON.stringify({ type: "CONTROLLER_CONNECTED" }));

      // Send current state to new controller
      if (this.state.gameState) {
        conn.send(
          JSON.stringify({
            type: "STATE_UPDATE",
            payload: this.state.gameState,
          })
        );
      }
    }
  }

  onClose(conn: Connection) {
    if (conn.id === this.state.controllerId) {
      this.state.controllerId = null;
      this.room.broadcast(JSON.stringify({ type: "CONTROLLER_DISCONNECTED" }));
    }
  }

  onMessage(message: string, sender: Connection) {
    const data = JSON.parse(message);

    switch (data.type) {
      case "DRAW_CARD":
      case "PAUSE_GAME":
      case "RESUME_GAME":
      case "RESET_GAME":
        // Forward commands to host
        if (this.state.hostId) {
          const hostConn = this.room.getConnection(this.state.hostId);
          hostConn?.send(message);
        }
        break;

      case "STATE_UPDATE":
        // Host sends state updates
        this.state.gameState = data.payload;
        // Broadcast to controller
        if (this.state.controllerId) {
          const ctrlConn = this.room.getConnection(this.state.controllerId);
          ctrlConn?.send(message);
        }
        break;
    }
  }
}
```

### 7.6 File Structure

```
src/
├── app/
│   ├── generator/                 # Existing - Board generation
│   │   ├── page.tsx
│   │   └── _components/
│   │
│   ├── play/                      # New - Game system
│   │   ├── page.tsx               # Landing: options to host or join
│   │   ├── new/
│   │   │   └── page.tsx           # Deck selection, create session
│   │   ├── join/
│   │   │   └── page.tsx           # Manual code entry
│   │   │
│   │   ├── [sessionId]/
│   │   │   ├── page.tsx           # Auto-detect host vs controller
│   │   │   ├── host/
│   │   │   │   └── page.tsx       # Force host view
│   │   │   └── control/
│   │   │       └── page.tsx       # Force controller view
│   │   │
│   │   └── _components/
│   │       ├── host-display.tsx          # Main Host UI container
│   │       ├── remote-controller.tsx     # Main Controller UI container
│   │       ├── current-card.tsx          # Large card display
│   │       ├── flip-card.tsx             # Card with flip animation
│   │       ├── text-panel.tsx            # Name + shortText side panel
│   │       ├── history-strip.tsx         # Adaptive strip (vertical/horizontal)
│   │       ├── history-modal.tsx         # Full history grid modal
│   │       ├── history-card.tsx          # Card in history grid (expandable)
│   │       ├── controls-bar.tsx          # Host controls (auto-hide)
│   │       ├── draw-button.tsx           # Giant mobile button + haptics
│   │       ├── mini-card.tsx             # Small card for Controller sync
│   │       ├── qr-pairing.tsx            # QR code display + session ID
│   │       ├── connection-status.tsx     # Connection indicator
│   │       ├── deck-selector.tsx         # Demo/Upload deck picker
│   │       ├── session-code-input.tsx    # 4-char code input
│   │       └── error-states.tsx          # Error UI components
│   │
│   ├── api/
│   │   └── generate/              # Existing
│   │
│   ├── globals.css
│   └── layout.tsx
│
├── components/
│   └── ui/                        # Existing shadcn components
│
├── lib/
│   ├── types/
│   │   ├── index.ts               # Existing generator types
│   │   └── game.ts                # New game types
│   │
│   ├── shuffle/
│   │   └── crypto-shuffle.ts      # CSPRNG shuffle
│   │
│   ├── game/
│   │   ├── session.ts             # Session management
│   │   ├── state-machine.ts       # Host UI state machine
│   │   ├── deck-loader.ts         # DeckDefinition loader & validator
│   │   └── image-preloader.ts     # Preload next N card images
│   │
│   └── realtime/
│       ├── partykit-client.ts     # Partykit React hooks
│       └── types.ts               # WebSocket message types
│
├── stores/
│   ├── generator-store.ts         # Existing
│   └── game-store.ts              # New game state
│
└── party/
    └── game.ts                    # Partykit server (edge runtime)

public/
├── decks/
│   ├── demo/                      # Demo deck included
│   │   ├── manifest.json
│   │   └── *.png
│   └── [deck-id]/                 # User decks
│       ├── manifest.json          # DeckDefinition
│       └── [item-id].png          # Card images
```

> **Note:** The `party/` folder is at the project root (not inside `src/`) as required by Partykit's build system.

---

## 8. Implementation Roadmap

### Phase 3A: Realtime Infrastructure (3 days)

| Task                              | Priority | Estimate |
| --------------------------------- | -------- | -------- |
| Set up Partykit project           | Critical | 0.5d     |
| Implement room/session types      | Critical | 0.5d     |
| Create Partykit server (game.ts)  | Critical | 1d       |
| Build useGameSocket React hook    | Critical | 0.5d     |
| QR code generation (qrcode.react) | High     | 0.5d     |

### Phase 3B: Host Display (4 days)

| Task                               | Priority | Estimate |
| ---------------------------------- | -------- | -------- |
| Host UI state machine              | Critical | 0.5d     |
| Current card component (vertical)  | Critical | 0.5d     |
| Text panel component (side layout) | Critical | 0.5d     |
| Flip card animation                | Medium   | 0.5d     |
| History strip component (adaptive) | High     | 1d       |
| Controls bar (auto-hide)           | High     | 0.5d     |
| Fullscreen API integration         | High     | 0.5d     |
| History modal                      | Medium   | 0.5d     |

### Phase 3C: Remote Controller (3 days)

| Task                           | Priority | Estimate |
| ------------------------------ | -------- | -------- |
| Controller layout (thumb-zone) | Critical | 0.5d     |
| Giant draw button with haptics | Critical | 0.5d     |
| Mini-card sync display         | High     | 0.5d     |
| Pause/Resume controls          | Medium   | 0.5d     |
| History modal (mobile)         | Medium   | 0.5d     |
| Connection status indicator    | High     | 0.5d     |

### Phase 3D: Integration (2 days)

| Task                                | Priority | Estimate |
| ----------------------------------- | -------- | -------- |
| DeckDefinition loader               | Critical | 0.5d     |
| Crypto shuffle implementation       | Critical | 0.5d     |
| Generator → Play flow               | High     | 0.5d     |
| Session persistence (URL + storage) | High     | 0.5d     |

### Phase 3E: Polish (2 days)

| Task                  | Priority | Estimate |
| --------------------- | -------- | -------- |
| Animation tuning      | High     | 0.5d     |
| Responsive testing    | Critical | 0.5d     |
| Reconnection handling | High     | 0.5d     |
| Edge case testing     | High     | 0.5d     |

---

### Phase 3F: Error Handling & Edge Cases (1 day)

| Task                       | Priority | Estimate |
| -------------------------- | -------- | -------- |
| Connection lost UI states  | High     | 0.25d    |
| Session not found handling | High     | 0.25d    |
| Invalid deck validation UI | Medium   | 0.25d    |
| Controller takeover flow   | Low      | 0.25d    |

**Revised Total Estimate: 15 days**

---

## Appendix A: Generator Integration

The existing Generator (`/generator`) exports boards as JSON/CSV. To integrate with Tabula:

1. **Export includes item IDs only** (not full item data)
2. **DeckDefinition created separately** with images + educational text
3. **Play system loads DeckDefinition** and resolves item IDs

```
Generator Flow:
  Items (names only) → Configure → Distribute → Export (IDs)

Design Flow (external):
  Export → Design images → Write educational text → Create DeckDefinition JSON

Play Flow:
  Load DeckDefinition → Create Session → Play
```

---

## Appendix B: Haptic Feedback

For the Remote Controller's draw button:

```typescript
function triggerHaptic(style: "light" | "medium" | "heavy" = "medium") {
  if ("vibrate" in navigator) {
    const patterns = {
      light: [10],
      medium: [30],
      heavy: [50, 30, 50],
    };
    navigator.vibrate(patterns[style]);
  }
}
```

---

---

_**Tabula** — Your digital game table_  
_Document Version: 3.0_  
_Last Updated: December 2024_  
_Status: Ready for Implementation_
