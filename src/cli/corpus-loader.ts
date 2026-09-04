/**
 * The one piece of filesystem I/O `osn validate` needs: reading every
 * `.json` file directly under a directory into the in-memory
 * `CorpusSource` shape `src/domain/corpus-audit.ts`'s pure `auditCorpus`
 * consumes.
 *
 * Deliberately kept out of `src/domain/`: per the "Layering rules" in
 * `docs/architecture/README.md`, I/O belongs to the CLI layer, and keeping
 * it here is what lets `corpus-audit.ts` stay a pure function of an
 * injected value -- directly testable against an in-memory fixture without
 * touching disk, and (via this loader) also runnable against a real
 * directory, whether that is the committed `data/` or a temp-directory
 * fixture copy with one file deliberately corrupted.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { CorpusEntry, CorpusSource } from "../domain/corpus-audit";

/**
 * Reads every `.json` file directly under `dir` (non-recursive; a data
 * file living in a subdirectory is out of scope, and none do today) into a
 * {@link CorpusSource}. Each file's text is parsed with `JSON.parse`; a
 * parse failure is captured as a `{ ok: false }` entry rather than thrown,
 * so one malformed file does not prevent every other file from being
 * audited.
 *
 * Throws only when `dir` itself cannot be listed (does not exist, is not a
 * directory, permission denied) -- an all-or-nothing failure the caller
 * should treat as a usage error (a bad `--data-dir`), not a per-file
 * finding.
 */
export async function loadCorpusFromDirectory(dir: string): Promise<CorpusSource> {
  let fileNames: string[];
  try {
    fileNames = (await readdir(dir)).filter((name) => name.endsWith(".json"));
  } catch (cause) {
    throw new Error(`failed to read data directory "${dir}": ${(cause as Error).message}`);
  }

  const entries = new Map<string, CorpusEntry>();
  for (const name of fileNames) {
    const text = await readFile(join(dir, name), "utf-8");
    try {
      entries.set(name, { ok: true, data: JSON.parse(text) });
    } catch (cause) {
      entries.set(name, { ok: false, error: (cause as Error).message });
    }
  }

  return entries;
}
