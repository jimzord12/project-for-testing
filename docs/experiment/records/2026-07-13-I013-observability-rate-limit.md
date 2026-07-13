# I013 privacy-safe observability and rate limiting

- Date/time and timezone: 2026-07-13 06:50 GTBDT
- Tool and version: Hermes Kanban worker via Codex
- Model and reasoning/effort setting: gpt-5.5, default profile
- Issue and branch: I013 on `01-hermes-kanban-test`
- Starting commit: 281902e / dirty Hermes workflow workspace
- Ending commit: uncommitted implementation diff for `t_457a0817`

## Hypothesis

A single implementer worker can add content-free operational logging and in-memory privacy-preserving rate limits across score, analyze, questionnaire load, and export telemetry while keeping deterministic and AI success response contracts intact.

## Expected behavior

I013 should add typed allowlisted events, final-boundary scrubbing, route producers, metadata-only export telemetry, score/analyze `Retry-After` limits, injected clocks for tests, and project documentation updates. Verification should pass with `pnpm test`, `pnpm typecheck`, `pnpm build`, and the required source scan.

## Prompt and workflow

Hermes Kanban task `t_457a0817` assigned the I013 implementation. The worker read the task, I013 issue file, PRD privacy/security sections, current score/analyze/questionnaire routes, and export UI. It followed a test-first cycle for the new logging and limiter modules, then integrated route/client tests and implementation.

## Observations

- Product implementation succeeded with focused red tests for missing `src/server/logging.ts` and `src/server/rate-limit.ts`, followed by route/client integration tests.
- The shell initially resolved `pnpm` through a stale FNM multishell shim (`Cannot find module ... fnm_multishells ... pnpm.js`). Prepending `C:/Users/jimzord12/AppData/Local/pnpm` to PATH fixed verification commands.
- The patch helper repeatedly failed on `src/app/structured-question-flow.tsx` with a misleading `old_string and new_string are identical` message despite the target text not being present; a small Python replacement script completed the edit.
- Reviewer Cron correctly rejected the first implementation for insufficient route-level event-producer assertions even though the producers existed and the full gate passed. The rework added explicit score rejected, safety interrupted, provider unavailable, and not-scored unavailable event assertions.
- Reviewer Cron rejected the second submission because malformed client metadata and bounded lazy eviction were only covered in `src/server/rate-limit.test.ts`, not through score/analyze route tests. The final rework added explicit route-level malformed-key and eviction tests for both routes and expanded the analyze 429 test to cover reset-after-window behavior.
- During rework, the patch helper again rejected a valid multi-file insertion into route tests with the misleading `old_string and new_string are identical` message; re-reading nearby lines and applying a more targeted patch succeeded.
- A final score-route test run initially failed with HTTP 415 because the score test helper lets `init.headers` replace the default JSON content type; adding explicit `content-type: application/json` to the custom-header requests fixed the route-level client-metadata tests.
- Reviewer Cron rejected the third submission because the I013 questionnaire telemetry test had replaced existing public questionnaire API contract tests. The final rework restored the route-level cache header, canonical ordering/narrative cap, and no-score-exposure tests while keeping the `questionnaire_loaded` event test.
- Follow-up Kanban task `t_82bdc54a` tightened the event module by adding deterministic tests for producer-facing builders on every declared event and full-IP redaction in allowlisted fields before serialized emission.
- Reviewer Cron rejected `t_82bdc54a` after code/tests passed because shared I013 docs mixed logging-child and rate-limit-child state, preventing a clean commit-gated review boundary for one decomposed child at a time. The follow-up clarified child ownership in `docs/Handoff.md`; future decompositions should avoid overlapping required status-doc edits across concurrent children.

## Verification evidence

