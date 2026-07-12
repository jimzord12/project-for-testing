# Handoff

Read this first, then `PROGRESS.md`, then the selected file in `docs/issues/`.

_Last updated: 2026-07-13 (I001 complete)_

## Current state

Phase 0 is complete and verified. I001 is complete in the working tree and reviewed through
Hermes Kanban. I002 is the next API foundation issue.

The code/scaffold baseline is source commit `7eb39bd`. The current Hermes skill-test branch
started from `d9386bd`. Authoritative product specifications are local at `docs/DOMAIN.md`
and `docs/PRD.md`.

## Latest I001 implementation notes

- Added `src/app/api/v1/questionnaire/route.ts` with a Zod response schema, static cache
  header, and response construction from `getPublicQuestionnaire()` plus the scoring version.
- Added `src/app/api/v1/questionnaire/route.test.ts` contract tests for schema validation,
  cache header, 26-step canonical ordering, narrative field caps, and absence of `score`.
- Verification passed: focused questionnaire route tests, `pnpm test`, `pnpm typecheck`,
  `pnpm build`, and `grep -n "getPublicQuestionnaire" src/app/api/v1/questionnaire/route.ts`.
- Experiment record: `docs/experiment/records/2026-07-13-I001-hermes-public-questionnaire-api.md`.

## Next work

I002 is the next API foundation issue. Use the issue file at `docs/issues/I002-score-api.md`
and keep the server-authoritative scoring boundary intact.

## Experiment protocol

Before implementing an issue, create a record using the template in
`docs/experiment/EXPERIMENT-LOG.md`. Product status and experiment conclusions are separate:
update `PROGRESS.md` only from repository evidence and passing verification.

## Baseline warnings

- Never expose questionnaire score maps to the client.
- Do not assume option C has the highest score; derive extrema from the canonical bank.
- Keep `src/domain/` pure: no framework, network, provider, I/O, or time dependencies.
- `next build` may reconcile `tsconfig.json`; treat that as a known toolchain behavior.
- Do not open a pull request unless explicitly requested.

## Verification

```bash
pnpm test
pnpm typecheck
pnpm build
```
