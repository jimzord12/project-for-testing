# Reflective Maturity Profile — AI Development Experiment

This repository is a controlled implementation baseline for evaluating custom AI development
tools. The product is a privacy-first reflective maturity assessment, but the experiment is
about how well AI tools select, implement, verify, and hand off scoped engineering work.

> Reflective Maturity Profile is a self-reflection tool, not a diagnosis or a scientifically
> validated measure of literal psychological age.

## Baseline status

Phase 0 is complete: the Next.js/TypeScript scaffold and pure deterministic domain core are
present and tested. Product implementation begins with I001. No questionnaire API, client
assessment flow, AI provider integration, or delivery layer has been implemented.

The Phase 0 code was restored from source commit `7eb39bd`, immediately before I001 began.
This makes repeated tool experiments comparable from a known starting point.

## Start here

- [`AGENTS.md`](AGENTS.md) — canonical working rules for humans and AI agents.
- [`docs/DOMAIN.md`](docs/DOMAIN.md) — questionnaire, scoring, rubric, and interpretation.
- [`docs/PRD.md`](docs/PRD.md) — product and technical requirements.
- [`PROGRESS.md`](PROGRESS.md) — authoritative delivery state and issue DAG.
- [`docs/Handoff.md`](docs/Handoff.md) — current working context.
- [`docs/issues/`](docs/issues/README.md) — I001-I019 implementation contracts.
- [`docs/experiment/EXPERIMENT-LOG.md`](docs/experiment/EXPERIMENT-LOG.md) — AI-tool
  observations, hypotheses, and follow-ups.

## Phase 0 verification

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build
```

Node 22 or newer and the pinned pnpm version are required. Copy `.env.example` to
`.env.local` when needed; Phase 0 and deterministic scoring require no provider credentials.

## Experimental discipline

- Use one issue-scoped branch per implementation attempt.
- Record the tool, model, prompt/workflow, starting commit, expected behavior, observations,
  and verification evidence.
- Classify failures before changing the tool or issue contract.
- Do not mark product work complete solely because an agent claims success.
- Keep experiment observations separate from `PROGRESS.md` and `docs/Handoff.md`.

The repository is intentionally public-ready: never commit credentials, real user assessment
content, or provider payloads.
