# I013 — Privacy-safe observability and rate limiting

- **Status:** ⬜ not started
- **Phase:** D (cross-cutting)
- **Depends on:** I002, I011
- **Complexity:** 3

## Context

Operations need request correlation and abuse protection without collecting assessment content,
full IP addresses, prompts, excerpts, or credentials (PRD §10.3-§10.4, §20).

## Scope

**In:**

- Typed events for questionnaire load, score request/completion/rejection, analysis
  request/completion/unavailable, safety interruption, and export generation.
- Allowed fields: event, request ID, timestamp, version identifiers, status, latency, error code,
  export format, and deployment version. Reject or strip every unknown field.
- `emitEvent` applies the recursive sensitive-key/value scrubber as its final boundary before
  serialized output; callers cannot bypass it.
- Minimal export-event endpoint/hook integration from I009 accepts format and version metadata
  only—never results, answers, narrative, model output, or stable user identity.
- In-memory score/analyze rate limits with deterministic clocks for tests, bounded lazy eviction,
  privacy-preserving client keys, `Retry-After`, and `RATE_LIMIT_ENABLED` defaulting true.
- Integrate route events and limits without changing deterministic/AI response contracts.

**Out:** third-party telemetry, cross-instance distributed limits, dashboards, user tracking.

## Acceptance criteria

- [ ] Every required event has an integration producer and a route/client test; no declared event
      is producerless.
- [ ] Injected answers, narrative, prompts, excerpts, API keys, authorization headers, and nested
      sensitive values are redacted at the final emission boundary.
- [ ] Full IPs are never stored or logged; client keys are truncated or one-way derived and are
      used only in memory.
- [ ] Score and analyze limits return 429 plus integer `Retry-After`; disabled mode bypasses them.
- [ ] Route tests cover allowed, exhausted, reset, malformed key, and eviction behavior with an
      injected clock—no arbitrary sleeps.
- [ ] Export telemetry failure never blocks local export and transmits only allowlisted metadata.

## References

PRD §10.3, §10.4, §11, §20; I002, I009, I011.
