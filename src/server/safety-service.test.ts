import { describe, expect, it, vi } from "vitest";

import {
  SAFETY_CLASSIFIER_OUTPUT_SCHEMA,
  SAFETY_CLASSIFIER_SYSTEM_PROMPT,
  classifyNarrativeSafety,
  safetyDecisionSuppressesAnalysis,
  selectSafetyHelpResources,
  toSafetyLogEvent,
  type SafetyGeneration,
} from "./safety-service";

function provider(result: Awaited<ReturnType<SafetyGeneration>>) {
  return vi.fn<SafetyGeneration>().mockResolvedValue(result);
}

const enabledEnv = {
  AI_PROVIDER: "anthropic",
  ANTHROPIC_API_KEY: "test-key",
  ANTHROPIC_MODEL: "claude-test",
};

describe("classifyNarrativeSafety deterministic rule layer", () => {
  it("interrupts immediate self-harm without invoking or trusting the provider", async () => {
    const generate = provider({ ok: true, object: { decision: "allow" } });

    const decision = await classifyNarrativeSafety(
      { narratives: { N01: "I am going to kill myself tonight after everyone is asleep." } },
      { generate, env: enabledEnv },
    );

    expect(decision).toEqual({ kind: "interrupt", category: "self_harm_immediate", source: "rule" });
    expect(generate).not.toHaveBeenCalled();
    expect(safetyDecisionSuppressesAnalysis(decision)).toBe(true);
  });

  it("interrupts immediate harm to others and active emergencies even when the provider would fail", async () => {
    const failProvider = provider({ ok: false, reason: "timeout" });

    await expect(
      classifyNarrativeSafety({ narratives: { N01: "I have the knife and I am going to kill him today." } }, { generate: failProvider, env: enabledEnv }),
    ).resolves.toEqual({ kind: "interrupt", category: "harm_to_others_immediate", source: "rule" });

    await expect(
      classifyNarrativeSafety({ narratives: { N01: "My apartment is on fire right now and I am trapped inside." } }, { generate: failProvider, env: enabledEnv }),
    ).resolves.toEqual({ kind: "interrupt", category: "active_emergency", source: "rule" });
  });

  it("does not deterministically interrupt ordinary or figurative language and lets the dedicated provider resolve it", async () => {
    const generate = provider({ ok: true, object: { decision: "allow" } });

    const decision = await classifyNarrativeSafety(
      {
        narratives: {
          N01: "This deadline is killing me, but I paused, asked for help, and made a smaller plan.",
          N02: "I wanted to disappear from the awkward group chat for a while, so I muted it.",
        },
      },
      { generate, env: enabledEnv },
    );

    expect(decision).toEqual({ kind: "allow", source: "provider" });
    expect(generate).toHaveBeenCalledTimes(1);
  });
});

describe("classifyNarrativeSafety provider layer", () => {
  it("uses a dedicated schema-constrained safety prompt through the provider seam for non-empty unresolved narratives", async () => {
    const generate = provider({ ok: true, object: { decision: "review_fallback", category: "ambiguous_high_risk" } });

    const decision = await classifyNarrativeSafety(
      { narratives: { N01: { event: "I do not know if I can stay safe tonight.", selfStory: "I feel cornered." } } },
      { generate, env: enabledEnv },
    );

    expect(decision).toEqual({ kind: "review_fallback", category: "ambiguous_high_risk", source: "provider" });
    expect(generate).toHaveBeenCalledWith(
      {
        schema: SAFETY_CLASSIFIER_OUTPUT_SCHEMA,
        system: SAFETY_CLASSIFIER_SYSTEM_PROMPT,
        prompt: expect.stringContaining("Narrative text to classify"),
      },
      expect.objectContaining({ env: enabledEnv }),
    );
    expect(generate.mock.calls[0]?.[0].system).not.toMatch(/maturity|score|rubric/i);
    expect(safetyDecisionSuppressesAnalysis(decision)).toBe(true);
  });

  it("returns review_fallback instead of allow for ambiguous provider output and all provider failures", async () => {
    const cases: Array<Awaited<ReturnType<SafetyGeneration>>> = [
      { ok: false, reason: "disabled" },
      { ok: false, reason: "timeout" },
      { ok: false, reason: "invalid_output" },
      { ok: false, reason: "provider_failure", retryable: true },
      { ok: true, object: { decision: "allow", category: "ambiguous_high_risk" } as never },
    ];

    for (const result of cases) {
      await expect(
        classifyNarrativeSafety({ narratives: { N01: "I might hurt myself but I am not sure what I mean by that." } }, { generate: provider(result), env: enabledEnv }),
      ).resolves.toEqual({ kind: "review_fallback", category: "ambiguous_high_risk", source: "provider" });
    }
  });

  it("allows empty or skipped narrative without invoking the provider", async () => {
    const generate = provider({ ok: true, object: { decision: "interrupt", category: "self_harm_immediate" } });

    const decision = await classifyNarrativeSafety({ narratives: { N01: { event: "   " }, N02: undefined } }, { generate, env: enabledEnv });

    expect(decision).toEqual({ kind: "allow", source: "empty" });
    expect(generate).not.toHaveBeenCalled();
  });
});

describe("help resources and privacy-safe logging", () => {
  it("selects international defaults unless an explicit supported country is supplied", () => {
    expect(selectSafetyHelpResources({}).map((resource) => resource.id)).toEqual(["emergency-services", "find-a-helpline"]);
    expect(selectSafetyHelpResources({ countryCode: "US" }).map((resource) => resource.id)).toEqual([
      "emergency-services",
      "us-988-lifeline",
      "find-a-helpline",
    ]);
    expect(selectSafetyHelpResources({ countryCode: "This narrative says I live in the US" }).map((resource) => resource.id)).toEqual([
      "emergency-services",
      "find-a-helpline",
    ]);
  });

  it("builds safety log metadata without narrative text, prompts, or provider output", async () => {
    const narrative = "private narrative text that must never be logged";
    const log = vi.fn();
    const generate = provider({ ok: false, reason: "invalid_output" });

    const decision = await classifyNarrativeSafety({ narratives: { N01: narrative } }, { generate, env: enabledEnv, log });

    expect(toSafetyLogEvent(decision)).toEqual({ event: "safety_classified", status: "review_fallback", category: "ambiguous_high_risk", source: "provider" });
    expect(log).toHaveBeenCalledWith(toSafetyLogEvent(decision));
    const serializedLog = JSON.stringify(log.mock.calls);
    expect(serializedLog).not.toContain(narrative);
    expect(serializedLog).not.toContain("Narrative text to classify");
    expect(serializedLog).not.toContain("invalid_output");
  });
});
