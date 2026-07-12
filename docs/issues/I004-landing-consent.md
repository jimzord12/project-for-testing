# I004 — Landing, eligibility, consent, and optional-result choices

- **Status:** ⬜ not started
- **Phase:** B (client flow)
- **Depends on:** I003
- **Complexity:** 3

## Context

Entry screens must explain actual data flow before collecting answers. Deterministic scoring
sends structured answer identifiers to this application's server; narrative text reaches a
configured external AI provider only after explicit opt-in. No account or exact birth date is
needed (PRD §5, §7.1-§7.2, §10).

## Scope

**In:**

- Landing screen with product explanation, 12-18 minute estimate, non-clinical disclaimer,
  honest privacy summary, start action, and expandable scoring explanation.
- Consent screen with required `isAdult` and `nonClinicalAcknowledged` booleans; no date of
  birth or numeric age.
- Optional `aiConsent` and `includeAgeMetaphor` preferences, both false by default.
- Display the PRD AI disclosure adjacent to the opt-in and explain the age metaphor beside its
  toggle. Link to the future privacy-policy location owned by I018.
- Persist all four choices in I003 session state. Continue remains disabled until both required
  acknowledgements are true.

**Out:** questionnaire UI, legal approval, privacy-policy content, scoring and AI calls.

## Acceptance criteria

- [ ] An anonymous user can reach the questionnaire only after both required acknowledgements.
- [ ] Refresh restores all four choices from `sessionStorage`; no choice uses `localStorage`.
- [ ] Copy states that structured answers go to the application server for scoring and that
      narrative text goes to an external AI provider only when `aiConsent` is true.
- [ ] Tests reject the inaccurate claims “scoring happens entirely on-device” and “answers are
      never sent to a server without AI opt-in.”
- [ ] AI and age-metaphor choices default off; exact DOB is neither requested nor stored.
- [ ] Screens contain no urgency, scarcity, popularity, testimonial, or social-proof pressure.
- [ ] Rendered tests cover gating, defaults, persistence, disclosures, and keyboard operation.

## References

PRD §5, §7.1, §7.2, §10; DOMAIN §2, §15.3.
