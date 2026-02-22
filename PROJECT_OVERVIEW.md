# LoaTracker — Visão Geral do Projeto

Este documento resume **o que o projeto faz**, **como está organizado** e **onde mexer** quando você precisar manter ou evoluir o código.

## 1) Objetivo do app

O LoaTracker é um tracker semanal de Lost Ark com foco em:

- gestão de roster (personagens)
- progresso semanal de raids
- progresso diário (guardian raid, field boss, chaos gate)
- sincronização de progresso com amigos (Friends)
- importação de dados via `encounters.db` (LOA Logs) e Bible API

## 2) Stack técnica

- **UI:** Svelte 5
- **Build/Dev server:** Vite 6
- **Linguagem:** TypeScript (com partes legadas em JavaScript)
- **Banco local:** leitura de SQLite no navegador com `wa-sqlite` + Web Worker
- **Persistência de estado:** `localStorage` (com chaves `wtl:*`) + fallback em memória
- **PWA:** `manifest.json` + `public/sw.js`

Scripts principais (`package.json`):

- `npm run dev` — sobe Vite em modo Svelte
- `npm run build` — build de produção
- `npm run preview` — preview local do build
- `npm run typecheck` — verificação TypeScript (`tsc --noEmit`)

## 3) Arquitetura em alto nível

O projeto está em uma fase de **migração/híbrido**:

1. Shell principal em Svelte (`src/svelte/App.svelte`)
2. Integração global via `window.api` (shim web) em `src/browserApi.ts`
3. Leitura de banco em worker (`src/db-worker.ts`) com ponte (`src/dbBridge.ts`)
4. Algumas regras e serviços ainda usam módulos `src/svelte/legacy/*`

### Bootstrap

1. `index.html` carrega `src/svelte/standalone-main.ts`
2. `standalone-main.ts` importa CSS legado + inicializa `browserApi.ts`
3. `browserApi.ts` expõe `window.api` e resolve `window.__API_READY__`
4. `bootstrapSvelteShell()` monta `App.svelte`

## 4) Pastas e responsabilidades

## `src/`

- `browserApi.ts`
  - contrato principal consumido pela UI (`window.api`)
  - settings/rosters/characterData
  - import/permissão de `encounters.db`
  - integração com `dbBridge`
- `dbBridge.ts`
  - comunicação request/response com `db-worker.ts`
  - ciclo de vida do worker (init/reinit/close)
- `db-worker.ts`
  - abre snapshot read-only do SQLite (`wa-sqlite`)
  - executa queries de raids/dailies/personagens
- `types/app-api.ts`
  - tipagem oficial da API exposta para o frontend

## `src/svelte/`

- `App.svelte`
  - roteamento por hash (`weekly`, `roster`, `friends`, `settings`, `wizard`, `howto`)
  - lazy-load das páginas
  - gerenciamento de modais e foco/teclado
- `main.ts` / `standalone-main.ts`
  - bootstrap da shell
- `stores/rosterSync.ts`
  - sinais globais para sincronizar mudanças de roster/telas

### Features

- `features/weekly/WeeklyPage.svelte`
  - grade semanal, cálculo de gold, colunas visíveis, reset, auto-update
- `features/roster/RosterPage.svelte`
  - CRUD de personagens, ordenação, import/refresh por Bible
  - regras de domínio em `features/roster/rosterDomain.ts`
- `features/friends/FriendsPage.svelte`
  - setup de amigos, upload/refresh, heatmap e cache
  - serviço principal em `features/friends/services/FriendsRosterService.ts`
- `features/settings/SettingsPage.svelte`
  - configurações gerais + fluxo de drop/import de `encounters.db`
- `features/wizard/WizardPage.svelte`
  - onboarding por etapas (db/mathimoe/preview/import)
- `features/howto/HowToPage.svelte`
  - guia visual de uso para usuário final

### Componentes

- `components/RosterSwitcher.svelte`
  - troca/criação/renomeação/remoção de rosters
  - estado de rosters visíveis no Weekly
- `components/DbGuideModal.svelte`
  - tutorial para localizar `encounters.db`

## `src/svelte/legacy/`

Código legado ainda utilizado por telas Svelte (principalmente Friends e partes de domínio):

- `modules/stateManager.js`
- `modules/rosterManager.js`
- `modules/weeklyTracker.js`
- `modules/MultiRosterManager.js`
- `services/ApiService.js`

Observação: esse acoplamento é esperado no estado atual e indica a migração gradual para TS/Svelte puro.

## 5) Fluxo de dados do banco (`encounters.db`)

1. Usuário importa DB por drag-and-drop (Settings/Wizard)
2. `browserApi.ts` recebe `FileSystemFileHandle` ou `File`
3. Para handle persistente, salva referência no IndexedDB (`HANDLE_DB`, store `handles`)
4. `dbBridge.reinit(file)` reinicia worker com snapshot do arquivo
5. `db-worker.ts` consulta SQLite em modo read-only e retorna dados para UI

### Detecção de mudança de arquivo

- Prioridade: **SQLite file change counter** (bytes 24–27 do header)
- Fallback: `size + mtime`

Isso evita recarregamentos desnecessários e melhora confiabilidade.

## 6) Persistência local

- Prefixo de chaves: `wtl:*`
- Dados principais:
  - settings
  - lista de rosters
  - roster ativo
  - roster por id (dados + ordem)
  - characterData por id
- `browserApi.ts` usa fallback em memória quando `localStorage` não está disponível

## 7) Integrações externas

- Bible API / Mathi (via `ApiService` e/ou proxy)
- Friends sync (proxy padrão: `friendsweekly.ychainstyle.workers.dev`)
- Vite proxy também define rota `/proxy/mathi` em desenvolvimento

## 8) Roteamento e UX

Roteamento por hash em `App.svelte`:

- `#weekly`
- `#roster`
- `#friends`
- `#settings` (modal)
- `#wizard` (modal)
- `#howto` (modal)

As páginas principais são lazy-loaded para reduzir custo inicial.

## 9) Pontos de atenção para manutenção

1. **Híbrido novo/legado:** antes de refatorar, verifique dependência cruzada com `legacy/*`
2. **Contrato da API:** qualquer mudança em `window.api` deve acompanhar `types/app-api.ts`
3. **Banco em worker:** consultas SQLite devem ficar no `db-worker.ts` (não na UI)
4. **Sincronização entre telas:** após mudanças de roster/settings, emita eventos/stores adequados
5. **Friends cache/TTL:** cuidado ao alterar estrutura de `FriendSnapshot` e config

## 10) Guia rápido: onde mexer por tarefa

- Corrigir bug de leitura/escrita de settings/roster: `src/browserApi.ts`
- Adicionar endpoint/método exposto para UI: `src/browserApi.ts` + `src/types/app-api.ts`
- Criar/ajustar query em `encounters.db`: `src/db-worker.ts` + `src/dbBridge.ts`
- Ajustar regras de roster: `src/svelte/features/roster/rosterDomain.ts`
- Ajustar tela Weekly: `src/svelte/features/weekly/WeeklyPage.svelte`
- Ajustar fluxo Friends: `src/svelte/features/friends/*`
- Ajustar onboarding/importação: `src/svelte/features/wizard/WizardPage.svelte`

## 11) Próximo passo recomendado

Criar um segundo documento curto de **roadmap de migração** (ex.: remover dependências de `legacy/*` por etapas), para facilitar onboarding e priorização técnica.

Documento criado: **MIGRATION_ROADMAP.md**
