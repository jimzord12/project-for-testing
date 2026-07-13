"use client";

import { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import type { Dispatch, ReactNode } from "react";
import { z } from "zod";

import { QUESTIONNAIRE_VERSION } from "@/domain/versions";
import type { PublicQuestionnaireResponse } from "@/app/api/v1/questionnaire/route";

export const ASSESSMENT_SESSION_STORAGE_KEY = "rmp.assessment.draft.v1";
export const QUESTIONNAIRE_SESSION_STORAGE_KEY = "rmp.public-questionnaire.v1";
export const ASSESSMENT_PERSIST_DEBOUNCE_MS = 250;

export const ASSESSMENT_PHASES = [
  "landing",
  "consent",
  "assessment",
  "review",
  "submitting",
  "results",
] as const;

export type AssessmentPhase = (typeof ASSESSMENT_PHASES)[number];

export type NarrativeDraft = {
  fields: Record<string, string>;
  skipped: boolean;
};

export type AssessmentState = {
  questionnaireVersion: string;
  currentStepIndex: number;
  structuredAnswers: Record<string, string>;
  narratives: Record<string, NarrativeDraft>;
  consent: {
    isAdult: boolean;
    nonClinicalAcknowledged: boolean;
    aiConsent: boolean;
  };
  preferences: {
    includeAgeMetaphor: boolean;
    autoAdvance: boolean;
    reducedMotionOverride: boolean | null;
  };
  phase: AssessmentPhase;
};

export type VersionMismatchRecoveryAction = "discard" | "export_raw_local_draft";

export type AssessmentHydrationResult =
  | { status: "empty"; state: AssessmentState }
  | { status: "restored"; state: AssessmentState }
  | { status: "version_mismatch"; state: AssessmentState; actions: VersionMismatchRecoveryAction[] }
  | { status: "invalid_draft"; state: AssessmentState };

export type ScoringReadiness =
  | { ok: true }
  | { ok: false; reason: "questionnaire_version_mismatch"; actions: VersionMismatchRecoveryAction[] };

export type AssessmentAction =
  | { type: "replace"; state: AssessmentState }
  | { type: "set_phase"; phase: AssessmentPhase }
  | { type: "set_current_step_index"; currentStepIndex: number }
  | { type: "set_structured_answer"; questionId: string; optionId: string }
  | { type: "set_narrative_field"; exerciseId: string; fieldId: string; value: string }
  | { type: "set_narrative_skipped"; exerciseId: string; skipped: boolean }
  | { type: "set_consent"; consent: Partial<AssessmentState["consent"]> }
  | { type: "set_preferences"; preferences: Partial<AssessmentState["preferences"]> }
  | { type: "reset"; questionnaireVersion?: string };

const narrativeDraftSchema: z.ZodType<NarrativeDraft> = z
  .object({
    fields: z.record(z.string(), z.string()),
    skipped: z.boolean(),
  })
  .strict();

export const assessmentStateSchema: z.ZodType<AssessmentState> = z
  .object({
    questionnaireVersion: z.string().min(1),
    currentStepIndex: z.number().int().min(0),
    structuredAnswers: z.record(z.string(), z.string()),
    narratives: z.record(z.string(), narrativeDraftSchema),
    consent: z
      .object({
        isAdult: z.boolean(),
        nonClinicalAcknowledged: z.boolean(),
        aiConsent: z.boolean(),
      })
      .strict(),
    preferences: z
      .object({
        includeAgeMetaphor: z.boolean(),
        autoAdvance: z.boolean(),
        reducedMotionOverride: z.boolean().nullable(),
      })
      .strict(),
    phase: z.enum(ASSESSMENT_PHASES),
  })
  .strict();

export function createInitialAssessmentState(
  questionnaireVersion: string = QUESTIONNAIRE_VERSION,
): AssessmentState {
  return {
    questionnaireVersion,
    currentStepIndex: 0,
    structuredAnswers: {},
    narratives: {},
    consent: {
      isAdult: false,
      nonClinicalAcknowledged: false,
      aiConsent: false,
    },
    preferences: {
      includeAgeMetaphor: false,
      autoAdvance: false,
      reducedMotionOverride: null,
    },
    phase: "landing",
  };
}

export function serializeAssessmentState(state: AssessmentState): string {
  return JSON.stringify(assessmentStateSchema.parse(state));
}

export function parseAssessmentState(serialized: string): AssessmentState | null {
  try {
    return assessmentStateSchema.parse(JSON.parse(serialized));
  } catch {
    return null;
  }
}

export function getVersionMismatchRecoveryActions(): VersionMismatchRecoveryAction[] {
  return ["discard", "export_raw_local_draft"];
}

export function checkScoringReadiness(state: AssessmentState, activeQuestionnaireVersion: string): ScoringReadiness {
  if (state.questionnaireVersion !== activeQuestionnaireVersion) {
    return {
      ok: false,
      reason: "questionnaire_version_mismatch",
      actions: getVersionMismatchRecoveryActions(),
    };
  }
  return { ok: true };
}

export function loadAssessmentSession(
  storage: Pick<Storage, "getItem">,
  activeQuestionnaireVersion: string = QUESTIONNAIRE_VERSION,
): AssessmentHydrationResult {
  const initial = createInitialAssessmentState(activeQuestionnaireVersion);
  const serialized = storage.getItem(ASSESSMENT_SESSION_STORAGE_KEY);
  if (serialized === null) return { status: "empty", state: initial };

  const parsed = parseAssessmentState(serialized);
  if (!parsed) return { status: "invalid_draft", state: initial };

  if (parsed.questionnaireVersion !== activeQuestionnaireVersion) {
    return {
      status: "version_mismatch",
      state: parsed,
      actions: getVersionMismatchRecoveryActions(),
    };
  }

  return { status: "restored", state: parsed };
}

export function saveAssessmentSession(storage: Pick<Storage, "setItem">, state: AssessmentState): void {
  storage.setItem(ASSESSMENT_SESSION_STORAGE_KEY, serializeAssessmentState(state));
}

export function clearAssessmentSession(storage: Pick<Storage, "removeItem">): void {
  storage.removeItem(ASSESSMENT_SESSION_STORAGE_KEY);
}

export function exportRawLocalDraft(state: AssessmentState): string {
  return serializeAssessmentState(state);
}

export type DebouncedSessionWriter = {
  schedule: (state: AssessmentState) => void;
  flush: () => void;
  cancel: () => void;
};

export function createDebouncedSessionWriter(
  storage: Pick<Storage, "setItem">,
  debounceMs: number = ASSESSMENT_PERSIST_DEBOUNCE_MS,
): DebouncedSessionWriter {
  let pendingState: AssessmentState | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const clearPendingTimeout = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const flush = () => {
    clearPendingTimeout();
    if (pendingState !== null) {
      saveAssessmentSession(storage, pendingState);
      pendingState = null;
    }
  };

  return {
    schedule(state) {
      pendingState = state;
      clearPendingTimeout();
      timeoutId = setTimeout(flush, debounceMs);
    },
    flush,
    cancel() {
      clearPendingTimeout();
      pendingState = null;
    },
  };
}

export function assessmentReducer(state: AssessmentState, action: AssessmentAction): AssessmentState {
  switch (action.type) {
    case "replace":
      return action.state;
    case "set_phase":
      return { ...state, phase: action.phase };
    case "set_current_step_index":
      return { ...state, currentStepIndex: Math.max(0, action.currentStepIndex) };
    case "set_structured_answer":
      return {
        ...state,
        structuredAnswers: { ...state.structuredAnswers, [action.questionId]: action.optionId },
      };
    case "set_narrative_field": {
      const existing = state.narratives[action.exerciseId] ?? { fields: {}, skipped: false };
      return {
        ...state,
        narratives: {
          ...state.narratives,
          [action.exerciseId]: {
            ...existing,
            fields: { ...existing.fields, [action.fieldId]: action.value },
            skipped: false,
          },
        },
      };
    }
    case "set_narrative_skipped": {
      const existing = state.narratives[action.exerciseId] ?? { fields: {}, skipped: false };
      return {
        ...state,
        narratives: {
          ...state.narratives,
          [action.exerciseId]: { fields: action.skipped ? {} : existing.fields, skipped: action.skipped },
        },
      };
    }
    case "set_consent":
      return { ...state, consent: { ...state.consent, ...action.consent } };
    case "set_preferences":
      return { ...state, preferences: { ...state.preferences, ...action.preferences } };
    case "reset":
      return createInitialAssessmentState(action.questionnaireVersion ?? state.questionnaireVersion);
  }
}

type AssessmentContextValue = {
  state: AssessmentState;
  dispatch: Dispatch<AssessmentAction>;
  hydration: AssessmentHydrationResult["status"];
  scoringReadiness: ScoringReadiness;
  discardLocalDraft: () => void;
  exportLocalDraft: () => string;
};

const AssessmentContext = createContext<AssessmentContextValue | null>(null);

export function AssessmentProvider({
  children,
  questionnaireVersion = QUESTIONNAIRE_VERSION,
  storage = typeof window === "undefined" ? undefined : window.sessionStorage,
  debounceMs = ASSESSMENT_PERSIST_DEBOUNCE_MS,
}: {
  children: ReactNode;
  questionnaireVersion?: string;
  storage?: Storage;
  debounceMs?: number;
}) {
  const initialHydration = useMemo(() => {
    if (!storage) return { status: "empty", state: createInitialAssessmentState(questionnaireVersion) } as const;
    return loadAssessmentSession(storage, questionnaireVersion);
  }, [questionnaireVersion, storage]);

  const [state, dispatch] = useReducer(assessmentReducer, initialHydration.state);

  const writer = useMemo(() => {
    if (!storage) return null;
    return createDebouncedSessionWriter(storage, debounceMs);
  }, [debounceMs, storage]);

  useEffect(() => {
    writer?.schedule(state);
    return () => writer?.flush();
  }, [state, writer]);

  const value = useMemo<AssessmentContextValue>(
    () => ({
      state,
      dispatch,
      hydration: initialHydration.status,
      scoringReadiness: checkScoringReadiness(state, questionnaireVersion),
      discardLocalDraft: () => {
        if (storage) clearAssessmentSession(storage);
        dispatch({ type: "reset", questionnaireVersion });
      },
      exportLocalDraft: () => exportRawLocalDraft(state),
    }),
    [initialHydration.status, questionnaireVersion, state, storage],
  );

  return <AssessmentContext.Provider value={value}>{children}</AssessmentContext.Provider>;
}

export function useAssessment(): AssessmentContextValue {
  const value = useContext(AssessmentContext);
  if (!value) {
    throw new Error("useAssessment must be used inside AssessmentProvider.");
  }
  return value;
}

export type QuestionnaireFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type PublicQuestionnaireCache = {
  load: (options?: { forceRefresh?: boolean }) => Promise<PublicQuestionnaireResponse>;
  getCached: () => PublicQuestionnaireResponse | null;
  clear: () => void;
};

export function createPublicQuestionnaireCache({
  fetcher = globalThis.fetch.bind(globalThis),
  storage = typeof window === "undefined" ? undefined : window.sessionStorage,
  endpoint = "/api/v1/questionnaire",
}: {
  fetcher?: QuestionnaireFetch;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  endpoint?: string;
} = {}): PublicQuestionnaireCache {
  let inMemory: PublicQuestionnaireResponse | null = null;

  const readStorage = () => {
    if (!storage) return null;
    const serialized = storage.getItem(QUESTIONNAIRE_SESSION_STORAGE_KEY);
    if (serialized === null) return null;
    try {
      return JSON.parse(serialized) as PublicQuestionnaireResponse;
    } catch {
      storage.removeItem(QUESTIONNAIRE_SESSION_STORAGE_KEY);
      return null;
    }
  };

  const writeStorage = (questionnaire: PublicQuestionnaireResponse) => {
    storage?.setItem(QUESTIONNAIRE_SESSION_STORAGE_KEY, JSON.stringify(questionnaire));
  };

  return {
    async load(options = {}) {
      if (!options.forceRefresh && inMemory) return inMemory;

      const stored = !options.forceRefresh ? readStorage() : null;
      if (stored) {
        inMemory = stored;
        return stored;
      }

      const response = await fetcher(endpoint, { method: "GET" });
      if (!response.ok) {
        throw new Error(`Failed to load public questionnaire: ${response.status}`);
      }

      const questionnaire = (await response.json()) as PublicQuestionnaireResponse;
      inMemory = questionnaire;
      writeStorage(questionnaire);
      return questionnaire;
    },
    getCached() {
      if (inMemory) return inMemory;
      const stored = readStorage();
      inMemory = stored;
      return stored;
    },
    clear() {
      inMemory = null;
      storage?.removeItem(QUESTIONNAIRE_SESSION_STORAGE_KEY);
    },
  };
}
