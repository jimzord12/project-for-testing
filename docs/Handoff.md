# Handoff

Read this first, then `PROGRESS.md`, then the selected file in `docs/issues/`.

_Last updated: 2026-07-13 (I011 strict response-contract rework)_

## Current state

Phase 0, I001, I002, I003, I004, I005, I006, I007, I008, I009, I010, I011, I012, and I019 are complete locally.
I011 has been implemented with a consent-gated `POST /api/v1/assessments/analyze` route,
strict request/response/provider-output schemas, 32 KiB byte-limit handling, server-side deterministic
recomputation, I012 safety screening before narrative scoreability shortcuts, versioned
`RMP-AI-1.0` prompt construction with untrusted narrative delimiters, application-owned evidence
validation, and `calculateNarrativeScore` score ownership. Local verification is passing (`pnpm
test`, `pnpm typecheck`, `pnpm build`, and the required `RMP-AI-1.0|calculateNarrativeScore|review_fallback`
source scan described below) and it is ready for independent reviewer-Cron validation.

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
  `t_3d63fb10`, I004 `t_2841b822`, I005 `t_4b7e78fa`, I006 `t_411b4971`, I007
  `t_1f2110f1`, I008 `t_0b4cc633`, I009 `t_5c130c65`, and I019 `t_e8990795` have local implementations/review
  status as noted below. Old I002 root
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

Review I011 task `t_98427cb3`. If it passes, complete it and allow the board to continue to
I013/I014 downstream privacy/security work. If it fails, unblock `t_98427cb3` with precise
reviewer findings rather than decomposing it.

## Latest I011 implementation notes

- Added `src/app/api/v1/assessments/analyze/analyze-service.ts` with strict Zod request and
  provider-output contracts, deterministic result recomputation, canonical narrative cap checks,
  explicit `consent.aiAnalysis: true` gating, and finite response states: `completed`,
  `not_scored`, `safety_interruption`, and `unavailable`.
- The processing seam calls the I012 safety classifier on all narrative fields before deciding
  skipped/insufficient narrative states. Safety interrupts and `review_fallback` suppress normal
  maturity analysis while keeping deterministic results in the response.
- Added `buildAnalysisPrompt` for the versioned `RMP-AI-1.0` contract. It sends minimized
  deterministic summaries and answer labels, marks narrative fields as untrusted data, and removes
  `untrusted_narrative` delimiter escapes while preserving ordinary prompt-injection text as data.
- The request schema now accepts only canonical N01/N02 narrative field ids (`event`,
  `selfStory`, `newUnderstanding`, `pattern`, `contexts`, `unknown`) and normalizes missing
  canonical fields to empty strings, so noncanonical client-supplied fields cannot reach safety
  screening, scoreability thresholds, prompts, or evidence validation.
- The provider schema enforces 3-5 observations, 2-3 behavioral experiments, rubric/penalty
  integers 0-2, 7-45 day review periods, no unknown keys, no markdown, and no HTML. Application
  code validates question evidence against submitted answers and narrative excerpts against source
  text with the 24-word cap before returning completed output.
- Added `src/app/api/v1/assessments/analyze/route.ts` with `application/json` enforcement,
  malformed JSON handling, and a 32 KiB UTF-8 byte limit.
- Added `analyze-service.test.ts` and `route.test.ts` covering consent, safety-before-scoreability,
  prompt injection delimiter handling, direct markdown/HTML/schema/evidence/rubric/aggregate
  rejection, provider failure mapping, limited evidence, raw narrative response boundaries,
  content type, malformed JSON, invalid answer sets, oversized bodies, and every HTTP response
  union (`completed`, `not_scored`, `safety_interruption`, `unavailable`).
- Experiment record: `docs/experiment/records/2026-07-13-I011-analyze-api.md`.
- Rework after reviewer rejection added missing route-level tests for `completed`,
  `safety_interruption`, and `unavailable`, plus direct tests for markdown rejection, invalid
  rubric values, and provider-supplied aggregate narrative scores.
