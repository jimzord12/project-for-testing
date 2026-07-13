"use client";

import { useEffect, useMemo, useRef } from "react";
import type { KeyboardEvent } from "react";

import { useAssessment, type AssessmentState } from "@/client/assessment-state";
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

type StructuredQuestionScreenProps = {
  questionnaire: PublicQuestionnaireResponse;
  state: AssessmentState;
  onAnswer: (questionId: string, optionId: string) => void;
  onNavigate: (stepIndex: number) => void;
  onExitAndDelete: () => void;
};

export function StructuredQuestionScreen({
  questionnaire,
  state,
  onAnswer,
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
            <p className="question-prompt">Narrative exercise placeholder</p>
            <p>{step.intro}</p>
            <p className="subtle-note">Narrative fields arrive in the next implementation slice. You can continue for now.</p>
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
            onClick={() => onNavigate(nextStepIndex)}
            aria-label={continueLabel}
          >
            {continueLabel}
          </button>
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

export function StructuredQuestionFlow({ questionnaire }: { questionnaire: PublicQuestionnaireResponse }) {
  const { state, dispatch, discardLocalDraft } = useAssessment();
  const steps = useMemo(() => buildAssessmentSteps(questionnaire), [questionnaire]);

  return (
    <StructuredQuestionScreen
      questionnaire={questionnaire}
      state={state}
      onAnswer={(questionId, optionId) => dispatch({ type: "set_structured_answer", questionId, optionId })}
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
