# WeeklyTracker LA

WeeklyTracker LA is a Svelte + Vite web app to track Lost Ark weekly progression across multiple rosters.

## Highlights

- Weekly raid tracking with roster-focused workflow
- Multi-roster management and roster switcher
- Friends sync flow (proxy or Supabase RPC)
- Custom tab with configurable columns
- PWA assets and offline-friendly setup

## Tech Stack

- Svelte 5
- TypeScript
- Vite
- Vitest + Playwright
- ESLint

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

## Quality Commands

```bash
npm run lint
npm run lint:svelte
npm run typecheck
npm run test:run
npm run test:e2e
npm run verify:strict
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

See [SECURITY.md](SECURITY.md).

## License

This project is licensed under GNU AGPL-3.0-only. See [LICENSE](LICENSE).
