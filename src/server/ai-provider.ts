import { generateObject, zodSchema } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { z } from "zod";

export type AiProviderName = "none" | "anthropic" | "openai";

type AiProviderEnvironment = Partial<Record<string, string | undefined>>;

export type DisabledAiProviderConfig = {
  ok: true;
  provider: "none";
  timeoutMs: number;
};

export type EnabledAiProviderConfig = {
  ok: true;
  provider: "anthropic" | "openai";
  apiKey: string;
  model: string;
  baseURL?: string;
  timeoutMs: number;
};

export type InvalidAiProviderConfig = {
  ok: false;
  reason: "invalid_configuration";
  issues: string[];
};

export type AiProviderConfig = DisabledAiProviderConfig | EnabledAiProviderConfig;
export type AiProviderConfigResult = AiProviderConfig | InvalidAiProviderConfig;

export type StructuredGenerationResult<T> =
  | { ok: true; object: T }
  | { ok: false; reason: "disabled" }
  | { ok: false; reason: "invalid_configuration"; issues: string[] }
  | { ok: false; reason: "timeout" }
  | { ok: false; reason: "rate_limited" }
  | { ok: false; reason: "refusal" }
  | { ok: false; reason: "invalid_output" }
  | { ok: false; reason: "provider_failure"; retryable: boolean };

export type StructuredGenerationInput<T> = {
  schema: z.ZodType<T>;
  system?: string;
  prompt: string;
};

export type ResolveAiProviderConfigOptions = {
  env?: AiProviderEnvironment;
};

export type GenerateStructuredObjectDependencies = ResolveAiProviderConfigOptions & {
  createTimeoutSignal?: (timeoutMs: number) => AbortSignal;
};

function defaultEnvironment(): AiProviderEnvironment {
  return {
    AI_PROVIDER: process.env.AI_PROVIDER,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
    ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    AI_ANALYSIS_TIMEOUT_MS: process.env.AI_ANALYSIS_TIMEOUT_MS,
  };
}

function valueOf(env: AiProviderEnvironment, key: string): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

function parseTimeoutMs(env: AiProviderEnvironment): { ok: true; timeoutMs: number } | { ok: false; issue: string } {
  const raw = valueOf(env, "AI_ANALYSIS_TIMEOUT_MS");
  if (!raw) return { ok: true, timeoutMs: 20000 };

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { ok: false, issue: "AI_ANALYSIS_TIMEOUT_MS must be a positive integer" };
  }

  return { ok: true, timeoutMs: parsed };
}

export function resolveAiProviderConfig(options: ResolveAiProviderConfigOptions = {}): AiProviderConfigResult {
  const env = options.env ?? defaultEnvironment();
  const provider = (valueOf(env, "AI_PROVIDER") ?? "none").toLowerCase();
  const timeout = parseTimeoutMs(env);
  const issues: string[] = [];
  const timeoutMs = timeout.ok ? timeout.timeoutMs : 20000;

  if (!timeout.ok) {
    issues.push(timeout.issue);
  }

  if (provider !== "none" && provider !== "anthropic" && provider !== "openai") {
    issues.push("AI_PROVIDER must be one of: none, anthropic, openai");
    return { ok: false, reason: "invalid_configuration", issues };
  }

  if (provider === "none") {
    if (issues.length > 0) return { ok: false, reason: "invalid_configuration", issues };
    return { ok: true, provider: "none", timeoutMs };
  }

  const keyName = provider === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY";
  const modelName = provider === "anthropic" ? "ANTHROPIC_MODEL" : "OPENAI_MODEL";
  const baseUrlName = provider === "anthropic" ? "ANTHROPIC_BASE_URL" : "OPENAI_BASE_URL";
  const apiKey = valueOf(env, keyName);
  const model = valueOf(env, modelName);
  const baseURL = valueOf(env, baseUrlName);

  if (!apiKey) issues.push(`${keyName} is required`);
  if (!model) issues.push(`${modelName} is required`);

  if (!apiKey || !model || issues.length > 0) {
    return { ok: false, reason: "invalid_configuration", issues };
  }

  return {
    ok: true,
    provider,
    apiKey,
    model,
    ...(baseURL ? { baseURL } : {}),
    timeoutMs,
  };
}

function timeoutSignal(timeoutMs: number): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}

function modelForConfig(config: EnabledAiProviderConfig) {
  if (config.provider === "anthropic") {
    const provider = createAnthropic({
      apiKey: config.apiKey,
      ...(config.baseURL ? { baseURL: config.baseURL } : {}),
    });
    return provider(config.model as Parameters<typeof provider>[0]);
  }

  const provider = createOpenAI({
    apiKey: config.apiKey,
    ...(config.baseURL ? { baseURL: config.baseURL } : {}),
  });
  return provider(config.model as Parameters<typeof provider>[0]);
}

function errorStatusCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("statusCode" in error)) return undefined;
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof statusCode === "number" ? statusCode : undefined;
}

function errorName(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("name" in error)) return undefined;
  const name = (error as { name?: unknown }).name;
  return typeof name === "string" ? name : undefined;
}

function finishReason(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("finishReason" in error)) return undefined;
  const reason = (error as { finishReason?: unknown }).finishReason;
  return typeof reason === "string" ? reason : undefined;
}

function isNoObjectGenerated(error: unknown): boolean {
  const name = errorName(error);
  return name === "AI_NoObjectGeneratedError" || name === "NoObjectGeneratedError";
}

function isRetryable(error: unknown): boolean {
  if (typeof error === "object" && error !== null && "isRetryable" in error) {
    return (error as { isRetryable?: unknown }).isRetryable === true;
  }

  const statusCode = errorStatusCode(error);
  return typeof statusCode === "number" && statusCode >= 500;
}

function classifyGenerationError(error: unknown): Exclude<StructuredGenerationResult<never>, { ok: true }> {
  const name = errorName(error);
  if (name === "TimeoutError" || name === "AbortError") {
    return { ok: false, reason: "timeout" };
  }

  if (errorStatusCode(error) === 429) {
    return { ok: false, reason: "rate_limited" };
  }

  if (finishReason(error) === "content-filter" || finishReason(error) === "refusal") {
    return { ok: false, reason: "refusal" };
  }

  if (isNoObjectGenerated(error)) {
    return { ok: false, reason: "invalid_output" };
  }

  return { ok: false, reason: "provider_failure", retryable: isRetryable(error) };
}

export async function generateStructuredObject<T>(
  input: StructuredGenerationInput<T>,
  deps: GenerateStructuredObjectDependencies = {},
): Promise<StructuredGenerationResult<T>> {
  const config = resolveAiProviderConfig({ env: deps.env });

  if (!config.ok) {
    return { ok: false, reason: "invalid_configuration", issues: config.issues };
  }

  if (config.provider === "none") {
    return { ok: false, reason: "disabled" };
  }

  try {
    const result = await generateObject({
      model: modelForConfig(config),
      schema: zodSchema(input.schema),
      system: input.system,
      prompt: input.prompt,
      abortSignal: (deps.createTimeoutSignal ?? timeoutSignal)(config.timeoutMs),
      maxRetries: 1,
    });

    return { ok: true, object: result.object };
  } catch (error) {
    return classifyGenerationError(error) as StructuredGenerationResult<T>;
  }
}
