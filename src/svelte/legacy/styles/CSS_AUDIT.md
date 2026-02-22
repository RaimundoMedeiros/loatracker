# CSS Audit – Duplicação e Otimização

Gerado em: 2026-02-21T12:40:52.845Z

## Escopo
- Arquivos: `src/app/styles/*.css` (exceto `index.css`)
- Foco: duplicação de blocos de declaração e pares `propriedade:valor`
- Filtros de ruído: estágios de keyframes (`from`/`to`/`%`) e pares genéricos de utilidade visual baixa

## Top blocos duplicados (priorizar primeiro)
### 1) Prioridade Baixa — 4 ocorrências em 3 arquivo(s)
- Declarações (2): `align-items:stretch; flex-direction:column`
- Exemplos:
  - src/app/styles/friends.css :: .friends-heatmap-intro
  - src/app/styles/roster.css :: #roster-tab .roster-header
  - src/app/styles/shared.css :: .header
  - src/app/styles/shared.css :: .add-character

### 2) Prioridade Baixa — 2 ocorrências em 2 arquivo(s)
- Declarações (3): `display:flex; flex-wrap:wrap; gap:var(--spacing-sm)`
- Exemplos:
  - src/app/styles/friends.css :: .friends-header-actions
  - src/app/styles/roster.css :: #roster-tab .roster-summary

### 3) Prioridade Baixa — 2 ocorrências em 2 arquivo(s)
- Declarações (3): `color:var(--color-text-secondary); font-size:var(--font-sm); margin:0`
- Exemplos:
  - src/app/styles/friends.css :: #friends-setup-modal .friends-empty-state__text
  - src/app/styles/roster.css :: #roster-tab .roster-subtitle

### 4) Prioridade Baixa — 2 ocorrências em 2 arquivo(s)
- Declarações (3): `background:var(--color-primary); border-color:var(--color-primary); color:var(--color-bg-dark)`
- Exemplos:
  - src/app/styles/settings.css :: .db-guide-actions #db-guide-got-it
  - src/app/styles/wizard.css :: .progress-step.active .step-number

### 5) Prioridade Baixa — 2 ocorrências em 1 arquivo(s)
- Declarações (2): `align-items:flex-start; flex-direction:column`
- Exemplos:
  - src/app/styles/friends.css :: .friends-controls-row
  - src/app/styles/friends.css :: #friends-setup-modal .friends-self-pin-label

### 6) Prioridade Baixa — 2 ocorrências em 1 arquivo(s)
- Declarações (2): `justify-self:stretch; width:100%`
- Exemplos:
  - src/app/styles/friends.css :: #friends-setup-modal #friends-list > div
  - src/app/styles/friends.css :: #friends-setup-modal .friends-add-form button

### 7) Prioridade Baixa — 2 ocorrências em 1 arquivo(s)
- Declarações (2): `border-radius:calc(var(--radius-sm) - 1px); border:0`
- Exemplos:
  - src/app/styles/friends.css :: #friends-setup-modal .friends-self-color input::-webkit-color-swatch, #friends-setup-modal .friends-list-item__color::-webkit-color-swatch
  - src/app/styles/friends.css :: #friends-setup-modal .friends-self-color input::-moz-color-swatch, #friends-setup-modal .friends-list-item__color::-moz-color-swatch

### 8) Prioridade Baixa — 2 ocorrências em 2 arquivo(s)
- Declarações (2): `background-color:var(--color-surface-hover); color:var(--color-text)`
- Exemplos:
  - src/app/styles/roster.css :: .sort-dropdown button:hover
  - src/app/styles/settings.css :: .modal-buttons button:last-child

### 9) Prioridade Baixa — 2 ocorrências em 2 arquivo(s)
- Declarações (2): `background:var(--color-surface-hover); border-color:var(--color-primary)`
- Exemplos:
  - src/app/styles/roster.css :: .roster-select:hover
  - src/app/styles/wizard.css :: .order-item:hover

