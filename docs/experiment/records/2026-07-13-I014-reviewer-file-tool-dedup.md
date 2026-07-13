# I014 reviewer file-tool path and dedup observation

- Date/time and timezone: 2026-07-13 (scheduled reviewer run; local timezone not captured)
- Tool and version: Hermes Agent reviewer Cron; `read_file` / `execute_code`
- Model and reasoning/effort setting: gpt-5.6-sol
- Issue and branch: I014 review, `01-hermes-kanban-test`
- Starting commit: `a915fab768e410137abf90ac857efc15edecb549`
- Ending commit: none; review rejected and implementation remained uncommitted

## Hypothesis

Project-relative `read_file` calls from the configured repository workdir should resolve the same files visible to terminal commands, and an absolute-path retry should return file content after a failed relative read.

## Expected behavior

The reviewer should be able to read `docs/REVIEW-INSTRUCTIONS.md`, `docs/Handoff.md`, and `PROGRESS.md` directly before reviewing, as required by the lifecycle policy.

## Prompt and workflow

The scheduled reviewer ran from `C:/Users/jimzord12/Documents/GitHub/project-for-testing`. A parallel terminal command in that workdir showed all three files, while project-relative `read_file` calls reported `File not found`. Retrying with absolute Windows paths returned an `unchanged` dedup response that referred to the earlier failed read and still supplied no content. The reviewer then used `execute_code` with `hermes_tools.read_file` to retrieve the files.

## Observations

- Relative file resolution did not use the configured project workdir for these calls.
- The read deduplicator treated the absolute retry as already read even though the prior result was an error with empty content.
- The fallback added avoidable calls and could cause a scheduled reviewer to miss mandatory project policy if it trusts the dedup message.

## Verification evidence

- `read_file(path="docs/REVIEW-INSTRUCTIONS.md")` returned `File not found`.
- `read_file(path="C:/Users/jimzord12/Documents/GitHub/project-for-testing/docs/REVIEW-INSTRUCTIONS.md")` then returned `status: unchanged` and no content.
- `execute_code` calling `hermes_tools.read_file` on the same absolute path returned the complete 83-line policy.
- The same behavior affected `docs/Handoff.md` and `PROGRESS.md`.

## Classification

Tool defect

## Proposed tool improvement

Resolve relative file-tool paths against the configured terminal/project workdir, or expose the file tool's actual base directory. Do not cache or deduplicate failed reads as successful content reads; an absolute-path retry after `File not found` must return content.

## Follow-up experiment

Add a regression test that performs a failed relative read followed by a successful absolute read of the same filename and asserts that content is returned rather than suppressed by deduplication.
