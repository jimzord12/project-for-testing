import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { middleware } from "../../middleware";
import { buildSecurityHeaders, createCspNonce } from "./security-headers";

function scriptSrc(csp: string): string {
  const directive = csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("script-src "));
  if (!directive) throw new Error(`missing script-src in ${csp}`);
  return directive;
}

function requiredHeader(headers: Record<string, string>, name: string): string {
  const value = headers[name];
  if (!value) throw new Error(`missing header ${name}`);
  return value;
}

function readSourceFiles(root: string): string[] {
  const entries = readdirSync(root, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return readSourceFiles(path);
    if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) return [];
    return [path];
  });
}

describe("I014 production security headers", () => {
  it("builds a nonce-based production CSP and required browser security headers", () => {
    const headers = buildSecurityHeaders({ nonce: "abc123+/=", production: true });
    const csp = requiredHeader(headers, "Content-Security-Policy");

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(scriptSrc(csp)).toContain("'nonce-abc123+/='");
    expect(scriptSrc(csp)).not.toContain("'unsafe-inline'");
    expect(scriptSrc(csp)).not.toContain("'unsafe-eval'");
    expect(headers["Strict-Transport-Security"]).toBe("max-age=63072000; includeSubDomains; preload");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toContain("camera=()");
  });

  it("isolates development-only script allowances from production", () => {
    const productionScript = scriptSrc(requiredHeader(buildSecurityHeaders({ nonce: "prodnonce", production: true }), "Content-Security-Policy"));
    const development = buildSecurityHeaders({ nonce: "devnonce", production: false });
    const developmentScript = scriptSrc(requiredHeader(development, "Content-Security-Policy"));

    expect(productionScript).not.toContain("'unsafe-inline'");
    expect(productionScript).not.toContain("'unsafe-eval'");
    expect(developmentScript).toContain("'unsafe-inline'");
    expect(developmentScript).toContain("'unsafe-eval'");
    expect(development).not.toHaveProperty("Strict-Transport-Security");
  });

  it("generates a fresh base64 CSP nonce", () => {
    const first = createCspNonce();
    const second = createCspNonce();

    expect(first).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(first.length).toBeGreaterThanOrEqual(22);
    expect(second).not.toBe(first);
  });

  it("forwards the response CSP on the request so Next.js can nonce rendered scripts", () => {
    const response = middleware({ headers: new Headers() } as NextRequest);
    const csp = response.headers.get("content-security-policy");
    const overrideHeaders = response.headers.get("x-middleware-override-headers")?.split(",") ?? [];

    expect(csp).toBeTruthy();
    expect(overrideHeaders).toContain("content-security-policy");
    expect(response.headers.get("x-middleware-request-content-security-policy")).toBe(csp);
  });

  it("opts the app shell out of static prerendering so per-request CSP nonces can reach scripts", () => {
    const layoutSource = readFileSync(join(process.cwd(), "src", "app", "layout.tsx"), "utf8");

    expect(layoutSource).toContain('export const dynamic = "force-dynamic"');
  });

  it("keeps raw HTML rendering sinks out of non-test source", () => {
    const offenders = readSourceFiles(join(process.cwd(), "src"))
      .filter((file) => !file.endsWith(".test.ts") && !file.endsWith(".test.tsx"))
      .filter((file) => /dangerouslySetInnerHTML|\.innerHTML\s*=|insertAdjacentHTML/.test(readFileSync(file, "utf8")));

    expect(offenders).toEqual([]);
  });

  it("adds one production dependency audit step and one sentinel secret scan script to CI", () => {
    const workflow = readFileSync(join(process.cwd(), ".github", "workflows", "ci.yml"), "utf8");
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { scripts?: Record<string, string> };
    const scriptPath = join(process.cwd(), "scripts", "scan-sentinel-secrets.mjs");

    expect(workflow.match(/pnpm audit/g) ?? []).toHaveLength(1);
    expect(workflow).toContain("pnpm audit --prod --audit-level=high");
    expect(workflow).toContain("pnpm security:scan-secrets");
    expect(packageJson.scripts?.["security:scan-secrets"]).toBe("node scripts/scan-sentinel-secrets.mjs");
    expect(statSync(scriptPath).isFile()).toBe(true);
  });
});
