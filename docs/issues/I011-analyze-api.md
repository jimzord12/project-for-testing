# I011 — Consent-gated, evidence-grounded analysis API

- **Status:** ⬜ not started
- **Phase:** C (optional AI layer)
- **Depends on:** I002, I010, I012
- **Complexity:** 4

## Context

Optional narrative analysis runs only on the server and never changes deterministic results.
Safety screening precedes every scoreability shortcut, and completed output must be structurally
and evidentially valid rather than merely plausible (PRD §14.3, §15; DOMAIN §10, §13).

## Scope

**In:**

- Shared strict Zod request/response contracts and `POST /api/v1/assessments/analyze`.
- Require explicit `aiConsent`, valid JSON/media type, a 32 KiB bounded UTF-8 body, canonical
  versions/answers, and server-side narrative field caps.
- Recompute deterministic results, then run I012 safety classification on all submitted narrative
  text—including brief or below-threshold content—before deciding `not_scored`.
- Build the versioned `RMP-AI-1.0` prompt from minimized labels/results. Delimit narrative as
  untrusted data and remove delimiter escapes without altering ordinary content.
- Strict completed-output schema: 3-5 observations, 2-3 experiments, rubric/penalty integers 0-2,
  excerpt at most 24 words, review period 7-45 days, no unknown keys, markdown, or HTML.
- Evidence is a discriminated union: a canonical answered `questionId`, or a normalized excerpt
  that occurs in submitted narrative and meets the word cap. Validate these relationships in
  application code before returning completed output.
- Compute narrative score only with `calculateNarrativeScore`; ignore any provider aggregate.
- Return `completed | not_scored | safety_interruption | unavailable`. Safety fallback, provider
  refusal/error/timeout/rate limit, invalid schema, or invalid evidence never blocks I008 results.

**Out:** provider transport, safety policy/resources, deterministic result rendering, persistence.

## Acceptance criteria

- [ ] No provider call occurs without consent or after an interrupt/fallback safety decision.
- [ ] A brief immediate-risk narrative reaches safety classification and cannot return
      `not_scored` before screening.
- [ ] Unknown output keys, markdown/HTML, invalid evidence IDs, non-source excerpts, oversized
      excerpts, invalid rubric values, and provider aggregates are rejected by direct tests.
- [ ] Prompt-injection fixtures remain delimited data and cannot alter system instructions.
- [ ] One threshold-meeting exercise yields `limited_evidence`; neither yields `not_scored` only
      after safety allows it.
- [ ] Raw narrative, full prompts, and raw model output are absent from responses, logs, and
      persistence; deterministic results remain usable for every failure state.
- [ ] HTTP tests cover content type, malformed/oversized bodies, consent, and every response union;
      processing tests cover prompt, grounding, score ownership, and failure mapping.

## References

PRD §10.3, §14.3-§14.4, §15.3-§15.8, §16, §20; DOMAIN §10, §13, §15.
