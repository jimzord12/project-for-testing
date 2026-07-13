import { ReadableStream } from "node:stream/web";
import { describe, expect, it, vi } from "vitest";

import { STRUCTURED_QUESTIONS, type StructuredQuestion } from "@/domain/questionnaire";
import { QUESTIONNAIRE_VERSION, PROMPT_VERSION } from "@/domain/versions";
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
    const unsupported = await POST(new Request("http://localhost/api/v1/assessments/analyze", { method: "POST", body: "{}", headers: { "content-type": "text/plain" } }));
    expect(unsupported.status).toBe(415);
    expect(analysisErrorResponseSchema.parse(await unsupported.json()).error.code).toBe("UNSUPPORTED_MEDIA_TYPE");

    const malformed = await POST(new Request("http://localhost/api/v1/assessments/analyze", { method: "POST", body: "{ nope", headers: { "content-type": "application/json" } }));
    expect(malformed.status).toBe(400);
    expect(analysisErrorResponseSchema.parse(await malformed.json()).error.code).toBe("MALFORMED_JSON");
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
});
