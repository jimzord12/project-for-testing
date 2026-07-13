"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";

import { useAssessment, type AssessmentState } from "@/client/assessment-state";
import { countWords } from "@/domain/narrative-rubric";
import { DIMENSION_IDS, type ConfidenceReason, type DimensionId, type DimensionResult } from "@/domain/result-types";
import { PROMPT_VERSION, QUESTIONNAIRE_VERSION, SCORING_VERSION } from "@/domain/versions";
import type { ScoreRequest, ScoreSuccessResponse } from "./api/v1/assessments/score/score-service";
import type { PublicQuestionnaireResponse } from "./api/v1/questionnaire/route";

export const DIMENSION_LABELS: Record<DimensionId, string> = {
  ER: "Emotional Regulation",
  IC: "Impulse Control",
  PT: "Perspective-Taking",
  IS: "Identity Stability",
  TD: "Temporal Depth",
};

const QUESTION_TITLES: Record<string, string> = {
  ER01: "Receiving criticism",
  ER02: "Naming an emotion",
  ER03: "Recovery after activation",
  ER04: "Repair after causing harm",
  ER05: "Functioning under emotional pressure",
  IC01: "Emotionally charged communication",
  IC02: "Designing around temptation",
  IC03: "Frustration tolerance",
  IC04: "Keeping or renegotiating commitments",
  IC05: "Decisions under urgency",
  PT01: "Handling disagreement",
  PT02: "Updating a belief",
  PT03: "Tolerating ambiguity",
  PT04: "Separating delivery from substance",
  PT05: "Explaining another person's behavior",
  IS01: "Group pressure",
  IS02: "Feedback and self-worth",
  IS03: "Status and self-presentation",
  IS04: "Values under social cost",
  TD01: "Consequence horizon",
  TD02: "Planning under uncertainty",
  TD03: "Long-horizon effort",
  TD04: "Limited time",
  TD05: "Present enjoyment and future security",
};

type QuestionnaireStep = PublicQuestionnaireResponse["steps"][number];

export type AssessmentStep = QuestionnaireStep & {
  visualStepNumber: number;
  structuredOrdinal: number | null;
};

export type NavigationDirection = "back" | "continue";

export type RadioKeyboardIntent =
  | { action: "move"; nextIndex: number }
  | { action: "select"; nextIndex: number }
  | { action: "ignore"; nextIndex: number };

export function buildAssessmentSteps(questionnaire: PublicQuestionnaireResponse): AssessmentStep[] {
  let structuredOrdinal = 0;
  return questionnaire.steps.map((step, index) => {
    if (step.kind === "structured") structuredOrdinal += 1;
    return {
      ...step,
      visualStepNumber: index + 1,
      structuredOrdinal: step.kind === "structured" ? structuredOrdinal : null,
    };
  });
}

export function getAdjacentStepIndex(
  currentStepIndex: number,
  direction: NavigationDirection,
  totalSteps: number,
): number {
  if (direction === "back") return Math.max(0, currentStepIndex - 1);
  return Math.min(Math.max(0, totalSteps - 1), currentStepIndex + 1);
}

export function makeQuestionHeadingFocusId(stepIndex: number): string {
  return `assessment-step-${stepIndex + 1}-heading`;
}

export function handleRadioKeyDown(key: string, currentIndex: number, optionCount: number): RadioKeyboardIntent {
  if (optionCount <= 0) return { action: "ignore", nextIndex: currentIndex };
  if (key === "ArrowDown" || key === "ArrowRight") {
    return { action: "move", nextIndex: (currentIndex + 1) % optionCount };
  }
  if (key === "ArrowUp" || key === "ArrowLeft") {
    return { action: "move", nextIndex: (currentIndex - 1 + optionCount) % optionCount };
  }
  if (key === " " || key === "Spacebar" || key === "Enter") {
    return { action: "select", nextIndex: currentIndex };
  }
  return { action: "ignore", nextIndex: currentIndex };
}

export function shouldShowNarrativeWordWarning(wordCount: number, maxWords: number): boolean {
  return wordCount >= Math.ceil(maxWords * 0.8);
}

export function enforceNarrativeFieldCap(nextValue: string, previousValue: string, maxWords: number): string {
  return countWords(nextValue) > maxWords ? previousValue : nextValue;
}

export type DimensionReviewCount = {
  dimension: DimensionId;
  label: string;
  total: number;
  answered: number;
  notApplicable: number;
  completed: number;
  unanswered: number;
};

export type NarrativeReviewStatus = "complete" | "partial" | "skipped";

export type NarrativeReviewSummary = {
  exerciseId: string;
  title: string;
  status: NarrativeReviewStatus;
  wordCount: number;
  minimumWords: number;
};

export type ReviewEditTarget = {
  stepIndex: number;
  headingFocusId: string;
};

