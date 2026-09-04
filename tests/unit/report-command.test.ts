/**
 * Tests for `src/cli/commands/report.ts`'s own flag handling, input-format
 * detection, privacy gate, and schema-validation reporting, calling
 * `reportCommand.run` directly (in-process, for coverage and speed) rather
 * than spawning a subprocess. Mirrors `tests/unit/plan-command.test.ts`/
 * `tests/unit/render-command.test.ts`. The real end-to-end subprocess
 * behaviour is covered by `tests/integration/cli-report.test.ts`.
 *
 * Every temp file/directory lives under a per-test `mkdtemp` directory,
 * removed in `afterEach` so no test leaves temp files behind, pass or fail.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CommandContext } from "../../src/cli/command";
import { reportCommand } from "../../src/cli/commands/report";

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

const BASE_RECORD = {
  learnerRef: "lr_cmdtest01",
  problemId: "demo-problem-1",
  attemptNo: 1,
  verdict: "AC",
  durationSeconds: 100,
  hintLevelUsed: null,
  usedEditorial: false,
  errorTaxonomy: null,
  status: "A",
  resolveStatus: "not-required",
  recordedAt: "2026-09-04T10:00:00Z",
};

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "osn-report-command-test-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("reportCommand.help", () => {
  test("mentions --records and exit codes", () => {
    const help = reportCommand.help();
    expect(help).toContain("osn report");
    expect(help).toContain("--records");
    expect(help).toContain("Exit codes");
  });
});

describe("reportCommand.run: usage errors", () => {
  test("no args at all exits 2 naming --records as required", async () => {
    const { ctx, stderr } = makeContext();
    const code = await reportCommand.run([], ctx);
    expect(code).toBe(2);
    expect(stderr.join("")).toContain("--records");
  });

  test("--records with no following value exits 2", async () => {
    const { ctx, stderr } = makeContext();
    const code = await reportCommand.run(["--records"], ctx);
    expect(code).toBe(2);
    expect(stderr.join("")).toContain("--records");
  });

  test("an unreadable path exits 2", async () => {
    const { ctx, stderr } = makeContext();
    const code = await reportCommand.run(["--records", join(tempDir, "does-not-exist.jsonl")], ctx);
    expect(code).toBe(2);
    expect(stderr.join("")).toContain("failed to read");
  });

  test("--by with no following value exits 2", async () => {
    const path = join(tempDir, "records.jsonl");
    await writeFile(path, `${JSON.stringify(BASE_RECORD)}\n`, "utf-8");
    const { ctx, stderr } = makeContext();
    const code = await reportCommand.run(["--records", path, "--by"], ctx);
    expect(code).toBe(2);
    expect(stderr.join("")).toContain("--by");
  });

  test("an unknown --by exits 2", async () => {
    const path = join(tempDir, "records.jsonl");
    await writeFile(path, `${JSON.stringify(BASE_RECORD)}\n`, "utf-8");
    const { ctx, stderr } = makeContext();
    const code = await reportCommand.run(["--records", path, "--by", "bogus"], ctx);
    expect(code).toBe(2);
    expect(stderr.join("")).toContain("--by");
  });

  test("--by topic without a resolver exits 2 naming resolveTopic", async () => {
    const path = join(tempDir, "records.jsonl");
    await writeFile(path, `${JSON.stringify(BASE_RECORD)}\n`, "utf-8");
    const { ctx, stderr } = makeContext();
    const code = await reportCommand.run(["--records", path, "--by", "topic"], ctx);
    expect(code).toBe(2);
    expect(stderr.join("")).toContain("resolveTopic");
  });

  test("--by week without a resolver exits 2 naming resolveWeek", async () => {
    const path = join(tempDir, "records.jsonl");
    await writeFile(path, `${JSON.stringify(BASE_RECORD)}\n`, "utf-8");
    const { ctx, stderr } = makeContext();
    const code = await reportCommand.run(["--records", path, "--by", "week"], ctx);
    expect(code).toBe(2);
    expect(stderr.join("")).toContain("resolveWeek");
  });

  test("--format with no following value exits 2", async () => {
    const path = join(tempDir, "records.jsonl");
    await writeFile(path, `${JSON.stringify(BASE_RECORD)}\n`, "utf-8");
    const { ctx, stderr } = makeContext();
    const code = await reportCommand.run(["--records", path, "--format"], ctx);
    expect(code).toBe(2);
    expect(stderr.join("")).toContain("--format");
  });

  test("an unknown --format exits 2", async () => {
    const path = join(tempDir, "records.jsonl");
    await writeFile(path, `${JSON.stringify(BASE_RECORD)}\n`, "utf-8");
    const { ctx, stderr } = makeContext();
    const code = await reportCommand.run(["--records", path, "--format", "xml"], ctx);
    expect(code).toBe(2);
    expect(stderr.join("")).toContain("--format");
  });
});

describe("reportCommand.run: privacy gate", () => {
  test("refuses a record with a top-level email field, naming the path and index but not the value", async () => {
    const secretValue = "nobody@example.invalid";
    const path = join(tempDir, "bad.jsonl");
    await writeFile(
      path,
      `${[JSON.stringify(BASE_RECORD), JSON.stringify({ ...BASE_RECORD, email: secretValue })].join("\n")}\n`,
      "utf-8",
    );
    const { ctx, stderr, stdout } = makeContext();
    const code = await reportCommand.run(["--records", path], ctx);
    expect(code).toBe(1);
    const message = stderr.join("");
    expect(message).toContain("osn report: privacy refusal:");
    expect(message).toContain('key "email"');
    expect(message).toContain("index 1");
    expect(message).not.toContain(secretValue);
    expect(stdout.join("")).not.toContain(secretValue);
  });

  test("refuses a record with a nested identifier-shaped field", async () => {
    const path = join(tempDir, "bad-nested.jsonl");
    await writeFile(
      path,
      `${JSON.stringify({ ...BASE_RECORD, metadata: { nisn: "0012345678" } })}\n`,
      "utf-8",
    );
    const { ctx, stderr } = makeContext();
    const code = await reportCommand.run(["--records", path], ctx);
    expect(code).toBe(1);
    expect(stderr.join("")).toContain("privacy refusal");
  });

  test("the privacy gate runs before schema validation: a record with both an email field and a schema error is reported only as a privacy refusal", async () => {
    const path = join(tempDir, "bad-both.jsonl");
    await writeFile(
      path,
      `${JSON.stringify({ ...BASE_RECORD, verdict: "NOT-A-VERDICT", email: "nobody@example.invalid" })}\n`,
      "utf-8",
    );
    const { ctx, stderr } = makeContext();
    const code = await reportCommand.run(["--records", path], ctx);
    expect(code).toBe(1);
    expect(stderr.join("")).toContain("privacy refusal");
    expect(stderr.join("")).not.toContain("invalid record");
  });
});

describe("reportCommand.run: invalid records", () => {
  test("two schema-invalid records report both indices, not just the first", async () => {
    const path = join(tempDir, "two-invalid.jsonl");
    const lines = [
      JSON.stringify(BASE_RECORD),
      JSON.stringify({ ...BASE_RECORD, attemptNo: 2, verdict: "NOT-A-VERDICT" }),
      JSON.stringify({ ...BASE_RECORD, attemptNo: 3 }),
      JSON.stringify({ ...BASE_RECORD, attemptNo: -1 }),
    ];
    await writeFile(path, `${lines.join("\n")}\n`, "utf-8");
    const { ctx, stderr } = makeContext();
    const code = await reportCommand.run(["--records", path], ctx);
    expect(code).toBe(1);
    const message = stderr.join("");
    expect(message).toContain("index 1");
    expect(message).toContain("index 3");
    expect(message).not.toContain("index 0");
    expect(message).not.toContain("index 2");
  });

  test("a malformed JSON line is reported by its own index, blank lines are skipped and consume no index", async () => {
    const path = join(tempDir, "malformed.jsonl");
    const lines = [JSON.stringify(BASE_RECORD), "", "{not valid json", JSON.stringify(BASE_RECORD)];
    await writeFile(path, `${lines.join("\n")}\n`, "utf-8");
    const { ctx, stderr } = makeContext();
    const code = await reportCommand.run(["--records", path], ctx);
    expect(code).toBe(1);
    expect(stderr.join("")).toContain("index 1");
  });

  test(".json mode: a whole-file JSON parse failure is reported", async () => {
    const path = join(tempDir, "broken.json");
    await writeFile(path, "{not valid json at all", "utf-8");
    const { ctx, stderr } = makeContext();
    const code = await reportCommand.run(["--records", path], ctx);
    expect(code).toBe(1);
    expect(stderr.join("")).toContain("not valid JSON");
  });

  test(".json mode: a valid JSON value that is not an array is reported", async () => {
    const path = join(tempDir, "not-an-array.json");
    await writeFile(path, JSON.stringify({ oops: true }), "utf-8");
    const { ctx, stderr } = makeContext();
    const code = await reportCommand.run(["--records", path], ctx);
    expect(code).toBe(1);
    expect(stderr.join("")).toContain("array");
  });
});

describe("reportCommand.run: input format detection", () => {
  test(".json extension is parsed as a JSON array", async () => {
    const path = join(tempDir, "records.json");
    await writeFile(path, JSON.stringify([BASE_RECORD, { ...BASE_RECORD, attemptNo: 2 }]), "utf-8");
    const { ctx, stdout } = makeContext();
    const code = await reportCommand.run(["--records", path], ctx);
    expect(code).toBe(0);
    expect(stdout.join("")).toContain("Generated from 2 learning record(s)");
  });

  test("an unrecognised extension sniffs a JSON array as .json-mode", async () => {
    const path = join(tempDir, "records.txt");
    await writeFile(path, JSON.stringify([BASE_RECORD]), "utf-8");
    const { ctx, stdout } = makeContext();
    const code = await reportCommand.run(["--records", path], ctx);
    expect(code).toBe(0);
    expect(stdout.join("")).toContain("Generated from 1 learning record(s)");
  });

  test("an unrecognised extension falls back to .jsonl-mode for non-array content", async () => {
    const path = join(tempDir, "records.dat");
    await writeFile(path, `${JSON.stringify(BASE_RECORD)}\n`, "utf-8");
    const { ctx, stdout } = makeContext();
    const code = await reportCommand.run(["--records", path], ctx);
    expect(code).toBe(0);
    expect(stdout.join("")).toContain("Generated from 1 learning record(s)");
  });

  test("an unrecognised extension whose content is not valid JSON at all falls back to .jsonl-mode", async () => {
    const path = join(tempDir, "records.log");
    await writeFile(path, "not json at all\n", "utf-8");
    const { ctx, stderr } = makeContext();
    const code = await reportCommand.run(["--records", path], ctx);
    expect(code).toBe(1);
    expect(stderr.join("")).toContain("index 0");
  });
});

describe("reportCommand.run: successful output", () => {
  test("default --format md renders Markdown to stdout with exit 0", async () => {
    const path = join(tempDir, "records.jsonl");
    await writeFile(path, `${JSON.stringify(BASE_RECORD)}\n`, "utf-8");
    const { ctx, stdout, stderr } = makeContext();
    const code = await reportCommand.run(["--records", path], ctx);
    expect(code).toBe(0);
    expect(stderr.join("")).toBe("");
    expect(stdout.join("")).toContain("# osn report: mentor KPI dashboard");
  });

  test("--format json renders parseable JSON to stdout", async () => {
    const path = join(tempDir, "records.jsonl");
    await writeFile(path, `${JSON.stringify(BASE_RECORD)}\n`, "utf-8");
    const { ctx, stdout } = makeContext();
    const code = await reportCommand.run(["--records", path, "--format", "json"], ctx);
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout.join(""));
    expect(parsed.recordCount).toBe(1);
  });

  test("ctx.json (the global flag) is equivalent to --format json", async () => {
    const path = join(tempDir, "records.jsonl");
    await writeFile(path, `${JSON.stringify(BASE_RECORD)}\n`, "utf-8");
    const { ctx, stdout } = makeContext({ json: true });
    const code = await reportCommand.run(["--records", path], ctx);
    expect(code).toBe(0);
    expect(() => JSON.parse(stdout.join(""))).not.toThrow();
  });

  test("blank lines in .jsonl input are skipped", async () => {
    const path = join(tempDir, "with-blanks.jsonl");
    await writeFile(
      path,
      `\n${JSON.stringify(BASE_RECORD)}\n\n   \n${JSON.stringify({ ...BASE_RECORD, attemptNo: 2 })}\n`,
      "utf-8",
    );
    const { ctx, stdout } = makeContext();
    const code = await reportCommand.run(["--records", path], ctx);
    expect(code).toBe(0);
    expect(stdout.join("")).toContain("Generated from 2 learning record(s)");
  });

  test("--by none is equivalent to the default", async () => {
    const path = join(tempDir, "records.jsonl");
    await writeFile(path, `${JSON.stringify(BASE_RECORD)}\n`, "utf-8");
    const { ctx, stdout } = makeContext();
    const code = await reportCommand.run(["--records", path, "--by", "none"], ctx);
    expect(code).toBe(0);
    expect(stdout.join("")).toContain('grouped by "none"');
  });
});

describe("reportCommand.run: --out / --force", () => {
  test("--out writes the file, matching the default stdout output", async () => {
    const path = join(tempDir, "records.jsonl");
    await writeFile(path, `${JSON.stringify(BASE_RECORD)}\n`, "utf-8");

    const stdoutCtx = makeContext();
    const stdoutCode = await reportCommand.run(["--records", path], stdoutCtx.ctx);
    expect(stdoutCode).toBe(0);

    const outPath = join(tempDir, "report.md");
    const outCtx = makeContext();
    const outCode = await reportCommand.run(["--records", path, "--out", outPath], outCtx.ctx);
    expect(outCode).toBe(0);
    expect(outCtx.stdout.join("")).toContain(`wrote ${outPath}`);

    const written = await readFile(outPath, "utf-8");
    expect(written).toBe(stdoutCtx.stdout.join(""));
  });

  test("re-running --out without --force exits 2 and does not modify the file", async () => {
    const path = join(tempDir, "records.jsonl");
    await writeFile(path, `${JSON.stringify(BASE_RECORD)}\n`, "utf-8");
    const outPath = join(tempDir, "report.md");

    const first = makeContext();
    expect(await reportCommand.run(["--records", path, "--out", outPath], first.ctx)).toBe(0);
    const original = await readFile(outPath, "utf-8");

    const second = makeContext();
    const code = await reportCommand.run(
      ["--records", path, "--format", "json", "--out", outPath],
      second.ctx,
    );
    expect(code).toBe(2);
    expect(second.stderr.join("")).toContain("already exists");
    expect(second.stderr.join("")).toContain("--force");

    const unchanged = await readFile(outPath, "utf-8");
    expect(unchanged).toBe(original);
  });

  test("--force overwrites an existing --out file", async () => {
    const path = join(tempDir, "records.jsonl");
    await writeFile(path, `${JSON.stringify(BASE_RECORD)}\n`, "utf-8");
    const outPath = join(tempDir, "report.md");

    const first = makeContext();
    expect(await reportCommand.run(["--records", path, "--out", outPath], first.ctx)).toBe(0);

    const second = makeContext();
    const code = await reportCommand.run(
      ["--records", path, "--format", "json", "--out", outPath, "--force"],
      second.ctx,
    );
    expect(code).toBe(0);

    const final = await readFile(outPath, "utf-8");
    expect(() => JSON.parse(final)).not.toThrow();
  });

  test("a write failure (unwritable --out directory) is reported as a usage error", async () => {
    const path = join(tempDir, "records.jsonl");
    await writeFile(path, `${JSON.stringify(BASE_RECORD)}\n`, "utf-8");
    const outPath = join(tempDir, "does-not-exist-dir", "report.md");

    const { ctx, stderr } = makeContext();
    const code = await reportCommand.run(["--records", path, "--out", outPath], ctx);
    expect(code).toBe(2);
    expect(stderr.join("")).toContain("failed to write");
  });
});
