/**
 * End-to-end tests for `osn checklist`: spawns the real CLI entrypoint
 * (`src/cli/index.ts`) as a subprocess, exactly as `tests/integration/
 * cli-render.test.ts` does for `osn render`. Also asserts `osn validate`
 * still passes with the three new data files (`readiness-checklist.json`,
 * `operational-rules.json`, `syllabus-check-log.json`) registered.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "..", "..");
const CLI_ENTRYPOINT = join(REPO_ROOT, "src", "cli", "index.ts");

interface CliResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

async function runCliSubprocess(args: readonly string[]): Promise<CliResult> {
  const proc = Bun.spawn(["bun", "run", CLI_ENTRYPOINT, ...args], {
    cwd: REPO_ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "osn-checklist-test-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("osn checklist (real subprocess)", () => {
  test("exits 0 and prints non-empty Markdown to stdout by default", async () => {
    const result = await runCliSubprocess(["checklist"]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout.length).toBeGreaterThan(0);
    expect(result.stdout).toContain("# osn checklist");
    expect(result.stdout).toContain("Cohort readiness checklist");
    expect(result.stdout).toContain("Operational rules");
    expect(result.stdout).toContain("Mentor quick pointer");
  });

  test("--format md is equivalent to the default", async () => {
    const defaultResult = await runCliSubprocess(["checklist"]);
    const mdResult = await runCliSubprocess(["checklist", "--format", "md"]);
    expect(mdResult.exitCode).toBe(0);
    // Both invocations may fall on different `asOf` instants if run across
    // a UTC-midnight boundary; compare everything except the day-count and
    // as-of-date lines, which are the only asOf-sensitive content.
    const stripAsOf = (text: string) =>
      text.replace(/Days since last check \(as of \d{4}-\d{2}-\d{2}\): \d+\./, "");
    expect(stripAsOf(mdResult.stdout)).toBe(stripAsOf(defaultResult.stdout));
  });

  test("--format json exits 0 and emits parseable JSON with the expected shape", async () => {
    const result = await runCliSubprocess(["checklist", "--format", "json"]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");

    const parsed = JSON.parse(result.stdout) as {
      corpusVersion: { syllabusVersion: string; syllabusDate: string };
      readinessItems: unknown[];
      operationalRules: unknown[];
      quickPointer: { stages: unknown[] };
      syllabusCheck: { latest: unknown; daysSinceLastCheck: number; log: unknown[] };
    };
    expect(parsed.readinessItems).toHaveLength(8);
    expect(parsed.operationalRules).toHaveLength(8);
    expect(parsed.quickPointer.stages).toHaveLength(10);
    expect(parsed.syllabusCheck.log.length).toBeGreaterThan(0);
    expect(typeof parsed.syllabusCheck.daysSinceLastCheck).toBe("number");
    expect(parsed.corpusVersion.syllabusVersion.length).toBeGreaterThan(0);
  });

  test("the global --json flag is equivalent to --format json", async () => {
    const viaFlag = await runCliSubprocess(["checklist", "--format", "json"]);
    const viaGlobal = await runCliSubprocess(["--json", "checklist"]);
    expect(viaGlobal.exitCode).toBe(0);
    // Both may straddle a day boundary in principle; compare parsed shape
    // rather than raw bytes for robustness, then spot-check a stable field.
    const a = JSON.parse(viaFlag.stdout) as { readinessItems: unknown[] };
    const b = JSON.parse(viaGlobal.stdout) as { readinessItems: unknown[] };
    expect(b.readinessItems).toEqual(a.readinessItems);
  });

  test("an unknown --format exits 2", async () => {
    const result = await runCliSubprocess(["checklist", "--format", "bogus"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--format");
  });

  test("--out writes the file, and its content equals the default stdout output", async () => {
    const stdoutResult = await runCliSubprocess(["checklist"]);
    expect(stdoutResult.exitCode).toBe(0);

    const outPath = join(tempDir, "checklist.md");
    const outResult = await runCliSubprocess(["checklist", "--out", outPath]);
    expect(outResult.exitCode).toBe(0);
    expect(outResult.stderr).toBe("");

    const written = await readFile(outPath, "utf-8");
    // Both runs read the wall clock independently; the day-count line can
    // differ if a UTC midnight boundary is crossed between them (vanishingly
    // unlikely, but avoided rather than risked).
    const stripAsOf = (text: string) =>
      text.replace(/Days since last check \(as of \d{4}-\d{2}-\d{2}\): \d+\./, "");
    expect(stripAsOf(written)).toBe(stripAsOf(stdoutResult.stdout));
  });

  test("--out without --force refuses to overwrite an existing file, exits 2", async () => {
    const outPath = join(tempDir, "checklist.md");

    const first = await runCliSubprocess(["checklist", "--out", outPath]);
    expect(first.exitCode).toBe(0);
    const originalContent = await readFile(outPath, "utf-8");

    const second = await runCliSubprocess(["checklist", "--format", "json", "--out", outPath]);
    expect(second.exitCode).toBe(2);
    expect(second.stderr).toContain("already exists");
    expect(second.stderr).toContain("--force");

    const unchangedContent = await readFile(outPath, "utf-8");
    expect(unchangedContent).toBe(originalContent);
  });

  test("--force overwrites an existing --out file", async () => {
    const outPath = join(tempDir, "checklist.md");

    const first = await runCliSubprocess(["checklist", "--out", outPath]);
    expect(first.exitCode).toBe(0);

    const second = await runCliSubprocess([
      "checklist",
      "--format",
      "json",
      "--out",
      outPath,
      "--force",
    ]);
    expect(second.exitCode).toBe(0);

    const finalContent = await readFile(outPath, "utf-8");
    expect(() => JSON.parse(finalContent)).not.toThrow();
  });

  test("--help exits 0 without running the command", async () => {
    const result = await runCliSubprocess(["checklist", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("osn checklist");
    expect(result.stdout).toContain("--format");
  });
});

describe("osn --help (real subprocess): lists checklist", () => {
  test("global --help lists the checklist command", async () => {
    const result = await runCliSubprocess(["--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("checklist");
  });
});

describe("osn validate: still passes with the three new data files registered (real subprocess)", () => {
  test("exits 0 against the real corpus, including readiness-checklist/operational-rules/syllabus-check-log", async () => {
    const result = await runCliSubprocess(["validate", "--json"]);
    expect(result.exitCode).toBe(0);

    const parsed = JSON.parse(result.stdout) as {
      ok: boolean;
      findings: unknown[];
      summary: { filesUnregistered: number };
    };
    expect(parsed.ok).toBe(true);
    expect(parsed.findings).toEqual([]);
    expect(parsed.summary.filesUnregistered).toBe(0);
  });
});