export function buildDimensionReviewCounts(
  questionnaire: PublicQuestionnaireResponse,
  structuredAnswers: AssessmentState["structuredAnswers"],
): DimensionReviewCount[] {
  const counts = Object.entries(DIMENSION_LABELS).map(([dimension, label]) => ({
    dimension: dimension as DimensionId,
    label,
    total: 0,
    answered: 0,
    notApplicable: 0,
    completed: 0,
    unanswered: 0,
  }));
  const byDimension = new Map(counts.map((count) => [count.dimension, count]));

  for (const step of questionnaire.steps) {
    if (step.kind !== "structured") continue;
    const count = byDimension.get(step.dimension);
    if (!count) continue;
    count.total += 1;

    const selectedOptionId = structuredAnswers[step.id];
    const selectedOption = step.options.find((option) => option.id === selectedOptionId);
    if (!selectedOption) {
      count.unanswered += 1;
    } else if (selectedOption.isNotApplicable) {
      count.notApplicable += 1;
      count.completed += 1;
    } else {
      count.answered += 1;
      count.completed += 1;
    }
  }

  return counts;
}

export function summarizeNarrativeReviewStatus(
  questionnaire: PublicQuestionnaireResponse,
  exerciseId: string,
  draft: AssessmentState["narratives"][string] | undefined,
): NarrativeReviewSummary {
  const exercise = questionnaire.steps.find((step) => step.kind === "narrative" && step.id === exerciseId);
  const title = exercise?.kind === "narrative" ? exercise.title : exerciseId;
  const minimumWords = exercise?.kind === "narrative" ? exercise.minimumTotalWords : 0;
  const wordCount = draft?.skipped ? 0 : countWords(Object.values(draft?.fields ?? {}).join(" "));
  const status: NarrativeReviewStatus = draft?.skipped || wordCount === 0
    ? "skipped"
    : wordCount >= minimumWords
      ? "complete"
      : "partial";

  return { exerciseId, title, status, wordCount, minimumWords };
}

export function resolveReviewEditTarget(
  questionnaire: PublicQuestionnaireResponse,
  itemId: string,
): ReviewEditTarget | null {
  const stepIndex = questionnaire.steps.findIndex((step) => step.id === itemId);
  if (stepIndex < 0) return null;
  return {
    stepIndex,
    headingFocusId: makeQuestionHeadingFocusId(stepIndex),
  };
}

type ScoreResult = ScoreSuccessResponse["result"];

type RankedDimension = {
  dimension: DimensionId;
  label: string;
  score: number;
};

export function buildScoreRequestFromState(state: AssessmentState): ScoreRequest {
  return {
    questionnaireVersion: state.questionnaireVersion,
    answers: Object.entries(state.structuredAnswers)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([questionId, optionId]) => ({ questionId, optionId })),
    preferences: { includeAgeMetaphor: state.preferences.includeAgeMetaphor },
  };
}

export function getDimensionBandLabel(score: number): string {
  if (score <= 24) return "Emerging";
  if (score <= 49) return "Developing";
  if (score <= 74) return "Established";
  if (score <= 89) return "Proficient";
  return "Integrated";
}

function formatProfileBalanceLabel(label: NonNullable<ScoreResult["profileBalance"]>["label"]): string {
  if (label === "relatively_balanced") return "Relatively balanced";
  if (label === "some_unevenness") return "Some unevenness";
  return "Strongly uneven profile";
}

function formatConfidenceLabel(label: ScoreResult["confidence"]["label"]): string {
  if (label === "high") return "High";
  if (label === "moderate") return "Moderate";
  return "Low";
}

function rankedReportableDimensions(dimensions: Record<DimensionId, DimensionResult>): RankedDimension[] {
  return DIMENSION_IDS.flatMap((dimension) => {
    const result = dimensions[dimension];
    if (result.status !== "reportable") return [];
    return [{ dimension, label: DIMENSION_LABELS[dimension], score: result.score }];
  }).sort((left, right) => left.score - right.score || left.label.localeCompare(right.label));
}

export function pickStrongestDimension(dimensions: Record<DimensionId, DimensionResult>): RankedDimension | null {
  return [...rankedReportableDimensions(dimensions)].sort(
    (left, right) => right.score - left.score || left.label.localeCompare(right.label),
  )[0] ?? null;
}

export function getGrowthAreaDimensions(dimensions: Record<DimensionId, DimensionResult>): RankedDimension[] {
  return rankedReportableDimensions(dimensions).slice(0, 2);
}

function getIndexUnavailableDimension(dimensions: Record<DimensionId, DimensionResult>): string | null {
  const insufficient = DIMENSION_IDS.find((dimension) => dimensions[dimension].status === "insufficient_data");
  return insufficient ? DIMENSION_LABELS[insufficient] : null;
}

function formatConfidenceReason(reason: ConfidenceReason): string {
  if (reason.code === "extra_not_applicable") {
    return `${reason.count} extra Not applicable response${reason.count === 1 ? "" : "s"} reduced confidence (-${reason.deducted}).`;
  }
  if (reason.code === "non_reportable_dimension") {
    return `${DIMENSION_LABELS[reason.dimension]} did not have enough scored answers (-${reason.deducted}).`;
  }
  if (reason.code === "low_coverage") {
    return `${reason.missingOrNa} unanswered or Not applicable structured items reduced confidence (-${reason.deducted}).`;
  }
  return `${reason.pair[0]} and ${reason.pair[1]} were far apart, which reduced confidence (-${reason.deducted}).`;
}

