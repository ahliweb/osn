/**
 * End-to-end tests for `osn plan`: spawns the real CLI entrypoint
 * (`src/cli/index.ts`) as a subprocess, exactly as `tests/integration/
 * cli-validate.test.ts` does for `osn validate`. Complements
 * `tests/unit/cohort-plan.test.ts` (the pure `buildCohortPlan` logic) and
 * a future `tests/unit/plan-command.test.ts`-style in-process test of the
 * command's own flag handling, if one is added -- this file proves the
 * outermost shell (`src/cli/index.ts`'s real argv/stdout/stderr/exit)
 * actually works, wired end-to-end.
 */

import { describe, expect, test } from "bun:test";
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

/** Counts the Markdown table's data rows: lines starting with `| <week number> |`. */
function countWeekRows(markdown: string): number {
  return markdown.split("\n").filter((line) => /^\|\s*\d+\s*\|/.test(line)).length;
}

describe("osn plan (real subprocess)", () => {
  test("exits 0 and renders 28 rows in the default Markdown output", async () => {
    const result = await runCliSubprocess(["plan", "--start", "2026-01-05"]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("osn plan: cohort calendar");
    expect(countWeekRows(result.stdout)).toBe(28);
  });

  test("--format json parses and contains 28 weeks plus the expected top-level fields", async () => {
    const result = await runCliSubprocess(["plan", "--start", "2026-01-05", "--format", "json"]);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.weeks).toHaveLength(28);
    expect(parsed.startDate).toBe("2026-01-05");
    expect(parsed.projectedEndDate).toBe("2026-07-19");
    expect(parsed.targetStageInfo).toBeNull();
    expect(parsed.warnings).toEqual([]);
  });

  test("--json (the global flag) is equivalent to --format json", async () => {
    const result = await runCliSubprocess(["plan", "--start", "2026-01-05", "--json"]);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.weeks).toHaveLength(28);
  });

  test("--exclude and --target-stage flow through to the rendered output", async () => {
    const result = await runCliSubprocess([
      "plan",
      "--start",
      "2026-01-05",
      "--exclude",
      "2026-01-07",
      "--target-stage",
      "osn-k",
      "--format",
      "json",
    ]);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.excludedDates).toEqual(["2026-01-07"]);
    expect(parsed.projectedEndDate).toBe("2026-07-20");
    expect(parsed.targetStageInfo.intensiveWeek).toBe(25);
  });

  test("missing --start exits 2 with a usage message on stderr", async () => {
    const result = await runCliSubprocess(["plan"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--start");
    expect(result.stdout).toBe("");
  });

  test("an invalid date exits 2 naming the problem", async () => {
    const result = await runCliSubprocess(["plan", "--start", "2026-02-30"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("not a valid calendar date");
  });

  test("a non-ISO date exits 2", async () => {
    const result = await runCliSubprocess(["plan", "--start", "05/01/2026"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("ISO");
  });

  test("an unknown --target-stage exits 2 naming valid stage ids", async () => {
    const result = await runCliSubprocess([
      "plan",
      "--start",
      "2026-01-05",
      "--target-stage",
      "bogus-stage",
    ]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("osn-k");
    expect(result.stderr).toContain("osn-nasional");
  });

  test("an unknown --format exits 2", async () => {
    const result = await runCliSubprocess(["plan", "--start", "2026-01-05", "--format", "xml"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--format");
  });

  test("--help exits 0 without running the command", async () => {
    const result = await runCliSubprocess(["plan", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("osn plan");
    expect(result.stdout).toContain("--start");
  });

  test("two identical invocations produce byte-identical stdout", async () => {
    const args = [
      "plan",
      "--start",
      "2026-01-05",
      "--exclude",
      "2026-01-07,2026-03-20",
      "--target-stage",
      "osn-p",
    ];
    const first = await runCliSubprocess(args);
    const second = await runCliSubprocess(args);
    expect(first.exitCode).toBe(0);
    expect(second.exitCode).toBe(0);
    expect(first.stdout).toBe(second.stdout);
  });

  test("two identical invocations in --format json also produce byte-identical stdout", async () => {
    const args = ["plan", "--start", "2026-01-05", "--format", "json"];
    const first = await runCliSubprocess(args);
    const second = await runCliSubprocess(args);
    expect(first.stdout).toBe(second.stdout);
  });
});

describe("osn --help (real subprocess): lists plan", () => {
  test("global --help lists the plan command", async () => {
    const result = await runCliSubprocess(["--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("plan");
  });
});
