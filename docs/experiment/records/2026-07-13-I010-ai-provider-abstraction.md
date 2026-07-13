# I010 provider-agnostic structured generation service

- Date/time and timezone: 2026-07-13 04:47 GTBDT
- Tool and version: Hermes Kanban worker via Codex CLI agent
- Model and reasoning/effort setting: gpt-5.5 (OpenAI Codex provider), default worker settings
- Issue and branch: I010 / `01-hermes-kanban-test`
- Starting commit: `a705afa`
- Ending commit: uncommitted implementation diff for review

## Hypothesis

A Hermes Kanban worker can add the server-only Vercel AI SDK provider seam with disabled-by-default behavior, schema-constrained output, and typed graceful-failure results without introducing any client-side provider import or live provider call in CI.

## Expected behavior

The worker should read the I010 issue, DD-5, and PRD AI/security/environment sections; add failing tests first; install the required SDK packages; implement `src/server/ai-provider.ts` as the only non-test source file importing provider SDKs or reading provider secrets; update environment/status/handoff docs; and run the full phase gate plus the required source scan.

## Prompt and workflow

Task `t_4cf31ada` requested I010. The worker loaded Hermes Kanban and TDD guidance, read the issue/spec/current source files, installed `ai`, `@ai-sdk/anthropic`, and `@ai-sdk/openai`, wrote failing provider-abstraction tests in `src/server/ai-provider.test.ts`, implemented `src/server/ai-provider.ts`, and updated `.env.example` plus product/experiment handoff docs.

## Observations

- The AI SDK v7 package still exposes `generateObject` and `zodSchema`; `generateObject` is marked deprecated in its type declarations in favor of `generateText` output settings, but it is the direct SDK-supported structured generation API for this issue and accepts Zod through `zodSchema`.
- Provider constructors support the required custom base URLs via `createAnthropic({ apiKey, baseURL })` and `createOpenAI({ apiKey, baseURL })`; model selection is performed by calling the provider with the configured model id.
- Disabled mode stays fully local: `AI_PROVIDER=none` returns `{ ok: false, reason: "disabled" }` without requiring keys and without constructing either provider.
- WORKFLOW_OBSERVATION: `write_file`/`patch` auto-lint reported `TS6053: File '/c/Users/.../src/server/ai-provider.ts' not found` immediately after creating/editing Windows-native paths, even though the file was written successfully and `pnpm typecheck` later passed. This appears to be a tool path-normalization issue in the edit-time lint hook, not a product failure.

## Verification evidence

- Focused red run: `pnpm vitest run src/server/ai-provider.test.ts` failed because `./ai-provider` did not exist.
- Focused green run: `pnpm vitest run src/server/ai-provider.test.ts` passed (1 file / 9 tests) after implementation.
- Full gate: `pnpm test` passed (13 files / 130 tests).
- Full gate: `pnpm typecheck` passed (`tsc --noEmit`).
- Full gate: `pnpm build` passed on Next.js 16.2.6; routes `/`, `/_not-found`, `/api/v1/assessments/score`, and `/api/v1/questionnaire` generated.
- Required Git Bash equivalent of `Select-String -Path src -Pattern "@ai-sdk|ANTHROPIC_API_KEY|OPENAI_API_KEY"` returned only the mocked provider test and `src/server/ai-provider.ts` references.
- Additional non-test source scan `grep -RInE "@ai-sdk|ANTHROPIC_API_KEY|OPENAI_API_KEY" src --exclude='*.test.ts' || true` returned only `src/server/ai-provider.ts`.

## Classification

Tool defect

## Proposed tool improvement

Normalize Windows-native paths to the terminal/linter-visible path before running edit-time TypeScript checks after `write_file` or `patch`, or suppress the transient `TS6053` when a later stat confirms the file exists.

## Follow-up experiment

I012 and I011 should consume `generateStructuredObject` rather than importing provider SDKs directly, and should keep their prompt/schema/safety logic separate from `src/server/ai-provider.ts` so the import-boundary test remains a stable guard.
