import { afterEach, describe, expect, it, vi } from "vitest";

import {
  EVENT_NAMES,
  emitEvent,
  exportGeneratedEventSchema,
  operationalEventProducers,
  operationalEventSchema,
  questionnaireLoadedEventSchema,
  scoreCompletedEventSchema,
  scrubSensitiveData,
} from "./logging";

describe("privacy-safe operational logging", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("declares every I013 event name as a finite union", () => {
    expect(EVENT_NAMES).toEqual([
      "questionnaire_loaded",
      "score_requested",
      "score_completed",
      "score_rejected",
      "analysis_requested",
      "analysis_completed",
      "analysis_unavailable",
      "safety_interrupted",
      "export_generated",
    ]);
  });

  it("exposes a supported producer-facing API for every declared event", () => {
    expect(Object.keys(operationalEventProducers).sort()).toEqual([...EVENT_NAMES].sort());

    const timestamp = "2026-07-13T00:00:00.000Z";
    expect(operationalEventProducers.questionnaire_loaded({ requestId: "req-questionnaire", timestamp, questionnaireVersion: "RMP-1.0", scoringVersion: "RMP-SCORE-1.0" })).toMatchObject({ event: "questionnaire_loaded" });
    expect(operationalEventProducers.score_requested({ requestId: "req-score", timestamp })).toMatchObject({ event: "score_requested", status: "requested" });
    expect(operationalEventProducers.score_completed({ requestId: "req-score", timestamp, questionnaireVersion: "RMP-1.0", scoringVersion: "RMP-SCORE-1.0", latencyMs: 12 })).toMatchObject({ event: "score_completed", status: "success" });
    expect(operationalEventProducers.score_rejected({ requestId: "req-score", timestamp, errorCode: "INVALID_REQUEST" })).toMatchObject({ event: "score_rejected", status: "rejected" });
    expect(operationalEventProducers.analysis_requested({ requestId: "req-analysis", timestamp })).toMatchObject({ event: "analysis_requested", status: "requested" });
    expect(operationalEventProducers.analysis_completed({ requestId: "req-analysis", timestamp, questionnaireVersion: "RMP-1.0", scoringVersion: "RMP-SCORE-1.0", promptVersion: "RMP-AI-1.0", latencyMs: 31 })).toMatchObject({ event: "analysis_completed", status: "success" });
    expect(operationalEventProducers.analysis_unavailable({ requestId: "req-analysis", timestamp, errorCode: "PROVIDER_FAILURE" })).toMatchObject({ event: "analysis_unavailable", status: "unavailable" });
    expect(operationalEventProducers.safety_interrupted({ requestId: "req-analysis", timestamp, errorCode: "SELF_HARM" })).toMatchObject({ event: "safety_interrupted", status: "interrupted" });
    expect(operationalEventProducers.export_generated({ requestId: "req-export", timestamp, questionnaireVersion: "RMP-1.0", scoringVersion: "RMP-SCORE-1.0", promptVersion: "RMP-AI-1.0", exportFormat: "json" })).toMatchObject({ event: "export_generated" });
  });

  it("strips unknown event fields and allows only content-free metadata", () => {
    const parsed = scoreCompletedEventSchema.parse({
      event: "score_completed",
      requestId: "req-1",
      timestamp: "2026-07-13T00:00:00.000Z",
      questionnaireVersion: "RMP-1.0",
      scoringVersion: "RMP-SCORE-1.0",
      promptVersion: "RMP-AI-1.0",
      status: "success",
      latencyMs: 42,
      deploymentVersion: "local",
      answers: [{ questionId: "ER01", optionId: "C" }],
      narrative: "secret narrative",
    });

    expect(parsed).toEqual({
      event: "score_completed",
      requestId: "req-1",
      timestamp: "2026-07-13T00:00:00.000Z",
      questionnaireVersion: "RMP-1.0",
      scoringVersion: "RMP-SCORE-1.0",
      promptVersion: "RMP-AI-1.0",
      status: "success",
      latencyMs: 42,
      deploymentVersion: "local",
    });
  });

  it("redacts sensitive keys and sensitive string values at the final emission boundary", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    emitEvent({
      event: "score_rejected",
      requestId: "req-2",
      timestamp: "2026-07-13T00:00:00.000Z",
      questionnaireVersion: "RMP-1.0",
      scoringVersion: "RMP-SCORE-1.0",
      status: "rejected",
      errorCode: "INVALID_REQUEST",
      authorization: "Bearer super-secret-token",
      nested: {
        apiKey: "sk-live-secret",
        prompt: "raw prompt",
        excerpt: "raw excerpt",
        modelOutput: "raw output",
        ordinary: "Authorization: Bearer nested-secret",
      },
      answers: [{ questionId: "ER01", optionId: "C" }],
    } as never);

    expect(info).toHaveBeenCalledTimes(1);
    const serialized = info.mock.calls[0]?.[0];
    expect(typeof serialized).toBe("string");
    expect(serialized).not.toContain("super-secret-token");
    expect(serialized).not.toContain("sk-live-secret");
    expect(serialized).not.toContain("raw prompt");
    expect(serialized).not.toContain("raw excerpt");
    expect(serialized).not.toContain("raw output");
    expect(serialized).not.toContain("ER01");
    expect(serialized).not.toContain("nested-secret");
  });

  it("redacts full IP addresses even when supplied in allowlisted fields", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const emitted = emitEvent({
      event: "score_rejected",
      requestId: "203.0.113.42",
      timestamp: "2026-07-13T00:00:00.000Z",
      status: "rejected",
      errorCode: "INVALID_REQUEST",
      deploymentVersion: "2001:db8:85a3::8a2e:370:7334",
    });

    expect(emitted.requestId).toBe("[REDACTED]");
    expect(emitted.deploymentVersion).toBe("[REDACTED]");
    expect(info.mock.calls[0]?.[0]).not.toContain("203.0.113.42");
    expect(info.mock.calls[0]?.[0]).not.toContain("2001:db8:85a3::8a2e:370:7334");
  });

  it("exposes the recursive scrubber used before event allowlisting", () => {
    const scrubbed = scrubSensitiveData({
      nested: {
        apiKey: "sk-live-secret",
        prompt: "raw prompt",
        ordinary: "Authorization: Bearer nested-secret",
      },
    });

    expect(scrubbed).toEqual({
      nested: {
        apiKey: "[REDACTED]",
        prompt: "[REDACTED]",
        ordinary: "[REDACTED]",
      },
    });
  });

  it("validates questionnaire load and export events without content fields", () => {
    expect(questionnaireLoadedEventSchema.parse({
      event: "questionnaire_loaded",
      requestId: "req-3",
      timestamp: "2026-07-13T00:00:00.000Z",
      questionnaireVersion: "RMP-1.0",
      scoringVersion: "RMP-SCORE-1.0",
      result: "content leak",
    })).toEqual({
      event: "questionnaire_loaded",
      requestId: "req-3",
      timestamp: "2026-07-13T00:00:00.000Z",
      questionnaireVersion: "RMP-1.0",
      scoringVersion: "RMP-SCORE-1.0",
    });

    expect(exportGeneratedEventSchema.parse({
      event: "export_generated",
      requestId: "req-4",
      timestamp: "2026-07-13T00:00:00.000Z",
      questionnaireVersion: "RMP-1.0",
      scoringVersion: "RMP-SCORE-1.0",
      promptVersion: "RMP-AI-1.0",
      exportFormat: "json",
      deterministicResult: { structuredMaturityIndex: 68 },
    })).toEqual({
      event: "export_generated",
      requestId: "req-4",
      timestamp: "2026-07-13T00:00:00.000Z",
      questionnaireVersion: "RMP-1.0",
      scoringVersion: "RMP-SCORE-1.0",
      promptVersion: "RMP-AI-1.0",
      exportFormat: "json",
    });
  });

  it("rejects unknown event names", () => {
    expect(() => operationalEventSchema.parse({ event: "raw_answer_logged" })).toThrow();
  });
});
