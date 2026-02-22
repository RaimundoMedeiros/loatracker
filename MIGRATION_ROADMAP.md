# LoaTracker — Roadmap de Migração (Legacy -> Svelte/TypeScript)

Este roadmap organiza a migração do projeto para reduzir dependências de `src/svelte/legacy/*` de forma incremental e segura, mantendo o app funcional durante todo o processo.

## Objetivos da migração

1. Consolidar regras de domínio em TypeScript moderno.
2. Reduzir acoplamento entre páginas Svelte e módulos legados.
3. Padronizar estado e eventos globais.
4. Diminuir risco de regressão em Weekly/Roster/Friends.
5. Facilitar manutenção e onboarding técnico.

## Escopo atual (resumo)

Dependências legadas mais relevantes:

- `src/svelte/legacy/modules/stateManager.js`
- `src/svelte/legacy/modules/rosterManager.js`
- `src/svelte/legacy/modules/weeklyTracker.js`
- `src/svelte/legacy/modules/MultiRosterManager.js`
- `src/svelte/legacy/services/ApiService.js`

Uso principal hoje:

- Friends usa fortemente `StateManager`, `RosterManager` e `WeeklyTracker`.
- Roster e Wizard ainda dependem de `ApiService` legado para fluxos Bible.
- Shell e rotas já estão em Svelte moderno.

## Princípios de execução

- Migrar em fatias pequenas e testáveis.
- Não mudar contrato público sem necessidade.
- Sempre adicionar camadas novas em TS antes de remover legado.
- Evitar “big bang rewrite”.
- Medir pronto por critérios objetivos por fase.

## Fase 0 — Preparação (1 a 2 dias)

Status: **iniciada**

Artefatos já criados:

- `src/svelte/domain/README.md`
- `src/svelte/services/README.md`
- `MIGRATION_PHASE0_BASELINE.md`

**Meta**
- Criar base de trabalho para migração com baixo risco.

**Tarefas**
- Definir pasta de domínio moderno (ex.: `src/svelte/domain/*`).
- Definir pasta de serviços modernos (ex.: `src/svelte/services/*`).
- Criar documento de contratos internos (shape de roster, characterData, friends snapshot).
- Mapear eventos globais atuais (`rosterChangeVersion`, `visibleRostersChangeVersion`, `settingsChanged`).

**Critério de pronto**
- Estrutura de pastas e contratos documentados.
- Sem mudança de comportamento no app.

## Fase 1 — API Bible moderna (2 a 3 dias)

Status: **concluída**

Artefatos já criados:

- `src/svelte/services/BibleApiService.ts`
- `src/svelte/features/wizard/WizardPage.svelte` (migrado para `BibleApiService`)
- `src/svelte/features/roster/RosterPage.svelte` (migrado para `BibleApiService`)

**Meta**
- Substituir `legacy/services/ApiService.js` por serviço TypeScript único.

**Tarefas**
- Criar `src/svelte/services/BibleApiService.ts`.
- Migrar consumo em Roster (`RosterPage.svelte`) e Wizard (`WizardPage.svelte`).
- Manter mesma semântica de retorno para evitar quebra de fluxo.
- Centralizar timeout/retry/normalização de payload.

**Riscos**
- Diferenças de normalização de classe/iLvl/CP.

**Mitigação**
- Reusar funções de normalização existentes (ou extrair para util compartilhado).

**Critério de pronto**
- Nenhuma referência a `legacy/services/ApiService.js` nas páginas Svelte.
- Fluxos de import/refresh continuam funcionando igual.

## Fase 2 — Multi-roster moderno (2 a 4 dias)

Status: **concluída**

Artefatos já criados:

- `src/svelte/services/RosterService.ts`
- `src/svelte/components/RosterSwitcher.svelte` (migrado para `RosterService`)

**Meta**
- Remover dependência direta de `MultiRosterManager.js` do componente de troca de roster.

**Tarefas**
- Criar `src/svelte/services/RosterService.ts` baseado no contrato `window.api`.
- Migrar `components/RosterSwitcher.svelte` para o novo serviço.
- Padronizar persistência de `visibleWeeklyRostersByRoster`.

**Riscos**
- Drift entre estado salvo e estado exibido.

**Mitigação**
- Manter `window.api` como fonte única de verdade; evitar estado duplicado.

**Critério de pronto**
- `RosterSwitcher.svelte` sem import de módulos legados.
- Troca/criação/rename/delete funcionando com mesmo UX.

