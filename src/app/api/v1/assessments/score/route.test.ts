import { ReadableStream } from "node:stream/web";
import { describe, expect, it } from "vitest";

import { STRUCTURED_QUESTIONS, type StructuredQuestion } from "@/domain/questionnaire";
import { QUESTIONNAIRE_VERSION } from "@/domain/versions";
import { createInMemoryRateLimiter } from "@/server/rate-limit";
import { POST, SCORE_REQUEST_BYTE_LIMIT, createScorePostHandler, scoreErrorResponseSchema, scoreSuccessResponseSchema } from "./route";

function optionWithScore(question: StructuredQuestion, target: number): string {
  const option = question.options.find((candidate) => candidate.score === target);
  if (!option) throw new Error(`No ${question.id} option scores ${target}`);
  return option.id;
}

function answersWithScore(score: number) {
  return STRUCTURED_QUESTIONS.map((question) => ({
    questionId: question.id,
    optionId: optionWithScore(question, score),
  }));
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    questionnaireVersion: QUESTIONNAIRE_VERSION,
    answers: answersWithScore(5),
    preferences: { includeAgeMetaphor: false },
    ...overrides,
  };
}

function jsonRequest(payload: unknown, init: RequestInit = {}) {
  return new Request("http://localhost/api/v1/assessments/score", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "content-type": "application/json", ...init.headers },
    ...init,
  });
}

function streamRequest(body: string, headers: HeadersInit = {}) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(body);
  return new Request("http://localhost/api/v1/assessments/score", {
    method: "POST",
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, Math.floor(bytes.length / 2)));
        controller.enqueue(bytes.slice(Math.floor(bytes.length / 2)));
        controller.close();
      },
    }),
    // Node Fetch requires duplex when a streaming body is used.
    duplex: "half",
    headers: { "content-type": "application/json", ...headers },
  } as RequestInit & { duplex: "half" });
}

