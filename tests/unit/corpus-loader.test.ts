/**
 * Tests for `src/cli/corpus-loader.ts`: the filesystem->CorpusSource
 * reader `osn validate` uses (the one piece of I/O kept out of
 * `src/domain/corpus-audit.ts` -- see that module's docblock).
 */

import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadCorpusFromDirectory } from "../../src/cli/corpus-loader";

const DATA_DIR = join(import.meta.dir, "..", "..", "data");

describe("loadCorpusFromDirectory", () => {
  test("reads every .json file under the real data/ directory as ok:true entries", async () => {
    const source = await loadCorpusFromDirectory(DATA_DIR);
    expect(source.size).toBeGreaterThan(0);
    expect(source.has("weeks.json")).toBe(true);
    const weeksEntry = source.get("weeks.json");
    expect(weeksEntry?.ok).toBe(true);
  });

  test("ignores non-.json files (e.g. .gitkeep)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "osn-corpus-loader-"));
    try {
      await writeFile(join(dir, "a.json"), '{"a":1}');
      await writeFile(join(dir, ".gitkeep"), "");
      await writeFile(join(dir, "notes.md"), "# not data");
      const source = await loadCorpusFromDirectory(dir);
      expect([...source.keys()]).toEqual(["a.json"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("captures malformed JSON as an ok:false entry instead of throwing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "osn-corpus-loader-"));
    try {
      await writeFile(join(dir, "broken.json"), "{ this is not valid json");
      const source = await loadCorpusFromDirectory(dir);
      const entry = source.get("broken.json");
      expect(entry?.ok).toBe(false);
      if (entry !== undefined && !entry.ok) {
        expect(entry.error.length).toBeGreaterThan(0);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("throws when the directory does not exist", async () => {
    const missing = join(tmpdir(), "osn-corpus-loader-does-not-exist", String(Date.now()));
    await expect(loadCorpusFromDirectory(missing)).rejects.toThrow(/failed to read data directory/);
  });
});
