#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const defaultSentinels = [
  "I014_SENTINEL_ANTHROPIC_SECRET_DO_NOT_SHIP",
  "I014_SENTINEL_OPENAI_SECRET_DO_NOT_SHIP",
];

const sentinels = [
  ...defaultSentinels,
  process.env.ANTHROPIC_API_KEY,
  process.env.OPENAI_API_KEY,
  process.env.AI_PROVIDER_API_KEY,
].filter((value) => typeof value === "string" && value.length > 0);

const roots = [
  join(process.cwd(), ".next", "static"),
  join(process.cwd(), ".next", "server", "app"),
].filter((path) => existsSync(path));

const extensions = new Set([".html", ".js", ".mjs", ".cjs", ".map", ".json", ".txt", ".rsc", ".body"]);

function extensionOf(path) {
  const index = path.lastIndexOf(".");
  return index === -1 ? "" : path.slice(index);
}

function filesUnder(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return filesUnder(path);
    if (!entry.isFile()) return [];
    if (!extensions.has(extensionOf(path))) return [];
    return [path];
  });
}

function scanFiles() {
  const findings = [];
  for (const root of roots) {
    for (const file of filesUnder(root)) {
      const content = readFileSync(file, "utf8");
      for (const sentinel of sentinels) {
        if (content.includes(sentinel)) {
          findings.push(`${relative(process.cwd(), file)} contains sentinel ${sentinel}`);
        }
      }
    }
  }
  return findings;
}

async function scanEndpoint(baseUrl, path, init) {
  const response = await fetch(new URL(path, baseUrl), init);
  const text = await response.text();
  return sentinels
    .filter((sentinel) => text.includes(sentinel))
    .map((sentinel) => `${path} response contains sentinel ${sentinel}`);
}

async function scanLiveResponses() {
  const baseUrl = process.env.I014_SCAN_BASE_URL || process.env.APP_BASE_URL;
  if (!baseUrl) return [];

  return [
    ...(await scanEndpoint(baseUrl, "/", undefined)),
    ...(await scanEndpoint(baseUrl, "/api/v1/assessments/score", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sentinel: sentinels[0] }),
    })),
    ...(await scanEndpoint(baseUrl, "/api/v1/assessments/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sentinel: sentinels[1] }),
    })),
  ];
}

const findings = [...scanFiles(), ...(await scanLiveResponses())];

if (findings.length > 0) {
  console.error("Sentinel secret scan failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

const scannedFiles = roots.reduce((count, root) => count + filesUnder(root).length, 0);
console.log(`Sentinel secret scan passed (${scannedFiles} built artifact files scanned${process.env.I014_SCAN_BASE_URL || process.env.APP_BASE_URL ? ", live responses scanned" : ""}).`);
