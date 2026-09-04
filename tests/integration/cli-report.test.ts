/**
 * End-to-end tests for `osn report`: spawns the real CLI entrypoint
 * (`src/cli/index.ts`) as a subprocess, exactly as `tests/integration/
 * cli-render.test.ts` does for `osn render`. Complements `tests/unit/
 * report.test.ts` (the pure `buildKpiReport` logic) -- this file proves
 * the outermost shell (real argv/stdout/stderr/exit, the real
 * `--records` file-reading, the privacy gate, and the real
 * `--out`/`--force` filesystem behaviour) actually works, wired
 * end-to-end.
 *
 * Every temp file/directory lives under a per-test `mkdtemp` directory,
 * removed in `afterEach` (`rm(dir, { recursive: true, force: true })`) so
 * no test leaves temp files behind, pass or fail.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listKpiDefinitions } from "../../src/domain/kpi";

const REPO_ROOT = join(import.meta.dir, "..", "..");
const CLI_ENTRYPOINT = join(REPO_ROOT, "src", "cli", "index.ts");
const SAMPLE_PATH = join(REPO_ROOT, "data", "samples", "learning-records.sample.jsonl");

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

const BASE_RECORD = {
  learnerRef: "lr_zzzz9999",
  problemId: "demo-problem-999",
  attemptNo: 1,
  verdict: "AC",
  durationSeconds: 100,
  hintLevelUsed: null,
  usedEditorial: false,
  errorTaxonomy: null,
  status: "A",
  resolveStatus: "not-required",
  recordedAt: "2026-09-04T10:00:00Z",
};

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "osn-report-test-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("osn report (real subprocess): the committed sample dataset", () => {
  test("exits 0 and prints all seven §6.3 KPI metric names", async () => {
    const result = await runCliSubprocess(["report", "--records", SAMPLE_PATH]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout.length).toBeGreaterThan(0);

    for (const definition of listKpiDefinitions()) {
      expect(result.stdout).toContain(definition.name);
    }
  });

  test("--format json parses and carries the overall section plus postmortem/scheduledResolves", async () => {
    const result = await runCliSubprocess(["report", "--records", SAMPLE_PATH, "--format", "json"]);
    expect(result.exitCode).toBe(0);

    const parsed = JSON.parse(result.stdout);
    expect(parsed.groupBy).toBe("none");
    expect(parsed.recordCount).toBeGreaterThan(0);
    expect(parsed.overall.metrics.statusDistribution.kind).toBe("value");
    expect(parsed.postmortem).toBeDefined();
    expect(Array.isArray(parsed.scheduledResolves)).toBe(true);
    expect(parsed.scheduledResolves.length).toBeGreaterThan(0);
  });

  test("--json (the global flag) is equivalent to --format json", async () => {
    const result = await runCliSubprocess(["report", "--records", SAMPLE_PATH, "--json"]);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.recordCount).toBeGreaterThan(0);
  });
});

describe("osn report (real subprocess): privacy gate", () => {
  test("a record with an email field is refused: non-zero exit, names the field path, never the value", async () => {
    const secretValue = "definitely-a-real-address@example.invalid";
    const badPath = join(tempDir, "bad-email.jsonl");
    const lines = [
      JSON.stringify(BASE_RECORD),
      JSON.stringify({ ...BASE_RECORD, attemptNo: 2, email: secretValue }),
    ];
    await writeFile(badPath, `${lines.join("\n")}\n`, "utf-8");

    const result = await runCliSubprocess(["report", "--records", badPath]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("privacy refusal");
    expect(result.stderr).toContain("email");
    expect(result.stderr).toContain("index 1");
    expect(result.stderr).not.toContain(secretValue);
    expect(result.stdout).not.toContain(secretValue);
  });

  test("a nested identifier-shaped field is also refused", async () => {
    const badPath = join(tempDir, "bad-nested.jsonl");
    await writeFile(
      badPath,
      `${JSON.stringify({ ...BASE_RECORD, metadata: { studentName: "nope" } })}\n`,
      "utf-8",
    );

    const result = await runCliSubprocess(["report", "--records", badPath]);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("privacy refusal");
  });
});

describe("osn report (real subprocess): invalid records", () => {
  test("two invalid records report both indices", async () => {
    const badPath = join(tempDir, "two-invalid.jsonl");
    const lines = [
      JSON.stringify(BASE_RECORD),
      JSON.stringify({ ...BASE_RECORD, attemptNo: 2, verdict: "NOT-A-VERDICT" }),
      JSON.stringify({ ...BASE_RECORD, attemptNo: 3 }),
      JSON.stringify({ ...BASE_RECORD, attemptNo: -1 }),
    ];
    await writeFile(badPath, `${lines.join("\n")}\n`, "utf-8");

    const result = await runCliSubprocess(["report", "--records", badPath]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("index 1");
    expect(result.stderr).toContain("index 3");
    expect(result.stderr).not.toContain("index 0");
    expect(result.stderr).not.toContain("index 2");
  });

  test("a malformed JSON line is also reported by index", async () => {
    const badPath = join(tempDir, "malformed-line.jsonl");
    const lines = [JSON.stringify(BASE_RECORD), "{not valid json", JSON.stringify(BASE_RECORD)];
    await writeFile(badPath, `${lines.join("\n")}\n`, "utf-8");

    const result = await runCliSubprocess(["report", "--records", badPath]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("index 1");
  });
});

describe("osn report (real subprocess): .json array input", () => {
  test("a .json array file is accepted", async () => {
    const jsonPath = join(tempDir, "records.json");
    await writeFile(
      jsonPath,
      JSON.stringify([BASE_RECORD, { ...BASE_RECORD, attemptNo: 2 }]),
      "utf-8",
    );

    const result = await runCliSubprocess(["report", "--records", jsonPath]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.length).toBeGreaterThan(0);
  });
});

describe("osn report (real subprocess): usage errors", () => {
  test("missing --records exits 2", async () => {
    const result = await runCliSubprocess(["report"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--records");
  });

  test("an unreadable path exits 2", async () => {
    const result = await runCliSubprocess([
      "report",
      "--records",
      join(tempDir, "does-not-exist.jsonl"),
    ]);
    expect(result.exitCode).toBe(2);
  });

  test("an unknown --by exits 2", async () => {
    const result = await runCliSubprocess(["report", "--records", SAMPLE_PATH, "--by", "bogus"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--by");
  });

  test("--by topic without a resolver exits 2 with an actionable message", async () => {
    const result = await runCliSubprocess(["report", "--records", SAMPLE_PATH, "--by", "topic"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("resolveTopic");
  });

  test("an unknown --format exits 2", async () => {
    const result = await runCliSubprocess(["report", "--records", SAMPLE_PATH, "--format", "xml"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--format");
  });

  test("--help exits 0 without running the command", async () => {
    const result = await runCliSubprocess(["report", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("osn report");
    expect(result.stdout).toContain("--records");
  });
});

describe("osn report (real subprocess): --out / --force", () => {
  test("--out writes the file, and its content equals the default stdout output", async () => {
    const stdoutResult = await runCliSubprocess(["report", "--records", SAMPLE_PATH]);
    expect(stdoutResult.exitCode).toBe(0);

    const outPath = join(tempDir, "report.md");
    const outResult = await runCliSubprocess([
      "report",
      "--records",
      SAMPLE_PATH,
      "--out",
      outPath,
    ]);
    expect(outResult.exitCode).toBe(0);
    expect(outResult.stderr).toBe("");

    const written = await readFile(outPath, "utf-8");
    expect(written).toBe(stdoutResult.stdout);
  });

  test("overwriting an existing --out file without --force exits 2 and does not modify it", async () => {
    const outPath = join(tempDir, "report.md");

    const first = await runCliSubprocess(["report", "--records", SAMPLE_PATH, "--out", outPath]);
    expect(first.exitCode).toBe(0);
    const originalContent = await readFile(outPath, "utf-8");

    const second = await runCliSubprocess([
      "report",
      "--records",
      SAMPLE_PATH,
      "--format",
      "json",
      "--out",
      outPath,
    ]);
    expect(second.exitCode).toBe(2);
    expect(second.stderr).toContain("already exists");
    expect(second.stderr).toContain("--force");

    const unchangedContent = await readFile(outPath, "utf-8");
    expect(unchangedContent).toBe(originalContent);
  });

  test("--force overwrites an existing --out file", async () => {
    const outPath = join(tempDir, "report.md");

    const first = await runCliSubprocess(["report", "--records", SAMPLE_PATH, "--out", outPath]);
    expect(first.exitCode).toBe(0);

    const second = await runCliSubprocess([
      "report",
      "--records",
      SAMPLE_PATH,
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
});

describe("osn --help (real subprocess): lists report", () => {
  test("global --help lists the report command", async () => {
    const result = await runCliSubprocess(["--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("report");
  });
});
