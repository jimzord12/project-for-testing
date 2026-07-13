import { NextResponse } from "next/server";

import {
  buildScoreErrorResponse,
  fieldErrorsFromZodError,
  processScoreAssessment,
  scoreErrorResponseSchema,
  scoreRequestSchema,
  scoreSuccessResponseSchema,
} from "./score-service";

export { scoreErrorResponseSchema, scoreSuccessResponseSchema } from "./score-service";

export const SCORE_REQUEST_BYTE_LIMIT = 16 * 1024;

type BoundedBodyResult =
  | { ok: true; text: string }
  | { ok: false; reason: "too_large" | "read_error" };

function isJsonContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  return contentType
    .split(";")[0]
    ?.trim()
    .toLowerCase() === "application/json";
}

export async function readBoundedUtf8Body(
  request: Request,
  limitBytes = SCORE_REQUEST_BYTE_LIMIT,
): Promise<BoundedBodyResult> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const parsed = Number(contentLength);
    if (Number.isFinite(parsed) && parsed > limitBytes) {
      return { ok: false, reason: "too_large" };
    }
  }

  if (!request.body) return { ok: true, text: "" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > limitBytes) {
        await reader.cancel();
        return { ok: false, reason: "too_large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: "read_error" };
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, text: new TextDecoder().decode(bytes) };
}

export async function POST(request: Request) {
  if (!isJsonContentType(request.headers.get("content-type"))) {
    const error = buildScoreErrorResponse(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Requests to this endpoint must use application/json.",
      [{ path: "headers.content-type", code: "UNSUPPORTED_MEDIA_TYPE" }],
    );
    return NextResponse.json(error.body, { status: error.status });
  }

  const body = await readBoundedUtf8Body(request);
  if (!body.ok) {
    const error = buildScoreErrorResponse(
      body.reason === "too_large" ? 413 : 400,
      body.reason === "too_large" ? "REQUEST_TOO_LARGE" : "MALFORMED_JSON",
      body.reason === "too_large"
        ? "The request body exceeds the 16 KiB limit."
        : "The request body could not be read as JSON.",
      body.reason === "too_large" ? [{ path: "body", code: "REQUEST_TOO_LARGE" }] : [],
    );
    return NextResponse.json(error.body, { status: error.status });
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(body.text);
  } catch {
    const error = buildScoreErrorResponse(
      400,
      "MALFORMED_JSON",
      "The request body must be valid JSON.",
      [{ path: "body", code: "MALFORMED_JSON" }],
    );
    return NextResponse.json(error.body, { status: error.status });
  }

  const parsedRequest = scoreRequestSchema.safeParse(parsedJson);
  if (!parsedRequest.success) {
    const error = buildScoreErrorResponse(
      400,
      "INVALID_REQUEST",
      "The request body does not match the score API contract.",
      fieldErrorsFromZodError(parsedRequest.error),
    );
    return NextResponse.json(error.body, { status: error.status });
  }

  const result = processScoreAssessment(parsedRequest.data);
  return NextResponse.json(result.body, { status: result.status });
}
