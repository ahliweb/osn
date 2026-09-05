/**
 * Typed loaders and lookup helpers over `data/readiness-checklist.json`
 * (the eight §14.1 cohort-readiness checklist items), `data/operational-
 * rules.json` (the eight §14.2 operational rules and the §14.2 mentor
 * quick-pointer callout), and `data/syllabus-check-log.json` (the §14.2
 * rule 8 / Catatan Penutup syllabus-check log) -- issue #25.
 *
 * Per the "Layering rules" in `docs/architecture/README.md`, this module
 * assumes the data it receives is valid once it has passed through
 * {@link parseDataFile}: it never re-implements validation logic of its
 * own. Loading happens once, at module load, and the result is memoised.
 *
 * `daysSinceLastSyllabusCheck` is the one function here that takes an
 * external input (`asOf`, a `Date`) rather than reading only corpus state.
 * It is UTC-only and never mutates `asOf` -- see its own docblock -- so a
 * caller (`src/render/checklist.ts`, `src/cli/commands/checklist.ts`) stays
 * deterministic for a given `asOf`, with the actual "what time is it now"
 * decision pushed to the CLI layer, exactly as `src/domain/cohort-plan.ts`
 * pushes "what is today" out to its caller rather than calling `new Date()`
 * itself.
 */

import { parseDataFile } from "../schema/common";
import {
  type OperationalRule,
  type OperationalRulesFile,
  operationalRulesFileSchema,
  type QuickPointer,
} from "../schema/operational-rules";
import {
  type ReadinessChecklistFile,
  type ReadinessChecklistItem,
  readinessChecklistFileSchema,
} from "../schema/readiness-checklist";
import {
  type SyllabusCheckEntry,
  type SyllabusCheckLogFile,
  syllabusCheckLogFileSchema,
} from "../schema/syllabus-check";

// `resolveJsonModule` is enabled in tsconfig.json, so a static import is a
// deterministic, dependency-free way to bring the corpus files in — no
// filesystem read, no async loader, and Bun/tsc both resolve it at build
// time. The value is `unknown` as far as validity is concerned; it is
// still parsed through the schema below before anything trusts its shape.
import rawOperationalRules from "../../data/operational-rules.json";
import rawReadinessChecklist from "../../data/readiness-checklist.json";
import rawSyllabusCheckLog from "../../data/syllabus-check-log.json";

const READINESS_CHECKLIST_SOURCE_NAME = "data/readiness-checklist.json";
const OPERATIONAL_RULES_SOURCE_NAME = "data/operational-rules.json";
const SYLLABUS_CHECK_LOG_SOURCE_NAME = "data/syllabus-check-log.json";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Strict `YYYY-MM-DD` shape, captured into (year, month, day) groups -- mirrors `cohort-plan.ts`'s `ISO_DATE_PATTERN`. */
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The validated contents of `data/readiness-checklist.json`, parsed once at
 * module load. Throws {@link CorpusValidationError} if the file does not
 * match {@link readinessChecklistFileSchema}.
 */
const readinessChecklistFile: ReadinessChecklistFile = parseDataFile(
  readinessChecklistFileSchema,
  rawReadinessChecklist,
  READINESS_CHECKLIST_SOURCE_NAME,
);

/**
 * The validated contents of `data/operational-rules.json`, parsed once at
 * module load. Throws {@link CorpusValidationError} if the file does not
 * match {@link operationalRulesFileSchema}.
 */
const operationalRulesFile: OperationalRulesFile = parseDataFile(
  operationalRulesFileSchema,
  rawOperationalRules,
  OPERATIONAL_RULES_SOURCE_NAME,
);

/**
 * The validated contents of `data/syllabus-check-log.json`, parsed once at
 * module load. Throws {@link CorpusValidationError} if the file does not
 * match {@link syllabusCheckLogFileSchema}.
 */
const syllabusCheckLogFile: SyllabusCheckLogFile = parseDataFile(
  syllabusCheckLogFileSchema,
  rawSyllabusCheckLog,
  SYLLABUS_CHECK_LOG_SOURCE_NAME,
);

/** The corpus version of the §14.1/§14.2 operational corpus (readiness checklist, operational rules): the source syllabus document's own version and date. */
export interface OperationsCorpusVersion {
  readonly syllabusVersion: string;
  readonly syllabusDate: string;
}