### 10) Prioridade Baixa — 2 ocorrências em 2 arquivo(s)
- Declarações (2): `box-shadow:var(--shadow-md); transform:translateY(-1px)`
- Exemplos:
  - src/app/styles/roster.css :: #roster-tab #sort-roster-btn:hover:not(.cooldown-active), #roster-tab #refresh-roster-btn:hover:not(:disabled)
  - src/app/styles/wizard.css :: .wizard-primary-btn:hover:not(:disabled), .wizard-secondary-btn:hover:not(:disabled)

### 11) Prioridade Baixa — 2 ocorrências em 2 arquivo(s)
- Declarações (2): `cursor:not-allowed; opacity:0.6`
- Exemplos:
  - src/app/styles/settings.css :: .update-button-header:disabled
  - src/app/styles/shared.css :: button:disabled

## Top pares propriedade:valor repetidos
### 1) Alta — `color:var(--color-text-secondary)` (44 ocorrências, 6 arquivos)
- src/app/styles/friends.css :: .friends-heatmap-intro__meta
- src/app/styles/friends.css :: .friends-heatmap-legend__item
- src/app/styles/friends.css :: .friends-heatmap-section-title
- src/app/styles/friends.css :: .friends-heatmap-empty p
- src/app/styles/friends.css :: .friends-card__sync-badge
- src/app/styles/friends.css :: .friends-char-name

### 2) Alta — `color:var(--color-primary)` (32 ocorrências, 8 arquivos)
- src/app/styles/foundation.css :: h1
- src/app/styles/friends.css :: .friends-card__title
- src/app/styles/friends.css :: .friends-card__sync-badge.is-self
- src/app/styles/friends.css :: #friends-self-code
- src/app/styles/friends.css :: #friends-setup-modal .friends-setup-card__header h3
- src/app/styles/howto.css :: .howto-content h2

### 3) Alta — `background:var(--color-surface)` (30 ocorrências, 7 arquivos)
- src/app/styles/foundation.css :: ::-webkit-scrollbar-track
- src/app/styles/friends.css :: .friends-heatmap-table tbody th
- src/app/styles/friends.css :: .friends-card__header
- src/app/styles/friends.css :: .friends-raid-cell.is-ignored
- src/app/styles/friends.css :: .friends-self-color input
- src/app/styles/friends.css :: .friends-copy-code-btn, .friends-visibility-btn

### 4) Alta — `gap:var(--spacing-sm)` (30 ocorrências, 6 arquivos)
- src/app/styles/friends.css :: .friends-heatmap-modal__content
- src/app/styles/friends.css :: .friends-heatmap-dual
- src/app/styles/friends.css :: .friends-heatmap-intro
- src/app/styles/friends.css :: .friends-header-actions
- src/app/styles/friends.css :: .friends-self-code-row
- src/app/styles/friends.css :: .friends-self-code

### 5) Alta — `text-align:center` (28 ocorrências, 8 arquivos)
- src/app/styles/foundation.css :: h1
- src/app/styles/friends.css :: .friends-heatmap-table th, .friends-heatmap-table td
- src/app/styles/friends.css :: .friends-heatmap-table tbody th
- src/app/styles/friends.css :: .friends-heatmap-empty
- src/app/styles/friends.css :: .friends-table th, .friends-table td
- src/app/styles/friends.css :: .friends-row-empty, .friends-empty

### 6) Alta — `box-shadow:var(--shadow-sm)` (23 ocorrências, 7 arquivos)
- src/app/styles/friends.css :: .friends-add-form button:hover
- src/app/styles/friends.css :: #friends-setup-modal .friends-setup-card
- src/app/styles/howto.css :: .howto-section
- src/app/styles/howto.css :: .howto-guide-image
- src/app/styles/howto.css :: .howto-actions button
- src/app/styles/layout.css :: .support-donate-toggle

### 7) Alta — `transform:translateY(-1px)` (21 ocorrências, 7 arquivos)
- src/app/styles/friends.css :: #friends-tab .friends-card:hover, #friends-tab .friends-card:focus-within
- src/app/styles/friends.css :: .friends-add-form button:hover
- src/app/styles/friends.css :: #friends-setup-modal .friends-copy-code-btn:hover
- src/app/styles/friends.css :: #friends-setup-modal .friends-profile-upload-btn:hover:enabled
- src/app/styles/friends.css :: #friends-setup-modal .friends-add-form button:hover
- src/app/styles/howto.css :: .howto-actions button:hover

