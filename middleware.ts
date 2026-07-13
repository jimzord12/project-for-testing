import { NextResponse, type NextRequest } from "next/server";

import { buildSecurityHeaders, createCspNonce } from "@/server/security-headers";

export function middleware(request: NextRequest) {
  const nonce = createCspNonce();
  const headers = buildSecurityHeaders({ nonce, production: process.env.NODE_ENV === "production" });
  const contentSecurityPolicy = headers["Content-Security-Policy"];
  if (!contentSecurityPolicy) {
    throw new Error("Content-Security-Policy header must be generated for middleware requests.");
  }
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  for (const [name, value] of Object.entries(headers)) {
    response.headers.set(name, value);
  }

  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
    },
  ],
};
