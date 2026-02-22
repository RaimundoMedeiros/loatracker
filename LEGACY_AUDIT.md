# Legacy Audit — Fase 5

Data: 2026-02-22

## Objetivo

Auditar dependências em `src/svelte/legacy/*` e remover código órfão com segurança.

## Resultado da auditoria

### 1) Dependências legadas de serviços/módulos

- Referências para `legacy/services/*`: **nenhuma referência em código de runtime**.
- Referências para `legacy/modules/*`: **nenhuma referência em código de runtime**.
- Referências para `legacy/utils/*`: **nenhuma referência em código de runtime**.

Arquivos legados sem referências de import (candidatos a remoção segura em lote):

- `src/svelte/legacy/modules/dailyStorage.js`
- `src/svelte/legacy/modules/weeklyTracker.js`
- `src/svelte/legacy/modules/stateManager.js`
- `src/svelte/legacy/modules/rosterManager.js`
- `src/svelte/legacy/modules/MultiRosterManager.js`
- `src/svelte/legacy/utils/validator.js`
- `src/svelte/legacy/utils/uiHelper.js`
- `src/svelte/legacy/utils/ModalHelper.js`
- `src/svelte/legacy/utils/logger.js`
- `src/svelte/legacy/utils/formValidator.js`
- `src/svelte/legacy/utils/errorHandler.js`
- `src/svelte/legacy/utils/dateFormatter.js`

Status: **removidos**.

### 2) Dependências legadas ainda ativas

As referências legadas remanescentes estão concentradas em:

- `legacy/config/constants.js` (constantes compartilhadas e mapeamentos)
- `legacy/components/SupportDonateButton.js` (usado em `App.svelte`)
- `legacy/styles/*` (CSS ainda carregado no bootstrap via `standalone-main.ts`)

Essas dependências ainda são válidas no estado atual e não foram removidas para evitar alteração visual/comportamental.

## Limpeza aplicada

Arquivos removidos (órfãos):

- `src/svelte/legacy/services/ApiService.js`
- `src/svelte/legacy/services/FriendsRosterService.js`

Motivo:

- `ApiService.js` foi substituído por `src/svelte/services/BibleApiService.ts`.
- `FriendsRosterService.js` legado não possui uso em runtime após as migrações.

## Verificação

- Typecheck após limpeza: **OK** (`npm run typecheck`).

## Próximos passos possíveis

1. Extrair constantes necessárias de `legacy/config/constants.js` para um módulo moderno dedicado.
2. Avaliar redução progressiva de `legacy/styles/*` mantendo equivalência visual.
