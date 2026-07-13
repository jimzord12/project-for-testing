export const RATE_LIMIT_ENABLED = true;

export type RateLimitEndpoint = "score" | "analyze";

export type RateLimitAllowed = { allowed: true; state: "allowed"; remaining: number; resetAt: number };
export type RateLimitDisabled = { allowed: true; state: "disabled"; remaining: number; resetAt: null };
export type RateLimitExceeded = { allowed: false; state: "exhausted"; retryAfterSeconds: number; resetAt: number };
export type RateLimitResult = RateLimitAllowed | RateLimitDisabled | RateLimitExceeded;

export type InMemoryRateLimiter = {
  check: (key: string) => RateLimitResult;
  snapshotKeys: () => string[];
  reset: () => void;
};

type RateLimiterOptions = {
  limit: number;
  windowMs: number;
  enabled?: boolean;
  now?: () => number;
  maxEntries?: number;
  evictionBatchSize?: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

export function isRateLimitEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const value = env.RATE_LIMIT_ENABLED;
  if (value === undefined || value === "") return true;
  return !["0", "false", "off", "no"].includes(value.trim().toLowerCase());
}

function isLikelyIp(value: string): boolean {
  const candidate = value.trim();
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(candidate)) {
    return candidate.split(".").every((part) => Number(part) >= 0 && Number(part) <= 255);
  }
  return /^[0-9a-f:]+$/i.test(candidate) && candidate.includes(":");
}

function primaryForwardedFor(headers: Headers): string | null {
  const raw = headers.get("x-forwarded-for") ?? headers.get("x-real-ip");
  const candidate = raw?.split(",")[0]?.trim() ?? "";
  return candidate && isLikelyIp(candidate) ? candidate : null;
}

function coarseClientMaterial(headers: Headers): string {
  const ip = primaryForwardedFor(headers) ?? "anonymous";
  const userAgent = headers.get("user-agent") ?? "unknown-agent";
  // Hash input is used only transiently; the returned key is the only retained value.
  return `${ip}|${userAgent.slice(0, 80)}`;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createClientRateLimitKey(headers: Headers, endpoint: RateLimitEndpoint): Promise<string> {
  const material = `${endpoint}|${coarseClientMaterial(headers)}`;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  return `${endpoint}:${bytesToHex(new Uint8Array(digest))}`;
}

export function createInMemoryRateLimiter(options: RateLimiterOptions): InMemoryRateLimiter {
  const buckets = new Map<string, Bucket>();
  const enabled = options.enabled ?? true;
  const now = options.now ?? Date.now;
  const maxEntries = options.maxEntries ?? 10_000;
  const evictionBatchSize = options.evictionBatchSize ?? 100;

  function evictExpired(currentTime: number): void {
    let checked = 0;
    for (const [key, bucket] of buckets) {
      if (checked >= evictionBatchSize) break;
      checked += 1;
      if (bucket.resetAt <= currentTime) buckets.delete(key);
    }
  }

  function evictOldestUntilBounded(): void {
    while (buckets.size >= maxEntries) {
      const oldest = buckets.keys().next().value as string | undefined;
      if (!oldest) break;
      buckets.delete(oldest);
    }
  }

  return {
    check(key: string): RateLimitResult {
      if (!enabled) return { allowed: true, state: "disabled", remaining: Number.POSITIVE_INFINITY, resetAt: null };
      const currentTime = now();
      evictExpired(currentTime);
      let bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= currentTime) {
        evictOldestUntilBounded();
        bucket = { count: 0, resetAt: currentTime + options.windowMs };
        buckets.set(key, bucket);
      }

      if (bucket.count >= options.limit) {
        return {
          allowed: false,
          state: "exhausted",
          retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - currentTime) / 1000)),
          resetAt: bucket.resetAt,
        };
      }

      bucket.count += 1;
      return { allowed: true, state: "allowed", remaining: Math.max(0, options.limit - bucket.count), resetAt: bucket.resetAt };
    },
    snapshotKeys() {
      return Array.from(buckets.keys());
    },
    reset() {
      buckets.clear();
    },
  };
}
