# I005 — Accessible structured-question flow

- **Status:** ⬜ not started
- **Phase:** B (client flow)
- **Depends on:** I003
- **Complexity:** 4

## Context

Render the 24 canonical structured items without exposing score direction. The flow must be
fully operable by keyboard, touch, zoom, and assistive technology before narrative or results
screens are added (PRD §7.3-§7.4, §19).

## Scope

**In:**

- One structured item per screen from I001's score-free questionnaire projection.
- Progress across all 26 visual steps, including narrative insertion positions after structured
  items 8 and 14; neutral dimension label; Back and Continue controls.
- Native radio semantics with a question-labelled group, visible focus, selected state, and a
  visually subdued but equally operable `Not applicable` option.
- Focus the question heading on initial mount and after every step change. Expose a mount-time
  focus seam later review/edit navigation can reuse.
- Minimum 44×44 CSS-pixel interactive targets, 320 CSS-pixel layout support, 200% zoom without
  horizontal page scrolling, and reduced-motion compliance.
- Explicit exit-and-delete action guarded by confirmation.

**Out:** narrative fields, review, submission, scoring, result interpretation.

## Acceptance criteria

- [ ] Canonical order and step mapping are exact; no numeric score or desirability hint reaches
      rendered markup or client state.
- [ ] Continue is unavailable until the current item has a selection; Back and insertion-point
      transitions follow DOMAIN §6.3.
- [ ] Arrow keys move within the radio group, Space selects, Tab order is logical, and Enter on
      the enabled primary action advances without submitting unintended controls.
- [ ] The heading receives programmatic focus on mount and each step with a visible indicator.
- [ ] Every option and navigation control meets 44×44; the screen works at 320px and 200% zoom.
- [ ] Rendered component tests cover radio semantics, keyboard behavior, focus, target sizing
      contract, deletion, and every navigation boundary; pure mapping tests supplement them.

## References

PRD §7.3, §7.4, §19; DOMAIN §6, §7.
