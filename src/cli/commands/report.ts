/**
 * `osn report` -- computes the seven §6.3 mentor KPI metrics, the §13.1
 * step-4 postmortem breakdown, and the §13.1 step-5 scheduled-re-solves
 * listing from a file of learning records (issue #22). See
 * `src/domain/report.ts` for the pure reporting logic (`buildKpiReport`);
 * this module is only the thin I/O + parsing + **privacy gate** +
 * formatting + exit-code shell around it, per the "Layering rules" in
 * `docs/architecture/README.md` -- the same split `src/cli/commands/
 * validate.ts` uses around `auditCorpus`.
 *
 * ## The privacy gate
 *
 * Before this module computes anything, every successfully-JSON-parsed
 * record in the input is scanned with `findDirectIdentifiers`
 * (`src/schema/learning-record.ts`). If **any** record anywhere in the
 * file carries a denylisted-identifier-shaped key at any depth, the whole
 * file is refused: no report is computed, no partial output is printed.
 * The refusal names every offending field's **path** and the **record
 * index** it was found in -- never the value at that path, so a real
 * identifier accidentally present in a mentor's export is never echoed
 * back into a terminal, a CI log, or a redirected `--out` file.
 *
 * This runs strictly before schema validation (`learningRecordSchema`
 * would also reject most of the same records via `.strict()`, since a
 * denylisted key is essentially always an unrecognised one) so the
 * failure a mentor sees is unambiguously "you have personal data in this
 * file, remove it" rather than a generic "unrecognized key" schema error
 * that could be mistaken for an ordinary typo.
 *
 * ## Exit code for a privacy refusal: reuses exit 1, distinguished by message
 *
 * `docs/cli/README.md`'s "Exit codes" table fixes exactly three exit codes
 * for every `osn` command (`0`/`1`/`2`), and `src/cli/run-cli.ts` states
 * this is applied consistently across the whole CLI. Introducing a fourth
 * code just for this one command would break that one-table-covers-
 * everything contract for a marginal benefit -- no caller in this CLI
 * distinguishes error kinds by exit code beyond "success / validation
 * failure / usage error" today, and every error path here (like every
 * other command's) is a plain stderr message, not structured output. So a
 * privacy refusal exits `1` -- the same code as an ordinary schema-invalid
 * -record failure -- but the message is made unmistakable: it always
 * starts with the literal string `"osn report: privacy refusal:"`, always
 * appears **alone** (a privacy refusal short-circuits before schema
 * validation ever runs, so its output is never interleaved with ordinary
 * "invalid record" output in the same run), and never contains the
 * offending value. See `docs/cli/README.md`'s "osn report" section for the
 * same rule stated for users.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildKpiReport, type ReportGroupBy, ReportRequestError } from "../../domain/report";
import {
  findDirectIdentifiers,
  type LearningRecord,
  learningRecordSchema,
} from "../../schema/learning-record";
import type { Command } from "../command";
import { EXIT_SUCCESS, EXIT_USAGE_ERROR, EXIT_VALIDATION_FAILURE } from "../command";
import { formatReportJson, formatReportMarkdown } from "../format-report";
import { writeOutputFile } from "../output-writer";

const HELP_TEXT = `osn report -- mentor KPI dashboard reporting from learning records

Computes the seven §6.3 mentor KPI metrics, a §13.1 step-4 postmortem
error-taxonomy breakdown, and a §13.1 step-5 scheduled-re-solves listing
from a file of §15 learning records. Every record is scanned for
personal-identifier-shaped fields and validated against the
learning-record schema before anything is computed -- see "Privacy gate"
below.

Usage: osn report --records <path> [options]

Options:
  --records <path>     A .jsonl (one JSON record per line, blank lines
                       skipped) or .json (a JSON array of records) file.
                       Required. See "Input format detection" below.
  --by <topic|week|none>
                       Group the KPI metrics by topic family or by §4 week
                       number, in addition to the overall (ungrouped)
                       section. Default: none. NOTE: this repository ships
                       no problemId->topic or date->week registry of its
                       own (see docs/cli/README.md's "osn report" section),
                       so --by topic and --by week currently always fail
                       with an actionable usage error; use --by none (the
                       default) to get a full report today.
  --format <md|json>   Output format. Default: md.
  --out <path>         Write the rendered report to this path instead of
                       stdout.
  --force              Overwrite --out if it already exists. Without it,
                       an existing file at --out is left byte-for-byte
                       untouched and the command exits 2.
  -h, --help           Show this help.

Input format detection:
  1. A ".jsonl" extension (case-insensitive) -> parsed as one JSON value
     per non-blank line.
  2. A ".json" extension -> parsed as a single JSON array of records.
  3. Any other extension -> content-sniffed: if the whole trimmed file
     parses as JSON and the result is an array, treated as .json-mode;
     otherwise treated as .jsonl-mode.

Privacy gate: before anything is computed, every record is scanned for a
denylisted-identifier-shaped field (name, email, NISN, school, ...) at any
depth (see ADR-0004). If any record contains one, the whole file is
refused: the error names every offending field's path and record index,
but NEVER the value found there. This runs before schema validation, so
the message is unmistakably a privacy refusal ("osn report: privacy
refusal: ...") rather than a generic invalid-record error.

Exit codes:
  0   success.
  1   invalid input: one or more records failed schema validation (every
      failing index is listed, not just the first), or a privacy refusal
      (see above). Both cases exit 1; a privacy refusal is distinguished
      by its message, never by a different code (see this file's docblock
      for why).
  2   usage error: --records missing, the given path cannot be read, an
      unknown --by, or an unknown --format.`;

/** Extracts the value following the first occurrence of `flag` in `args`, or `undefined` if `flag` is absent (or has nothing after it). */
function readFlagValue(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
}

