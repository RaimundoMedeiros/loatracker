# Contributing

Thanks for your interest in contributing to WeeklyTracker LA!

If you're looking for a good place to start, check for issues labeled [`good first issue`](https://github.com/RaimundoMedeiros/loatracker/issues?q=is%3Aissue+label%3A%22good+first+issue%22).

## Workflow

1. Fork the repository
2. Create a branch from `main`
3. Make focused changes
4. Run local checks
5. Open a pull request

## Local Setup

```bash
npm install
npm run dev
```

### Development Tips

- **Hot reload**: `npm run dev` starts Vite with HMR on `http://localhost:5173`. The dev server binds to all interfaces (`host: true`), so you can test on mobile devices on the same network.
- **Mathi API proxy**: In development, the Vite dev server proxies `/proxy/mathi` requests to the production Cloudflare Worker, so API features work without extra configuration.
- **Browser support**: The app uses wa-sqlite (WebAssembly SQLite). Chrome/Edge 90+, Firefox 90+, Safari 15+ are supported.
- **PWA testing**: The service worker is only active in production builds. Use `npm run build && npm run preview` to test PWA behavior.

## Project Structure

```
src/svelte/features/    # Self-contained feature modules (weekly, roster, friends, custom, settings)
src/svelte/domain/      # Pure business logic, no UI dependencies (migration target)
src/svelte/services/    # Data access services (API, friends state, roster)
src/svelte/stores/      # Svelte reactive stores for cross-feature state
src/svelte/components/  # Shared Svelte components
src/svelte/utils/       # Error handling, validation, UI helpers
src/svelte/legacy/      # Vanilla JS code being migrated to Svelte/TypeScript
src/types/              # Shared TypeScript type definitions
src/browserApi.ts       # Browser AppApi implementation (the main data layer)
```

Internal architecture docs are available in:
- [`src/svelte/domain/README.md`](src/svelte/domain/README.md) — Domain layer conventions
- [`src/svelte/services/README.md`](src/svelte/services/README.md) — Service layer conventions
- [`src/svelte/legacy/styles/README.md`](src/svelte/legacy/styles/README.md) — CSS organization
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — Full architecture guide

## Code Style

- **TypeScript** is required for all new code. Avoid `any` — prefer explicit types.
- **Svelte 5** syntax for all components.
- **ESLint** enforces style rules. Run `npm run lint` to check.
- **File naming**: PascalCase for Svelte components (`WeeklyPage.svelte`), camelCase for TypeScript modules (`raidDomain.ts`), PascalCase for services (`RosterService.ts`).
- **Conventional commits**: Use `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:` prefixes.
- **Domain layer**: New business logic should go in `src/svelte/domain/`, not in page components.

## Testing

### Unit tests (Vitest + @testing-library/svelte)

```bash
npm run test:run        # Run once
npm run test            # Watch mode
npm run test:coverage   # With coverage report
```

Tests live alongside their source files or in `__tests__/` folders. Use `@testing-library/svelte` for component tests.

### End-to-end tests (Playwright)

```bash
npx playwright install  # First time: install browsers
npm run test:e2e        # Run tests
npm run test:e2e:ui     # Interactive mode
```

### Full quality gate

Before opening a PR, run:

```bash
npm run verify:strict
```

If Playwright e2e setup is not available locally, run at least:

```bash
npm run lint
npm run lint:svelte
npm run typecheck
npm run test:run
```

## Pull Request Guidelines

- Keep PRs small and focused
- Explain problem and solution clearly
- Include screenshots for UI changes
- Add or update tests for behavior changes
- Avoid unrelated refactors in the same PR

## Commit Messages

Prefer conventional-style messages, for example:

- `feat: add friends heatmap filter`
- `fix: prevent stale roster order after import`
- `docs: clarify environment setup`

## Branch Naming

Suggested patterns:

- `feat/<short-topic>`
- `fix/<short-topic>`
- `docs/<short-topic>`
- `chore/<short-topic>`

## Communication

- **Bugs & Features**: Use [GitHub Issues](https://github.com/RaimundoMedeiros/loatracker/issues)
- **Pull Requests**: Discussion happens directly on the PR
- **Questions**: Open an issue with the `question` label
