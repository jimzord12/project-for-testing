# I007 — Review, edit, and submit screen

- **Status:** ⬜ not started
- **Phase:** B (client flow)
- **Depends on:** I005, I006
- **Complexity:** 3

## Context

Before submission, users need an honest completeness review without scores, selected-answer
desirability, or maturity hints. Edit navigation must work for keyboard and screen-reader users
across component mount boundaries (PRD §7.6, §9, §19).

## Scope

**In:**

- Per-dimension counts separating answered, `Not applicable`, and unanswered structured items.
- Full item list with neutral status and edit action; narrative complete/partial/skipped status
  derived from explicit I006 skip state and canonical content thresholds.
- Read-only summary of AI and age-metaphor choices.
- Edit navigation to every structured item and narrative exercise. The destination heading must
  receive focus after the phase transition, using the I005/I006 mount-time focus seam.
- Back and Submit actions; Submit changes application phase only, leaving I008 to call scoring.

**Out:** server scoring, result rendering, changing consent choices, showing option scores.

## Acceptance criteria

- [ ] Dimension counts are correct and accessible labels distinguish completed from answered and
      `Not applicable` without double-counting.
- [ ] Narrative status respects explicit skip intent and threshold boundaries.
- [ ] Every edit action opens the correct destination and moves visible focus to its heading after
      mount; browser tests cover structured and narrative destinations.
- [ ] No selected option label, numeric score, answer desirability, band, or interpretation is
      exposed on review.
- [ ] Submit cannot run accidentally from an edit control and preserves deterministic state.
- [ ] Tests render the component and cover counts, status, dispatch targets, focus transfer,
      keyboard behavior, and submission in addition to pure helpers.

## References

PRD §7.6, §9, §19; DOMAIN §10.4.
