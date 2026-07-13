import { z } from "zod";

import { calculateConfidence } from "@/domain/confidence";
import { DIMENSION_IDS } from "@/domain/result-types";
import type { AnswerSetError, StructuredAnswer } from "@/domain/result-types";
import { calculateAgeMetaphor, scoreStructuredAssessment, validateAnswerSet } from "@/domain/scoring";
import { QUESTIONNAIRE_VERSION, SCORING_VERSION } from "@/domain/versions";

const dimensionIdSchema = z.enum(DIMENSION_IDS);

const dimensionResultSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("reportable"),
      score: z.number().int().min(0).max(100),
      answered: z.number().int().nonnegative(),
      available: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      status: z.literal("insufficient_data"),
      answered: z.number().int().nonnegative(),
      required: z.number().int().positive(),
      available: z.number().int().positive(),
    })
    .strict(),
]);

const profileBalanceSchema = z
  .object({
    spread: z.number().int().min(0).max(100),
    label: z.enum(["relatively_balanced", "some_unevenness", "strongly_uneven"]),
  })
  .strict();

const confidenceReasonSchema = z.discriminatedUnion("code", [
  z
    .object({
      code: z.literal("extra_not_applicable"),
      count: z.number().int().positive(),
      deducted: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      code: z.literal("non_reportable_dimension"),
      dimension: dimensionIdSchema,
      deducted: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      code: z.literal("low_coverage"),
      missingOrNa: z.number().int().positive(),
      deducted: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      code: z.literal("inconsistent_pair"),
      pair: z.tuple([z.string().min(1), z.string().min(1)]),
      deducted: z.number().int().positive(),
    })
    .strict(),
]);

const confidenceSchema = z
  .object({
    score: z.number().int().min(0).max(100),
    label: z.enum(["high", "moderate", "low"]),
    reasons: z.array(confidenceReasonSchema),
  })
  .strict();

export const scoreRequestSchema = z
  .object({
    questionnaireVersion: z.string().min(1),
    answers: z
      .array(
        z
          .object({
            questionId: z.string().min(1),
            optionId: z.string().min(1),
          })
          .strict(),
      )
      .max(24),
    preferences: z
      .object({
        includeAgeMetaphor: z.boolean().default(false),
      })
      .strict()
      .default({ includeAgeMetaphor: false }),
  })
  .strict();

export const scoreSuccessResponseSchema = z
  .object({
    assessmentId: z.string().uuid(),
    result: z
      .object({
        questionnaireVersion: z.literal(QUESTIONNAIRE_VERSION),
        scoringVersion: z.literal(SCORING_VERSION),
        structuredMaturityIndex: z.number().int().min(0).max(100).nullable(),
        confidence: confidenceSchema,
        dimensions: z.record(dimensionIdSchema, dimensionResultSchema),
        profileBalance: profileBalanceSchema.nullable(),
        maturityAgeMetaphor: z.number().int().min(16).max(72).nullable(),
      })
      .strict(),
  })
  .strict();

export const scoreErrorResponseSchema = z
  .object({
    error: z
      .object({
        code: z.enum([
          "UNSUPPORTED_MEDIA_TYPE",
          "MALFORMED_JSON",
          "INVALID_REQUEST",
          "INVALID_ANSWER_SET",
          "REQUEST_TOO_LARGE",
        ]),
        message: z.string().min(1),
        fieldErrors: z.array(
          z
            .object({
              path: z.string(),
              code: z.string().min(1),
            })
            .strict(),
        ),
        requestId: z.string().uuid(),
      })
      .strict(),
  })
  .strict();

export type ScoreRequest = z.infer<typeof scoreRequestSchema>;
export type ScoreSuccessResponse = z.infer<typeof scoreSuccessResponseSchema>;
export type ScoreErrorResponse = z.infer<typeof scoreErrorResponseSchema>;
export type ScoreErrorCode = ScoreErrorResponse["error"]["code"];

export type ScoreProcessingSuccess = {
  ok: true;
  status: 200;
  body: ScoreSuccessResponse;
};

export type ScoreProcessingError = {
  ok: false;
  status: 400 | 413 | 415 | 422;
  body: ScoreErrorResponse;
};

export type ScoreProcessingResult = ScoreProcessingSuccess | ScoreProcessingError;

export type ScoreProcessingDependencies = {
  createAssessmentId?: () => string;
  createRequestId?: () => string;
};

function randomUuid(): string {
  return globalThis.crypto.randomUUID();
}

export function buildScoreErrorResponse(
  status: ScoreProcessingError["status"],
  code: ScoreErrorCode,
  message: string,
  fieldErrors: ScoreErrorResponse["error"]["fieldErrors"] = [],
  deps: ScoreProcessingDependencies = {},
): ScoreProcessingError {
  return {
    ok: false,
    status,
    body: scoreErrorResponseSchema.parse({
      error: {
        code,
        message,
        fieldErrors,
        requestId: (deps.createRequestId ?? randomUuid)(),
      },
    }),
  };
}

function fieldErrorForAnswerSet(error: AnswerSetError): ScoreErrorResponse["error"]["fieldErrors"][number] {
  switch (error.code) {
    case "version_mismatch":
      return { path: "questionnaireVersion", code: "VERSION_MISMATCH" };
    case "unknown_question":
      return { path: "answers", code: "UNKNOWN_QUESTION" };
    case "unknown_option":
      return { path: "answers", code: "UNKNOWN_OPTION" };
    case "duplicate_answer":
      return { path: "answers", code: "DUPLICATE_ANSWER" };
  }
}

export function fieldErrorsFromZodError(
  error: z.ZodError,
): ScoreErrorResponse["error"]["fieldErrors"] {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    code: issue.code.toUpperCase(),
  }));
}

export function processScoreAssessment(
  request: ScoreRequest,
  deps: ScoreProcessingDependencies = {},
): ScoreProcessingResult {
  const validation = validateAnswerSet(request.questionnaireVersion, request.answers as StructuredAnswer[]);
  if (!validation.ok) {
    return buildScoreErrorResponse(
      422,
      "INVALID_ANSWER_SET",
      "The submitted answer set does not match the active questionnaire.",
      validation.errors.map(fieldErrorForAnswerSet),
      deps,
    );
  }

  const structured = scoreStructuredAssessment(validation.answers);
  const confidence = calculateConfidence(validation.answers, structured.dimensions);
  const maturityAgeMetaphor = calculateAgeMetaphor(
    structured.structuredMaturityIndex,
    request.preferences.includeAgeMetaphor,
  );

  return {
    ok: true,
    status: 200,
    body: scoreSuccessResponseSchema.parse({
      assessmentId: (deps.createAssessmentId ?? randomUuid)(),
      result: {
        questionnaireVersion: QUESTIONNAIRE_VERSION,
        scoringVersion: SCORING_VERSION,
        structuredMaturityIndex: structured.structuredMaturityIndex,
        confidence,
        dimensions: structured.dimensions,
        profileBalance: structured.profileBalance,
        maturityAgeMetaphor,
      },
    }),
  };
}
