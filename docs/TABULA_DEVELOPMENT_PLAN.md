# 🎴 Tabula Development Plan

> **Distributed Lotería Game System — Complete Implementation Guide**  
> Version: 1.0 | Created: December 2024  
> Based on: `tabula-srd.md` v3.0

---

## Table of Contents

1. [Overview](#1-overview)
2. [Milestone 1: Data Models & Core Types](#milestone-1-data-models--core-types)
3. [Milestone 2: Realtime Infrastructure](#milestone-2-realtime-infrastructure)
4. [Milestone 3: Deck Management](#milestone-3-deck-management)
5. [Milestone 4: Host Display](#milestone-4-host-display)
6. [Milestone 5: Remote Controller](#milestone-5-remote-controller)
7. [Milestone 6: Integration & State Sync](#milestone-6-integration--state-sync)
8. [Milestone 7: Polish & Accessibility](#milestone-7-polish--accessibility)
9. [Test Strategy](#test-strategy)
10. [SRD Traceability Matrix](#srd-traceability-matrix)
11. [File Structure](#file-structure)

---

## 1. Overview

### Vision

**Tabula** is a web-based digital companion for playing traditional Lotería. It replaces the physical act of drawing cards with a digital randomization engine while adding an **educational dimension** — each card reveals a short text designed to spark conversations.

> *"Tabula"* — from Latin, meaning "board" or "tablet". Evokes both the game boards and the concept of *tabula rasa*: each game session is a fresh start, a new story waiting to be told.

### Dual-Interface Architecture

| Interface | Target Device | Purpose |
|-----------|---------------|---------|
| **Host Display** | Laptop/TV | Projects game visuals in cinematic presentation mode |
| **Remote Controller** | Mobile | Allows moderator to control game flow untethered |

*Reference: SRD §1 Executive Summary*

### Design Principles Applied

| Principle | Application |
|-----------|-------------|
| **Single Responsibility** | Each component has one reason to change |
| **Open/Closed** | Extensible themes without modifying core logic |
| **Dependency Inversion** | UI depends on abstractions, not concrete realtime implementations |
| **KISS** | Minimal viable data model, no premature optimization |
| **DRY** | Shared components between Host and Controller views |

*Reference: SRD §1.1 Design Principles*

### Technology Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Framework** | Next.js | 16.x | App Router, Server Components, Image Optimization |
| **Runtime** | React | 19.x | UI Components, Concurrent Features |
| **Language** | TypeScript | 5.x | Type Safety |
| **Styling** | Tailwind CSS | 4.x | Utility-first CSS, CSS Variables |
| **Animation** | Framer Motion | 12.x | Physics-based animations |
| **State** | Zustand | 5.x | Local state management |
| **Realtime** | Partykit | latest | Edge-native WebSocket rooms |
| **Components** | Radix UI | latest | Accessible primitives |
| **Icons** | Lucide React | latest | Icon system |

*Reference: SRD §2.2 Technology Stack*

---

## Milestone 1: Data Models & Core Types

**Duration:** 1 day  
**Priority:** 🔴 Critical  
**Dependencies:** None

### Objective

Establish the complete type system for Tabula, ensuring type safety across the entire application and providing a solid foundation for all subsequent development.

*Reference: SRD §3 Data Models*

---

### Phase 1.1: Core Game Types

**Files:**
- `src/lib/types/game.ts` — Game-specific types

**Deliverables:**

```typescript
// ItemDefinition, DeckDefinition, DeckTheme, GeneratedBoard
// Reference: SRD §3.1 Core Types
```

| Type | Description | SRD Reference |
|------|-------------|---------------|
| `ItemDefinition` | Single card in the Lotería deck | §3.1 |
| `DeckDefinition` | Complete deck configuration | §3.1 |
| `DeckTheme` | Visual customization for the deck | §3.1 |
| `GeneratedBoard` | Output from Generator, references items by ID | §3.1 |

**Acceptance Criteria:**
- [ ] All types from SRD §3.1 implemented
- [ ] Types are exported and documented with JSDoc
- [ ] Types are compatible with existing `GeneratedBoard` from Generator

---

### Phase 1.2: Session & Connection Types

**Files:**
- `src/lib/types/game.ts` — Extended with session types

**Deliverables:**

| Type | Description | SRD Reference |
|------|-------------|---------------|
| `GameSession` | Runtime state during active gameplay | §3.2 |
| `GameStatus` | Session status enum | §3.2 |
| `ConnectionState` | WebSocket connection state | §3.2 |

**Acceptance Criteria:**
- [ ] All types from SRD §3.2 implemented
- [ ] `GameStatus` includes all states: `waiting`, `ready`, `playing`, `paused`, `finished`
- [ ] `ConnectionState` tracks host and controller connections

---

### Phase 1.3: UI State Machine Types

**Files:**
- `src/lib/types/game.ts` — Extended with UI state types

**Deliverables:**

| Type | Description | SRD Reference |
|------|-------------|---------------|
| `HostUIState` | State machine for Host Display UI modes | §3.3 |
| `HostUIEvent` | Events that trigger UI state transitions | §3.3 |

**Host UI Modes:**
- `standalone`: Controls visible, no controller connected
- `paired`: Auto-fullscreen, controls hidden, controller active

*Reference: SRD §2.4 Host UI State Machine Diagram*

**Acceptance Criteria:**
- [ ] All UI state types from SRD §3.3 implemented
- [ ] State machine supports transitions defined in SRD §2.4
- [ ] ESC key and hover events mapped to state transitions

---

### Phase 1.4: Realtime Protocol Types

**Files:**
- `src/lib/realtime/types.ts` — WebSocket message types

**Deliverables:**

| Message Type | Direction | Description | SRD Reference |
|--------------|-----------|-------------|---------------|
| `CREATE_ROOM` | C→S | Host creates room | §3.4 |
| `ROOM_CREATED` | S→C | Room ID returned to host | §3.4 |
| `JOIN_ROOM` | C→S | Controller joins room | §3.4 |
| `ROOM_JOINED` | S→C | Confirmation to controller | §3.4 |
| `CONTROLLER_CONNECTED` | S→A | Broadcast connection | §3.4 |
| `CONTROLLER_DISCONNECTED` | S→A | Broadcast disconnection | §3.4 |
| `DRAW_CARD` | C→S | Controller command | §3.4 |
| `PAUSE_GAME` | C→S | Controller command | §3.4 |
| `RESUME_GAME` | C→S | Controller command | §3.4 |
| `RESET_GAME` | C→S | Controller command | §3.4 |
| `STATE_UPDATE` | S→C | Host state broadcast | §3.4 |

**Acceptance Criteria:**
- [ ] All message types from SRD §3.4 implemented
- [ ] Discriminated union for type-safe message handling
- [ ] Direction annotations (C→S, S→C, S→A) documented

---

### 🧪 Unit Tests: Phase 1

**Test File:** `src/lib/types/__tests__/game.test.ts`

```typescript
// Test cases for type validation functions
describe('Game Types', () => {
  describe('ItemDefinition', () => {
    it('should validate required fields');
    it('should accept optional fields');
  });
  
  describe('DeckDefinition', () => {
    it('should require at least one item');
    it('should validate language code format');
  });
  
  describe('GameStatus', () => {
    it('should define all game states');
  });
});
```

---

## Milestone 2: Realtime Infrastructure

**Duration:** 3 days  
**Priority:** 🔴 Critical  
**Dependencies:** Milestone 1

### Objective

Establish the Partykit-based realtime infrastructure for Host-Controller communication.

*Reference: SRD §2.1 Architecture Overview, §7.5 Partykit Server*

---

### Phase 2.1: Partykit Project Setup

**Duration:** 0.5 days

**Files:**
- `party/game.ts` — Partykit server
- `partykit.json` — Configuration

**Deliverables:**
- Partykit project initialized
- Development server configured
- Deploy configuration ready

*Reference: SRD §7.5 Partykit Server*

**Acceptance Criteria:**
- [ ] Partykit dev server runs locally
- [ ] WebSocket endpoint accessible at `/_next/party/game`
- [ ] Partykit.json configured with project name

---

### Phase 2.2: Room Management

**Duration:** 1 day

**Files:**
- `party/game.ts` — Room state and connection handling

**Deliverables:**

| Feature | Description | SRD Reference |
|---------|-------------|---------------|
| Session ID Generation | 4-character unique code | FR-001 |
| Room Creation | Host initiates room | §7.5 |
| Room Joining | Controller joins by code | §7.5 |
| Connection Tracking | Track host and controller IDs | §7.5 |

**Room State Structure:**
```typescript
interface RoomState {
  hostId: string | null;
  controllerId: string | null;
  gameState: GameSessionState | null;
}
```

*Reference: SRD §7.5 Partykit Server*

**Acceptance Criteria:**
- [ ] Room creates with unique 4-char session ID (FR-001)
- [ ] Only one host per room
- [ ] Only one controller per room (or takeover flow)
- [ ] Room state persists across reconnections

---

### Phase 2.3: Event Relay System

**Duration:** 1 day

**Files:**
- `party/game.ts` — Message handling

**Deliverables:**

| Event Flow | Description | SRD Reference |
|------------|-------------|---------------|
| Commands | Controller → Server → Host | §3.4 |
| State Updates | Host → Server → Controller | §3.4 |
| Connection Events | Server → All (broadcast) | §3.4 |

**Acceptance Criteria:**
- [ ] All message types from SRD §3.4 handled
- [ ] Commands forwarded to host only
- [ ] State updates forwarded to controller only
- [ ] Connection events broadcast to all

---

### Phase 2.4: React Client Hook

**Duration:** 0.5 days

**Files:**
- `src/lib/realtime/partykit-client.ts` — React hook

**Deliverables:**

```typescript
interface UseGameSocket {
  // Connection
  connect: (roomId: string, role: 'host' | 'controller') => void;
  disconnect: () => void;
  isConnected: boolean;
  
  // Commands (Controller)
  drawCard: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  resetGame: () => void;
  
  // State (Host)
  sendStateUpdate: (state: GameSessionState) => void;
  
  // Events
  onMessage: (handler: (msg: WSMessage) => void) => void;
}
```

*Reference: SRD §7.5, FR-006 Auto-reconnection*

**Acceptance Criteria:**
- [ ] Hook connects to Partykit server
- [ ] Auto-reconnection within 5 seconds (FR-006)
- [ ] Role-based connection (host/controller)
- [ ] Message handlers for all event types

---

### 🧪 Unit Tests: Phase 2

**Test File:** `src/lib/realtime/__tests__/partykit-client.test.ts`

```typescript
describe('Partykit Client', () => {
  describe('Room Management', () => {
    it('should generate unique 4-char session IDs');
    it('should connect as host');
    it('should connect as controller');
    it('should handle connection errors');
  });
  
  describe('Message Handling', () => {
    it('should serialize messages correctly');
    it('should deserialize messages correctly');
    it('should handle unknown message types');
  });
  
  describe('Auto-Reconnection', () => {
    it('should reconnect within 5 seconds');
    it('should restore state after reconnection');
  });
});
```

---

## Milestone 3: Deck Management

**Duration:** 1.5 days  
**Priority:** 🔴 Critical  
**Dependencies:** Milestone 1

### Objective

Implement deck loading, validation, and the demo deck system.

*Reference: SRD §3.5 Example Deck JSON, §7.4 Deck Validator*

---

### Phase 3.1: Deck Validator

**Duration:** 0.5 days

**Files:**
- `src/lib/game/deck-loader.ts` — Validation logic

**Deliverables:**

```typescript
interface ValidationError {
  field: string;
  message: string;
  itemId?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

function validateDeck(deck: unknown): ValidationResult;
```

**Validation Rules (per SRD §7.4):**
- [ ] Deck has required `id`, `name`, `language` fields
- [ ] Items array is non-empty
- [ ] Each item has `id`, `name`, `imageUrl`, `shortText`
- [ ] No duplicate item IDs
- [ ] Language is valid ISO 639-1 code

*Reference: SRD §7.4 Deck Validator*

**Acceptance Criteria:**
- [ ] All validation rules from SRD §7.4 implemented
- [ ] Error messages are actionable (FR requirement)
- [ ] Validation is pure function (testable)

---

### Phase 3.2: Demo Deck

**Duration:** 0.5 days

**Files:**
- `public/decks/demo/manifest.json` — Demo deck definition
- `public/decks/demo/*.png` — Placeholder images

**Deliverables:**

| Requirement | Description | SRD Reference |
|-------------|-------------|---------------|
| Demo Deck | Built-in deck for immediate play | FR-010a |
| 36 Items | Complete deck with items | §3.5 |
| Educational Text | shortText for each item | §3.1 |

*Reference: SRD §3.5 Example Deck JSON, FR-010a*

**Acceptance Criteria:**
- [ ] Demo deck loads without network (bundled)
- [ ] All items have placeholder images
- [ ] All items have educational shortText
- [ ] Demo deck passes validation

---

### Phase 3.3: Deck Loader & Theme Application

**Duration:** 0.5 days

**Files:**
- `src/lib/game/deck-loader.ts` — Loading logic

**Deliverables:**

```typescript
// Load demo deck
async function loadDemoDeck(): Promise<DeckDefinition>;

// Load user deck from JSON
async function loadDeckFromJson(json: string): Promise<DeckDefinition>;

// Apply deck theme to CSS variables
function applyDeckTheme(theme: DeckTheme): void;
```

*Reference: SRD §3.1 DeckTheme, FR-017*

**Acceptance Criteria:**
- [ ] Demo deck loadable (FR-010a)
- [ ] User decks uploadable (FR-010b)
- [ ] Theme colors applied via CSS variables (FR-017)
- [ ] Invalid decks return detailed errors

---

### 🧪 Unit Tests: Phase 3

**Test File:** `src/lib/game/__tests__/deck-loader.test.ts`

```typescript
describe('Deck Loader', () => {
  describe('validateDeck', () => {
    it('should validate correct deck structure');
    it('should reject missing required fields');
    it('should reject duplicate item IDs');
    it('should reject items without shortText');
    it('should provide actionable error messages');
  });
  
  describe('loadDemoDeck', () => {
    it('should load demo deck successfully');
    it('should have 36 items');
    it('should pass validation');
  });
  
  describe('applyDeckTheme', () => {
    it('should set CSS variables');
    it('should handle missing optional theme fields');
  });
});
```

---

## Milestone 4: Host Display

**Duration:** 4 days  
**Priority:** 🔴 Critical  
**Dependencies:** Milestones 1, 2, 3

### Objective

Build the cinematic Host Display with card presentation, history strip, and adaptive layouts.

*Reference: SRD §5.1 Host Display Layout, §5.6 History Strip Component*

---

### Phase 4.1: Host UI State Machine

**Duration:** 0.5 days

**Files:**
- `src/lib/game/state-machine.ts` — State machine implementation

**Deliverables:**

```typescript
// State machine reducer
function hostUIReducer(state: HostUIState, event: HostUIEvent): HostUIState;

// React hook
function useHostUIState(): {
  state: HostUIState;
  dispatch: (event: HostUIEvent) => void;
};
```

**State Transitions (per SRD §2.4):**

| From | Event | To |
|------|-------|-----|
| standalone | CONTROLLER_CONNECTED | paired |
| paired | CONTROLLER_DISCONNECTED | standalone |
| paired | ESC key | toggle controls |
| paired | HOVER_BOTTOM | show controls (3s timeout) |

*Reference: SRD §2.4 Host UI State Machine Diagram, §7.2 Host UI State Machine*

**Acceptance Criteria:**
- [ ] All state transitions from SRD §2.4 implemented
- [ ] ESC key toggles controls in paired mode (FR-023)
- [ ] Hover on bottom shows controls temporarily (FR-022)
- [ ] 3-second timeout for temporary controls

---

### Phase 4.2: Current Card Component

**Duration:** 0.5 days

**Files:**
- `src/app/play/_components/current-card.tsx`

**Deliverables:**

| Feature | Description | SRD Reference |
|---------|-------------|---------------|
| Vertical Layout | Card image with 2:3 aspect ratio | FR-030 |
| Card Name | Prominently displayed | FR-031 |
| Card Counter | Current/total display | FR-033 |
| Click to Flip | Reveals longText if available | FR-034 |

**Animation Specifications (per SRD §5.4):**
- Card Entrance: `rotateY(-90°) → rotateY(0°)`, spring animation
- Card Exit: `rotateY(0°) → rotateY(90°)`, spring animation

*Reference: SRD §5.1, FR-030 through FR-034*

**Acceptance Criteria:**
- [ ] Card displays with 2:3 aspect ratio (FR-030)
- [ ] Name prominently displayed (FR-031)
- [ ] Counter shows current/total (FR-033)
- [ ] Click flips card to show longText (FR-034)
- [ ] Entrance animation per SRD §5.4

---

### Phase 4.3: Text Panel Component

**Duration:** 0.5 days

**Files:**
- `src/app/play/_components/text-panel.tsx`

**Deliverables:**

| Feature | Description | SRD Reference |
|---------|-------------|---------------|
| Side Layout | Text displayed beside card, not below | FR-032 |
| shortText | Educational text always visible | FR-032 |
| Card Counter | Embedded in panel | FR-033 |

**Animation:**
- `opacity: 0, x: 50 → opacity: 1, x: 0`, 500ms ease, 300ms delay

*Reference: SRD §5.1, §5.4 Animation Specifications*

**Acceptance Criteria:**
- [ ] Text panel positioned alongside card (FR-032)
- [ ] shortText always visible
- [ ] Animation per SRD §5.4

---

### Phase 4.4: Flip Card Animation

**Duration:** 0.5 days

**Files:**
- `src/app/play/_components/flip-card.tsx`

**Deliverables:**

| Feature | Description | SRD Reference |
|---------|-------------|---------------|
| 3D Flip | rotateY(0°) ↔ rotateY(180°) | §5.4 |
| Front | Card image | FR-030 |
| Back | longText content | FR-034 |

**Animation:**
- Spring: `stiffness: 300, damping: 30`

*Reference: SRD §5.4 Animation Specifications, FR-034*

**Acceptance Criteria:**
- [ ] Smooth 3D flip animation
- [ ] Back shows longText if available
- [ ] Respects `prefers-reduced-motion`

---

### Phase 4.5: History Strip Component (Adaptive)

**Duration:** 1 day

**Files:**
- `src/app/play/_components/history-strip.tsx`

**Deliverables:**

| Feature | Description | SRD Reference |
|---------|-------------|---------------|
| Vertical Layout | Right side on wide screens (≥1400px) | FR-035a |
| Horizontal Layout | Bottom on standard screens (<1400px) | FR-035b |
| Visual Hierarchy | Newest = most prominent (opacity, scale) | FR-035c |
| Dynamic Capacity | Shows as many cards as space allows | FR-035 |

**Visual Hierarchy (per SRD §5.6):**

| Position | Opacity | Scale | Border |
|----------|---------|-------|--------|
| Newest | 1.0 | 1.0 | 2px accent |
| 2nd | 0.85 | 0.95 | 1px muted |
| 3rd | 0.70 | 0.90 | 1px muted |
| 4th+ | Linear fade to 0.40 | 0.85 | none |
| Oldest | 0.40 | 0.80 | none |

**Animation (per SRD §5.4):**
- New card: scale 0 → 1, from main card position
- Shift: 300ms ease-out
- Exit: opacity 1 → 0, scale 0.8, 200ms

*Reference: SRD §5.6 History Strip Component*

**Acceptance Criteria:**
- [ ] Vertical layout on ≥1400px (FR-035a)
- [ ] Horizontal layout on <1400px (FR-035b)
- [ ] Visual hierarchy indicates recency (FR-035c)
- [ ] Dynamic sizing based on available space
- [ ] Click opens History Modal

---

### Phase 4.6: Controls Bar (Auto-Hide)

**Duration:** 0.5 days

**Files:**
- `src/app/play/_components/controls-bar.tsx`

**Deliverables:**

| Button | Action | SRD Reference |
|--------|--------|---------------|
| Draw Card | Call next card | §3.4 |
| Pause | Pause game | FR-014 |
| History | Open modal | FR-040 |
| Fullscreen | Toggle fullscreen | FR-020 |
| Disconnect | End session | - |

**Auto-Hide Behavior (per SRD §2.4):**
- Hidden in paired mode by default (FR-021)
- Appears on bottom hover with 3s timeout (FR-022)
- ESC key toggles visibility (FR-023)

**Animation:**
- Reveal: `y: 100% → y: 0`, 300ms ease-out

*Reference: SRD §2.4, FR-020 through FR-024*

**Acceptance Criteria:**
- [ ] Visible in standalone mode (FR-020)
- [ ] Hidden in paired mode (FR-021)
- [ ] Appears on hover with timeout (FR-022)
- [ ] ESC toggles visibility (FR-023)
- [ ] Becomes visible when controller disconnects (FR-024)

---

### Phase 4.7: History Modal

**Duration:** 0.5 days

**Files:**
- `src/app/play/_components/history-modal.tsx`
- `src/app/play/_components/history-card.tsx`

**Deliverables:**

| Feature | Description | SRD Reference |
|---------|-------------|---------------|
| Grid Layout | Responsive columns (6/4/3) | §5.7 |
| Chronological Order | First called at top-left | FR-044 |
| Current Card Highlight | Border on current | §5.7 |
| Click to Expand | Shows shortText | FR-045 |

*Reference: SRD §5.7 History Modal*

**Acceptance Criteria:**
- [ ] Accessible from Host and Controller (FR-041)
- [ ] Shows all called cards in grid (FR-040)
- [ ] Chronological order (FR-044)
- [ ] Click shows educational text (FR-045)

---

### 🧪 Unit Tests: Phase 4

**Test File:** `src/lib/game/__tests__/state-machine.test.ts`

```typescript
describe('Host UI State Machine', () => {
  describe('State Transitions', () => {
    it('should start in standalone mode');
    it('should transition to paired on CONTROLLER_CONNECTED');
    it('should auto-fullscreen when paired');
    it('should hide controls when paired');
    it('should show controls on CONTROLLER_DISCONNECTED');
    it('should toggle controls on TOGGLE_CONTROLS');
    it('should show controls temporarily on HOVER_BOTTOM');
    it('should hide controls after HOVER_TIMEOUT');
  });
  
  describe('Fullscreen Behavior', () => {
    it('should maintain fullscreen after controller disconnect');
    it('should toggle fullscreen on TOGGLE_FULLSCREEN');
  });
});
```

---

## Milestone 5: Remote Controller

**Duration:** 3 days  
**Priority:** 🔴 Critical  
**Dependencies:** Milestones 1, 2

### Objective

Build the mobile-optimized Remote Controller for untethered game control.

*Reference: SRD §5.2 Remote Controller Layout*

---

### Phase 5.1: Controller Layout

**Duration:** 0.5 days

**Files:**
- `src/app/play/_components/remote-controller.tsx`

**Deliverables:**

| Zone | Purpose | SRD Reference |
|------|---------|---------------|
| Top | Connection status | §5.2 |
| Middle | Mini card preview | §5.2 |
| Main | Giant draw button | §5.2 |
| Bottom | Secondary controls | §5.2 |

**Thumb-Zone Design:**
- Giant button in thumb-reachable zone
- Touch targets minimum 44x44px (§5.12)

*Reference: SRD §5.2 Remote Controller Layout*

**Acceptance Criteria:**
- [ ] Layout matches SRD §5.2 wireframe
- [ ] Touch targets ≥44x44px (§5.12)
- [ ] Optimized for one-handed operation

---

### Phase 5.2: Draw Button with Haptics

**Duration:** 0.5 days

**Files:**
- `src/app/play/_components/draw-button.tsx`

**Deliverables:**

```typescript
function triggerHaptic(style: 'light' | 'medium' | 'heavy' = 'medium') {
  if ('vibrate' in navigator) {
    const patterns = {
      light: [10],
      medium: [30],
      heavy: [50, 30, 50],
    };
    navigator.vibrate(patterns[style]);
  }
}
```

*Reference: SRD Appendix B: Haptic Feedback*

**Acceptance Criteria:**
- [ ] Giant button prominently displayed
- [ ] Haptic feedback on press (Appendix B)
- [ ] Visual feedback on press/release
- [ ] Disabled state when game paused/finished

---

### Phase 5.3: Mini Card Sync Display

**Duration:** 0.5 days

**Files:**
- `src/app/play/_components/mini-card.tsx`

**Deliverables:**

| Feature | Description | SRD Reference |
|---------|-------------|---------------|
| Card Image | Smaller version of current card | FR-042 |
| Card Name | Displayed below image | FR-042 |
| Sync | Updates in real-time with Host | FR-042 |

*Reference: SRD §5.2, FR-042*

**Acceptance Criteria:**
- [ ] Displays current card in sync with Host (FR-042)
- [ ] Updates immediately on state change
- [ ] Graceful handling of missing images

---

### Phase 5.4: Connection Status Indicator

**Duration:** 0.5 days

**Files:**
- `src/app/play/_components/connection-status.tsx`

**Deliverables:**

| State | Display | SRD Reference |
|-------|---------|---------------|
| Connected | `● Connected to ABCD` | §5.2 |
| Reconnecting | `⟳ Reconnecting...` | FR-007 |
| Lost | Error state with retry | FR-007 |

**Animation:**
- Pulse animation for connected indicator (§5.4)

*Reference: SRD §5.2, §5.11 Error States, FR-007*

**Acceptance Criteria:**
- [ ] Shows session ID when connected
- [ ] Shows "Reconnecting..." for 10s on disconnect (FR-007)
- [ ] Shows "Connection Lost" with retry after 10s (FR-007)
- [ ] Pulse animation per §5.4

---

### Phase 5.5: Pause/Resume Controls

**Duration:** 0.5 days

**Files:**
- `src/app/play/_components/remote-controller.tsx`

**Deliverables:**

| Control | Description | SRD Reference |
|---------|-------------|---------------|
| Pause | Pauses card calling | FR-014 |
| Resume | Resumes from pause | FR-014 |
| History | Opens history modal | FR-041 |

*Reference: SRD §5.2, FR-014, FR-041*

**Acceptance Criteria:**
- [ ] Pause/Resume toggle works correctly (FR-014)
- [ ] History button opens modal (FR-041)
- [ ] Card counter displayed at bottom

---

### Phase 5.6: Session Entry & QR Pairing

**Duration:** 0.5 days

**Files:**
- `src/app/play/_components/qr-pairing.tsx`
- `src/app/play/_components/session-code-input.tsx`

**Deliverables:**

| Feature | Description | SRD Reference |
|---------|-------------|---------------|
| QR Code | Displayed on Host with session URL | FR-002 |
| Auto-Join | Controller joins when QR scanned | FR-003 |
| Manual Entry | 4-character code input | FR-005 |

**URL Patterns (per SRD §5.9):**
- `/play/new` — Create new session (Host)
- `/play/join` — Manual code entry (Controller)
- `/play/join?code=X` — Auto-join via QR
- `/play/ABCD` — Session page (auto-detect role)
- `/play/ABCD/host` — Force Host view
- `/play/ABCD/control` — Force Controller view

*Reference: SRD §5.9 Session Entry & QR Pairing UI*

**Acceptance Criteria:**
- [ ] QR code displayed on Host (FR-002)
- [ ] QR encodes full URL with session ID
- [ ] Controller auto-joins on QR scan (FR-003)
- [ ] Manual code entry fallback (FR-005)
- [ ] All URL patterns from §5.9 work correctly

---

### 🧪 Unit Tests: Phase 5

**Test File:** `src/app/play/_components/__tests__/remote-controller.test.tsx`

```typescript
describe('Remote Controller', () => {
  describe('Draw Button', () => {
    it('should trigger haptic feedback');
    it('should send DRAW_CARD command');
    it('should be disabled when paused');
    it('should be disabled when finished');
  });
  
  describe('Mini Card', () => {
    it('should display current card');
    it('should update on state change');
  });
  
  describe('Connection Status', () => {
    it('should show connected state');
    it('should show reconnecting state');
    it('should show lost state after timeout');
  });
});
```

---

## Milestone 6: Integration & State Sync

**Duration:** 2 days  
**Priority:** 🔴 Critical  
**Dependencies:** Milestones 1-5

### Objective

Connect all components, implement game logic, and ensure seamless state synchronization.

*Reference: SRD §4.2 Game Core Logic*

---

### Phase 6.1: Shuffle Algorithm

**Duration:** 0.5 days

**Files:**
- `src/lib/shuffle/crypto-shuffle.ts`

**Deliverables:**

```typescript
interface ShuffleResult<T> {
  shuffled: T[];
  seedUsed: number;
}

// CSPRNG shuffle
function cryptoShuffle<T>(array: T[]): ShuffleResult<T>;

// Reproducible shuffle
function seededShuffle<T>(array: T[], seed: number): ShuffleResult<T>;
```

*Reference: SRD §7.1 Shuffle Algorithm*

**Acceptance Criteria:**
- [ ] Uses Web Crypto API for randomness (FR-011)
- [ ] Saves seed for reproducibility (FR-011)
- [ ] Fisher-Yates implementation
- [ ] Mulberry32 PRNG for seeded shuffle

---

### Phase 6.2: Game Session Management

**Duration:** 0.5 days

**Files:**
- `src/lib/game/session.ts`
- `src/stores/game-store.ts`

**Deliverables:**

```typescript
interface GameStore {
  session: GameSession | null;
  
  // Session lifecycle
  createSession: (deck: DeckDefinition, boards: GeneratedBoard[]) => void;
  loadSession: (sessionId: string) => void;
  resetSession: () => void;
  
  // Game actions
  drawCard: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  
  // State
  getCurrentItem: () => ItemDefinition | null;
  getHistory: () => ItemDefinition[];
  getRemainingCount: () => number;
}
```

*Reference: SRD §3.2 GameSession, §4.2 Game Core Logic*

**Acceptance Criteria:**
- [ ] Session created with shuffled deck (FR-011)
- [ ] DRAW_CARD advances index, updates history (FR-012)
- [ ] Remaining count tracked (FR-013)
- [ ] Pause/Resume works (FR-014)
- [ ] Reset reshuffles and restarts (FR-015)

---

### Phase 6.3: Image Preloader

**Duration:** 0.5 days

**Files:**
- `src/lib/game/image-preloader.ts`

**Deliverables:**

```typescript
class ImagePreloader {
  preloadUpcoming(deck: ItemDefinition[], shuffledIds: string[], currentIndex: number): void;
  isReady(id: string): boolean;
  clear(): void;
}

// React hook
function useImagePreloader(
  deck: ItemDefinition[],
  shuffledIds: string[],
  currentIndex: number
): ImagePreloader;
```

*Reference: SRD §7.3 Image Preloader, FR-016*

**Acceptance Criteria:**
- [ ] Preloads next 3 cards (FR-016)
- [ ] Handles load errors gracefully
- [ ] Clears cache on session end

---

### Phase 6.4: Session Persistence

**Duration:** 0.5 days

**Files:**
- `src/lib/game/session.ts`

**Deliverables:**

| Feature | Description | SRD Reference |
|---------|-------------|---------------|
| URL State | Session ID in URL | NFR-013 |
| LocalStorage | Session recovery | NFR-013 |
| Page Refresh | State survives refresh | NFR-013 |

*Reference: SRD NFR-013*

**Acceptance Criteria:**
- [ ] Session ID in URL allows sharing
- [ ] State persisted to localStorage
- [ ] Page refresh recovers state (NFR-013)
- [ ] Expired sessions handled gracefully

---

### 🧪 Unit Tests: Phase 6

**Test File:** `src/lib/shuffle/__tests__/crypto-shuffle.test.ts`

```typescript
describe('Crypto Shuffle', () => {
  it('should return all items');
  it('should produce different order than input');
  it('should produce same result with same seed');
  it('should produce different results with different seeds');
});
```

**Test File:** `src/lib/game/__tests__/session.test.ts`

```typescript
describe('Game Session', () => {
  describe('Session Lifecycle', () => {
    it('should create session with shuffled deck');
    it('should load session by ID');
    it('should reset session');
  });
  
  describe('Game Actions', () => {
    it('should advance on draw card');
    it('should update history on draw');
    it('should track remaining count');
    it('should pause and resume');
  });
  
  describe('Persistence', () => {
    it('should persist to localStorage');
    it('should recover from localStorage');
    it('should handle missing session');
  });
});
```

---

## Milestone 7: Polish & Accessibility

**Duration:** 2 days  
**Priority:** 🟡 High  
**Dependencies:** Milestones 1-6

### Objective

Finalize UI polish, animations, error handling, and accessibility compliance.

*Reference: SRD §5.4 Animation Specifications, §5.11 Error States, §5.12 Accessibility*

---

### Phase 7.1: Animation Tuning

**Duration:** 0.5 days

**Files:**
- All component files with animations

**Deliverables:**

| Element | Animation | Timing | SRD Reference |
|---------|-----------|--------|---------------|
| Card Entrance | rotateY(-90°→0°) | spring(200, 20) | §5.4 |
| Card Exit | rotateY(0°→90°) | spring(200, 20) | §5.4 |
| Text Panel | opacity+x slide | 500ms, 300ms delay | §5.4 |
| Card Flip | rotateY(0°↔180°) | spring(300, 30) | §5.4 |
| Strip Enter | scale 0→1 | spring | §5.4 |
| Strip Shift | translate | 300ms ease-out | §5.4 |
| Strip Exit | opacity→0, scale 0.8 | 200ms | §5.4 |
| Controls Reveal | y: 100%→0 | 300ms ease-out | §5.4 |
| Connection Pulse | pulse | 2s infinite | §5.4 |

*Reference: SRD §5.4 Animation Specifications*

**Acceptance Criteria:**
- [ ] All animations match SRD §5.4 specifications
- [ ] Respects `prefers-reduced-motion` (§5.12)
- [ ] 60fps performance (NFR-002)

---

### Phase 7.2: Error States

**Duration:** 0.5 days

**Files:**
- `src/app/play/_components/error-states.tsx`

**Deliverables:**

| Error | Display | Recovery | SRD Reference |
|-------|---------|----------|---------------|
| CONNECTION_LOST | Reconnecting → Lost | Retry button | §5.11 |
| SESSION_NOT_FOUND | Error message | Enter code/Create new | §5.11 |
| INVALID_DECK | Validation errors | Upload different | §5.11 |
| CONTROLLER_ALREADY_CONNECTED | Warning | Take over/Watch | §5.11 |

*Reference: SRD §5.11 Error States UI, FR-007, FR-008*

**Acceptance Criteria:**
- [ ] All error states from §5.11 implemented
- [ ] Error messages are actionable
- [ ] Recovery options available
- [ ] Auto-retry for connection issues (FR-006)

---

### Phase 7.3: Responsive Testing

**Duration:** 0.5 days

**Deliverables:**

| Breakpoint | Target | Adjustments | SRD Reference |
|------------|--------|-------------|---------------|
| <640px | Mobile | Controller layout | §5.5 |
| 640-1024px | Tablet | Condensed Host | §5.5 |
| >1024px | Desktop | Full Host layout | §5.5 |
| >1400px | Wide | Vertical history strip | §5.5, FR-035a |
| >1920px | Large | Increased spacing | §5.5 |

**Aspect Ratio Handling (per SRD §5.8):**
- 16:9: Standard layout
- 21:9: Centered with decorative margins
- 16:10: More vertical space for text

*Reference: SRD §5.5 Responsive Breakpoints, §5.8 Aspect Ratio Handling*

**Acceptance Criteria:**
- [ ] All breakpoints from §5.5 tested
- [ ] Aspect ratios from §5.8 handled
- [ ] History strip adapts correctly
- [ ] Touch targets ≥44px on mobile

---

### Phase 7.4: Accessibility Compliance

**Duration:** 0.5 days

**Deliverables:**

| Requirement | Implementation | SRD Reference |
|-------------|----------------|---------------|
| Keyboard Navigation | Tab, Enter, Space | §5.12 |
| Screen Reader | ARIA labels | §5.12 |
| Focus Indicators | Visible focus rings | §5.12 |
| Color Contrast | WCAG AA (4.5:1) | §5.12 |
| Reduced Motion | prefers-reduced-motion | §5.12 |
| Touch Targets | ≥44x44px | §5.12 |

*Reference: SRD §5.12 Accessibility*

**Acceptance Criteria:**
- [ ] All controls keyboard accessible (§5.12)
- [ ] ARIA labels on interactive elements (§5.12)
- [ ] Visible focus indicators (§5.12)
- [ ] Color contrast WCAG AA (§5.12)
- [ ] Reduced motion respected (§5.12)
- [ ] Touch targets ≥44px (§5.12)

---

### 🧪 Unit Tests: Phase 7

**Test File:** `src/app/play/_components/__tests__/accessibility.test.tsx`

```typescript
describe('Accessibility', () => {
  describe('Keyboard Navigation', () => {
    it('should allow tab navigation');
    it('should activate on Enter/Space');
  });
  
  describe('ARIA', () => {
    it('should have labels on buttons');
    it('should announce state changes');
  });
  
  describe('Reduced Motion', () => {
    it('should disable animations when preferred');
  });
});
```

---

## Test Strategy

### Test Pyramid

```
        /\
       /  \   E2E Tests (Playwright)
      /────\   - Complete game flow
     /      \  - Host-Controller pairing
    /────────\
   /          \ Integration Tests
  /   ──────   \ - Component interactions
 /              \ - Store updates
/────────────────\
       Unit Tests
  - Pure functions
  - State machines
  - Validators
```

### Key Test Files

| File | Coverage | Priority |
|------|----------|----------|
| `src/lib/types/__tests__/game.test.ts` | Type validation | 🔴 Critical |
| `src/lib/game/__tests__/deck-loader.test.ts` | Deck validation | 🔴 Critical |
| `src/lib/game/__tests__/state-machine.test.ts` | UI state machine | 🔴 Critical |
| `src/lib/game/__tests__/session.test.ts` | Game session | 🔴 Critical |
| `src/lib/shuffle/__tests__/crypto-shuffle.test.ts` | Shuffle algorithm | 🔴 Critical |
| `src/lib/realtime/__tests__/partykit-client.test.ts` | WebSocket client | 🟡 High |

### NFR Verification

| NFR | Test Method | Target |
|-----|-------------|--------|
| NFR-001 | Latency measurement | <200ms |
| NFR-002 | FPS monitoring | 60fps |
| NFR-003 | Lighthouse | LCP <2.5s |
| NFR-004 | Lighthouse | TTI <3s |
| NFR-005 | Bundle analyzer | <200KB gzip |
| NFR-006 | Integration test | Card transition <50ms |

*Reference: SRD §6.1 Performance*

---

## SRD Traceability Matrix

### Functional Requirements Coverage

| ID | Requirement | Milestone | Phase | Status |
|----|-------------|-----------|-------|--------|
| FR-001 | 4-char Session ID | M2 | 2.2 | ⬜ |
| FR-002 | QR Code on Host | M5 | 5.6 | ⬜ |
| FR-003 | Auto-join on QR scan | M5 | 5.6 | ⬜ |
| FR-004 | Auto-fullscreen on connect | M4 | 4.1 | ⬜ |
| FR-005 | Manual code entry | M5 | 5.6 | ⬜ |
| FR-006 | Auto-reconnect (5s) | M2 | 2.4 | ⬜ |
| FR-007 | Reconnection UI | M5 | 5.4 | ⬜ |
| FR-008 | Host controls on reload | M4 | 4.6 | ⬜ |
| FR-010 | Load DeckDefinition | M3 | 3.3 | ⬜ |
| FR-010a | Demo deck | M3 | 3.2 | ⬜ |
| FR-010b | User deck upload | M3 | 3.3 | ⬜ |
| FR-011 | CSPRNG shuffle with seed | M6 | 6.1 | ⬜ |
| FR-012 | DRAW_CARD command | M6 | 6.2 | ⬜ |
| FR-013 | Track remaining cards | M6 | 6.2 | ⬜ |
| FR-014 | Pause/Resume | M6 | 6.2 | ⬜ |
| FR-015 | Reset/reshuffle | M6 | 6.2 | ⬜ |
| FR-016 | Preload next 3 images | M6 | 6.3 | ⬜ |
| FR-017 | Apply deck theme | M3 | 3.3 | ⬜ |
| FR-020 | Standalone mode controls | M4 | 4.6 | ⬜ |
| FR-021 | Paired mode auto-fullscreen | M4 | 4.1 | ⬜ |
| FR-022 | Controls on bottom hover | M4 | 4.6 | ⬜ |
| FR-023 | ESC toggles controls | M4 | 4.1 | ⬜ |
| FR-024 | Controls on disconnect | M4 | 4.6 | ⬜ |
| FR-030 | Card image (2:3 ratio) | M4 | 4.2 | ⬜ |
| FR-031 | Card name prominent | M4 | 4.2 | ⬜ |
| FR-032 | shortText alongside | M4 | 4.3 | ⬜ |
| FR-033 | Card counter | M4 | 4.2 | ⬜ |
| FR-034 | Click to flip | M4 | 4.4 | ⬜ |
| FR-035 | Dynamic history strip | M4 | 4.5 | ⬜ |
| FR-035a | Vertical strip (≥1400px) | M4 | 4.5 | ⬜ |
| FR-035b | Horizontal strip (<1400px) | M4 | 4.5 | ⬜ |
| FR-035c | Visual hierarchy | M4 | 4.5 | ⬜ |
| FR-040 | History modal | M4 | 4.7 | ⬜ |
| FR-041 | Modal on Host and Controller | M4, M5 | 4.7, 5.5 | ⬜ |
| FR-042 | Mini-card sync | M5 | 5.3 | ⬜ |
| FR-043 | Strip card animation | M4 | 4.5 | ⬜ |
| FR-044 | History chronological order | M4 | 4.7 | ⬜ |
| FR-045 | Click card shows text | M4 | 4.7 | ⬜ |

### Non-Functional Requirements Coverage

| ID | Requirement | Target | Verification |
|----|-------------|--------|--------------|
| NFR-001 | WebSocket latency | <200ms | Performance test |
| NFR-002 | Animation FPS | 60fps | Performance test |
| NFR-003 | LCP | <2.5s | Lighthouse |
| NFR-004 | TTI | <3s | Lighthouse |
| NFR-005 | Bundle size | <200KB gzip | Bundle analyzer |
| NFR-006 | Card transition | <50ms | Integration test |
| NFR-007 | Preload queue | 3 cards | Unit test |
| NFR-010 | Auto-reconnect | 30s | Integration test |
| NFR-011 | State recovery | Full sync | Integration test |
| NFR-012 | Offline fallback | Standalone | Manual test |
| NFR-013 | Session persistence | URL+localStorage | Unit test |
| NFR-020 | Browser support | Chrome 90+ | Manual test |
| NFR-021 | Mobile support | iOS 15+ | Manual test |
| NFR-022 | Screen sizes | 375-3840px | Responsive test |
| NFR-023 | Aspect ratios | 16:9, 16:10, 21:9 | Visual test |
| NFR-030 | No audio | - | Code review |
| NFR-031 | Offline boards | - | Integration test |
| NFR-032 | No accounts | - | Architecture review |

---

## File Structure

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

*Reference: SRD §7.6 File Structure*

---

## Timeline Summary

| Milestone | Duration | Phases | Priority |
|-----------|----------|--------|----------|
| M1: Data Models & Core Types | 1 day | 4 | 🔴 Critical |
| M2: Realtime Infrastructure | 3 days | 4 | 🔴 Critical |
| M3: Deck Management | 1.5 days | 3 | 🔴 Critical |
| M4: Host Display | 4 days | 7 | 🔴 Critical |
| M5: Remote Controller | 3 days | 6 | 🔴 Critical |
| M6: Integration & State Sync | 2 days | 4 | 🔴 Critical |
| M7: Polish & Accessibility | 2 days | 4 | 🟡 High |
| **Total** | **16.5 days** | **32** | - |

---

## Success Criteria

### Game System
- [ ] Host Display renders cards with animations
- [ ] Remote Controller connects and controls game
- [ ] Real-time sync between Host and Controller
- [ ] History strip shows all called cards
- [ ] Demo deck loads and plays

### Performance (SRD §6.1)
- [ ] WebSocket latency < 200ms (NFR-001)
- [ ] Animation frame rate 60fps (NFR-002)
- [ ] LCP < 2.5s (NFR-003)
- [ ] TTI < 3s (NFR-004)
- [ ] Bundle size < 200KB gzipped (NFR-005)

### Accessibility (SRD §5.12)
- [ ] All controls keyboard accessible
- [ ] ARIA labels on interactive elements
- [ ] Color contrast WCAG AA
- [ ] Reduced motion respected

### Reliability (SRD §6.2)
- [ ] Auto-reconnection works (NFR-010)
- [ ] State recovery on reconnect (NFR-011)
- [ ] Graceful fallback to standalone (NFR-012)
- [ ] Session persists on refresh (NFR-013)

---

*Document created: December 2024*  
*Based on: tabula-srd.md v3.0*  
*Status: Ready for Implementation*

