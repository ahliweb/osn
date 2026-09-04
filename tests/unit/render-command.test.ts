/**
 * Tests for `src/cli/commands/render.ts`'s own subcommand/flag handling
 * and `--out`/`--force` file writing, calling `renderCommand.run` directly
 * (in-process, for coverage and speed) rather than spawning a subprocess.
 * Mirrors `tests/unit/plan-command.test.ts`. The real end-to-end
 * subprocess behaviour is covered by `tests/integration/cli-render.test.ts`.
 *
 * Every `--out` target lives under a per-test `mkdtemp` directory, removed
 * in `afterEach` so no test leaves temp files behind, pass or fail.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CommandContext } from "../../src/cli/command";
import { renderCommand } from "../../src/cli/commands/render";

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
  tempDir = await mkdtemp(join(tmpdir(), "osn-render-command-test-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("renderCommand.run: subcommand dispatch", () => {
  test("no args at all exits 2 naming the valid subcommands", async () => {
    const { ctx, stderr } = makeContext();
    const code = await renderCommand.run([], ctx);
    expect(code).toBe(2);
    expect(stderr.join("")).toContain("a subcommand is required");
    expect(stderr.join("")).toContain("weekly, checkpoint, sop");
  });

  test("an unknown subcommand exits 2 naming it", async () => {
    const { ctx, stderr } = makeContext();
    const code = await renderCommand.run(["bogus"], ctx);
    expect(code).toBe(2);
    expect(stderr.join("")).toContain('unknown subcommand "bogus"');
  });
});

describe("renderCommand.run: weekly", () => {
  test("with --week, renders a plan to stdout and returns exit 0", async () => {
    const { ctx, stdout } = makeContext();
    const code = await renderCommand.run(["weekly", "--week", "1"], ctx);
    expect(code).toBe(0);
    expect(stdout.join("")).toContain("# Week 1: Orientasi CP & C++ dasar");
  });

  test("missing --week exits 2", async () => {
    const { ctx, stderr } = makeContext();
    const code = await renderCommand.run(["weekly"], ctx);
    expect(code).toBe(2);
    expect(stderr.join("")).toContain("--week <1-28> is required");
  });

  test("a non-integer --week exits 2", async () => {
    const { ctx, stderr } = makeContext();
    const code = await renderCommand.run(["weekly", "--week", "abc"], ctx);
    expect(code).toBe(2);
    expect(stderr.join("")).toContain("--week must be an integer");
  });

  test("an out-of-range --week is caught and reported as exit 2 (not thrown)", async () => {
    const { ctx, stderr } = makeContext();
    const code = await renderCommand.run(["weekly", "--week", "0"], ctx);
    expect(code).toBe(2);
    expect(stderr.join("")).toContain("Valid range: 1-28");
  });

  test("--week 29 (also out of range) exits 2", async () => {
    const { ctx, stderr } = makeContext();
    const code = await renderCommand.run(["weekly", "--week", "29"], ctx);
    expect(code).toBe(2);
    expect(stderr.join("")).toContain("Valid range: 1-28");
  });
});

describe("renderCommand.run: checkpoint", () => {
  test("with --number, renders a sheet to stdout and returns exit 0", async () => {
    const { ctx, stdout } = makeContext();
    const code = await renderCommand.run(["checkpoint", "--number", "1"], ctx);
    expect(code).toBe(0);
    expect(stdout.join("")).toContain("# Checkpoint 1");
  });

  test("missing --number exits 2", async () => {
    const { ctx, stderr } = makeContext();
    const code = await renderCommand.run(["checkpoint"], ctx);
    expect(code).toBe(2);
    expect(stderr.join("")).toContain("--number <1-7> is required");
  });

  test("a non-integer --number exits 2", async () => {
    const { ctx, stderr } = makeContext();
    const code = await renderCommand.run(["checkpoint", "--number", "abc"], ctx);
    expect(code).toBe(2);
    expect(stderr.join("")).toContain("--number must be an integer");
  });

  test("an out-of-range --number is caught and reported as exit 2 (not thrown)", async () => {
    const { ctx, stderr } = makeContext();
    const code = await renderCommand.run(["checkpoint", "--number", "0"], ctx);
    expect(code).toBe(2);
    expect(stderr.join("")).toContain("Valid range: 1-7");
  });

  test("--number 8 (also out of range) exits 2", async () => {
    const { ctx, stderr } = makeContext();
    const code = await renderCommand.run(["checkpoint", "--number", "8"], ctx);
    expect(code).toBe(2);
    expect(stderr.join("")).toContain("Valid range: 1-7");
  });
});

describe("renderCommand.run: sop", () => {
  test("renders the SOP card to stdout and returns exit 0", async () => {
    const { ctx, stdout } = makeContext();
    const code = await renderCommand.run(["sop"], ctx);
    expect(code).toBe(0);
    expect(stdout.join("")).toContain("# Mentor SOP card");
  });
});

describe("renderCommand.run: --out / --force", () => {
  test("--out writes the file and prints a confirmation instead of the content", async () => {
    const outPath = join(tempDir, "sop.md");
    const { ctx, stdout } = makeContext();
    const code = await renderCommand.run(["sop", "--out", outPath], ctx);
    expect(code).toBe(0);
    expect(stdout.join("")).toContain(`wrote ${outPath}`);

    const written = await readFile(outPath, "utf-8");
    expect(written).toContain("# Mentor SOP card");
  });

  test("--out is resolved relative to ctx.cwd", async () => {
    const outPath = join(tempDir, "relative-sop.md");
    const { ctx } = makeContext({ cwd: tempDir });
    const code = await renderCommand.run(["sop", "--out", "relative-sop.md"], ctx);
    expect(code).toBe(0);
    const written = await readFile(outPath, "utf-8");
    expect(written).toContain("# Mentor SOP card");
  });

  test("re-running --out without --force on an existing file exits 2 and leaves it untouched", async () => {
    const outPath = join(tempDir, "sop.md");
    const first = makeContext();
    expect(await renderCommand.run(["sop", "--out", outPath], first.ctx)).toBe(0);
    const originalContent = await readFile(outPath, "utf-8");

    const second = makeContext();
    const code = await renderCommand.run(["weekly", "--week", "2", "--out", outPath], second.ctx);
    expect(code).toBe(2);
    expect(second.stderr.join("")).toContain("already exists");
    expect(second.stderr.join("")).toContain("--force");

    const unchangedContent = await readFile(outPath, "utf-8");
    expect(unchangedContent).toBe(originalContent);
  });

  test("--force overwrites an existing --out file", async () => {
    const outPath = join(tempDir, "sop.md");
    const first = makeContext();
    expect(await renderCommand.run(["sop", "--out", outPath], first.ctx)).toBe(0);

    const second = makeContext();
    const code = await renderCommand.run(
      ["weekly", "--week", "2", "--out", outPath, "--force"],
      second.ctx,
    );
    expect(code).toBe(0);
    const finalContent = await readFile(outPath, "utf-8");
    expect(finalContent).toContain("# Week 2:");
  });

  test("a filesystem error (unwritable parent directory) is reported as exit 2, not thrown", async () => {
    const outPath = join(tempDir, "no-such-subdir", "sop.md");
    const { ctx, stderr } = makeContext();
    const code = await renderCommand.run(["sop", "--out", outPath], ctx);
    expect(code).toBe(2);
    expect(stderr.join("")).toContain("failed to write");
  });
});

describe("renderCommand: help/summary metadata", () => {
  test("help() mentions every subcommand and flag", () => {
    const help = renderCommand.help();
    expect(help).toContain("osn render");
    expect(help).toContain("weekly");
    expect(help).toContain("checkpoint");
    expect(help).toContain("sop");
    expect(help).toContain("--week");
    expect(help).toContain("--number");
    expect(help).toContain("--out");
    expect(help).toContain("--force");
  });

  test("name and summary are set for the registry/help listing", () => {
    expect(renderCommand.name).toBe("render");
    expect(renderCommand.summary.length).toBeGreaterThan(0);
  });
});
