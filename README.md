<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/PartyKit-Realtime-FF6B6B?style=for-the-badge" alt="PartyKit" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tests-59_Passing-brightgreen?style=for-the-badge" alt="Tests" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="MIT License" />
</p>

<h1 align="center">🎴 Tabula</h1>

<p align="center">
  <strong>A real-time multiplayer card game platform</strong><br/>
  Host games from your laptop, play from your phone — no app install required.
</p>

<p align="center">
  <a href="https://tabula-game.netlify.app">🎮 Play Now</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-how-to-play">How to Play</a> •
  <a href="#-deployment">Deploy Your Own</a>
</p>

---

## 🌟 What is Tabula?

**Tabula** is a real-time multiplayer card game platform inspired by traditional games of chance like Lotería and Bingo. A caller announces cards one by one, and players mark matching images on their boards. First to complete a pattern wins!

**Tabula** brings classic card games to the digital age:

- 🖥️ **Host from any browser** — Display the game on a TV or projector
- 📱 **Play from your phone** — Join with a simple room code, no app needed
- ⚡ **Real-time sync** — Instant updates via WebSocket technology
- 🎨 **Beautiful UI** — Modern, responsive design that works on any device

---

## ✨ Key Features

### 🎮 Multiplayer Game Mode

| Feature                    | Description                                  |
| -------------------------- | -------------------------------------------- |
| **Room-based sessions**    | Create a room, share the code, start playing |
| **QR Code join**           | Scan to join instantly from mobile           |
| **Real-time WebSocket**    | Sub-100ms latency powered by PartyKit        |
| **Cross-device play**      | Host on desktop, control from mobile         |
| **Automatic reconnection** | Drop your connection? We'll get you back     |

### 🎯 Host Experience

- Display game board on a large screen (TV, projector, laptop)
- Control game flow: start, pause, next card
- See connected players in real-time
- Automatic session management

### 📱 Controller Experience

- Join with a 4-character room code
- Tap to advance cards, pause game
- Works on any modern mobile browser
- No account or app installation required

### 🛠️ Board Generator (Auxiliary Tool)

For game creators who want custom boards:

- **Mathematical optimization** — ILP solver ensures fair card distribution
- **Wizard interface** — Step-by-step board configuration
- **Export options** — JSON, CSV, print-ready formats
- **Reproducible** — Same seed = same boards every time

---

## 🎮 How to Play

### As a Host

