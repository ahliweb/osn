/**
 * End-to-end tests for `osn render`: spawns the real CLI entrypoint
 * (`src/cli/index.ts`) as a subprocess, exactly as `tests/integration/
 * cli-plan.test.ts` does for `osn plan`. Complements `tests/unit/
 * render-weekly.test.ts`, `render-checkpoint.test.ts` and `render-sop.
 * test.ts` (the pure rendering logic) and a future in-process
 * `render-command.test.ts`-style test, if one is added -- this file
 * proves the outermost shell (`src/cli/index.ts`'s real argv/stdout/
 * stderr/exit, plus the real `--out`/`--force` filesystem behaviour)
 * actually works, wired end-to-end.
 *
 * Every `--out` target lives under a per-test `mkdtemp` directory, removed
 * in `afterEach` (`rm(dir, { recursive: true, force: true })`) so no test
 * leaves temp files behind, pass or fail.
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
  tempDir = await mkdtemp(join(tmpdir(), "osn-render-test-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("osn render weekly (real subprocess)", () => {
  test("exits 0 and prints non-empty Markdown to stdout", async () => {
    const result = await runCliSubprocess(["render", "weekly", "--week", "1"]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout.length).toBeGreaterThan(0);
    expect(result.stdout).toContain("# Week 1:");
  });

  test("--out writes the file, and its content equals the default stdout output", async () => {
    const stdoutResult = await runCliSubprocess(["render", "weekly", "--week", "1"]);
    expect(stdoutResult.exitCode).toBe(0);

    const outPath = join(tempDir, "week-1.md");
    const outResult = await runCliSubprocess(["render", "weekly", "--week", "1", "--out", outPath]);
    expect(outResult.exitCode).toBe(0);
    expect(outResult.stderr).toBe("");

    const written = await readFile(outPath, "utf-8");
    expect(written).toBe(stdoutResult.stdout);
  });

  test("out-of-range --week exits 2 and writes nothing", async () => {
    const outPath = join(tempDir, "should-not-exist.md");
    const result = await runCliSubprocess(["render", "weekly", "--week", "0", "--out", outPath]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Valid range: 1-28");
    await expect(readFile(outPath, "utf-8")).rejects.toThrow();
  });

  test("missing --week exits 2", async () => {
    const result = await runCliSubprocess(["render", "weekly"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--week");
  });
});

describe("osn render checkpoint (real subprocess)", () => {
  test("exits 0 and prints non-empty Markdown to stdout", async () => {
    const result = await runCliSubprocess(["render", "checkpoint", "--number", "1"]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout.length).toBeGreaterThan(0);
    expect(result.stdout).toContain("# Checkpoint 1");
  });

  test("--out writes the file, and its content equals the default stdout output", async () => {
    const stdoutResult = await runCliSubprocess(["render", "checkpoint", "--number", "7"]);
    expect(stdoutResult.exitCode).toBe(0);

    const outPath = join(tempDir, "checkpoint-7.md");
    const outResult = await runCliSubprocess([
      "render",
      "checkpoint",
      "--number",
      "7",
      "--out",
      outPath,
    ]);
    expect(outResult.exitCode).toBe(0);

    const written = await readFile(outPath, "utf-8");
    expect(written).toBe(stdoutResult.stdout);
  });

  test("out-of-range --number exits 2", async () => {
    const result = await runCliSubprocess(["render", "checkpoint", "--number", "8"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Valid range: 1-7");
  });

  test("missing --number exits 2", async () => {
    const result = await runCliSubprocess(["render", "checkpoint"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--number");
  });
});

describe("osn render sop (real subprocess)", () => {
  test("exits 0 and prints non-empty Markdown to stdout", async () => {
    const result = await runCliSubprocess(["render", "sop"]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout.length).toBeGreaterThan(0);
    expect(result.stdout).toContain("# Mentor SOP card");
  });

  test("--out writes the file, and its content equals the default stdout output", async () => {
    const stdoutResult = await runCliSubprocess(["render", "sop"]);
    expect(stdoutResult.exitCode).toBe(0);

    const outPath = join(tempDir, "sop.md");
    const outResult = await runCliSubprocess(["render", "sop", "--out", outPath]);
    expect(outResult.exitCode).toBe(0);

    const written = await readFile(outPath, "utf-8");
    expect(written).toBe(stdoutResult.stdout);
  });
});

describe("osn render --out overwrite protection (real subprocess)", () => {
  test("overwriting an existing --out file without --force exits 2 and does not modify it", async () => {
    const outPath = join(tempDir, "sop.md");

    const first = await runCliSubprocess(["render", "sop", "--out", outPath]);
    expect(first.exitCode).toBe(0);
    const originalContent = await readFile(outPath, "utf-8");

    const second = await runCliSubprocess(["render", "weekly", "--week", "2", "--out", outPath]);
    expect(second.exitCode).toBe(2);
    expect(second.stderr).toContain("already exists");
    expect(second.stderr).toContain("--force");

    const unchangedContent = await readFile(outPath, "utf-8");
    expect(unchangedContent).toBe(originalContent);
  });

  test("--force overwrites an existing --out file", async () => {
    const outPath = join(tempDir, "sop.md");

    const first = await runCliSubprocess(["render", "sop", "--out", outPath]);
    expect(first.exitCode).toBe(0);

    const second = await runCliSubprocess([
      "render",
      "weekly",
      "--week",
      "2",
      "--out",
      outPath,
      "--force",
    ]);
    expect(second.exitCode).toBe(0);

    const finalContent = await readFile(outPath, "utf-8");
    expect(finalContent).toContain("# Week 2:");
    expect(finalContent).not.toContain("# Mentor SOP card");
  });
});

describe("osn render: usage errors (real subprocess)", () => {
  test("no subcommand exits 2 naming valid subcommands", async () => {
    const result = await runCliSubprocess(["render"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("weekly");
    expect(result.stderr).toContain("checkpoint");
    expect(result.stderr).toContain("sop");
  });

  test("an unknown subcommand exits 2", async () => {
    const result = await runCliSubprocess(["render", "bogus"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("bogus");
  });

  test("--help exits 0 without running the command", async () => {
    const result = await runCliSubprocess(["render", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("osn render");
    expect(result.stdout).toContain("--week");
  });
});

describe("osn --help (real subprocess): lists render", () => {
  test("global --help lists the render command", async () => {
    const result = await runCliSubprocess(["--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("render");
  });
});