function formatNarrativeStatus(status: NarrativeReviewStatus): string {
  if (status === "complete") return "Complete";
  if (status === "partial") return "Partial";
  return "Skipped";
}

export type ExportFormat = "json" | "printable_html";

export type ExportableAiAnalysis =
  | {
      status: "completed";
      headline: string;
      observations: string[];
      experiments: string[];
      narrativeSelfAwareness?: {
        status: "scored" | "limited_evidence" | "not_scored";
        score?: number;
        confidence?: "high" | "moderate" | "low" | "not_available";
        summary?: string;
      };
      uncertaintyNote: string;
      safetyOrLimitationNote?: string;
    }
  | { status: "disabled" }
  | { status: "unavailable"; reason: "provider_error" | "timeout" | "invalid_model_output" | "rate_limited" | "not_scored" };

export type ResultExportPayload = {
  schemaVersion: 1;
  generatedAt: string;
  versions: {
    questionnaire: typeof QUESTIONNAIRE_VERSION;
    scoring: typeof SCORING_VERSION;
    prompt: typeof PROMPT_VERSION;
  };
  disclaimer: string;
  deterministicResult: ScoreResult;
  aiAnalysis: ExportableAiAnalysis;
};

export const RESULT_EXPORT_DISCLAIMER =
  "This is not a clinical assessment, diagnosis, or literal measure of psychological age.";

