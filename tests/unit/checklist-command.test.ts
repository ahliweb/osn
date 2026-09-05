/**
 * Tests for `src/cli/commands/checklist.ts`'s own flag handling and
 * `--out`/`--force` file writing, calling `checklistCommand.run` directly
 * (in-process, for coverage and speed) rather than spawning a subprocess.
 * Mirrors `tests/unit/plan-command.test.ts`/`tests/unit/render-
 * command.test.ts`/`tests/unit/report-command.test.ts`. The real
 * end-to-end subprocess behaviour is covered by `tests/integration/
 * cli-checklist.test.ts`.
 *
 * Every temp file/directory lives under a per-test `mkdtemp` directory,
 * removed in `afterEach` so no test leaves temp files behind, pass or fail.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CommandContext } from "../../src/cli/command";
import { checklistCommand } from "../../src/cli/commands/checklist";

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
  tempDir = await mkdtemp(join(tmpdir(), "osn-checklist-command-test-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("checklistCommand.help", () => {
  test("mentions --format, --out, --force, and exit codes", () => {
    const help = checklistCommand.help();
    expect(help).toContain("osn checklist");
    expect(help).toContain("--format");
    expect(help).toContain("--out");
    expect(help).toContain("--force");
    expect(help).toContain("Exit codes");
  });
});

describe("checklistCommand.run: default (Markdown to stdout)", () => {
  test("exits 0 and writes non-empty Markdown to stdout, nothing to stderr", async () => {
    const { ctx, stdout, stderr } = makeContext();
    const code = await checklistCommand.run([], ctx);
    expect(code).toBe(0);
    expect(stderr).toEqual([]);
    const output = stdout.join("");
    expect(output).toContain("# osn checklist");
    expect(output.endsWith("\n")).toBe(true);
  });
});

describe("checklistCommand.run: --format", () => {
  test("--format md behaves like the default", async () => {
    const { ctx, stdout } = makeContext();
    const code = await checklistCommand.run(["--format", "md"], ctx);
    expect(code).toBe(0);
    expect(stdout.join("")).toContain("# osn checklist");
  });

  test("--format json emits parseable JSON", async () => {
    const { ctx, stdout } = makeContext();
    const code = await checklistCommand.run(["--format", "json"], ctx);
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout.join("")) as { readinessItems: unknown[] };
    expect(parsed.readinessItems).toHaveLength(8);
  });

  test("the global --json context flag is equivalent to --format json", async () => {
    const { ctx, stdout } = makeContext({ json: true });
    const code = await checklistCommand.run([], ctx);
    expect(code).toBe(0);
    expect(() => JSON.parse(stdout.join(""))).not.toThrow();
  });

  test("an explicit --format wins over the global --json flag", async () => {
    const { ctx, stdout } = makeContext({ json: true });
    const code = await checklistCommand.run(["--format", "md"], ctx);
    expect(code).toBe(0);
    expect(stdout.join("")).toContain("# osn checklist");
  });

  test("an unknown --format exits 2 naming the received value", async () => {
    const { ctx, stderr } = makeContext();
    const code = await checklistCommand.run(["--format", "bogus"], ctx);
    expect(code).toBe(2);
    expect(stderr.join("")).toContain("--format");
    expect(stderr.join("")).toContain("bogus");
  });

  test("--format with no following value is treated as an unknown format, exits 2", async () => {
    const { ctx, stderr } = makeContext();
    const code = await checklistCommand.run(["--format"], ctx);
    expect(code).toBe(2);
    expect(stderr.join("")).toContain("--format");
  });
});

describe("checklistCommand.run: --out / --force", () => {
  test("--out writes the file and prints a confirmation, no stdout content dump", async () => {
    const outPath = join(tempDir, "checklist.md");
    const { ctx, stdout } = makeContext();
    const code = await checklistCommand.run(["--out", outPath], ctx);
    expect(code).toBe(0);
    expect(stdout.join("")).toContain(outPath);

    const written = await readFile(outPath, "utf-8");
    expect(written).toContain("# osn checklist");
  });

  test("--out with --format json writes JSON to the file", async () => {
    const outPath = join(tempDir, "checklist.json");
    const { ctx } = makeContext();
    const code = await checklistCommand.run(["--format", "json", "--out", outPath], ctx);
    expect(code).toBe(0);

    const written = await readFile(outPath, "utf-8");
    expect(() => JSON.parse(written)).not.toThrow();
  });

  test("--out without --force refuses to overwrite an existing file, exits 2", async () => {
    const outPath = join(tempDir, "checklist.md");
    await writeFile(outPath, "pre-existing content", "utf-8");

    const { ctx, stderr } = makeContext();
    const code = await checklistCommand.run(["--out", outPath], ctx);
    expect(code).toBe(2);
    expect(stderr.join("")).toContain("already exists");
    expect(stderr.join("")).toContain("--force");

    const unchanged = await readFile(outPath, "utf-8");
    expect(unchanged).toBe("pre-existing content");
  });

  test("--out with --force overwrites an existing file", async () => {
    const outPath = join(tempDir, "checklist.md");
    await writeFile(outPath, "pre-existing content", "utf-8");

    const { ctx } = makeContext();
    const code = await checklistCommand.run(["--out", outPath, "--force"], ctx);
    expect(code).toBe(0);

    const written = await readFile(outPath, "utf-8");
    expect(written).toContain("# osn checklist");
  });

  test("--out pointing at an unwritable directory reports a write error, exits 2", async () => {
    const outPath = join(tempDir, "does-not-exist", "checklist.md");
    const { ctx, stderr } = makeContext();
    const code = await checklistCommand.run(["--out", outPath], ctx);
    expect(code).toBe(2);
    expect(stderr.join("")).toContain("failed to write");
  });
});
