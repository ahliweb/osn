/**
 * End-to-end tests for `osn validate`: spawns the real CLI entrypoint
 * (`src/cli/index.ts`) as a subprocess, exactly as a user or CI would run
 * it (`bun run src/cli/index.ts <args>`, the same invocation `bun run
 * validate` in `package.json` uses), and asserts on the real process's
 * exit code and stdout/stderr.
 *
 * This is the complement to `tests/unit/run-cli.test.ts` (which calls
 * `runCli` in-process for coverage and speed): this file proves the
 * outermost shell in `src/cli/index.ts` -- argv from `process.argv`,
 * output to the real streams, and the final `process.exit` call -- also
 * actually works, wired end-to-end.
 */

import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import packageJson from "../../package.json";

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

describe("osn validate (real subprocess, real corpus)", () => {
  test("exits 0 with a clean report against the committed data/ corpus", async () => {
    const result = await runCliSubprocess(["validate"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("OK");
    expect(result.stdout).toContain("0 problem(s) found");
    expect(result.stderr).toBe("");
  });

  test("--json emits a parseable { ok: true, findings: [], summary } result", async () => {
    const result = await runCliSubprocess(["validate", "--json"]);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.findings).toEqual([]);
    expect(parsed.summary.errorCount).toBe(0);
  });
});

describe("osn (real subprocess): global flags and exit codes", () => {
  test("--version prints the package version and exits 0", async () => {
    const result = await runCliSubprocess(["--version"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe(packageJson.version);
  });

  test("--help exits 0 and lists the validate command", async () => {
    const result = await runCliSubprocess(["--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("validate");
  });

  test("an unknown command exits 2 and names the valid commands on stderr", async () => {
    const result = await runCliSubprocess(["not-a-real-command"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("unknown command");
    expect(result.stderr).toContain("validate");
  });

  test("bare invocation with no subcommand exits 2", async () => {
    const result = await runCliSubprocess([]);
    expect(result.exitCode).toBe(2);
  });
});
