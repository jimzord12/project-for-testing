# AI Development Tool Experiment Log

This is the append-only index for experiments performed against the Reflective Maturity Profile
implementation backlog. Product delivery status remains in `PROGRESS.md`.

## Classification vocabulary

- **Product specification issue:** DOMAIN/PRD ambiguity or contradiction.
- **Decomposition issue:** issue scope, dependency, or acceptance criteria prevented a clean slice.
- **Tool defect:** orchestration, context, file, Git, verification, or handoff behavior failed.
- **Model limitation:** the tool operated correctly but the model could not execute reliably.
- **Environment problem:** dependency, platform, credential, network, or runtime prevented work.
- **Inconclusive:** evidence cannot distinguish the cause; define a follow-up experiment.

## Required workflow

1. Create one record in `docs/experiment/records/YYYY-MM-DD-<issue>-<tool>-<slug>.md` before
   implementation.
2. Record the exact starting commit and keep the issue on its own branch.
3. Preserve prompts, tool/version information, expected behavior, and verification output.
4. Classify observations only after checking repository evidence.
5. Add the record to the index below. Do not rewrite old conclusions; append a correction or
   follow-up record.

## Record template

```markdown
# <Experiment title>

- Date/time and timezone:
- Tool and version:
- Model and reasoning/effort setting:
- Issue and branch:
- Starting commit:
- Ending commit:

## Hypothesis

## Expected behavior

## Prompt and workflow

## Observations

## Verification evidence

## Classification

Choose one: Product specification issue | Decomposition issue | Tool defect |
Model limitation | Environment problem | Inconclusive

## Proposed tool improvement

## Follow-up experiment
```

## Experiment index

| Date       | Record                                      | Issue | Tool  | Classification |
| ---------- | ------------------------------------------- | ----- | ----- | -------------- |
| 2026-07-12 | Phase 1 experimental baseline setup (setup) | —     | Codex | Not evaluated  |
| 2026-07-13 | [Hermes Kanban workflow skill test](records/2026-07-13-hermes-kanban-skill-test.md) | Hermes workflow | Codex/Hermes | Tool defect |
| 2026-07-13 | [I001 public questionnaire API via Hermes Kanban](records/2026-07-13-I001-hermes-public-questionnaire-api.md) | I001 | Hermes/Codex | Tool defect |
| 2026-07-13 | [I002 server-authoritative score API via Hermes Kanban](records/2026-07-13-I002-hermes-score-api.md) | I002 | Hermes/Codex | Tool defect |
| 2026-07-13 | [I002 reviewer Cron pnpm PATH observation](records/2026-07-13-I002-reviewer-cron-pnpm-path.md) | I002 review | Hermes/Codex | Environment problem |
| 2026-07-13 | [I002 direct score processing test expansion](records/2026-07-13-I002-direct-score-processing-tests.md) | I002 child | Hermes/Codex | Tool defect |
| 2026-07-13 | [I002 decomposed score route child verification](records/2026-07-13-I002-decomposed-score-route-child.md) | I002 child | Hermes/Codex | Tool defect |
| 2026-07-13 | [I002 HTTP route error test expansion](records/2026-07-13-I002-http-route-error-tests.md) | I002 child | Hermes/Codex | Tool defect |
| 2026-07-13 | [I002 Kanban rollback and task recreation](records/2026-07-13-I002-kanban-rollback.md) | I002 rollback | Hermes/Codex | Tool defect |
| 2026-07-13 | [I002 clean rerun score API](records/2026-07-13-I002-rerun-score-api.md) | I002 | Hermes/Codex | Tool defect |
| 2026-07-13 | [I019 reproducible CI quality gates](records/2026-07-13-I019-ci-quality-gates.md) | I019 | Hermes/Codex | Environment problem |
| 2026-07-13 | [I003 client assessment state and session persistence](records/2026-07-13-I003-client-state-persistence.md) | I003 | Hermes/Codex | Environment problem |
| 2026-07-13 | [I004 landing, consent, and optional choices](records/2026-07-13-I004-landing-consent.md) | I004 | Hermes/Codex | Environment problem |
| 2026-07-13 | [I005 accessible structured-question flow](records/2026-07-13-I005-structured-question-flow.md) | I005 | Hermes/Codex | Environment problem |
| 2026-07-13 | [I006 optional narrative exercises](records/2026-07-13-I006-narrative-ui.md) | I006 | Hermes/Codex | Tool defect |
| 2026-07-13 | [I007 review, edit, and submit screen](records/2026-07-13-I007-review-screen.md) | I007 | Hermes/Codex | Environment problem |
| 2026-07-13 | [I007 review-card browser-test acceptance drift](records/2026-07-13-I007-review-card-browser-test-drift.md) | I007 | Hermes/Codex reviewer | Workflow problem |
| 2026-07-13 | [I008 deterministic results screen](records/2026-07-13-I008-deterministic-results.md) | I008 | Hermes/Codex | Environment problem |
| 2026-07-13 | [I008 review blocked by uncommitted dependency baseline](records/2026-07-13-I008-review-uncommitted-dependency.md) | I008 | Hermes/Codex reviewer | Workflow problem |

The baseline setup restored source commit `7eb39bd`, added the local DOMAIN/PRD, installed the
agent workflow, and prepared I001-I019. It is setup provenance, not evidence about a custom tool.
