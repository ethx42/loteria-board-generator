# Tabula v4.0 — Development Plan

## Principal Engineer Implementation Guide

**Document Version:** 1.0  
**Status:** Approved for Implementation  
**Author:** Adrián (Principal Engineer)  
**Created:** December 2024  
**SRD Reference:** `TABULA_V4_SRD.md`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Pre-Implementation Audit Results](#2-pre-implementation-audit-results)
3. [Architecture Decisions](#3-architecture-decisions)
4. [Milestone 1: Foundation & Infrastructure](#4-milestone-1-foundation--infrastructure)
5. [Milestone 2: Core Feature Implementation](#5-milestone-2-core-feature-implementation)
6. [Milestone 3: Spectator Experience](#6-milestone-3-spectator-experience)
7. [Milestone 4: Polish & Quality Assurance](#7-milestone-4-polish--quality-assurance)
8. [Technical Specifications](#8-technical-specifications)
9. [Risk Mitigation](#9-risk-mitigation)
10. [Appendices](#10-appendices)

---

## 1. Executive Summary

### 1.1 Scope

This document provides the complete implementation roadmap for Tabula v4.0, covering all five features defined in the SRD:

| Feature                       | Priority | Complexity | Est. Days |
| ----------------------------- | -------- | ---------- | --------- |
| Synchronized History Modal    | Critical | Medium     | 2         |
| Audio Feedback System         | High     | Low        | 1.5       |
| Board Prediction Engine       | Medium   | Medium     | 2         |
| Spectator Mode with Reactions | High     | High       | 4         |
| Internationalization (i18n)   | Critical | High       | 3         |

**Total Estimated Duration:** 4-5 weeks (including testing and polish)

### 1.2 Implementation Principles

All code will adhere to:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          IMPLEMENTATION PRINCIPLES                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ✓ SOLID Principles          - Single responsibility, open for extension       │
│  ✓ Clean Architecture        - Domain logic isolated from infrastructure       │
│  ✓ DRY (Don't Repeat)        - Reuse via composition, not duplication          │
│  ✓ Type Safety               - No `any`, strict mode, discriminated unions     │
│  ✓ Accessibility First       - WCAG AA compliance, keyboard navigation         │
│  ✓ Performance Budgets       - Defined latency/FPS targets per feature         │
│  ✓ Test Coverage             - 85%+ on domain logic, E2E on critical paths     │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Milestone Overview

```
Week 1      Week 2      Week 3      Week 4      Week 5
  │           │           │           │           │
  ▼           ▼           ▼           ▼           ▼
┌─────────┬─────────┬─────────┬─────────┬─────────┐
│   M1    │   M1    │   M2    │   M3    │   M4    │
│ Found.  │ Found.  │  Core   │ Spect.  │ Polish  │
│ + i18n  │ + Proto │ Feats.  │  Mode   │  + QA   │
└─────────┴─────────┴─────────┴─────────┴─────────┘
```

---

## 2. Pre-Implementation Audit Results

### 2.1 Codebase Analysis

After thorough examination of the existing codebase, the following observations inform our implementation strategy:

#### Current Architecture

| Component       | Location                                     | State        | Notes                                           |
| --------------- | -------------------------------------------- | ------------ | ----------------------------------------------- |
| PartyKit Server | `party/game.ts`                              | ✅ Solid     | Well-structured, needs extension for spectators |
| WebSocket Types | `src/lib/realtime/types.ts`                  | ✅ Excellent | Discriminated unions, factories, type guards    |
| Game Types      | `src/lib/types/game.ts`                      | ✅ Excellent | Complete, well-documented                       |
| HistoryModal    | `src/app/play/_components/history-modal.tsx` | ✅ Ready     | Can be reused on Controller as-is               |
| Deck Manifest   | `public/decks/demo/manifest.json`            | ✅ Stable    | Used for game cards, not boards                 |

#### Gap Analysis

| Gap                         | Resolution                                               | Implementation Phase |
| --------------------------- | -------------------------------------------------------- | -------------------- |
| No board manifest schema    | Use generator output format as primary, normalize legacy | Phase 1A             |
| No spectator role in server | Extend `ClientRole` type and handlers                    | Phase 3A             |
| No i18n infrastructure      | Fresh setup with `next-intl`                             | Phase 1B             |
| No audio system             | New singleton pattern implementation                     | Phase 2B             |
| Sound file needed           | Use existing `/public/sound-effects/notif.mp3`           | Phase 2B             |

### 2.2 Dependency Compatibility

| Package       | Current | Required | Action        |
| ------------- | ------- | -------- | ------------- |
| next          | 16.x    | 16.x     | ✅ Compatible |
| react         | 19.x    | 19.x     | ✅ Compatible |
| framer-motion | 12.x    | 12.x     | ✅ Compatible |
| partykit      | latest  | latest   | ✅ Compatible |
| next-intl     | -       | ^3.22.0  | 🆕 Install    |

---

## 3. Architecture Decisions

### 3.1 i18n Strategy (ADR-001)

**Decision:** Implement locale detection with non-invasive switching.

**Rationale:** The game experience should be seamless. Language detection happens once on first visit, persists in localStorage, and the switcher is placed in settings/header—not during gameplay.

**Implementation:**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          I18N DETECTION FLOW                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  1. User visits Tabula for the first time                                       │
│     └─► Check localStorage for saved preference                                 │
│         └─► If found: Use saved locale                                          │
│         └─► If not: Detect from navigator.language                             │
│                                                                                 │
│  2. Locale determined                                                           │
│     └─► Set as default for all routes                                          │
│     └─► Save to localStorage for future visits                                 │
│                                                                                 │
│  3. User wants to change language (optional)                                    │
│     └─► Language switcher in header (small, unobtrusive)                       │
│     └─► During game: NO language UI (focus on gameplay)                        │
│     └─► Language switcher accessible from pause menu only                      │
│                                                                                 │
│  4. Route strategy: URL-based with invisible redirects                          │
│     └─► /play/host → /es/play/host (redirected, user sees /play/host)         │
│     └─► This allows sharing URLs that work for everyone                        │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Key Decisions:**

- Use `next-intl` with middleware for locale detection
- **No** locale prefix in visible URLs (use rewrites)
- Locale stored in localStorage + cookie for SSR consistency
- Language switcher hidden during active gameplay
- Fallback chain: localStorage → cookie → navigator.language → 'es'

### 3.2 Audio System Design (ADR-002)

**Decision:** Web Audio API with singleton manager and lazy initialization.

**Rationale:** Browser autoplay policies require user interaction before audio can play. We initialize the AudioContext on first user interaction (any button click), then play sounds freely.

**Sound Specification:**

| Property    | Value                             | Justification                              |
| ----------- | --------------------------------- | ------------------------------------------ |
| Source File | `/public/sound-effects/notif.mp3` | Existing asset, avoids licensing issues    |
| Duration    | ~300ms                            | Short enough to not overlap on rapid draws |
| Character   | Notification-style                | Fits existing sound profile                |
| Volume      | 50% default                       | Non-intrusive                              |

**Fallback Strategy:**

1. Primary: Web Audio API with buffered source
2. Fallback: HTML5 `<audio>` element (for older browsers)
3. Silent fail: If both fail, log warning and continue

### 3.3 Board Data Architecture (ADR-003)

**Decision:** Prioritize generator output format, support legacy via normalization layer.

**Rationale:** The generator output is more complete and well-typed. Legacy format must be supported for backward compatibility but should not drive the architecture.

**Schema Hierarchy:**

```typescript
// Primary format (Generator output)
interface BoardsManifest {
  game: string;
  generatedAt?: string;
  totalBoards: number;
  boardSize: BoardSize;
  stats?: GenerationStats;
  boards: BoardDefinition[];
}

// BoardDefinition (unified)
interface BoardDefinition {
  id: string; // "board-1"
  number: number; // 1
  items: string[]; // ["MOJARRA FRITA", ...]
  grid: string[][]; // 2D layout
}

// Normalization handles legacy format automatically
function normalizeBoards(data: unknown): BoardsManifest;
```

### 3.4 Component Reuse Philosophy (ADR-004)

**Decision:** Reuse existing components across all views. Single source of truth.

**Rationale:** The existing `play/_components/` folder contains well-designed, tested components. Creating new "spectator versions" would violate DRY, create maintenance burden, and risk visual inconsistencies.

**Reuse Map:**

| Component                   | Location            | Used By                     |
| --------------------------- | ------------------- | --------------------------- |
| `CurrentCard`               | `play/_components/` | Host, Spectator             |
| `HistoryStrip`              | `play/_components/` | Host, Spectator             |
| `HistoryModal`              | `play/_components/` | Host, Controller, Spectator |
| `ConnectionStatusIndicator` | `play/_components/` | Controller, Spectator       |
| `MiniCard`                  | `play/_components/` | Controller, Spectator       |
| `TextPanel`                 | `play/_components/` | Host, Spectator             |

**New Components (Only Where Truly Needed):**

| Component              | Location      | Purpose                                  |
| ---------------------- | ------------- | ---------------------------------------- |
| `ReactionsOverlay`     | `components/` | Floating emoji animations (Host display) |
| `ReactionBar`          | `components/` | Emoji buttons (Spectator view only)      |
| `BoardStatusIndicator` | `components/` | Board completion tracker (Host only)     |
| `SoundToggle`          | `components/` | Audio preference toggle                  |
| `LanguageSwitcher`     | `components/` | i18n locale switcher                     |

**Implementation Rule:**

```typescript
// ✅ CORRECT: Import from existing components
import { CurrentCard, HistoryStrip } from "@/app/play/_components";

// ❌ WRONG: Creating duplicate SpectatorCard
// import { SpectatorCard } from "./spectator-card";
```

### 3.5 Spectator Connection Flow (ADR-005)

**Decision:** Spectators join via QR code or direct URL with room ID.

**Flow:**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       SPECTATOR JOIN FLOW                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  HOST DISPLAY                           SPECTATOR                               │
│  ─────────────                         ─────────────                            │
│  1. QR code shows two URLs:             1. Scan QR or open URL                  │
│     • Controller: /join?room=ABCD       2. /spectator?room=ABCD                 │
│     • Spectator:  /spectator?room=ABCD  3. WebSocket connects with role=spectator
│                                         4. Receives STATE_UPDATE broadcasts     │
│  2. Small text: "Share for spectators"  5. Can send SEND_REACTION               │
│                                         6. Cannot send game commands            │
│                                                                                 │
│  SERVER (PartyKit)                                                              │
│  ─────────────────                                                              │
│  • Tracks spectatorIds: Set<string>                                             │
│  • Rate limits reactions (1/sec/spectator)                                     │
│  • Batches reactions every 500ms                                               │
│  • Broadcasts spectator count changes                                          │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Milestone 1: Foundation & Infrastructure

**Duration:** 7-8 days  
**Goal:** Establish architectural foundation for all v4.0 features

### Phase 1A: Schema Unification

**Duration:** 1.5 days  
**Dependencies:** None

#### Objectives

- Create unified board types
- Implement normalization utilities
- Support both legacy and generator formats

#### Task Breakdown

| ID    | Task                               | File                                         | Est. | Priority |
| ----- | ---------------------------------- | -------------------------------------------- | ---- | -------- |
| 1A-01 | Create `BoardSize` type            | `src/lib/types/boards.ts`                    | 15m  | Critical |
| 1A-02 | Create `BoardDefinition` interface | `src/lib/types/boards.ts`                    | 20m  | Critical |
| 1A-03 | Create `BoardsManifest` interface  | `src/lib/types/boards.ts`                    | 20m  | Critical |
| 1A-04 | Create `GenerationStats` interface | `src/lib/types/boards.ts`                    | 15m  | Medium   |
| 1A-05 | Add type guards for board types    | `src/lib/types/boards.ts`                    | 30m  | High     |
| 1A-06 | Implement `extractItemId()`        | `src/lib/boards/normalize.ts`                | 20m  | High     |
| 1A-07 | Implement `extractItemName()`      | `src/lib/boards/normalize.ts`                | 15m  | High     |
| 1A-08 | Implement `normalizeBoards()`      | `src/lib/boards/normalize.ts`                | 45m  | Critical |
| 1A-09 | Implement `normalizeBoardSize()`   | `src/lib/boards/normalize.ts`                | 15m  | High     |
| 1A-10 | Write unit tests                   | `src/lib/boards/__tests__/normalize.test.ts` | 1h   | Critical |
| 1A-11 | Re-export from types index         | `src/lib/types/index.ts`                     | 10m  | Low      |

#### Deliverables

```
src/lib/
├── types/
│   ├── boards.ts              # NEW: Unified board types
│   └── index.ts               # MODIFIED: Re-export board types
└── boards/
    ├── normalize.ts           # NEW: Normalization utilities
    └── __tests__/
        └── normalize.test.ts  # NEW: Unit tests (95%+ coverage)
```

#### Implementation Details

```typescript
// src/lib/types/boards.ts

/**
 * Valid board dimension strings.
 * Normalized to use lowercase 'x' separator.
 */
export type BoardSize = "3x3" | "4x4" | "5x5" | "6x6";

/**
 * Statistics from board generation.
 * Optional in manifest (only present for generated boards).
 */
export interface GenerationStats {
  readonly maxOverlap: number;
  readonly avgOverlap: number;
  readonly solver: string;
  readonly generationTimeMs: number;
}

/**
 * Single board definition.
 * Unified format supporting both legacy and generator output.
 */
export interface BoardDefinition {
  /** Unique identifier (e.g., "board-1") */
  readonly id: string;

  /** Display number (1-indexed) */
  readonly number: number;

  /** Flat array of item identifiers */
  readonly items: readonly string[];

  /** 2D grid layout for visual display */
  readonly grid: readonly (readonly string[])[];
}

/**
 * Complete boards manifest.
 * Primary data structure for board tracking features.
 */
export interface BoardsManifest {
  /** Game/deck name */
  readonly game: string;

  /** Total boards in set */
  readonly totalBoards: number;

  /** Board dimensions */
  readonly boardSize: BoardSize;

  /** Generation algorithm (optional) */
  readonly algorithm?: string;

  /** Generation timestamp ISO 8601 (optional) */
  readonly generatedAt?: string;

  /** Generation statistics (optional) */
  readonly stats?: GenerationStats;

  /** Board definitions */
  readonly boards: readonly BoardDefinition[];
}
```

#### Acceptance Criteria

- [ ] `BoardsManifest` type correctly represents both formats
- [ ] `normalizeBoards()` handles generator JSON (primary format)
- [ ] `normalizeBoards()` handles legacy JSON (backward compat)
- [ ] `extractItemId()` extracts "03" from "03 BOLLO DE MAÍZ"
- [ ] `extractItemName()` extracts "BOLLO DE MAÍZ" from "03 BOLLO DE MAÍZ"
- [ ] Unit tests cover edge cases (empty arrays, malformed input)
- [ ] Test coverage ≥95%

---

### Phase 1B: Internationalization Infrastructure

**Duration:** 2.5 days  
**Dependencies:** None (can parallel with 1A)

#### Objectives

- Set up next-intl with locale detection
- Create translation file structure
- Implement non-invasive language switching

#### Task Breakdown

| ID    | Task                         | File                                   | Est. | Priority |
| ----- | ---------------------------- | -------------------------------------- | ---- | -------- |
| 1B-01 | Install `next-intl`          | `package.json`                         | 5m   | Critical |
| 1B-02 | Create i18n config           | `src/i18n/config.ts`                   | 20m  | Critical |
| 1B-03 | Create request config        | `src/i18n/request.ts`                  | 25m  | Critical |
| 1B-04 | Create routing config        | `src/i18n/routing.ts`                  | 20m  | Critical |
| 1B-05 | Create middleware            | `src/middleware.ts`                    | 45m  | Critical |
| 1B-06 | Create Spanish translations  | `src/messages/es.json`                 | 1h   | Critical |
| 1B-07 | Create English translations  | `src/messages/en.json`                 | 1h   | Critical |
| 1B-08 | Create locale layout wrapper | `src/app/[locale]/layout.tsx`          | 30m  | Critical |
| 1B-09 | Migrate root page            | `src/app/[locale]/page.tsx`            | 20m  | High     |
| 1B-10 | Migrate play routes          | `src/app/[locale]/play/**`             | 1h   | Critical |
| 1B-11 | Migrate generator route      | `src/app/[locale]/generator/**`        | 45m  | High     |
| 1B-12 | Create `LanguageSwitcher`    | `src/components/language-switcher.tsx` | 40m  | High     |
| 1B-13 | Add locale persistence util  | `src/lib/i18n/persistence.ts`          | 30m  | High     |
| 1B-14 | Update next.config.ts        | `next.config.ts`                       | 20m  | Critical |
| 1B-15 | Create root redirect         | `src/app/page.tsx`                     | 15m  | High     |
| 1B-16 | Write integration tests      | `src/i18n/__tests__/`                  | 1h   | High     |

#### Deliverables

```
src/
├── i18n/
│   ├── config.ts              # NEW: Locale configuration
│   ├── request.ts             # NEW: Server request config
│   ├── routing.ts             # NEW: Routing utilities
│   └── __tests__/
│       └── detection.test.ts  # NEW: Locale detection tests
├── lib/
│   └── i18n/
│       └── persistence.ts     # NEW: localStorage + cookie sync
├── messages/
│   ├── es.json                # NEW: Spanish translations
│   └── en.json                # NEW: English translations
├── middleware.ts              # NEW: Locale detection middleware
├── app/
│   ├── [locale]/              # NEW: Locale-prefixed routes
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── play/
│   │   │   ├── host/page.tsx
│   │   │   ├── join/page.tsx
│   │   │   └── ...
│   │   └── generator/
│   │       └── page.tsx
│   └── page.tsx               # MODIFIED: Redirect to detected locale
└── components/
    └── language-switcher.tsx  # NEW: Dropdown component
```

#### Implementation Details

**Middleware Strategy:**

```typescript
// src/middleware.ts
import createMiddleware from "next-intl/middleware";
import { locales, defaultLocale } from "./i18n/config";

export default createMiddleware({
  locales,
  defaultLocale,
  // Don't show locale prefix in URL
  localePrefix: "as-needed",
  // Detect from:
  // 1. Cookie (returning user)
  // 2. Accept-Language header (new user)
  localeDetection: true,
});

export const config = {
  // Match all paths except static files and API
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
```

**Locale Persistence:**

```typescript
// src/lib/i18n/persistence.ts

const LOCALE_STORAGE_KEY = "tabula:locale";
const LOCALE_COOKIE_NAME = "NEXT_LOCALE";

export function getStoredLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null;
}

export function setStoredLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  // Also set cookie for SSR consistency
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale};path=/;max-age=31536000`;
}

export function detectSystemLocale(): Locale {
  if (typeof navigator === "undefined") return defaultLocale;

  const browserLang = navigator.language.split("-")[0];
  return locales.includes(browserLang as Locale)
    ? (browserLang as Locale)
    : defaultLocale;
}
```

**Language Switcher (Non-Invasive):**

```typescript
// src/components/language-switcher.tsx

export function LanguageSwitcher({
  className,
  variant = "dropdown", // "dropdown" | "icon-only"
}: LanguageSwitcherProps) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (newLocale: Locale) => {
    setStoredLocale(newLocale);
    router.replace(pathname, { locale: newLocale });
  };

  if (variant === "icon-only") {
    return (
      <button
        onClick={() => handleChange(locale === "es" ? "en" : "es")}
        className={cn("p-2 rounded-full", className)}
        aria-label={`Switch to ${locale === "es" ? "English" : "Español"}`}
      >
        {localeFlags[locale]}
      </button>
    );
  }

  return (
    <select
      value={locale}
      onChange={(e) => handleChange(e.target.value as Locale)}
      className={cn(
        "bg-amber-900/50 text-amber-200 rounded-lg px-3 py-1.5",
        "border border-amber-700/50 cursor-pointer",
        className
      )}
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

#### Acceptance Criteria

- [ ] First-time visitor gets language from browser settings
- [ ] Returning visitor gets language from localStorage
- [ ] Language preference persists across sessions
- [ ] URLs work without locale prefix (e.g., `/play/host`)
- [ ] Direct locale URLs also work (`/es/play/host`, `/en/play/host`)
- [ ] Language switcher NOT visible during active gameplay
- [ ] All existing strings extracted to translation files
- [ ] No TypeScript errors in translation usage

---

### Phase 1C: WebSocket Protocol Extensions

**Duration:** 1.5 days  
**Dependencies:** None (can parallel with 1A/1B)

#### Objectives

- Add new message types for v4.0 features
- Extend PartyKit server for spectators and reactions
- Maintain backward compatibility

#### Task Breakdown

| ID    | Task                              | File                                       | Est. | Priority |
| ----- | --------------------------------- | ------------------------------------------ | ---- | -------- |
| 1C-01 | Add `OpenHistoryMessage` type     | `src/lib/realtime/types.ts`                | 10m  | Critical |
| 1C-02 | Add `CloseHistoryMessage` type    | `src/lib/realtime/types.ts`                | 10m  | Critical |
| 1C-03 | Extend `StateUpdatePayload`       | `src/lib/realtime/types.ts`                | 15m  | Critical |
| 1C-04 | Add `ClientRole` spectator        | `src/lib/realtime/types.ts`                | 10m  | High     |
| 1C-05 | Add `REACTION_EMOJIS` const       | `src/lib/realtime/types.ts`                | 10m  | High     |
| 1C-06 | Add `ReactionEmoji` type          | `src/lib/realtime/types.ts`                | 5m   | High     |
| 1C-07 | Add `SendReactionMessage`         | `src/lib/realtime/types.ts`                | 10m  | High     |
| 1C-08 | Add `ReactionBurstMessage`        | `src/lib/realtime/types.ts`                | 15m  | High     |
| 1C-09 | Add `SpectatorCountMessage`       | `src/lib/realtime/types.ts`                | 10m  | High     |
| 1C-10 | Update `WSMessage` union          | `src/lib/realtime/types.ts`                | 10m  | Critical |
| 1C-11 | Add message factories             | `src/lib/realtime/types.ts`                | 20m  | High     |
| 1C-12 | Update `isWSMessage` guard        | `src/lib/realtime/types.ts`                | 15m  | High     |
| 1C-13 | Extend `RoomState` interface      | `party/game.ts`                            | 20m  | Critical |
| 1C-14 | Add `handleSpectatorConnect()`    | `party/game.ts`                            | 30m  | High     |
| 1C-15 | Add `handleSpectatorDisconnect()` | `party/game.ts`                            | 20m  | High     |
| 1C-16 | Add history modal handlers        | `party/game.ts`                            | 25m  | Critical |
| 1C-17 | Add reaction handlers (stub)      | `party/game.ts`                            | 30m  | High     |
| 1C-18 | Update type tests                 | `src/lib/realtime/__tests__/types.test.ts` | 45m  | High     |

#### Deliverables

```
src/lib/realtime/
├── types.ts                   # MODIFIED: New message types
└── __tests__/
    └── types.test.ts          # MODIFIED: Extended tests

party/
└── game.ts                    # MODIFIED: Spectator + history handlers
```

#### Implementation Details

**New Message Types:**

```typescript
// Add to src/lib/realtime/types.ts

// ============================================================================
// HISTORY MODAL SYNC MESSAGES (v4.0)
// ============================================================================

/**
 * Request to open history modal (bidirectional sync).
 * @direction Host→Server→Controller OR Controller→Server→Host
 */
export interface OpenHistoryMessage {
  readonly type: "OPEN_HISTORY";
}

/**
 * Request to close history modal (bidirectional sync).
 * @direction Host→Server→Controller OR Controller→Server→Host
 */
export interface CloseHistoryMessage {
  readonly type: "CLOSE_HISTORY";
}

// ============================================================================
// SPECTATOR & REACTION MESSAGES (v4.0)
// ============================================================================

/**
 * Available reaction emojis.
 * Extensible: add new emojis here and they propagate everywhere.
 */
export const REACTION_EMOJIS = ["👏", "🎉", "❤️", "😮", "🔥", "👀"] as const;

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

/**
 * Spectator sends an emoji reaction.
 * @direction Spectator→Server
 */
export interface SendReactionMessage {
  readonly type: "SEND_REACTION";
  readonly emoji: ReactionEmoji;
}

/**
 * Server broadcasts aggregated reaction burst.
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
 * Server broadcasts spectator count update.
 * @direction Server→All
 */
export interface SpectatorCountMessage {
  readonly type: "SPECTATOR_COUNT";
  readonly count: number;
}

// Update WSMessage union
export type WSMessage =
  | /* ...existing types... */
  | OpenHistoryMessage
  | CloseHistoryMessage
  | SendReactionMessage
  | ReactionBurstMessage
  | SpectatorCountMessage;
```

**Extended StateUpdatePayload:**

```typescript
/**
 * Extended payload with history modal sync.
 */
export interface StateUpdatePayload {
  readonly currentItem: ItemDefinition | null;
  readonly currentIndex: number;
  readonly totalItems: number;
  readonly status: GameStatus;
  readonly historyCount: number;

  // v4.0 additions
  /** Whether history modal is currently open */
  readonly isHistoryOpen?: boolean;

  /** Full history (sent when modal is open or on reconnection) */
  readonly history?: readonly ItemDefinition[];
}
```

**Server Extension (party/game.ts):**

```typescript
// Extended RoomState
interface RoomState {
  hostId: string | null;
  controllerId: string | null;
  gameState: GameStateSnapshot | null;
  createdAt: number;

  // v4.0 additions
  spectatorIds: Set<string>;
  isHistoryOpen: boolean;
  reactionBuffer: Map<ReactionEmoji, number>;
  lastReactionBroadcast: number;
  reactionCooldowns: Map<string, number>;
}

// Extended ClientRole
type ClientRole = "host" | "controller" | "spectator";
```

#### Acceptance Criteria

- [ ] All new message types have readonly modifiers
- [ ] `isWSMessage` type guard handles all new types
- [ ] Message factories exist for all new types
- [ ] PartyKit server compiles without errors
- [ ] Existing WebSocket functionality unaffected
- [ ] Type tests pass with 100% coverage on new types

---

## 5. Milestone 2: Core Feature Implementation

**Duration:** 5-6 days  
**Goal:** Implement History Sync, Audio, and Board Prediction

### Phase 2A: Synchronized History Modal

**Duration:** 2 days  
**Dependencies:** Phase 1C (WebSocket types)

#### Objectives

- Enable bidirectional history modal sync
- Send full history data to Controller
- Handle reconnection gracefully

#### Task Breakdown

| ID    | Task                                    | File                             | Est. | Priority |
| ----- | --------------------------------------- | -------------------------------- | ---- | -------- |
| 2A-01 | Add `isHistoryOpen` to Controller state | `remote-controller.tsx`          | 15m  | Critical |
| 2A-02 | Add `history` array to Controller state | `remote-controller.tsx`          | 15m  | Critical |
| 2A-03 | Handle `OPEN_HISTORY` message           | `remote-controller.tsx`          | 20m  | Critical |
| 2A-04 | Handle `CLOSE_HISTORY` message          | `remote-controller.tsx`          | 15m  | Critical |
| 2A-05 | Dispatch `OPEN_HISTORY` from button     | `remote-controller.tsx`          | 20m  | High     |
| 2A-06 | Add `HistoryModal` to Controller        | `remote-controller.tsx`          | 25m  | High     |
| 2A-07 | Listen for `OPEN_HISTORY` in Host       | `host-display.tsx`               | 20m  | Critical |
| 2A-08 | Listen for `CLOSE_HISTORY` in Host      | `host-display.tsx`               | 15m  | Critical |
| 2A-09 | Include history in `STATE_UPDATE`       | `host-display.tsx`               | 25m  | Critical |
| 2A-10 | Track `isHistoryOpen` in server         | `party/game.ts`                  | 20m  | Critical |
| 2A-11 | Broadcast modal state on reconnect      | `party/game.ts`                  | 25m  | High     |
| 2A-12 | Add translations for history            | `messages/*.json`                | 15m  | Medium   |
| 2A-13 | Write integration tests                 | `__tests__/history-sync.test.ts` | 1.5h | High     |

#### Implementation Details

**Controller State Extension:**

```typescript
// In remote-controller.tsx

interface ControllerGameState {
  currentItem: ItemDefinition | null;
  currentIndex: number;
  totalItems: number;
  status: GameStatus;
  historyCount: number;

  // v4.0 additions
  history: readonly ItemDefinition[];
  isHistoryOpen: boolean;
}

// Handle incoming messages
useEffect(() => {
  const handleMessage = (msg: WSMessage) => {
    switch (msg.type) {
      case "STATE_UPDATE":
        setGameState((prev) => ({
          ...prev,
          ...msg.payload,
          // Include history if provided
          history: msg.payload.history ?? prev.history,
          isHistoryOpen: msg.payload.isHistoryOpen ?? prev.isHistoryOpen,
        }));
        break;

      case "OPEN_HISTORY":
        setGameState((prev) => ({ ...prev, isHistoryOpen: true }));
        break;

      case "CLOSE_HISTORY":
        setGameState((prev) => ({ ...prev, isHistoryOpen: false }));
        break;
    }
  };

  return subscribe(handleMessage);
}, [subscribe]);
```

**Host Broadcast Logic:**

```typescript
// In host-display.tsx

const broadcastState = useCallback(() => {
  const payload: StateUpdatePayload = {
    currentItem,
    currentIndex,
    totalItems,
    status,
    historyCount: history.length,
    isHistoryOpen,
    // Only include full history when modal is open
    ...(isHistoryOpen && { history }),
  };

  send(stateUpdateMessage(payload));
}, [currentItem, currentIndex, totalItems, status, history, isHistoryOpen]);

// Listen for history modal requests from Controller
useEffect(() => {
  const handleMessage = (msg: WSMessage) => {
    if (msg.type === "OPEN_HISTORY") {
      setIsHistoryOpen(true);
    }
    if (msg.type === "CLOSE_HISTORY") {
      setIsHistoryOpen(false);
    }
  };

  return subscribe(handleMessage);
}, [subscribe]);

// Broadcast when history modal state changes
useEffect(() => {
  broadcastState();
}, [isHistoryOpen, broadcastState]);
```

#### Acceptance Criteria

- [ ] Controller can open history modal
- [ ] Controller receives full history data
- [ ] Opening modal on Host opens it on Controller
- [ ] Opening modal on Controller opens it on Host
- [ ] Closing modal syncs bidirectionally
- [ ] Modal state survives Controller reconnection
- [ ] No race conditions with rapid open/close

---

### Phase 2B: Audio Feedback System

**Duration:** 1.5 days  
**Dependencies:** None

#### Objectives

- Create singleton AudioManager
- Implement preference persistence
- Integrate with card draw

#### Task Breakdown

| ID    | Task                                | File                                   | Est. | Priority |
| ----- | ----------------------------------- | -------------------------------------- | ---- | -------- |
| 2B-01 | Create `AudioManager` class         | `src/lib/audio/audio-manager.ts`       | 45m  | Critical |
| 2B-02 | Implement lazy initialization       | `src/lib/audio/audio-manager.ts`       | 30m  | Critical |
| 2B-03 | Implement preference storage        | `src/lib/audio/audio-manager.ts`       | 20m  | High     |
| 2B-04 | Add play/toggle/isEnabled methods   | `src/lib/audio/audio-manager.ts`       | 25m  | Critical |
| 2B-05 | Create `useCardDrawSound` hook      | `src/lib/audio/use-card-draw-sound.ts` | 30m  | Critical |
| 2B-06 | Create `SoundToggle` component      | `src/components/sound-toggle.tsx`      | 30m  | High     |
| 2B-07 | Integrate into `ControlsBar`        | `controls-bar.tsx`                     | 20m  | High     |
| 2B-08 | Trigger sound in Host on draw       | `host-display.tsx`                     | 20m  | High     |
| 2B-09 | Trigger sound in Controller on draw | `remote-controller.tsx`                | 20m  | High     |
| 2B-10 | Handle autoplay policy              | `src/lib/audio/audio-manager.ts`       | 25m  | Critical |
| 2B-11 | Add translations                    | `messages/*.json`                      | 10m  | Low      |
| 2B-12 | Write unit tests                    | `src/lib/audio/__tests__/`             | 1h   | High     |

#### Implementation Details

```typescript
// src/lib/audio/audio-manager.ts

const STORAGE_KEY = "tabula:sound";

class AudioManager {
  private context: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private enabled: boolean;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.enabled = this.loadPreference();
  }

  private loadPreference(): boolean {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored !== "off";
  }

  private savePreference(): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, this.enabled ? "enabled" : "off");
  }

  /**
   * Initialize audio context and load sound.
   * Safe to call multiple times (idempotent).
   * Must be called from user interaction.
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInit();
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    try {
      this.context = new AudioContext();

      // Load existing sound file
      const response = await fetch("/sound-effects/notif.mp3");
      const arrayBuffer = await response.arrayBuffer();
      this.buffer = await this.context.decodeAudioData(arrayBuffer);

      this.initialized = true;
    } catch (error) {
      console.warn("[AudioManager] Failed to initialize:", error);
      // Silent fail - audio is enhancement, not critical
    }
  }

  /**
   * Play the card draw sound.
   * Handles suspended AudioContext (autoplay policy).
   */
  async play(): Promise<void> {
    if (!this.enabled || !this.context || !this.buffer) return;

    try {
      // Resume if suspended
      if (this.context.state === "suspended") {
        await this.context.resume();
      }

      const source = this.context.createBufferSource();
      source.buffer = this.buffer;

      // Apply 50% volume
      const gainNode = this.context.createGain();
      gainNode.gain.value = 0.5;

      source.connect(gainNode);
      gainNode.connect(this.context.destination);
      source.start(0);
    } catch (error) {
      console.warn("[AudioManager] Playback failed:", error);
    }
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    this.savePreference();
    return this.enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.savePreference();
  }
}

// Singleton export
export const audioManager = new AudioManager();
```

**React Hook:**

```typescript
// src/lib/audio/use-card-draw-sound.ts

export function useCardDrawSound() {
  const [isEnabled, setIsEnabled] = useState(true);

  useEffect(() => {
    setIsEnabled(audioManager.isEnabled());
  }, []);

  const initAudio = useCallback(async () => {
    await audioManager.init();
  }, []);

  const playCardSound = useCallback(async () => {
    await audioManager.play();
  }, []);

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

**SoundToggle Component:**

```typescript
// src/components/sound-toggle.tsx

export function SoundToggle({ className }: { className?: string }) {
  const { isEnabled, toggle, initAudio } = useCardDrawSound();
  const t = useTranslations("game.controls");

  const handleClick = async () => {
    await initAudio();
    toggle();
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "rounded-full p-2 text-amber-300 hover:bg-amber-800/50",
        "transition-colors cursor-pointer",
        "focus:outline-none focus:ring-2 focus:ring-amber-400",
        className
      )}
      aria-label={isEnabled ? t("muteSound") : t("enableSound")}
      title={isEnabled ? t("soundOn") : t("soundOff")}
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

#### Acceptance Criteria

- [ ] Sound plays on every card draw (when enabled)
- [ ] Toggle persists across page refreshes
- [ ] No autoplay errors in console
- [ ] Sound works on iOS Safari after first tap
- [ ] Toggle accessible via keyboard
- [ ] Visual feedback when toggling
- [ ] Graceful fallback if audio fails

---

### Phase 2C: Board Prediction Engine

**Duration:** 2 days  
**Dependencies:** Phase 1A (Board types)

#### Objectives

- Implement completion tracking algorithm
- Create minimalist status indicator
- Integrate with game state

#### Task Breakdown

| ID    | Task                                    | File                                           | Est. | Priority |
| ----- | --------------------------------------- | ---------------------------------------------- | ---- | -------- |
| 2C-01 | Create `BoardPrediction` interface      | `src/lib/boards/prediction.ts`                 | 15m  | Critical |
| 2C-02 | Create `PredictionSummary` interface    | `src/lib/boards/prediction.ts`                 | 15m  | Critical |
| 2C-03 | Implement `normalizeItemId()`           | `src/lib/boards/prediction.ts`                 | 20m  | High     |
| 2C-04 | Implement `calculateBoardPredictions()` | `src/lib/boards/prediction.ts`                 | 45m  | Critical |
| 2C-05 | Create `useBoardPredictions` hook       | `src/lib/boards/use-board-predictions.ts`      | 30m  | High     |
| 2C-06 | Create `BoardRow` component             | `src/components/board-status-indicator.tsx`    | 25m  | High     |
| 2C-07 | Create `BoardStatusIndicator`           | `src/components/board-status-indicator.tsx`    | 45m  | Critical |
| 2C-08 | Add collapse/expand animation           | `src/components/board-status-indicator.tsx`    | 30m  | Medium   |
| 2C-09 | Integrate into Host display             | `host-display.tsx`                             | 25m  | High     |
| 2C-10 | Add visibility toggle for paired        | `host-display.tsx`                             | 20m  | Medium   |
| 2C-11 | Add translations                        | `messages/*.json`                              | 15m  | Medium   |
| 2C-12 | Write unit tests                        | `src/lib/boards/__tests__/prediction.test.ts`  | 1h   | Critical |
| 2C-13 | Write performance test                  | `src/lib/boards/__tests__/prediction.bench.ts` | 30m  | Medium   |

#### Implementation Details

```typescript
// src/lib/boards/prediction.ts

export interface BoardPrediction {
  readonly id: string;
  readonly number: number;
  readonly totalSlots: number;
  readonly filledSlots: number;
  readonly percentComplete: number;
  readonly remainingItems: readonly string[];
  readonly isComplete: boolean;
  readonly isAlmostComplete: boolean;
}

export interface PredictionSummary {
  readonly totalBoards: number;
  readonly completedBoards: readonly BoardPrediction[];
  readonly almostCompleteBoards: readonly BoardPrediction[];
  readonly topBoards: readonly BoardPrediction[];
}

/**
 * Normalize item identifier for comparison.
 * Handles both "03 BOLLO DE MAÍZ" and "BOLLO DE MAÍZ" formats.
 */
function normalizeItemId(item: string): string {
  // Extract numeric prefix if present
  const match = item.match(/^(\d{2})\s+/);
  if (match) {
    return match[1];
  }
  // Otherwise use uppercase trimmed name
  return item.toUpperCase().trim();
}

/**
 * Calculate board completion predictions.
 *
 * @complexity O(B × I) where B=boards, I=items per board
 * @param boards - All board definitions
 * @param calledItems - Set of called item IDs (normalized)
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
```

**React Hook:**

```typescript
// src/lib/boards/use-board-predictions.ts

export function useBoardPredictions(
  boards: readonly BoardDefinition[] | undefined,
  history: readonly ItemDefinition[]
): PredictionSummary | null {
  return useMemo(() => {
    if (!boards || boards.length === 0) return null;

    // Build set of called item IDs
    const calledItemIds = new Set(history.map((item) => item.id));

    return calculateBoardPredictions(boards, calledItemIds);
  }, [boards, history]);
}
```

**Component:**

```typescript
// src/components/board-status-indicator.tsx

export function BoardStatusIndicator({
  predictions,
  isVisible,
}: BoardStatusIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const t = useTranslations("boards");

  if (!predictions || !isVisible) return null;

  const { almostCompleteBoards, completedBoards, totalBoards } = predictions;
  const hasNotableBoards =
    almostCompleteBoards.length > 0 || completedBoards.length > 0;

  if (!hasNotableBoards) return null;

  return (
    <div className="fixed bottom-20 left-4 z-30">
      <motion.div
        layout
        className={cn(
          "rounded-xl bg-amber-950/80 backdrop-blur-sm",
          "border border-amber-800/30 overflow-hidden max-w-xs"
        )}
      >
        {/* Collapsed header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "w-full px-4 py-2 flex items-center justify-between",
            "text-amber-200 hover:bg-amber-900/50 transition-colors cursor-pointer"
          )}
        >
          <span className="flex items-center gap-2 text-sm">
            <BarChart3 className="h-4 w-4" />
            {completedBoards.length > 0
              ? `🎉 ${t("complete", { count: completedBoards.length })}`
              : t("almostComplete", { count: almostCompleteBoards.length })}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              isExpanded && "rotate-180"
            )}
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
              {/* ... board rows ... */}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
```

#### Acceptance Criteria

- [ ] Calculation completes in <50ms for 100 boards
- [ ] Correctly identifies boards ≥80% complete
- [ ] Shows winner celebration when board hits 100%
- [ ] UI updates in real-time on card draw
- [ ] Collapse/expand animation is smooth (60fps)
- [ ] Hidden when controller is connected (paired mode)
- [ ] Responsive on mobile screens

---

## 6. Milestone 3: Spectator Experience

**Duration:** 4-5 days  
**Goal:** Full spectator mode with emoji reactions

### Phase 3A: Spectator Connection Infrastructure

**Duration:** 1.5 days  
**Dependencies:** Phase 1C (WebSocket protocol)

#### Objectives

- Extend PartyKit for spectator role
- Create spectator join flow
- Track spectator count

#### Task Breakdown

| ID    | Task                                    | File                                           | Est. | Priority |
| ----- | --------------------------------------- | ---------------------------------------------- | ---- | -------- |
| 3A-01 | Extend `getClientRole()` for spectator  | `party/game.ts`                                | 15m  | Critical |
| 3A-02 | Add spectator state to `RoomState`      | `party/game.ts`                                | 15m  | Critical |
| 3A-03 | Implement `handleSpectatorConnect()`    | `party/game.ts`                                | 35m  | Critical |
| 3A-04 | Implement `handleSpectatorDisconnect()` | `party/game.ts`                                | 20m  | Critical |
| 3A-05 | Implement `broadcastSpectatorCount()`   | `party/game.ts`                                | 20m  | High     |
| 3A-06 | Send game state to spectator on join    | `party/game.ts`                                | 25m  | Critical |
| 3A-07 | Create `useSpectatorSocket` hook        | `src/lib/realtime/use-spectator-socket.ts`     | 1h   | Critical |
| 3A-08 | Create spectator page                   | `src/app/[locale]/play/spectator/page.tsx`     | 45m  | High     |
| 3A-09 | Add spectator URL to QR display         | `qr-pairing.tsx`                               | 30m  | Medium   |
| 3A-10 | Display spectator count on Host         | `host-display.tsx`                             | 25m  | Medium   |
| 3A-11 | Add translations                        | `messages/*.json`                              | 15m  | Medium   |
| 3A-12 | Write integration tests                 | `src/lib/realtime/__tests__/spectator.test.ts` | 1h   | High     |

#### Implementation Details

**Server Spectator Handling:**

```typescript
// party/game.ts

private handleSpectatorConnect(conn: Connection): void {
  this.state.spectatorIds.add(conn.id);

  // Confirm join with spectator role
  send(conn, {
    type: "ROOM_JOINED",
    role: "spectator"
  });

  // Send current game state
  if (this.state.gameState) {
    send(conn, {
      type: "STATE_UPDATE",
      payload: this.state.gameState,
    });
  }

  // Broadcast updated count to all
  this.broadcastSpectatorCount();

  log.info(this.room.id, `Spectator connected: ${conn.id}`);
}

private handleSpectatorDisconnect(connId: string): void {
  this.state.spectatorIds.delete(connId);
  this.broadcastSpectatorCount();
  log.info(this.room.id, `Spectator disconnected: ${connId}`);
}

private broadcastSpectatorCount(): void {
  this.room.broadcast(JSON.stringify({
    type: "SPECTATOR_COUNT",
    count: this.state.spectatorIds.size,
  }));
}
```

**Spectator Hook:**

```typescript
// src/lib/realtime/use-spectator-socket.ts

export function useSpectatorSocket(roomId: string | null) {
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  const [gameState, setGameState] = useState<SpectatorGameState | null>(null);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [reactions, setReactions] = useState<ReactionBurstMessage["reactions"]>(
    []
  );
  const wsRef = useRef<WebSocket | null>(null);
  const lastReactionRef = useRef<number>(0);

  // Connect to room
  useEffect(() => {
    if (!roomId) return;

    const ws = new WebSocket(
      `${PARTYKIT_HOST}/parties/game/${roomId}?role=spectator`
    );

    ws.onopen = () => setConnectionStatus("connected");
    ws.onclose = () => setConnectionStatus("disconnected");

    ws.onmessage = (event) => {
      const msg = parseMessage(event.data);
      if (!msg) return;

      switch (msg.type) {
        case "STATE_UPDATE":
          setGameState(msg.payload);
          break;
        case "SPECTATOR_COUNT":
          setSpectatorCount(msg.count);
          break;
        case "REACTION_BURST":
          setReactions(msg.reactions);
          break;
      }
    };

    wsRef.current = ws;
    return () => ws.close();
  }, [roomId]);

  // Send reaction (with client-side rate limiting)
  const sendReaction = useCallback((emoji: ReactionEmoji) => {
    const now = Date.now();
    if (now - lastReactionRef.current < 1000) return; // 1s cooldown

    lastReactionRef.current = now;
    wsRef.current?.send(
      JSON.stringify({
        type: "SEND_REACTION",
        emoji,
      })
    );
  }, []);

  return {
    connectionStatus,
    gameState,
    spectatorCount,
    reactions,
    sendReaction,
  };
}
```

#### Acceptance Criteria

- [ ] Spectators connect with role=spectator URL param
- [ ] Spectators receive STATE_UPDATE broadcasts
- [ ] Spectators cannot send DRAW_CARD or other commands
- [ ] Spectator count displays on Host
- [ ] Multiple spectators can connect simultaneously
- [ ] Spectator count updates on connect/disconnect

---

### Phase 3B: Reaction System

**Duration:** 1.5 days  
**Dependencies:** Phase 3A

#### Objectives

- Implement server-side reaction handling
- Rate limit per spectator
- Batch and broadcast reactions

#### Task Breakdown

| ID    | Task                              | File                                | Est. | Priority |
| ----- | --------------------------------- | ----------------------------------- | ---- | -------- |
| 3B-01 | Add reaction buffer to state      | `party/game.ts`                     | 15m  | Critical |
| 3B-02 | Add reaction cooldown map         | `party/game.ts`                     | 15m  | High     |
| 3B-03 | Implement `handleReaction()`      | `party/game.ts`                     | 40m  | Critical |
| 3B-04 | Implement rate limiting           | `party/game.ts`                     | 30m  | Critical |
| 3B-05 | Implement `flushReactionBuffer()` | `party/game.ts`                     | 30m  | Critical |
| 3B-06 | Set up batch timer (500ms)        | `party/game.ts`                     | 25m  | High     |
| 3B-07 | Update spectator hook for sending | `use-spectator-socket.ts`           | 20m  | High     |
| 3B-08 | Add rate limit feedback (client)  | Spectator page                      | 25m  | Medium   |
| 3B-09 | Write server tests                | `party/__tests__/reactions.test.ts` | 1h   | High     |

#### Implementation Details

```typescript
// party/game.ts

const REACTION_COOLDOWN_MS = 1000;  // 1 second per spectator
const REACTION_BATCH_MS = 500;      // Aggregate every 500ms

private handleReaction(msg: SendReactionMessage, sender: Connection): void {
  // Verify sender is a spectator
  if (!this.state.spectatorIds.has(sender.id)) {
    return; // Silently ignore non-spectators
  }

  // Rate limiting per spectator
  const now = Date.now();
  const lastReaction = this.state.reactionCooldowns.get(sender.id) ?? 0;
  if (now - lastReaction < REACTION_COOLDOWN_MS) {
    return; // Silently ignore (rate limited)
  }
  this.state.reactionCooldowns.set(sender.id, now);

  // Validate emoji
  if (!REACTION_EMOJIS.includes(msg.emoji)) {
    return; // Invalid emoji
  }

  // Add to buffer
  const current = this.state.reactionBuffer.get(msg.emoji) ?? 0;
  this.state.reactionBuffer.set(msg.emoji, current + 1);

  // Batch broadcast (debounced)
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
  } satisfies ReactionBurstMessage));

  this.state.reactionBuffer.clear();
  this.state.lastReactionBroadcast = Date.now();
}
```

#### Acceptance Criteria

- [ ] Max 1 reaction per second per spectator
- [ ] Reactions batch every 500ms
- [ ] Multiple emoji types aggregated correctly
- [ ] Rate limit enforced silently (no error)
- [ ] Invalid emojis rejected

---

### Phase 3C: Spectator UI & Animations

**Duration:** 2 days  
**Dependencies:** Phase 3B

#### Objectives

- **REUSE** existing game display components (single source of truth)
- Create only spectator-specific components (reactions)
- Ensure performance

#### Component Reuse Strategy (CRITICAL)

The spectator view will **reuse existing components** from `src/app/play/_components/`:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    SPECTATOR VIEW - COMPONENT REUSE MAP                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  EXISTING COMPONENTS (REUSE AS-IS)                                              │
│  ─────────────────────────────────                                              │
│  • CurrentCard          → Display current card (same as Host)                   │
│  • HistoryStrip         → Show past cards (same as Host)                        │
│  • HistoryModal         → Full history view (same as Host/Controller)           │
│  • ConnectionStatusIndicator → Show connection status                           │
│  • MiniCard             → If needed for compact view                            │
│  • TextPanel            → Show card educational text                            │
│                                                                                 │
│  NEW SPECTATOR-SPECIFIC COMPONENTS                                              │
│  ─────────────────────────────────                                              │
│  • ReactionsOverlay     → Floating emoji animations (Host display only)         │
│  • ReactionBar          → Emoji button bar (Spectator view only)                │
│                                                                                 │
│  COMPONENT LOCATION STRATEGY                                                    │
│  ─────────────────────────────                                                  │
│  • Shared components stay in: src/app/play/_components/                         │
│  • Reactions components in:   src/components/ (used by Host + Spectator)        │
│  • No duplication, single source of truth                                       │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### Task Breakdown

| ID    | Task                                          | File                                   | Est. | Priority |
| ----- | --------------------------------------------- | -------------------------------------- | ---- | -------- |
| 3C-01 | Create `ReactionsOverlay` component           | `src/components/reactions-overlay.tsx` | 1h   | Critical |
| 3C-02 | Implement floating animation                  | `reactions-overlay.tsx`                | 45m  | Critical |
| 3C-03 | Add explosion mode (≥10 reactions)            | `reactions-overlay.tsx`                | 30m  | High     |
| 3C-04 | Cap at 20 emojis for performance              | `reactions-overlay.tsx`                | 15m  | High     |
| 3C-05 | Create `ReactionBar` component                | `src/components/reaction-bar.tsx`      | 30m  | High     |
| 3C-06 | Integrate `ReactionsOverlay` into Host        | `host-display.tsx`                     | 20m  | High     |
| 3C-07 | **REUSE** `CurrentCard` in Spectator          | `spectator/page.tsx`                   | 15m  | Critical |
| 3C-08 | **REUSE** `HistoryStrip` in Spectator         | `spectator/page.tsx`                   | 15m  | High     |
| 3C-09 | **REUSE** `ConnectionStatusIndicator`         | `spectator/page.tsx`                   | 10m  | High     |
| 3C-10 | Compose Spectator page with reused components | `spectator/page.tsx`                   | 30m  | Critical |
| 3C-11 | Add cooldown visual feedback to ReactionBar   | `reaction-bar.tsx`                     | 25m  | Medium   |
| 3C-12 | Add translations                              | `messages/*.json`                      | 20m  | Medium   |
| 3C-13 | Performance test (50+ reactions)              | Manual testing                         | 45m  | High     |
| 3C-14 | Add reduced motion support                    | All new components                     | 20m  | High     |

#### Spectator Page Implementation (Component Composition)

```typescript
// src/app/[locale]/play/spectator/page.tsx

import {
  CurrentCard, // REUSE from play/_components
  HistoryStrip, // REUSE from play/_components
  ConnectionStatusIndicator, // REUSE from play/_components
} from "@/app/play/_components";
import { ReactionBar } from "@/components/reaction-bar";
import { useSpectatorSocket } from "@/lib/realtime/use-spectator-socket";

export default function SpectatorPage() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get("room");
  const t = useTranslations("spectator");

  const { connectionStatus, gameState, spectatorCount, sendReaction } =
    useSpectatorSocket(roomId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-950 to-amber-900 flex flex-col">
      {/* Header - connection status + spectator count */}
      <header className="flex items-center justify-between p-4">
        <ConnectionStatusIndicator
          status={connectionStatus}
          roomId={roomId ?? undefined}
        />
        <div className="flex items-center gap-2 text-amber-400/60 text-sm">
          <Users className="h-4 w-4" />
          <span>{t("spectatorCount", { count: spectatorCount })}</span>
        </div>
      </header>

      {/* Main content - REUSE CurrentCard */}
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <CurrentCard
          item={gameState?.currentItem ?? null}
          currentNumber={gameState?.currentIndex ?? 0}
          totalCards={gameState?.totalItems ?? 0}
          showCounter={true}
        />
      </main>

      {/* History strip - REUSE HistoryStrip */}
      {gameState?.history && gameState.history.length > 0 && (
        <div className="px-4 pb-20">
          <HistoryStrip
            history={gameState.history}
            currentItem={gameState.currentItem}
            maxCards={6}
          />
        </div>
      )}

      {/* Reaction bar - NEW component, spectator-specific */}
      <ReactionBar onReact={sendReaction} />
    </div>
  );
}
```

#### New Components (Only What's Truly New)

```typescript
// src/components/reaction-bar.tsx

import { REACTION_EMOJIS, type ReactionEmoji } from "@/lib/realtime/types";

interface ReactionBarProps {
  onReact: (emoji: ReactionEmoji) => void;
  cooldownMs?: number;
}

export function ReactionBar({ onReact, cooldownMs = 1000 }: ReactionBarProps) {
  const [lastReaction, setLastReaction] = useState(0);
  const [cooldownEmoji, setCooldownEmoji] = useState<ReactionEmoji | null>(
    null
  );

  const handleReact = (emoji: ReactionEmoji) => {
    const now = Date.now();
    if (now - lastReaction < cooldownMs) {
      // Visual feedback that we're on cooldown
      setCooldownEmoji(emoji);
      setTimeout(() => setCooldownEmoji(null), 200);
      return;
    }

    setLastReaction(now);
    onReact(emoji);
  };

  return (
    <footer className="fixed bottom-0 inset-x-0 p-4 bg-amber-950/80 backdrop-blur-sm">
      <div className="flex items-center justify-center gap-3">
        {REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleReact(emoji)}
            className={cn(
              "text-3xl p-2 rounded-full transition-all cursor-pointer",
              "hover:bg-amber-800/50 active:scale-90",
              cooldownEmoji === emoji && "animate-shake opacity-50"
            )}
            aria-label={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </footer>
  );
}
```

```typescript
// src/components/reactions-overlay.tsx
// (Only new animation component, displayed on Host)

export function ReactionsOverlay({
  reactions,
}: {
  reactions: ReactionBurstMessage["reactions"];
}) {
  const [floating, setFloating] = useState<FloatingReaction[]>([]);
  const prefersReducedMotion = useReducedMotion();

  // ... animation logic (same as before)
}
```

#### Acceptance Criteria

- [ ] **Spectator uses SAME CurrentCard as Host** (no duplication)
- [ ] **Spectator uses SAME HistoryStrip as Host** (no duplication)
- [ ] **Spectator uses SAME ConnectionStatusIndicator** (no duplication)
- [ ] Only ReactionsOverlay and ReactionBar are new components
- [ ] Animations run at 60fps with 20 emojis
- [ ] Explosion effect triggers at ≥10 reactions
- [ ] Emojis clean up after animation
- [ ] No memory leaks
- [ ] Reduced motion preference respected

---

## 7. Milestone 4: Polish & Quality Assurance

**Duration:** 4-5 days  
**Goal:** Production-ready quality

### Phase 4A: UI/UX Refinements

**Duration:** 1.5 days

#### Tasks

| ID    | Task                                      | Priority |
| ----- | ----------------------------------------- | -------- |
| 4A-01 | Align color scheme across new components  | High     |
| 4A-02 | Ensure consistent spacing (8px grid)      | High     |
| 4A-03 | Add loading states for async operations   | High     |
| 4A-04 | Add error states with actionable messages | High     |
| 4A-05 | Add empty states for history/boards       | Medium   |
| 4A-06 | Polish animation timing/easing            | Medium   |
| 4A-07 | Add hover/focus states to all interactive | High     |
| 4A-08 | Implement `prefers-reduced-motion`        | High     |
| 4A-09 | Test on mobile viewports                  | High     |
| 4A-10 | Dark mode consistency check               | Medium   |

---

### Phase 4B: Accessibility Audit

**Duration:** 1 day

#### Tasks

| ID    | Task                                 | Priority |
| ----- | ------------------------------------ | -------- |
| 4B-01 | Keyboard navigation for all features | Critical |
| 4B-02 | ARIA labels on sound toggle          | Critical |
| 4B-03 | ARIA labels on language switcher     | Critical |
| 4B-04 | ARIA labels on reaction buttons      | Critical |
| 4B-05 | Focus trap in history modal          | High     |
| 4B-06 | Screen reader testing (VoiceOver)    | High     |
| 4B-07 | Screen reader testing (NVDA)         | High     |
| 4B-08 | Color contrast audit (WCAG AA)       | Critical |
| 4B-09 | Skip links for spectator view        | Medium   |
| 4B-10 | Live region for spectator count      | Medium   |

---

### Phase 4C: Performance Optimization

**Duration:** 1 day

#### Tasks

| ID    | Task                                  | Priority |
| ----- | ------------------------------------- | -------- |
| 4C-01 | Profile React components (DevTools)   | High     |
| 4C-02 | Add useMemo/useCallback where needed  | High     |
| 4C-03 | Lazy load spectator page              | Medium   |
| 4C-04 | Optimize reaction animations          | High     |
| 4C-05 | Measure WebSocket latency             | Critical |
| 4C-06 | Audit bundle size                     | Medium   |
| 4C-07 | Test on slow network (3G)             | High     |
| 4C-08 | Test board prediction with 100 boards | High     |

#### Performance Budgets

| Metric            | Target | Measurement            |
| ----------------- | ------ | ---------------------- |
| WebSocket latency | <200ms | Round-trip ping        |
| Audio init        | <100ms | Time to first sound    |
| Board prediction  | <50ms  | 100 boards calculation |
| Reaction FPS      | 60fps  | 20 simultaneous emojis |
| i18n bundle       | <10KB  | Per locale gzipped     |
| LCP               | <2.5s  | Lighthouse             |
| INP               | <200ms | Core Web Vitals        |

---

### Phase 4D: Testing & Documentation

**Duration:** 1.5 days

#### Tasks

| ID    | Task                            | Priority |
| ----- | ------------------------------- | -------- |
| 4D-01 | E2E test: History sync flow     | High     |
| 4D-02 | E2E test: Spectator connection  | High     |
| 4D-03 | E2E test: Reaction system       | High     |
| 4D-04 | E2E test: Language switching    | Medium   |
| 4D-05 | Unit test coverage check (85%+) | High     |
| 4D-06 | Update README with new features | Medium   |
| 4D-07 | Document WebSocket messages     | Medium   |
| 4D-08 | Create troubleshooting guide    | Low      |

#### Test Coverage Requirements

| Module          | Target | Notes            |
| --------------- | ------ | ---------------- |
| `lib/boards/`   | 95%    | Core algorithms  |
| `lib/audio/`    | 85%    | Mocking required |
| `lib/realtime/` | 90%    | Message handling |
| `lib/i18n/`     | 85%    | Detection logic  |
| Components      | 80%    | UI tests         |

---

## 8. Technical Specifications

### 8.1 Final File Structure

```
src/
├── i18n/
│   ├── config.ts                    # NEW: Locale configuration
│   ├── request.ts                   # NEW: Server request config
│   ├── routing.ts                   # NEW: Routing utilities
│   └── __tests__/
├── lib/
│   ├── audio/
│   │   ├── audio-manager.ts         # NEW: Singleton audio manager
│   │   ├── use-card-draw-sound.ts   # NEW: React hook for audio
│   │   └── __tests__/
│   ├── boards/
│   │   ├── normalize.ts             # NEW: Schema normalization
│   │   ├── prediction.ts            # NEW: Board completion algorithm
│   │   ├── use-board-predictions.ts # NEW: React hook for predictions
│   │   └── __tests__/
│   ├── i18n/
│   │   └── persistence.ts           # NEW: Locale storage utilities
│   ├── realtime/
│   │   ├── types.ts                 # MODIFIED: Extended message types
│   │   ├── use-spectator-socket.ts  # NEW: Spectator WebSocket hook
│   │   └── __tests__/
│   └── types/
│       ├── boards.ts                # NEW: Unified board types
│       ├── game.ts                  # (unchanged)
│       └── index.ts                 # MODIFIED: Re-export board types
├── messages/
│   ├── es.json                      # NEW: Spanish translations
│   └── en.json                      # NEW: English translations
├── middleware.ts                    # NEW: Locale detection middleware
├── app/
│   ├── [locale]/
│   │   ├── layout.tsx               # NEW: Locale provider wrapper
│   │   ├── page.tsx                 # MIGRATED: Home page
│   │   ├── play/
│   │   │   ├── host/page.tsx        # MIGRATED: Host display
│   │   │   ├── join/page.tsx        # MIGRATED: Controller join
│   │   │   ├── _components/         # EXISTING: Shared components
│   │   │   │   ├── current-card.tsx     # REUSED by Host + Spectator
│   │   │   │   ├── history-strip.tsx    # REUSED by Host + Spectator
│   │   │   │   ├── history-modal.tsx    # REUSED by all views
│   │   │   │   ├── connection-status.tsx # REUSED by Controller + Spectator
│   │   │   │   └── ...                  # Other existing components
│   │   │   └── spectator/
│   │   │       └── page.tsx         # NEW: Composes REUSED components
│   │   └── generator/               # MIGRATED: Generator wizard
│   └── page.tsx                     # MODIFIED: Redirect to locale
└── components/
    ├── ui/                          # EXISTING: shadcn/ui components
    ├── board-status-indicator.tsx   # NEW: Board tracking UI
    ├── language-switcher.tsx        # NEW: i18n selector
    ├── reaction-bar.tsx             # NEW: Spectator emoji buttons
    ├── reactions-overlay.tsx        # NEW: Floating emoji animations
    └── sound-toggle.tsx             # NEW: Audio preference toggle

party/
└── game.ts                          # MODIFIED: Spectator + reactions

public/
└── sound-effects/
    └── notif.mp3                    # EXISTING: Card draw sound

# ═══════════════════════════════════════════════════════════════════════════════
# COMPONENT REUSE SUMMARY
# ═══════════════════════════════════════════════════════════════════════════════
#
# EXISTING components from play/_components/ that are REUSED (not duplicated):
# • CurrentCard        → Host display + Spectator view
# • HistoryStrip       → Host display + Spectator view
# • HistoryModal       → Host + Controller + Spectator
# • ConnectionStatus   → Controller + Spectator
# • TextPanel          → Host display + Spectator view
# • MiniCard           → Controller + can be used in Spectator
#
# NEW components that don't exist yet:
# • ReactionsOverlay   → Floating emoji animations
# • ReactionBar        → Emoji button bar for spectators
# • BoardStatusIndicator → Board completion tracker
# • SoundToggle        → Audio on/off button
# • LanguageSwitcher   → Locale dropdown
#
# ═══════════════════════════════════════════════════════════════════════════════
```

### 8.2 Dependencies

```json
{
  "dependencies": {
    "next-intl": "^3.22.0"
  }
}
```

No other new dependencies required.

---

## 9. Risk Mitigation

| Risk                      | Probability | Impact | Mitigation                   |
| ------------------------- | ----------- | ------ | ---------------------------- |
| i18n breaks existing URLs | Medium      | High   | Extensive testing, redirects |
| Browser blocks audio      | Low         | Medium | Lazy init, visual feedback   |
| WebSocket latency spikes  | Low         | High   | Connection monitoring        |
| Reaction animation lag    | Medium      | Medium | Cap at 20, use transforms    |
| Board calc too slow       | Low         | Medium | Memoization, benchmarks      |

---

## 10. Appendices

### Appendix A: Translation Keys Reference

```json
{
  "common": ["loading", "error", "retry", "close", "back"],
  "game": ["title", "waitingForController", "connected", "disconnected"],
  "game.card": ["current", "draw", "drawFirst"],
  "game.status": ["waiting", "ready", "playing", "paused", "finished"],
  "game.controls": [
    "pause",
    "resume",
    "reset",
    "history",
    "fullscreen",
    "exitFullscreen",
    "endSession",
    "muteSound",
    "enableSound",
    "soundOn",
    "soundOff"
  ],
  "pairing": [
    "title",
    "scanQr",
    "orEnterCode",
    "roomCode",
    "playStandalone",
    "spectatorLink"
  ],
  "history": ["title", "cardsPlayed", "clickToExpand", "empty"],
  "spectator": ["watching", "spectatorCount", "react", "cooldown"],
  "boards": ["status", "complete", "almostComplete", "remaining", "winner"]
}
```

### Appendix B: Message Type Reference (v4.0)

| Type              | Direction        | Purpose              |
| ----------------- | ---------------- | -------------------- |
| `OPEN_HISTORY`    | Any→All          | Open history modal   |
| `CLOSE_HISTORY`   | Any→All          | Close history modal  |
| `SEND_REACTION`   | Spectator→Server | Send emoji           |
| `REACTION_BURST`  | Server→All       | Aggregated reactions |
| `SPECTATOR_COUNT` | Server→All       | Viewer count         |

### Appendix C: Emoji Reaction Set

| Emoji | Meaning      | Keyboard Shortcut |
| ----- | ------------ | ----------------- |
| 👏    | Applause     | 1                 |
| 🎉    | Celebration  | 2                 |
| ❤️    | Love         | 3                 |
| 😮    | Surprise     | 4                 |
| 🔥    | Fire         | 5                 |
| 👀    | Anticipation | 6                 |

---

**Document Version:** 1.0  
**Status:** Approved for Implementation  
**Next Steps:** Begin Phase 1A after stakeholder review

---

_Tabula v4.0 — Crafted with enterprise-grade precision_
