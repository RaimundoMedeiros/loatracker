# Guardian Bosses Update Plan

## Objetivo
Atualizar o rastreamento diário de Guardian Raids para os novos bosses:

- `Gargadeth`
- `Lumencaligo`

## Escopo
1. Atualizar a lista de bosses usada na leitura do `encounters.db`.
2. Alinhar as constantes de UI para manter consistência entre camadas.
3. Validar build/lint/test para garantir que o fluxo diário segue estável.

## Arquivos impactados
1. `src/db-worker.ts`
2. `src/svelte/legacy/config/constants.js`

## Estratégia técnica
1. Trocar `GUARDIAN_BOSSES` em `db-worker.ts` para refletir os dois nomes novos.
2. Trocar `GUARDIAN_BOSSES` em `constants.js` para a mesma lista.
3. Não alterar a lógica de consulta (`IN (...)`, reset diário, ordenação, retorno) para manter comportamento atual.

## Critérios de aceite
1. `getDailyGuardianRaids` retorna acerto quando o `current_boss` for `Gargadeth` ou `Lumencaligo`.
2. Não há regressão de lint, testes e build.
3. Branch pronta para PR com escopo claro e pequeno.

## Entrega
- Branch: `chore/update-guardian-bosses`
- PR de `chore/update-guardian-bosses` para `main`
