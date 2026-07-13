import { ReadableStream } from "node:stream/web";
import { describe, expect, it, vi } from "vitest";

import { STRUCTURED_QUESTIONS, type StructuredQuestion } from "@/domain/questionnaire";
import { QUESTIONNAIRE_VERSION, PROMPT_VERSION } from "@/domain/versions";
import { createInMemoryRateLimiter } from "@/server/rate-limit";
import type { SafetyDecision } from "@/server/safety-service";
import {
  analysisResponseSchema as serviceAnalysisResponseSchema,
  completedAnalysisResponseSchema,
  notScoredAnalysisResponseSchema,
  safetyInterruptionAnalysisResponseSchema,
  unavailableAnalysisResponseSchema,
} from "./analyze-service";
import { POST, ANALYZE_REQUEST_BYTE_LIMIT, createAnalyzePostHandler } from "./route";
import { analysisErrorResponseSchema, analysisResponseSchema } from "./route";

function optionWithScore(question: StructuredQuestion, target: number): string {
  const option = question.options.find((candidate) => candidate.score === target);
  if (!option) throw new Error(`No ${question.id} option scores ${target}`);
  return option.id;
}

function answersWithScore(score: number) {
  return STRUCTURED_QUESTIONS.map((question) => ({ questionId: question.id, optionId: optionWithScore(question, score) }));
}

const n01 = {
  skipped: false,
  fields: {
    event:
      "In a project conflict I interrupted my teammate, noticed their shoulders drop, paused, apologized, and asked them to finish before I replied.",
    selfStory:
      "I was telling myself that speed mattered more than respect because the deadline felt close and I wanted control.",
    newUnderstanding:
      "Now I understand the urgency was real but my reaction reduced trust, so I need a pause before correcting someone publicly.",
  },
};

const n02 = {
  skipped: false,
  fields: {
    pattern:
      "I keep volunteering for extra work when senior people are present, then I become resentful and rush my own priorities later.",
    contexts: "It appears in planning meetings where I want to seem reliable and calm.",
    unknown: "I am unsure whether I fear disappointing people or enjoy being seen as unusually capable.",
  },
};

function payload(overrides: Record<string, unknown> = {}) {
  return {
    questionnaireVersion: QUESTIONNAIRE_VERSION,
    answers: answersWithScore(5),
    narratives: { N01: { skipped: true, fields: {} }, N02: { skipped: true, fields: {} } },
    consent: { aiAnalysis: true },
    ...overrides,
  };
}

function rubricCriterion(score: 0 | 1 | 2, evidenceExcerpt: string | null = null) {
  return { score, rationale: "Concrete one sentence rationale.", evidenceExcerpt };
}

function providerOutput(overrides: Record<string, unknown> = {}) {
  return {
    promptVersion: PROMPT_VERSION,
    headline: "A concrete profile with mostly deliberate repair",
    observations: [
      {
        observedPattern: "You often pause after noticing relational impact.",
        possibleInterpretation: "This may show repair is available after the first reaction.",
        evidence: [{ kind: "narrative_excerpt", exerciseId: "N01", excerpt: "paused, apologized, and asked them to finish" }],
      },
      {
        observedPattern: "High-pressure choices still pull you toward control.",
        possibleInterpretation: "The deadline may narrow your attention before you update.",
        evidence: [{ kind: "question", questionId: "ER05", optionId: optionWithScore(STRUCTURED_QUESTIONS[4]!, 5) }],
      },
      {
        observedPattern: "Approval contexts appear connected to overcommitment.",
        possibleInterpretation: "Reliability may be partly useful and partly status-protective.",
        evidence: [{ kind: "narrative_excerpt", exerciseId: "N02", excerpt: "volunteering for extra work when senior people are present" }],
      },
    ],
    narrativeRubric: {
      specificity: rubricCriterion(2, "project conflict"),
      ownership: rubricCriterion(2, "I interrupted my teammate"),
      emotionalPrecision: rubricCriterion(1, "deadline felt close"),
      causalDepth: rubricCriterion(2, "wanted control"),
      qualityOfUncertainty: rubricCriterion(2, "I am unsure whether I fear disappointing people"),
      behavioralIntegration: rubricCriterion(2, "I need a pause before correcting someone publicly"),
      performativeAbstractionPenalty: rubricCriterion(0, null),
    },
    narrativeReflection: "Your narrative names the first reaction and the later repair without turning it into a global flaw.",
    behavioralExperiments: [
      {
        dimension: "ER",
        trigger: "When you notice deadline pressure in a discussion",
        action: "Ask one clarifying question before correcting the other person.",
        measurement: "Record whether the other person finished their point before you replied.",
        reviewPeriodDays: 14,
        stopCondition: "Stop if the pause delays an actual safety or operational emergency.",
      },
      {
        dimension: "NSA",
        trigger: "Before accepting extra work in a status-heavy meeting",
        action: "State one current commitment before you answer yes or no.",
        measurement: "Track whether the commitment list changes your answer.",
        reviewPeriodDays: 21,
        stopCondition: "Stop if the check becomes a way to avoid all cooperative help.",
      },
    ],
    uncertaintyNote: "These interpretations are bounded by self-report and the current response set.",
    ...overrides,
  };
}

