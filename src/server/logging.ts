import { z } from "zod";

export const EVENT_NAMES = [
  "questionnaire_loaded",
  "score_requested",
  "score_completed",
  "score_rejected",
  "analysis_requested",
  "analysis_completed",
  "analysis_unavailable",
  "safety_interrupted",
  "export_generated",
] as const;

const eventNameSchema = z.enum(EVENT_NAMES);
const isoTimestampSchema = z.string().min(1);
const statusSchema = z.enum(["requested", "success", "rejected", "unavailable", "interrupted"]);
const errorCodeSchema = z.string().min(1).max(80).regex(/^[A-Z0-9_]+$/);

const baseEventSchema = z
  .object({
    event: eventNameSchema,
    requestId: z.string().min(1).max(128).optional(),
    timestamp: isoTimestampSchema,
    questionnaireVersion: z.string().min(1).max(40).optional(),
    scoringVersion: z.string().min(1).max(40).optional(),
    promptVersion: z.string().min(1).max(40).optional(),
    status: statusSchema.optional(),
    latencyMs: z.number().int().nonnegative().max(300_000).optional(),
    errorCode: errorCodeSchema.optional(),
    exportFormat: z.enum(["json", "printable_html"]).optional(),
    deploymentVersion: z.string().min(1).max(120).optional(),
  })
  .strip();

export const questionnaireLoadedEventSchema = baseEventSchema.extend({
  event: z.literal("questionnaire_loaded"),
  questionnaireVersion: z.string().min(1).max(40),
  scoringVersion: z.string().min(1).max(40),
});

export const scoreRequestedEventSchema = baseEventSchema.extend({
  event: z.literal("score_requested"),
  status: z.literal("requested"),
});

export const scoreCompletedEventSchema = baseEventSchema.extend({
  event: z.literal("score_completed"),
  status: z.literal("success"),
  questionnaireVersion: z.string().min(1).max(40),
  scoringVersion: z.string().min(1).max(40),
  latencyMs: z.number().int().nonnegative().max(300_000),
});

export const scoreRejectedEventSchema = baseEventSchema.extend({
  event: z.literal("score_rejected"),
  status: z.literal("rejected"),
  errorCode: errorCodeSchema,
});

export const analysisRequestedEventSchema = baseEventSchema.extend({
  event: z.literal("analysis_requested"),
  status: z.literal("requested"),
});

export const analysisCompletedEventSchema = baseEventSchema.extend({
  event: z.literal("analysis_completed"),
  status: z.literal("success"),
  questionnaireVersion: z.string().min(1).max(40),
  scoringVersion: z.string().min(1).max(40),
  promptVersion: z.string().min(1).max(40),
  latencyMs: z.number().int().nonnegative().max(300_000),
});

export const analysisUnavailableEventSchema = baseEventSchema.extend({
  event: z.literal("analysis_unavailable"),
  status: z.literal("unavailable"),
  errorCode: errorCodeSchema,
  latencyMs: z.number().int().nonnegative().max(300_000).optional(),
});

export const safetyInterruptedEventSchema = baseEventSchema.extend({
  event: z.literal("safety_interrupted"),
  status: z.literal("interrupted"),
  errorCode: errorCodeSchema.optional(),
  latencyMs: z.number().int().nonnegative().max(300_000).optional(),
});

export const exportGeneratedEventSchema = baseEventSchema.extend({
  event: z.literal("export_generated"),
  questionnaireVersion: z.string().min(1).max(40),
  scoringVersion: z.string().min(1).max(40),
  promptVersion: z.string().min(1).max(40),
  exportFormat: z.enum(["json", "printable_html"]),
});

export const operationalEventSchema = z.discriminatedUnion("event", [
  questionnaireLoadedEventSchema,
  scoreRequestedEventSchema,
  scoreCompletedEventSchema,
  scoreRejectedEventSchema,
  analysisRequestedEventSchema,
  analysisCompletedEventSchema,
  analysisUnavailableEventSchema,
  safetyInterruptedEventSchema,
  exportGeneratedEventSchema,
]);