### 8) Alta — `display:grid` (20 ocorrências, 4 arquivos)
- src/app/styles/friends.css :: .friends-add-form
- src/app/styles/friends.css :: .friends-list
- src/app/styles/friends.css :: .friends-list-item
- src/app/styles/friends.css :: #friends-setup-modal .friends-setup-layout
- src/app/styles/friends.css :: #friends-setup-modal .friends-self-code-row
- src/app/styles/friends.css :: #friends-setup-modal .friends-self-code--id-card

### 9) Alta — `overflow:hidden` (19 ocorrências, 6 arquivos)
- src/app/styles/foundation.css :: .visually-hidden
- src/app/styles/foundation.css :: .progress-bar
- src/app/styles/friends.css :: .friends-heatmap-modal__content
- src/app/styles/friends.css :: .friends-heatmap-table--summary thead th:first-child, .friends-heatmap-table--summary tbody th.friends-heatmap-roster
- src/app/styles/friends.css :: .friends-heatmap-table--detail thead th:first-child, .friends-heatmap-table--detail tbody th.friends-heatmap-char-name
- src/app/styles/friends.css :: .friends-card

### 10) Alta — `gap:6px` (19 ocorrências, 5 arquivos)
- src/app/styles/friends.css :: .friends-heatmap-legend
- src/app/styles/friends.css :: .friends-card__header
- src/app/styles/friends.css :: #friends-tab .friends-header-actions .header-icon-btn
- src/app/styles/friends.css :: #friends-tab .friends-card__meta
- src/app/styles/friends.css :: .friends-self-pin-input-wrap
- src/app/styles/friends.css :: .friends-list-item__actions

### 11) Alta — `font-size:var(--font-xs)` (18 ocorrências, 6 arquivos)
- src/app/styles/friends.css :: .friends-heatmap-intro__meta
- src/app/styles/friends.css :: .friends-heatmap-table
- src/app/styles/friends.css :: .friends-card__summary
- src/app/styles/friends.css :: .friends-table
- src/app/styles/friends.css :: .friends-list-item__updated-at
- src/app/styles/friends.css :: .friends-list-item__code

### 12) Alta — `color:var(--color-text-muted)` (18 ocorrências, 4 arquivos)
- src/app/styles/friends.css :: .friends-heatmap-cell.state-completed
- src/app/styles/friends.css :: .friends-heatmap-cell.state-none
- src/app/styles/friends.css :: .friends-card__summary
- src/app/styles/friends.css :: .friends-card__sync-badge.is-nosync
- src/app/styles/friends.css :: .friends-raid-cell.is-pending
- src/app/styles/friends.css :: .friends-raid-cell.is-ignored

### 13) Alta — `gap:var(--spacing-md)` (18 ocorrências, 6 arquivos)
- src/app/styles/friends.css :: .friends-header
- src/app/styles/friends.css :: .friends-controls-row
- src/app/styles/friends.css :: .friends-grid
- src/app/styles/friends.css :: #friends-setup-modal .friends-setup-layout
- src/app/styles/friends.css :: #friends-setup-modal .friends-setup-card
- src/app/styles/layout.css :: .header

### 14) Alta — `color:var(--color-bg-dark)` (17 ocorrências, 8 arquivos)
- src/app/styles/foundation.css :: .skip-to-content
- src/app/styles/friends.css :: .friends-add-form button
- src/app/styles/friends.css :: #friends-setup-modal .friends-profile-upload-btn
- src/app/styles/friends.css :: #friends-setup-modal .friends-add-form button
- src/app/styles/howto.css :: .howto-actions button
- src/app/styles/layout.css :: .support-donate-toggle

### 15) Alta — `white-space:nowrap` (17 ocorrências, 6 arquivos)
- src/app/styles/foundation.css :: .visually-hidden
- src/app/styles/friends.css :: .friends-heatmap-legend__item
- src/app/styles/friends.css :: .friends-heatmap-table th, .friends-heatmap-table td
- src/app/styles/friends.css :: .friends-card__sync-badge
- src/app/styles/friends.css :: .friends-table th
- src/app/styles/friends.css :: .friends-char-name

