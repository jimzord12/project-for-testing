# I015 — Full browser journeys with real application boundaries

- **Status:** ⬜ not started
- **Phase:** E (QA)
- **Depends on:** I008, I009, I011
- **Complexity:** 4

## Context

Browser tests must exercise the user flow they name. Pre-populating review state can support a
narrow component scenario, but it cannot stand in for landing-to-results, keyboard-only, safety,
or prompt-boundary journeys (PRD §6, §21.3).

## Scope

**In:**

- Playwright with a deterministic test provider enabled only by an explicit test environment
  guard. AI journeys pass through the real analyze route, safety service, prompt builder, schemas,
  and provider wrapper; no browser route interception replaces the endpoint under test.
- Reusable UI-driving helpers may select canonical answers efficiently, but primary journeys start
  at landing and interact with consent, all structured steps, narrative steps, review, and submit.
- Fail on uncaught page exceptions, hydration errors, and unexpected console error/warning output.
- Required journeys:
  1. Full structured flow, skipped narratives, deterministic result and export.
  2. Full AI-enabled flow with both result layers.
  3. Provider timeout with deterministic result/export still usable.
  4. Mid-assessment refresh and session restoration.
  5. Entire assessment completed using keyboard input only.
  6. Entire primary flow at a 320px mobile viewport.
  7. Several `Not applicable` answers and reduced confidence.
  8. Insufficient dimension and DD-1 null index.
  9. Opt-in age metaphor with qualifying copy.
  10. Start over with synchronous storage deletion.
  11. Narrative HTML/script rendered literally through the real analyze boundary.
  12. Prompt injection remains delimited data through the captured provider input.
  13. Safety interruption suppresses analysis while deterministic results remain.

**Out:** exhaustive WCAG audit, live external provider calls, AI quality scoring.

## Acceptance criteria

- [ ] All thirteen journeys pass from a clean browser context; journeys 1, 2, 5, 6, 11, 12,
      and 13 may not seed a completed review state.
- [ ] The keyboard journey uses no mouse/touchscreen API and completes every required screen.
- [ ] Prompt-injection and safety journeys prove server orchestration through deterministic test-
      provider traces, not only client serialization.
- [ ] Timeout and safety outcomes preserve deterministic results and local export.
- [ ] The suite fails on hydration mismatch, page error, unexpected console output, network request
      to an unapproved host, or test-provider availability outside the explicit test environment.
- [ ] Parallel and single-worker runs are deterministic; refresh tests do not use init scripts that
      replay storage seeds on every document.

## References

PRD §6, §21.3; DD-1; I011, I012.
