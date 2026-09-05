/**
 * The pure scanning logic behind `osn privacy-check` (issue #23, GR-04):
 * a corpus-wide, CI-checkable promotion of the ad hoc scan
 * `tests/unit/learning-record.test.ts` already ran over `data/*.json`
 * (non-recursive, JSON files only) into a first-class governance control
 * that scans **recursively** through the whole `data/` tree, including
 * nested directories (`data/samples/`) and `.jsonl` files.
 *
 * Per the "Layering rules" in `docs/architecture/README.md`, this module
 * is pure -- a function of an injected {@link PrivacyScanEntry} list, no
 * filesystem access -- exactly the same split `src/domain/corpus-audit.ts`
 * uses around `osn validate`: the one piece of I/O (recursively reading
 * `data/`) lives in `src/cli/privacy-scan-loader.ts` instead, which is
 * what lets this module be unit-tested against an in-memory fixture
 * (`tests/unit/privacy-check.test.ts`) as well as run against the real
 * corpus (`tests/integration/cli-privacy-check.test.ts`).
 *
 * The actual identifier detection is not reimplemented here: it reuses
 * {@link findDirectIdentifiers} from `src/schema/learning-record.ts`
 * verbatim, so this control can never drift from the schema-level guard
 * it is defence-in-depth for (ADR-0004, "Decision detail: enforcement
 * mechanism").
 */

import { findDirectIdentifiers } from "../schema/learning-record";

/**
 * The one documented, audited tolerance this scan applies: the key
 * `"name"` is permitted anywhere in `data/`, because this repository's
 * pre-existing curriculum corpus (topic families, competition stages,
 * curriculum categories, assessment components, source-priority
 * platforms -- landed by issues #9-#14, well before `DIRECT_IDENTIFIER_
 * DENYLIST` existed) legitimately carries a `"name"` field for a
 * *curriculum entity's* printed name, e.g. `{ "id": "osn-k", "name":
 * "OSN-K" }` in `data/competition-stages.json`. None of that is a
 * person's name.
 *
 * This is exactly the `TOLERATED_KEY` exception `tests/unit/learning-
 * record.test.ts`'s "no file under data/ contains any denylisted
 * identifier key" describe block already documents and applies; this
 * module restates it as an exported constant so both that pre-existing
 * unit test and this CLI-invocable control apply the identical rule
 * (rather than two independently-maintained copies of "name" that could
 * drift apart), and so `docs/governance/privacy.md` can cite the rule by
 * name.
 *
 * Every OTHER denylisted term is held to real zero tolerance: `nama`,
 * `email`, `phone`/`telepon`, `nik`, `nisn`, `school`/`sekolah`,
 * `address`/`alamat`, `birthdate`/`tanggalLahir`, `dob`, `photo`/`foto`,
 * `ip`/`ipAddress` could never plausibly describe a curriculum entity, so
 * a single occurrence anywhere in `data/` is a finding. Critically, the
 * tolerance applies only to *this whole-corpus scan* of pre-existing
 * curriculum data -- a learning record itself still has no exception:
 * `learningRecordSchema`'s guard (`src/schema/learning-record.ts`)
 * rejects a `name` field on a learning record just like every other
 * denylisted key, because there a `name` really would be a person's name.
 */
export const TOLERATED_KEY = "name";

/** One file (or, for a `.jsonl` file, one line within it) already read and JSON-parsed, ready to be scanned. */
export interface PrivacyScanEntry {
  /**
   * The entry's location, relative to the scanned root, using `/`
   * separators. For a `.json` file this is just the file's relative path
   * (e.g. `"samples/README.md"` never appears here since only `.json`/
   * `.jsonl` files are scanned -- see `src/cli/privacy-scan-loader.ts`).
   * For a `.jsonl` file, this is `"<relative path>:<1-indexed line
   * number>"` (e.g. `"samples/learning-records.sample.jsonl:12"`), so a
   * finding can be traced back to the exact line without ever needing to
   * print that line's content.
   */
  readonly file: string;
  /** The entry's already-parsed JSON value. */
  readonly value: unknown;
}

/**
 * One denylisted-identifier-shaped key found by {@link
 * scanEntriesForDirectIdentifiers}. Carries the file/line it was found in,
 * the in-file path to its parent, and the offending key itself --
 * **never the value**, matching `osn report`'s privacy-gate refusal
 * pattern (`src/cli/commands/report.ts`): a real identifier accidentally
 * committed must never be echoed back into a terminal, a CI log, or a
 * `--json` payload.
 */
export interface PrivacyScanFinding {
  readonly file: string;
  readonly path: string;
  readonly key: string;
}

/**
 * Scans every entry with {@link findDirectIdentifiers}, drops the one
 * tolerated `"name"` exception, and returns every remaining finding,
 * sorted deterministically (by file, then in-file path, then key) so
 * output is stable across runs and across machines regardless of
 * filesystem directory-listing order.
 */
export function scanEntriesForDirectIdentifiers(
  entries: readonly PrivacyScanEntry[],
): PrivacyScanFinding[] {
  const findings: PrivacyScanFinding[] = [];

  for (const entry of entries) {
    for (const violation of findDirectIdentifiers(entry.value)) {
      if (violation.key === TOLERATED_KEY) {
        continue;
      }
      findings.push({ file: entry.file, path: violation.path, key: violation.key });
    }
  }

  return findings.sort(
    (a, b) =>
      a.file.localeCompare(b.file) || a.path.localeCompare(b.path) || a.key.localeCompare(b.key),
  );
}
