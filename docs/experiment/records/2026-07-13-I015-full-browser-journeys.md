# I015 full browser journeys

- Date/time and timezone: 2026-07-13, local
- Tool and version: Hermes Agent / Playwright 1.61.1
- Model and reasoning/effort setting: GPT-5.6, high
- Issue and branch: I015 / 01-hermes-kanban-test
- Starting commit: 2682c2e
- Ending provenance: reviewer candidate commit recorded in Kanban task `t_e04174ed` `REVIEW_RESULT` metadata

## Hypothesis

Real browser journeys would expose boundary defects not visible in rendered/unit tests while remaining deterministic through an explicitly guarded provider.

## Expected behavior

Thirteen journeys pass in parallel and single-worker modes through real score/analyze routes, with no page errors, hydration warnings, unexpected console output, or external hosts.

## Prompt and workflow

Implemented Playwright configuration and helpers, a request-scoped deterministic provider with trace capture, AI results UI integration, and the thirteen I015 journeys. Ran focused failures, then full gates.

## Observations

- The refresh journey immediately found a real hydration mismatch: server rendering began from landing while client rendering synchronously loaded session state. Assessment hydration now starts from the same initial state and restores storage after mount.
- The file search tool repeatedly translated valid Windows paths to a missing MSYS path. Work continued with direct reads. This is workflow friction worth fixing.
- A first pnpm invocation used a broken fnm/corepack shim; prepending `C:/Users/jimzord12/AppData/Local/pnpm` restored the pinned package manager.
- Playwright's separate `page.request` context intermittently timed out against the freshly compiled local trace route even after the browser journey completed. Reading traces with same-page `fetch` removed the extra network context and passed in both parallel and serial runs.

## Verification evidence

- Playwright parallel: 13/13 passed with 8 workers after review rework.
- Playwright single-worker: 13/13 passed after review rework.
- Focused client/UI tests: 43/43 passed after hydration fix.
- Full phase gates recorded in the task submission.

## Classification

Tool defect

## Proposed tool improvement

Normalize Windows paths consistently in `search_files`, preserve the working pnpm PATH inherited by dispatcher workers, and prefer same-page fetches for request-scoped browser trace probes.

## Follow-up experiment

Re-run the same suite in CI after I015 review to confirm the Windows-local findings are not environment-specific.
