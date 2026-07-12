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

The baseline setup restored source commit `7eb39bd`, added the local DOMAIN/PRD, installed the
agent workflow, and prepared I001-I019. It is setup provenance, not evidence about a custom tool.
