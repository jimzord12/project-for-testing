import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

const sdkMocks = vi.hoisted(() => {
  const anthropicModel = { provider: "anthropic", modelId: "claude-test" };
  const openaiModel = { provider: "openai", modelId: "gpt-test" };
  const anthropicProvider = vi.fn(() => anthropicModel);
  const openaiProvider = vi.fn(() => openaiModel);

  return {
    anthropicModel,
    openaiModel,
    anthropicProvider,
    openaiProvider,
    createAnthropic: vi.fn(() => anthropicProvider),
    createOpenAI: vi.fn(() => openaiProvider),
    generateObject: vi.fn(),
    zodSchema: vi.fn((schema: unknown) => ({ adapter: "zod", schema })),
  };
});

vi.mock("ai", () => ({
  generateObject: sdkMocks.generateObject,
  zodSchema: sdkMocks.zodSchema,
}));

vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: sdkMocks.createAnthropic,
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: sdkMocks.createOpenAI,
}));

import { generateStructuredObject, resolveAiProviderConfig } from "./ai-provider";

const outputSchema = z
  .object({
    headline: z.string(),
  })
  .strict();

const anthropicEnv = {
  AI_PROVIDER: "anthropic",
  ANTHROPIC_API_KEY: "anthropic-secret",
  ANTHROPIC_MODEL: "claude-test",
  ANTHROPIC_BASE_URL: "https://anthropic-compatible.example/v1",
  AI_ANALYSIS_TIMEOUT_MS: "1234",
};

const openAiEnv = {
  AI_PROVIDER: "openai",
  OPENAI_API_KEY: "openai-secret",
  OPENAI_MODEL: "gpt-test",
  OPENAI_BASE_URL: "https://openai-compatible.example/v1",
  AI_ANALYSIS_TIMEOUT_MS: "5678",
};

function resetMocks() {
  sdkMocks.createAnthropic.mockClear();
  sdkMocks.createOpenAI.mockClear();
  sdkMocks.generateObject.mockReset();
  sdkMocks.zodSchema.mockClear();
  sdkMocks.anthropicProvider.mockClear();
  sdkMocks.openaiProvider.mockClear();
}

describe("resolveAiProviderConfig", () => {
  it("defaults to disabled provider mode without requiring credentials", () => {
    const config = resolveAiProviderConfig({ env: {} });

    expect(config).toEqual({ ok: true, provider: "none", timeoutMs: 20000 });
  });

  it("fails closed for invalid provider configuration without echoing secret values", () => {
    const config = resolveAiProviderConfig({
      env: {
        AI_PROVIDER: "anthropic",
        ANTHROPIC_API_KEY: "super-secret-value",
        AI_ANALYSIS_TIMEOUT_MS: "not-a-number",
      },
    });

    expect(config.ok).toBe(false);
    if (config.ok) throw new Error("expected invalid configuration");
    expect(config.issues).toEqual(expect.arrayContaining(["ANTHROPIC_MODEL is required", "AI_ANALYSIS_TIMEOUT_MS must be a positive integer"]));
    expect(JSON.stringify(config)).not.toContain("super-secret-value");
  });
});

