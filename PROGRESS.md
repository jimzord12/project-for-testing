# Project Progress — Reflective Maturity Profile

Authoritative delivery state for the experimental implementation baseline. Experiment notes
belong in `docs/experiment/`; they do not change issue status.

**Legend:** ✅ done · 🟡 in progress · ⬜ not started

Last updated: 2026-07-13 (I011 analyze API strict response-contract rework)

## Milestones

| Phase | Theme                                                                 | Status  |
| ----- | --------------------------------------------------------------------- | ------- |
| 0     | Domain core: scaffold, canonical bank, deterministic scoring + tests  | ✅ done |
| A     | API foundation: questionnaire and score endpoints                     | ✅ done |
| B     | Client flow: consent → questionnaire → review → deterministic results | 🟡      |
| C     | Optional AI layer: provider, safety, analysis                         | 🟡      |
| D     | Cross-cutting privacy, observability, rate limits, security, CI       | 🟡      |
| E     | QA: E2E journeys, accessibility, AI evaluation                        | ⬜      |
| F     | Delivery documentation                                                | ⬜      |

## Completed Phase 0

- ✅ Next.js 16, React 19, strict TypeScript, pnpm, and Vitest scaffold.
- ✅ Versioned domain contracts: `RMP-1.0`, `RMP-SCORE-1.0`, `RMP-AI-1.0`.
- ✅ Canonical 24 structured items and two narrative exercises.
- ✅ Score-free public questionnaire projection.
- ✅ Deterministic validation, dimension scoring, aggregate index, profile balance, and
  opt-in age metaphor.
- ✅ Confidence calculation and application-owned narrative scoring.
- ✅ Co-located domain boundary and canonical-bank tests.
- ✅ Domain clarifications DD-1 through DD-4.

## Issue DAG

| Issue                                                | Title                                                 | Phase | Depends on       | Status |
| ---------------------------------------------------- | ----------------------------------------------------- | ----- | ---------------- | ------ |
| [I001](docs/issues/I001-questionnaire-api.md)        | Public questionnaire API                              | A     | Phase 0          | ✅     |
| [I002](docs/issues/I002-score-api.md)                | Server-authoritative score API                        | A     | Phase 0          | ✅     |
| [I003](docs/issues/I003-client-state-persistence.md) | Client state and session persistence                  | B     | I001             | ✅     |
| [I004](docs/issues/I004-landing-consent.md)          | Landing, eligibility, consent, and preference choices | B     | I003             | ✅     |
| [I005](docs/issues/I005-questionnaire-shell.md)      | Accessible structured-question flow                   | B     | I003             | ✅     |
| [I006](docs/issues/I006-narrative-ui.md)             | Optional narrative exercises                          | B     | I005             | ✅     |
| [I007](docs/issues/I007-review-screen.md)            | Review and edit screen                                | B     | I005, I006       | ✅     |
| [I008](docs/issues/I008-deterministic-results.md)    | Deterministic results                                 | B     | I002, I003       | ✅     |
| [I009](docs/issues/I009-export-start-over.md)        | Export and start over                                 | B     | I008             | ✅     |
| [I010](docs/issues/I010-ai-provider-abstraction.md)  | Provider-agnostic structured AI generation            | C     | Phase 0          | ✅     |
| [I012](docs/issues/I012-safety-service.md)           | Layered safety classification and help resources      | C     | I010             | ✅     |
| [I011](docs/issues/I011-analyze-api.md)              | Consent-gated analysis API                            | C     | I002, I010, I012 | ✅     |
| [I013](docs/issues/I013-observability-rate-limit.md) | Privacy-safe observability and rate limiting          | D     | I002, I011       | ⬜     |
| [I014](docs/issues/I014-security-hardening.md)       | Application and transport security hardening          | D     | I002, I008, I011 | ⬜     |
| [I019](docs/issues/I019-ci-pipeline.md)              | Reproducible CI and repository quality gates          | D     | Phase 0          | ✅     |
| [I015](docs/issues/I015-e2e-tests.md)                | Full E2E journeys                                     | E     | I008, I009, I011 | ⬜     |
| [I016](docs/issues/I016-accessibility-suite.md)      | Automated and manual accessibility verification       | E     | I005-I008        | ⬜     |
| [I017](docs/issues/I017-ai-eval-fixtures.md)         | Synthetic AI evaluation fixtures and harness          | E     | I011, I012       | ⬜     |
| [I018](docs/issues/I018-delivery-docs.md)            | Privacy, threat model, and deployment documentation   | F     | —                | ⬜     |

## Definition of done

A production build works with AI disabled or enabled; an anonymous adult can complete the
full flow; deterministic results are reproducible; optional AI output is evidence-grounded,
schema-valid, and safely interruptible; privacy and accessibility requirements are verified;
and delivery documentation matches actual behavior.
