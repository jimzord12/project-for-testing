# I012 — Layered safety classification and help resources

- **Status:** ⬜ not started
- **Phase:** C (optional AI layer)
- **Depends on:** I010
- **Complexity:** 4

## Context

Narrative content is screened independently of maturity analysis. Immediate-risk rules provide a
deterministic floor; a dedicated provider classifier handles context and ambiguity. Provider or
classifier failure must suppress maturity analysis when safety cannot be resolved (PRD §16;
DOMAIN §15).

## Scope

**In:**

- `SafetyDecision`: `allow`, categorized `interrupt`, or categorized `review_fallback`.
- Conservative deterministic rules for immediate self-harm, harm to others, and active emergency.
- Dedicated schema-constrained safety prompt through I010. It is separate from the maturity prompt,
  contains no scoring instruction, and runs for every non-empty narrative not already interrupted.
- Rule-layer `interrupt` is final and cannot be downgraded. Ambiguous rule matches require provider
  classification. Provider timeout/error/invalid output returns `review_fallback`, never `allow`.
- I011 treats both `interrupt` and unresolved `review_fallback` as analysis-suppressing decisions.
- Separate help-resource selector with international defaults and optional explicit country input;
  never infer location from narrative text.

**Out:** analyze-route orchestration, UI presentation, legal/localized resource review.

## Acceptance criteria

- [ ] Immediate-risk rule fixtures interrupt even if the provider would allow or fails.
- [ ] Production classification invokes the dedicated provider seam; a test fails if it is omitted.
- [ ] Ambiguous content, provider failure, timeout, and invalid provider output produce
      `review_fallback` and suppress maturity analysis in I011 integration tests.
- [ ] Ordinary and figurative-language fixtures avoid deterministic false interrupts and are
      resolved by the dedicated classifier.
- [ ] Help resources are selected only from explicit locale input or safe international defaults.
- [ ] Safety logs contain category/status metadata only, never narrative or provider prompt/output.
- [ ] Structured deterministic results remain visible for interrupt and fallback outcomes.

## References

PRD §16, §20; DOMAIN §15; I010 structured generation contract.
