/**
 * Tests for `src/cli/run-cli.ts`: the `osn` dispatcher core (subcommand
 * lookup, global `--help`/`-h`, `--version`/`-V`, `--json`, exit codes).
 *
 * Calls `runCli` directly, in-process, with captured stdout/stderr writers
 * -- exactly the seam `run-cli.ts`'s docblock describes -- rather than
 * spawning the real CLI as a subprocess. This is what makes the
 * dispatcher's logic (and not just the outermost `process.exit` shell in
 * `src/cli/index.ts`) count toward the coverage gate; see
 * `tests/integration/cli-validate.test.ts` for the complementary real
 * end-to-end subprocess test.
 */

import { describe, expect, test } from "bun:test";
import packageJson from "../../package.json";
import { buildGlobalUsage, runCli } from "../../src/cli/run-cli";

interface Captured {
  readonly stdout: string;
  readonly stderr: string;
  readonly code: number;
}

async function run(argv: readonly string[]): Promise<Captured> {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const code = await runCli(argv, {
    stdout: (text) => stdoutChunks.push(text),
    stderr: (text) => stderrChunks.push(text),
    cwd: process.cwd(),
  });
  return { stdout: stdoutChunks.join(""), stderr: stderrChunks.join(""), code };
}

describe("--version / -V", () => {
  test("prints the version from package.json and exits 0", async () => {
    const result = await run(["--version"]);
    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe(packageJson.version);
  });

  test("-V is equivalent to --version", async () => {
    const result = await run(["-V"]);
    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe(packageJson.version);
  });

  test("takes precedence over an otherwise-unknown command", async () => {
    const result = await run(["bogus-command", "--version"]);
    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe(packageJson.version);
  });
});

describe("no subcommand", () => {
  test("bare invocation prints global usage to stderr and exits 2", async () => {
    const result = await run([]);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("Usage: osn <command> [options]");
    expect(result.stdout).toBe("");
  });

  test("--help with no subcommand prints global usage to stdout and exits 0", async () => {
    const result = await run(["--help"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Usage: osn <command> [options]");
    expect(result.stdout).toContain("validate");
  });

  test("-h is equivalent to --help", async () => {
    const result = await run(["-h"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Usage: osn <command> [options]");
  });
});

describe("unknown command", () => {
  test("exits 2 and names the valid commands", async () => {
    const result = await run(["bogus-command"]);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain('unknown command "bogus-command"');
    expect(result.stderr).toContain("validate");
  });
});

describe("osn <command> --help", () => {
  test("prints that command's own help (not the global usage) and exits 0", async () => {
    const result = await run(["validate", "--help"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("osn validate");
    expect(result.stdout).toContain("Exit codes:");
    expect(result.stdout).not.toContain("Usage: osn <command> [options]");
  });

  test("-h after the subcommand also routes to the command's help", async () => {
    const result = await run(["validate", "-h"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("osn validate");
  });
});

describe("buildGlobalUsage", () => {
  test("lists every registered command and the three documented exit codes", () => {
    const usage = buildGlobalUsage();
    expect(usage).toContain("validate");
    expect(usage).toContain("0   success.");
    expect(usage).toContain("1   validation failure.");
    expect(usage).toContain("2   usage error");
  });
});

describe("validate dispatch", () => {
  test("osn validate against the real corpus exits 0 with a clean report", async () => {
    const result = await run(["validate"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("OK");
  });

  test("osn --json validate emits parseable JSON with ok: true (global --json before the subcommand)", async () => {
    const result = await run(["--json", "validate"]);
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.ok).toBe(true);
  });

  test("osn validate --json emits parseable JSON with ok: true (--json after the subcommand)", async () => {
    const result = await run(["validate", "--json"]);
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.ok).toBe(true);
    expect(Array.isArray(parsed.findings)).toBe(true);
    expect(typeof parsed.summary).toBe("object");
  });
});
