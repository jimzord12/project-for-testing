// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DIMENSION_LABELS,
  DeterministicResultsScreen,
  ReviewScreen,
  StructuredQuestionFlow,
  StructuredQuestionScreen,
  buildAssessmentSteps,
  buildDimensionReviewCounts,
  buildScoreRequestFromState,
  buildPrintableResultHtml,
  buildResultExportPayload,
  enforceNarrativeFieldCap,
  getAdjacentStepIndex,
  getDimensionBandLabel,
  getGrowthAreaDimensions,
  handleRadioKeyDown,
  makeQuestionHeadingFocusId,
  pickStrongestDimension,
  resolveReviewEditTarget,
  summarizeNarrativeReviewStatus,
  shouldShowNarrativeWordWarning,
} from "./structured-question-flow";
import {
  ASSESSMENT_SESSION_STORAGE_KEY,
  AssessmentProvider,
  createInitialAssessmentState,
  serializeAssessmentState,
} from "@/client/assessment-state";
import { getPublicQuestionnaire } from "@/domain/questionnaire";
import { PROMPT_VERSION, QUESTIONNAIRE_VERSION, SCORING_VERSION } from "@/domain/versions";
import { countWords } from "@/domain/narrative-rubric";
import type { ScoreSuccessResponse } from "./api/v1/assessments/score/score-service";
import { publicQuestionnaireResponseSchema, type PublicQuestionnaireResponse } from "./api/v1/questionnaire/route";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

function renderReviewScreen(state = createInitialAssessmentState()) {
  return renderToStaticMarkup(
    createElement(ReviewScreen, {
      questionnaire: publicQuestionnaireFixture(),
      state,
      onBack: () => undefined,
      onEditStep: () => undefined,
      onSubmit: () => undefined,
    }),
  );
}

function reportableResultFixture(overrides: Partial<ScoreSuccessResponse["result"]> = {}): ScoreSuccessResponse["result"] {
  return {
    questionnaireVersion: QUESTIONNAIRE_VERSION,
    scoringVersion: SCORING_VERSION,
    structuredMaturityIndex: 68,
    confidence: { score: 88, label: "high", reasons: [] },
    dimensions: {
      ER: { status: "reportable", score: 70, answered: 5, available: 5 },
      IC: { status: "reportable", score: 55, answered: 4, available: 5 },
      PT: { status: "reportable", score: 80, answered: 5, available: 5 },
      IS: { status: "reportable", score: 69, answered: 4, available: 4 },
      TD: { status: "reportable", score: 65, answered: 5, available: 5 },
    },
    profileBalance: { spread: 25, label: "some_unevenness" },
    maturityAgeMetaphor: null,
    ...overrides,
  };
}

function renderResults(result: ScoreSuccessResponse["result"], aiAnalysisEnabled = false) {
  return renderToStaticMarkup(
    createElement(DeterministicResultsScreen, {
      result,
      aiAnalysisEnabled,
    }),
  );
}

function completedAiAnalysisFixture() {
  return {
    status: "completed" as const,
    headline: "<script>alert('x')</script> Pattern insight",
    observations: ["You paused before sending the reply.", "<img src=x onerror=alert(1)>"],
    experiments: ["Try a 10-minute delay before charged messages.", "Name the trade-off in one sentence."],
    narrativeSelfAwareness: {
      status: "scored" as const,
      score: 7,
      confidence: "moderate" as const,
      summary: "Specific but still uncertain.",
    },
    uncertaintyNote: "Model output is an aid, not a verdict.",
    safetyOrLimitationNote: "If this feels urgent, seek human support.",
  };
}

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

let mountedRoot: Root | null = null;
let mountedContainer: HTMLDivElement | null = null;

function cleanupMountedFlow() {
  if (mountedRoot) {
    act(() => mountedRoot?.unmount());
  }
  mountedRoot = null;
  mountedContainer?.remove();
  mountedContainer = null;
}

afterEach(() => {
  cleanupMountedFlow();
  vi.restoreAllMocks();
});

