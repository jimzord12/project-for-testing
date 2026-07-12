# I002 — Server-authoritative assessment scoring API

- **Status:** ⬜ not started
- **Phase:** A (API foundation)
- **Depends on:** Phase 0
- **Complexity:** 3

## Context

Clients submit answer identifiers, never scores. The server validates the versioned answer set
and recomputes every deterministic result from the canonical server-owned bank. Transport
boundaries must be testable as well as the scoring seam (PRD §14.2, §14.4, §17).

## Scope

**In:**

- `POST /api/v1/assessments/score` with shared Zod request, success, and typed-error schemas.
- Require `application/json`; reject malformed JSON and invalid payload shapes predictably.
- Enforce a 16 KiB UTF-8 body limit with a bounded reader that stops consuming once the byte
  limit is exceeded. Do not use JavaScript character count as a byte count.
- Call `validateAnswerSet`, then recompute dimensions, SMI, profile balance, confidence, and
  optional age metaphor through Phase 0 domain functions.
- Return an opaque random UUID `assessmentId`; it is a correlation token, not persisted state.
- Export a framework-light processing seam for deterministic contract tests and leave a clear
  integration boundary for I013 rate limiting and observability.

**Out:** persistence, AI analysis, client UI, rate-limit policy, analytics.

## Acceptance criteria

- [ ] Identical valid requests produce identical results apart from `assessmentId`.
- [ ] Unknown questions/options, duplicates, version mismatch, malformed JSON, invalid shape,
      wrong media type, and oversized bodies map to documented typed errors and HTTP statuses.
- [ ] Size tests cover ASCII and multibyte UTF-8 bodies with and without `Content-Length`.
- [ ] `Not applicable`, reportability thresholds, DD-1 null SMI, confidence, and age-metaphor
      opt-in match the Phase 0 domain functions exactly.
- [ ] `assessmentId` is an opaque UUID and no submitted answer appears in logs or persistence.
- [ ] Direct processing tests cover domain paths; HTTP-level tests cover every transport branch.

## References

PRD §10.3, §11, §14.2, §14.4, §17, §20; DOMAIN §9, §11; DD-1.
