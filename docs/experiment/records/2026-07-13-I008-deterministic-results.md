# I008 deterministic results screen

- Date/time and timezone: 2026-07-13 04:10 GTBDT
- Tool and version: Hermes Kanban worker via Codex CLI agent
- Model and reasoning/effort setting: gpt-5.5 (OpenAI Codex provider), default worker settings
- Issue and branch: I008 / `01-hermes-kanban-test`
- Starting commit: `3b4ab919438b5c3f05dc08335b013f687cf5855d`
- Ending commit: uncommitted implementation diff for review

## Hypothesis

A Hermes Kanban worker can connect the I007 submit phase to the I002 score API and render deterministic results immediately, without waiting for or implementing the optional AI section.

## Expected behavior

The worker should read the I008 issue, DOMAIN/PRD result requirements, DD-1/DD-6, and current client/API seams; add failing tests first; implement the score request and deterministic result rendering; verify with the required test, typecheck, build, and source-search gates; then hand off for reviewer-Cron validation.

## Prompt and workflow

Task `t_0b4cc633` requested I008. The worker loaded Hermes Kanban and TDD guidance, read the relevant issue/spec/current source files, added failing I008 helper/render/integration tests to `src/app/structured-question-flow.test.ts`, implemented the result helpers, result screen, score submission effect, and result styles, then ran focused and full verification.

## Observations

- I008 fit cleanly on top of the I007 `submitting` phase: `Submit assessment` now posts answer identifiers and the age-metaphor preference to `/api/v1/assessments/score`, then renders deterministic results from the server response.
- The result UI follows DD-6 labels (`Emerging`, `Developing`, `Established`, `Proficient`, `Integrated`) rather than the older DOMAIN §12.1 wording, because the task explicitly named DD-6 as the latest authority.
- The browser result slot intentionally always renders `AI analysis unavailable` plus a reserved `data-ai-analysis-slot` for I011. No AI request path was added.
- WORKFLOW_OBSERVATION: The patch tool's automatic TypeScript lint again reported a Windows/MSYS path-shaped `TS6053` for `src/app/structured-question-flow.test.ts`, while native repository verification (`pnpm typecheck`) passed. This repeats the known patch-tool false-positive and should remain an advisory warning for this repo.

## Verification evidence

- Focused red run: `pnpm vitest run src/app/structured-question-flow.test.ts` failed with missing I008 exports/components (`buildScoreRequestFromState is not a function`, `getDimensionBandLabel is not a function`, `DeterministicResultsScreen` undefined) and no score API call after submit.
- Focused green run: `pnpm vitest run src/app/structured-question-flow.test.ts` passed (1 file / 27 tests).
- Type gate during implementation: `pnpm typecheck` passed.
- Final full gate: `pnpm test` passed (12 files / 115 tests), `pnpm typecheck` passed, `pnpm build` passed with Next.js 16.2.6; routes `/`, `/_not-found`, `/api/v1/assessments/score`, and `/api/v1/questionnaire` generated.
- Required Git Bash equivalent of `Select-String -Path src -Pattern "maturity_age_metaphor|maturityAgeMetaphor|AI analysis unavailable"`: `grep -RInE "maturity_age_metaphor|maturityAgeMetaphor|AI analysis unavailable" src || true` returned expected score-service/test/result-screen references.
- `git diff --check` exited 0; output contained only existing CRLF conversion warnings.

## Classification

Environment problem

## Proposed tool improvement

Keep the Windows/Git Bash patch-tool lint caveat in worker/reviewer skills: patch-time lint can mis-resolve `/c/Users/...` paths even when project-native `pnpm typecheck` succeeds. Workers should not treat that warning as the authoritative TypeScript gate.

## Follow-up experiment

I009 should verify export/start-over against the new deterministic result screen, including whether result data should be explicitly persisted in session state for refresh recovery or treated as active in-memory result state until export exists.
