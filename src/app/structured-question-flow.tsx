"use client";

import { useEffect, useMemo, useRef } from "react";
import type { KeyboardEvent } from "react";

import { useAssessment, type AssessmentState } from "@/client/assessment-state";
import { countWords } from "@/domain/narrative-rubric";
import type { DimensionId } from "@/domain/result-types";
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

function formatNarrativeStatus(status: NarrativeReviewStatus): string {
  if (status === "complete") return "Complete";
  if (status === "partial") return "Partial";
  return "Skipped";
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

function SubmittingScreen() {
  return (
    <main className="flow-shell questionnaire-shell">
      <section aria-labelledby="submitting-title" className="card review-card">
        <p className="eyebrow">Submit</p>
        <h1 id="submitting-title" className="question-heading" tabIndex={-1}>Submitting assessment</h1>
        <p className="question-prompt">Preparing the deterministic submission. Results are implemented in the next issue.</p>
      </section>
    </main>
  );
}

export function StructuredQuestionFlow({ questionnaire }: { questionnaire: PublicQuestionnaireResponse }) {
  const { state, dispatch, discardLocalDraft } = useAssessment();
  const steps = useMemo(() => buildAssessmentSteps(questionnaire), [questionnaire]);

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
        onSubmit={() => dispatch({ type: "set_phase", phase: "submitting" })}
      />
    );
  }

  if (state.phase === "submitting") {
    return <SubmittingScreen />;
  }

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
        dispatch({ type: "set_phase", phase: "landing" });
      }}
    />
  );
}
