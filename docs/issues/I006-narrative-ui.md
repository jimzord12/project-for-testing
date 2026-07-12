# I006 — Optional narrative exercises with explicit skip intent

- **Status:** ⬜ not started
- **Phase:** B (client flow)
- **Depends on:** I005
- **Complexity:** 3

## Context

Two optional narrative exercises appear at canonical mid-flow positions. Skip is a user intent,
not merely another navigation label: skipped text must not later reach review or AI analysis
(PRD §7.5; DOMAIN §3, §8).

## Scope

**In:**

- Exercise intro, canonical sub-question textareas, live word counts, 80% warnings, and lossless
  hard caps using the Phase 0 `countWords` helper and canonical field limits.
- Session state stores drafts plus explicit skipped state per exercise.
- `Skip this exercise` clears that exercise's stored fields, marks it skipped, and advances.
  Typing again or choosing Continue marks it not skipped; partial content may be continued.
- Back/Continue navigation at visual steps 9 and 16, repeated concise privacy notice, neutral
  optional language, heading focus, and visible focus indicators.

**Out:** server cap validation, review rendering, AI analysis, narrative scoring request.

## Acceptance criteria

- [ ] Empty and partial exercises can be explicitly skipped; skipped fields are cleared and
      remain excluded after refresh.
- [ ] Continue preserves intentional partial content and records `skipped: false`.
- [ ] Counts match `countWords`; warnings begin at 80%; paste/input beyond a cap preserves the
      last valid value.
- [ ] Canonical caps and insertion navigation are exact.
- [ ] Rendered tests cover empty skip, partial-then-skip, editing after skip, refresh restoration,
      counter boundaries, over-cap paste, privacy copy, focus, and keyboard operation.
- [ ] No wording implies that skipping reduces score quality or user worth.

## References

PRD §7.5, §10.2, §19; DOMAIN §3, §6.3, §8, §16.
