import { NextResponse } from "next/server";
import { z } from "zod";

import { getPublicQuestionnaire } from "@/domain/questionnaire";
import { SCORING_VERSION } from "@/domain/versions";
import { emitEvent, type OperationalEvent } from "@/server/logging";

export const QUESTIONNAIRE_CACHE_CONTROL = "public, max-age=3600, stale-while-revalidate=86400";

const structuredOptionSchema = z
  .object({
    id: z.enum(["A", "B", "C", "D", "E", "NA"]),
    label: z.string().min(1),
    isNotApplicable: z.boolean(),
  })
  .strict();

const structuredStepSchema = z
  .object({
    kind: z.literal("structured"),
    id: z.string().min(1),
    dimension: z.enum(["ER", "IC", "PT", "IS", "TD"]),
    prompt: z.string().min(1),
    options: z.array(structuredOptionSchema).length(6),
  })
  .strict();

const narrativeFieldSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    maxWords: z.number().int().positive(),
  })
  .strict();

const narrativeStepSchema = z
  .object({
    kind: z.literal("narrative"),
    id: z.enum(["N01", "N02"]),
    title: z.string().min(1),
    intro: z.string().min(1),
    fields: z.array(narrativeFieldSchema).length(3),
    minimumTotalWords: z.number().int().positive(),
  })
  .strict();

export const publicQuestionnaireResponseSchema = z
  .object({
    questionnaireVersion: z.literal("RMP-1.0"),
    scoringVersion: z.literal(SCORING_VERSION),
    steps: z.array(z.discriminatedUnion("kind", [structuredStepSchema, narrativeStepSchema])).length(26),
    disclaimer: z.string().min(1),
    estimatedMinutes: z
      .object({
        min: z.literal(12),
        max: z.literal(18),
      })
      .strict(),
  })
  .strict();

export type PublicQuestionnaireResponse = z.infer<typeof publicQuestionnaireResponseSchema>;

type PublicQuestionnaire = ReturnType<typeof getPublicQuestionnaire>;
type PublicQuestionnaireStep =
  | PublicQuestionnaire["structured"][number]
  | PublicQuestionnaire["narrative"][number];

type QuestionnaireRouteDependencies = {
  emit?: (event: OperationalEvent) => void;
  now?: () => number;
  createRequestId?: () => string;
};

function buildSteps(publicQuestionnaire: PublicQuestionnaire): PublicQuestionnaireStep[] {
  const [firstNarrative, secondNarrative] = publicQuestionnaire.narrative;
  if (!firstNarrative || !secondNarrative) {
    throw new Error("Public questionnaire projection must include both narrative exercises.");
  }

  return [
    ...publicQuestionnaire.structured.slice(0, 8),
    firstNarrative,
    ...publicQuestionnaire.structured.slice(8, 14),
    secondNarrative,
    ...publicQuestionnaire.structured.slice(14),
  ];
}

function buildResponse(): PublicQuestionnaireResponse {
  const publicQuestionnaire = getPublicQuestionnaire();
  return publicQuestionnaireResponseSchema.parse({
    questionnaireVersion: publicQuestionnaire.questionnaireVersion,
    scoringVersion: SCORING_VERSION,
    steps: buildSteps(publicQuestionnaire),
    disclaimer: publicQuestionnaire.disclaimer,
    estimatedMinutes: { min: 12, max: 18 },
  });
}

function randomId(): string {
  return globalThis.crypto.randomUUID();
}

export function createQuestionnaireGetHandler(deps: QuestionnaireRouteDependencies = {}) {
  return function questionnaireGetHandler() {
    const response = buildResponse();
    (deps.emit ?? ((event) => { emitEvent(event); }))({
      event: "questionnaire_loaded",
      requestId: (deps.createRequestId ?? randomId)(),
      timestamp: new Date(deps.now?.() ?? Date.now()).toISOString(),
      questionnaireVersion: response.questionnaireVersion,
      scoringVersion: response.scoringVersion,
    });
    return NextResponse.json(response, {
      headers: {
        "Cache-Control": QUESTIONNAIRE_CACHE_CONTROL,
      },
    });
  };
}

export const GET = createQuestionnaireGetHandler();
