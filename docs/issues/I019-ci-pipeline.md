# I019 — Reproducible CI quality gates

- **Status:** ✅ done
- **Phase:** D (cross-cutting)
- **Depends on:** Phase 0
- **Complexity:** 2

## Context

Local verification is not a remote merge signal. CI must reproduce the Phase 0 gate with granular
failure output, use the repository's pinned tool versions, and require no provider secret.

## Scope

**In:**

- `.github/workflows/ci.yml` on every branch push and pull request.
- One Ubuntu job with checkout, pnpm setup, Node setup/cache, frozen install, typecheck, test, and
  production build as separately named sequential steps.
- Node 22. Omit the pnpm action's `version` input so it reads the exact version from
  `package.json#packageManager`; do not duplicate the version in YAML.
- Cache through `actions/setup-node` with `cache: pnpm` and the lockfile dependency path.
- AI remains disabled and no secret/environment file is required.
- A static workflow-contract test parses or inspects YAML to guard triggers, versions, command
  order, and absence of secret use. Later issues may add security/a11y/E2E jobs without collapsing
  these core steps into an opaque command.

**Out:** deployment, preview environments, provider calls, Playwright, dependency audit policy
owned by I014.

## Acceptance criteria

- [x] Push and pull-request triggers run frozen install → typecheck → test → build, with each command
      visible as its own failing step.
- [x] Node is `22`; pnpm version has exactly one source of truth in `package.json`.
- [x] Cache configuration depends on `pnpm-lock.yaml` and a clean install uses the lockfile.
- [x] CI succeeds with `AI_PROVIDER=none` and references no repository/environment secret.
- [x] Workflow-contract tests fail if a core step disappears, reorders, gains `continue-on-error`,
      or duplicates the pnpm version.
- [x] Action majors are pinned and dependency automation may update them independently without
      changing the workflow contract.

## References

AGENTS.md verification workflow; package engine/package-manager fields; PRD §23.
