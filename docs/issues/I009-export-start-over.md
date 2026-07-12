# I009 — Local result export and synchronous start over

- **Status:** ⬜ not started
- **Phase:** B (client flow)
- **Depends on:** I008
- **Complexity:** 3

## Context

Users can retain a transparent local copy and erase the active browser session. Export must
represent every result layer currently displayed without creating a new data-egress path
(PRD §7.9, §7.10, §11, §17).

## Scope

**In:**

- Downloadable JSON and self-contained printable HTML generated entirely in the browser.
- Export deterministic results and, when present, schema-validated AI analysis; never export raw
  narrative drafts unless a separate explicit raw-draft action requests it.
- Include questionnaire, scoring, and prompt version identifiers, generation timestamp,
  non-clinical disclaimer, confidence reasons, and whether optional layers were unavailable.
- Escape every user/model-derived string before HTML insertion; print CSS removes decorative
  backgrounds and preserves text equivalents.
- Expose an `onExportGenerated(format)` integration hook for I013 without sending export content.
- Start over confirmation synchronously removes the session-storage key, clears in-memory results
  and drafts, invalidates an ephemeral server token when one exists, and returns to landing.

**Out:** server-side export storage, third-party PDF services, persistent export history.

## Acceptance criteria

- [ ] JSON and HTML include all three version identifiers and the required disclaimer whether AI
      completed, was disabled, or was unavailable.
- [ ] Completed AI observations/experiments are exported; raw rubric values and raw narrative are
      not. All model strings are escaped in HTML.
- [ ] Export works locally with the network unavailable; no third-party request occurs.
- [ ] Print output contains no decorative background and retains accessible text equivalents.
- [ ] Start over requires confirmation and removes persisted assessment data before navigation;
      a same-tick storage assertion proves no debounce window remains.
- [ ] Tests cover hostile HTML/model strings, every optional-result state, hook metadata, cancel,
      confirmed deletion, and token-invalidation failure with local deletion still succeeding.

## References

PRD §7.9, §7.10, §10.2, §11, §17, §20.