describe("generateStructuredObject", () => {
  it("returns disabled when AI_PROVIDER is none and does not construct providers or call the SDK", async () => {
    resetMocks();

    const result = await generateStructuredObject({ schema: outputSchema, prompt: "Analyze" }, { env: { AI_PROVIDER: "none" } });

    expect(result).toEqual({ ok: false, reason: "disabled" });
    expect(sdkMocks.createAnthropic).not.toHaveBeenCalled();
    expect(sdkMocks.createOpenAI).not.toHaveBeenCalled();
    expect(sdkMocks.generateObject).not.toHaveBeenCalled();
  });

  it("passes Anthropic provider, model, custom base URL, timeout signal, and Zod schema adapter to generateObject", async () => {
    resetMocks();
    sdkMocks.generateObject.mockResolvedValueOnce({ object: { headline: "Structured result" } });

    const result = await generateStructuredObject(
      { schema: outputSchema, system: "System instruction", prompt: "Analyze safely" },
      { env: anthropicEnv, createTimeoutSignal: (timeoutMs) => ({ kind: "timeout", timeoutMs }) as unknown as AbortSignal },
    );

    expect(result).toEqual({ ok: true, object: { headline: "Structured result" } });
    expect(sdkMocks.createAnthropic).toHaveBeenCalledWith({
      apiKey: "anthropic-secret",
      baseURL: "https://anthropic-compatible.example/v1",
    });
    expect(sdkMocks.anthropicProvider).toHaveBeenCalledWith("claude-test");
    expect(sdkMocks.zodSchema).toHaveBeenCalledWith(outputSchema);
    expect(sdkMocks.generateObject).toHaveBeenCalledWith({
      model: sdkMocks.anthropicModel,
      schema: { adapter: "zod", schema: outputSchema },
      system: "System instruction",
      prompt: "Analyze safely",
      abortSignal: { kind: "timeout", timeoutMs: 1234 },
      maxRetries: 1,
    });
  });

  it("passes OpenAI provider, model, and custom base URL to the correct SDK constructor", async () => {
    resetMocks();
    sdkMocks.generateObject.mockResolvedValueOnce({ object: { headline: "OpenAI result" } });

    const result = await generateStructuredObject(
      { schema: outputSchema, prompt: "Analyze" },
      { env: openAiEnv, createTimeoutSignal: (timeoutMs) => ({ kind: "timeout", timeoutMs }) as unknown as AbortSignal },
    );

    expect(result).toEqual({ ok: true, object: { headline: "OpenAI result" } });
    expect(sdkMocks.createOpenAI).toHaveBeenCalledWith({
      apiKey: "openai-secret",
      baseURL: "https://openai-compatible.example/v1",
    });
    expect(sdkMocks.openaiProvider).toHaveBeenCalledWith("gpt-test");
    expect(sdkMocks.generateObject).toHaveBeenCalledWith(
      expect.objectContaining({ model: sdkMocks.openaiModel, maxRetries: 1 }),
    );
  });

  it("returns invalid_configuration without leaking secret values", async () => {
    resetMocks();

    const result = await generateStructuredObject(
      { schema: outputSchema, prompt: "Analyze" },
      { env: { AI_PROVIDER: "openai", OPENAI_API_KEY: "openai-secret" } },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected invalid configuration");
    expect(result.reason).toBe("invalid_configuration");
    if (result.reason !== "invalid_configuration") throw new Error("expected invalid configuration reason");
    expect(result.issues).toContain("OPENAI_MODEL is required");
    expect(JSON.stringify(result)).not.toContain("openai-secret");
    expect(sdkMocks.generateObject).not.toHaveBeenCalled();
  });

  it("distinguishes schema-valid success from invalid model output and does not return raw prose", async () => {
    resetMocks();
    sdkMocks.generateObject.mockRejectedValueOnce({
      name: "AI_NoObjectGeneratedError",
      text: "raw provider prose that must not escape",
      finishReason: "stop",
    });

    const result = await generateStructuredObject({ schema: outputSchema, prompt: "Analyze" }, { env: anthropicEnv });

    expect(result).toEqual({ ok: false, reason: "invalid_output" });
    expect(JSON.stringify(result)).not.toContain("raw provider prose");
  });

  it("maps timeouts, rate limits, refusals, retryable failures, and non-retryable failures to typed results", async () => {
    resetMocks();
    const cases = [
      [{ name: "TimeoutError" }, { ok: false, reason: "timeout" }],
      [{ statusCode: 429 }, { ok: false, reason: "rate_limited" }],
      [{ name: "AI_NoObjectGeneratedError", finishReason: "content-filter" }, { ok: false, reason: "refusal" }],
      [{ statusCode: 503, isRetryable: true }, { ok: false, reason: "provider_failure", retryable: true }],
      [{ statusCode: 400, isRetryable: false }, { ok: false, reason: "provider_failure", retryable: false }],
    ] as const;

    for (const [error, expected] of cases) {
      sdkMocks.generateObject.mockRejectedValueOnce(error);
      await expect(generateStructuredObject({ schema: outputSchema, prompt: "Analyze" }, { env: anthropicEnv })).resolves.toEqual(
        expected,
      );
    }
  });
});

describe("I010 server-only import boundary", () => {
  it("keeps AI SDK imports and provider secret environment reads inside src/server/ai-provider.ts", () => {
    const matches: string[] = [];
    const root = join(process.cwd(), "src");
    const needles = ["@ai-sdk/", "from \"ai\"", "from 'ai'", "ANTHROPIC_API_KEY", "OPENAI_API_KEY"];

    function visit(directory: string) {
      for (const entry of readdirSync(directory)) {
        const path = join(directory, entry);
        const stat = statSync(path);
        if (stat.isDirectory()) {
          visit(path);
          continue;
        }
        if ((!path.endsWith(".ts") && !path.endsWith(".tsx")) || path.endsWith(".test.ts")) continue;
        const source = readFileSync(path, "utf8");
        if (needles.some((needle) => source.includes(needle))) {
          matches.push(path.replace(process.cwd() + "\\", "").replaceAll("\\", "/"));
        }
      }
    }

    visit(root);

    expect([...new Set(matches)].sort()).toEqual(["src/server/ai-provider.ts"]);
  });
});