function renderFlowInBrowser(state = createInitialAssessmentState()) {
  cleanupMountedFlow();
  const storage = new MemoryStorage();
  storage.setItem(ASSESSMENT_SESSION_STORAGE_KEY, serializeAssessmentState(state));
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      createElement(
        AssessmentProvider,
        {
          storage,
          debounceMs: 0,
          children: createElement(StructuredQuestionFlow, { questionnaire: publicQuestionnaireFixture() }),
        },
      ),
    );
  });

  mountedRoot = root;
  mountedContainer = container;
  return { container, storage };
}

function getButtonByLabel(container: HTMLElement, label: RegExp): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
    label.test(candidate.getAttribute("aria-label") ?? candidate.textContent ?? ""),
  );
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Missing button matching ${label}`);
  return button;
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

describe("I007 review helpers", () => {
  it("counts answered, Not applicable, and unanswered structured items per dimension without double-counting completed items", () => {
    const counts = buildDimensionReviewCounts(publicQuestionnaireFixture(), {
      ER01: "C",
      ER02: "NA",
      ER04: "B",
      IC01: "NA",
      IS01: "E",
    });

    expect(counts.find((count) => count.dimension === "ER")).toMatchObject({
      total: 5,
      answered: 2,
      notApplicable: 1,
      completed: 3,
      unanswered: 2,
    });
    expect(counts.find((count) => count.dimension === "IC")).toMatchObject({
      total: 5,
      answered: 0,
      notApplicable: 1,
      completed: 1,
      unanswered: 4,
    });
    expect(counts.find((count) => count.dimension === "IS")).toMatchObject({
      total: 4,
      answered: 1,
      notApplicable: 0,
      completed: 1,
      unanswered: 3,
    });
  });

  it("derives narrative complete, partial, and skipped labels from skip intent and canonical thresholds", () => {
    const words45 = Array.from({ length: 45 }, (_, index) => `word${index}`).join(" ");
    const words34 = Array.from({ length: 34 }, (_, index) => `word${index}`).join(" ");
    const words35 = Array.from({ length: 35 }, (_, index) => `word${index}`).join(" ");

    expect(summarizeNarrativeReviewStatus(publicQuestionnaireFixture(), "N01", { skipped: true, fields: {} })).toMatchObject({
      status: "skipped",
      wordCount: 0,
      minimumWords: 45,
    });
    expect(summarizeNarrativeReviewStatus(publicQuestionnaireFixture(), "N01", { skipped: false, fields: { event: words45 } })).toMatchObject({
      status: "complete",
      wordCount: 45,
      minimumWords: 45,
    });
    expect(summarizeNarrativeReviewStatus(publicQuestionnaireFixture(), "N02", { skipped: false, fields: { pattern: words34 } })).toMatchObject({
      status: "partial",
      wordCount: 34,
      minimumWords: 35,
    });
    expect(summarizeNarrativeReviewStatus(publicQuestionnaireFixture(), "N02", { skipped: false, fields: { pattern: words35 } })).toMatchObject({ status: "complete" });
  });

  it("resolves edit targets for every structured item and narrative exercise to the existing focus seam ids", () => {
    expect(resolveReviewEditTarget(publicQuestionnaireFixture(), "ER01")).toEqual({
      stepIndex: 0,
      headingFocusId: "assessment-step-1-heading",
    });
    expect(resolveReviewEditTarget(publicQuestionnaireFixture(), "N01")).toEqual({
      stepIndex: 8,
      headingFocusId: "assessment-step-9-heading",
    });
    expect(resolveReviewEditTarget(publicQuestionnaireFixture(), "N02")).toEqual({
      stepIndex: 15,
      headingFocusId: "assessment-step-16-heading",
    });
    expect(resolveReviewEditTarget(publicQuestionnaireFixture(), "TD05")).toEqual({
      stepIndex: 25,
      headingFocusId: "assessment-step-26-heading",
    });
  });
});

describe("I007 review screen", () => {
  it("renders accessible dimension counts, full neutral item statuses, and read-only result choices without selected option labels", () => {
    const state = {
      ...createInitialAssessmentState(),
      phase: "review" as const,
      structuredAnswers: { ER01: "C", ER02: "NA", IC01: "A" },
      consent: { isAdult: true, nonClinicalAcknowledged: true, aiConsent: true },
      preferences: { includeAgeMetaphor: true, autoAdvance: false, reducedMotionOverride: null },
    };
    const html = renderReviewScreen(state);

    expect(html).toContain("Review before submitting");
    expect(html).toContain("Emotional Regulation: 2 of 5 completed; 1 answered, 1 Not applicable, 3 unanswered.");
    expect(html).toContain("ER01: Answered");
    expect(html).toContain("ER02: Not applicable");
    expect(html).toContain("ER03: Unanswered");
    expect(html).toContain("AI-assisted narrative analysis: enabled");
    expect(html).toContain("Maturity-age metaphor: enabled");
    expect(html).not.toContain("I asked for a concrete example");
    expect(html.toLowerCase()).not.toContain("score");
    expect(html.toLowerCase()).not.toContain("mature answer");
  });

  it("renders narrative statuses and edit buttons with safe dispatch targets plus native keyboard button semantics", () => {
    const words45 = Array.from({ length: 45 }, (_, index) => `word${index}`).join(" ");
    const html = renderReviewScreen({
      ...createInitialAssessmentState(),
      phase: "review",
      narratives: {
        N01: { skipped: false, fields: { event: words45 } },
        N02: { skipped: true, fields: {} },
      },
    });

    expect(html).toContain("The Friction Story: Complete");
    expect(html).toContain("The Unsolved Pattern: Skipped");
    expect(html).toContain("data-edit-step-index=\"0\"");
    expect(html).toContain("data-edit-step-index=\"8\"");
    expect(html).toContain("data-edit-heading-id=\"assessment-step-9-heading\"");
    expect(html).toContain("type=\"button\"");
    expect(html).toContain("Submit assessment");
  });

  it("opens structured and narrative edit destinations in a browser DOM and moves visible focus to the mounted heading", () => {
    const { container } = renderFlowInBrowser({ ...createInitialAssessmentState(), phase: "review" });

    expect(document.activeElement?.id).toBe("review-title");

    const structuredEdit = getButtonByLabel(container, /^Edit ER01\./);
    expect(structuredEdit.type).toBe("button");

    act(() => structuredEdit.click());

    expect(container.querySelector("h1")?.textContent).toBe("Receiving criticism");
    expect(document.activeElement?.id).toBe("assessment-step-1-heading");

    const finalStepState = { ...createInitialAssessmentState(), phase: "review" as const, currentStepIndex: 25 };
    const rerendered = renderFlowInBrowser(finalStepState);

    expect(rerendered.container.querySelector("h1")?.textContent).toBe("Review before submitting");
    expect(document.activeElement?.id).toBe("review-title");

    const narrativeEdit = getButtonByLabel(rerendered.container, /^Edit The Friction Story\./);
    expect(narrativeEdit.type).toBe("button");

    act(() => narrativeEdit.click());

    expect(rerendered.container.querySelector("h1")?.textContent).toBe("The Friction Story");
    expect(document.activeElement?.id).toBe("assessment-step-9-heading");
  });

  it("keeps edit controls from submitting and advances to the submitting phase only from the Submit button", () => {
    const { container, storage } = renderFlowInBrowser({ ...createInitialAssessmentState(), phase: "review" });

    act(() => getButtonByLabel(container, /^Edit ER01\./).click());

    expect(container.querySelector("h1")?.textContent).toBe("Receiving criticism");
    expect(storage.getItem(ASSESSMENT_SESSION_STORAGE_KEY)).not.toContain('\"phase\":\"submitting\"');

    const reviewState = { ...createInitialAssessmentState(), phase: "review" as const };
    const rerendered = renderFlowInBrowser(reviewState);

    act(() => getButtonByLabel(rerendered.container, /^Submit assessment$/).click());

    expect(rerendered.container.querySelector("h1")?.textContent).toBe("Submitting assessment");
    cleanupMountedFlow();
    expect(rerendered.storage.getItem(ASSESSMENT_SESSION_STORAGE_KEY)).toContain('\"phase\":\"submitting\"');
  });
});


describe("I008 deterministic results helpers", () => {
  it("builds the score API request from local answer ids and age-metaphor preference only", () => {
    const state = {
      ...createInitialAssessmentState(),
      structuredAnswers: { ER02: "NA", ER01: "C" },
      preferences: { includeAgeMetaphor: true, autoAdvance: false, reducedMotionOverride: null },
    };

    expect(buildScoreRequestFromState(state)).toEqual({
      questionnaireVersion: QUESTIONNAIRE_VERSION,
      answers: [
        { questionId: "ER01", optionId: "C" },
        { questionId: "ER02", optionId: "NA" },
      ],
      preferences: { includeAgeMetaphor: true },
    });
  });

  it("uses DD-6 dimension bands and neutral strongest/growth-area selections", () => {
    const result = reportableResultFixture();

    expect(getDimensionBandLabel(0)).toBe("Emerging");
    expect(getDimensionBandLabel(25)).toBe("Developing");
    expect(getDimensionBandLabel(50)).toBe("Established");
    expect(getDimensionBandLabel(75)).toBe("Proficient");
    expect(getDimensionBandLabel(90)).toBe("Integrated");
    expect(pickStrongestDimension(result.dimensions)).toEqual({ dimension: "PT", label: "Perspective-Taking", score: 80 });
    expect(getGrowthAreaDimensions(result.dimensions)).toEqual([
      { dimension: "IC", label: "Impulse Control", score: 55 },
      { dimension: "TD", label: "Temporal Depth", score: 65 },
    ]);
  });
});

describe("I008 deterministic results screen", () => {
  it("renders the maturity index immediately with confidence, dimensions, balance, disclaimer, text equivalents, and AI unavailable slot", () => {
    const html = renderResults(reportableResultFixture());

    expect(html).toContain("Structured Maturity Index");
    expect(html).toContain("68 / 100");
    expect(html).toContain("Confidence: High (88 / 100)");
    expect(html).toContain("No confidence deductions were applied.");
    expect(html).toContain("Perspective-Taking is the strongest reportable dimension at 80 / 100.");
    expect(html).toContain("Lower reportable dimensions to inspect: Impulse Control (55 / 100), Temporal Depth (65 / 100).");
    expect(html).toContain("Profile balance: Some unevenness (spread 25).");
    expect(html).toContain("Emotional Regulation");
    expect(html).toContain("70 / 100 · Established");
    expect(html).toContain("Text equivalent: Emotional Regulation scored 70 out of 100 and is in the Established band.");
    expect(html).toContain("AI analysis unavailable");
    expect(html).toContain("This is not a clinical assessment, diagnosis, or literal measure of psychological age.");
    expect(html).toContain("data-reduced-motion=\"respect\"");
    expect(html).toContain("data-min-layout-width=\"320\"");
    expect(html).toContain("data-zoom-support=\"200\"");
  });

  it("renders null index and insufficient dimension states without fabricating numbers", () => {
    const html = renderResults(reportableResultFixture({
      structuredMaturityIndex: null,
      dimensions: {
        ER: { status: "insufficient_data", answered: 3, required: 4, available: 5 },
        IC: { status: "reportable", score: 55, answered: 4, available: 5 },
        PT: { status: "reportable", score: 80, answered: 5, available: 5 },
        IS: { status: "reportable", score: 69, answered: 4, available: 4 },
        TD: { status: "reportable", score: 65, answered: 5, available: 5 },
      },
      confidence: {
        score: 60,
        label: "low",
        reasons: [{ code: "non_reportable_dimension", dimension: "ER", deducted: 15 }],
      },
      maturityAgeMetaphor: null,
    }));

    expect(html).toContain("Index unavailable");
    expect(html).toContain("Answer more items in Emotional Regulation to show the aggregate index.");
    expect(html).toContain("Emotional Regulation: Insufficient data");
    expect(html).toContain("3 of 4 required scored answers available; 5 items total.");
    expect(html).toContain("Confidence: Low (60 / 100)");
    expect(html).toContain("Emotional Regulation did not have enough scored answers (-15).");
    expect(html).not.toContain("null / 100");
  });

  it("gates the age metaphor behind the server result and includes the required qualifying copy", () => {
    const withoutMetaphor = renderResults(reportableResultFixture({ maturityAgeMetaphor: null }));
    const withMetaphor = renderResults(reportableResultFixture({ maturityAgeMetaphor: 54 }));

    expect(withoutMetaphor).not.toContain("Maturity-age metaphor");
    expect(withMetaphor).toContain("Maturity-age metaphor");
    expect(withMetaphor).toContain("54");
    expect(withMetaphor).toContain("This is a playful mapping of the index onto a 16–72 scale.");
    expect(withMetaphor).toContain("older does not mean more valuable");
  });
});

describe("I008 score submission integration", () => {
  it("posts to the score API after review submission and renders deterministic results before AI", async () => {
    const result = reportableResultFixture();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ assessmentId: "00000000-0000-4000-8000-000000000008", result }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const { container } = renderFlowInBrowser({
      ...createInitialAssessmentState(),
      phase: "review",
      structuredAnswers: { ER01: "C", IC01: "D" },
      consent: { isAdult: true, nonClinicalAcknowledged: true, aiConsent: false },
    });

    await act(async () => {
      getButtonByLabel(container, /^Submit assessment$/).click();
    });
    await act(async () => undefined);

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/assessments/score", expect.objectContaining({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        questionnaireVersion: QUESTIONNAIRE_VERSION,
        answers: [
          { questionId: "ER01", optionId: "C" },
          { questionId: "IC01", optionId: "D" },
        ],
        preferences: { includeAgeMetaphor: false },
      }),
    }));
    expect(container.textContent).toContain("Structured Maturity Index");
    expect(container.textContent).toContain("68 / 100");
    expect(container.textContent).toContain("AI analysis unavailable");
  });
});

describe("I009 local result export", () => {
  it("builds a local JSON export with version identifiers, disclaimer, confidence reasons, and completed AI observations only", () => {
    const payload = buildResultExportPayload({
      result: reportableResultFixture({
        confidence: {
          score: 73,
          label: "moderate",
          reasons: [{ code: "low_coverage", missingOrNa: 3, deducted: 8 }],
        },
      }),
      aiAnalysis: completedAiAnalysisFixture(),
      generatedAt: "2026-07-13T04:30:00.000Z",
    });

    expect(payload.generatedAt).toBe("2026-07-13T04:30:00.000Z");
    expect(payload.versions).toEqual({
      questionnaire: QUESTIONNAIRE_VERSION,
      scoring: SCORING_VERSION,
      prompt: PROMPT_VERSION,
    });
    expect(payload.disclaimer).toContain("not a clinical assessment");
    expect(payload.deterministicResult.confidence.reasons).toEqual([
      { code: "low_coverage", missingOrNa: 3, deducted: 8 },
    ]);
    expect(payload.aiAnalysis).toMatchObject({
      status: "completed",
      headline: "<script>alert('x')</script> Pattern insight",
      observations: ["You paused before sending the reply.", "<img src=x onerror=alert(1)>"],
      experiments: ["Try a 10-minute delay before charged messages.", "Name the trade-off in one sentence."],
    });
    expect(JSON.stringify(payload)).not.toContain("rubric");
    expect(JSON.stringify(payload)).not.toContain("I paused before replying");
  });

  it("represents disabled and unavailable AI states without requiring a network request", () => {
    const disabled = buildResultExportPayload({ result: reportableResultFixture(), aiAnalysis: { status: "disabled" } });
    const unavailable = buildResultExportPayload({
      result: reportableResultFixture(),
      aiAnalysis: { status: "unavailable", reason: "provider_error" },
    });

    expect(disabled.aiAnalysis).toEqual({ status: "disabled" });
    expect(unavailable.aiAnalysis).toEqual({ status: "unavailable", reason: "provider_error" });
  });

  it("generates escaped self-contained printable HTML with print CSS and accessible text equivalents", () => {
    const html = buildPrintableResultHtml(buildResultExportPayload({
      result: reportableResultFixture({ maturityAgeMetaphor: 54 }),
      aiAnalysis: completedAiAnalysisFixture(),
      generatedAt: "2026-07-13T04:30:00.000Z",
    }));

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Questionnaire RMP-1.0 · Scoring RMP-SCORE-1.0 · Prompt RMP-AI-1.0");
    expect(html).toContain("This is not a clinical assessment, diagnosis, or literal measure of psychological age.");
    expect(html).toContain("Text equivalent: Emotional Regulation scored 70 out of 100 and is in the Established band.");
    expect(html).toContain("@media print");
    expect(html).toContain("background: none !important");
    expect(html).toContain("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt; Pattern insight");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("<img src=x");
  });

  it("renders export controls and sends metadata-only hook events for JSON and printable HTML", () => {
    const onExportGenerated = vi.fn();
    const html = renderToStaticMarkup(createElement(DeterministicResultsScreen, {
      result: reportableResultFixture(),
      aiAnalysisEnabled: false,
      onExportGenerated,
    }));

    expect(html).toContain("Download JSON");
    expect(html).toContain("Printable HTML");
    expect(html).toContain("data-export-content=\"local-browser-only\"");
    expect(html).not.toContain("onExportGenerated");

    const createObjectUrl = vi.fn(() => "blob:local-export");
    const revokeObjectUrl = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL: createObjectUrl, revokeObjectURL: revokeObjectUrl });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    cleanupMountedFlow();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    act(() => {
      root.render(createElement(DeterministicResultsScreen, {
        result: reportableResultFixture(),
        aiAnalysisEnabled: false,
        onExportGenerated,
      }));
    });
    mountedRoot = root;
    mountedContainer = container;

    act(() => getButtonByLabel(container, /^Download JSON$/).click());
    act(() => getButtonByLabel(container, /^Printable HTML$/).click());

    expect(onExportGenerated).toHaveBeenCalledWith("json");
    expect(onExportGenerated).toHaveBeenCalledWith("printable_html");
    expect(onExportGenerated.mock.calls.flat()).not.toContain("68 / 100");
    expect(createObjectUrl).toHaveBeenCalledTimes(2);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:local-export");
    expect(clickSpy).toHaveBeenCalledTimes(2);
  });
});

describe("I009 start over", () => {
  it("requires confirmation before deleting a draft from results", async () => {
    vi.spyOn(globalThis, "confirm").mockReturnValue(false);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ assessmentId: "00000000-0000-4000-8000-000000000009", result: reportableResultFixture() }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const { container, storage } = renderFlowInBrowser({
      ...createInitialAssessmentState(),
      phase: "review",
      structuredAnswers: { ER01: "C" },
      narratives: { N01: { skipped: false, fields: { event: "raw narrative must stay local" } } },
    });

    await act(async () => getButtonByLabel(container, /^Submit assessment$/).click());
    await act(async () => undefined);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    act(() => getButtonByLabel(container, /^Start over$/).click());

    expect(storage.getItem(ASSESSMENT_SESSION_STORAGE_KEY)).not.toBeNull();
    expect(container.textContent).toContain("Structured Maturity Index");
  });

  it("synchronously removes session data, clears results, returns to landing, and keeps deletion if token invalidation fails", async () => {
    vi.spyOn(globalThis, "confirm").mockReturnValue(true);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ assessmentId: "00000000-0000-4000-8000-000000000009", result: reportableResultFixture() }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const invalidateEphemeralAnalysisToken = vi.fn(() => {
      throw new Error("token endpoint unavailable");
    });
    cleanupMountedFlow();
    const storage = new MemoryStorage();
    storage.setItem(ASSESSMENT_SESSION_STORAGE_KEY, serializeAssessmentState({
      ...createInitialAssessmentState(),
      phase: "review",
      structuredAnswers: { ER01: "C" },
      narratives: { N01: { skipped: false, fields: { event: "delete me now" } } },
    }));
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    act(() => {
      root.render(createElement(AssessmentProvider, {
        storage,
        debounceMs: 250,
        children: createElement(StructuredQuestionFlow, {
          questionnaire: publicQuestionnaireFixture(),
          invalidateEphemeralAnalysisToken,
        }),
      }));
    });
    mountedRoot = root;
    mountedContainer = container;

    await act(async () => getButtonByLabel(container, /^Submit assessment$/).click());
    await act(async () => undefined);

    act(() => getButtonByLabel(container, /^Start over$/).click());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(invalidateEphemeralAnalysisToken).toHaveBeenCalledTimes(1);
    expect(storage.getItem(ASSESSMENT_SESSION_STORAGE_KEY)).toBeNull();
    expect(container.textContent).not.toContain("Receiving criticism");
    expect(container.textContent).not.toContain("Structured Maturity Index");
  });
});
