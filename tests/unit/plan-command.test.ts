/**
 * Tests for `src/cli/commands/plan.ts`'s own flag handling, calling
 * `planCommand.run` directly (in-process, for coverage and speed) rather
 * than spawning a subprocess. Mirrors `tests/unit/validate-command.test.ts`.
 * The real end-to-end subprocess behaviour is covered by
 * `tests/integration/cli-plan.test.ts`.
 */

import { describe, expect, test } from "bun:test";
import type { CommandContext } from "../../src/cli/command";
import { planCommand } from "../../src/cli/commands/plan";

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

describe("planCommand.run", () => {
  test("with --start, renders a Markdown calendar and returns exit 0", async () => {
    const { ctx, stdout } = makeContext();
    const code = await planCommand.run(["--start", "2026-01-05"], ctx);
    expect(code).toBe(0);
    expect(stdout.join("")).toContain("osn plan: cohort calendar");
    expect(stdout.join("")).toContain("Orientasi CP & C++ dasar");
  });

  test("with no args at all, exits 2 naming --start as required", async () => {
    const { ctx, stderr } = makeContext();
    const code = await planCommand.run([], ctx);
    expect(code).toBe(2);
    expect(stderr.join("")).toContain("--start");
  });

  test("--start with no following value is a usage error", async () => {
    const { ctx, stderr } = makeContext();
    const code = await planCommand.run(["--start"], ctx);
    expect(code).toBe(2);
    expect(stderr.join("")).toContain("requires a date argument");
  });

  test("--exclude with no following value is a usage error", async () => {
    const { ctx, stderr } = makeContext();
    const code = await planCommand.run(["--start", "2026-01-05", "--exclude"], ctx);
    expect(code).toBe(2);
    expect(stderr.join("")).toContain("--exclude requires");
  });

  test("--target-stage with no following value is a usage error", async () => {
    const { ctx, stderr } = makeContext();
    const code = await planCommand.run(["--start", "2026-01-05", "--target-stage"], ctx);
    expect(code).toBe(2);
    expect(stderr.join("")).toContain("--target-stage requires");
  });

  test("--format with no following value is a usage error", async () => {
    const { ctx, stderr } = makeContext();
    const code = await planCommand.run(["--start", "2026-01-05", "--format"], ctx);
    expect(code).toBe(2);
    expect(stderr.join("")).toContain("--format");
  });

  test("--format json emits parseable JSON", async () => {
    const { ctx, stdout } = makeContext();
    const code = await planCommand.run(["--start", "2026-01-05", "--format", "json"], ctx);
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout.join(""));
    expect(parsed.weeks).toHaveLength(28);
  });

  test("ctx.json true (the global --json flag) is equivalent to --format json", async () => {
    const { ctx, stdout } = makeContext({ json: true });
    const code = await planCommand.run(["--start", "2026-01-05"], ctx);
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout.join(""));
    expect(parsed.weeks).toHaveLength(28);
  });

  test("an explicit --format md overrides ctx.json true", async () => {
    const { ctx, stdout } = makeContext({ json: true });
    const code = await planCommand.run(["--start", "2026-01-05", "--format", "md"], ctx);
    expect(code).toBe(0);
    expect(stdout.join("")).toContain("osn plan: cohort calendar");
  });

  test("--exclude and --target-stage are parsed and passed through", async () => {
    const { ctx, stdout } = makeContext();
    const code = await planCommand.run(
      [
        "--start",
        "2026-01-05",
        "--exclude",
        "2026-01-07, 2026-03-20",
        "--target-stage",
        "osn-k",
        "--format",
        "json",
      ],
      ctx,
    );
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout.join(""));
    expect(parsed.excludedDates).toEqual(["2026-01-07", "2026-03-20"]);
    expect(parsed.targetStageInfo.stageId).toBe("osn-k");
  });

  test("a domain validation error (invalid date) is reported and returns exit 2, not a thrown exception", async () => {
    const { ctx, stderr } = makeContext();
    const code = await planCommand.run(["--start", "not-a-date"], ctx);
    expect(code).toBe(2);
    expect(stderr.join("")).toContain("osn plan:");
  });

  test("help() returns the command's own help text mentioning every flag", () => {
    const help = planCommand.help();
    expect(help).toContain("--start");
    expect(help).toContain("--exclude");
    expect(help).toContain("--target-stage");
    expect(help).toContain("--format");
  });

  test("summary and name are set for the registry/help listing", () => {
    expect(planCommand.name).toBe("plan");
    expect(planCommand.summary.length).toBeGreaterThan(0);
  });
});
