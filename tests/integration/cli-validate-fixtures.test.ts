/**
 * End-to-end fixture tests for `osn validate`: copies the real `data/`
 * corpus into a temp directory, deliberately corrupts it, and runs the
 * real CLI (a subprocess, `bun run src/cli/index.ts validate --data-dir
 * <fixture>`) against that copy -- proving the *actual shipped binary*
 * reports a corrupted corpus with exit code 1 and a message naming the
 * offending file and path, not just the pure `auditCorpus` function
 * in isolation (see `tests/unit/corpus-audit.test.ts` for that).
 *
 * `--data-dir` is a `validate`-specific flag that exists for exactly this
 * purpose -- see `src/cli/commands/validate.ts`'s docblock and
 * `docs/cli/README.md`.
 */

import { describe, expect, test } from "bun:test";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "..", "..");
const CLI_ENTRYPOINT = join(REPO_ROOT, "src", "cli", "index.ts");
const REAL_DATA_DIR = join(REPO_ROOT, "data");

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

/** Copies the real `data/` corpus into a fresh temp directory and returns its path. Caller must remove it. */
async function copyRealCorpus(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "osn-validate-fixture-"));
  await cp(REAL_DATA_DIR, dir, { recursive: true });
  return dir;
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf-8"));
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(value, null, 2));
}

describe("osn validate --data-dir (real subprocess, corrupted fixture corpus)", () => {
  test("a copy of the real corpus with no corruption still validates clean", async () => {
    const dir = await copyRealCorpus();
    try {
      const result = await runCliSubprocess(["validate", "--data-dir", dir]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("OK");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("deleting week 27 (leaving 27 weeks) is reported by file and path, exit code 1", async () => {
    const dir = await copyRealCorpus();
    try {
      const weeksPath = join(dir, "weeks.json");
      // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed fixture data
      const weeksFile = (await readJson(weeksPath)) as any;
      weeksFile.weeks = weeksFile.weeks.filter((week: { week: number }) => week.week !== 27);
      await writeJson(weeksPath, weeksFile);

      const result = await runCliSubprocess(["validate", "--data-dir", dir]);
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain("weeks.json:");
      expect(result.stdout).toContain("week numbers must be exactly");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("a citation broken to R99 is reported by file and path, exit code 1", async () => {
    const dir = await copyRealCorpus();
    try {
      const regulationsPath = join(dir, "regulations.json");
      // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed fixture data
      const regulationsFile = (await readJson(regulationsPath)) as any;
      regulationsFile.regulations[0].citation = "R99";
      await writeJson(regulationsPath, regulationsFile);

      const result = await runCliSubprocess(["validate", "--data-dir", dir]);
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain("regulations.json:");
      expect(result.stdout).toContain("R99");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("assessment weights summing to 99 (instead of 100) is reported, exit code 1", async () => {
    const dir = await copyRealCorpus();
    try {
      const weightsPath = join(dir, "assessment-weights.json");
      // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed fixture data
      const weightsFile = (await readJson(weightsPath)) as any;
      weightsFile.components[0].weight -= 1;
      await writeJson(weightsPath, weightsFile);

      const result = await runCliSubprocess(["validate", "--data-dir", dir]);
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain("assessment-weights.json:");
      expect(result.stdout).toContain("sum to exactly 100");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("two distinct problems in two different files are BOTH reported in one run (one pass, not fail-fast)", async () => {
    const dir = await copyRealCorpus();
    try {
      const weeksPath = join(dir, "weeks.json");
      // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed fixture data
      const weeksFile = (await readJson(weeksPath)) as any;
      weeksFile.weeks = weeksFile.weeks.filter((week: { week: number }) => week.week !== 27);
      await writeJson(weeksPath, weeksFile);

      const categoriesPath = join(dir, "curriculum-categories.json");
      // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed fixture data
      const categoriesFile = (await readJson(categoriesPath)) as any;
      categoriesFile.categories = categoriesFile.categories.filter(
        (category: { id: string }) => category.id !== "core",
      );
      await writeJson(categoriesPath, categoriesFile);

      const result = await runCliSubprocess(["validate", "--data-dir", dir, "--json"]);
      expect(result.exitCode).toBe(1);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.ok).toBe(false);
      const filesWithFindings = new Set(
        (parsed.findings as Array<{ file: string }>).map((finding) => finding.file),
      );
      expect(filesWithFindings.has("weeks.json")).toBe(true);
      expect(filesWithFindings.has("curriculum-categories.json")).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("an untracked .json file dropped into the fixture's data/ is reported as unregistered", async () => {
    const dir = await copyRealCorpus();
    try {
      await writeJson(join(dir, "mystery-extra.json"), { anything: "goes here" });

      const result = await runCliSubprocess(["validate", "--data-dir", dir]);
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain("mystery-extra.json:");
      expect(result.stdout).toContain("not covered by any schema");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
