# Migration Phase 0 — Baseline Técnico

Este documento registra o baseline da Fase 0:

- contratos internos atuais
- eventos globais atuais
- pontos de emissão e consumo

Objetivo: reduzir ambiguidade antes das fases de refatoração.

## 1) Contratos internos (estado atual)

## 1.1 Roster (persistido por rosterId)

Fonte principal de tipo: `src/types/app-api.ts` (`RosterPayload`, `RosterCharacter`).

Shape observado:

- `RosterPayload`
  - `roster: Record<string, unknown>`
  - `order: string[]`
- `RosterCharacter` (após normalização em `features/roster/rosterDomain.ts`)
  - `class: string`
  - `ilvl: number`
  - `visible?: boolean`
  - `combatPower?: number | null`

Observação operacional:

- Existem chaves de metadado no objeto de roster (ex.: `dailyData`) que não são personagens.
- Em código moderno, isso é tratado por filtros de chave (ex.: `isCharacterKey`).

## 1.2 CharacterData (progresso semanal/diário)

Fonte de uso principal:

- `src/svelte/features/weekly/WeeklyPage.svelte`
- `src/svelte/legacy/modules/weeklyTracker.js`

Shape funcional observado por personagem e raid:

- por personagem: `Record<string, CharacterBossData>`
- por raid: objeto com campos como:
  - `cleared: boolean`
  - `difficulty: 'Solo' | 'Normal' | 'Hard'`
  - `hidden: boolean`
  - `chestOpened: boolean`
  - `timestamp: string | number | null`

Dados diários (quando presentes):

- `dailyData` com:
  - `date`
  - `characters[name].guardianRaid`
  - `characters[name].chaosDungeon`
  - `roster.fieldBoss`
  - `roster.chaosGate`

## 1.3 Friends Snapshot

Fonte principal de tipo:

- `src/svelte/features/friends/types.ts`
- normalização/cache em `src/svelte/features/friends/config.ts`

Shape oficial:

- `FriendSnapshot`
  - `weekKey: string`
  - `rosterCode: string`
  - `rosterName: string`
  - `raidIds: string[]`
  - `characters: FriendCharacterSnapshot[]`
  - `updatedAt: string | null`

- `FriendCharacterSnapshot`
  - `name: string`
  - `sortIndex: number`
  - `raidMask: number`
  - `visibleMask: number`

Observação operacional:

- `FriendsRosterService` também trabalha com `hiddenMask` internamente no snapshot próprio de upload.
- TTL de cache atual: 15 minutos.

## 2) Eventos globais atuais

## 2.1 Gate de inicialização

Evento/sinal:

- `window.__API_READY__: Promise<void>`

Papel:

- Garante que o bootstrap de `window.api` terminou antes de telas chamarem API.

Origem:

- `src/browserApi.ts` define `window.__API_READY__ = Promise.resolve()`.

Consumo (exemplos):

- `src/svelte/App.svelte`
- `src/svelte/features/weekly/WeeklyPage.svelte`

## 2.2 Store: rosterChangeVersion

Fonte:

- `src/svelte/stores/rosterSync.ts`

Semântica:

- contador incremental para sinalizar mudanças de roster e forçar refresh em telas dependentes.

Publicadores principais:

- `src/svelte/features/roster/RosterPage.svelte`
- `src/svelte/features/wizard/WizardPage.svelte`
- `src/svelte/features/weekly/WeeklyPage.svelte`
- `src/svelte/components/RosterSwitcher.svelte`

Assinantes principais:

- `src/svelte/features/weekly/WeeklyPage.svelte`
- `src/svelte/features/roster/RosterPage.svelte`
- `src/svelte/features/friends/FriendsPage.svelte`
- `src/svelte/components/RosterSwitcher.svelte`

## 2.3 Store: visibleRostersChangeVersion

Fonte:

- `src/svelte/stores/rosterSync.ts`

Semântica:

- contador incremental para sinalizar mudanças na lista de rosters visíveis no Weekly.

Publicadores principais:

- `src/svelte/components/RosterSwitcher.svelte`

Assinantes principais:

- `src/svelte/features/weekly/WeeklyPage.svelte`

## 2.4 DOM Event: settingsChanged

Evento:

- `document.dispatchEvent(new CustomEvent('settingsChanged', { detail: { settings } }))`

Publicadores identificados:

- `src/svelte/features/settings/SettingsPage.svelte`
- `src/svelte/features/wizard/WizardPage.svelte`
- `src/svelte/components/RosterSwitcher.svelte`

Assinantes identificados:

- `src/svelte/features/weekly/WeeklyPage.svelte`

Observação:

- Hoje há comunicação mista (stores + evento de DOM).
- Nas próximas fases, vale consolidar em uma estratégia única para previsibilidade.

## 3) Entregáveis concluídos na Fase 0

- Pasta criada: `src/svelte/domain/`
- Pasta criada: `src/svelte/services/`
- Documento de baseline criado: este arquivo

## 4) Critério de pronto da Fase 0 (check)

- Estrutura de pastas definida: OK
- Contratos internos documentados: OK
- Eventos globais mapeados: OK
- Mudança de comportamento no app: nenhuma
