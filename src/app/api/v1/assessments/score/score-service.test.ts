import { describe, expect, it } from "vitest";

import { calculateConfidence } from "@/domain/confidence";
import { STRUCTURED_QUESTIONS, type StructuredQuestion } from "@/domain/questionnaire";
import { calculateAgeMetaphor, scoreStructuredAssessment } from "@/domain/scoring";
import { QUESTIONNAIRE_VERSION, SCORING_VERSION } from "@/domain/versions";
import { processScoreAssessment, scoreSuccessResponseSchema } from "./score-service";

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

function validRequest(overrides: Partial<Parameters<typeof processScoreAssessment>[0]> = {}) {
  return {
    questionnaireVersion: QUESTIONNAIRE_VERSION,
    answers: answersWithScore(5),
    preferences: { includeAgeMetaphor: false },
    ...overrides,
  };
}

describe("processScoreAssessment", () => {
  it("recomputes structured score, confidence, profile balance, and disabled age metaphor from canonical domain functions", () => {
    const request = validRequest();
    const expectedStructured = scoreStructuredAssessment(request.answers);
    const expectedConfidence = calculateConfidence(request.answers, expectedStructured.dimensions);

    const response = processScoreAssessment(request, { createAssessmentId: () => "00000000-0000-4000-8000-000000000001" });

    expect(response.ok).toBe(true);
    if (!response.ok) throw new Error("expected success");
    expect(response.body).toEqual({
      assessmentId: "00000000-0000-4000-8000-000000000001",
      result: {
        questionnaireVersion: QUESTIONNAIRE_VERSION,
        scoringVersion: SCORING_VERSION,
        structuredMaturityIndex: expectedStructured.structuredMaturityIndex,
        confidence: expectedConfidence,
        dimensions: expectedStructured.dimensions,
        profileBalance: expectedStructured.profileBalance,
        maturityAgeMetaphor: null,
      },
    });
    expect(() => scoreSuccessResponseSchema.parse(response.body)).not.toThrow();
  });

  it("keeps deterministic results identical apart from assessmentId", () => {
    const request = validRequest();
    const first = processScoreAssessment(request, { createAssessmentId: () => "00000000-0000-4000-8000-000000000001" });
    const second = processScoreAssessment(request, { createAssessmentId: () => "00000000-0000-4000-8000-000000000002" });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error("expected successes");
    expect(first.body.assessmentId).not.toBe(second.body.assessmentId);
    expect(first.body.result).toEqual(second.body.result);
  });

  it("returns null SMI, insufficient dimensions, low confidence, and null age metaphor when reportability thresholds are not met", () => {
    const answers = answersWithScore(5).filter((answer) => !answer.questionId.startsWith("ER"));
    const expectedStructured = scoreStructuredAssessment(answers);
    const response = processScoreAssessment(
      validRequest({ answers, preferences: { includeAgeMetaphor: true } }),
      { createAssessmentId: () => "00000000-0000-4000-8000-000000000001" },
    );

    expect(response.ok).toBe(true);
    if (!response.ok) throw new Error("expected success");
    expect(response.body.result.structuredMaturityIndex).toBeNull();
    expect(response.body.result.dimensions.ER).toEqual(expectedStructured.dimensions.ER);
    expect(response.body.result.confidence.reasons).toContainEqual({
      code: "non_reportable_dimension",
      dimension: "ER",
      deducted: 15,
    });
    expect(response.body.result.maturityAgeMetaphor).toBeNull();
  });

  it("excludes Not applicable answers exactly like the domain scorer and applies the opt-in age metaphor", () => {
    const answers = answersWithScore(5).map((answer) =>
      answer.questionId === "ER05" ? { ...answer, optionId: "NA" } : answer,
    );
    const expectedStructured = scoreStructuredAssessment(answers);

    const response = processScoreAssessment(
      validRequest({ answers, preferences: { includeAgeMetaphor: true } }),
      { createAssessmentId: () => "00000000-0000-4000-8000-000000000001" },
    );

    expect(response.ok).toBe(true);
    if (!response.ok) throw new Error("expected success");
    expect(response.body.result.dimensions.ER).toEqual(expectedStructured.dimensions.ER);
    expect(response.body.result.maturityAgeMetaphor).toBe(
      calculateAgeMetaphor(expectedStructured.structuredMaturityIndex, true),
    );
  });

  it("maps canonical answer validation failures to typed INVALID_ANSWER_SET field errors", () => {
    const response = processScoreAssessment(
      validRequest({
        questionnaireVersion: "RMP-0.9",
        answers: [
          { questionId: "ZZ99", optionId: "C" },
          { questionId: "ER01", optionId: "Z" },
          { questionId: "ER02", optionId: "C" },
          { questionId: "ER02", optionId: "B" },
        ],
      }),
      { createRequestId: () => "00000000-0000-4000-8000-0000000000aa" },
    );

    expect(response).toEqual({
      ok: false,
      status: 422,
      body: {
        error: {
          code: "INVALID_ANSWER_SET",
          message: "The submitted answer set does not match the active questionnaire.",
          requestId: "00000000-0000-4000-8000-0000000000aa",
          fieldErrors: expect.arrayContaining([
            { path: "questionnaireVersion", code: "VERSION_MISMATCH" },
            { path: "answers", code: "UNKNOWN_QUESTION" },
            { path: "answers", code: "UNKNOWN_OPTION" },
            { path: "answers", code: "DUPLICATE_ANSWER" },
          ]),
        },
      },
    });
  });
});
