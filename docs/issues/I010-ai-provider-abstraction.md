# I010 — Provider-agnostic structured generation service

- **Status:** ⬜ not started
- **Phase:** C (optional AI layer)
- **Depends on:** Phase 0
- **Complexity:** 3

## Context

Analysis and safety classification need one server-only provider seam. Provider swaps must be
environment-only, AI-disabled operation must be normal, and downstream services must supply their
own prompts and strict schemas (PRD §11, §15.1-§15.2, §15.8; DD-5).

## Scope

**In:**

- Add `ai`, `@ai-sdk/anthropic`, and `@ai-sdk/openai`.
- `src/server/ai-provider.ts` is the only module importing provider SDK packages. It exposes a
  generic schema-constrained generation operation consumed by I011 and I012.
- Providers: `none`, `anthropic`, and `openai`; custom base URLs support Z.AI's compatible
  endpoints. Provider-specific model and key names prevent cross-provider ambiguity.
- Wrap Zod v4 schemas through the SDK's supported schema adapter; never parse free-form JSON.
- Abort after the configured timeout, allow at most one transient retry, and classify disabled,
  timeout, rate limit, refusal, invalid output, and provider failure as typed results.
- Read environment values at call time or through an injectable configuration seam so tests do
  not depend on module-cache order.

**Out:** analysis prompt/schema, safety policy, route behavior, client rendering.

## Environment contract

| Variable                 | Default | Meaning                                |
| ------------------------ | ------- | -------------------------------------- |
| `AI_PROVIDER`            | `none`  | `none`, `anthropic`, or `openai`       |
| `ANTHROPIC_API_KEY`      | —       | Required for Anthropic mode            |
| `ANTHROPIC_MODEL`        | —       | Required for Anthropic mode            |
| `ANTHROPIC_BASE_URL`     | SDK     | Optional Anthropic-compatible endpoint |
| `OPENAI_API_KEY`         | —       | Required for OpenAI mode               |
| `OPENAI_MODEL`           | —       | Required for OpenAI mode               |
| `OPENAI_BASE_URL`        | SDK     | Optional OpenAI-compatible endpoint    |
| `AI_ANALYSIS_TIMEOUT_MS` | `20000` | Positive integer request timeout       |

## Acceptance criteria

- [ ] Provider, model, key, and base URL reach the correct SDK constructor/call; tests assert the
      exact arguments for both providers and compatible custom URLs.
- [ ] `AI_PROVIDER=none` returns `disabled` without requiring credentials or importing client code.
- [ ] Invalid configuration fails closed with a typed result and never reveals secret values.
- [ ] Schema success and invalid output are distinguished; no raw provider prose escapes.
- [ ] Timeout, 429, refusal, transient retry, and non-retryable errors have direct tests.
- [ ] Repository scan confirms provider imports and secret environment reads occur only in
      server-only modules; no live provider call runs in CI.

## References

PRD §11, §15.1, §15.2, §15.6, §15.8, §23; DD-5.
