# Handoff

Read this first, then `PROGRESS.md`, then the selected file in `docs/issues/`.

_Last updated: 2026-07-13 (I006 implementation handoff)_

## Current state

Phase 0, I001, I002, I003, I004, I005, and I019 are complete and verified by review. I006
has been implemented with local verification passing (`pnpm test`, `pnpm typecheck`,
`pnpm build`, and the required `countWords|Skip this exercise` source search described
below) and is ready for independent reviewer-Cron validation. Downstream review/results
product issues are still open.

The code/scaffold baseline is source commit `7eb39bd`. The current Hermes skill-test branch
started from `d9386bd`. Authoritative product specifications are local at `docs/DOMAIN.md`
and `docs/PRD.md`.

This repository is currently being used primarily as an experiment harness for improving
agent skills/tools, especially the Hermes Kanban workflow skills. Treat the Reflective
Maturity Profile product backlog as the realistic test subject. Record every observed
skill/tool bug, friction point, or enhancement opportunity in `docs/experiment/` before
handoff.

Hermes workflow state:

- Valid board: `rmp-product-backlog-hermes-test-v2`
- Workflow id: `rmp-product-backlog-hermes-test-v2`
- START task id: `t_bd4b6145`
- Current state: START is complete; I001 `t_6ee254df`, I002 `t_63b0cdfc`, I003
  `t_3d63fb10`, I004 `t_2841b822`, I005 `t_4b7e78fa`, and I019 `t_e8990795`
  passed review; I006 `t_411b4971` has been implemented and should now be reviewed. Old I002 root
  `t_21792a89` and its decomposed children `t_5bee910c`, `t_544bc896`, `t_f1d032e5`,
  `t_1dffbdd9`, and `t_38397722` were permanently deleted after archiving. Fresh I002 task
  `t_63b0cdfc` was recreated from the original I002 body, linked as
  `t_6ee254df -> t_63b0cdfc -> t_e8990795`, then unblocked for a clean rerun.
- Reviewer Cron `d08b91225bf7` has been updated with commit-gated pass instructions and is
  intended to be active for I019 review.
- Reviewer Cron: `rmp-product-backlog-hermes-test-v2-review` (`d08b91225bf7`)
- Apply report: `operator/generated/hermes-kanban-apply-report.json`
- Malformed first board `rmp-product-backlog-hermes-test` was hard-deleted after a bad
  manifest generation attempt.
- Each of the 19 pending work cards has a `WORKFLOW_OBSERVATION_INSTRUCTION` comment requiring
  `workflow_observations` in `WORK_SUBMISSION` and `docs/experiment/` records for observed
  workflow/skill/tool problems or enhancements.
- Each of the 19 pending work cards has a `COMMIT_MESSAGE_CONVENTION` comment requiring commit
  subjects to use `impl(<plan_task_key>/<kanban_task_id>): <summary>` for implementer commits
  and `rev(<plan_task_key>/<kanban_task_id>): <summary>` for reviewer commits.
- The active reviewer Cron prompt was edited in place to require
  `REVIEW_RESULT.workflow_observations`, commit-message convention checks,
  `docs/experiment/` records for observed workflow/skill/tool problems or enhancements, and a
  reviewer commit before any pass completion.
- Reviewer policy forbids modifying implementation files during review, but requires committing
  the exact reviewed state after a pass decision. Reviewer commits use
  `rev(<plan_task_key>/<kanban_task_id>): <summary>` and `REVIEW_RESULT.candidate_commit` must
  contain the resulting hash. If the reviewer cannot commit/push, it must reject or leave the
  task blocked with a workflow finding instead of passing.

Copied skill fixes are present under `.agents/skills/plan-to-hermes-kanban/` for Hermes
profile table parsing, audit status-drift classification, workflow-observation guardrails, and
commit-message convention enforcement. The reviewer prompt generator now makes pass completion
commit-gated so `candidate_commit: null` is only allowed on reject. See
`docs/experiment/records/2026-07-13-hermes-kanban-skill-test.md`.

