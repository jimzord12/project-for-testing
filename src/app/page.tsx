import LandingConsentFlow from "./landing-consent-flow";
import { getPublicQuestionnaire } from "@/domain/questionnaire";
import { SCORING_VERSION } from "@/domain/versions";
import { publicQuestionnaireResponseSchema, type PublicQuestionnaireResponse } from "./api/v1/questionnaire/route";

function buildQuestionnaire(): PublicQuestionnaireResponse {
  const projection = getPublicQuestionnaire();
  const [firstNarrative, secondNarrative] = projection.narrative;
  if (!firstNarrative || !secondNarrative) {
    throw new Error("Public questionnaire projection must include both narrative exercises.");
  }

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

export default function Home() {
  return <LandingConsentFlow questionnaire={buildQuestionnaire()} />;
}
