import { NextResponse } from "next/server";

import { QUESTIONNAIRE_VERSION, SCORING_VERSION, PROMPT_VERSION } from "@/domain/versions";
import { emitEvent, type OperationalEvent } from "@/server/logging";
import { createClientRateLimitKey, createInMemoryRateLimiter, isRateLimitEnabled, type InMemoryRateLimiter } from "@/server/rate-limit";
import { buildScoreErrorResponse, scoreErrorResponseSchema } from "../score/score-service";
import { analysisResponseSchema, processAnalyzeAssessment, type AnalyzeProcessingDependencies } from "./analyze-service";

export { scoreErrorResponseSchema as analysisErrorResponseSchema } from "../score/score-service";
export { analysisResponseSchema, providerAnalysisSchema } from "./analyze-service";

export const ANALYZE_REQUEST_BYTE_LIMIT = 32 * 1024;
export const ANALYZE_RATE_LIMIT_WINDOW_MS = 60_000;
export const ANALYZE_RATE_LIMIT_MAX_REQUESTS = 20;

const defaultAnalyzeRateLimiter = createInMemoryRateLimiter({
  limit: ANALYZE_RATE_LIMIT_MAX_REQUESTS,
  windowMs: ANALYZE_RATE_LIMIT_WINDOW_MS,
  enabled: isRateLimitEnabled(),
});

type AnalyzeRouteDependencies = AnalyzeProcessingDependencies & {
  rateLimiter?: InMemoryRateLimiter;
  createClientKey?: (headers: Headers) => Promise<string> | string;
  emit?: (event: OperationalEvent) => void;
  now?: () => number;
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
  limitBytes = ANALYZE_REQUEST_BYTE_LIMIT,
): Promise<BoundedBodyResult> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const parsed = Number(contentLength);
    if (Number.isFinite(parsed) && parsed > limitBytes) return { ok: false, reason: "too_large" };
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

function currentTimestamp(deps: AnalyzeRouteDependencies): string {
  return new Date(deps.now?.() ?? Date.now()).toISOString();
}

function elapsedMs(deps: AnalyzeRouteDependencies, startedAt: number): number {
  return Math.max(0, (deps.now?.() ?? Date.now()) - startedAt);
}

function emitAnalyzeEvent(deps: AnalyzeRouteDependencies, event: OperationalEvent): void {
  (deps.emit ?? ((payload) => { emitEvent(payload); }))(event);
}

function rateLimitedResponse(retryAfterSeconds: number, requestId: string) {
  const error = buildScoreErrorResponse(
    429,
    "RATE_LIMITED",
    "Too many analyze requests. Try again later.",
    [{ path: "headers", code: "RATE_LIMITED" }],
    { createRequestId: () => requestId },
  );
  return NextResponse.json(error.body, { status: error.status, headers: { "Retry-After": String(retryAfterSeconds) } });
}