type InputMode = "jsonl" | "json-array";

/**
 * Detects which of the two supported input shapes `path`/`text` is, per
 * this command's documented rule (see `HELP_TEXT`'s "Input format
 * detection"): a recognised extension decides outright; anything else is
 * content-sniffed (a whole-file parse that succeeds and yields an array is
 * treated as `.json`-mode, everything else as `.jsonl`-mode).
 */
function detectMode(path: string, text: string): InputMode {
  const lower = path.toLowerCase();
  if (lower.endsWith(".jsonl")) {
    return "jsonl";
  }
  if (lower.endsWith(".json")) {
    return "json-array";
  }
  try {
    const sniffed: unknown = JSON.parse(text.trim());
    if (Array.isArray(sniffed)) {
      return "json-array";
    }
  } catch {
    // Falls through to "jsonl" below -- an unparseable whole-file blob is
    // exactly what a genuine JSONL file looks like when parsed as one JSON
    // document, so this is the correct fallback, not a swallowed error:
    // the real per-line parse (and its own error reporting) happens in
    // `parseJsonlInput`.
  }
  return "jsonl";
}

/** One record already parsed from JSON, tagged with its 0-indexed position (see this file's docblock on index semantics: for `.jsonl` input this is the record's position among *non-blank* lines; for `.json` input, its position in the array). */
interface RawEntry {
  readonly index: number;
  readonly value: unknown;
}

/** One record-level problem found while turning raw input text into {@link RawEntry} values -- either a line that is not valid JSON at all (`.jsonl` mode), or the whole file failing to parse / not being an array (`.json` mode, always reported at index 0). */
interface InputIssue {
  readonly index: number;
  readonly message: string;
}

/** The result of turning raw `--records` file text into parsed-but-not-yet-schema-validated entries. */
interface ParsedInput {
  readonly entries: readonly RawEntry[];
  readonly issues: readonly InputIssue[];
}

/**
 * Parses `.jsonl`-mode input: one JSON value per line, blank (whitespace-
 * only) lines skipped entirely (they consume no index). A line that is
 * not valid JSON becomes an {@link InputIssue} at its own index rather than
 * aborting the whole parse, so every bad line in a batch is reported at
 * once, matching `parseLearningRecords`'s "report every invalid index"
 * discipline (`src/domain/learning-record.ts`).
 */
