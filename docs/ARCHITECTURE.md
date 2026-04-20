# Architecture Guide

This document provides technical context for contributors working on WeeklyTracker LA.

## Overview

WeeklyTracker LA is a client-side Progressive Web App. All core functionality runs in the browser with no server required. Data is stored in localStorage and optionally in an in-browser SQLite database via WebAssembly.

The only server-side components are optional:
- **Mathi/Bible API** (Cloudflare Worker) — fetches raid and character data
- **Friends sync backend** (Supabase RPC or proxy) — enables roster sharing between players

## Data Layer

The data layer is built around the `AppApi` interface defined in `src/types/app-api.ts`.

### Browser implementation (`src/browserApi.ts`)

The browser API implementation uses:
- **localStorage** for settings, roster metadata, weekly progress, and custom tab data
- **wa-sqlite** (WebAssembly SQLite) for reading the Lost Ark game database (`encounters.db`)

Storage keys follow the `wtl:` prefix convention (e.g., `wtl:settings`, `wtl:roster:list`, `wtl:roster:{id}:data`).

### Database worker (`src/db-worker.ts` + `src/dbBridge.ts`)

SQLite operations run in a Web Worker to avoid blocking the UI thread:
1. User provides the `encounters.db` file (via drag-and-drop or file picker)
2. `dbBridge.ts` sends the file to the worker via message passing
3. The worker uses wa-sqlite to query character data (names, classes, item levels)
4. Results stream back to the main thread with progress callbacks

The File System Access API provides persistent file handles in supported browsers, allowing automatic database reloads on subsequent visits.

## Feature Modules

Each feature in `src/svelte/features/` is a self-contained module with its own page component, sub-components, and feature-specific logic:

| Feature | Path | Description |
| --- | --- | --- |
| Weekly | `features/weekly/` | Main raid tracking table — completion, difficulty, chests |
| Roster | `features/roster/` | Character management — add, edit, delete, reorder, import |
| Friends | `features/friends/` | Friends sync — upload/fetch via Supabase RPC or proxy |
| Custom | `features/custom/` | User-defined custom columns per roster |
| Settings | `features/settings/` | App configuration — timezone, format, auto-raid, DB path |
| Wizard | `features/wizard/` | First-time setup assistant |
| How To | `features/howto/` | In-app help documentation |

## Routing

Routing is hash-based, managed in `src/svelte/App.svelte`.

- **Main routes** (`#weekly`, `#roster`, `#friends`, `#custom`) render in the main content area
- **Modal routes** (`#settings`, `#wizard`, `#howto`) render as overlays with focus trapping

Pages are lazy-loaded via dynamic `import()`.

## Domain Layer

The `src/svelte/domain/` folder is the target for pure TypeScript business logic during the ongoing migration. Rules:

1. Pure functions and explicit types only
2. No `window`, `document`, or `localStorage` access
3. No Svelte component imports
4. Shared rules move here from `features/*` and `legacy/*`

Currently contains `shared/raidDomain.ts` with raid key normalization and character eligibility checks. See `src/svelte/domain/README.md`.

## Services Layer

Services in `src/svelte/services/` encapsulate `window.api` access and remote integrations:

- `RosterService.ts` — Roster CRUD operations
- `BibleApiService.ts` — Mathi API for character/raid data
- `FriendsStateService.ts` — Friends sync state management
- `AutoRaidFocusUpdateService.ts` — Auto-update on app focus

Services return normalized data and do not manipulate the DOM. See `src/svelte/services/README.md`.

## Legacy Code

`src/svelte/legacy/` contains pre-Svelte vanilla JavaScript code being actively migrated:

- `config/constants.js` — All app constants: raid configuration, class icon mappings, DOM IDs, UI messages
- `components/SupportDonateButton.js` — Donation button (vanilla DOM)
- `styles/` — CSS split by domain, fully migrated from the original monolithic stylesheet

## External Integrations

### Mathi/Bible API
Fetches raid and character data. In development, Vite proxies `/proxy/mathi` to the production Cloudflare Worker. In production, the app uses `VITE_MATHI_PROXY_BASE`.

### Supabase (Friends Sync)
Optional backend for the friends sync feature. Uses two RPC functions:
- `upsert_friends_weekly_payload` — upload roster snapshots
- `get_friends_weekly` — fetch friend snapshots

PIN-based authentication with SHA-256 hashing via Web Crypto API.

### Friends Proxy
Alternative to Supabase — a Cloudflare Worker proxy (`VITE_FRIENDS_PROXY_URL`) that handles the same upload/fetch operations.

## Build and Deploy

- **Build tool**: Vite with `@sveltejs/vite-plugin-svelte`
- **Base path**: Relative (`./`) for hosting portability
- **Output**: Static `dist/` folder — deploy to any static file host
- **Worker format**: ES modules
- **WASM**: wa-sqlite `.wasm` files included via `assetsInclude`
