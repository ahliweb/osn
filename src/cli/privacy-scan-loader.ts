/**
 * The one piece of filesystem I/O `osn privacy-check` needs: recursively
 * reading every `.json`/`.jsonl` file under a directory into the
 * in-memory {@link PrivacyScanEntry} list `src/domain/privacy-scan.ts`'s
 * pure `scanEntriesForDirectIdentifiers` consumes.
 *
 * Deliberately kept out of `src/domain/`, exactly the same split
 * `src/cli/corpus-loader.ts` uses for `osn validate`: I/O belongs to the
 * CLI layer per the "Layering rules" in `docs/architecture/README.md`.
 *
 * Unlike `corpus-loader.ts` (which reads only files directly under a
 * directory, non-recursive, `.json` only -- see its own docblock), this
 * loader walks **recursively** and also reads `.jsonl` files, because
 * issue #23 explicitly requires the scan to reach `data/samples/` (one
 * level down) and `data/samples/learning-records.sample.jsonl` (not a
 * `.json` file). This is a different, wider traversal than `osn
 * validate`'s corpus registry scan on purpose: `osn validate` audits the
 * fixed, registered curriculum corpus; `osn privacy-check` is a blanket
 * governance sweep of anything that could hide a direct-identifier-shaped
 * key anywhere under `data/`.
 */

import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";
import type { PrivacyScanEntry } from "../domain/privacy-scan";

/** One line (`.jsonl`) or whole file (`.json`) that failed to parse as JSON, so it could not be scanned. Reported separately from {@link PrivacyScanFinding}s -- a parse failure is `osn validate`'s concern (schema conformance), not this control's (identifier-shaped keys) -- but still surfaced so it is never silently skipped. */
export interface PrivacyScanParseIssue {
  readonly file: string;
  readonly message: string;
}

/** The result of loading a directory tree into scannable entries. */
export interface LoadedPrivacyScanEntries {
  readonly entries: readonly PrivacyScanEntry[];
  readonly parseIssues: readonly PrivacyScanParseIssue[];
  /** Count of `.json`/`.jsonl` files actually found and attempted (regardless of parse success), for the summary line -- every other file extension under the tree is not counted here since it is out of scope for this scan. */
  readonly filesScanned: number;
}

/** Recursively lists every regular file under `dir`, as absolute paths, in deterministic (name-sorted, depth-first) order. Throws if `dir` itself cannot be listed. */
async function listFilesRecursively(dir: string): Promise<string[]> {
  const dirents = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const dirent of [...dirents].sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = join(dir, dirent.name);
    if (dirent.isDirectory()) {
      files.push(...(await listFilesRecursively(fullPath)));
    } else if (dirent.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

/** Parses `.jsonl`-mode text: one JSON value per non-blank line, 1-indexed for the entry's `file` label (so it reads naturally as a line number in an editor), matching `src/cli/commands/report.ts`'s `parseJsonlInput` blank-line-skipping rule. */
function parseJsonlEntries(
  text: string,
  relativePath: string,
): { readonly entries: PrivacyScanEntry[]; readonly issues: PrivacyScanParseIssue[] } {
  const entries: PrivacyScanEntry[] = [];
  const issues: PrivacyScanParseIssue[] = [];
  const lines = text.split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (line.length === 0) {
      return;
    }
    const label = `${relativePath}:${index + 1}`;
    try {
      entries.push({ file: label, value: JSON.parse(line) as unknown });
    } catch (cause) {
      issues.push({ file: label, message: `line is not valid JSON: ${(cause as Error).message}` });
    }
  });

  return { entries, issues };
}

/**
 * Recursively reads every `.json`/`.jsonl` file under `dataDir` (case-
 * insensitive extension match; every other file -- `.gitkeep`, `README.md`,
 * etc. -- is skipped, out of scope for this scan) into scannable entries.
 *
 * Throws only when `dataDir` itself (or a subdirectory under it) cannot be
 * listed (does not exist, is not a directory, permission denied) -- the
 * caller treats that as a usage error (a bad `--data-dir`), the same
 * contract `loadCorpusFromDirectory` uses for `osn validate`. A single
 * file that exists but fails to parse as JSON does **not** throw; it is
 * recorded as a {@link PrivacyScanParseIssue} instead, so one malformed
 * file never prevents every other file from being scanned.
 */
export async function loadPrivacyScanEntries(dataDir: string): Promise<LoadedPrivacyScanEntries> {
  let absolutePaths: string[];
  try {
    absolutePaths = await listFilesRecursively(dataDir);
  } catch (cause) {
    throw new Error(`failed to read data directory "${dataDir}": ${(cause as Error).message}`);
  }

  const entries: PrivacyScanEntry[] = [];
  const parseIssues: PrivacyScanParseIssue[] = [];
  let filesScanned = 0;

  for (const absolutePath of absolutePaths) {
    const relativePath = relative(dataDir, absolutePath).split(sep).join("/");
    const extension = extname(absolutePath).toLowerCase();

    if (extension === ".json") {
      filesScanned += 1;
      const text = await readFile(absolutePath, "utf-8");
      try {
        entries.push({ file: relativePath, value: JSON.parse(text) as unknown });
      } catch (cause) {
        parseIssues.push({
          file: relativePath,
          message: `file is not valid JSON: ${(cause as Error).message}`,
        });
      }
      continue;
    }

    if (extension === ".jsonl") {
      filesScanned += 1;
      const text = await readFile(absolutePath, "utf-8");
      const { entries: lineEntries, issues } = parseJsonlEntries(text, relativePath);
      entries.push(...lineEntries);
      parseIssues.push(...issues);
    }
  }

  return { entries, parseIssues, filesScanned };
}