Installed Hermes source was also patched outside this repo at
`C:\Users\jimzord12\AppData\Local\hermes\hermes-agent`: generic same-cause block loops now
route to triage/decomposition at recurrence 4 and hard-escalate to `blocked` at recurrence 7.
The new config defaults are `kanban.block_loop_decompose_after: 4` and
`kanban.block_loop_escalate_after: 7`; focused Hermes verification passed with
`uv run pytest tests/hermes_cli/test_kanban_block_kinds.py tests/gateway/test_kanban_auto_decompose_live.py`.

## Next work

Review I006 task `t_411b4971`. If it passes, complete it and allow the board to continue to
I007 downstream review-screen work. If it fails, unblock `t_411b4971` with precise reviewer
findings rather than decomposing it.

## Latest I006 implementation notes

- Replaced the I005 narrative placeholders in `src/app/structured-question-flow.tsx` with
  canonical N01/N02 optional exercise screens at visual steps 9 and 16: intro copy,
  sub-question textareas, live word counts, 80% warning messages, concise privacy notice,
  native Back/Continue navigation, and explicit `Skip this exercise` action.
- Added `enforceNarrativeFieldCap` and `shouldShowNarrativeWordWarning` pure helpers that use
  the existing `countWords` helper; over-cap paste/input preserves the previous valid value.
- Updated `src/client/assessment-state.tsx` so explicit skip clears stored fields while field
  edits and Continue record `skipped: false` and preserve intentional partial content.
- Extended `src/app/structured-question-flow.test.ts` and `src/client/assessment-state.test.ts`
  for empty/partial skip, editing after skip, refresh-restored drafts, counter boundaries,
  over-cap paste/input, privacy copy, focus seam markers, and native keyboard-operation markers.
- Added narrative textarea/focus/warning styles in `src/app/globals.css`.
- Experiment record: `docs/experiment/records/2026-07-13-I006-narrative-ui.md`.
- Fresh verification passed: focused red run failed for the missing I006 behavior, focused green
  `pnpm vitest run src/client/assessment-state.test.ts src/app/structured-question-flow.test.ts`
  passed (2 files / 23 tests), full `pnpm test` passed (12 files / 102 tests), `pnpm typecheck`
  passed, `pnpm build` passed, and required Git Bash search `grep -RInE "countWords|Skip this exercise" src || true`
  returned the expected I006 UI/test and domain helper matches.

## Latest I005 implementation notes

- Added `src/app/structured-question-flow.tsx` with the accessible assessment step mapper,
  stable heading focus ids, native radio-group rendering, Back/Continue navigation, guarded
  exit-and-delete action, and narrative insertion placeholders only (narrative fields remain
  out of scope for I005).
- Updated `src/app/page.tsx` to build the score-free public questionnaire payload on the
  server and pass it into the client flow; updated `src/app/landing-consent-flow.tsx` to route
  from consent into the assessment phase without importing the scored questionnaire module into
  the client component.
- Added `src/app/structured-question-flow.test.ts` covering exact 26-step order, narrative
  boundaries after structured ordinals 8 and 14, heading focus seam ids, native radio markup,
  Continue gating, keyboard intent helper behavior, target-size/responsive contract markers,
  score-free rendered/client-state assertions, deletion action, and navigation boundaries.
- Added questionnaire styles in `src/app/globals.css` for 760px shell width, 44px controls,
  visible focus, selected radio state, subdued but operable not-applicable option, 320px layout,
  and reduced-motion handling.
