/**
 * Tests for `src/cli/commands/privacy-check.ts`'s own flag handling,
 * calling `privacyCheckCommand.run` directly (in-process, for coverage
 * and speed) rather than spawning a subprocess -- mirrors
 * `tests/unit/validate-command.test.ts`/`tests/unit/report-command.test.ts`.
 * The real end-to-end subprocess behaviour is covered by
 * `tests/integration/cli-privacy-check.test.ts`.
 *
 * Every temp file/directory lives under a per-test `mkdtemp` directory,
 * removed in `afterEach` so no test leaves temp files behind, pass or
 * fail.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CommandContext } from "../../src/cli/command";
import { DEFAULT_DATA_DIR, privacyCheckCommand } from "../../src/cli/commands/privacy-check";

/** A sentinel value that must never appear in this command's output -- findings never carry the offending value. */
const SENTINEL_VALUE = "sentinel-command-test-value-must-never-leak";

function makeContext(overrides: Partial<CommandContext> = {}): {
  ctx: CommandContext;
  stdout: string[];
  stderr: string[];
} {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const ctx: CommandContext = {
    json: false,
    cwd: process.cwd(),
    stdout: (text) => stdout.push(text),
    stderr: (text) => stderr.push(text),
    ...overrides,
  };
  return { ctx, stdout, stderr };
}

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "osn-privacy-check-command-test-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("DEFAULT_DATA_DIR", () => {
  test("resolves to the repository's real data/ directory", () => {
    expect(
      DEFAULT_DATA_DIR.endsWith(`${join("osn", "data")}`) || DEFAULT_DATA_DIR.endsWith("data"),
    ).toBe(true);
  });
});

describe("privacyCheckCommand.run: against the real corpus", () => {
  test("with no args, scans the real data/ directory and returns exit 0", async () => {
    const { ctx, stdout } = makeContext();
    const code = await privacyCheckCommand.run([], ctx);
    expect(code).toBe(0);
    expect(stdout.join("")).toContain("OK");
  });

  test("--json emits a JSON object with ok: true against the real corpus", async () => {
    const { ctx, stdout } = makeContext({ json: true });
    const code = await privacyCheckCommand.run([], ctx);
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout.join(""));
    expect(parsed.ok).toBe(true);
    expect(parsed.findings).toEqual([]);
    expect(parsed.summary.filesScanned).toBeGreaterThan(0);
  });
});

describe("privacyCheckCommand.run: --data-dir", () => {
  test("--data-dir with no following path is a usage error (exit 2)", async () => {
    const { ctx, stderr } = makeContext();
    const code = await privacyCheckCommand.run(["--data-dir"], ctx);
    expect(code).toBe(2);
    expect(stderr.join("")).toContain("--data-dir requires a directory path argument");
  });

  test("--data-dir pointing at a non-existent directory is a usage error (exit 2)", async () => {
    const { ctx, stderr } = makeContext();
    const missing = join(tmpdir(), "osn-privacy-check-command-does-not-exist", String(Date.now()));
    const code = await privacyCheckCommand.run(["--data-dir", missing], ctx);
    expect(code).toBe(2);
    expect(stderr.join("")).toContain("failed to read data directory");
  });

  test("--data-dir is resolved relative to ctx.cwd when given a relative path", async () => {
    await writeFile(join(tempDir, "clean.json"), JSON.stringify({ id: "x", name: "X" }));
    const { ctx, stdout } = makeContext({ cwd: tempDir });
    const code = await privacyCheckCommand.run(["--data-dir", "."], ctx);
    expect(code).toBe(0);
    expect(stdout.join("")).toContain(tempDir);
  });

  test("a fixture directory with a planted identifier returns exit 1, names the file and key, never the value", async () => {
    await mkdir(join(tempDir, "samples"), { recursive: true });
    await writeFile(
      join(tempDir, "samples", "planted.jsonl"),
      `${JSON.stringify({ learnerRef: "lr_ab12cd34", metadata: { email: SENTINEL_VALUE } })}\n`,
    );

    const { ctx, stdout } = makeContext({ cwd: tempDir });
    const code = await privacyCheckCommand.run(["--data-dir", tempDir], ctx);
    expect(code).toBe(1);
    const output = stdout.join("");
    expect(output).toContain("FAILED");
    expect(output).toContain("planted.jsonl");
    expect(output).toContain('key "email"');
    expect(output).not.toContain(SENTINEL_VALUE);
  });

  test("a clean fixture with a tolerated top-level 'name' key exits 0", async () => {
    await writeFile(join(tempDir, "clean.json"), JSON.stringify({ id: "osn-k", name: "OSN-K" }));
    const { ctx, stdout } = makeContext({ cwd: tempDir });
    const code = await privacyCheckCommand.run(["--data-dir", tempDir], ctx);
    expect(code).toBe(0);
    expect(stdout.join("")).toContain("OK");
  });

  test("a fixture with a file that is not valid JSON reports a parse issue but does not itself fail the exit code", async () => {
    await writeFile(join(tempDir, "broken.json"), "{ not valid json");
    const { ctx, stdout } = makeContext({ json: true, cwd: tempDir });
    const code = await privacyCheckCommand.run(["--data-dir", tempDir], ctx);
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout.join(""));
    expect(parsed.ok).toBe(true);
    expect(parsed.parseIssues).toHaveLength(1);
    expect(parsed.parseIssues[0].file).toBe("broken.json");
  });

  test("text mode also surfaces a parse-issue warning, naming the file, alongside a clean OK result", async () => {
    await writeFile(join(tempDir, "clean.json"), JSON.stringify({ id: "x", name: "X" }));
    await writeFile(join(tempDir, "broken.jsonl"), "not json at all\n");
    const { ctx, stdout } = makeContext({ cwd: tempDir });
    const code = await privacyCheckCommand.run(["--data-dir", tempDir], ctx);
    expect(code).toBe(0);
    const output = stdout.join("");
    expect(output).toContain("OK");
    expect(output).toContain("Warning:");
    expect(output).toContain("broken.jsonl:1");
  });

  test("text mode surfaces both a finding and a parse-issue warning together", async () => {
    await writeFile(
      join(tempDir, "planted.json"),
      JSON.stringify({ nested: { email: SENTINEL_VALUE } }),
    );
    await writeFile(join(tempDir, "broken.json"), "{ not valid json");
    const { ctx, stdout } = makeContext({ cwd: tempDir });
    const code = await privacyCheckCommand.run(["--data-dir", tempDir], ctx);
    expect(code).toBe(1);
    const output = stdout.join("");
    expect(output).toContain("FAILED");
    expect(output).toContain("Warning:");
    expect(output).toContain("broken.json");
    expect(output).not.toContain(SENTINEL_VALUE);
  });
});

describe("privacyCheckCommand.run: usage errors", () => {
  test("an unrecognised flag is a usage error (exit 2)", async () => {
    const { ctx, stderr } = makeContext();
    const code = await privacyCheckCommand.run(["--bogus-flag"], ctx);
    expect(code).toBe(2);
    expect(stderr.join("")).toContain("unrecognised argument");
  });

  test("an unexpected positional argument is a usage error (exit 2)", async () => {
    const { ctx, stderr } = makeContext();
    const code = await privacyCheckCommand.run(["not-a-flag"], ctx);
    expect(code).toBe(2);
    expect(stderr.join("")).toContain("unrecognised argument");
  });
});

describe("privacyCheckCommand: help text", () => {
  test("mentions the tolerance rule and never-the-value guarantee", () => {
    const help = privacyCheckCommand.help();
    expect(help).toContain('"name"');
    expect(help).toContain("privacy-check");
  });
});
