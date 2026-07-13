# I006 optional narrative exercises

- Date/time and timezone: 2026-07-13 03:21:58 GTBDT
- Tool and version: Hermes Kanban worker using repository tools and Vitest/Next.js verification
- Model and reasoning/effort setting: gpt-5.5 via openai-codex
- Issue and branch: I006 / 01-hermes-kanban-test
- Starting commit: 008c8343d1c6adbfbf5b79ef2e90ed53c4028534
- Ending commit: uncommitted implementer diff; reviewer Cron is expected to commit on pass

## Hypothesis

A Hermes Kanban worker can replace the I005 narrative placeholders with the canonical optional narrative exercise UI while preserving the existing 26-step flow, session-only draft storage, and score-free client behavior.

## Expected behavior

The worker should render N01 and N02 at visual steps 9 and 16, show canonical sub-question textareas and caps, enforce live word counts through `countWords`, preserve partial drafts on Continue, clear drafts on explicit skip, repeat neutral privacy copy, and pass the full Phase B gate.

## Prompt and workflow

The worker followed card `t_411b4971`, read the I006 issue, DOMAIN §3/§6.3/§8/§20, PRD §7.5/§10.2/§18/§19, I003 state, and I005 structured flow. It added failing reducer/rendered/pure helper tests, implemented the reducer skip-clearing behavior and narrative UI, then ran focused and full verification.

## Observations

- The existing I003 reducer already made field edits set `skipped: false`; I006 only needed to make the explicit skip path clear fields while preserving fields for `skipped: false` Continue.
- Node/server-rendered component tests can assert text, accessibility attributes, and pure cap helpers, but they still cannot prove real browser textarea input/focus behavior. That remains deferred to I016 accessibility/browser automation.
- Workflow/tool observation: after patch edits, the `patch` tool's automatic TypeScript lint sometimes reported false path/config errors such as `File '/c/Users/.../src/app/structured-question-flow.test.ts' not found` or missing JSX/module resolution, while the project-native `pnpm vitest`, `pnpm typecheck`, and `pnpm build` commands passed from the repo root. Treat patch auto-lint output on Windows/Git Bash as advisory and verify with project commands.

## Verification evidence

- Focused red run: `pnpm vitest run src/client/assessment-state.test.ts src/app/structured-question-flow.test.ts` failed with the expected missing behavior: skip did not clear fields, narrative placeholders lacked textareas/privacy/skip copy, and the new cap/warning helpers were not functions.
- Focused green run: `pnpm vitest run src/client/assessment-state.test.ts src/app/structured-question-flow.test.ts` passed, 2 files / 23 tests.
- Full test gate: `pnpm test` passed, 12 files / 102 tests.
- TypeScript and production build: `pnpm typecheck` passed; `pnpm build` passed with Next.js 16.2.6 production build, static `/`, and dynamic `/api/v1/assessments/score` plus `/api/v1/questionnaire` routes.
- Required source search equivalent in Git Bash: `grep -RInE "countWords|Skip this exercise" src || true` found the expected I006 UI/test references and existing domain `countWords` definitions/tests.

## Classification

Tool defect

## Proposed tool improvement

Make the `patch` tool's automatic lint invocation use the repository's configured TypeScript project and Windows/Git Bash path form, or clearly mark these per-file lint failures as non-authoritative when the project-level commands are required.

## Follow-up experiment

When I016 adds accessibility automation, re-check narrative textarea focus, keyboard operation, warning announcement timing, and over-cap paste behavior in a real browser environment rather than relying only on server-rendered markup and pure helper tests.
