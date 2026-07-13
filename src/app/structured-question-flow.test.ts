import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  DIMENSION_LABELS,
  StructuredQuestionScreen,
  buildAssessmentSteps,
  enforceNarrativeFieldCap,
  getAdjacentStepIndex,
  handleRadioKeyDown,
  makeQuestionHeadingFocusId,
  shouldShowNarrativeWordWarning,
} from "./structured-question-flow";
import { createInitialAssessmentState, serializeAssessmentState } from "@/client/assessment-state";
import { getPublicQuestionnaire } from "@/domain/questionnaire";
import { SCORING_VERSION } from "@/domain/versions";
import { countWords } from "@/domain/narrative-rubric";
import { publicQuestionnaireResponseSchema, type PublicQuestionnaireResponse } from "./api/v1/questionnaire/route";

function publicQuestionnaireFixture(): PublicQuestionnaireResponse {
  const projection = getPublicQuestionnaire();
  const [firstNarrative, secondNarrative] = projection.narrative;
  if (!firstNarrative || !secondNarrative) throw new Error("fixture missing narratives");
  return publicQuestionnaireResponseSchema.parse({
    questionnaireVersion: projection.questionnaireVersion,
    scoringVersion: SCORING_VERSION,
    steps: [
      ...projection.structured.slice(0, 8),
      firstNarrative,
      ...projection.structured.slice(8, 14),
      secondNarrative,
      ...projection.structured.slice(14),
    ],
    disclaimer: projection.disclaimer,
    estimatedMinutes: { min: 12, max: 18 },
  });
}

function renderQuestionScreen(state = createInitialAssessmentState()) {
  return renderToStaticMarkup(
    createElement(StructuredQuestionScreen, {
      questionnaire: publicQuestionnaireFixture(),
      state,
      onAnswer: () => undefined,
      onNarrativeFieldChange: () => undefined,
      onNarrativeContinue: () => undefined,
      onNarrativeSkip: () => undefined,
      onNavigate: () => undefined,
      onExitAndDelete: () => undefined,
    }),
  );
}

describe("I005 assessment step mapping", () => {
  it("maps 24 structured questions and two narrative insertions into exact canonical 26-step order", () => {
    const steps = buildAssessmentSteps(publicQuestionnaireFixture());

    expect(steps).toHaveLength(26);
    expect(steps.map((step) => step.id)).toEqual([
      "ER01",
      "ER02",
      "ER03",
      "ER04",
      "ER05",
      "IC01",
      "IC02",
      "IC03",
      "N01",
      "IC04",
      "IC05",
      "PT01",
      "PT02",
      "PT03",
      "PT04",
      "N02",
      "PT05",
      "IS01",
      "IS02",
      "IS03",
      "IS04",
      "TD01",
      "TD02",
      "TD03",
      "TD04",
      "TD05",
    ]);
    expect(steps[0]).toMatchObject({ kind: "structured", structuredOrdinal: 1, visualStepNumber: 1 });
    expect(steps[8]).toMatchObject({ kind: "narrative", visualStepNumber: 9 });
    expect(steps[14]).toMatchObject({ kind: "structured", structuredOrdinal: 14, visualStepNumber: 15 });
    expect(steps[15]).toMatchObject({ kind: "narrative", visualStepNumber: 16 });
    expect(steps[25]).toMatchObject({ kind: "structured", structuredOrdinal: 24, visualStepNumber: 26 });
  });

  it("computes navigation boundaries without leaving the 26-step flow", () => {
    expect(getAdjacentStepIndex(0, "back", 26)).toBe(0);
    expect(getAdjacentStepIndex(0, "continue", 26)).toBe(1);
    expect(getAdjacentStepIndex(8, "back", 26)).toBe(7);
    expect(getAdjacentStepIndex(8, "continue", 26)).toBe(9);
    expect(getAdjacentStepIndex(14, "back", 26)).toBe(13);
    expect(getAdjacentStepIndex(14, "continue", 26)).toBe(15);
    expect(getAdjacentStepIndex(25, "continue", 26)).toBe(25);
  });

  it("exposes stable heading focus ids for mount and later edit navigation", () => {
    expect(makeQuestionHeadingFocusId(0)).toBe("assessment-step-1-heading");
    expect(makeQuestionHeadingFocusId(25)).toBe("assessment-step-26-heading");
  });
});