- `pnpm vitest run src/server/logging.test.ts src/server/rate-limit.test.ts`: red first, failed because `./logging` and `./rate-limit` did not exist.
- Focused green gate: `pnpm vitest run src/server/logging.test.ts src/server/rate-limit.test.ts src/app/api/v1/assessments/score/route.test.ts src/app/api/v1/assessments/analyze/route.test.ts src/app/api/v1/questionnaire/route.test.ts src/app/api/v1/export-event/route.test.ts src/app/structured-question-flow.test.ts` passed (7 files / 70 tests).
- `pnpm test` passed (19 files / 173 tests).
- `pnpm typecheck` passed.
- `pnpm build` passed; dynamic routes include `/api/v1/assessments/analyze`, `/api/v1/assessments/score`, `/api/v1/export-event`, and `/api/v1/questionnaire`.
- `powershell.exe -NoProfile -Command 'Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "emitEvent|RATE_LIMIT_ENABLED|Retry-After"'` returned expected source/test references.
- Rework focused gate: `pnpm vitest run src/app/api/v1/assessments/analyze/route.test.ts src/app/api/v1/assessments/score/route.test.ts` passed (2 files / 24 tests) after an initial assertion fix for timestamp text containing `Z`.
- Rework full gate: `pnpm test` passed (19 files / 176 tests), `pnpm typecheck` passed, `pnpm build` passed, Git Bash `grep -RInE "emitEvent|RATE_LIMIT_ENABLED|Retry-After" src || true` returned expected references, and `git diff --check` exited 0 with only LF-to-CRLF warnings.
- Final route-limit rework focused gate: `pnpm vitest run src/app/api/v1/assessments/analyze/route.test.ts src/app/api/v1/assessments/score/route.test.ts` passed (2 files / 28 tests) after first exposing missing score helper content-type handling with two HTTP 415 failures.
- Final full gate: `pnpm test` passed (19 files / 180 tests), `pnpm typecheck` passed, `pnpm build` passed, Git Bash `grep -RInE "emitEvent|RATE_LIMIT_ENABLED|Retry-After" src || true` and PowerShell `Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "emitEvent|RATE_LIMIT_ENABLED|Retry-After"` returned expected references, and `git diff --check` exited 0 with only LF-to-CRLF warnings.
- Questionnaire-contract rework focused gate: `pnpm vitest run src/app/api/v1/questionnaire/route.test.ts` passed (1 file / 4 tests).
- Questionnaire-contract rework full gate: `pnpm test` passed (19 files / 183 tests), `pnpm typecheck` passed, `pnpm build` passed, Git Bash `grep -RInE "emitEvent|RATE_LIMIT_ENABLED|Retry-After" src || true` and PowerShell `Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "emitEvent|RATE_LIMIT_ENABLED|Retry-After"` returned expected references, and `git diff --check` exited 0 with only LF-to-CRLF warnings.
- Logging producer/full-IP rework focused gate: `pnpm vitest run src/server/logging.test.ts` first failed for missing `operationalEventProducers` and unredacted `203.0.113.42`, then passed (1 file / 8 tests).
- Logging producer/full-IP rework full gate: `pnpm typecheck` passed; `pnpm test` passed (19 files / 185 tests); `pnpm build` passed. After the review-boundary doc clarification, `pnpm vitest run src/server/logging.test.ts`, `pnpm test`, `pnpm typecheck`, `pnpm build`, and `git diff --check` all passed again.

## Classification

Tool defect

## Proposed tool improvement

Keep the existing Hermes Kanban pnpm PATH pitfall prominent for Windows/Git Bash workers and improve the patch tool's diagnostic when it rejects a valid-looking replacement as identical. Preserve the reviewer pattern of enforcing route-level tests for every declared telemetry producer, not just broad helper/schema tests. Also preserve reviewer checks for accidental deletion of pre-existing contract tests when implementation work adds new observability-only tests to an existing route. For auto-decomposed children, either make one integration task own shared status docs or give children non-overlapping doc sections so commit-gated review can stage an exact reviewed state.

## Follow-up experiment

Watch whether reviewer cron can commit and pass an implementation that includes new untracked source/test files plus pre-existing unrelated dirty files without staging unrelated workspace artifacts.