### 16) Alta — `flex-wrap:wrap` (17 ocorrências, 6 arquivos)
- src/app/styles/friends.css :: .friends-heatmap-legend
- src/app/styles/friends.css :: #friends-tab .friends-header-actions
- src/app/styles/friends.css :: #friends-tab .friends-card__meta
- src/app/styles/friends.css :: .friends-header
- src/app/styles/friends.css :: .friends-header-actions
- src/app/styles/friends.css :: .friends-grid

### 17) Alta — `display:inline-flex` (17 ocorrências, 4 arquivos)
- src/app/styles/friends.css :: .friends-heatmap-legend__item
- src/app/styles/friends.css :: .friends-card__sync-badge
- src/app/styles/friends.css :: .friends-self-code-row
- src/app/styles/friends.css :: .friends-self-code
- src/app/styles/friends.css :: .friends-copy-code-btn, .friends-visibility-btn
- src/app/styles/friends.css :: .friends-self-pin-label, .friends-autosync-toggle

### 18) Alta — `border-color:var(--color-primary)` (17 ocorrências, 6 arquivos)
- src/app/styles/layout.css :: .tab-button.active
- src/app/styles/roster.css :: .sort-roster-btn.active
- src/app/styles/roster.css :: .roster-select:hover
- src/app/styles/settings.css :: .column-settings-item:hover
- src/app/styles/settings.css :: .db-guide-btn:hover
- src/app/styles/settings.css :: .db-guide-actions #db-guide-got-it

### 19) Alta — `margin-bottom:var(--spacing-md)` (16 ocorrências, 6 arquivos)
- src/app/styles/friends.css :: .friends-header
- src/app/styles/friends.css :: .friends-self-code-row
- src/app/styles/friends.css :: .friends-controls-row
- src/app/styles/friends.css :: .friends-add-form
- src/app/styles/layout.css :: .header
- src/app/styles/roster.css :: #roster-tab .character-card h3

### 20) Alta — `font-size:var(--font-sm)` (15 ocorrências, 4 arquivos)
- src/app/styles/friends.css :: .friends-heatmap-section-title
- src/app/styles/friends.css :: .friends-heatmap-empty p
- src/app/styles/friends.css :: .friends-self-label
- src/app/styles/friends.css :: #friends-self-code
- src/app/styles/friends.css :: .friends-add-form input
- src/app/styles/friends.css :: .friends-list-item__alias

### 21) Alta — `left:0` (14 ocorrências, 6 arquivos)
- src/app/styles/foundation.css :: .skip-to-content
- src/app/styles/foundation.css :: .loading-overlay
- src/app/styles/friends.css :: .friends-heatmap-table thead th:first-child
- src/app/styles/friends.css :: .friends-heatmap-table tbody th
- src/app/styles/friends.css :: #friends-tab .friends-card::before
- src/app/styles/layout.css :: .support-donate-menu

### 22) Alta — `background-color:var(--color-surface)` (14 ocorrências, 7 arquivos)
- src/app/styles/foundation.css :: .progress-bar
- src/app/styles/friends.css :: #friends-tab .friends-header-actions .header-icon-btn
- src/app/styles/layout.css :: .header-icon-btn
- src/app/styles/layout.css :: .tab-button
- src/app/styles/layout.css :: .header-help-btn
- src/app/styles/layout.css :: .settings-btn

### 23) Alta — `background:var(--color-surface-light)` (14 ocorrências, 5 arquivos)
- src/app/styles/friends.css :: .friends-heatmap-table thead th
- src/app/styles/friends.css :: .friends-table th
- src/app/styles/friends.css :: #friends-setup-modal .friends-add-form
- src/app/styles/friends.css :: #friends-setup-modal .friends-self-code--id-card
- src/app/styles/friends.css :: #friends-setup-modal .friends-empty-state
- src/app/styles/roster.css :: #roster-tab #refresh-roster-btn

