# I012 layered safety classification and help resources

- Date/time and timezone: 2026-07-13 04:58 GTBDT
- Tool and version: Hermes Kanban worker via Codex CLI agent
- Model and reasoning/effort setting: gpt-5.5 (OpenAI Codex provider), default worker settings
- Issue and branch: I012 / `01-hermes-kanban-test`
- Starting commit: `22c0d38`
- Ending commit: uncommitted implementation diff for review

## Hypothesis

A Hermes Kanban worker can add the server-only layered safety service on top of the I010 provider seam, keeping immediate-risk rules final, treating provider uncertainty as analysis-suppressing fallback, and avoiding narrative/prompt/model-output data in safety logs.

## Expected behavior

The worker should read I012, DOMAIN §15, PRD §16/§20, and the I010 provider contract; add failing safety-service tests first; implement a dedicated safety prompt/schema module through `generateStructuredObject`; implement help-resource selection from explicit country input only; update status/handoff docs; and run the full phase gate plus the required safety-decision source scan.

## Prompt and workflow

Task `t_d3ffd1d3` requested I012. The worker loaded Hermes Kanban and TDD guidance, read the issue/spec/provider files, wrote failing `src/server/safety-service.test.ts` tests, then implemented `src/server/safety-service.ts` with deterministic immediate-risk rules, provider fallback behavior, help resources, suppression helper, and privacy-safe log-event metadata.

## Observations

- The safety classifier can reuse the I010 `generateStructuredObject` seam directly; the only source provider-SDK imports remain in `src/server/ai-provider.ts`.
- The dedicated safety prompt is intentionally separate from future maturity analysis and contains no maturity scoring/rubric instruction.
- WORKFLOW_OBSERVATION: The edit-time TypeScript hook again reported `TS6053: File '/c/Users/.../src/server/safety-service*.ts' not found` immediately after `write_file`/`patch`, even though the files were created/edited and project `pnpm typecheck` passed. This matches the I010 Windows path-normalization tool defect.
- WORKFLOW_OBSERVATION: The active shell PATH again pointed first at a stale FNM/Corepack pnpm shim and failed with `MODULE_NOT_FOUND` until `/c/Users/jimzord12/AppData/Local/pnpm` was prepended for verification commands.

## Verification evidence

- Focused red run: `pnpm vitest run src/server/safety-service.test.ts` failed because `./safety-service` did not exist.
- Focused green run: `pnpm vitest run src/server/safety-service.test.ts` passed (1 file / 8 tests) after implementation.
- Interim type gate: `pnpm typecheck` passed (`tsc --noEmit`).
- Final full gate: `pnpm test` passed (14 files / 138 tests), `pnpm typecheck` passed, and
  `pnpm build` passed with Next.js 16.2.6; routes `/`, `/_not-found`,
  `/api/v1/assessments/score`, and `/api/v1/questionnaire` generated.
- Required Git Bash equivalent of `Select-String -Path src/server -Pattern "SafetyDecision|review_fallback|interrupt"` returned the expected safety-service implementation and test references.

## Classification

Tool defect

## Proposed tool improvement

Normalize Windows-native edit paths before invoking file-specific TypeScript checks, and prefer the stable pnpm install path before stale FNM/Corepack multishell shims in Windows Git Bash worker sessions.

## Follow-up experiment

I011 should consume `classifyNarrativeSafety`, `safetyDecisionSuppressesAnalysis`, and `selectSafetyHelpResources` in the analyze route so deterministic results remain visible while normal AI maturity analysis is suppressed for `interrupt` and `review_fallback` outcomes.
