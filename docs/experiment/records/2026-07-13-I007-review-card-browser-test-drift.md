# I007 review-card browser-test acceptance drift

- Date/time and timezone: 2026-07-13 reviewer Cron run
- Tool and version: Hermes Kanban reviewer via Codex CLI agent
- Model and reasoning/effort setting: gpt-5.5 (OpenAI Codex provider), reviewer Cron settings
- Issue and branch: I007 / `01-hermes-kanban-test`

## Hypothesis

The compiled Hermes task card should preserve issue-file acceptance criteria closely enough that workers implement and test the full project-owned requirements.

## Expected behavior

For I007, the card should carry the `docs/issues/I007-review-screen.md` requirement that edit navigation/focus behavior has browser-level coverage for structured and narrative destinations, or otherwise explicitly explain why the review policy should accept a substitute.

## Observation

WORKFLOW_OBSERVATION: The I007 task card softened the issue-file acceptance criterion from `browser tests cover structured and narrative destinations` to rendered/static tests and pure helper tests. The worker consequently added static `renderToStaticMarkup` assertions for data attributes but no browser/DOM interaction test that clicks edit controls and verifies focus transfer after mount. The reviewer policy requires the issue file as context and pass/reject source, so this mismatch caused a review rejection despite the main `pnpm test`, `pnpm typecheck`, and `pnpm build` gates passing.

## Evidence

- `docs/issues/I007-review-screen.md` acceptance criterion: `Every edit action opens the correct destination and moves visible focus to its heading after mount; browser tests cover structured and narrative destinations.`
- Task card acceptance/deliverables requested rendered tests for counts/status/dispatch targets/focus/keyboard/submission but did not preserve the browser-test wording.
- Repository tooling currently uses Vitest node environment only (`vitest.config.ts` has `environment: "node"`; package dependencies do not include Playwright/jsdom/happy-dom/testing-library).
- Reviewer search found no browser/DOM interaction tooling or focus assertions beyond static `data-edit-step-index` checks.

## Classification

Workflow problem

## Proposed tool improvement

The plan-to-kanban compiler should copy issue-file acceptance criteria verbatim or mark any intentional weakening as an explicit review-policy decision. For UI focus/navigation work, it should also surface missing browser-test infrastructure as a prerequisite rather than letting workers satisfy browser requirements with static markup tests.