/**
 * The corpus version (`syllabusVersion`/`syllabusDate`) carried by
 * `data/readiness-checklist.json` -- read live from that file rather than
 * hard-coded, so a future syllabus revision is reflected here automatically.
 * `data/operational-rules.json` and `data/syllabus-check-log.json` carry
 * their own copies of the same two fields (per ADR-0005, every `data/*.json`
 * file carries its own provenance); this repository's operational corpus
 * is transcribed and versioned as one unit, so all three currently agree.
 */
export function operationsCorpusVersion(): OperationsCorpusVersion {
  return {
    syllabusVersion: readinessChecklistFile.syllabusVersion,
    syllabusDate: readinessChecklistFile.syllabusDate,
  };
}

/** Every §14.1 readiness-checklist item, in the file's stable array order. */
export function listReadinessItems(): readonly ReadinessChecklistItem[] {
  return readinessChecklistFile.items;
}

/**
 * Looks up a §14.1 readiness-checklist item by id, throwing a readable
 * error naming the unknown id and listing every valid id if none matches.
 */
export function getReadinessItem(id: string): ReadinessChecklistItem {
  const item = readinessChecklistFile.items.find((entry) => entry.id === id);
  if (item === undefined) {
    const validIds = readinessChecklistFile.items.map((entry) => entry.id).join(", ");
    throw new Error(`getReadinessItem: unknown readiness item id "${id}". Valid ids: ${validIds}.`);
  }
  return item;
}

/** Every §14.2 operational rule, ordered 1..8. */
export function listOperationalRules(): readonly OperationalRule[] {
  return operationalRulesFile.rules;
}

/** The §14.2 "Pointer cepat untuk mentor" callout: the ten-stage mentor sequencing pointer and its closing extension condition. */
export function quickPointer(): QuickPointer {
  return operationalRulesFile.quickPointer;
}

/** Every syllabus-check log entry, in the file's stable (chronological) array order. Never empty -- {@link syllabusCheckLogFileSchema} requires at least one entry. */
export function listSyllabusChecks(): readonly SyllabusCheckEntry[] {
  return syllabusCheckLogFile.checks;
}

/**
 * The most recently performed syllabus check: the entry with the greatest
 * `checkedOn` date. Ties (two entries sharing the same `checkedOn`) are
 * broken in favour of the later array entry, so appending a same-day
 * correction always wins over an earlier same-day entry.
 *
 * `checkedOn` is a strict `YYYY-MM-DD` string (enforced by
 * {@link isoDateSchema}), so ordinary string comparison already matches
 * chronological order -- no date parsing is needed to find the maximum.
 *
 * Never throws for the real corpus: {@link syllabusCheckLogFileSchema}
 * requires `checks` to be non-empty.
 */
export function latestSyllabusCheck(): SyllabusCheckEntry {
  return syllabusCheckLogFile.checks.reduce((latest, entry) =>
    entry.checkedOn >= latest.checkedOn ? entry : latest,
  );
}

/**
 * The number of whole days between {@link latestSyllabusCheck}'s
 * `checkedOn` date and `asOf`, computed with UTC-only date arithmetic and
 * without mutating `asOf` (mirrors `src/domain/cohort-plan.ts`'s and
 * `src/domain/assessment.ts`'s UTC-arithmetic convention: both endpoints
 * are converted to the epoch-millisecond instant of UTC midnight on their
 * calendar day via `Date.UTC`/`Date#getUTC*` accessors only, never
 * `Date#setDate`/`Date#getDate`, which read/write the *host's local*
 * calendar).
 *
 * Positive when `asOf` is after the last check (the ordinary case:
 * "how many days has it been"); zero when `asOf` is the same calendar day;
 * negative when `asOf` is before the last check (e.g. an `asOf` from
 * before the corpus's `checkedOn` date, which a caller should treat as a
 * usage error, not a valid "days since" answer, but which this pure
 * function reports honestly rather than clamping or throwing).
 */
export function daysSinceLastSyllabusCheck(asOf: Date): number {
  const latest = latestSyllabusCheck();
  const match = ISO_DATE_PATTERN.exec(latest.checkedOn);
  if (match === null) {
    // Unreachable for the real corpus: isoDateSchema already enforces this
    // shape at parse time. Guarded here defensively rather than asserted
    // away, so a future schema change that loosened the pattern would fail
    // loudly instead of producing `NaN`.
    throw new Error(
      `daysSinceLastSyllabusCheck: latest syllabus check's checkedOn "${latest.checkedOn}" is not a "YYYY-MM-DD" date -- data/syllabus-check-log.json may have changed shape.`,
    );
  }

  const [, yearText, monthText, dayText] = match;
  const checkedMs = Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText));
  const asOfMs = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());

  return Math.round((asOfMs - checkedMs) / MS_PER_DAY);
}
