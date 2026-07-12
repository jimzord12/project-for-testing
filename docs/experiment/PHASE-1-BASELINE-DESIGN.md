# Phase 1 Experimental Baseline Design

## Purpose

Create a clean repository for evaluating custom AI development tools. The repository begins
with the completed deterministic Phase 0 foundation and a realistic, implementation-ready
Phase 1+ work decomposition. Experimental observations remain separate from product delivery
status so tool failures can be studied without rewriting history.

## Baseline boundary

Use source commit `7eb39bd7c7c65e0718e86b33f5be0cd0561b72ac` as the immutable Phase 0
code and scaffolding snapshot. This is the last source commit before I001.

Include the scaffold, deterministic domain implementation, Phase 0 tests, package metadata,
configuration, and repository hygiene files from that snapshot. Do not copy any Phase 1+
production implementation from later commits.

## Current planning overlay

Overlay these current source artifacts after restoring the baseline:

- `docs/DOMAIN.md` and `docs/PRD.md`;
- canonical `AGENTS.md` with short DOMAIN/PRD paths and its `CLAUDE.md` pointer;
- `.agents/skills/do-next-issue/` and `.claude/commands/do-next-issue.md`;
- the current issue-system conventions and relevant domain decisions;
- Phase 1+ progress and handoff documents reset to describe an unimplemented baseline.

Do not copy `docs/issue-impl-reports/`, `docs/superpowers/`, accessibility audit results, or
any delivery claims produced after implementation.

## Issue treatment

Copy I001, I003, I008, I017, and I018 as clean specifications because their audits found no
implementation-driven contract correction or they remain unimplemented.

Rewrite I002, I004-I007, I009-I016, and I019 as original first-generation issue contracts.
Use audit evidence only as private design input:

- encode reasonable engineering resolutions directly;
- make safety, privacy, accessibility, and test seams explicit where ambiguity caused defects;
- correct dependencies or scope when the original issue could not be implemented literally;
- retain the established Context, Scope In/Out, Acceptance Criteria, and References pattern;
- never mention an earlier implementation, audit, deviation, fix, revision, or v2.

All issues must be independently grabbable from the Phase 0 baseline, have objective acceptance
criteria, and preserve DOMAIN -> PRD safety/privacy/security -> PRD acceptance precedence.

## Experiment records

Create `docs/experiment/EXPERIMENT-LOG.md` as an append-only session index. Each experiment
record must capture:

- date, tool/version, model, issue, branch, and starting commit;
- hypothesis and expected behavior;
- prompts or workflow invoked;
- observed behavior and verification evidence;
- classification: product-spec issue, decomposition issue, tool defect, model limitation,
  environment problem, or inconclusive;
- proposed tool improvement and follow-up experiment.

Product progress remains in `PROGRESS.md`; experimental findings never determine issue status
without repository evidence.

## Validation

Before publishing:

1. Confirm the Phase 0 file set matches the selected source commit for code/scaffolding.
2. Confirm no post-I001 production files or excluded audit artifacts exist.
3. Confirm all nineteen issues exist, use the standard structure, and form a valid dependency
   order from the Phase 0 baseline.
4. Check all local links and DOMAIN/PRD references.
5. Install dependencies and run the Phase 0 verification suite.
6. Confirm Git status is intentional and secrets are absent.

## Publication

Create the initial commits locally, then publish `project-for-testing` as a public GitHub
repository with `gh` when authentication and name availability permit. Do not overwrite an
unrelated remote repository.