describe("POST /api/v1/assessments/score", () => {
  it("returns a typed success response with an opaque UUID assessmentId", async () => {
    const response = await POST(jsonRequest(validPayload()));
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    const parsed = scoreSuccessResponseSchema.parse(body);
    expect(parsed.assessmentId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(parsed.result.questionnaireVersion).toBe(QUESTIONNAIRE_VERSION);
    expect(parsed.result.structuredMaturityIndex).toBe(100);
    expect(JSON.stringify(body)).not.toContain("ER01:C");
  });

  it("requires application/json", async () => {
    const response = await POST(
      new Request("http://localhost/api/v1/assessments/score", {
        method: "POST",
        body: JSON.stringify(validPayload()),
        headers: { "content-type": "text/plain" },
      }),
    );
    const body: unknown = await response.json();

    expect(response.status).toBe(415);
    expect(scoreErrorResponseSchema.parse(body).error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });

  it("rejects malformed JSON", async () => {
    const sentinel = "I014_SENTINEL_OPENAI_SECRET_DO_NOT_SHIP";
    const response = await POST(
      new Request("http://localhost/api/v1/assessments/score", {
        method: "POST",
        body: `{ "secret": "${sentinel}", nope`,
        headers: { "content-type": "application/json" },
      }),
    );
    const body: unknown = await response.json();

    expect(response.status).toBe(400);
    expect(scoreErrorResponseSchema.parse(body).error.code).toBe("MALFORMED_JSON");
    expect(JSON.stringify(body)).not.toContain(sentinel);
  });

  it("rejects invalid payload shapes with field errors", async () => {
    const response = await POST(jsonRequest({ questionnaireVersion: QUESTIONNAIRE_VERSION, answers: "nope" }));
    const body: unknown = await response.json();

    expect(response.status).toBe(400);
    const parsed = scoreErrorResponseSchema.parse(body);
    expect(parsed.error.code).toBe("INVALID_REQUEST");
    expect(parsed.error.fieldErrors.some((error) => error.path === "answers")).toBe(true);
  });

  it("rejects unknown IDs, duplicates, and version mismatch as an invalid answer set", async () => {
    const response = await POST(
      jsonRequest(
        validPayload({
          questionnaireVersion: "RMP-0.9",
          answers: [
            { questionId: "ZZ99", optionId: "A" },
            { questionId: "ER01", optionId: "Z" },
            { questionId: "ER02", optionId: "C" },
            { questionId: "ER02", optionId: "B" },
          ],
        }),
      ),
    );
    const body: unknown = await response.json();

    expect(response.status).toBe(422);
    const parsed = scoreErrorResponseSchema.parse(body);
    expect(parsed.error.code).toBe("INVALID_ANSWER_SET");
    expect(parsed.error.fieldErrors.map((error) => error.code)).toEqual([
      "VERSION_MISMATCH",
      "UNKNOWN_QUESTION",
      "UNKNOWN_OPTION",
      "DUPLICATE_ANSWER",
    ]);
  });

  it("rejects oversized ASCII bodies using Content-Length before reading", async () => {
    const response = await POST(
      new Request("http://localhost/api/v1/assessments/score", {
        method: "POST",
        body: "{}",
        headers: {
          "content-type": "application/json",
          "content-length": String(SCORE_REQUEST_BYTE_LIMIT + 1),
        },
      }),
    );
    const body: unknown = await response.json();

    expect(response.status).toBe(413);
    expect(scoreErrorResponseSchema.parse(body).error.code).toBe("REQUEST_TOO_LARGE");
  });

  it("rejects oversized ASCII bodies without Content-Length while streaming", async () => {
    const body = `{ "padding": "${"a".repeat(SCORE_REQUEST_BYTE_LIMIT)}" }`;
    const response = await POST(streamRequest(body));
    const parsed = scoreErrorResponseSchema.parse(await response.json());

    expect(response.status).toBe(413);
    expect(parsed.error.code).toBe("REQUEST_TOO_LARGE");
  });

  it("rejects oversized multibyte UTF-8 bodies without using JavaScript character count", async () => {
    const multibyte = "😀".repeat(Math.ceil(SCORE_REQUEST_BYTE_LIMIT / 4) + 1);
    expect(multibyte.length).toBeLessThan(SCORE_REQUEST_BYTE_LIMIT);

    const response = await POST(streamRequest(`{ "padding": "${multibyte}" }`));
    const parsed = scoreErrorResponseSchema.parse(await response.json());

    expect(response.status).toBe(413);
    expect(parsed.error.code).toBe("REQUEST_TOO_LARGE");
  });


  it("emits score request and completion events without answers", async () => {
    const events: unknown[] = [];
    const handler = createScorePostHandler({
      createClientKey: () => "score:test-client",
      createRequestId: () => "00000000-0000-4000-8000-000000000013",
      now: () => 0,
      emit: (event) => events.push(event),
    });

    const response = await handler(jsonRequest(validPayload()));

    expect(response.status).toBe(200);
    expect(events).toEqual([
      expect.objectContaining({ event: "score_requested", requestId: "00000000-0000-4000-8000-000000000013" }),
      expect.objectContaining({ event: "score_completed", requestId: "00000000-0000-4000-8000-000000000013", status: "success", questionnaireVersion: QUESTIONNAIRE_VERSION }),
    ]);
    expect(JSON.stringify(events)).not.toContain("ER01");
  });

  it("emits score rejection events without answers for invalid route input", async () => {
    const events: unknown[] = [];
    const handler = createScorePostHandler({
      createClientKey: () => "score:rejected-event-client",
      createRequestId: () => "00000000-0000-4000-8000-000000000015",
      now: () => 0,
      emit: (event) => events.push(event),
    });

    const response = await handler(jsonRequest({ questionnaireVersion: QUESTIONNAIRE_VERSION, answers: [{ questionId: "ER01", optionId: "Z" }] }));
    const body = scoreErrorResponseSchema.parse(await response.json());

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("INVALID_ANSWER_SET");
    expect(events).toEqual([
      expect.objectContaining({ event: "score_requested", requestId: "00000000-0000-4000-8000-000000000015" }),
      expect.objectContaining({ event: "score_rejected", requestId: "00000000-0000-4000-8000-000000000015", status: "rejected", errorCode: "INVALID_ANSWER_SET" }),
    ]);
    expect(JSON.stringify(events)).not.toContain('"questionId":"ER01"');
    expect(JSON.stringify(events)).not.toContain('"optionId":"Z"');
  });

  it("returns 429 with integer Retry-After when score rate limit is exhausted, then allows after reset", async () => {
    let now = 0;
    const handler = createScorePostHandler({
      createClientKey: () => "score:limited-client",
      createRequestId: () => "00000000-0000-4000-8000-000000000014",
      rateLimiter: createInMemoryRateLimiter({ limit: 1, windowMs: 1_000, now: () => now }),
      now: () => now,
      emit: () => undefined,
    });

    expect((await handler(jsonRequest(validPayload()))).status).toBe(200);
    const limited = await handler(jsonRequest(validPayload()));
    const body = scoreErrorResponseSchema.parse(await limited.json());

    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("1");
    expect(body.error.code).toBe("RATE_LIMITED");

    now = 1_000;
    expect((await handler(jsonRequest(validPayload()))).status).toBe(200);
  });

  it("derives a privacy-preserving anonymous route key for malformed client metadata", async () => {
    const limiter = createInMemoryRateLimiter({ limit: 1, windowMs: 1_000, now: () => 0 });
    const handler = createScorePostHandler({
      rateLimiter: limiter,
      createRequestId: () => "00000000-0000-4000-8000-000000000016",
      now: () => 0,
      emit: () => undefined,
    });

    const response = await handler(jsonRequest(validPayload(), { headers: { "content-type": "application/json", "x-forwarded-for": "not an ip", "user-agent": "Route Test Browser" } }));

    expect(response.status).toBe(200);
    expect(limiter.snapshotKeys()).toHaveLength(1);
    expect(limiter.snapshotKeys()[0]).toMatch(/^score:[a-f0-9]{64}$/);
    expect(limiter.snapshotKeys()[0]).not.toContain("not an ip");
    expect(limiter.snapshotKeys()[0]).not.toContain("Route Test Browser");
  });

  it("lazily evicts expired score buckets through the route with an injected clock", async () => {
    let now = 0;
    const limiter = createInMemoryRateLimiter({ limit: 1, windowMs: 10, maxEntries: 3, evictionBatchSize: 2, now: () => now });
    const handler = createScorePostHandler({
      rateLimiter: limiter,
      createRequestId: () => "00000000-0000-4000-8000-000000000017",
      now: () => now,
      emit: () => undefined,
    });

    for (const ip of ["203.0.113.1", "203.0.113.2", "203.0.113.3"]) {
      expect((await handler(jsonRequest(validPayload(), { headers: { "content-type": "application/json", "x-forwarded-for": ip, "user-agent": "Route Test Browser" } }))).status).toBe(200);
    }
    expect(limiter.snapshotKeys()).toHaveLength(3);

    now = 11;
    expect((await handler(jsonRequest(validPayload(), { headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.4", "user-agent": "Route Test Browser" } }))).status).toBe(200);
    expect(limiter.snapshotKeys()).toHaveLength(2);
  });
});
