# Handoff

Read this first, then `PROGRESS.md`, then the selected file in `docs/issues/`.

_Last updated: 2026-07-12 (experimental Phase 1 baseline created)_

## Current state

Phase 0 is complete and verified. The repository contains the Next.js shell and pure domain
core only. All product issues I001-I019 are open; no Phase 1+ product implementation exists.

The code/scaffold baseline is source commit `7eb39bd`. Authoritative product specifications
are local at `docs/DOMAIN.md` and `docs/PRD.md`.

## Next work

I001 and I002 are the first unblocked product issues. Use `.agents/skills/do-next-issue/` or
the Claude `/do-next-issue` command to select work, inspect the branch/status, and create an
issue-scoped branch.

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