## Fase 3 — Estado de Friends sem legacy manager (4 a 6 dias)

Status: **concluída**

Artefatos já criados:

- `src/svelte/services/FriendsStateService.ts`
- `src/svelte/features/friends/FriendsPage.svelte` (migrada para `FriendsStateService` + adapters)

**Meta**
- Retirar Friends do trio legado (`StateManager`, `RosterManager`, `WeeklyTracker`).

**Tarefas**
- Criar camada moderna de leitura de estado para Friends:
  - roster ativo
  - roster order
  - characterData
  - hidden raids
  - settings
- Adaptar `FriendsRosterService` para consumir essa nova camada.
- Migrar `FriendsPage.svelte` para fluxo baseado em serviço TS moderno.

**Riscos**
- Mudança em regras de visibilidade/máscaras de raid no snapshot.

**Mitigação**
- Preservar algoritmo de máscara atual e validar com snapshots reais.

**Critério de pronto**
- `FriendsPage.svelte` sem imports de `legacy/modules/*`.
- Upload/refresh/heatmap preservados.

## Fase 4 — Domínio semanal compartilhado (3 a 5 dias)

Status: **concluída**

Artefatos já criados:

- `src/svelte/domain/shared/raidDomain.ts`
- `src/svelte/features/friends/services/FriendsRosterService.ts` (normalização/visibilidade usando domínio compartilhado)
- `src/svelte/services/FriendsStateService.ts` (hidden raid ids e elegibilidade via domínio compartilhado)
- `src/svelte/features/weekly/WeeklyPage.svelte` (normalização de boss/raid via domínio compartilhado)

**Meta**
- Consolidar regras de Weekly e Friends em módulos de domínio TS.

**Tarefas**
- Extrair funções puras de:
  - elegibilidade por raid
  - normalização de IDs/aliases de raid
  - cálculo de máscaras e visibilidade
  - regras de reset
- Reutilizar as mesmas funções em Weekly e Friends.

**Riscos**
- Divergência silenciosa de regra durante extração.

**Mitigação**
- Introduzir testes unitários de funções puras antes de substituir chamadas.

**Critério de pronto**
- Regras críticas centralizadas em TS, sem duplicação principal entre Weekly/Friends.

## Fase 5 — Limpeza final do legado (2 a 3 dias)

Status: **concluída**

Artefatos gerados:

- `LEGACY_AUDIT.md`
- Remoção de serviços legados órfãos:
  - `src/svelte/legacy/services/ApiService.js`
  - `src/svelte/legacy/services/FriendsRosterService.js`

**Meta**
- Remover código legado não utilizado.

**Tarefas**
- Auditar imports restantes de `src/svelte/legacy/*`.
- Deletar arquivos órfãos e atualizar documentação.
- Revisar CSS legado para remover estilos não usados (sem alterar visual).

**Critério de pronto**
- Sem imports de módulos legados em páginas/componentes Svelte modernos.
- Documentação atualizada.

## Sequência de execução recomendada

1. Fase 0
2. Fase 1
3. Fase 2
4. Fase 3
5. Fase 4
6. Fase 5

Ordem prioriza primeiro baixo risco e ganho rápido (API Bible), depois pontos com mais acoplamento (Friends).

## Checkpoint por PR

Para cada PR de migração:

- Escopo pequeno (1 feature/subfeature).
- Typecheck passando.
- Sem mudança visual inesperada.
- Sem quebra de fluxos críticos:
  - trocar roster
  - carregar/importar dados
  - atualizar weekly
  - sync de friends

## Métricas simples de progresso

- Número de imports de `src/svelte/legacy/*` em arquivos Svelte/TS modernos.
- Número de páginas sem dependência legada direta.
- % de domínio crítico migrado para TS (Roster/Weekly/Friends).

## Backlog técnico opcional (após migração)

- Introduzir testes unitários para domínio (`rosterDomain`, máscaras de raid, resets).
- Avaliar unificação de eventos globais em stores Svelte mais explícitas.
- Revisar nomes e fronteiras de serviços para facilitar manutenção futura.

## Definição de “migração concluída”

A migração será considerada concluída quando:

1. Features Svelte não dependerem diretamente de módulos legados.
2. Regras de domínio principais estiverem em TypeScript compartilhado.
3. Friends/Weekly/Roster usarem serviços modernos com contratos claros.
4. O diretório `src/svelte/legacy` puder ser reduzido ao mínimo (ou removido sem impacto funcional).
