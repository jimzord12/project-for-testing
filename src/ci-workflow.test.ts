import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const workflowPath = join(process.cwd(), ".github", "workflows", "ci.yml");
const workflow = readFileSync(workflowPath, "utf8");
const workflowLines = workflow.split(/\r?\n/);

const packageJson = JSON.parse(
  readFileSync(join(process.cwd(), "package.json"), "utf8"),
) as { packageManager?: unknown };

function stepBlock(stepName: string): string {
  const start = workflowLines.findIndex(
    (line) => line.trim() === `- name: ${stepName}`,
  );
  expect(start, `missing workflow step: ${stepName}`).toBeGreaterThanOrEqual(0);

  const next = workflowLines.findIndex(
    (line, index) => index > start && line.trim().startsWith("- name: "),
  );
  return workflowLines.slice(start, next === -1 ? undefined : next).join("\n");
}

describe("GitHub Actions CI workflow contract", () => {
  it("runs on push and pull request events", () => {
    expect(workflow).toMatch(/^on:\n  push:\n  pull_request:/m);
  });

  it("uses one Ubuntu quality job with read-only repository permissions", () => {
    expect(workflow).toMatch(/^permissions:\n  contents: read$/m);
    expect(workflow).toMatch(/^  quality:\n    name: Quality gate\n    runs-on: ubuntu-latest$/m);
    const jobsBlock = workflow.slice(workflow.indexOf("jobs:"));
    expect(jobsBlock.match(/^  [a-zA-Z0-9_-]+:$/gm)).toEqual(["  quality:"]);
  });

  it("pins action majors while keeping pnpm version sourced only from package.json", () => {
    expect(packageJson.packageManager).toBe("pnpm@10.33.0");

    const usesLines = workflowLines.filter((line) => line.trim().startsWith("uses: "));
    expect(usesLines).toEqual([
      "        uses: actions/checkout@v4",
      "        uses: pnpm/action-setup@v4",
      "        uses: actions/setup-node@v4",
    ]);
    expect(usesLines.every((line) => /@[vV]\d+$/.test(line.trim()))).toBe(true);
    expect(stepBlock("Setup pnpm")).not.toMatch(/^\s+version:/m);
  });

  it("configures Node 22 and setup-node pnpm cache against the lockfile", () => {
    const setupNode = stepBlock("Setup Node.js");

    expect(setupNode).toMatch(/^\s+node-version: "22"$/m);
    expect(setupNode).toMatch(/^\s+cache: pnpm$/m);
    expect(setupNode).toMatch(/^\s+cache-dependency-path: pnpm-lock.yaml$/m);
  });

  it("keeps the core verification commands visible, ordered, and mandatory", () => {
    const expectedSteps = [
      ["Install dependencies", "pnpm install --frozen-lockfile"],
      ["Typecheck", "pnpm typecheck"],
      ["Test", "pnpm test"],
      ["Build", "pnpm build"],
    ] as const;

    const stepStarts = expectedSteps.map(([name]) =>
      workflowLines.findIndex((line) => line.trim() === `- name: ${name}`),
    );
    expect(stepStarts.every((index) => index >= 0)).toBe(true);
    expect(stepStarts).toEqual([...stepStarts].sort((a, b) => a - b));

    for (const [name, command] of expectedSteps) {
      const block = stepBlock(name);
      expect(block).toContain(`run: ${command}`);
      expect(block).not.toMatch(/^\s+continue-on-error:/m);
    }
  });

  it("keeps AI disabled without requiring provider secrets", () => {
    expect(workflow).toMatch(/^\s+AI_PROVIDER: none$/m);
    expect(workflow).not.toMatch(/secrets\./);
  });
});
