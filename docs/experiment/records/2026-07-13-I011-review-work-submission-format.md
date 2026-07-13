# I011 review WORK_SUBMISSION format observation

- Date/time and timezone: 2026-07-13, local Hermes reviewer cron session
- Tool and version: Hermes Agent reviewer cron in Windows Git Bash
- Issue/task: I011 task `t_6698e7ff`

## Observation

The implementation evidence and fresh verification for `t_6698e7ff` passed, but the worker's `WORK_SUBMISSION` did not include an explicit `workflow_observations` field even though the board/task review policy requires that field and treats omission as a reject condition.

## Classification

Workflow / prompt-contract defect

## Proposed improvement

Make the worker prompt/template require a machine-checkable `workflow_observations: []` field in every `WORK_SUBMISSION`, even when the worker has no observations, so reviewer crons do not have to reject otherwise-correct product work for a submission-shape mismatch.
