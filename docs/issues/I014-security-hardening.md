# I014 — Application and transport security hardening

- **Status:** ⬜ not started
- **Phase:** D (cross-cutting)
- **Depends on:** I002, I008, I011, I019
- **Complexity:** 4

## Context

User narrative and model output are untrusted, provider credentials are server-only, and public
deployment must provide verifiable transport and browser defenses (PRD §10, §11, §15.4).

## Scope

**In:**

- Nonce- or hash-based production CSP with no `unsafe-inline` or `unsafe-eval` in `script-src`.
  Development-only allowances must be isolated from production configuration. Include
  `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, and restrictive connect/form
  sources.
- HSTS in production and documented hosting enforcement/redirect from HTTP to HTTPS. I018 will
  provide deployment-specific configuration; this issue provides application headers and a
  repeatable deployed-header check.
- Security headers for framing, MIME sniffing, referrer leakage, and browser permissions.
- Render user/model strings as text only. No raw HTML rendering path for narrative or analysis.
- Verify I002/I011 media type, strict schema, canonical IDs, word caps, and bounded byte readers;
  do not duplicate their business logic.
- Production dependency audit in I019 CI and automated scans of built client assets/source maps
  using sentinel secret values. Confirm API error/response serialization cannot echo secrets.
- CSRF protection only if cookie-authenticated or cookie-state mutation is introduced; otherwise
  document why same-origin JSON endpoints are not cookie-authorized.

**Out:** authentication, WAF/CDN rules, secret provisioning, business validation already owned by
I002/I011, E2E injection journey owned by I015.

## Acceptance criteria

- [ ] A production build response carries the strict script CSP and all required security headers;
      tests reject `unsafe-inline`/`unsafe-eval` in production `script-src`.
- [ ] Production HTTPS responsibility is executable and documented: HSTS is present and a deployed
      HTTP request redirects or is rejected before application content.
- [ ] Hostile narrative/model HTML renders literally; no `dangerouslySetInnerHTML` or equivalent
      accepts those values.
- [ ] Multibyte, chunked, malformed, oversized, unknown-ID, duplicate, and word-cap transport tests
      pass through real HTTP handlers.
- [ ] A build with sentinel provider secrets contains no sentinel in `.next/static`, browser source
      maps, rendered HTML, or API responses. The scan covers artifacts, not only source names.
- [ ] Production dependency audit fails CI at the documented severity threshold without duplicate
      audit steps.

## References

PRD §10, §11, §15.4, §23; I002, I011, I019.
