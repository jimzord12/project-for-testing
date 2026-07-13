import { describe, expect, it } from "vitest";

import { PROMPT_VERSION, QUESTIONNAIRE_VERSION, SCORING_VERSION } from "@/domain/versions";
import { createExportEventPostHandler } from "./route";

function request(body: unknown) {
  return new Request("http://localhost/api/v1/export-event", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/export-event", () => {
  it("accepts only export format and version metadata", async () => {
    const events: unknown[] = [];
    const handler = createExportEventPostHandler({
      createRequestId: () => "req-export",
      now: () => 0,
      emit: (event) => events.push(event),
    });

    const response = await handler(request({
      format: "json",
      versions: { questionnaire: QUESTIONNAIRE_VERSION, scoring: SCORING_VERSION, prompt: PROMPT_VERSION },
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(events).toEqual([
      {
        event: "export_generated",
        requestId: "req-export",
        timestamp: "1970-01-01T00:00:00.000Z",
        questionnaireVersion: QUESTIONNAIRE_VERSION,
        scoringVersion: SCORING_VERSION,
        promptVersion: PROMPT_VERSION,
        exportFormat: "json",
      },
    ]);
  });

  it("rejects result content, answers, and narrative fields", async () => {
    const events: unknown[] = [];
    const handler = createExportEventPostHandler({ emit: (event) => events.push(event) });

    const response = await handler(request({
      format: "printable_html",
      versions: { questionnaire: QUESTIONNAIRE_VERSION, scoring: SCORING_VERSION, prompt: PROMPT_VERSION },
      deterministicResult: { structuredMaturityIndex: 68 },
      answers: [{ questionId: "ER01", optionId: "C" }],
      narrative: "raw narrative",
    }));

    expect(response.status).toBe(400);
    expect(events).toEqual([]);
  });
});