export function buildResultExportPayload({
  result,
  aiAnalysis = { status: "unavailable", reason: "not_scored" },
  generatedAt = new Date().toISOString(),
}: {
  result: ScoreResult;
  aiAnalysis?: ExportableAiAnalysis;
  generatedAt?: string;
}): ResultExportPayload {
  return {
    schemaVersion: 1,
    generatedAt,
    versions: {
      questionnaire: QUESTIONNAIRE_VERSION,
      scoring: SCORING_VERSION,
      prompt: PROMPT_VERSION,
    },
    disclaimer: RESULT_EXPORT_DISCLAIMER,
    deterministicResult: result,
    aiAnalysis,
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderAiAnalysisForExport(aiAnalysis: ExportableAiAnalysis): string {
  if (aiAnalysis.status === "disabled") return "<p>AI analysis was disabled for this assessment.</p>";
  if (aiAnalysis.status === "unavailable") {
    return `<p>AI analysis unavailable: ${escapeHtml(aiAnalysis.reason)}.</p>`;
  }

  const observations = aiAnalysis.observations.map((observation) => `<li>${escapeHtml(observation)}</li>`).join("");
  const experiments = aiAnalysis.experiments.map((experiment) => `<li>${escapeHtml(experiment)}</li>`).join("");
  const nsa = aiAnalysis.narrativeSelfAwareness
    ? `<p>Narrative Self-Awareness: ${escapeHtml(aiAnalysis.narrativeSelfAwareness.status)}${
        typeof aiAnalysis.narrativeSelfAwareness.score === "number" ? ` (${aiAnalysis.narrativeSelfAwareness.score})` : ""
      }${aiAnalysis.narrativeSelfAwareness.summary ? ` — ${escapeHtml(aiAnalysis.narrativeSelfAwareness.summary)}` : ""}</p>`
    : "";

  return `
    <h3>${escapeHtml(aiAnalysis.headline)}</h3>
    <h4>Observations</h4>
    <ul>${observations}</ul>
    <h4>Behavioral experiments</h4>
    <ul>${experiments}</ul>
    ${nsa}
    <p>Uncertainty note: ${escapeHtml(aiAnalysis.uncertaintyNote)}</p>
    ${aiAnalysis.safetyOrLimitationNote ? `<p>Safety or limitation note: ${escapeHtml(aiAnalysis.safetyOrLimitationNote)}</p>` : ""}
  `;
}

export function buildPrintableResultHtml(payload: ResultExportPayload): string {
  const result = payload.deterministicResult;
  const dimensions = DIMENSION_IDS.map((dimension) => {
    const dimensionResult = result.dimensions[dimension];
    const label = DIMENSION_LABELS[dimension];
    if (dimensionResult.status === "insufficient_data") {
      return `<li><strong>${escapeHtml(label)}:</strong> Insufficient data. Text equivalent: ${escapeHtml(label)} has insufficient data (${dimensionResult.answered} of ${dimensionResult.required} required scored answers available; ${dimensionResult.available} items total).</li>`;
    }
    const band = getDimensionBandLabel(dimensionResult.score);
    return `<li><strong>${escapeHtml(label)}:</strong> ${dimensionResult.score} / 100 · ${escapeHtml(band)}. Text equivalent: ${escapeHtml(label)} scored ${dimensionResult.score} out of 100 and is in the ${escapeHtml(band)} band.</li>`;
  }).join("");
  const confidenceReasons = result.confidence.reasons.length === 0
    ? "<li>No confidence deductions were applied.</li>"
    : result.confidence.reasons.map((reason) => `<li>${escapeHtml(formatConfidenceReason(reason))}</li>`).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Reflective Maturity Profile export</title>
  <style>
    body { background: #ffffff; color: #111111; font-family: system-ui, sans-serif; line-height: 1.5; margin: 2rem; }
    section { border: 1px solid #dddddd; margin: 1rem 0; padding: 1rem; }
    @media print { * { background: none !important; box-shadow: none !important; text-shadow: none !important; } body { color: #000000; } }
  </style>
</head>
<body>
  <main>
    <h1>Reflective Maturity Profile export</h1>
    <p>Generated ${escapeHtml(payload.generatedAt)}</p>
    <p>Questionnaire ${escapeHtml(payload.versions.questionnaire)} · Scoring ${escapeHtml(payload.versions.scoring)} · Prompt ${escapeHtml(payload.versions.prompt)}</p>
    <p>${escapeHtml(payload.disclaimer)}</p>
    <section aria-labelledby="deterministic-export-title">
      <h2 id="deterministic-export-title">Deterministic results</h2>
      <p>Structured Maturity Index: ${result.structuredMaturityIndex === null ? "Unavailable" : `${result.structuredMaturityIndex} / 100`}</p>
      <p>Confidence: ${escapeHtml(formatConfidenceLabel(result.confidence.label))} (${result.confidence.score} / 100)</p>
      <ul>${confidenceReasons}</ul>
      <ul>${dimensions}</ul>
    </section>
    <section aria-labelledby="ai-export-title">
      <h2 id="ai-export-title">AI analysis</h2>
      ${renderAiAnalysisForExport(payload.aiAnalysis)}
    </section>
  </main>
</body>
</html>`;
}

function downloadTextFile(filename: string, mimeType: string, content: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function emitExportGenerated(format: ExportFormat, fetchImpl: typeof fetch = fetch): void {
  void fetchImpl("/api/v1/export-event", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      format,
      versions: {
        questionnaire: QUESTIONNAIRE_VERSION,
        scoring: SCORING_VERSION,
        prompt: PROMPT_VERSION,
      },
    }),
  }).catch(() => undefined);
}

const NARRATIVE_PRIVACY_NOTICE =
  "These answers may contain personal information. You can skip them and still receive the structured profile. When AI analysis is enabled, the text is sent to the configured AI provider for this analysis.";

type StructuredQuestionScreenProps = {
  questionnaire: PublicQuestionnaireResponse;
  state: AssessmentState;
  onAnswer: (questionId: string, optionId: string) => void;
  onNarrativeFieldChange: (exerciseId: string, fieldId: string, value: string) => void;
  onNarrativeContinue: (exerciseId: string, stepIndex: number) => void;
  onNarrativeSkip: (exerciseId: string, stepIndex: number) => void;
  onNavigate: (stepIndex: number) => void;
  onExitAndDelete: () => void;
};

export function StructuredQuestionScreen({
  questionnaire,
  state,
  onAnswer,
  onNarrativeFieldChange,
  onNarrativeContinue,
  onNarrativeSkip,
  onNavigate,
  onExitAndDelete,
}: StructuredQuestionScreenProps) {
  const steps = buildAssessmentSteps(questionnaire);
  const safeStepIndex = Math.min(Math.max(0, state.currentStepIndex), steps.length - 1);
  const step = steps[safeStepIndex];
  const headingId = makeQuestionHeadingFocusId(safeStepIndex);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [safeStepIndex]);

  if (!step) return null;

  const previousStepIndex = getAdjacentStepIndex(safeStepIndex, "back", steps.length);
  const nextStepIndex = getAdjacentStepIndex(safeStepIndex, "continue", steps.length);
  const canGoBack = safeStepIndex > 0;
  const isFinalStep = safeStepIndex === steps.length - 1;
  const selectedOptionId = step.kind === "structured" ? state.structuredAnswers[step.id] : undefined;
  const canContinue = step.kind === "narrative" || Boolean(selectedOptionId);
  const continueLabel = isFinalStep ? "Continue to review" : `Continue to step ${nextStepIndex + 1}`;

  return (
    <main
      className="flow-shell questionnaire-shell"
      data-min-target-size="44x44"
      data-min-layout-width="320"
      data-zoom-support="200"
      data-reduced-motion="respect"
      data-focus-seam="heading"
    >
      <section aria-labelledby={headingId} className="card question-card">
        <p className="eyebrow">Step {safeStepIndex + 1} of {steps.length}</p>

        {step.kind === "structured" ? (
          <>
            <p className="dimension-label">Dimension: {DIMENSION_LABELS[step.dimension]}</p>
            <h1 id={headingId} ref={headingRef} tabIndex={-1} className="question-heading">
              {QUESTION_TITLES[step.id] ?? `Question ${step.structuredOrdinal}`}
            </h1>
            <p className="question-prompt">{step.prompt}</p>
            <fieldset className="option-group" role="radiogroup" aria-labelledby={headingId}>
              <legend className="sr-only">Choose one response for {step.id}</legend>
              {step.options.map((option, index) => {
                const inputId = `${step.id}-${option.id}`;
                return (
                  <label
                    key={option.id}
                    className={option.isNotApplicable ? "option-row option-row-not-applicable" : "option-row"}
                    htmlFor={inputId}
                    data-min-target-size="44x44"
                  >
                    <input
                      id={inputId}
                      name={step.id}
                      type="radio"
                      value={option.id}
                      checked={selectedOptionId === option.id}
                      onChange={() => onAnswer(step.id, option.id)}
                      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                        const intent = handleRadioKeyDown(event.key, index, step.options.length);
                        if (intent.action === "ignore") return;
                        event.preventDefault();
                        const nextOption = step.options[intent.nextIndex];
                        if (nextOption && intent.action === "select") onAnswer(step.id, nextOption.id);
                        const nextInput = event.currentTarget
                          .closest("fieldset")
                          ?.querySelectorAll<HTMLInputElement>('input[type="radio"]')[intent.nextIndex];
                        nextInput?.focus();
                      }}
                    />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </fieldset>
          </>
        ) : (
          <>
            <p className="dimension-label">Optional reflection</p>
            <h1 id={headingId} ref={headingRef} tabIndex={-1} className="question-heading">
              {step.title}
            </h1>
            <p className="question-prompt">This exercise is optional.</p>
            <p>{step.intro}</p>
            <p className="subtle-note narrative-privacy-notice">{NARRATIVE_PRIVACY_NOTICE}</p>
            <div className="narrative-fields" data-keyboard-operation="native-textarea-buttons">
              {step.fields.map((field) => {
                const draft = state.narratives[step.id];
                const value = draft?.fields[field.id] ?? "";
                const wordCount = countWords(value);
                const fieldId = `${step.id}-${field.id}`;
                const counterId = `${fieldId}-counter`;
                const warningId = `${fieldId}-warning`;
                const showWarning = shouldShowNarrativeWordWarning(wordCount, field.maxWords);

                return (
                  <div className="narrative-field" key={field.id}>
                    <label className="narrative-label" htmlFor={fieldId}>
                      {field.label}
                    </label>
                    <textarea
                      id={fieldId}
                      name={`${step.id}.${field.id}`}
                      value={value}
                      rows={5}
                      aria-describedby={showWarning ? `${counterId} ${warningId}` : counterId}
                      onChange={(event) => {
                        const nextValue = enforceNarrativeFieldCap(event.currentTarget.value, value, field.maxWords);
                        onNarrativeFieldChange(step.id, field.id, nextValue);
                      }}
                    />
                    <p id={counterId} className="word-counter">
                      {wordCount} of {field.maxWords} words
                    </p>
                    {showWarning ? (
                      <p id={warningId} className="word-warning" role="status">
                        You are near the {field.maxWords}-word limit for this field.
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <nav className="question-navigation" aria-label="Questionnaire navigation">
          <button
            type="button"
            className="secondary-action"
            disabled={!canGoBack}
            onClick={() => onNavigate(previousStepIndex)}
            aria-label={canGoBack ? `Back to step ${previousStepIndex + 1}` : "Back unavailable on the first step"}
          >
            Back
          </button>
          <button
            type="button"
            className="primary-action"
            disabled={!canContinue}
            onClick={() => {
              if (step.kind === "narrative") {
                onNarrativeContinue(step.id, nextStepIndex);
                return;
              }
              onNavigate(nextStepIndex);
            }}
            aria-label={continueLabel}
          >
            {continueLabel}
          </button>
          {step.kind === "narrative" ? (
            <button
              type="button"
              className="secondary-action"
              onClick={() => onNarrativeSkip(step.id, nextStepIndex)}
              aria-label={`Skip this exercise and continue to step ${nextStepIndex + 1}`}
            >
              Skip this exercise
            </button>
          ) : null}
        </nav>
      </section>

      <section className="card exit-card" aria-labelledby="exit-delete-title">
        <h2 id="exit-delete-title">Need to stop?</h2>
        <p>Delete the current in-browser draft before leaving this assessment.</p>
        <button
          type="button"
          className="danger-action"
          data-requires-confirmation="true"
          onClick={() => {
            if (globalThis.confirm("Delete your current answers and return to the start?")) {
              onExitAndDelete();
            }
          }}
        >
          Exit and delete current answers
        </button>
      </section>
    </main>
  );
}

type ReviewScreenProps = {
  questionnaire: PublicQuestionnaireResponse;
  state: AssessmentState;
  onBack: () => void;
  onEditStep: (stepIndex: number) => void;
  onSubmit: () => void;
};

export function ReviewScreen({ questionnaire, state, onBack, onEditStep, onSubmit }: ReviewScreenProps) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const dimensionCounts = buildDimensionReviewCounts(questionnaire, state.structuredAnswers);
  const structuredSteps = questionnaire.steps.filter((step) => step.kind === "structured");
  const narrativeSteps = questionnaire.steps.filter((step) => step.kind === "narrative");

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main className="flow-shell questionnaire-shell review-shell" data-focus-seam="heading">
      <section aria-labelledby="review-title" className="card review-card">
        <p className="eyebrow">Review</p>
        <h1 id="review-title" ref={headingRef} tabIndex={-1} className="question-heading">
          Review before submitting
        </h1>
        <p className="question-prompt">
          Check completeness before submitting. This review does not show numeric results, maturity bands, or
          selected answer labels.
        </p>

        <section aria-labelledby="review-dimensions-title" className="review-section">
          <h2 id="review-dimensions-title">Structured item completeness</h2>
          <ul className="review-summary-list">
            {dimensionCounts.map((count) => (
              <li
                key={count.dimension}
                aria-label={`${count.label}: ${count.completed} of ${count.total} completed; ${count.answered} answered, ${count.notApplicable} Not applicable, ${count.unanswered} unanswered.`}
              >
                <strong>{count.label}</strong>: {count.completed} of {count.total} completed; {count.answered} answered, {count.notApplicable} Not applicable, {count.unanswered} unanswered.
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="review-items-title" className="review-section">
          <h2 id="review-items-title">Structured items</h2>
          <ol className="review-item-list">
            {structuredSteps.map((step) => {
              const selectedOptionId = state.structuredAnswers[step.id];
              const selectedOption = step.options.find((option) => option.id === selectedOptionId);
              const status = !selectedOption
                ? "Unanswered"
                : selectedOption.isNotApplicable
                  ? "Not applicable"
                  : "Answered";
              const editTarget = resolveReviewEditTarget(questionnaire, step.id);

              return (
                <li key={step.id}>
                  <span>{step.id}: {status}</span>
                  {editTarget ? (
                    <button
                      type="button"
                      className="secondary-action compact-action"
                      data-edit-step-index={editTarget.stepIndex}
                      data-edit-heading-id={editTarget.headingFocusId}
                      onClick={() => onEditStep(editTarget.stepIndex)}
                      aria-label={`Edit ${step.id}. Opens ${editTarget.headingFocusId} and moves focus to that heading.`}
                    >
                      Edit
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>

        <section aria-labelledby="review-narratives-title" className="review-section">
          <h2 id="review-narratives-title">Optional narrative exercises</h2>
          <ul className="review-item-list">
            {narrativeSteps.map((step) => {
              const summary = summarizeNarrativeReviewStatus(questionnaire, step.id, state.narratives[step.id]);
              const editTarget = resolveReviewEditTarget(questionnaire, step.id);
              return (
                <li key={step.id}>
                  <span>
                    {summary.title}: {formatNarrativeStatus(summary.status)} ({summary.wordCount} of {summary.minimumWords} minimum words)
                  </span>
                  {editTarget ? (
                    <button
                      type="button"
                      className="secondary-action compact-action"
                      data-edit-step-index={editTarget.stepIndex}
                      data-edit-heading-id={editTarget.headingFocusId}
                      onClick={() => onEditStep(editTarget.stepIndex)}
                      aria-label={`Edit ${summary.title}. Opens ${editTarget.headingFocusId} and moves focus to that heading.`}
                    >
                      Edit
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="review-choices-title" className="review-section">
          <h2 id="review-choices-title">Result choices</h2>
          <ul className="review-summary-list">
            <li>AI-assisted narrative analysis: {state.consent.aiConsent ? "enabled" : "disabled"}</li>
            <li>Maturity-age metaphor: {state.preferences.includeAgeMetaphor ? "enabled" : "disabled"}</li>
          </ul>
        </section>

        <nav className="question-navigation" aria-label="Review navigation">
          <button type="button" className="secondary-action" onClick={onBack}>
            Back
          </button>
          <button type="button" className="primary-action" onClick={onSubmit}>
            Submit assessment
          </button>
        </nav>
      </section>
    </main>
  );
}

export function DeterministicResultsScreen({
  result,
  aiAnalysisEnabled,
  onExportGenerated,
  onStartOver,
}: {
  result: ScoreResult;
  aiAnalysisEnabled: boolean;
  onExportGenerated?: (format: ExportFormat) => void;
  onStartOver?: () => void;
}) {
  const strongest = pickStrongestDimension(result.dimensions);
  const growthAreas = getGrowthAreaDimensions(result.dimensions);
  const unavailableDimension = getIndexUnavailableDimension(result.dimensions);
  const aiAnalysis: ExportableAiAnalysis = aiAnalysisEnabled ? { status: "unavailable", reason: "not_scored" } : { status: "disabled" };

  const generateExport = (format: ExportFormat) => {
    const payload = buildResultExportPayload({ result, aiAnalysis });
    if (format === "json") {
      downloadTextFile("reflective-maturity-profile-results.json", "application/json", JSON.stringify(payload, null, 2));
    } else {
      downloadTextFile("reflective-maturity-profile-results.html", "text/html", buildPrintableResultHtml(payload));
    }
    emitExportGenerated(format);
    onExportGenerated?.(format);
  };

  return (
    <main
      className="flow-shell results-shell"
      data-reduced-motion="respect"
      data-min-layout-width="320"
      data-zoom-support="200"
    >
      <section aria-labelledby="results-title" className="card results-hero-card">
        <p className="eyebrow">Deterministic results</p>
        <h1 id="results-title">Structured Maturity Index</h1>
        {result.structuredMaturityIndex === null ? (
          <div className="result-score-unavailable" role="status">
            <p className="result-score-label">Index unavailable</p>
            <p>
              {unavailableDimension
                ? `Answer more items in ${unavailableDimension} to show the aggregate index.`
                : "Answer more structured items to show the aggregate index."}
            </p>
          </div>
        ) : (
          <p className="result-score" aria-label={`Structured Maturity Index ${result.structuredMaturityIndex} out of 100`}>
            {result.structuredMaturityIndex} / 100
          </p>
        )}
        <p className="subtle-note">
          This number is available as text immediately; any visual emphasis must not delay access to it.
        </p>
        <p>
          Confidence: {formatConfidenceLabel(result.confidence.label)} ({result.confidence.score} / 100)
        </p>
        {result.confidence.reasons.length === 0 ? (
          <p>No confidence deductions were applied.</p>
        ) : (
          <ul>
            {result.confidence.reasons.map((reason, index) => (
              <li key={`${reason.code}-${index}`}>{formatConfidenceReason(reason)}</li>
            ))}
          </ul>
        )}
        <p className="result-disclaimer">
          This is not a clinical assessment, diagnosis, or literal measure of psychological age.
        </p>
      </section>

      <section aria-labelledby="dimension-results-title" className="card results-section-card">
        <h2 id="dimension-results-title">Dimension profile</h2>
        <div className="dimension-result-grid">
          {DIMENSION_IDS.map((dimension) => {
            const dimensionResult = result.dimensions[dimension];
            const label = DIMENSION_LABELS[dimension];
            if (dimensionResult.status === "insufficient_data") {
              return (
                <article key={dimension} className="dimension-result-card">
                  <h3>{label}: Insufficient data</h3>
                  <p>{dimensionResult.answered} of {dimensionResult.required} required scored answers available; {dimensionResult.available} items total.</p>
                  <p className="sr-only">Text equivalent: {label} has insufficient data.</p>
                </article>
              );
            }

            const band = getDimensionBandLabel(dimensionResult.score);
            return (
              <article key={dimension} className="dimension-result-card">
                <h3>{label}</h3>
                <p className="dimension-score-text">{dimensionResult.score} / 100 · {band}</p>
                <div
                  className="dimension-score-bar"
                  aria-hidden="true"
                  style={{ "--score-percent": `${dimensionResult.score}%` } as CSSProperties}
                />
                <p>Text equivalent: {label} scored {dimensionResult.score} out of 100 and is in the {band} band.</p>
              </article>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="profile-pattern-title" className="card results-section-card">
        <h2 id="profile-pattern-title">Profile pattern</h2>
        {result.profileBalance ? (
          <p>Profile balance: {formatProfileBalanceLabel(result.profileBalance.label)} (spread {result.profileBalance.spread}).</p>
        ) : (
          <p>Profile balance is unavailable until at least one dimension is reportable.</p>
        )}
        {strongest ? (
          <p>{strongest.label} is the strongest reportable dimension at {strongest.score} / 100.</p>
        ) : (
          <p>No strongest dimension is shown until at least one dimension is reportable.</p>
        )}
        {growthAreas.length > 0 ? (
          <p>
            Lower reportable dimensions to inspect: {growthAreas.map((area) => `${area.label} (${area.score} / 100)`).join(", ")}.
          </p>
        ) : (
          <p>No lower reportable dimensions are shown until dimensions become reportable.</p>
        )}
      </section>

      {result.maturityAgeMetaphor === null ? null : (
        <section aria-labelledby="age-metaphor-title" className="card results-section-card">
          <h2 id="age-metaphor-title">Maturity-age metaphor</h2>
          <p>{result.maturityAgeMetaphor}</p>
          <p>
            This is a playful mapping of the index onto a 16–72 scale. It is not your literal or clinical psychological age, and older does not mean more valuable.
          </p>
        </section>
      )}

      <section aria-labelledby="ai-analysis-slot-title" className="card results-section-card">
        <h2 id="ai-analysis-slot-title">AI analysis</h2>
        <p>{aiAnalysisEnabled ? "AI analysis unavailable" : "AI analysis unavailable"}</p>
        <div data-ai-analysis-slot="reserved-for-I011" />
      </section>

      <section aria-labelledby="export-start-over-title" className="card results-section-card" data-export-content="local-browser-only">
        <h2 id="export-start-over-title">Export or start over</h2>
        <p>Exports are generated in this browser only and do not send result content to a third party.</p>
        <nav className="question-navigation" aria-label="Result export and start over actions">
          <button type="button" className="secondary-action" onClick={() => generateExport("json")}>
            Download JSON
          </button>
          <button type="button" className="secondary-action" onClick={() => generateExport("printable_html")}>
            Printable HTML
          </button>
          {onStartOver ? (
            <button
              type="button"
              className="danger-action"
              data-requires-confirmation="true"
              onClick={() => {
                if (globalThis.confirm("Delete your current results and answers, then return to the start?")) {
                  onStartOver();
                }
              }}
            >
              Start over
            </button>
          ) : null}
        </nav>
      </section>
    </main>
  );
}

function SubmittingScreen({ error }: { error: string | null }) {
  return (
    <main className="flow-shell questionnaire-shell">
      <section aria-labelledby="submitting-title" className="card review-card">
        <p className="eyebrow">Submit</p>
        <h1 id="submitting-title" className="question-heading" tabIndex={-1}>Submitting assessment</h1>
        <p className="question-prompt">Requesting deterministic scoring. Results will appear here before any optional AI analysis.</p>
        {error ? <p role="alert">{error}</p> : null}
      </section>
    </main>
  );
}

export function StructuredQuestionFlow({
  questionnaire,
  onExportGenerated,
  invalidateEphemeralAnalysisToken,
}: {
  questionnaire: PublicQuestionnaireResponse;
  onExportGenerated?: (format: ExportFormat) => void;
  invalidateEphemeralAnalysisToken?: () => void | Promise<void>;
}) {
  const { state, dispatch, discardLocalDraft } = useAssessment();
  const steps = useMemo(() => buildAssessmentSteps(questionnaire), [questionnaire]);
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const submissionStartedRef = useRef(false);

  useEffect(() => {
    if (state.phase !== "submitting" || submissionStartedRef.current) return;
    submissionStartedRef.current = true;
    setScoreError(null);

    const submit = async () => {
      try {
        const response = await fetch("/api/v1/assessments/score", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(buildScoreRequestFromState(state)),
        });
        if (!response.ok) {
          throw new Error(`Score API returned ${response.status}`);
        }
        const body = (await response.json()) as ScoreSuccessResponse;
        setScoreResult(body.result);
        dispatch({ type: "set_phase", phase: "results" });
      } catch {
        setScoreError("Deterministic scoring is unavailable. Please review your answers and try submitting again.");
        submissionStartedRef.current = false;
      }
    };

    void submit();
  }, [dispatch, state]);

  if (state.phase === "review") {
    return (
      <ReviewScreen
        questionnaire={questionnaire}
        state={state}
        onBack={() => dispatch({ type: "set_phase", phase: "assessment" })}
        onEditStep={(stepIndex) => {
          dispatch({ type: "set_current_step_index", currentStepIndex: stepIndex });
          dispatch({ type: "set_phase", phase: "assessment" });
        }}
        onSubmit={() => {
          submissionStartedRef.current = false;
          setScoreResult(null);
          setScoreError(null);
          dispatch({ type: "set_phase", phase: "submitting" });
        }}
      />
    );
  }

  if (state.phase === "submitting") {
    return <SubmittingScreen error={scoreError} />;
  }

  if (state.phase === "results" && scoreResult) {
    return (
      <DeterministicResultsScreen
        result={scoreResult}
        aiAnalysisEnabled={state.consent.aiConsent}
        onExportGenerated={onExportGenerated}
        onStartOver={() => {
          discardLocalDraft();
          setScoreResult(null);
          setScoreError(null);
          submissionStartedRef.current = false;
          try {
            void invalidateEphemeralAnalysisToken?.();
          } catch {
            // Local deletion must succeed even when a future ephemeral-token invalidation endpoint fails.
          }
        }}
      />
    );
  }

  if (state.phase === "landing" || state.phase === "consent") return null;

  return (
    <StructuredQuestionScreen
      questionnaire={questionnaire}
      state={state}
      onAnswer={(questionId, optionId) => dispatch({ type: "set_structured_answer", questionId, optionId })}
      onNarrativeFieldChange={(exerciseId, fieldId, value) => {
        dispatch({ type: "set_narrative_field", exerciseId, fieldId, value });
      }}
      onNarrativeContinue={(exerciseId, stepIndex) => {
        dispatch({ type: "set_narrative_skipped", exerciseId, skipped: false });
        dispatch({ type: "set_current_step_index", currentStepIndex: stepIndex });
      }}
      onNarrativeSkip={(exerciseId, stepIndex) => {
        dispatch({ type: "set_narrative_skipped", exerciseId, skipped: true });
        dispatch({ type: "set_current_step_index", currentStepIndex: stepIndex });
      }}
      onNavigate={(stepIndex) => {
        if (stepIndex === steps.length - 1 && state.currentStepIndex === steps.length - 1) {
          dispatch({ type: "set_phase", phase: "review" });
          return;
        }
        dispatch({ type: "set_current_step_index", currentStepIndex: stepIndex });
      }}
      onExitAndDelete={() => {
        discardLocalDraft();
      }}
    />
  );
}
