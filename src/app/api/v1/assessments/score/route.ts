import { NextResponse } from "next/server";

import { QUESTIONNAIRE_VERSION, SCORING_VERSION } from "@/domain/versions";
import { emitEvent, type OperationalEvent } from "@/server/logging";
import { createClientRateLimitKey, createInMemoryRateLimiter, isRateLimitEnabled, type InMemoryRateLimiter } from "@/server/rate-limit";
import {
  buildScoreErrorResponse,
  fieldErrorsFromZodError,
  processScoreAssessment,
  scoreErrorResponseSchema,
  scoreRequestSchema,
  scoreSuccessResponseSchema,
} from "./score-service";

export { scoreErrorResponseSchema, scoreSuccessResponseSchema } from "./score-service";

export const SCORE_REQUEST_BYTE_LIMIT = 16 * 1024;
export const SCORE_RATE_LIMIT_WINDOW_MS = 60_000;
export const SCORE_RATE_LIMIT_MAX_REQUESTS = 60;

const defaultScoreRateLimiter = createInMemoryRateLimiter({
  limit: SCORE_RATE_LIMIT_MAX_REQUESTS,
  windowMs: SCORE_RATE_LIMIT_WINDOW_MS,
  enabled: isRateLimitEnabled(),
});

type ScoreRouteDependencies = {
  rateLimiter?: InMemoryRateLimiter;
  createClientKey?: (headers: Headers) => Promise<string> | string;
  emit?: (event: OperationalEvent) => void;
  now?: () => number;
  createRequestId?: () => string;
};

type BoundedBodyResult =
  | { ok: true; text: string }
  | { ok: false; reason: "too_large" | "read_error" };

function isJsonContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  return contentType
    .split(";")[0]
    ?.trim()
    .toLowerCase() === "application/json";
}

export async function readBoundedUtf8Body(
  request: Request,
  limitBytes = SCORE_REQUEST_BYTE_LIMIT,
): Promise<BoundedBodyResult> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const parsed = Number(contentLength);
    if (Number.isFinite(parsed) && parsed > limitBytes) {
      return { ok: false, reason: "too_large" };
    }
  }

  if (!request.body) return { ok: true, text: "" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > limitBytes) {
        await reader.cancel();
        return { ok: false, reason: "too_large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: "read_error" };
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, text: new TextDecoder().decode(bytes) };
}

function randomId(): string {
  return globalThis.crypto.randomUUID();
}

function currentTimestamp(deps: ScoreRouteDependencies): string {
  return new Date(deps.now?.() ?? Date.now()).toISOString();
}

function elapsedMs(deps: ScoreRouteDependencies, startedAt: number): number {
  return Math.max(0, (deps.now?.() ?? Date.now()) - startedAt);
}

function emitScoreEvent(deps: ScoreRouteDependencies, event: OperationalEvent): void {
  (deps.emit ?? ((payload) => { emitEvent(payload); }))(event);
}

function rateLimitedResponse(retryAfterSeconds: number, requestId: string) {
  const error = buildScoreErrorResponse(
    429,
    "RATE_LIMITED",
    "Too many score requests. Try again later.",
    [{ path: "headers", code: "RATE_LIMITED" }],
    { createRequestId: () => requestId },
  );
  return NextResponse.json(error.body, { status: error.status, headers: { "Retry-After": String(retryAfterSeconds) } });
}

export function createScorePostHandler(deps: ScoreRouteDependencies = {}) {
  return async function scorePostHandler(request: Request) {
    const startedAt = deps.now?.() ?? Date.now();
    const requestId = (deps.createRequestId ?? randomId)();
    const limiter = deps.rateLimiter ?? defaultScoreRateLimiter;
    const key = await (deps.createClientKey ?? ((headers) => createClientRateLimitKey(headers, "score")))(request.headers);
    const limit = limiter.check(key);
    if (!limit.allowed) {
      emitScoreEvent(deps, { event: "score_rejected", requestId, timestamp: currentTimestamp(deps), status: "rejected", errorCode: "RATE_LIMITED" });
      return rateLimitedResponse(limit.retryAfterSeconds, requestId);
    }

    emitScoreEvent(deps, { event: "score_requested", requestId, timestamp: currentTimestamp(deps), status: "requested" });

    if (!isJsonContentType(request.headers.get("content-type"))) {
      const error = buildScoreErrorResponse(
        415,
        "UNSUPPORTED_MEDIA_TYPE",
        "Requests to this endpoint must use application/json.",
        [{ path: "headers.content-type", code: "UNSUPPORTED_MEDIA_TYPE" }],
        { createRequestId: () => requestId },
      );
      emitScoreEvent(deps, { event: "score_rejected", requestId, timestamp: currentTimestamp(deps), status: "rejected", errorCode: error.body.error.code });
      return NextResponse.json(error.body, { status: error.status });
    }

    const body = await readBoundedUtf8Body(request);
    if (!body.ok) {
      const error = buildScoreErrorResponse(
        body.reason === "too_large" ? 413 : 400,
        body.reason === "too_large" ? "REQUEST_TOO_LARGE" : "MALFORMED_JSON",
        body.reason === "too_large"
          ? "The request body exceeds the 16 KiB limit."
          : "The request body could not be read as JSON.",
        body.reason === "too_large" ? [{ path: "body", code: "REQUEST_TOO_LARGE" }] : [],
        { createRequestId: () => requestId },
      );
      emitScoreEvent(deps, { event: "score_rejected", requestId, timestamp: currentTimestamp(deps), status: "rejected", errorCode: error.body.error.code });
      return NextResponse.json(error.body, { status: error.status });
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(body.text);
    } catch {
      const error = buildScoreErrorResponse(
        400,
        "MALFORMED_JSON",
        "The request body must be valid JSON.",
        [{ path: "body", code: "MALFORMED_JSON" }],
        { createRequestId: () => requestId },
      );
      emitScoreEvent(deps, { event: "score_rejected", requestId, timestamp: currentTimestamp(deps), status: "rejected", errorCode: error.body.error.code });
      return NextResponse.json(error.body, { status: error.status });
    }

    const parsedRequest = scoreRequestSchema.safeParse(parsedJson);
    if (!parsedRequest.success) {
      const error = buildScoreErrorResponse(
        400,
        "INVALID_REQUEST",
        "The request body does not match the score API contract.",
        fieldErrorsFromZodError(parsedRequest.error),
        { createRequestId: () => requestId },
      );
      emitScoreEvent(deps, { event: "score_rejected", requestId, timestamp: currentTimestamp(deps), status: "rejected", errorCode: error.body.error.code });
      return NextResponse.json(error.body, { status: error.status });
    }

    const result = processScoreAssessment(parsedRequest.data, { createRequestId: () => requestId });
    emitScoreEvent(deps, result.ok
      ? {
          event: "score_completed",
          requestId,
          timestamp: currentTimestamp(deps),
          questionnaireVersion: QUESTIONNAIRE_VERSION,
          scoringVersion: SCORING_VERSION,
          status: "success",
          latencyMs: elapsedMs(deps, startedAt),
        }
      : { event: "score_rejected", requestId, timestamp: currentTimestamp(deps), status: "rejected", errorCode: result.body.error.code });
    return NextResponse.json(result.body, { status: result.status });
  };
}

export const POST = createScorePostHandler();
