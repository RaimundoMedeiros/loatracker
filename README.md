# WeeklyTracker LA

![CI](https://github.com/RaimundoMedeiros/loatracker/actions/workflows/ci.yml/badge.svg?branch=main)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support-ff5a16?logo=ko-fi&logoColor=white)](https://ko-fi.com/mediun)

A web app for tracking Lost Ark weekly raid progression across multiple character rosters.

https://loatracker.pages.dev/

Lost Ark players managing several characters need to track which raids have been cleared, at what difficulty, and whether chests were opened — every week. WeeklyTracker LA provides a roster-centric workflow for exactly that: create rosters, add characters with their item level and class, then track weekly raids per character with a single click.

The app is a fully client-side Progressive Web App. All data stays in the browser — no account required, no server needed for core functionality. Install it as a PWA and it works offline.

## Screenshots

> Screenshots coming soon. Contributions welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

## Features

- **Weekly Raid Tracker** — Track completion status, difficulty mode (Solo / Normal / Hard / Nightmare), and chest selection for each character across all current raids (Aegir, Brel, Mordum, Armoche, Kazeros, Serca).
- **Multi-Roster Management** — Create separate rosters for different accounts or groups. Switch between them, drag-and-drop reorder characters, sort by item level.
- **Friends Roster Sync** — Share weekly progress with friends via a PIN-based system. View friends' completion in a heatmap overlay. Supports proxy or Supabase RPC backend.
- **Custom Tab** — Add configurable columns (checkbox, text, textarea, counter) to track anything beyond raids. Per-roster persistence, drag-to-reorder, color coding.
- **Daily Tracking** — Guardian Raids, Chaos Dungeons, Field Boss, Chaos Gate, and Thaemine completion tracking.
- **Auto-Import from Game DB** — Import characters directly from the Lost Ark game database (`encounters.db`) with automatic class mapping and item level detection.
- **PWA / Offline** — Installable as a Progressive Web App with service worker caching. Works offline once installed.
- **Auto Raid Update** — Configurable auto-update interval and on-focus update for raid data.

## Tech Stack

- [Svelte 5](https://svelte.dev/) — reactive UI framework
- [TypeScript](https://www.typescriptlang.org/) — type safety
- [Vite](https://vite.dev/) — build tool and dev server
- [wa-sqlite](https://github.com/niccokunzmann/niccokunzmann.github.io) — SQLite in the browser via WebAssembly
- [Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/) — unit and e2e testing
- [ESLint](https://eslint.org/) — linting

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+

### Install

```bash
npm install
```

### Run in development

```bash
npm run dev
```

The dev server starts at `http://localhost:5173` with hot module replacement.

### Build

```bash
npm run build
npm run preview
```

## Environment Variables

Create a `.env` file based on `.env.example`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_FRIENDS_PROXY_URL` | No | Proxy endpoint for friends sync. |
| `VITE_SUPABASE_URL` | No | Supabase project URL (fallback when no proxy). |
| `VITE_SUPABASE_ANON_KEY` | No | Supabase anon key for RPC calls. |
| `VITE_SUPABASE_FRIENDS_UPLOAD_RPC` | No | RPC name for upload flow. Default: `upsert_friends_weekly_payload`. |
| `VITE_SUPABASE_FRIENDS_FETCH_RPC` | No | RPC name for fetch flow. Default: `get_friends_weekly`. |
| `VITE_MATHI_PROXY_BASE` | No | Proxy base for Mathi/Bible APIs in production. |

## Architecture Overview

WeeklyTracker LA follows a feature-based folder structure:

```
src/
  svelte/
    features/         # Feature modules (weekly, roster, friends, custom, settings, wizard, howto)
    components/       # Shared Svelte components
    domain/           # Pure business logic (no UI, no browser APIs)
    services/         # Data access and integration services
    stores/           # Svelte stores for cross-feature state
    utils/            # Error handling, validation, UI helpers
    legacy/           # Migrating: constants, styles, vanilla JS components
  types/              # TypeScript type definitions (AppApi, etc.)
  browserApi.ts       # Browser AppApi implementation (localStorage, wa-sqlite)
  db-worker.ts        # Web Worker for SQLite database operations
  dbBridge.ts         # Bridge between main thread and database worker
```

For a detailed architecture guide, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Deployment

WeeklyTracker LA builds to a static `dist/` folder that can be hosted on any static file server:

- **GitHub Pages** — current production deployment
- **Cloudflare Pages** / **Netlify** / **Vercel** — drop-in compatible
- **Self-hosted** — serve `dist/` with any HTTP server

```bash
npm run build
# Upload dist/ to your hosting provider
```

## Roadmap

Planned improvements are tracked in [GitHub Issues](https://github.com/RaimundoMedeiros/loatracker/issues). Key areas:

- [ ] Complete domain layer migration (extract pure business logic from pages)
- [ ] Improve friends sync reliability and UX
- [ ] Add comprehensive test coverage
- [ ] Localization support
- [ ] Desktop wrapper investigation (Tauri)

## Quality Commands

```bash
npm run lint            # TypeScript/JS linting
npm run lint:svelte     # Svelte component linting
npm run typecheck       # Full type checking
npm run test:run        # Unit tests (Vitest)
npm run test:e2e        # End-to-end tests (Playwright)
npm run verify:strict   # All checks combined
```

## Support

If you find this tool useful, consider supporting development:

- [Ko-fi](https://ko-fi.com/mediun)
- [LivePix](https://livepix.gg/mediun)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

See [SECURITY.md](SECURITY.md).

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
