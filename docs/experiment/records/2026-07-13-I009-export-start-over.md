# I009 local export and start over

- Date/time and timezone: 2026-07-13 04:29 GTBDT
- Tool and version: Hermes Kanban worker via Codex CLI agent
- Model and reasoning/effort setting: gpt-5.5 (OpenAI Codex provider), default worker settings
- Issue and branch: I009 / `01-hermes-kanban-test`
- Starting commit: `5706393`
- Ending commit: uncommitted implementation diff for review

## Hypothesis

A Hermes Kanban worker can add browser-only result export and synchronous start-over behavior on top of the I008 deterministic results screen without adding a server export path or exposing raw narrative drafts.

## Expected behavior

The worker should read the I009 issue, PRD export/start-over/privacy/security requirements, and the I008 result/state seams; add failing tests first; implement local JSON and printable HTML generation, export controls, metadata-only hook events, and synchronous deletion; then update status docs and run the required gates before reviewer-Cron validation.

## Prompt and workflow

Task `t_5c130c65` requested I009. The worker loaded Hermes Kanban and TDD guidance, read the issue/spec/current source files, added failing I009 tests to `src/app/structured-question-flow.test.ts`, implemented export helpers and result-screen controls in `src/app/structured-question-flow.tsx`, and hardened `src/client/assessment-state.tsx` so start-over cancels pending debounced writes before removing the session-storage key.

## Observations

- Browser-only export fit cleanly as pure serialization helpers plus a DOM download seam: JSON and printable HTML are generated from deterministic result state and optional AI-analysis state without accepting raw narrative drafts.
- The printable HTML generator explicitly escapes every supplied AI/model string and includes print CSS that removes backgrounds/shadows while preserving text equivalents for dimensions.
- Start-over needed a small persistence fix: removing the session-storage key synchronously was not enough while a pending debounced writer could later flush a stale draft. The provider now cancels pending writes and suppresses the immediate reset write during discard.
- WORKFLOW_OBSERVATION: The active shell PATH pointed first at a stale FNM/Corepack multishell (`/c/Users/jimzord12/AppData/Local/fnm_multishells/.../pnpm`) whose shim resolved to `C:\c\Users\...\corepack\dist\pnpm.js` and failed with `MODULE_NOT_FOUND`. Prepending `/c/Users/jimzord12/AppData/Local/pnpm` fixed verification commands for this run.

## Verification evidence

- Focused red run: `pnpm vitest run src/app/structured-question-flow.test.ts` failed with missing I009 exports (`buildResultExportPayload is not a function`), missing export controls, and missing `Start over` action.
- Focused green run: `pnpm vitest run src/app/structured-question-flow.test.ts` passed (1 file / 33 tests) after implementation.
- Type gate during implementation: `pnpm typecheck` passed.
- Final full gate: `pnpm test` passed (12 files / 121 tests), `pnpm typecheck` passed, and
  `pnpm build` passed with Next.js 16.2.6; routes `/`, `/_not-found`,
  `/api/v1/assessments/score`, and `/api/v1/questionnaire` generated.
- Required Git Bash equivalent of `Select-String -Path src -Pattern "onExportGenerated|sessionStorage"`:
  `grep -RInE "onExportGenerated|sessionStorage" src || true` returned expected
  `structured-question-flow` hook/test references and `assessment-state` session-storage seams.

## Classification

Environment problem

## Proposed tool improvement

Add or retain a Windows/Git Bash Hermes worker note to prefer the stable pnpm install path (`/c/Users/<user>/AppData/Local/pnpm`) when stale FNM/Corepack multishell shims appear earlier in PATH.

## Follow-up experiment

I011/I013 should reuse the I009 `onExportGenerated(format)` hook and `ExportableAiAnalysis` seam, adding schema-validated completed AI analysis while keeping raw narrative drafts out of default exports.
