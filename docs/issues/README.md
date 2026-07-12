# Issues — Phase 1+ implementation DAG

Each file is a self-contained vertical slice with context, explicit in/out scope, objective
acceptance criteria, dependencies, and governing references. Status is tracked only in
`PROGRESS.md` and the issue header.

## Governing rules

- Precedence: `docs/DOMAIN.md` → PRD safety/privacy/security → PRD acceptance criteria → PRD
  UX → PRD architecture → implementer choice.
- `src/domain/` remains pure and framework/network/provider independent.
- Questionnaire wording, answer order, score maps, formulas, rubric, or prompt changes require
  the applicable version increment.
- Every issue includes tests for its behavior and keeps the Phase 0 verification sequence green.
- A documented experiment observation is evidence about a tool run, not proof that an issue is
  complete.

## Dependency order

```text
Phase A: I001, I002

Phase B:
  I001 → I003 → I004
             → I005 → I006 → I007
  I002 + I003 → I008 → I009

Phase C:
  I010 → I012
  I002 + I010 + I012 → I011

Phase D:
  Phase 0 → I019
  I002 + I011 → I013
  I002 + I008 + I011 + I019 → I014

Phase E:
  I008 + I009 + I011 → I015
  I005 + I006 + I007 + I008 → I016
  I011 + I012 → I017

Phase F:
  I018 may start early and is finalized after I013 and I014.
```

Phases B and C may proceed in parallel after Phase A. I019 may begin immediately. The optional
AI layer never gates deterministic scoring, results, export, or start over.

## Issue-writing standard

If implementation exposes a genuine ambiguity, stop and resolve it in
`docs/DOMAIN-DECISIONS.md`; do not silently redefine the issue. If an acceptance criterion is
impossible under its dependencies, correct the DAG before implementation rather than importing
undeclared later work.