function parseJsonlInput(text: string): ParsedInput {
  const entries: RawEntry[] = [];
  const issues: InputIssue[] = [];
  let index = 0;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0) {
      continue;
    }
    try {
      entries.push({ index, value: JSON.parse(line) as unknown });
    } catch (cause) {
      issues.push({ index, message: `line is not valid JSON: ${(cause as Error).message}` });
    }
    index += 1;
  }

  return { entries, issues };
}

/**
 * Parses `.json`-mode input: the whole file must be one JSON array. A
 * whole-file parse failure, or a parse that succeeds but is not an array,
 * is reported as a single {@link InputIssue} at index 0 -- there is no
 * per-record position to report until the top-level array itself is
 * known to exist.
 */
function parseJsonArrayInput(text: string): ParsedInput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    return {
      entries: [],
      issues: [{ index: 0, message: `file is not valid JSON: ${(cause as Error).message}` }],
    };
  }

  if (!Array.isArray(parsed)) {
    return {
      entries: [],
      issues: [
        { index: 0, message: "expected the file's top-level JSON value to be an array of records" },
      ],
    };
  }

  return { entries: parsed.map((value, index) => ({ index, value })), issues: [] };
}

/** One denylisted-identifier-shaped field found by the privacy gate, tagged with the record index it came from. Carries the field's path and key only -- never the value. */
interface PrivacyViolation {
  readonly index: number;
  readonly path: string;
  readonly key: string;
}

/** Runs {@link findDirectIdentifiers} over every successfully-parsed entry, tagging each violation with its record index. This is the privacy gate's entire implementation -- see this file's docblock. */
function findPrivacyViolations(entries: readonly RawEntry[]): PrivacyViolation[] {
  const violations: PrivacyViolation[] = [];
  for (const entry of entries) {
    for (const violation of findDirectIdentifiers(entry.value)) {
      violations.push({ index: entry.index, path: violation.path, key: violation.key });
    }
  }
  return violations;
}

/** One record that failed `learningRecordSchema`, tagged with its record index and the failing field path. */
interface SchemaIssue {
  readonly index: number;
  readonly path: string;
  readonly message: string;
}

/** Validates every entry against `learningRecordSchema`, returning every successfully-parsed {@link LearningRecord} plus every issue found (not just the first), each tagged with its original record index. */
function validateEntries(entries: readonly RawEntry[]): {
  readonly records: readonly LearningRecord[];
  readonly issues: readonly SchemaIssue[];
} {
  const records: LearningRecord[] = [];
  const issues: SchemaIssue[] = [];

  for (const entry of entries) {
    const result = learningRecordSchema.safeParse(entry.value);
    if (result.success) {
      records.push(result.data);
      continue;
    }
    for (const issue of result.error.issues) {
      issues.push({
        index: entry.index,
        path: issue.path.length > 0 ? issue.path.join(".") : "(root)",
        message: issue.message,
      });
    }
  }

  return { records, issues };
}

function isReportGroupBy(value: string | undefined): value is ReportGroupBy {
  return value === "topic" || value === "week" || value === "none";
}

