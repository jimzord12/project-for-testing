"use client";

import { QUESTIONNAIRE_VERSION, SCORING_VERSION } from "@/domain/versions";
import { AssessmentProvider, type AssessmentState, useAssessment } from "@/client/assessment-state";
import type { PublicQuestionnaireResponse } from "./api/v1/questionnaire/route";
import { StructuredQuestionFlow } from "./structured-question-flow";

export const AI_CONSENT_DISCLOSURE =
  "If enabled, your narrative answers and structured response summary are sent to the configured AI provider to generate this analysis. The app does not use them for advertising or model training on its own behalf.";

export const PROHIBITED_PRESSURE_COPY = [
  "limited time",
  "act now",
  "only today",
  "everyone is taking",
  "join thousands",
  "most people",
  "testimonial",
  "popular",
  "don't miss out",
] as const;

export function canContinueFromConsent(state: AssessmentState): boolean {
  return state.consent.isAdult && state.consent.nonClinicalAcknowledged;
}

export function nextPhaseAfterConsent(state: AssessmentState): AssessmentState["phase"] {
  return canContinueFromConsent(state) ? "assessment" : "consent";
}

type LandingConsentScreenProps = {
  state: AssessmentState;
  disclaimer: string;
  onStart: () => void;
  onConsentChange: (consent: Partial<AssessmentState["consent"]>) => void;
  onPreferenceChange: (preferences: Partial<AssessmentState["preferences"]>) => void;
  onContinue: () => void;
};

export function LandingConsentScreen({
  state,
  disclaimer,
  onStart,
  onConsentChange,
  onPreferenceChange,
  onContinue,
}: LandingConsentScreenProps) {
  const showConsent = state.phase !== "landing";
  const canContinue = canContinueFromConsent(state);

  return (
    <main className="flow-shell">
      <section aria-labelledby="landing-title" className="card hero-card">
        <p className="eyebrow">Privacy-first reflective assessment</p>
        <h1 id="landing-title">Reflective Maturity Profile</h1>
        <p className="lede">
          A self-assessment for adults that reflects on maturity-related behaviors, patterns, and
          trade-offs. It takes about <strong>12–18 minutes</strong> and works without an account.
        </p>
        <p>{disclaimer}</p>
        <p>
          Structured answers go to this application server for deterministic scoring. Narrative text
          goes to an external AI provider only if you explicitly enable optional AI analysis.
        </p>
        <p>
          The full privacy policy is forthcoming for launch; see the planned <a href="/privacy">privacy policy</a> location.
        </p>
        <details>
          <summary>How scoring works</summary>
          <p>
            The app recomputes scores on the server from answer identifiers using the published
            questionnaire and scoring versions. The AI layer, when enabled later, can only add a
            clearly qualified narrative analysis; it cannot change deterministic scores.
          </p>
        </details>
        {!showConsent ? (
          <button type="button" className="primary-action" onClick={onStart}>
            Start assessment
          </button>
        ) : null}
      </section>

      {showConsent ? (
        <section aria-labelledby="consent-title" className="card consent-card">
          <h2 id="consent-title">Before you continue</h2>
          <p>
            Please confirm the required eligibility and limitation statements. Optional result choices
            are off by default and can be enabled below.
          </p>

          <fieldset>
            <legend>Required acknowledgements</legend>
            <label className="choice-row" htmlFor="isAdult">
              <input
                id="isAdult"
                name="isAdult"
                type="checkbox"
                checked={state.consent.isAdult}
                onChange={(event) => onConsentChange({ isAdult: event.currentTarget.checked })}
              />
              <span>I confirm that I am 18 or older.</span>
            </label>
            <label className="choice-row" htmlFor="nonClinicalAcknowledged">
              <input
                id="nonClinicalAcknowledged"
                name="nonClinicalAcknowledged"
                type="checkbox"
                checked={state.consent.nonClinicalAcknowledged}
                onChange={(event) =>
                  onConsentChange({ nonClinicalAcknowledged: event.currentTarget.checked })
                }
              />
              <span>I understand this is non-clinical, non-diagnostic, and not a literal measure of psychological age.</span>
            </label>
          </fieldset>

          <fieldset>
            <legend>Optional choices</legend>
            <label className="choice-row" htmlFor="aiConsent">
              <input
                id="aiConsent"
                name="aiConsent"
                type="checkbox"
                checked={state.consent.aiConsent}
                onChange={(event) => onConsentChange({ aiConsent: event.currentTarget.checked })}
              />
              <span>
                Enable optional AI-assisted narrative analysis.
                <small>{AI_CONSENT_DISCLOSURE}</small>
              </span>
            </label>
            <label className="choice-row" htmlFor="includeAgeMetaphor">
              <input
                id="includeAgeMetaphor"
                name="includeAgeMetaphor"
                type="checkbox"
                checked={state.preferences.includeAgeMetaphor}
                onChange={(event) =>
                  onPreferenceChange({ includeAgeMetaphor: event.currentTarget.checked })
                }
              />
              <span>
                Include an optional, clearly qualified metaphor in results.
                <small>
                  The maturity-age metaphor is secondary, non-literal, and for interpretation only;
                  the canonical result remains the Maturity Profile.
                </small>
              </span>
            </label>
          </fieldset>

          <button type="button" className="primary-action" disabled={!canContinue} onClick={onContinue}>
            Continue
          </button>
        </section>
      ) : null}
    </main>
  );
}

function LandingConsentFlowInner({ questionnaire }: { questionnaire: PublicQuestionnaireResponse }) {
  const { state, dispatch } = useAssessment();

  if (state.phase === "assessment") {
    return <StructuredQuestionFlow questionnaire={questionnaire} />;
  }

  return (
    <LandingConsentScreen
      state={state}
      disclaimer={questionnaire.disclaimer}
      onStart={() => dispatch({ type: "set_phase", phase: "consent" })}
      onConsentChange={(consent) => dispatch({ type: "set_consent", consent })}
      onPreferenceChange={(preferences) => dispatch({ type: "set_preferences", preferences })}
      onContinue={() => dispatch({ type: "set_phase", phase: nextPhaseAfterConsent(state) })}
    />
  );
}

export default function LandingConsentFlow({ questionnaire }: { questionnaire: PublicQuestionnaireResponse }) {
  return (
    <AssessmentProvider questionnaireVersion={QUESTIONNAIRE_VERSION}>
      <LandingConsentFlowInner questionnaire={questionnaire} />
      <p className="version-note">
        Questionnaire {QUESTIONNAIRE_VERSION} · Scoring {SCORING_VERSION}
      </p>
    </AssessmentProvider>
  );
}
