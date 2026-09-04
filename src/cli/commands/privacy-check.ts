/**
 * `osn privacy-check` -- a CI-checkable, corpus-wide scan for direct-
 * identifier-shaped keys anywhere under `data/` (issue #23, GR-04).
 *
 * This promotes the ad hoc scan `tests/unit/learning-record.test.ts`
 * already ran (`data/*.json`, top-level only) to a first-class,
 * CLI-invocable governance control, per ADR-0004's "Decision detail:
 * enforcement mechanism": "A CI-checkable scan over `data/`... a second,
 * corpus-wide check independent of any single schema, so a future data
 * file cannot bypass the schema-level guard by mistake." Unlike that
 * test, this scan is **recursive** (reaches `data/samples/`) and also
 * reads `.jsonl` files (reaches `data/samples/learning-records.sample.jsonl`),
 * per the issue's explicit requirement -- see `src/cli/privacy-scan-
 * loader.ts`'s docblock for why this is a wider traversal than `osn
 * validate`'s registered-corpus scan.
 *
 * See `src/domain/privacy-scan.ts` for the actual scanning logic
 * (`scanEntriesForDirectIdentifiers`, and the documented `"name"`
 * tolerance); this module is only the thin I/O + flag parsing +
 * formatting + exit-code shell around it, per the "Layering rules" in
 * `docs/architecture/README.md` -- the same split `osn validate` uses
 * around `auditCorpus`.
 *
 * **Never the value.** Every finding this command can produce carries
 * only a file/line label, an in-file path, and the offending key -- never
 * the value found there, in text output, `--json` output, or a thrown
 * error message. This is the same discipline `osn report`'s privacy gate
 * applies (`src/cli/commands/report.ts`'s docblock): a real identifier
 * accidentally committed to `data/` must never be echoed back into a
 * terminal, a CI log, or a redirected file.
 */

import { resolve } from "node:path";
import { scanEntriesForDirectIdentifiers } from "../../domain/privacy-scan";
import type { Command } from "../command";
import { EXIT_SUCCESS, EXIT_USAGE_ERROR, EXIT_VALIDATION_FAILURE } from "../command";
import { formatPrivacyCheckJson, formatPrivacyCheckText } from "../format-privacy-check";
import { loadPrivacyScanEntries } from "../privacy-scan-loader";

/**
 * The default corpus directory: the real, committed `data/` at the
 * repository root, resolved relative to this source file's own location
 * (`src/cli/commands/privacy-check.ts` -> repo root is three directories
 * up), the same pattern `validate.ts`'s `DEFAULT_DATA_DIR` uses, so it is
 * correct regardless of the process's current working directory.
 */
export const DEFAULT_DATA_DIR = resolve(import.meta.dir, "../../../data");

const HELP_TEXT = `osn privacy-check -- scan data/ for direct-identifier-shaped keys

A CI-checkable governance control (ADR-0004, GR-04): recursively scans
every ".json" and ".jsonl" file under data/ -- including nested
directories such as data/samples/ -- for object keys shaped like a direct
or indirect personal identifier (name, email, phone, NIK, school,
birthdate, IP address, ...; see DIRECT_IDENTIFIER_DENYLIST in
src/schema/learning-record.ts), at any nesting depth.

Tolerance rule: the key "name" is permitted everywhere, because this
repository's pre-existing curriculum corpus legitimately carries a "name"
field for a curriculum entity's printed name (e.g. { "id": "osn-k",
"name": "OSN-K" } in data/competition-stages.json) -- never a person's
name. Every other denylisted term is zero-tolerance: a single occurrence
anywhere under data/ is reported as a finding. See
docs/governance/privacy.md's "Data minimisation" section for the full
rationale.

Usage: osn privacy-check [options]

Options:
  --json              Emit a machine-readable { ok, findings, parseIssues, summary } result instead of text.
  --data-dir <path>   Scan a different directory instead of the repository's data/
                       (primarily for testing against a fixture directory).
  -h, --help          Show this help.

Findings never include the offending value -- only the file (or, for a
.jsonl file, "<file>:<line>"), the in-file path to the key's parent, and
the key itself. This matches "osn report"'s privacy-gate refusal
behaviour (src/cli/commands/report.ts).

Exit codes:
  0   clean -- no direct-identifier-shaped key found (beyond the "name" tolerance).
  1   one or more direct-identifier-shaped keys found.
  2   usage error, e.g. an unknown flag, --data-dir given with no path, or the given directory cannot be read.`;

export const privacyCheckCommand: Command = {
  name: "privacy-check",
  summary: "Scan data/ recursively for direct-identifier-shaped keys (GR-04 governance control).",
  help: () => HELP_TEXT,

  async run(args, ctx) {
    let dataDir = DEFAULT_DATA_DIR;

    for (let index = 0; index < args.length; index += 1) {
      const arg = args[index];
      if (arg === undefined) {
        continue;
      }

      if (arg === "--data-dir") {
        const value = args[index + 1];
        if (value === undefined) {
          ctx.stderr("osn privacy-check: --data-dir requires a directory path argument.\n");
          return EXIT_USAGE_ERROR;
        }
        dataDir = resolve(ctx.cwd, value);
        index += 1;
        continue;
      }

      ctx.stderr(
        `osn privacy-check: unrecognised argument ${JSON.stringify(arg)}. Run "osn privacy-check --help" for usage.\n`,
      );
      return EXIT_USAGE_ERROR;
    }

    let loaded: Awaited<ReturnType<typeof loadPrivacyScanEntries>>;
    try {
      loaded = await loadPrivacyScanEntries(dataDir);
    } catch (cause) {
      ctx.stderr(`osn privacy-check: ${(cause as Error).message}\n`);
      return EXIT_USAGE_ERROR;
    }

    const findings = scanEntriesForDirectIdentifiers(loaded.entries);
    const result = {
      ok: findings.length === 0,
      findings,
      parseIssues: loaded.parseIssues,
      summary: {
        filesScanned: loaded.filesScanned,
        findingCount: findings.length,
      },
    };

    if (ctx.json) {
      ctx.stdout(`${formatPrivacyCheckJson(result)}\n`);
    } else {
      ctx.stdout(`${formatPrivacyCheckText(result, dataDir)}\n`);
    }

    return result.ok ? EXIT_SUCCESS : EXIT_VALIDATION_FAILURE;
  },
};