- Second rework after reviewer rejection added a regression test proving noncanonical narrative
  field ids are rejected before safety/provider calls and changed the analyze request schema from
  arbitrary `z.record(...)` narrative fields to strict canonical field objects.
- Third rework after reviewer rejection replaced the broad route `analysisResponseSchema` with
  strict deterministic-result, completed-analysis, safety-message, not-scored, and unavailable
  response schemas. The route now parses successful service bodies through the exported strict
  response union before returning JSON, and route tests assert unknown response keys are rejected at
  the top level, inside `deterministicResult`, and inside completed `analysis`.
- Current task `t_971c0b37` tightened the contract layer further by moving the exported strict
  response union and per-variant schemas into `analyze-service.ts`, leaving the route to import the
  shared contract before returning JSON. Route tests now assert the shared service exports parse and
  reject unknown keys for all four response variants.
- Current task `t_6698e7ff` added the final comprehensive I011 test pass with no production-code
  changes: direct helper coverage for `review_fallback` suppressing provider analysis while keeping
  deterministic results, invalid review-period bounds, invalid question evidence IDs, and all typed
  provider transport failure mappings; route coverage now proves missing and false consent short-
  circuit before safety/provider work.
- Fresh verification passed after rework: focused red tests failed for missing `./analyze-service`
  and `./route`; focused green `pnpm vitest run src/app/api/v1/assessments/analyze/route.test.ts
  src/app/api/v1/assessments/analyze/analyze-service.test.ts` passed (2 files / 15 tests), latest
  focused shared-contract rework gate passed (2 files / 16 tests), latest comprehensive-test gate
  passed (2 files / 18 tests), full `pnpm test` passed (16 files / 156 tests), `pnpm typecheck`
  passed, `pnpm build` passed, and
  required Git Bash search `grep -RInE "RMP-AI-1.0|calculateNarrativeScore|review_fallback" src || true`
  returned expected analyze/domain/safety references.

## Latest I012 implementation notes

- Added `src/server/safety-service.ts` with `SafetyDecision` unions for `allow`, categorized
  `interrupt`, and `review_fallback`; `safetyDecisionSuppressesAnalysis`; and
  `toSafetyLogEvent` metadata that excludes narrative text, prompts, and provider output.
- The deterministic rule layer conservatively interrupts credible immediate self-harm, harm to
  others, and active-emergency fixtures before any provider call. Rule-layer interrupts are final
  and non-downgradeable.
- Non-empty narrative content that is not rule-interrupted goes through the I010
  `generateStructuredObject` seam using `SAFETY_CLASSIFIER_OUTPUT_SCHEMA` and a dedicated safety
  prompt that contains no maturity scoring or rubric instruction. Provider disabled/timeout/error/
  invalid-output and schema-invalid success objects resolve to `review_fallback`, never `allow`.
- Added `selectSafetyHelpResources` with international defaults and explicit supported country
  additions (`US`, `CA`, `GB`, `AU`) without inferring location from narrative text.
- Added `src/server/safety-service.test.ts` covering immediate-risk rules, provider invocation,
  ambiguous/provider-failure fallback, ordinary/figurative language, empty narratives, help
  resource selection, logging boundaries, and the I011 analysis-suppression helper.
- Experiment record: `docs/experiment/records/2026-07-13-I012-safety-service.md`.
- Fresh verification passed: focused red `pnpm vitest run src/server/safety-service.test.ts`
  failed for missing `./safety-service`; focused green passed (1 file / 8 tests), full
  `pnpm test` passed (14 files / 138 tests), `pnpm typecheck` passed, `pnpm build` passed, and
  required Git Bash search `grep -RInE "SafetyDecision|review_fallback|interrupt" src/server || true`
  returned expected safety-service implementation/test references.

## Latest I010 implementation notes

