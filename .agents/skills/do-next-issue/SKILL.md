---
name: do-next-issue
description: Use when asked to start, select, pick up, or continue the next open repository issue.
---

# Do Next Issue

Select only work that is open, unblocked, and supported by the current worktree. Treat
`AGENTS.md` as canonical; do not duplicate or override it.

## Workflow

1. Read `docs/Handoff.md` first, then `PROGRESS.md`, then `docs/issues/README.md` and the
   candidate issue file.
2. Inspect the current branch, status, recent commits, and relevant implementation. Preserve
   all existing staged, unstaged, and untracked work.
3. Reconcile conflicting status claims against code, tests, and Git evidence. Do not select a
   completed issue merely because its issue-file checkboxes are stale.
4. Select the earliest sensible open issue whose dependencies are complete. If more than one
   is equally suitable, explain the choice briefly.
5. Before editing, state the selected issue, dependencies, in/out scope, acceptance criteria,
   likely files, and verification commands.
6. For issue-scoped work, recommend a dedicated branch named
   `<type>/<issue-id>-<short-slug>`. Do not disturb unrelated work to create it.
7. Implement and hand off strictly according to `AGENTS.md`, including its current verification
   sequence, domain decisions, quirk records, `PROGRESS.md`, and `docs/Handoff.md`.

Never open a pull request unless explicitly requested.

## Quick check

Before implementation, confirm: correct issue, dependencies complete, worktree understood,
scope bounded, branch strategy stated, and verification planned.