1. Open [tabula-game.netlify.app/play/host](https://tabula-game.netlify.app/play/host)
2. A room code is generated (e.g., `A1B2`)
3. Share the code or QR with players
4. Display the screen on a TV/projector
5. Control the game from your device or let a controller take over

### As a Player/Controller

1. Open [tabula-game.netlify.app/play/join](https://tabula-game.netlify.app/play/join)
2. Enter the room code shown on the host screen
3. Tap to advance cards when it's your turn
4. Call out "¡Tabula!" when you win!

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 20** (LTS) — Required for Netlify CLI compatibility
- npm, pnpm, or yarn
- [Cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) (for mobile testing)

> **Note:** This project includes an `.nvmrc` file. Run `nvm use` to switch to the correct Node version.

### Installation

```bash
# Clone the repository
git clone git@github.com:ethx42/tabula.git
cd tabula

# Install dependencies
npm install

# Start development servers (Next.js + PartyKit)
npm run dev:all

# Open in browser
open http://localhost:3000
```

### Development Commands

| Command              | Description                                             |
| -------------------- | ------------------------------------------------------- |
| `npm run dev`        | Start Next.js only                                      |
| `npm run dev:party`  | Start PartyKit WebSocket server only                    |
| `npm run dev:all`    | Start both Next.js and PartyKit                         |
| `npm run dev:mobile` | Start everything + Cloudflare tunnel for mobile testing |
| `npm run dev:tunnel` | Start only the Cloudflare tunnel                        |
| `npm test`           | Run test suite                                          |
| `npm run build`      | Build for production                                    |

---

## 📱 Mobile Development

iOS blocks insecure WebSocket connections (`ws://`) to private IP addresses. To test the multiplayer game from a mobile device on your local network, use a secure tunnel.

### Quick Start

```bash
# Start everything with mobile tunnel support
npm run dev:mobile
```

This starts:

1. **Next.js** on `localhost:3000`
2. **PartyKit** on `localhost:1999`
3. **Cloudflare Tunnel** → Secure HTTPS URL for PartyKit

### Setup Steps

1. **Install Cloudflared** (one-time):

   ```bash
   brew install cloudflared
   ```

2. **Run with mobile support**:

   ```bash
   npm run dev:mobile
   ```

3. **Copy the tunnel URL** from terminal output:

   ```
   Your quick Tunnel has been created!
   Visit it at: https://random-words.trycloudflare.com
   ```

4. **Add to `.env.local`**:

   ```bash
   NEXT_PUBLIC_PARTYKIT_HOST=random-words.trycloudflare.com
   ```

5. **Restart Next.js** and test from your mobile device

### Troubleshooting

| Issue                                | Solution                                                     |
| ------------------------------------ | ------------------------------------------------------------ |
| "URL blocked by device restrictions" | Tunnel not running or `.env.local` has wrong URL             |
| Tunnel URL changed                   | Cloudflare generates new URLs each time; update `.env.local` |
| Can't reach laptop from phone        | Ensure both devices are on the same WiFi network             |

---

## 🚀 Deployment

### Production URLs

| Service       | URL                                |
| ------------- | ---------------------------------- |
| **Frontend**  | https://tabula-game.netlify.app    |
| **WebSocket** | https://tabula.ethx42.partykit.dev |

### Deploy Everything

```bash
npm run deploy
```

This deploys both:

- **PartyKit** → WebSocket server for real-time multiplayer
- **Netlify** → Next.js frontend

### Deploy Individually

```bash
npm run deploy:party    # Deploy PartyKit only
npm run deploy:netlify  # Deploy Netlify only
```

### First-Time Setup

1. **PartyKit Account**:

   ```bash
   npx partykit login
   npx partykit deploy
   ```

2. **Netlify Account**:

   ```bash
   npm install -g netlify-cli
   netlify login
   netlify sites:create --name your-site-name
   ```

3. **Environment Variables** — Add to `netlify.toml`:

   ```toml
   [build.environment]
     NEXT_PUBLIC_PARTYKIT_HOST = "your-app.username.partykit.dev"
   ```

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Production                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   📱 Mobile Controller          🖥️ Desktop Host                 │
│          │                           │                           │
│          └───────────┬───────────────┘                           │
│                      ▼                                           │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │                    Netlify (Next.js)                      │  │
│   │                    HTTPS Frontend                         │  │
│   └──────────────────────────────────────────────────────────┘  │
│                      │                                           │
│                      │ WSS (Secure WebSocket)                    │
│                      ▼                                           │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │                PartyKit Cloud                             │  │
│   │         Real-time Room Management                         │  │
│   │         Host ↔ Controller Sync                            │  │
│   └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Project Structure

```
├── src/
│   ├── app/
│   │   ├── play/
│   │   │   ├── host/           # Host game interface
│   │   │   └── join/           # Controller join interface
│   │   ├── generator/          # Board generator wizard (auxiliary tool)
│   │   └── api/
│   │       └── generate/       # Board generation API
│   ├── components/ui/          # Reusable UI components (shadcn/ui)
│   └── lib/
│       ├── realtime/           # PartyKit client hooks
│       ├── types/              # TypeScript interfaces
│       ├── solver/             # HiGHS ILP solver for board generation
│       └── utils/              # Utilities (dev-logger, etc.)
├── party/
│   └── game.ts                 # PartyKit server (WebSocket handler)
├── netlify.toml                # Netlify deployment config
└── partykit.json               # PartyKit deployment config
```

### Technology Stack

| Layer            | Technology               | Purpose                      |
| ---------------- | ------------------------ | ---------------------------- |
| **Framework**    | Next.js 16 (App Router)  | SSR, routing, API routes     |
| **UI**           | React 19                 | Component architecture       |
| **Realtime**     | PartyKit + PartySocket   | WebSocket rooms & sync       |
| **Styling**      | Tailwind CSS 4           | Utility-first CSS            |
| **Components**   | shadcn/ui + Radix        | Accessible primitives        |
| **State**        | Zustand                  | Lightweight state management |
| **Animation**    | Framer Motion            | Smooth transitions           |
| **Optimization** | HiGHS (WASM)             | Board generation solver      |
| **Testing**      | Vitest                   | Fast unit testing            |
| **Hosting**      | Netlify + PartyKit Cloud | Edge deployment              |

---

## 🛠️ Board Generator (Auxiliary Tool)

For users who want to create custom card games with their own images.

### The Problem

Creating fair game boards manually is tedious. Random generation produces duplicates and unbalanced distribution.

### The Solution

**Integer Linear Programming (ILP)** optimizes board generation:

```
Minimize: Maximum overlap between any two boards
Subject to:
  - Each board has exactly S items
  - Each item appears with target frequency
  - No duplicate items within boards
  - All boards are unique
```

### Usage

1. Navigate to `/generator`
2. Configure items, board size, and quantity
3. Generate optimized boards
4. Export as JSON, CSV, or print-ready format

### Mathematical Constraints

| Constraint      | Formula       | Description                                  |
| --------------- | ------------- | -------------------------------------------- |
| Slot Balance    | `∑fᵢ = B × S` | Total appearances = boards × items per board |
| Minimum Items   | `N ≥ S`       | At least as many items as board slots        |
| Uniqueness      | `C(N,S) ≥ B`  | Enough combinations for unique boards        |
| Overlap Quality | `S/N ≤ 50%`   | Boards don't over-share items                |

---

## 🧪 Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:ui       # Visual test UI
```

**59 tests** cover:

- ✅ WebSocket connection lifecycle
- ✅ Room creation and joining
- ✅ Host/Controller message routing
- ✅ Board generation correctness
- ✅ Mathematical constraint validation
- ✅ Edge cases and error handling

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [PartyKit](https://partykit.io/) — Real-time infrastructure for multiplayer apps
- [HiGHS](https://highs.dev/) — High-performance linear optimization solver
- [shadcn/ui](https://ui.shadcn.com/) — Beautiful, accessible components
- [Cloudflare Tunnels](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) — Secure local development

---

<p align="center">
  <strong>🎴 ¡Tabula!</strong><br/>
  Made with ❤️ for card game enthusiasts everywhere
</p>
