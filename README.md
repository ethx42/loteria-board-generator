# 🎴 Lotería Game

A modern web application for creating and playing the traditional Lotería game with optimally distributed game boards.

## Features

- **Board Generator**: Create custom game boards with mathematical optimization
  - Configurable items, board size, and quantity
  - HiGHS solver for optimal diversity (minimal overlap between boards)
  - Real-time constraint validation
  - Multiple export formats (JSON, CSV, Print)

- **Game Mode** (Coming Soon): Play Lotería with friends
  - Real-time card calling
  - Player board tracking
  - Winner detection

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **Optimization**: HiGHS Solver (WebAssembly)
- **Animation**: Framer Motion
- **State**: Zustand

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

## Mathematical Constraints

The board generator ensures optimal distribution through these constraints:

| Constraint | Formula | Description |
|------------|---------|-------------|
| Slot Balance | ∑fᵢ = B × S | Sum of frequencies equals total slots |
| Min Items | N ≥ S | Enough items to fill a board |
| Min Frequency | fᵢ ≥ 1 | Every item appears at least once |
| Max Frequency | fᵢ ≤ B | No item exceeds board count |
| Feasibility | N ≤ T ≤ N×B | Total slots within feasible range |
| Uniqueness | C(N,S) ≥ B | Enough combinations for unique boards |

## Project Structure

```
src/
├── app/
│   ├── generator/     # Board generation wizard
│   └── play/          # Game mode (coming soon)
├── components/ui/     # shadcn components
├── lib/
│   ├── types/         # TypeScript interfaces
│   ├── constraints/   # Validation engine
│   ├── solver/        # HiGHS & greedy algorithms
│   └── parser/        # Text parsing utilities
└── stores/            # Zustand state management
```

## License

MIT