- Experiment record: `docs/experiment/records/2026-07-13-I005-structured-question-flow.md`.
- Fresh verification passed: focused `pnpm vitest run src/app/structured-question-flow.test.ts
  src/app/landing-consent-flow.test.ts` (2 files / 17 tests), full `pnpm test` (12 files / 95
  tests), `pnpm typecheck`, `pnpm build`, required score source search equivalent
  `grep -RInE '"score"|score:' src || true` (expected existing domain/API/test matches), and
  focused client/render path search `grep -RInE '"score"|score:' src/app/structured-question-flow.tsx
  src/client/assessment-state.tsx || true` (no output).

## Latest I004 implementation notes

- Added `src/app/landing-consent-flow.tsx` and wired `src/app/page.tsx` to render the
  landing/consent flow through the I003 `AssessmentProvider`.
- Landing copy now includes product explanation, 12–18 minute estimate, non-clinical
  disclaimer, honest privacy summary, planned `/privacy` link, start action, and native
  expandable `How scoring works` details.
- Consent flow uses required `isAdult` and `nonClinicalAcknowledged` acknowledgements,
  optional `aiConsent` and `includeAgeMetaphor` choices defaulting off, PRD AI disclosure,
  age-metaphor explanation, native keyboard-operable inputs/buttons, and a disabled Continue
  button until both required acknowledgements are true.
- Aligned I003 session-state consent field names to I004 (`isAdult`, `aiConsent`) and added
  rendered tests in `src/app/landing-consent-flow.test.ts` for gating, defaults,
  persistence shape, disclosures, keyboard-operable native controls, prohibited claims, and
  pressure-copy absence.
- Added `KNOWLEDGE.md` record + `src/quirks.test.ts` detector for the Vitest `.test.ts`
  collection quirk discovered when an initial `.test.tsx` file was ignored.
- Experiment record: `docs/experiment/records/2026-07-13-I004-landing-consent.md`.
- Fresh verification passed: focused `pnpm vitest run src/app/landing-consent-flow.test.ts
  src/client/assessment-state.test.ts` (2 files / 13 tests), `pnpm knowledge:size`, full
  `pnpm test` (11 files / 85 tests), `pnpm typecheck`, `pnpm build`, source prohibited-claim
  search, and source `localStorage` search.

## Latest I003 implementation notes

- Added `src/client/assessment-state.tsx` with the PRD §18 `AssessmentState`, reducer,
  React provider/hook, session-storage serialization/deserialization helpers, debounced
  persistence, version-mismatch scoring guard with `discard` and `export_raw_local_draft`
  recovery actions, and a public-questionnaire client cache backed by injected fetch/storage.
- Added `src/client/assessment-state.test.ts` covering refresh restoration, storage boundary
  behavior, version mismatch blocking/recovery actions, debounced writes, and cached/offline
  public questionnaire navigation data.
- Experiment record: `docs/experiment/records/2026-07-13-I003-client-state-persistence.md`.
- Fresh verification passed: focused `pnpm vitest run src/client/assessment-state.test.ts`
  (1 file / 6 tests), full `pnpm test` (10 files / 77 tests), `pnpm typecheck`, `pnpm build`,
  and Git Bash source search for `localStorage` (no matches in `src`).

## Latest I019 implementation notes

- Added `.github/workflows/ci.yml` for push and pull request events with one Ubuntu quality
  job, read-only contents permission, `AI_PROVIDER=none`, checkout, pnpm setup, Node 22
  setup-node pnpm cache keyed on `pnpm-lock.yaml`, frozen install, typecheck, test, and build
  as visible ordered steps.
- Added `src/ci-workflow.test.ts` as a static Vitest workflow-contract test for triggers, one
  job, pinned action majors, package-manager single source of truth, setup-node cache, ordered
  mandatory commands, no `continue-on-error` on core steps, and no `secrets.` references.
- Experiment record: `docs/experiment/records/2026-07-13-I019-ci-quality-gates.md`.
- Fresh verification passed: focused `pnpm vitest run src/ci-workflow.test.ts` (1 file / 6
  tests), full `pnpm test` (9 files / 71 tests), `pnpm typecheck`, `pnpm build`, and `grep
  -nE "AI_PROVIDER|secrets\." .github/workflows/ci.yml` (only `AI_PROVIDER: none` matched).

