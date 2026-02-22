# CSS organization by domain/tab

This folder is the single source of style imports.

- `index.css`: import order and composition root.
- `foundation.css`: tokens, base, accessibility, loading.
- `layout.css`: header/navigation shared layout.
- `tabs.css`: generic tab containers and core tab layout.
- `roster.css`: roster tab styles (active; includes base + sort controls + switcher).
- `friends.css`: friends tab and heatmap styles.
- `settings.css`: settings/domain styles (active; migrated core + db/status/confirm blocks).
- `weekly.css`: weekly tab/table/cell styles (active; migrated, including daily columns and gold column).
- `howto.css`: how-to/help styles (active; migrated).
- `wizard.css`: wizard modal + roster wizard styles (active; migrated).
- `utilities.css`: toasts, animation helpers, and form validation (active; migrated).
- `shared.css`: shared button base, checkbox base, and cross-domain responsive overrides (active; migrated).

## Migration rule

Move styles incrementally from `../style.css` into the target file while preserving visual behavior:

1. Move one bounded block at a time.
2. Keep `@media` overrides together or in the same target domain.
3. Run `npm run build` after each extraction.
4. Leave a marker comment in `../style.css` indicating where styles were extracted.

## Legacy cleanup checklist (`../style.css`)

### Done
- [x] Foundation/base moved to `foundation.css`
- [x] Header/navigation moved to `layout.css`
- [x] Tab core moved to `tabs.css`
- [x] Weekly table/cell + gold column moved to `weekly.css`
- [x] Daily styles consolidated into `weekly.css`
- [x] Roster base + sort + switcher moved to `roster.css`
- [x] Settings styles moved to `settings.css`
- [x] How-to styles moved to `howto.css`
- [x] Wizard styles moved to `wizard.css`
- [x] Toast/animations/form validation moved to `utilities.css`
- [x] Progression web-irrelevant styles removed

### Remaining in legacy
- [x] Friends/Friends Setup modal residual block moved to `friends.css`
- [x] Shared custom checkbox base moved to `shared.css`
- [x] Shared `button` base moved to `shared.css`
- [x] Small global responsive overrides moved to `shared.css`
- [x] Friends profile instructions moved to `friends.css`
