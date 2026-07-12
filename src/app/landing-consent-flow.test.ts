import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  LandingConsentScreen,
  canContinueFromConsent,
  nextPhaseAfterConsent,
  PROHIBITED_PRESSURE_COPY,
} from "./landing-consent-flow";
import { createInitialAssessmentState, serializeAssessmentState } from "@/client/assessment-state";

function renderScreen(state = createInitialAssessmentState()) {
  return renderToStaticMarkup(
    createElement(LandingConsentScreen, {
      state,
      onStart: () => undefined,
      onConsentChange: () => undefined,
      onPreferenceChange: () => undefined,
      onContinue: () => undefined,
    }),
  );
}

describe("I004 landing and consent flow", () => {
  it("renders honest landing copy, duration, disclaimer, privacy summary, and scoring explanation", () => {
    const html = renderScreen();

    expect(html).toContain("Reflective Maturity Profile");
    expect(html).toContain("12–18 minutes");
    expect(html).toContain("not a diagnosis");
    expect(html).toContain("Structured answers go to this application server for deterministic scoring");
    expect(html).toContain("How scoring works");
    expect(html).toContain("Start assessment");
    expect(html).toContain("/privacy");
  });

  it("renders consent choices with required acknowledgements gated and optional choices off by default", () => {
    const state = { ...createInitialAssessmentState(), phase: "consent" as const };
    const html = renderScreen(state);

    expect(html).toContain("name=\"isAdult\"");
    expect(html).toContain("name=\"nonClinicalAcknowledged\"");
    expect(html).toContain("name=\"aiConsent\"");
    expect(html).toContain("name=\"includeAgeMetaphor\"");
    expect(html).toContain("disabled=\"\"");
    expect(html).not.toContain("checked=\"\"");
  });

  it("allows assessment only after both required acknowledgements are true", () => {
    const base = { ...createInitialAssessmentState(), phase: "consent" as const };

    expect(canContinueFromConsent(base)).toBe(false);
    expect(canContinueFromConsent({ ...base, consent: { ...base.consent, isAdult: true } })).toBe(false);
    expect(
      canContinueFromConsent({
        ...base,
        consent: { ...base.consent, isAdult: true, nonClinicalAcknowledged: true },
      }),
    ).toBe(true);
    expect(nextPhaseAfterConsent(base)).toBe("consent");
    expect(
      nextPhaseAfterConsent({
        ...base,
        consent: { ...base.consent, isAdult: true, nonClinicalAcknowledged: true },
      }),
    ).toBe("assessment");
  });

  it("persists all four choices in the session-state shape and never local storage", () => {
    const state = {
      ...createInitialAssessmentState(),
      consent: { isAdult: true, nonClinicalAcknowledged: true, aiConsent: true },
      preferences: { ...createInitialAssessmentState().preferences, includeAgeMetaphor: true },
    };
    const serialized = serializeAssessmentState(state);

    expect(serialized).toContain('"isAdult":true');
    expect(serialized).toContain('"nonClinicalAcknowledged":true');
    expect(serialized).toContain('"aiConsent":true');
    expect(serialized).toContain('"includeAgeMetaphor":true');
    expect(serialized).not.toContain(["local", "Storage"].join(""));
  });

  it("places the PRD AI disclosure and age-metaphor explanation beside the optional choices", () => {
    const html = renderScreen({ ...createInitialAssessmentState(), phase: "consent" as const });

    expect(html).toContain(
      "If enabled, your narrative answers and structured response summary are sent to the configured AI provider to generate this analysis.",
    );
    expect(html).toContain("does not use them for advertising or model training on its own behalf");
    expect(html).toContain("optional, clearly qualified metaphor");
    expect(html).toContain("non-literal");
  });

  it("uses native keyboard-operable controls instead of custom clickable containers", () => {
    const html = renderScreen({ ...createInitialAssessmentState(), phase: "consent" as const });

    expect(html).toContain("<button");
    expect(html).toContain("type=\"button\"");
    expect(html).toContain("type=\"checkbox\"");
    expect(html).toContain("<label");
    expect(html).toContain("<details");
    expect(html).toContain("<summary");
  });

  it("rejects inaccurate privacy claims, exact-birth-date prompts, and manipulative pressure copy", () => {
    const html = renderScreen({ ...createInitialAssessmentState(), phase: "consent" as const }).toLowerCase();

    expect(html).not.toContain(["scoring happens entirely", "on-device"].join(" "));
    expect(html).not.toContain(["answers are never sent", "to a server without ai opt-in"].join(" "));
    expect(html).not.toContain(["date", "of", "birth"].join(" "));
    expect(html).not.toContain("dob");
    for (const phrase of PROHIBITED_PRESSURE_COPY) {
      expect(html).not.toContain(phrase);
    }
  });
});
