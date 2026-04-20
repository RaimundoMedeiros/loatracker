# Contributing

Thanks for your interest in contributing.

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

## Quality Gate

Before opening a pull request, run:

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
