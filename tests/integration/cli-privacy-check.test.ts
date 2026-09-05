/**
 * End-to-end tests for `osn privacy-check`: spawns the real CLI entrypoint
 * (`src/cli/index.ts`) as a subprocess -- exactly as a user or CI would
 * run it (`bun run privacy-check`, i.e. `bun run src/cli/index.ts
 * privacy-check`) -- and asserts on the real process's exit code and
 * stdout/stderr. This is the complement to
 * `tests/unit/privacy-check.test.ts` (which exercises the pure scanning
 * logic in isolation): this file proves the recursive directory read
 * (`src/cli/privacy-scan-loader.ts`), the real committed `data/`
 * directory, and the CLI's flag parsing/exit codes all work together,
 * matching the pattern `tests/integration/cli-validate.test.ts` and
 * `tests/integration/cli-validate-fixtures.test.ts` already use for `osn
 * validate`.
 */

import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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

/** A sentinel value that must never appear in this command's output -- findings never carry the offending value. */
const SENTINEL_VALUE = "sentinel-integration-value-must-never-leak";

describe("osn privacy-check (real subprocess, real data/)", () => {
  test("exits 0 clean against the committed data/ corpus", async () => {
    const result = await runCliSubprocess(["privacy-check"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("OK");
    expect(result.stderr).toBe("");
  });

  test("--json emits a parseable { ok: true, findings: [] } result against the real corpus", async () => {
    const result = await runCliSubprocess(["privacy-check", "--json"]);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.findings).toEqual([]);
    expect(parsed.summary.filesScanned).toBeGreaterThan(0);
  });

  test("reaches data/samples/learning-records.sample.jsonl (recursive, .jsonl-aware) without any finding", async () => {
    const result = await runCliSubprocess(["privacy-check", "--json"]);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.summary.filesScanned).toBeGreaterThanOrEqual(20); // 19 top-level data/*.json + at least the .jsonl sample.
  });
});

describe("osn privacy-check (real subprocess, fixture directory with a planted identifier)", () => {
  test("a nested email under a subdirectory: exit 1, names the file and key, never the value", async () => {
    const dir = await mkdtemp(join(tmpdir(), "osn-privacy-check-fixture-"));
    try {
      await mkdir(join(dir, "samples"), { recursive: true });
      await writeFile(
        join(dir, "clean.json"),
        JSON.stringify({ id: "osn-k", name: "OSN-K" }, null, 2),
      );
      await writeFile(
        join(dir, "samples", "planted.jsonl"),
        `${JSON.stringify({ learnerRef: "lr_ab12cd34", metadata: { email: SENTINEL_VALUE } })}\n`,
      );

      const result = await runCliSubprocess(["privacy-check", "--data-dir", dir]);
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain("FAILED");
      expect(result.stdout).toContain("planted.jsonl");
      expect(result.stdout).toContain('key "email"');
      expect(result.stdout).not.toContain(SENTINEL_VALUE);
      expect(result.stderr).not.toContain(SENTINEL_VALUE);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("the same fixture with --json: findings carry file/path/key but never the value", async () => {
    const dir = await mkdtemp(join(tmpdir(), "osn-privacy-check-fixture-json-"));
    try {
      await writeFile(
        join(dir, "planted.json"),
        JSON.stringify({ nested: { nisn: SENTINEL_VALUE } }, null, 2),
      );

      const result = await runCliSubprocess(["privacy-check", "--data-dir", dir, "--json"]);
      expect(result.exitCode).toBe(1);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.ok).toBe(false);
      expect(parsed.findings).toEqual([{ file: "planted.json", path: "nested", key: "nisn" }]);
      expect(JSON.stringify(parsed)).not.toContain(SENTINEL_VALUE);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("a clean fixture directory (only the tolerated 'name' key) exits 0", async () => {
    const dir = await mkdtemp(join(tmpdir(), "osn-privacy-check-fixture-clean-"));
    try {
      await writeFile(join(dir, "clean.json"), JSON.stringify({ id: "x", name: "X" }, null, 2));
      const result = await runCliSubprocess(["privacy-check", "--data-dir", dir]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("OK");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("--data-dir pointing at a non-existent directory is a usage error (exit 2)", async () => {
    const missing = join(tmpdir(), "osn-privacy-check-does-not-exist", String(Date.now()));
    const result = await runCliSubprocess(["privacy-check", "--data-dir", missing]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("failed to read data directory");
  });

  test("--data-dir with no following path is a usage error (exit 2)", async () => {
    const result = await runCliSubprocess(["privacy-check", "--data-dir"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--data-dir requires a directory path argument");
  });
});

describe("osn privacy-check: usage errors", () => {
  test("an unknown flag exits 2", async () => {
    const result = await runCliSubprocess(["privacy-check", "--bogus-flag"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("unrecognised argument");
  });

  test("--help exits 0 and shows the command's own help", async () => {
    const result = await runCliSubprocess(["privacy-check", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("osn privacy-check");
  });
});