## Latest I002 clean rerun notes

- Added `src/app/api/v1/assessments/score/score-service.ts` with shared Zod request,
  success, and typed-error schemas plus the framework-light deterministic processing seam.
- Added `src/app/api/v1/assessments/score/route.ts` for `POST /api/v1/assessments/score`,
  requiring `application/json`, enforcing a 16 KiB UTF-8 byte limit, mapping malformed JSON,
  invalid shape, oversized bodies, unknown IDs, duplicates, and version mismatch to typed
  errors, and returning UUID assessment/request IDs.
- Added direct seam tests and HTTP route tests in `score-service.test.ts` and `route.test.ts`.
- Experiment record: `docs/experiment/records/2026-07-13-I002-rerun-score-api.md`.

## Latest I002 rollback notes

- Deleted untracked I002 API implementation directory `src/app/api/v1/assessments/`.
- Corrected `PROGRESS.md` so Phase A is in progress and I002 is not complete.
- Preserved the I002 experiment records because they document workflow/tool defects observed
  during the test run; do not treat them as evidence that product I002 is complete.
- Fresh board task: `t_63b0cdfc` (`I002 - Server-authoritative scoring API`), currently
  `scheduled`.

## Latest I001 implementation notes

- Added `src/app/api/v1/questionnaire/route.ts` with a Zod response schema, static cache
  header, and response construction from `getPublicQuestionnaire()` plus the scoring version.
- Added `src/app/api/v1/questionnaire/route.test.ts` contract tests for schema validation,
  cache header, 26-step canonical ordering, narrative field caps, and absence of `score`.
- Verification passed: `pnpm test` (6 files, 52 tests), `pnpm typecheck`, `pnpm build`, and
  `grep -n "getPublicQuestionnaire" src/app/api/v1/questionnaire/route.ts`.
- Experiment record: `docs/experiment/records/2026-07-13-I001-hermes-public-questionnaire-api.md`.

## Experiment protocol

Before implementing an issue, create a record using the template in
`docs/experiment/EXPERIMENT-LOG.md`. Product status and experiment conclusions are separate:
update `PROGRESS.md` only from repository evidence and passing verification.

Do not invoke the `auditing-project-rules` / repo-rules audit skill in this repository. Use
`AGENTS.md`, this handoff, `PROGRESS.md`, and the relevant issue file directly.

## Baseline warnings

- Never expose questionnaire score maps to the client.
- Do not assume option C has the highest score; derive extrema from the canonical bank.
- Keep `src/domain/` pure: no framework, network, provider, I/O, or time dependencies.
- `next build` may reconcile `tsconfig.json`; treat that as a known toolchain behavior.
- Do not open a pull request unless explicitly requested.
- The deleted board name `rmp-product-backlog-hermes-test` is invalid for further work; use
  `rmp-product-backlog-hermes-test-v2`.
- Do not rerun `plan-to-hermes-kanban` apply against the existing v2 board without first
  deciding whether to preserve the historical manifest or recreate the board. The copied skill
  now requires workflow-observation and commit-message convention text in work-card bodies,
  while the already-created v2 cards carry those instructions as comments because active Hermes
  card bodies are not editable.
- Do not assume Hermes workers or Cron reviewers load `AGENTS.md`. Cross-cutting workflow rules
  such as commit-message convention and workflow-observation reporting must be embedded in the
  worker card body/comment prompt surface and in the generated reviewer Cron prompt.
- The installed Hermes block-loop behavior is locally patched. If Hermes is updated or replaced,
  re-check whether `kanban.block_loop_decompose_after` and `kanban.block_loop_escalate_after`
  still exist before relying on the 4/7 review-loop behavior.

## Verification

```bash
pnpm test
pnpm typecheck
pnpm build
```
