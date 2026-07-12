# Phase 1 Experimental Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate `project-for-testing` with the exact completed Phase 0 foundation, a
self-contained design corpus, a corrected Phase 1+ issue DAG, and durable experiment notes.

**Architecture:** Restore code and scaffolding mechanically from source commit `7eb39bd`,
then overlay current design and agent workflow documents. Re-author only the issue contracts
whose audits exposed specification/implementation mismatch, and verify the result as a clean
Phase 1 starting point before publication.

**Tech Stack:** Git, Markdown, Next.js 16, React 19, TypeScript 5.9, Vitest, pnpm 10

## Global Constraints

- Source repository: `C:\Users\jimzord12\Documents\GitHub\phycological-age-test`.
- Destination repository: `C:\Users\jimzord12\Documents\GitHub\project-for-testing`.
- Phase 0 source commit: `7eb39bd7c7c65e0718e86b33f5be0cd0561b72ac`.
- Do not copy post-I001 production implementation.
- Do not copy `docs/issue-impl-reports/`, `docs/superpowers/`, or completed QA artifacts.
- Preserve `.agents/skills/do-next-issue/`.
- Rewritten issues must read as original specifications and must not mention prior work.
- Experimental observations live only under `docs/experiment/`.
- Publish publicly only after local verification and only if no unrelated remote exists.

---

### Task 1: Restore the immutable Phase 0 snapshot

**Files:**

- Create from source tree: `.env.example`, `.gitignore`, `LICENSE`, `next.config.ts`,
  `package.json`, `pnpm-lock.yaml`, `scripts/`, `src/`, `tsconfig.json`, `vitest.config.ts`
- Temporarily create from source tree: baseline documentation to be overlaid in later tasks

**Interfaces:**

- Consumes: Git tree `7eb39bd^{tree}`
- Produces: exact Phase 0 application and domain foundation

- [ ] Export the source commit with `git archive` and extract it into the destination without
      deleting `docs/experiment/`.
- [ ] Compare the destination scaffold/domain paths byte-for-byte with the source commit.
- [ ] Confirm no API routes, client state, assessment feature UI, server AI services, or E2E
      suites exist.
- [ ] Commit as `chore: restore Phase 0 baseline`.

### Task 2: Overlay self-contained design and agent workflow

**Files:**

- Create: `docs/DOMAIN.md`, `docs/PRD.md`
- Modify: `AGENTS.md`, `README.md`, `PROGRESS.md`, `docs/Handoff.md`,
  `docs/DOMAIN-DECISIONS.md`, `docs/issues/README.md`
- Create: `.agents/skills/do-next-issue/SKILL.md`,
  `.agents/skills/do-next-issue/agents/openai.yaml`, `.claude/commands/do-next-issue.md`
- Preserve: `CLAUDE.md`

**Interfaces:**

- Consumes: current authoritative design files and approved baseline design
- Produces: agent-readable Phase 1 repository context with no false completion claims

- [ ] Copy DOMAIN, PRD, Codex skill, and Claude command from the current source worktree.
- [ ] Rewrite repository overview, progress, and handoff so Phase 0 alone is complete and all
      I001-I019 work is open.
- [ ] Update agent instructions and decisions to use local short design paths and distinguish
      product progress from experiment observations.
- [ ] Verify every referenced local file exists.

### Task 3: Install the corrected issue DAG

**Files:**

- Copy: `docs/issues/I001-questionnaire-api.md`, `I003-client-state-persistence.md`,
  `I008-deterministic-results.md`, `I017-ai-eval-fixtures.md`, `I018-delivery-docs.md`
- Rewrite: `I002`, `I004-I007`, `I009-I016`, `I019`
- Modify: `docs/issues/README.md`, `PROGRESS.md`

**Interfaces:**

- Consumes: DOMAIN, PRD, Phase 0 code contracts, implementation-audit evidence
- Produces: nineteen independently grabbable Phase 1+ work items

- [ ] Copy the five approved clean issue documents from the current source worktree.
- [ ] Re-author each affected issue using Context, Scope In/Out, Acceptance Criteria, and
      References, incorporating realistic architecture and explicit regression seams.
- [ ] Validate dependencies against the Phase 0 tree and ensure no acceptance criterion relies
      on code introduced by a later issue.
- [ ] Scan rewritten issues for retrospective language and remove it.

### Task 4: Establish the experiment notebook

**Files:**

- Create: `docs/experiment/EXPERIMENT-LOG.md`
- Create: `docs/experiment/records/.gitkeep`

**Interfaces:**

- Consumes: experiment schema in `PHASE-1-BASELINE-DESIGN.md`
- Produces: append-only experiment index and per-run record location

- [ ] Add the experiment purpose, classification vocabulary, and exact per-run template.
- [ ] Record baseline creation as experiment setup, not a tool evaluation result.
- [ ] Link the experiment log from README and AGENTS without mixing it into product status.

### Task 5: Verify and publish

**Files:**

- Verify: entire destination repository
- Modify only if publishing succeeds: Git remote configuration

**Interfaces:**

- Consumes: Tasks 1-4 repository
- Produces: verified local baseline and optional public GitHub repository

- [ ] Run formatting checks, link/reference scans, issue-structure checks, excluded-file scans,
      and the Phase 0 source-tree comparison.
- [ ] Run `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm typecheck`, and `pnpm build`.
- [ ] Commit the design overlay, issue DAG, and experiment notebook intentionally.
- [ ] Use `gh auth status`, verify repository-name availability, and create a public repository
      named `project-for-testing` with the destination as its source.
- [ ] Confirm the remote URL and clean local status, or report the exact publication blocker.