- Added dependencies `ai`, `@ai-sdk/anthropic`, and `@ai-sdk/openai`.
- Added `src/server/ai-provider.ts` as the only non-test source module importing provider SDKs
  or reading `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`. It exposes `resolveAiProviderConfig` and
  `generateStructuredObject` with typed result unions for `disabled`, `invalid_configuration`,
  `timeout`, `rate_limited`, `refusal`, `invalid_output`, `provider_failure`, and success.
- Provider selection is call-time/env driven: `AI_PROVIDER=none` disables AI; `anthropic` uses
  `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, and optional `ANTHROPIC_BASE_URL`; `openai` uses
  `OPENAI_API_KEY`, `OPENAI_MODEL`, and optional `OPENAI_BASE_URL`; timeout defaults to 20000ms
  via `AI_ANALYSIS_TIMEOUT_MS`.
- The wrapper calls `generateObject` with `zodSchema(input.schema)`, an abort signal, and
  `maxRetries: 1`; invalid config/result objects intentionally avoid including raw secret values
  or raw provider prose.
- Added `src/server/ai-provider.test.ts` covering disabled mode, invalid config, constructor/call
  arguments for both providers and custom base URLs, Zod schema adapter use, typed timeout/429/
  refusal/invalid-output/provider-failure mapping, retry setting, and a non-test source import
  boundary scan.
- Updated `.env.example` to reflect the now-implemented server-only provider wrapper.
- Experiment record: `docs/experiment/records/2026-07-13-I010-ai-provider-abstraction.md`.
- Fresh verification passed: focused red `pnpm vitest run src/server/ai-provider.test.ts` failed
  for missing `./ai-provider`; focused green passed (1 file / 9 tests); full `pnpm test` passed
  (13 files / 130 tests), `pnpm typecheck` passed, `pnpm build` passed, required Git Bash scan
  `grep -RInE "@ai-sdk|ANTHROPIC_API_KEY|OPENAI_API_KEY" src || true` returned only the mocked
  provider test and `src/server/ai-provider.ts`, and the non-test scan with `--exclude='*.test.ts'`
  returned only `src/server/ai-provider.ts`.

## Latest I009 implementation notes

- Added browser-only export helpers in `src/app/structured-question-flow.tsx`:
  `buildResultExportPayload`, `buildPrintableResultHtml`, local download generation, prompt/
  questionnaire/scoring version identifiers, generated timestamp, disclaimer, confidence
  reasons, AI disabled/unavailable/completed states, and a forward-compatible completed AI
  observation/experiment seam that excludes raw rubric values and raw narrative drafts.
- The printable HTML export is self-contained, escapes every supplied AI/model string, includes
  explicit print CSS that strips decorative backgrounds/shadows, and preserves dimension text
  equivalents.
- `DeterministicResultsScreen` now renders `Download JSON`, `Printable HTML`, and confirmed
  `Start over` controls, plus the metadata-only `onExportGenerated(format)` hook for I013.
- Hardened `src/client/assessment-state.tsx` discard behavior to cancel pending debounced
  session writes and suppress the immediate reset write, so start-over removes
  `rmp.assessment.draft.v1` synchronously and a same-tick assertion remains true even when a
  future ephemeral-token invalidation hook fails.
- Experiment record: `docs/experiment/records/2026-07-13-I009-export-start-over.md`.
- Fresh verification passed: focused red `pnpm vitest run src/app/structured-question-flow.test.ts`
  failed for missing I009 exports/controls/start-over; focused green passed (1 file / 33 tests),
  full `pnpm test` passed (12 files / 121 tests), `pnpm typecheck` passed, `pnpm build`
  passed, and required Git Bash search `grep -RInE "onExportGenerated|sessionStorage" src || true`
  returned expected hook/test and session-storage references.

## Latest I008 implementation notes

- Added deterministic result helpers and `DeterministicResultsScreen` in
  `src/app/structured-question-flow.tsx`: score-request construction from local answer IDs,
  DD-6 dimension band labels, strongest-dimension selection, neutral lower-dimension summaries,
  confidence-reason copy, profile-balance copy, null-index handling, and age-metaphor gating.
- `Submit assessment` now transitions through the existing `submitting` phase, posts
  `POST /api/v1/assessments/score` with questionnaire version, structured answer IDs, and the
  `includeAgeMetaphor` preference, then renders deterministic results immediately from the
  server response. The AI section is a reserved I011 slot and renders `AI analysis unavailable`.
- Result cards duplicate visual bars with text equivalents, include the required non-clinical
  disclaimer, expose reduced-motion/320px/200% layout contract markers, and collapse the
  two-column dimension grid below 640px.
- Added I008 tests in `src/app/structured-question-flow.test.ts` for request construction,
  DD-6 band boundaries, strongest/growth-area helpers, normal result rendering, null-index and
  insufficient-data states, confidence reasons, age-metaphor gating, and a jsdom flow test from
  review submit to deterministic results.
- Experiment record: `docs/experiment/records/2026-07-13-I008-deterministic-results.md`.
- Reviewer-Cron first rejected I008 because the passed I002 score API dependency still existed
  only as untracked files, so an I008 reviewer commit would not be reproducible. Rework
  committed the exact I002 score API baseline as `1460d70` with subject
  `impl(I002/t_63b0cdfc): add score API baseline`, leaving I008 as a clean follow-on diff for
  independent review.
- Fresh verification passed: focused red `pnpm vitest run src/app/structured-question-flow.test.ts`
  failed for missing I008 helpers/components and no score API call; focused green passed (1 file /
  27 tests); full `pnpm test`, `pnpm typecheck`, `pnpm build`, and required Git Bash search
  `grep -RInE "maturity_age_metaphor|maturityAgeMetaphor|AI analysis unavailable" src || true`
  passed.

## Latest I007 implementation notes

- Added score-free review helpers and `ReviewScreen` in `src/app/structured-question-flow.tsx`:
  per-dimension counts distinguish answered, `Not applicable`, completed, and unanswered items;
  narrative statuses derive from explicit skip state plus canonical minimum-word thresholds.
- The review UI renders neutral item IDs/statuses only, never selected option labels, numeric
  results, answer desirability, bands, or interpretation. AI-analysis and age-metaphor choices
  are displayed as read-only enabled/disabled summaries.
- Edit actions cover all 24 structured items and both narrative exercises. Each button carries
  the target step index and target heading id; the flow dispatches `set_current_step_index` before
  returning to the `assessment` phase so the existing I005/I006 heading focus seam moves visible
  focus after mount.
- Review Back returns to the assessment phase. `Submit assessment` changes phase only to
  `submitting`; I008 still owns the score call and result rendering.
- Added review helper/render tests in `src/app/structured-question-flow.test.ts` for counts,
  narrative threshold boundaries, edit targets, score-free rendering, native button semantics,
  and submit affordance. After reviewer rejection, added Vitest jsdom browser-DOM tests that
  click structured and narrative edit controls, assert mounted heading focus via
  `document.activeElement`, verify edit controls do not submit, and verify only
  `Submit assessment` moves to the submitting phase. `jsdom` is now a dev dependency.
- Added review styles in `src/app/globals.css` and routed `review`/`submitting` phases through
  `LandingConsentFlowInner`.
- Experiment record: `docs/experiment/records/2026-07-13-I007-review-screen.md`.
- Fresh verification passed before rework: focused red `pnpm vitest run src/app/structured-question-flow.test.ts`
  failed for missing I007 helpers/components, focused green passed (1 file / 19 tests), full
  `pnpm test` passed (12 files / 107 tests), `pnpm typecheck` passed, `pnpm build` passed, and
  required Git Bash search `grep -RInE "Submit assessment|Not applicable" src || true` returned
  expected review/test/domain/API references. Rework added a jsdom red run for missing browser
  infrastructure and a green focused run passing 21 tests. Final rework verification passed:
  `pnpm test` (12 files / 109 tests), `pnpm typecheck`, `pnpm build`, required Git Bash search,
  and `git diff --check` with only existing CRLF warnings.

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
