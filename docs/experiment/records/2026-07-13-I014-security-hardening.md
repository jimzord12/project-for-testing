# I014 application and transport security hardening

- Date/time and timezone: 2026-07-13T09:34:09+03:00
- Tool and version: Hermes Agent / Codex CLI via Hermes Kanban
- Model and reasoning/effort setting: gpt-5.5, default profile
- Issue and branch: I014, `01-hermes-kanban-test`
- Starting commit: `a915fab768e410137abf90ac857efc15edecb549`
- Ending commit: uncommitted working tree for Kanban review

## Hypothesis

A single Hermes Kanban implementation worker can add production security headers, strict production CSP tests, CI audit/scanning, and documentation while preserving the existing I002/I011 transport contracts.

## Expected behavior

The worker should implement I014 without changing domain formulas or business validation, verify with focused tests plus the full phase gate, and hand off with enough evidence for an independent reviewer to reproduce the result.

## Prompt and workflow

The Kanban task `t_d6cdf026` was executed directly in the repository workspace. The worker read `docs/Handoff.md`, `PROGRESS.md`, `docs/issues/I014-security-hardening.md`, and PRD security/privacy sections, then used TDD for the new `src/server/security-headers.test.ts` coverage before implementation.

## Observations

- Product implementation: added a middleware-managed nonce CSP/security-header module, CI production dependency audit, sentinel secret scan script, API malformed-body sentinel non-echo assertions, and README deployment/CSRF/security-header documentation.
- Reviewer rework: the first review rejected the initial CSP because the response header nonce was not propagated into the Next.js-rendered script tags. The fix now forwards the same CSP through middleware request headers for Next.js nonce parsing and opts the app shell into dynamic rendering so per-request nonces can reach rendered scripts.
- Reviewer rework: the second review found that CI supplied sentinel provider secrets only to the post-build scanner, not to the Build step. CI now injects the same sentinels into both steps, and a workflow contract test enforces sentinel-bearing build artifacts and build-before-scan ordering.
- Workflow observation: after foreground shell PATH was corrected to prepend `/c/Users/jimzord12/AppData/Local/pnpm`, a new `terminal(background=true)` server process still started with the stale fnm/Corepack `pnpm` shim and failed until the PATH export was repeated inside the background command. This is a background-process environment propagation friction point; the existing Hermes Kanban operations skill already warns about PATH prepending for reviewer jobs, but direct background process use has the same pitfall.
- Workflow observation: killing a Hermes-tracked background `pnpm start` session did not always remove the child Next.js process on this Windows/Git Bash setup. Before restarting the production server on the same port, verification had to check `netstat -ano | grep ':3001'` and use `MSYS_NO_PATHCONV=1 taskkill /PID <pid> /T /F` for the remaining listener.

## Verification evidence

- Focused red: `pnpm vitest run src/server/security-headers.test.ts` failed because `./security-headers` did not exist.
- Focused green: `pnpm vitest run src/server/security-headers.test.ts src/app/api/v1/assessments/score/route.test.ts src/app/api/v1/assessments/analyze/route.test.ts src/ci-workflow.test.ts` passed (4 files / 39 tests).
- Rework red: `pnpm vitest run src/server/security-headers.test.ts --reporter=verbose` failed until the middleware forwarded `Content-Security-Policy` as a request override, then failed again until the app shell exported `dynamic = "force-dynamic"`.
- Rework green: `pnpm vitest run src/server/security-headers.test.ts --reporter=verbose` passed (1 file / 7 tests).
- CI sentinel-build red: `pnpm vitest run src/ci-workflow.test.ts` failed because the Build step did not contain the sentinel environment.
- Focused gate after the CI rework passed (4 files / 42 tests).
- Full gate after rework: `pnpm test` passed (20 files / 193 tests).
- Full gate: `pnpm typecheck` passed.
- Full gate: a build with both sentinel provider secrets passed; routes listed `/`, `_not-found`, score, analyze, export-event, questionnaire, and middleware/proxy as dynamic.
- Audit: `pnpm audit --prod --audit-level=high` exited 0 with 1 moderate vulnerability below the high threshold.
- Artifact/live scan: `ANTHROPIC_API_KEY=I014_SENTINEL_ANTHROPIC_SECRET_DO_NOT_SHIP OPENAI_API_KEY=I014_SENTINEL_OPENAI_SECRET_DO_NOT_SHIP I014_SCAN_BASE_URL=http://localhost:3001 pnpm security:scan-secrets` passed after a fresh production-server restart (72 built artifact files scanned, live responses scanned).
- Live response check: `pnpm start -p 3001` plus a Python HTML/header parser showed `script-src 'self' 'nonce-...' 'strict-dynamic' https:` with no `unsafe-inline`/`unsafe-eval`, 11 rendered script tags, 4 inline scripts, and `missing_nonce_count: 0`.
- Required scan: `powershell.exe -NoProfile -Command "Get-ChildItem -Path src,.github -Recurse -File | Select-String -Pattern 'unsafe-inline|unsafe-eval|dangerouslySetInnerHTML|ANTHROPIC_API_KEY|OPENAI_API_KEY'"` returned expected provider-boundary, test, CI sentinel, production-test assertions, and development/style CSP references; no `dangerouslySetInnerHTML` implementation sink was present.

## Classification

Environment problem

## Proposed tool improvement

Document or normalize that `terminal(background=true)` may not inherit shell PATH repairs from previous foreground calls on this Windows/Git Bash setup. When starting background servers, include the PATH export in the same background command. Also document the Windows/Git Bash cleanup pattern for child server processes that survive `process.kill`: inspect the listening port with `netstat -ano` and use `MSYS_NO_PATHCONV=1 taskkill /PID <pid> /T /F` before restarting on the same port.

## Follow-up experiment

Have a reviewer independently run the same phase gate and inspect whether the CSP nonce is compatible with the production-rendered Next.js page in a browser-level smoke test once I015 introduces E2E infrastructure.