export type OperationalEvent = z.input<typeof operationalEventSchema>;
export type SanitizedOperationalEvent = z.infer<typeof operationalEventSchema>;

type EventProducerInput<TEvent extends SanitizedOperationalEvent["event"]> = Omit<
  Extract<SanitizedOperationalEvent, { event: TEvent }>,
  "event" | "status"
>;

export const operationalEventProducers = {
  questionnaire_loaded: (event: EventProducerInput<"questionnaire_loaded">) => ({
    ...event,
    event: "questionnaire_loaded" as const,
  }),
  score_requested: (event: EventProducerInput<"score_requested">) => ({
    ...event,
    event: "score_requested" as const,
    status: "requested" as const,
  }),
  score_completed: (event: EventProducerInput<"score_completed">) => ({
    ...event,
    event: "score_completed" as const,
    status: "success" as const,
  }),
  score_rejected: (event: EventProducerInput<"score_rejected">) => ({
    ...event,
    event: "score_rejected" as const,
    status: "rejected" as const,
  }),
  analysis_requested: (event: EventProducerInput<"analysis_requested">) => ({
    ...event,
    event: "analysis_requested" as const,
    status: "requested" as const,
  }),
  analysis_completed: (event: EventProducerInput<"analysis_completed">) => ({
    ...event,
    event: "analysis_completed" as const,
    status: "success" as const,
  }),
  analysis_unavailable: (event: EventProducerInput<"analysis_unavailable">) => ({
    ...event,
    event: "analysis_unavailable" as const,
    status: "unavailable" as const,
  }),
  safety_interrupted: (event: EventProducerInput<"safety_interrupted">) => ({
    ...event,
    event: "safety_interrupted" as const,
    status: "interrupted" as const,
  }),
  export_generated: (event: EventProducerInput<"export_generated">) => ({
    ...event,
    event: "export_generated" as const,
  }),
} satisfies {
  [TEvent in SanitizedOperationalEvent["event"]]: (event: EventProducerInput<TEvent>) => OperationalEvent;
};

const SENSITIVE_KEY_PATTERN = /answer|narrative|prompt|excerpt|authorization|cookie|token|secret|api[-_]?key|modeloutput|model_output|raw/i;
const FULL_IPV4_PATTERN = /\b(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\b/;
const FULL_IPV6_PATTERN = /\b(?:[a-f0-9]{1,4}:){2,}[a-f0-9:]{1,}\b/i;
const SENSITIVE_VALUE_PATTERN = new RegExp(
  `(?:bearer\\s+|sk-[a-z0-9_-]*|api[-_]?key|authorization:|${FULL_IPV4_PATTERN.source}|${FULL_IPV6_PATTERN.source})`,
  "i",
);
const IPV4_VALUE_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IPV6_VALUE_PATTERN = /^[0-9a-f:]+$/i;

function isFullIpAddressValue(value: string): boolean {
  const candidate = value.trim();
  if (IPV4_VALUE_PATTERN.test(candidate)) {
    return candidate.split(".").every((part) => Number(part) >= 0 && Number(part) <= 255);
  }
  return candidate.includes(":") && IPV6_VALUE_PATTERN.test(candidate);
}

export function scrubSensitiveData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubSensitiveData);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? "[REDACTED]" : scrubSensitiveData(nested),
      ]),
    );
  }
  if (typeof value === "string" && (SENSITIVE_VALUE_PATTERN.test(value) || isFullIpAddressValue(value))) return "[REDACTED]";
  return value;
}

export function emitEvent(event: OperationalEvent, sink: Pick<Console, "info"> = console): SanitizedOperationalEvent {
  const scrubbed = scrubSensitiveData(event);
  const parsed = operationalEventSchema.parse(scrubbed);
  sink.info(JSON.stringify(parsed));
  return parsed;
}
