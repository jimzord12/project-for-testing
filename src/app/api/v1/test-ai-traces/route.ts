import { NextResponse } from "next/server";
import { clearTestAiProviderTraces, getTestAiProviderTraces } from "@/server/ai-provider";

const unavailable = () => NextResponse.json({ error: "not_found" }, { status: 404 });

export async function GET(request: Request) {
  if (process.env.E2E_TEST_MODE !== "1" || process.env.NODE_ENV === "production") return unavailable();
  return NextResponse.json({ traces: getTestAiProviderTraces(new URL(request.url).searchParams.get("traceId") ?? undefined) });
}

export async function DELETE(request: Request) {
  if (process.env.E2E_TEST_MODE !== "1" || process.env.NODE_ENV === "production") return unavailable();
  clearTestAiProviderTraces(new URL(request.url).searchParams.get("traceId") ?? undefined);
  return new NextResponse(null, { status: 204 });
}