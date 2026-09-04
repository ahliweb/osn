/**
 * The one piece of filesystem I/O `osn render`'s `--out`/`--force` flags
 * need: writing rendered Markdown to a path, refusing to silently clobber
 * an existing file unless `--force` is given.
 *
 * Deliberately kept out of `src/render/`: per the "Layering rules" in
 * `docs/architecture/README.md`, I/O belongs to the CLI layer, and keeping
 * it here is what lets `renderWeeklyPlan`/`renderCheckpointSheet`/
 * `renderSopCard` stay pure functions from validated data to a string --
 * mirrors `src/cli/corpus-loader.ts`'s split for `osn validate`.
 *
 * The exists-check is atomic (the `"wx"` flag fails the write itself if
 * the path already exists) rather than a separate "does it exist" check
 * followed by a write -- this closes the check-then-write race a mentor
 * could otherwise hit if two `osn render ... --out same-path` invocations
 * ran concurrently.
 */

import { writeFile } from "node:fs/promises";

/** The result of {@link writeOutputFile}: exactly one of a clean write, a pre-existing file (no `--force`), or an unrelated filesystem error. */
export type WriteOutputResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "exists" }
  | { readonly ok: false; readonly reason: "error"; readonly message: string };

/**
 * Writes `content` to `path`. Without `force`, uses the `"wx"` open flag:
 * the write itself fails (`EEXIST`) if `path` already exists, so an
 * existing file is left byte-for-byte untouched -- this is the "safety
 * property" issue #21 asks for (never silently clobber an edited
 * worksheet). With `force: true`, uses the ordinary `"w"` flag (create or
 * truncate-and-overwrite).
 *
 * Returns `{ ok: false, reason: "exists" }` for the refused-overwrite case
 * and `{ ok: false, reason: "error", message }` for any other failure
 * (e.g. the parent directory does not exist, permission denied) --
 * callers distinguish the two to print a targeted usage error either way.
 */
export async function writeOutputFile(
  path: string,
  content: string,
  force: boolean,
): Promise<WriteOutputResult> {
  try {
    await writeFile(path, content, { encoding: "utf-8", flag: force ? "w" : "wx" });
    return { ok: true };
  } catch (cause) {
    const error = cause as NodeJS.ErrnoException;
    if (!force && error.code === "EEXIST") {
      return { ok: false, reason: "exists" };
    }
    return { ok: false, reason: "error", message: error.message };
  }
}
