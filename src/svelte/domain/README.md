# Domain Layer (Migration Target)

This folder is the destination for TypeScript domain modules during migration.

Goal:

- centralize pure business rules
- avoid coupling with UI and browser APIs
- enable reuse across Weekly, Roster, and Friends

Guidelines:

1. Prioritize pure functions and explicit types.
2. Do not access `window`, `document`, or `localStorage` directly here.
3. Do not import Svelte components.
4. Shared rules should move from `features/*` and `legacy/*` into this folder.

Suggested future subfolders:

- `weekly/`
- `roster/`
- `friends/`
- `shared/`