### 24) Alta — `display:block` (14 ocorrências, 7 arquivos)
- src/app/styles/friends.css :: .friends-visibility-btn .friends-visibility-icon, .friends-copy-code-btn img
- src/app/styles/friends.css :: #friends-setup-modal #friends-self-code
- src/app/styles/friends.css :: #friends-setup-modal .friends-profile-instructions__title
- src/app/styles/howto.css :: .howto-guide-image
- src/app/styles/roster.css :: .remove-icon img
- src/app/styles/roster.css :: .sort-dropdown

### 25) Alta — `font-size:0.9rem` (14 ocorrências, 5 arquivos)
- src/app/styles/howto.css :: .howto-image-slot
- src/app/styles/roster.css :: .roster-select
- src/app/styles/roster.css :: #roster-switcher-container .roster-switcher-dialog__title
- src/app/styles/settings.css :: .column-settings-sub
- src/app/styles/settings.css :: .db-guide-btn
- src/app/styles/settings.css :: .settings-danger-copy

### 26) Alta — `transition:all var(--transition-fast)` (14 ocorrências, 5 arquivos)
- src/app/styles/layout.css :: .header-icon-btn
- src/app/styles/layout.css :: .tab-button
- src/app/styles/layout.css :: .header-help-btn
- src/app/styles/layout.css :: .settings-btn
- src/app/styles/roster.css :: .character-card
- src/app/styles/roster.css :: .remove-icon img

### 27) Alta — `justify-content:space-between` (13 ocorrências, 5 arquivos)
- src/app/styles/friends.css :: .friends-heatmap-intro
- src/app/styles/friends.css :: .friends-card__meta
- src/app/styles/friends.css :: .friends-header
- src/app/styles/friends.css :: .friends-controls-row
- src/app/styles/friends.css :: #friends-setup-modal .friends-self-pin-label
- src/app/styles/layout.css :: .header

### 28) Alta — `gap:8px` (13 ocorrências, 4 arquivos)
- src/app/styles/friends.css :: #friends-tab .friends-header-actions__primary, #friends-tab .friends-header-actions__secondary
- src/app/styles/friends.css :: #friends-tab .friends-header-actions
- src/app/styles/friends.css :: #friends-setup-modal .friends-list-item__actions
- src/app/styles/layout.css :: .support-donate-toggle
- src/app/styles/roster.css :: .form-row
- src/app/styles/roster.css :: .sort-roster-btn

### 29) Alta — `position:fixed` (12 ocorrências, 7 arquivos)
- src/app/styles/foundation.css :: .loading-overlay
- src/app/styles/friends.css :: .friends-heatmap-modal
- src/app/styles/friends.css :: .friends-setup-modal
- src/app/styles/howto.css :: .howto-modal
- src/app/styles/layout.css :: .support-donate-wrapper
- src/app/styles/settings.css :: #confirm-modal

### 30) Alta — `border-radius:var(--radius-full)` (12 ocorrências, 6 arquivos)
- src/app/styles/foundation.css :: .loading-spinner
- src/app/styles/foundation.css :: .progress-bar
- src/app/styles/friends.css :: .friends-heatmap-legend__item
- src/app/styles/friends.css :: .friends-card__sync-badge
- src/app/styles/friends.css :: #friends-tab .friends-card::before
- src/app/styles/roster.css :: #roster-tab .roster-summary-chip

### 31) Alta — `align-items:flex-start` (12 ocorrências, 6 arquivos)
- src/app/styles/friends.css :: .friends-heatmap-intro
- src/app/styles/friends.css :: .friends-controls-row
- src/app/styles/friends.css :: #friends-tab .friends-card__meta
- src/app/styles/friends.css :: #friends-setup-modal .friends-self-pin-label
- src/app/styles/layout.css :: .header
- src/app/styles/roster.css :: .character-card .card-buttons

### 32) Alta — `overflow-y:auto` (12 ocorrências, 5 arquivos)
- src/app/styles/friends.css :: .friends-table-wrap
- src/app/styles/friends.css :: #friends-tab .friends-table-wrap
- src/app/styles/friends.css :: .friends-setup-modal__content
- src/app/styles/friends.css :: #friends-setup-modal .friends-list
- src/app/styles/howto.css :: .howto-content
- src/app/styles/settings.css :: #settings-modal > .modal-content

