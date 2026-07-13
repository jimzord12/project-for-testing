# I007 review, edit, and submit screen

- Date/time and timezone: 2026-07-13 03:36:25 GTBDT
- Tool and version: Hermes Kanban worker via Codex CLI agent
- Model and reasoning/effort setting: gpt-5.5 (OpenAI Codex provider), default worker settings
- Issue and branch: I007 / `01-hermes-kanban-test`
- Starting commit: `9b200181354187250bf72b73adc6ac38f31fd968`
- Ending commit: uncommitted implementation diff for review

## Hypothesis

A Hermes Kanban worker can extend the existing I005/I006 client flow with a score-free review screen, edit navigation, and submit-phase transition while preserving the domain privacy and score-hiding rules.

## Expected behavior

The worker should read the I007 issue, DOMAIN/PRD sections, and current flow implementation; add failing tests first; implement the smallest vertical review slice; verify with `pnpm test`, `pnpm typecheck`, `pnpm build`, and the required source search; then hand off for review with structured evidence.

## Prompt and workflow

Task `t_1f2110f1` requested I007. The worker loaded the TDD and Hermes Kanban operations skills, read the issue/spec/current flow files, added failing I007 tests to `src/app/structured-question-flow.test.ts`, implemented review helpers/component/navigation, and ran the full verification gate.

## Observations

- Product implementation fit cleanly into the existing I005/I006 focus seam by dispatching `set_current_step_index` before returning to the `assessment` phase; the already-focused question heading then receives focus on mount.
- Review can remain score-free by rendering only item IDs and neutral statuses (`Answered`, `Not applicable`, `Unanswered`) rather than selected answer labels.
- WORKFLOW_OBSERVATION: The worker shell's default `pnpm` resolved to a stale fnm multishell shim and failed with `Cannot find module 'C:\\c\\Users\\jimzord12\\AppData\\Local\\fnm_multishells\\27084_1783902590424\\node_modules\\corepack\\dist\\pnpm.js'`. Prepending `/c/Users/jimzord12/AppData/Local/pnpm` to PATH restored `pnpm`. This matches the existing reviewer-cron PATH pitfall and should be embedded in worker verification prompts for this Windows/Git Bash setup.
- WORKFLOW_OBSERVATION: The patch tool's automatic TS lint again reported `TS6053: File '/c/Users/.../structured-question-flow.test.ts' not found` while project-native `pnpm typecheck` passed. Treat patch-tool lint output as advisory on this Windows path shape and rely on the repository verification gate.
- Follow-up after reviewer rejection: the task card's static-test wording was insufficient for the issue-file browser-test criterion. The implementation added Vitest jsdom coverage that mounts `StructuredQuestionFlow` in a DOM, clicks structured and narrative edit buttons, asserts the destination heading text, and asserts `document.activeElement` moves to the mounted heading. A second DOM test verifies edit buttons do not submit and only `Submit assessment` moves to the submitting phase.

## Verification evidence

- Focused red run: `pnpm vitest run src/app/structured-question-flow.test.ts` failed with the new I007 helpers/components missing (`buildDimensionReviewCounts is not a function`, `ReviewScreen` undefined).
- Focused green run: `pnpm vitest run src/app/structured-question-flow.test.ts` passed (1 file / 19 tests).
- Full gate: `pnpm test` passed (12 files / 107 tests).
- Type gate: `pnpm typecheck` passed.
- Build gate: `pnpm build` passed with Next.js 16.2.6; routes `/`, `/_not-found`, `/api/v1/assessments/score`, and `/api/v1/questionnaire` generated.
- Required Git Bash equivalent of `Select-String -Path src -Pattern "Submit assessment|Not applicable"`: `grep -RInE "Submit assessment|Not applicable" src || true` returned expected review, test, domain, and score-service references.
- Reviewer-rework red run: after adding `// @vitest-environment jsdom`, `pnpm vitest run src/app/structured-question-flow.test.ts` failed because `jsdom` was not installed.
- Reviewer-rework green run: after `pnpm add -D jsdom`, the focused test passed (1 file / 21 tests) with browser DOM edit/focus and submit coverage.
- Final rework gate: `pnpm test` passed (12 files / 109 tests), `pnpm typecheck` passed, `pnpm build` passed, the required `grep -RInE "Submit assessment|Not applicable" src || true` source search returned expected references, and `git diff --check` reported no whitespace errors beyond existing CRLF conversion warnings.

## Classification

Environment problem

## Proposed tool improvement

For Windows/Git Bash Kanban workers in this repo, bootstrap verification commands with `export PATH="/c/Users/jimzord12/AppData/Local/pnpm:$PATH"` before invoking `pnpm`, and document that patch-tool TS lint may false-fail on MSYS-converted `/c/...` paths.

## Follow-up experiment

I008 should verify that the submit phase can call the server score endpoint without exposing selected option labels or client-side score maps, and should include a real flow test from review submit into deterministic results.
