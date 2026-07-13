import { describe, expect, it } from "vitest";

import {
  RATE_LIMIT_ENABLED,
  createClientRateLimitKey,
  createInMemoryRateLimiter,
  isRateLimitEnabled,
} from "./rate-limit";

describe("in-memory privacy-preserving rate limiting", () => {
  it("defaults RATE_LIMIT_ENABLED to true and can be explicitly disabled", () => {
    expect(RATE_LIMIT_ENABLED).toBe(true);
    expect(isRateLimitEnabled({})).toBe(true);
    expect(isRateLimitEnabled({ RATE_LIMIT_ENABLED: "false" })).toBe(false);
    expect(isRateLimitEnabled({ RATE_LIMIT_ENABLED: "0" })).toBe(false);
  });

  it("derives stable client keys without retaining full IP addresses or arbitrary headers", async () => {
    const key = await createClientRateLimitKey(new Headers({
      "x-forwarded-for": "203.0.113.8, 10.0.0.1",
      "user-agent": "Example Browser",
      authorization: "Bearer secret",
    }), "score");

    expect(key).toMatch(/^score:[a-f0-9]{64}$/);
    expect(key).not.toContain("203.0.113.8");
    expect(key).not.toContain("10.0.0.1");
    expect(key).not.toContain("Example Browser");
    expect(key).not.toContain("secret");
  });

  it("falls back to an anonymous key for absent or malformed client metadata", async () => {
    await expect(createClientRateLimitKey(new Headers(), "analyze")).resolves.toMatch(/^analyze:[a-f0-9]{64}$/);
    await expect(createClientRateLimitKey(new Headers({ "x-forwarded-for": "not an ip" }), "analyze")).resolves.toMatch(/^analyze:[a-f0-9]{64}$/);
  });

  it("returns route-friendly allowed, exhausted, and reset states under an injected clock", () => {
    let now = 1_000;
    const limiter = createInMemoryRateLimiter({ limit: 2, windowMs: 1_000, now: () => now });

    expect(limiter.check("client-a")).toEqual({ allowed: true, state: "allowed", remaining: 1, resetAt: 2_000 });
    expect(limiter.check("client-a")).toEqual({ allowed: true, state: "allowed", remaining: 0, resetAt: 2_000 });
    expect(limiter.check("client-a")).toEqual({ allowed: false, state: "exhausted", retryAfterSeconds: 1, resetAt: 2_000 });

    now = 2_000;
    expect(limiter.check("client-a")).toEqual({ allowed: true, state: "allowed", remaining: 1, resetAt: 3_000 });
  });

  it("bypasses limits when disabled with an explicit disabled state", () => {
    const limiter = createInMemoryRateLimiter({ limit: 0, windowMs: 1_000, enabled: false, now: () => 0 });

    expect(limiter.check("client-a")).toEqual({ allowed: true, state: "disabled", remaining: Number.POSITIVE_INFINITY, resetAt: null });
  });

  it("lazily evicts expired buckets within a bounded sweep", () => {
    let now = 0;
    const limiter = createInMemoryRateLimiter({ limit: 1, windowMs: 10, maxEntries: 3, evictionBatchSize: 2, now: () => now });

    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("b").allowed).toBe(true);
    expect(limiter.check("c").allowed).toBe(true);
    expect(limiter.snapshotKeys()).toEqual(["a", "b", "c"]);

    now = 11;
    expect(limiter.check("d").allowed).toBe(true);
    expect(limiter.snapshotKeys()).toEqual(["c", "d"]);
  });
});