### 33) Alta — `font-size:0.85rem` (12 ocorrências, 4 arquivos)
- src/app/styles/settings.css :: .db-permission-status
- src/app/styles/shared.css :: #friends-tab .friends-header-actions .header-icon-btn .btn-label, .weekly-actions .header-icon-btn .btn-label
- src/app/styles/weekly.css :: .weekly-roster-selector
- src/app/styles/wizard.css :: .wizard-option ul li
- src/app/styles/wizard.css :: .wizard-info code
- src/app/styles/wizard.css :: .wizard-hint

### 34) Alta — `background:var(--color-primary)` (11 ocorrências, 7 arquivos)
- src/app/styles/foundation.css :: .skip-to-content
- src/app/styles/friends.css :: .friends-add-form button
- src/app/styles/howto.css :: .howto-actions button
- src/app/styles/layout.css :: .support-donate-toggle
- src/app/styles/settings.css :: .db-copy-progress__bar
- src/app/styles/settings.css :: .db-guide-actions #db-guide-got-it

### 35) Alta — `font-size:var(--font-md)` (11 ocorrências, 6 arquivos)
- src/app/styles/foundation.css :: body
- src/app/styles/friends.css :: .friends-heatmap-intro__title
- src/app/styles/friends.css :: .friends-heatmap-empty h3
- src/app/styles/friends.css :: .friends-card__title
- src/app/styles/layout.css :: .header-help-btn
- src/app/styles/roster.css :: .sort-roster-btn

### 36) Alta — `pointer-events:none` (11 ocorrências, 5 arquivos)
- src/app/styles/foundation.css :: svg, img
- src/app/styles/foundation.css :: .loading-overlay
- src/app/styles/friends.css :: #friends-tab .friends-card::before
- src/app/styles/friends.css :: #friends-setup-modal .friends-list-item__remove
- src/app/styles/roster.css :: .character-card h3, .character-card p, .character-card img
- src/app/styles/roster.css :: .sort-dropdown

### 37) Alta — `transform:none` (11 ocorrências, 5 arquivos)
- src/app/styles/friends.css :: .friends-heatmap-modal__content
- src/app/styles/friends.css :: #friends-tab .friends-header-actions .header-icon-btn:disabled
- src/app/styles/friends.css :: #friends-tab .friends-card
- src/app/styles/friends.css :: .friends-setup-modal__content
- src/app/styles/friends.css :: #friends-setup-modal .friends-profile-upload-btn:disabled
- src/app/styles/howto.css :: .howto-content

### 38) Alta — `top:0` (10 ocorrências, 4 arquivos)
- src/app/styles/foundation.css :: .loading-overlay
- src/app/styles/friends.css :: .friends-heatmap-table thead th
- src/app/styles/friends.css :: .friends-table th
- src/app/styles/settings.css :: #confirm-modal
- src/app/styles/settings.css :: #settings-modal, #notification-modal, #column-settings-modal
- src/app/styles/settings.css :: .modal-overlay

### 39) Alta — `border-radius:var(--radius-lg)` (10 ocorrências, 6 arquivos)
- src/app/styles/friends.css :: #friends-setup-modal .friends-setup-card
- src/app/styles/layout.css :: .support-donate-menu
- src/app/styles/roster.css :: .add-character
- src/app/styles/roster.css :: #roster-tab .roster-controls
- src/app/styles/roster.css :: #roster-tab .roster-empty
- src/app/styles/settings.css :: .modal-content

### 40) Alta — `padding:var(--spacing-md)` (10 ocorrências, 4 arquivos)
- src/app/styles/friends.css :: #friends-setup-modal .friends-setup-card
- src/app/styles/friends.css :: #friends-setup-modal .friends-empty-state
- src/app/styles/roster.css :: #roster-tab .roster-controls
- src/app/styles/settings.css :: .column-settings-item
- src/app/styles/wizard.css :: .wizard-option
- src/app/styles/wizard.css :: .file-input-group input

## Recomendações imediatas (Passo A -> B)
- Consolidar blocos com prioridade **Alta** em `shared.css` ou no módulo de domínio correto.
- Transformar pares repetidos de espaçamento/borda em tokens no `foundation.css` (somente se repetição real).
- Revalidar com `npm run build` a cada lote pequeno (3-6 blocos).
