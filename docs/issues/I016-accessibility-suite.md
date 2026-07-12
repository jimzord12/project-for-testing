# I016 — Automated and manual WCAG 2.2 AA verification

- **Status:** ⬜ not started
- **Phase:** E (QA)
- **Depends on:** I005, I006, I007, I008
- **Complexity:** 4

## Context

Automated rules detect only part of accessibility conformance. This issue combines axe and browser
assertions with documented keyboard, screen-reader, zoom/reflow, contrast, motion, and focus
verification across the real application lifecycle (PRD §8, §9, §21.4).

## Scope

**In:**

- Axe scans on landing, consent, structured question, narrative, review, deterministic results,
  completed AI, unavailable AI, and safety interruption states.
- Browser assertions for heading/focus transitions, logical Tab order, radio keyboard behavior,
  polite status announcements, assertive only for urgent errors, visible focus, text equivalents,
  reduced motion, language, and no color-only information.
- Full keyboard completion from landing to results; edit-jump focus and start-over focus return.
- 320 CSS-pixel and actual 200% browser zoom/reflow checks on every primary screen, including
  interaction—not visibility alone. Test high contrast/forced colors where supported.
- Manual verification record covering at least one screen reader/browser pairing, 200% zoom,
  keyboard-only flow, focus order, announcements, contrast, touch targets, and motion.
- Use normal UI navigation for primary checks. State seeding may be used only for narrowly labelled
  isolated tests and must not generate hydration mismatch or console errors.

**Out:** functional journey matrix (I015), legal certification, every assistive-technology pair.

## Acceptance criteria

- [ ] Axe reports no serious/critical violations on every listed state.
- [ ] Browser tests complete the full keyboard flow and verify focus at every screen/edit boundary.
- [ ] Status updates use `aria-live="polite"`; urgent errors use a documented assertive path. Tests
      trigger and inspect both behaviors.
- [ ] Every primary screen is operable at 320px and actual 200% zoom with no two-dimensional page
      scrolling, clipped controls, or unreachable action.
- [ ] Result visuals have equivalent text; forced colors and reduced motion retain meaning.
- [ ] `docs/accessibility-audit.md` records date, environment, assistive technology, exact manual
      procedure, pass/fail result, and any limitation. “Automated tests only” is not completion.
- [ ] Accessibility runs fail on page exceptions, hydration mismatch, and unexpected console errors.

## References

PRD §8, §9, §19, §21.4; WCAG 2.2 AA.
