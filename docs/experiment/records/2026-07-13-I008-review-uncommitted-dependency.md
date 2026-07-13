# I008 review blocked by uncommitted dependency baseline

- Date/time and timezone: 2026-07-13 04:11 GTBDT
- Tool and version: Hermes reviewer Cron via Codex CLI agent
- Model and reasoning/effort setting: gpt-5.5 (OpenAI Codex provider), reviewer cron defaults
- Issue and branch: I008 / `01-hermes-kanban-test`
- Reviewed task: `t_0b4cc633`

## Observation

WORKFLOW_OBSERVATION: The reviewer found I008 ready for review on top of a workspace where its required I002 score API dependency (`src/app/api/v1/assessments/`) is still untracked at `HEAD` (`git ls-tree -r --name-only HEAD src/app/api/v1/assessments` returned no files; `git status --short src/app/api/v1/assessments` returned `?? src/app/api/v1/assessments/`). Fresh `pnpm test`, `pnpm typecheck`, and `pnpm build` passed only because those untracked dependency files were present in the dirty workspace.

## Impact

The project review policy requires a reviewer commit before pass and instructs reviewers to stage only the reviewed task files plus required status/experiment docs. Committing only I008 files would create a non-reproducible commit because `src/app/structured-question-flow.tsx` imports the untracked score-service type and posts to the untracked score route. Including the I002 API in an I008 reviewer commit would mix prior-task implementation into the wrong review commit.

## Proposed workflow improvement

Before promoting downstream dependent cards, the Kanban/reviewer loop should verify that completed predecessor implementation files are committed (or otherwise part of the clean baseline). A reviewer should reject or leave blocked when a pass would require bundling uncommitted predecessor work into the current task's reviewer commit.
