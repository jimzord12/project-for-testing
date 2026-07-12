import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ASSESSMENT_SESSION_STORAGE_KEY,
  QUESTIONNAIRE_SESSION_STORAGE_KEY,
  checkScoringReadiness,
  clearAssessmentSession,
  createDebouncedSessionWriter,
  createInitialAssessmentState,
  createPublicQuestionnaireCache,
  exportRawLocalDraft,
  loadAssessmentSession,
  saveAssessmentSession,
  type AssessmentState,
} from "./assessment-state";
import { QUESTIONNAIRE_VERSION, SCORING_VERSION } from "@/domain/versions";
import type { PublicQuestionnaireResponse } from "@/app/api/v1/questionnaire/route";

class MemoryStorage implements Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  readonly writes: Array<{ key: string; value: string }> = [];
  readonly removals: string[] = [];
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.writes.push({ key, value });
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.removals.push(key);
    this.values.delete(key);
  }
}

function filledDraft(): AssessmentState {
  return {
    ...createInitialAssessmentState(),
    currentStepIndex: 9,
    structuredAnswers: { ER01: "C", ER02: "E" },
    narratives: {
      N01: {
        skipped: false,
        fields: {
          event: "I paused before replying.",
          selfStory: "I was afraid the feedback meant I had failed.",
        },
      },
    },
    consent: {
      adultConfirmed: true,
      nonClinicalAcknowledged: true,
      aiAnalysis: true,
    },
    preferences: {
      includeAgeMetaphor: true,
      autoAdvance: false,
      reducedMotionOverride: null,
    },
    phase: "assessment",
  };
}

function questionnaireFixture(): PublicQuestionnaireResponse {
  return {
    questionnaireVersion: QUESTIONNAIRE_VERSION,
    scoringVersion: SCORING_VERSION,
    steps: [],
    disclaimer: "This is a reflective self-assessment fixture.",
    estimatedMinutes: { min: 12, max: 18 },
  } as PublicQuestionnaireResponse;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("assessment session persistence", () => {
  it("restores an active draft from session storage after refresh", () => {
    const storage = new MemoryStorage();
    const draft = filledDraft();

    saveAssessmentSession(storage, draft);
    const restored = loadAssessmentSession(storage, QUESTIONNAIRE_VERSION);

    expect(restored.status).toBe("restored");
    expect(restored.state).toEqual(draft);
  });

  it("uses only the provided session storage boundary for raw narrative drafts", () => {
    const session = new MemoryStorage();
    const browserPersistentStorage = new MemoryStorage();
    const persistentStorageName = ["local", "Storage"].join("");
    vi.stubGlobal(persistentStorageName, browserPersistentStorage);

    const draft = filledDraft();
    saveAssessmentSession(session, draft);
    clearAssessmentSession(session);

    expect(session.writes).toHaveLength(1);
    expect(session.writes[0]).toMatchObject({ key: ASSESSMENT_SESSION_STORAGE_KEY });
    expect(session.writes[0]?.value).toContain("I paused before replying.");
    expect(browserPersistentStorage.writes).toEqual([]);
    expect(browserPersistentStorage.removals).toEqual([]);
  });

  it("blocks scoring and exposes discard/export actions on questionnaire version mismatch", () => {
    const storage = new MemoryStorage();
    const oldDraft = { ...filledDraft(), questionnaireVersion: "RMP-0.9" };
    saveAssessmentSession(storage, oldDraft);

    const restored = loadAssessmentSession(storage, QUESTIONNAIRE_VERSION);
    const readiness = checkScoringReadiness(oldDraft, QUESTIONNAIRE_VERSION);

    expect(restored).toMatchObject({
      status: "version_mismatch",
      actions: ["discard", "export_raw_local_draft"],
    });
    expect(readiness).toEqual({
      ok: false,
      reason: "questionnaire_version_mismatch",
      actions: ["discard", "export_raw_local_draft"],
    });
    expect(exportRawLocalDraft(oldDraft)).toContain("RMP-0.9");
  });

  it("debounces meaningful state writes and flushes only the latest draft", () => {
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    const writer = createDebouncedSessionWriter(storage, 500);

    writer.schedule({ ...filledDraft(), currentStepIndex: 1 });
    writer.schedule({ ...filledDraft(), currentStepIndex: 2 });
    vi.advanceTimersByTime(499);

    expect(storage.writes).toEqual([]);

    vi.advanceTimersByTime(1);

    expect(storage.writes).toHaveLength(1);
    expect(storage.writes[0]?.key).toBe(ASSESSMENT_SESSION_STORAGE_KEY);
    expect(JSON.parse(storage.writes[0]?.value ?? "{}")).toMatchObject({ currentStepIndex: 2 });
  });
});

describe("public questionnaire client cache", () => {
  it("serves navigation data from cache after the initial load without another network call", async () => {
    const storage = new MemoryStorage();
    const fixture = questionnaireFixture();
    const fetcher = vi.fn(async () => Response.json(fixture));
    const cache = createPublicQuestionnaireCache({ fetcher, storage });

    await expect(cache.load()).resolves.toEqual(fixture);
    await expect(cache.load()).resolves.toEqual(fixture);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(storage.getItem(QUESTIONNAIRE_SESSION_STORAGE_KEY)).toBe(JSON.stringify(fixture));
  });

  it("restores cached public questionnaire data from session storage without network", async () => {
    const storage = new MemoryStorage();
    const fixture = questionnaireFixture();
    storage.setItem(QUESTIONNAIRE_SESSION_STORAGE_KEY, JSON.stringify(fixture));
    const fetcher = vi.fn(async () => {
      throw new Error("network should not be required for cached navigation");
    });
    const cache = createPublicQuestionnaireCache({ fetcher, storage });

    expect(cache.getCached()).toEqual(fixture);
    await expect(cache.load()).resolves.toEqual(fixture);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
