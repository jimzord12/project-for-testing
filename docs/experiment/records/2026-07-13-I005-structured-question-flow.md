# I005 accessible structured-question flow

- Date/time and timezone: 2026-07-13 03:07:38 GTBDT
- Tool and version: Hermes Kanban worker using repository tools and Vitest/Next.js verification
- Model and reasoning/effort setting: gpt-5.5 via openai-codex
- Issue and branch: I005 / 01-hermes-kanban-test
- Starting commit: 21a878fff3b6c956b453d1b5d1f119505b3f73cb
- Ending commit: uncommitted implementer diff; reviewer Cron is expected to commit on pass

## Hypothesis

A Hermes Kanban worker can implement the accessible structured-question shell as a bounded vertical slice after I004 while preserving score-free client behavior and adding useful node-environment rendered tests.

## Expected behavior

The worker should render the 24 structured items across the 26-step public questionnaire order, insert placeholders at the two narrative positions without implementing narrative fields, keep numeric scoring data out of rendered markup and client assessment state, and run the required verification gate before handoff.

## Prompt and workflow

The worker followed card `t_4b7e78fa`, read the I005 issue, DOMAIN/PRD sections, I003 state provider, I004 flow, and existing tests. It added a failing rendered/pure test file for the structured flow, implemented the component and page wiring, fixed type issues found by `pnpm typecheck`, then ran the full gate.

## Observations

- The existing public questionnaire API already places `N02` after structured ordinal 14 (`PT04`), which corrected an initial test expectation that accidentally placed it after `PT03`.
- The repository still uses Vitest in node mode and only collects `src/**/*.test.ts`, so rendered component coverage is static server-rendered markup plus pure helper tests rather than true browser focus/keyboard integration.
- No new Hermes tool defect was observed during this task beyond the already-known Windows/Git Bash PATH requirement for pnpm.

## Verification evidence

- Focused red run: `pnpm vitest run src/app/structured-question-flow.test.ts` failed because `./structured-question-flow` did not exist.
- Focused green run: `pnpm vitest run src/app/structured-question-flow.test.ts src/app/landing-consent-flow.test.ts` passed, 2 files / 17 tests.
- Full test gate: `pnpm test` passed, 12 files / 95 tests.
- TypeScript and production build: `pnpm typecheck && pnpm build` passed; Next.js build compiled, type-checked, and generated static pages successfully.
- Required source search equivalent in Git Bash: `grep -RInE '"score"|score:' src || true` produced expected existing score-domain/API/test matches; focused client-render path search `grep -RInE '"score"|score:' src/app/structured-question-flow.tsx src/client/assessment-state.tsx || true` produced no output.

## Classification

Environment problem

## Proposed tool improvement

For Windows Git Bash workers, issue verification commands written as PowerShell (`Select-String`) should be automatically translated or paired with a shell-appropriate equivalent in task bodies.

## Follow-up experiment

When I016 adds accessibility automation, re-check the I005 focus and keyboard contracts in a real browser environment rather than relying only on server-rendered markup and pure helper tests.
