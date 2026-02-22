# Services Layer (Migration Target)

This folder is the destination for modern TypeScript services.

Goal:

- encapsulate access to `window.api`
- encapsulate remote integrations (Bible/Friends)
- reduce procedural logic spread across pages

Guidelines:

1. Services must return normalized and predictable data.
2. Services should not manipulate the DOM.
3. Error handling must be consistent across features.
4. Svelte features should depend on services in this folder, not `legacy/services/*`.

Suggested future services:

- `BibleApiService.ts`
- `RosterService.ts`
- `FriendsStateService.ts`
- `SettingsService.ts`
