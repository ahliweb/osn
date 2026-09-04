/**
 * Tests for `src/cli/output-writer.ts`'s `writeOutputFile`: the thin
 * `--out`/`--force` filesystem layer `osn render` uses. Exercised directly
 * (in-process) against a per-test `mkdtemp` directory, removed in
 * `afterEach` so no test leaves temp files behind, pass or fail.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeOutputFile } from "../../src/cli/output-writer";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "osn-output-writer-test-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("writeOutputFile", () => {
  test("writes a new file and reports ok: true", async () => {
    const path = join(tempDir, "out.md");
    const result = await writeOutputFile(path, "hello\n", false);
    expect(result.ok).toBe(true);
    expect(await readFile(path, "utf-8")).toBe("hello\n");
  });

  test("without force, refuses to overwrite an existing file and leaves it untouched", async () => {
    const path = join(tempDir, "out.md");
    await writeOutputFile(path, "original\n", false);

    const result = await writeOutputFile(path, "replacement\n", false);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("exists");
    }
    expect(await readFile(path, "utf-8")).toBe("original\n");
  });

  test("with force: true, overwrites an existing file", async () => {
    const path = join(tempDir, "out.md");
    await writeOutputFile(path, "original\n", false);

    const result = await writeOutputFile(path, "replacement\n", true);
    expect(result.ok).toBe(true);
    expect(await readFile(path, "utf-8")).toBe("replacement\n");
  });

  test("force: true also succeeds when the file does not yet exist", async () => {
    const path = join(tempDir, "new-with-force.md");
    const result = await writeOutputFile(path, "content\n", true);
    expect(result.ok).toBe(true);
    expect(await readFile(path, "utf-8")).toBe("content\n");
  });

  test("an unrelated filesystem error (missing parent directory) reports reason: error with a message", async () => {
    const path = join(tempDir, "no-such-subdir", "out.md");
    const result = await writeOutputFile(path, "content\n", false);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("error");
      if (result.reason === "error") {
        expect(result.message.length).toBeGreaterThan(0);
      }
    }
  });
});