describe("I005 structured question screen", () => {
  it("renders one native radio group labelled by the focused question heading with neutral dimension copy", () => {
    const html = renderQuestionScreen({ ...createInitialAssessmentState(), phase: "assessment" });

    expect(html).toContain("Step 1 of 26");
    expect(html).toContain(`Dimension: ${DIMENSION_LABELS.ER}`);
    expect(html).toContain("Receiving criticism");
    expect(html).toContain("role=\"radiogroup\"");
    expect(html).toContain("aria-labelledby=\"assessment-step-1-heading\"");
    expect(html).toContain("tabindex=\"-1\"");
    expect(html).toContain("type=\"radio\"");
    expect(html).toContain("Not applicable / I cannot recall a relevant situation");
    expect(html).toContain("option-row option-row-not-applicable");
  });

  it("keeps Continue disabled until the current structured item has a selected answer", () => {
    const base = { ...createInitialAssessmentState(), phase: "assessment" as const };
    const unanswered = renderQuestionScreen(base);
    const answered = renderQuestionScreen({ ...base, structuredAnswers: { ER01: "C" } });

    expect(unanswered).toContain("disabled=\"\"");
    expect(answered).toContain("aria-label=\"Continue to step 2\"");
    expect(answered).toContain("checked=\"\"");
    expect(answered).not.toContain("primary-action\" disabled=\"\"");
  });

  it("renders canonical narrative exercise fields, privacy copy, and skip action", () => {
    const html = renderQuestionScreen({ ...createInitialAssessmentState(), phase: "assessment", currentStepIndex: 8 });

    expect(html).toContain("Step 9 of 26");
    expect(html).toContain("The Friction Story");
    expect(html).toContain("This exercise is optional.");
    expect(html).toContain("These answers may contain personal information.");
    expect(html).toContain("You can skip them and still receive the structured profile.");
    expect(html).toContain("What happened, and what did you do?");
    expect(html).toContain("What were you telling yourself at the time?");
    expect(html).toContain("What do you understand differently now?");
    expect(html).toContain("0 of 90 words");
    expect(html).toContain("Skip this exercise");
    expect(html).toContain("Continue to step 10");
    expect(html).toContain("<textarea");
  });

  it("restores saved narrative drafts with live word counts and a cleared skipped flag", () => {
    const state = {
      ...createInitialAssessmentState(),
      phase: "assessment" as const,
      currentStepIndex: 15,
      narratives: {
        N02: {
          skipped: false,
          fields: { pattern: "I keep repeating a decision pattern I do not understand" },
        },
      },
    };
    const html = renderQuestionScreen(state);

    expect(html).toContain("The Unsolved Pattern");
    expect(html).toContain("I keep repeating a decision pattern I do not understand");
    expect(html).toContain(`${countWords(state.narratives.N02.fields.pattern)} of 70 words`);
    expect(serializeAssessmentState(state)).toContain('"skipped":false');
  });

  it("warns at the canonical 80 percent word-count threshold without color-only signaling", () => {
    const warningText = Array.from({ length: 72 }, (_, index) => `word${index}`).join(" ");
    const html = renderQuestionScreen({
      ...createInitialAssessmentState(),
      phase: "assessment",
      currentStepIndex: 8,
      narratives: { N01: { skipped: false, fields: { event: warningText } } },
    });

    expect(shouldShowNarrativeWordWarning(71, 90)).toBe(false);
    expect(shouldShowNarrativeWordWarning(72, 90)).toBe(true);
    expect(html).toContain("72 of 90 words");
    expect(html).toContain("You are near the 90-word limit for this field.");
    expect(html).toContain("role=\"status\"");
  });

  it("preserves the last valid narrative value when input or paste would exceed the cap", () => {
    const previous = Array.from({ length: 90 }, (_, index) => `kept${index}`).join(" ");
    const tooLong = `${previous} extra`;

    expect(enforceNarrativeFieldCap(tooLong, previous, 90)).toBe(previous);
    expect(enforceNarrativeFieldCap("short replacement", previous, 90)).toBe("short replacement");
  });

  it("keeps narrative navigation and keyboard controls native at insertion steps 9 and 16", () => {
    const first = renderQuestionScreen({ ...createInitialAssessmentState(), phase: "assessment", currentStepIndex: 8 });
    const second = renderQuestionScreen({ ...createInitialAssessmentState(), phase: "assessment", currentStepIndex: 15 });

    expect(first).toContain("aria-label=\"Back to step 8\"");
    expect(first).toContain("aria-label=\"Continue to step 10\"");
    expect(second).toContain("aria-label=\"Back to step 15\"");
    expect(second).toContain("aria-label=\"Continue to step 17\"");
    expect(first).toContain("tabindex=\"-1\"");
    expect(first).toContain("data-focus-seam=\"heading\"");
    expect(first).toContain("data-keyboard-operation=\"native-textarea-buttons\"");
  });

  it("does not render numeric scores, correctness, or desirability hints and stores only option ids", () => {
    const state = { ...createInitialAssessmentState(), structuredAnswers: { ER01: "C" }, phase: "assessment" as const };
    const html = renderQuestionScreen(state).toLowerCase();
    const serialized = serializeAssessmentState(state);

    expect(html).not.toContain("score");
    expect(html).not.toContain("correct");
    expect(html).not.toContain("mature answer");
    expect(serialized).toContain('"structuredAnswers":{"ER01":"C"}');
    expect(serialized).not.toContain('"score"');
    expect(serialized).not.toContain("desirability");
  });

  it("declares the target-size and responsive accessibility contracts in rendered markup", () => {
    const html = renderQuestionScreen({ ...createInitialAssessmentState(), phase: "assessment" });

    expect(html).toContain("data-min-target-size=\"44x44\"");
    expect(html).toContain("data-min-layout-width=\"320\"");
    expect(html).toContain("data-zoom-support=\"200\"");
    expect(html).toContain("data-reduced-motion=\"respect\"");
  });

  it("provides a guarded exit-and-delete action separate from normal navigation", () => {
    const html = renderQuestionScreen({ ...createInitialAssessmentState(), phase: "assessment" });

    expect(html).toContain("Exit and delete current answers");
    expect(html).toContain("data-requires-confirmation=\"true\"");
  });

  it("handles radio keyboard intent for arrows, Space, and Enter without implicit form submission", () => {
    expect(handleRadioKeyDown("ArrowDown", 0, 6)).toEqual({ action: "move", nextIndex: 1 });
    expect(handleRadioKeyDown("ArrowUp", 0, 6)).toEqual({ action: "move", nextIndex: 5 });
    expect(handleRadioKeyDown(" ", 2, 6)).toEqual({ action: "select", nextIndex: 2 });
    expect(handleRadioKeyDown("Enter", 3, 6)).toEqual({ action: "select", nextIndex: 3 });
    expect(handleRadioKeyDown("Tab", 3, 6)).toEqual({ action: "ignore", nextIndex: 3 });
  });
});