export const reportCommand: Command = {
  name: "report",
  summary: "Compute the §6.3 mentor KPI dashboard from a learning-record file.",
  help: () => HELP_TEXT,

  async run(args, ctx) {
    const recordsValue = readFlagValue(args, "--records");
    if (!args.includes("--records") || recordsValue === undefined) {
      ctx.stderr('osn report: --records <path> is required. Run "osn report --help" for usage.\n');
      return EXIT_USAGE_ERROR;
    }

    let groupBy: ReportGroupBy = "none";
    if (args.includes("--by")) {
      const byValue = readFlagValue(args, "--by");
      if (!isReportGroupBy(byValue)) {
        ctx.stderr(
          `osn report: --by must be "topic", "week" or "none"; received ${JSON.stringify(byValue ?? "")}.\n`,
        );
        return EXIT_USAGE_ERROR;
      }
      groupBy = byValue;
    }

    let format: "md" | "json" = ctx.json ? "json" : "md";
    if (args.includes("--format")) {
      const formatValue = readFlagValue(args, "--format");
      if (formatValue !== "md" && formatValue !== "json") {
        ctx.stderr(
          `osn report: --format must be "md" or "json"; received ${JSON.stringify(formatValue ?? "")}.\n`,
        );
        return EXIT_USAGE_ERROR;
      }
      format = formatValue;
    }

    const absolutePath = resolve(ctx.cwd, recordsValue);
    let text: string;
    try {
      text = await readFile(absolutePath, "utf-8");
    } catch (cause) {
      ctx.stderr(
        `osn report: failed to read --records ${JSON.stringify(recordsValue)}: ${(cause as Error).message}\n`,
      );
      return EXIT_USAGE_ERROR;
    }

    const mode = detectMode(recordsValue, text);
    const { entries, issues: inputIssues } =
      mode === "jsonl" ? parseJsonlInput(text) : parseJsonArrayInput(text);

    // --- privacy gate: before any schema validation or computation ---------
    const privacyViolations = findPrivacyViolations(entries);
    if (privacyViolations.length > 0) {
      const lines = privacyViolations
        .map(
          (violation) => `  - [index ${violation.index}] ${violation.path}: key "${violation.key}"`,
        )
        .join("\n");
      ctx.stderr(
        `osn report: privacy refusal: ${privacyViolations.length} field(s) shaped like a direct or indirect personal identifier were found (see ADR-0004). Refusing to process ${JSON.stringify(recordsValue)}. Values are never logged -- only field paths and record indices are shown below. Remove or rename these fields in the source data and re-run:\n${lines}\n`,
      );
      return EXIT_VALIDATION_FAILURE;
    }

    // --- schema validation: every failing index, not just the first -------
    const { records, issues: schemaIssues } = validateEntries(entries);
    const allIssues = [
      ...inputIssues.map((issue) => ({
        index: issue.index,
        path: "(file)",
        message: issue.message,
      })),
      ...schemaIssues,
    ].sort((a, b) => a.index - b.index);

    if (allIssues.length > 0) {
      const lines = allIssues
        .map((issue) => `  - [index ${issue.index}] ${issue.path}: ${issue.message}`)
        .join("\n");
      ctx.stderr(
        `osn report: ${allIssues.length} invalid record(s) found in ${JSON.stringify(recordsValue)}:\n${lines}\n`,
      );
      return EXIT_VALIDATION_FAILURE;
    }

    let report: ReturnType<typeof buildKpiReport>;
    try {
      report = buildKpiReport({ records, groupBy });
    } catch (cause) {
      if (cause instanceof ReportRequestError) {
        ctx.stderr(`osn report: ${cause.message}\n`);
        return EXIT_USAGE_ERROR;
      }
      throw cause;
    }

    const content = format === "json" ? formatReportJson(report) : formatReportMarkdown(report);
    const output = `${content}\n`;

    const outValue = readFlagValue(args, "--out");
    if (outValue === undefined) {
      ctx.stdout(output);
      return EXIT_SUCCESS;
    }

    const force = args.includes("--force");
    const outPath = resolve(ctx.cwd, outValue);
    const writeResult = await writeOutputFile(outPath, output, force);

    if (!writeResult.ok) {
      if (writeResult.reason === "exists") {
        ctx.stderr(
          `osn report: --out ${JSON.stringify(outValue)} already exists. Use --force to overwrite it.\n`,
        );
      } else {
        ctx.stderr(
          `osn report: failed to write ${JSON.stringify(outValue)}: ${writeResult.message}\n`,
        );
      }
      return EXIT_USAGE_ERROR;
    }

    ctx.stdout(`osn report: wrote ${outValue}\n`);
    return EXIT_SUCCESS;
  },
};