function request(body: unknown, init: RequestInit = {}) {
  return new Request("http://localhost/api/v1/assessments/analyze", {
    ...init,
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...init.headers },
  });
}

function streamRequest(body: string, headers: HeadersInit = {}) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(body);
  return new Request("http://localhost/api/v1/assessments/analyze", {
    method: "POST",
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, Math.floor(bytes.length / 2)));
        controller.enqueue(bytes.slice(Math.floor(bytes.length / 2)));
        controller.close();
      },
    }),
    duplex: "half",
    headers: { "content-type": "application/json", ...headers },
  } as RequestInit & { duplex: "half" });
}

describe("POST /api/v1/assessments/analyze", () => {
  it("exports shared strict response contracts for the route and each response variant", async () => {
    const handler = createAnalyzePostHandler({
      classifySafety: vi.fn().mockResolvedValue({ kind: "allow", source: "provider" } satisfies SafetyDecision),
      generate: vi.fn().mockResolvedValue({ ok: true, object: providerOutput() }),
    });

    const completedResponse = await handler(request(payload({ narratives: { N01: n01, N02: n02 } })));
    const completed = serviceAnalysisResponseSchema.parse(await completedResponse.json());
    expect(completedAnalysisResponseSchema.parse(completed).status).toBe("completed");
    expect(completedAnalysisResponseSchema.safeParse({ ...completed, rawNarrative: "leak" }).success).toBe(false);

    const notScoredResponse = await POST(request(payload()));
    const notScored = serviceAnalysisResponseSchema.parse(await notScoredResponse.json());
    expect(notScoredAnalysisResponseSchema.parse(notScored).status).toBe("not_scored");
    expect(notScoredAnalysisResponseSchema.safeParse({ ...notScored, rawPrompt: "leak" }).success).toBe(false);

    const safetyHandler = createAnalyzePostHandler({
      classifySafety: vi.fn().mockResolvedValue({ kind: "interrupt", category: "self_harm_immediate", source: "rule" } satisfies SafetyDecision),
      generate: vi.fn(),
    });
    const safetyResponse = await safetyHandler(
      request(payload({ narratives: { N01: { skipped: false, fields: { event: "I will kill myself tonight.", selfStory: "", newUnderstanding: "" } }, N02: { skipped: true, fields: {} } } })),
    );
    const safety = serviceAnalysisResponseSchema.parse(await safetyResponse.json());
    expect(safetyInterruptionAnalysisResponseSchema.parse(safety).status).toBe("safety_interruption");
    expect(safetyInterruptionAnalysisResponseSchema.safeParse({ ...safety, fullPrompt: "leak" }).success).toBe(false);

    const unavailableHandler = createAnalyzePostHandler({
      classifySafety: vi.fn().mockResolvedValue({ kind: "allow", source: "provider" } satisfies SafetyDecision),
      generate: vi.fn().mockResolvedValue({ ok: false, reason: "timeout" }),
    });
    const unavailableResponse = await unavailableHandler(request(payload({ narratives: { N01: n01, N02: n02 } })));
    const unavailable = serviceAnalysisResponseSchema.parse(await unavailableResponse.json());
    expect(unavailableAnalysisResponseSchema.parse(unavailable).status).toBe("unavailable");
    expect(unavailableAnalysisResponseSchema.safeParse({ ...unavailable, rawModelOutput: "leak" }).success).toBe(false);
  });

  it("returns a typed not_scored union for valid consented requests without narrative content", async () => {
    const response = await POST(request(payload()));
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    const parsed = analysisResponseSchema.parse(body);
    expect(parsed.status).toBe("not_scored");
    expect(JSON.stringify(parsed)).not.toContain("fields");
  });

  it("returns a typed completed union from the HTTP route", async () => {
    const handler = createAnalyzePostHandler({
      classifySafety: vi.fn().mockResolvedValue({ kind: "allow", source: "provider" } satisfies SafetyDecision),
      generate: vi.fn().mockResolvedValue({ ok: true, object: providerOutput() }),
    });

    const response = await handler(request(payload({ narratives: { N01: n01, N02: n02 } })));
    const body: unknown = await response.json();
    const parsed = analysisResponseSchema.parse(body);

    expect(response.status).toBe(200);
    expect(parsed.status).toBe("completed");
    if (parsed.status !== "completed") throw new Error("expected completed");
    expect(parsed.analysis).toHaveProperty("narrativeScore");
    expect(analysisResponseSchema.safeParse({ ...parsed, rawPrompt: "leak" }).success).toBe(false);
    expect(analysisResponseSchema.safeParse({ ...parsed, deterministicResult: { ...parsed.deterministicResult, rawNarrative: "leak" } }).success).toBe(false);
    expect(analysisResponseSchema.safeParse({ ...parsed, analysis: { ...parsed.analysis, rawModelOutput: "leak" } }).success).toBe(false);
  });

  it("returns a typed safety_interruption union from the HTTP route", async () => {
    const generate = vi.fn();
    const handler = createAnalyzePostHandler({
      classifySafety: vi.fn().mockResolvedValue({ kind: "interrupt", category: "self_harm_immediate", source: "rule" } satisfies SafetyDecision),
      generate,
    });

    const response = await handler(
      request(payload({ narratives: { N01: { skipped: false, fields: { event: "I will kill myself tonight.", selfStory: "", newUnderstanding: "" } }, N02: { skipped: true, fields: {} } } })),
    );
    const parsed = analysisResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(parsed.status).toBe("safety_interruption");
    expect(generate).not.toHaveBeenCalled();
    expect(JSON.stringify(parsed)).not.toContain("kill myself");
  });

  it("returns a typed unavailable union from the HTTP route", async () => {
    const handler = createAnalyzePostHandler({
      classifySafety: vi.fn().mockResolvedValue({ kind: "allow", source: "provider" } satisfies SafetyDecision),
      generate: vi.fn().mockResolvedValue({ ok: false, reason: "timeout" }),
    });

    const response = await handler(request(payload({ narratives: { N01: n01, N02: n02 } })));
    const parsed = analysisResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(parsed).toMatchObject({ status: "unavailable", reason: "timeout" });
  });

  it("requires application/json and valid JSON", async () => {
    const sentinel = "I014_SENTINEL_ANTHROPIC_SECRET_DO_NOT_SHIP";
    const unsupported = await POST(new Request("http://localhost/api/v1/assessments/analyze", { method: "POST", body: "{}", headers: { "content-type": "text/plain" } }));
    expect(unsupported.status).toBe(415);
    expect(analysisErrorResponseSchema.parse(await unsupported.json()).error.code).toBe("UNSUPPORTED_MEDIA_TYPE");

    const malformed = await POST(new Request("http://localhost/api/v1/assessments/analyze", { method: "POST", body: `{ "secret": "${sentinel}", nope`, headers: { "content-type": "application/json" } }));
    const malformedBody = await malformed.json();
    expect(malformed.status).toBe(400);
    expect(analysisErrorResponseSchema.parse(malformedBody).error.code).toBe("MALFORMED_JSON");
    expect(JSON.stringify(malformedBody)).not.toContain(sentinel);
  });

  it("rejects missing or false consent before safety or provider work", async () => {
    const classifySafety = vi.fn().mockResolvedValue({ kind: "allow", source: "provider" } satisfies SafetyDecision);
    const generate = vi.fn().mockResolvedValue({ ok: true, object: providerOutput() });
    const handler = createAnalyzePostHandler({ classifySafety, generate });

    for (const body of [payload({ consent: undefined }), payload({ consent: { aiAnalysis: false } })]) {
      const response = await handler(request(body));

      expect(response.status).toBe(400);
      expect(analysisErrorResponseSchema.parse(await response.json()).error.code).toBe("INVALID_REQUEST");
    }

    expect(classifySafety).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  it("rejects invalid answer sets", async () => {
    const invalidAnswers = await POST(request(payload({ answers: [{ questionId: "ER01", optionId: "Z" }] })));
    expect(invalidAnswers.status).toBe(422);
    expect(analysisErrorResponseSchema.parse(await invalidAnswers.json()).error.code).toBe("INVALID_ANSWER_SET");
  });

  it("enforces a 32 KiB UTF-8 request body limit by byte length", async () => {
    const headerRejected = await POST(request(payload(), { headers: { "content-length": String(ANALYZE_REQUEST_BYTE_LIMIT + 1) } }));
    expect(headerRejected.status).toBe(413);
    expect(analysisErrorResponseSchema.parse(await headerRejected.json()).error.code).toBe("REQUEST_TOO_LARGE");

    const multibyte = "😀".repeat(Math.ceil(ANALYZE_REQUEST_BYTE_LIMIT / 4) + 1);
    expect(multibyte.length).toBeLessThan(ANALYZE_REQUEST_BYTE_LIMIT);
    const streamed = await POST(streamRequest(`{ "padding": "${multibyte}" }`));
    expect(streamed.status).toBe(413);
    expect(analysisErrorResponseSchema.parse(await streamed.json()).error.code).toBe("REQUEST_TOO_LARGE");
  });


  it("emits analysis request, completed, safety, and unavailable events without raw narrative", async () => {
    const events: unknown[] = [];
    const handler = createAnalyzePostHandler({
      createClientKey: () => "analyze:event-client",
      createRequestId: () => "00000000-0000-4000-8000-000000000015",
      now: () => 0,
      emit: (event) => events.push(event),
      classifySafety: vi.fn().mockResolvedValue({ kind: "allow", source: "provider" } satisfies SafetyDecision),
      generate: vi.fn().mockResolvedValue({ ok: true, object: providerOutput() }),
    });

    const response = await handler(request(payload({ narratives: { N01: n01, N02: n02 } })));

    expect(response.status).toBe(200);
    expect(events).toEqual([
      expect.objectContaining({ event: "analysis_requested", requestId: "00000000-0000-4000-8000-000000000015" }),
      expect.objectContaining({ event: "analysis_completed", requestId: "00000000-0000-4000-8000-000000000015", status: "success" }),
    ]);
    expect(JSON.stringify(events)).not.toContain("interrupted my teammate");
    expect(JSON.stringify(events)).not.toContain("volunteering for extra work");
  });

  it("emits a safety interruption event from the route without raw narrative", async () => {
    const events: unknown[] = [];
    const generate = vi.fn();
    const handler = createAnalyzePostHandler({
      createClientKey: () => "analyze:safety-event-client",
      createRequestId: () => "00000000-0000-4000-8000-000000000017",
      now: () => 0,
      emit: (event) => events.push(event),
      classifySafety: vi.fn().mockResolvedValue({ kind: "interrupt", category: "self_harm_immediate", source: "rule" } satisfies SafetyDecision),
      generate,
    });

    const response = await handler(
      request(payload({ narratives: { N01: { skipped: false, fields: { event: "I will kill myself tonight.", selfStory: "", newUnderstanding: "" } }, N02: { skipped: true, fields: {} } } })),
    );

    expect(response.status).toBe(200);
    expect(analysisResponseSchema.parse(await response.json()).status).toBe("safety_interruption");
    expect(generate).not.toHaveBeenCalled();
    expect(events).toEqual([
      expect.objectContaining({ event: "analysis_requested", requestId: "00000000-0000-4000-8000-000000000017" }),
      expect.objectContaining({ event: "safety_interrupted", requestId: "00000000-0000-4000-8000-000000000017", status: "interrupted", errorCode: "SELF_HARM_IMMEDIATE" }),
    ]);
    expect(JSON.stringify(events)).not.toContain("kill myself");
  });

  it("emits analysis unavailable events from provider and not-scored route responses without raw narrative", async () => {
    const unavailableEvents: unknown[] = [];
    const unavailableHandler = createAnalyzePostHandler({
      createClientKey: () => "analyze:unavailable-event-client",
      createRequestId: () => "00000000-0000-4000-8000-000000000018",
      now: () => 0,
      emit: (event) => unavailableEvents.push(event),
      classifySafety: vi.fn().mockResolvedValue({ kind: "allow", source: "provider" } satisfies SafetyDecision),
      generate: vi.fn().mockResolvedValue({ ok: false, reason: "timeout" }),
    });

    const unavailableResponse = await unavailableHandler(request(payload({ narratives: { N01: n01, N02: n02 } })));

    expect(unavailableResponse.status).toBe(200);
    expect(analysisResponseSchema.parse(await unavailableResponse.json())).toMatchObject({ status: "unavailable", reason: "timeout" });
    expect(unavailableEvents).toEqual([
      expect.objectContaining({ event: "analysis_requested", requestId: "00000000-0000-4000-8000-000000000018" }),
      expect.objectContaining({ event: "analysis_unavailable", requestId: "00000000-0000-4000-8000-000000000018", status: "unavailable", errorCode: "TIMEOUT" }),
    ]);
    expect(JSON.stringify(unavailableEvents)).not.toContain("interrupted my teammate");
    expect(JSON.stringify(unavailableEvents)).not.toContain("volunteering for extra work");

    const notScoredEvents: unknown[] = [];
    const notScoredHandler = createAnalyzePostHandler({
      createClientKey: () => "analyze:not-scored-event-client",
      createRequestId: () => "00000000-0000-4000-8000-000000000019",
      now: () => 0,
      emit: (event) => notScoredEvents.push(event),
    });

    const notScoredResponse = await notScoredHandler(request(payload()));

    expect(notScoredResponse.status).toBe(200);
    expect(analysisResponseSchema.parse(await notScoredResponse.json())).toMatchObject({ status: "not_scored", reason: "narrative_skipped" });
    expect(notScoredEvents).toEqual([
      expect.objectContaining({ event: "analysis_requested", requestId: "00000000-0000-4000-8000-000000000019" }),
      expect.objectContaining({ event: "analysis_unavailable", requestId: "00000000-0000-4000-8000-000000000019", status: "unavailable", errorCode: "NARRATIVE_SKIPPED" }),
    ]);
    expect(JSON.stringify(notScoredEvents)).not.toContain("fields");
  });

  it("returns 429 with integer Retry-After when analyze rate limit is exhausted, then allows after reset", async () => {
    let now = 0;
    const handler = createAnalyzePostHandler({
      createClientKey: () => "analyze:limited-client",
      createRequestId: () => "00000000-0000-4000-8000-000000000016",
      rateLimiter: createInMemoryRateLimiter({ limit: 1, windowMs: 2_000, now: () => now }),
      now: () => now,
      emit: () => undefined,
    });

    expect((await handler(request(payload()))).status).toBe(200);
    const response = await handler(request(payload()));
    const body = analysisErrorResponseSchema.parse(await response.json());

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("2");
    expect(body.error.code).toBe("RATE_LIMITED");

    now = 2_000;
    expect((await handler(request(payload()))).status).toBe(200);
  });

  it("derives a privacy-preserving anonymous analyze route key for malformed client metadata", async () => {
    const limiter = createInMemoryRateLimiter({ limit: 1, windowMs: 1_000, now: () => 0 });
    const handler = createAnalyzePostHandler({
      rateLimiter: limiter,
      createRequestId: () => "00000000-0000-4000-8000-000000000020",
      now: () => 0,
      emit: () => undefined,
    });

    const response = await handler(request(payload(), { headers: { "x-forwarded-for": "not an ip", "user-agent": "Analyze Route Browser" } }));

    expect(response.status).toBe(200);
    expect(limiter.snapshotKeys()).toHaveLength(1);
    expect(limiter.snapshotKeys()[0]).toMatch(/^analyze:[a-f0-9]{64}$/);
    expect(limiter.snapshotKeys()[0]).not.toContain("not an ip");
    expect(limiter.snapshotKeys()[0]).not.toContain("Analyze Route Browser");
  });

  it("lazily evicts expired analyze buckets through the route with an injected clock", async () => {
    let now = 0;
    const limiter = createInMemoryRateLimiter({ limit: 1, windowMs: 10, maxEntries: 3, evictionBatchSize: 2, now: () => now });
    const handler = createAnalyzePostHandler({
      rateLimiter: limiter,
      createRequestId: () => "00000000-0000-4000-8000-000000000021",
      now: () => now,
      emit: () => undefined,
    });

    for (const ip of ["203.0.113.11", "203.0.113.12", "203.0.113.13"]) {
      expect((await handler(request(payload(), { headers: { "x-forwarded-for": ip, "user-agent": "Analyze Route Browser" } }))).status).toBe(200);
    }
    expect(limiter.snapshotKeys()).toHaveLength(3);

    now = 11;
    expect((await handler(request(payload(), { headers: { "x-forwarded-for": "203.0.113.14", "user-agent": "Analyze Route Browser" } }))).status).toBe(200);
    expect(limiter.snapshotKeys()).toHaveLength(2);
  });
});
