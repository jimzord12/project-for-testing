import { describe, expect, it } from "vitest";

import { STRUCTURED_QUESTIONS } from "@/domain/questionnaire";
import { QUESTIONNAIRE_VERSION, SCORING_VERSION } from "@/domain/versions";
import { GET, createQuestionnaireGetHandler, publicQuestionnaireResponseSchema } from "./route";

const REQUIRED_DISCLAIMER =
  "This is a reflective self-assessment, not a diagnosis or a scientifically validated measure of literal psychological age. Results depend on self-report, interpretation, current circumstances, and how specifically you answer.";

describe("GET /api/v1/questionnaire", () => {
  it("returns the public questionnaire contract with cache headers", async () => {
    const response = await GET();
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=3600, stale-while-revalidate=86400",
    );
    expect(() => publicQuestionnaireResponseSchema.parse(body)).not.toThrow();
    expect(body).toMatchObject({
      questionnaireVersion: QUESTIONNAIRE_VERSION,
      scoringVersion: SCORING_VERSION,
      disclaimer: REQUIRED_DISCLAIMER,
      estimatedMinutes: { min: 12, max: 18 },
    });
  });

  it("serializes all steps in canonical order with narrative exercises at the domain-defined positions", async () => {
    const response = await GET();
    const parsed = publicQuestionnaireResponseSchema.parse(await response.json());

    expect(parsed.steps).toHaveLength(26);
    expect(parsed.steps.filter((step) => step.kind === "structured")).toHaveLength(24);
    expect(parsed.steps.filter((step) => step.kind === "narrative")).toHaveLength(2);
    expect(parsed.steps.map((step) => step.id)).toEqual([
      ...STRUCTURED_QUESTIONS.slice(0, 8).map((question) => question.id),
      "N01",
      ...STRUCTURED_QUESTIONS.slice(8, 14).map((question) => question.id),
      "N02",
      ...STRUCTURED_QUESTIONS.slice(14).map((question) => question.id),
    ]);

    const [n01, n02] = parsed.steps.filter((step) => step.kind === "narrative");
    expect(n01?.fields.map((field) => field.maxWords)).toEqual([90, 60, 90]);
    expect(n01?.minimumTotalWords).toBe(45);
    expect(n02?.fields.map((field) => field.maxWords)).toEqual([70, 50, 70]);
    expect(n02?.minimumTotalWords).toBe(35);
  });

  it("does not expose server-owned score fields or numeric option score values", async () => {
    const response = await GET();
    const body = await response.json();
    const parsed = publicQuestionnaireResponseSchema.parse(body);
    const serialized = JSON.stringify(body);

    expect(serialized).not.toMatch(/"score"\s*:/);

    for (const step of parsed.steps) {
      if (step.kind !== "structured") continue;
      expect(step.options).toHaveLength(6);
      for (const option of step.options) {
        expect(Object.prototype.hasOwnProperty.call(option, "score")).toBe(false);
        expect(typeof option.label).toBe("string");
        expect(["A", "B", "C", "D", "E", "NA"]).toContain(option.id);
      }
    }
  });
});

describe("GET /api/v1/questionnaire observability", () => {
  it("emits a content-free questionnaire_loaded event", async () => {
    const events: unknown[] = [];
    const handler = createQuestionnaireGetHandler({
      createRequestId: () => "req-questionnaire",
      now: () => 0,
      emit: (event) => events.push(event),
    });

    const response = handler();
    const body = publicQuestionnaireResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(body.steps).toHaveLength(26);
    expect(events).toEqual([
      {
        event: "questionnaire_loaded",
        requestId: "req-questionnaire",
        timestamp: "1970-01-01T00:00:00.000Z",
        questionnaireVersion: QUESTIONNAIRE_VERSION,
        scoringVersion: SCORING_VERSION,
      },
    ]);
    expect(JSON.stringify(events)).not.toContain("prompt");
    expect(JSON.stringify(events)).not.toContain("options");
  });
});
