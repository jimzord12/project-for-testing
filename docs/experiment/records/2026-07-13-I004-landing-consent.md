# I004 landing, consent, and optional choices via Hermes Kanban

- Date/time and timezone: 2026-07-13 02:55 GTBDT
- Tool and version: Hermes Kanban worker via Codex CLI agent
- Model and reasoning/effort setting: gpt-5.5, default session reasoning
- Issue and branch: I004 on `01-hermes-kanban-test`
- Starting commit: `87644f5`
- Ending commit: uncommitted working tree for reviewer handoff

## Hypothesis

A Hermes implementation worker can add the first rendered client flow slice on top of the I003 session-state provider while preserving the privacy, eligibility, and non-clinical copy constraints.

## Expected behavior

The worker should add landing and consent screens, persist the two required acknowledgements and two optional preferences in session state, keep AI and age-metaphor choices default off, prevent assessment entry until required acknowledgements are true, and verify the full project gate.

## Prompt and workflow

Task `t_2841b822` requested I004 implementation from `docs/issues/I004-landing-consent.md`, DOMAIN §§2 and 15.3, and PRD §§5, 7.1, 7.2, and 10. The implementation added a client component for the entry/consent flow, rendered tests using React server rendering, and aligned the I003 consent-state field names with I004 (`isAdult`, `aiConsent`).

## Observations

- The existing Windows/Git Bash pnpm PATH workaround was still needed for reliable pnpm execution: `export PATH="/c/Users/jimzord12/AppData/Local/pnpm:$PATH"`.
- `vitest.config.ts` currently collects `src/**/*.test.ts` only. An initial `.test.tsx` render test was ignored with "No test files found", so the rendered component tests were kept in `.test.ts` using `React.createElement`. This quirk was recorded in `KNOWLEDGE.md` with a detector in `src/quirks.test.ts`.

## Verification evidence

- RED check: `pnpm vitest run src/app/landing-consent-flow.test.ts` failed before implementation because `./landing-consent-flow` did not exist.
- Focused tests passed after implementation: `pnpm vitest run src/app/landing-consent-flow.test.ts src/client/assessment-state.test.ts` reported 2 files / 13 tests.
- Knowledge size check passed after adding the Vitest collection quirk: `pnpm knowledge:size` reported `KNOWLEDGE.md: 5 KB (5587 bytes) — threshold 150 KB`.
- Full gate passed: `pnpm test` reported 11 files / 85 tests; `pnpm typecheck` ran
  `tsc --noEmit`; `pnpm build` completed a Next.js 16.2.6 production build.
- Git Bash equivalents of the requested source checks passed with no output after the test
  assertions were written without the literal prohibited strings:
  `grep -R -n --include='*.ts' --include='*.tsx' -E 'date of birth|DOB|scoring happens entirely on-device|never sent to a server' src`
  and `grep -R -n --include='*.ts' --include='*.tsx' 'localStorage' src`.

## Classification

Environment problem

## Proposed tool improvement

For this repo, agents should avoid `.test.tsx` until the Vitest include pattern is changed, or they should update the test config deliberately before adding TSX test files. The repo knowledge detector now catches when this quirk becomes stale.

## Follow-up experiment

Have the reviewer Cron independently inspect that the rendered copy does not include prohibited privacy claims or pressure language, and verify that no `localStorage` or exact-date-of-birth strings were added under `src`.