export function createAnalyzePostHandler(deps: AnalyzeRouteDependencies = {}) {
  return async function analyzePostHandler(request: Request) {
    const startedAt = deps.now?.() ?? Date.now();
    const requestId = (deps.createRequestId ?? randomId)();
    const limiter = deps.rateLimiter ?? defaultAnalyzeRateLimiter;
    const key = await (deps.createClientKey ?? ((headers) => createClientRateLimitKey(headers, "analyze")))(request.headers);
    const limit = limiter.check(key);
    if (!limit.allowed) {
      emitAnalyzeEvent(deps, { event: "analysis_unavailable", requestId, timestamp: currentTimestamp(deps), status: "unavailable", errorCode: "RATE_LIMITED" });
      return rateLimitedResponse(limit.retryAfterSeconds, requestId);
    }

    emitAnalyzeEvent(deps, { event: "analysis_requested", requestId, timestamp: currentTimestamp(deps), status: "requested" });

    if (!isJsonContentType(request.headers.get("content-type"))) {
      const error = buildScoreErrorResponse(415, "UNSUPPORTED_MEDIA_TYPE", "Requests to this endpoint must use application/json.", [{ path: "headers.content-type", code: "UNSUPPORTED_MEDIA_TYPE" }], { createRequestId: () => requestId });
      emitAnalyzeEvent(deps, { event: "analysis_unavailable", requestId, timestamp: currentTimestamp(deps), status: "unavailable", errorCode: error.body.error.code });
      return NextResponse.json(error.body, { status: error.status });
    }

    const body = await readBoundedUtf8Body(request);
    if (body.ok === false) {
      const { reason } = body;
      const error = buildScoreErrorResponse(
        reason === "too_large" ? 413 : 400,
        reason === "too_large" ? "REQUEST_TOO_LARGE" : "MALFORMED_JSON",
        reason === "too_large" ? "The request body exceeds the 32 KiB limit." : "The request body could not be read as JSON.",
        reason === "too_large" ? [{ path: "body", code: "REQUEST_TOO_LARGE" }] : [],
        { createRequestId: () => requestId },
      );
      emitAnalyzeEvent(deps, { event: "analysis_unavailable", requestId, timestamp: currentTimestamp(deps), status: "unavailable", errorCode: error.body.error.code });
      return NextResponse.json(error.body, { status: error.status });
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(body.text);
    } catch {
      const error = buildScoreErrorResponse(400, "MALFORMED_JSON", "The request body must be valid JSON.", [{ path: "body", code: "MALFORMED_JSON" }], { createRequestId: () => requestId });
      emitAnalyzeEvent(deps, { event: "analysis_unavailable", requestId, timestamp: currentTimestamp(deps), status: "unavailable", errorCode: error.body.error.code });
      return NextResponse.json(error.body, { status: error.status });
    }

    const testScenario = request.headers.get("x-rmp-test-scenario");
    const testTraceId = request.headers.get("x-rmp-test-trace-id");
    const testProviderEnv = process.env.E2E_TEST_MODE === "1" && testScenario && testTraceId
      ? { E2E_TEST_MODE: "1", TEST_AI_PROVIDER: "1", TEST_AI_SCENARIO: testScenario, TEST_AI_TRACE_ID: testTraceId }
      : undefined;
    const result = await processAnalyzeAssessment(parsedJson, { ...deps, ...(testProviderEnv ? { env: testProviderEnv } : {}), createRequestId: () => requestId });
    const latencyMs = elapsedMs(deps, startedAt);
    if (!result.ok) {
      const responseBody = scoreErrorResponseSchema.parse(result.body);
      emitAnalyzeEvent(deps, { event: "analysis_unavailable", requestId, timestamp: currentTimestamp(deps), status: "unavailable", errorCode: responseBody.error.code, latencyMs });
      return NextResponse.json(responseBody, { status: result.status });
    }

    const responseBody = analysisResponseSchema.parse(result.body);
    if (responseBody.status === "completed") {
      emitAnalyzeEvent(deps, { event: "analysis_completed", requestId, timestamp: currentTimestamp(deps), questionnaireVersion: QUESTIONNAIRE_VERSION, scoringVersion: SCORING_VERSION, promptVersion: PROMPT_VERSION, status: "success", latencyMs });
    } else if (responseBody.status === "safety_interruption") {
      emitAnalyzeEvent(deps, { event: "safety_interrupted", requestId, timestamp: currentTimestamp(deps), status: "interrupted", errorCode: responseBody.safetyMessage.category.toUpperCase(), latencyMs });
    } else {
      emitAnalyzeEvent(deps, { event: "analysis_unavailable", requestId, timestamp: currentTimestamp(deps), status: "unavailable", errorCode: responseBody.status === "not_scored" ? responseBody.reason.toUpperCase() : responseBody.reason.toUpperCase(), latencyMs });
    }
    return NextResponse.json(responseBody, { status: result.status });
  };
}

export const POST = createAnalyzePostHandler();

export { scoreErrorResponseSchema };
