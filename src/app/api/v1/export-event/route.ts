import { NextResponse } from "next/server";
import { z } from "zod";

import { PROMPT_VERSION, QUESTIONNAIRE_VERSION, SCORING_VERSION } from "@/domain/versions";
import { emitEvent, type OperationalEvent } from "@/server/logging";

export const exportEventRequestSchema = z
  .object({
    format: z.enum(["json", "printable_html"]),
    versions: z
      .object({
        questionnaire: z.literal(QUESTIONNAIRE_VERSION),
        scoring: z.literal(SCORING_VERSION),
        prompt: z.literal(PROMPT_VERSION),
      })
      .strict(),
  })
  .strict();

type ExportEventRouteDependencies = {
  emit?: (event: OperationalEvent) => void;
  now?: () => number;
  createRequestId?: () => string;
};

function randomId(): string {
  return globalThis.crypto.randomUUID();
}

export function createExportEventPostHandler(deps: ExportEventRouteDependencies = {}) {
  return async function exportEventPostHandler(request: Request) {
    let parsedJson: unknown;
    try {
      parsedJson = await request.json();
    } catch {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const parsed = exportEventRequestSchema.safeParse(parsedJson);
    if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

    (deps.emit ?? ((event) => { emitEvent(event); }))({
      event: "export_generated",
      requestId: (deps.createRequestId ?? randomId)(),
      timestamp: new Date(deps.now?.() ?? Date.now()).toISOString(),
      questionnaireVersion: parsed.data.versions.questionnaire,
      scoringVersion: parsed.data.versions.scoring,
      promptVersion: parsed.data.versions.prompt,
      exportFormat: parsed.data.format,
    });

    return NextResponse.json({ ok: true });
  };
}

export const POST = createExportEventPostHandler();
