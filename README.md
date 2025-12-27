<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tests-59_Passing-brightgreen?style=for-the-badge" alt="Tests" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="MIT License" />
</p>

# 🎴 Lotería Board Generator

A modern, enterprise-grade web application for generating **optimally distributed** Lotería game boards using advanced mathematical optimization algorithms.

## 🌟 What is Lotería?

Lotería is a traditional game of chance, similar to bingo. Players mark images on their boards as a caller announces cards. The challenge? **Creating fair, diverse boards** where no two players have nearly identical cards.

This application solves that problem using **Integer Linear Programming (ILP)** to generate boards with mathematically optimal distribution.

---

## ✨ Key Features

### 🎯 Smart Board Generation

- **Wizard-style interface** — Step-by-step configuration for items, board size, and quantity
- **Real-time validation** — Instant feedback on configuration constraints
- **Intelligent suggestions** — When a configuration is invalid, the system tells you exactly how to fix it

### 🧮 Mathematical Optimization

- **HiGHS ILP Solver** — Industrial-strength optimization engine (same solver used by Google OR-Tools)
- **Overlap minimization** — Boards are generated to be as different as possible
- **Fisher-Yates shuffle** — Items are randomly distributed within each board for visual variety

### 🔐 Reproducibility

- **Optional seed** — Generate the same boards every time with a custom seed
- **Deterministic output** — Same configuration + same seed = identical results

### 📊 Export Options

- **JSON** — For integration with other systems
- **CSV** — For spreadsheets and printing
- **Print-ready** — Optimized layout for physical boards

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm, pnpm, or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/loteria-game.git
cd loteria-game

# Install dependencies
npm install

# Start development server
npm run dev

# Open in browser
open http://localhost:3000
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

---

## 📖 How It Works

### The Problem

Imagine you need 50 game boards, each with 16 items selected from a pool of 36. How do you ensure:

1. Every board is **unique**?
2. No two boards are **too similar**?
3. All items appear with **fair frequency**?

Manually creating these boards is tedious and error-prone. Random generation often produces duplicates or highly similar boards.

### The Solution

This application uses **Integer Linear Programming (ILP)** to model board generation as an optimization problem:

```
Minimize: Maximum overlap between any two boards
Subject to:
  - Each board has exactly S items
  - Each item appears with its target frequency
  - No board contains duplicate items
  - All boards are unique
```

The HiGHS solver finds the optimal solution in seconds.

---

## 🔬 Mathematical Constraints

The generator enforces these constraints in real-time:

| Constraint            | Formula       | Plain English                                     |
| --------------------- | ------------- | ------------------------------------------------- |
| **Slot Balance**      | `∑fᵢ = B × S` | Total item appearances = boards × items per board |
| **Minimum Items**     | `N ≥ S`       | You need at least as many items as board slots    |
| **Minimum Frequency** | `fᵢ ≥ 1`      | Every item appears at least once                  |
| **Maximum Frequency** | `fᵢ ≤ B`      | No item appears more than once per board          |
| **Feasibility**       | `N ≤ T ≤ N×B` | Total slots are within mathematical bounds        |
| **Uniqueness**        | `C(N,S) ≥ B`  | Enough combinations exist for unique boards       |
| **Overlap Quality**   | `S/N ≤ 50%`   | Boards don't use too much of the item pool        |

### Smart Error Messages

When a configuration is invalid, you get actionable suggestions:

```
❌ Only 1 possible unique boards, need 100.
   Try: add 2 more items (18 total),
        or use smaller boards (3×5 = 14 slots),
        or reduce to 1 boards.
```

---

## 🏗️ Architecture

```
src/
├── app/
│   ├── generator/           # Board generation wizard
│   │   └── _components/     # Wizard steps (Items, Board, Distribution, Preview, Export)
│   ├── play/                # Game mode (coming soon)
│   └── api/
│       └── generate/        # Server-side generation endpoint
├── components/ui/           # Reusable UI components (shadcn/ui)
├── lib/
│   ├── types/               # TypeScript interfaces and types
│   ├── constraints/         # Mathematical constraint validation
│   ├── solver/              # HiGHS solver integration
│   │   ├── highs-solver.ts  # Main solver implementation
│   │   └── __tests__/       # 59 comprehensive tests
│   └── parser/              # Text input parsing utilities
└── stores/                  # Zustand state management
```

### Technology Stack

| Layer            | Technology              | Purpose                             |
| ---------------- | ----------------------- | ----------------------------------- |
| **Framework**    | Next.js 16 (App Router) | Server-side rendering, API routes   |
| **UI**           | React 19                | Component architecture              |
| **Styling**      | Tailwind CSS 4          | Utility-first CSS                   |
| **Components**   | shadcn/ui + Radix       | Accessible, customizable primitives |
| **State**        | Zustand                 | Lightweight state management        |
| **Optimization** | HiGHS (WebAssembly)     | Industrial ILP solver               |
| **Animation**    | Framer Motion           | Smooth transitions                  |
| **Validation**   | Zod                     | Runtime type checking               |
| **Testing**      | Vitest                  | Fast unit testing                   |

---

## 🧪 Testing

The solver is thoroughly tested with **59 tests** covering:

### Core Functionality

- ✅ Correct board dimensions
- ✅ No duplicate items within boards
- ✅ No identical boards (order-independent)
- ✅ Correct item frequencies

### Diversity & Quality

- ✅ Pairwise overlap analysis
- ✅ Jaccard similarity bounds
- ✅ Visual distribution (shuffled items)
- ✅ Co-occurrence matrices

### Edge Cases

- ✅ Pigeonhole principle scenarios
- ✅ Impossible configurations (graceful failure)
- ✅ Determinism with seeds
- ✅ Large-scale generation (100+ boards)

```bash
# Run tests
npm test

# Expected output:
# ✓ src/lib/solver/__tests__/solver.test.ts (18 tests)
# ✓ src/lib/solver/__tests__/board-uniqueness.test.ts (20 tests)
# ✓ src/lib/solver/__tests__/edge-cases.test.ts (21 tests)
# Tests: 59 passed
```

---

## 📝 API Reference

### Generate Boards (Server-Side)

```http
POST /api/generate
Content-Type: application/json

{
  "items": [
    { "id": "1", "name": "El Gallo", "index": 0 },
    { "id": "2", "name": "La Dama", "index": 1 },
    // ... more items
  ],
  "numBoards": 15,
  "boardConfig": { "rows": 4, "cols": 4 },
  "distribution": { "type": "uniform" },
  "seed": 12345  // Optional: for reproducibility
}
```

**Response:**

```json
{
  "success": true,
  "boards": [
    {
      "id": "board-1",
      "grid": [
        [{ "id": "5", "name": "El Paraguas" }, ...],
        // 4 rows × 4 cols
      ]
    },
    // ... more boards
  ],
  "stats": {
    "totalBoards": 15,
    "itemsPerBoard": 16,
    "frequencies": { "1": 7, "2": 7, ... },
    "solverUsed": "highs",
    "seedUsed": 12345
  }
}
```

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm test             # Run tests
npm run lint         # Run ESLint
npx knip             # Check for dead code
```

---

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [HiGHS](https://highs.dev/) — High-performance linear optimization solver
- [shadcn/ui](https://ui.shadcn.com/) — Beautiful, accessible components
- [Next.js](https://nextjs.org/) — The React framework for production

---

<p align="center">
  Made with ❤️ for Lotería enthusiasts everywhere
</p>
