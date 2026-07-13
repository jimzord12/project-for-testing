export type SecurityHeaderOptions = {
  nonce: string;
  production: boolean;
};

export type SecurityHeaders = Record<string, string>;

function directive(name: string, values: readonly string[]): string {
  return `${name} ${values.join(" ")}`;
}

export function createCspNonce(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index] ?? 0);
  }
  return globalThis.btoa(binary);
}

export function buildContentSecurityPolicy({ nonce, production }: SecurityHeaderOptions): string {
  const scriptSources = production
    ? ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", "https:"]
    : ["'self'", `'nonce-${nonce}'`, "'unsafe-inline'", "'unsafe-eval'", "http:", "https:"];

  const connectSources = production
    ? ["'self'"]
    : ["'self'", "ws:", "wss:", "http:", "https:"];

  return [
    directive("default-src", ["'self'"]),
    directive("script-src", scriptSources),
    directive("style-src", ["'self'", "'unsafe-inline'"]),
    directive("img-src", ["'self'", "data:", "blob:"]),
    directive("font-src", ["'self'", "data:"]),
    directive("connect-src", connectSources),
    directive("form-action", ["'self'"]),
    directive("object-src", ["'none'"]),
    directive("base-uri", ["'self'"]),
    directive("frame-ancestors", ["'none'"]),
    directive("upgrade-insecure-requests", []),
  ].join("; ");
}

export function buildSecurityHeaders(options: SecurityHeaderOptions): SecurityHeaders {
  const headers: SecurityHeaders = {
    "Content-Security-Policy": buildContentSecurityPolicy(options),
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": [
      "accelerometer=()",
      "ambient-light-sensor=()",
      "autoplay=()",
      "battery=()",
      "camera=()",
      "display-capture=()",
      "encrypted-media=()",
      "fullscreen=(self)",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "midi=()",
      "payment=()",
      "publickey-credentials-get=()",
      "screen-wake-lock=()",
      "usb=()",
      "web-share=()",
      "xr-spatial-tracking=()",
    ].join(", "),
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
  };

  if (options.production) {
    headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload";
  }

  return headers;
}
