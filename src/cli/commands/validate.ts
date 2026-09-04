/**
 * `osn validate` -- validates the entire curriculum corpus (every
 * `data/*.json` file) in one pass: schema conformance, structural
 * invariants, and referential integrity. See
 * `src/domain/corpus-audit.ts` for the actual checks; this module is only
 * the thin I/O + formatting + exit-code shell around it, per the
 * "Layering rules" in `docs/architecture/README.md`.
 */

import { resolve } from "node:path";
import { auditCorpus } from "../../domain/corpus-audit";
import type { Command } from "../command";
import { EXIT_SUCCESS, EXIT_USAGE_ERROR, EXIT_VALIDATION_FAILURE } from "../command";
import { loadCorpusFromDirectory } from "../corpus-loader";
import { formatAuditJson, formatAuditText } from "../format-audit";

/**
 * The default corpus directory: the real, committed `data/` at the
 * repository root, resolved relative to this source file's own location
 * (`src/cli/commands/validate.ts` -> repo root is three directories up) so
 * it is correct regardless of the process's current working directory.
 */
export const DEFAULT_DATA_DIR = resolve(import.meta.dir, "../../../data");

const HELP_TEXT = `osn validate -- validate the curriculum corpus

Validates every data/*.json file against its schema, checks the fixed
structural invariants (28 weeks, 7 gates, 10 topic families, 41
references, 4 stages, 4 categories, 4 status codes, 7 KPI metrics, 7
playbooks, 6 assessment bank kinds, assessment weights summing to 100,
both session templates summing to 120 minutes, 5 hint levels), and checks
referential integrity across the corpus (week -> topic family, week
checkpoint numbering <-> gate weeks, assessment-bank kind -> competition
stage, every Rnn citation -> the reference register). Reports every
problem found in one pass, grouped by file.

Usage: osn validate [options]

Options:
  --json              Emit a machine-readable { ok, findings, summary } result instead of text.
  --data-dir <path>   Validate a different corpus directory instead of the repository's data/
                       (primarily for testing against a fixture corpus).
  -h, --help          Show this help.

Exit codes:
  0   the corpus is clean (no findings).
  1   the corpus has one or more findings (schema, structural, or referential).
  2   usage error, e.g. --data-dir given with no path, or the given directory cannot be read.`;

export const validateCommand: Command = {
  name: "validate",
  summary: "Validate the curriculum corpus (data/*.json) in one pass.",
  help: () => HELP_TEXT,

  async run(args, ctx) {
    let dataDir = DEFAULT_DATA_DIR;

    const dataDirFlagIndex = args.indexOf("--data-dir");
    if (dataDirFlagIndex !== -1) {
      const value = args[dataDirFlagIndex + 1];
      if (value === undefined) {
        ctx.stderr("osn validate: --data-dir requires a directory path argument.\n");
        return EXIT_USAGE_ERROR;
      }
      dataDir = resolve(ctx.cwd, value);
    }

    let source: Awaited<ReturnType<typeof loadCorpusFromDirectory>>;
    try {
      source = await loadCorpusFromDirectory(dataDir);
    } catch (cause) {
      ctx.stderr(`osn validate: ${(cause as Error).message}\n`);
      return EXIT_USAGE_ERROR;
    }

    const result = auditCorpus(source);

    if (ctx.json) {
      ctx.stdout(`${formatAuditJson(result)}\n`);
    } else {
      ctx.stdout(`${formatAuditText(result, dataDir)}\n`);
    }

    return result.ok ? EXIT_SUCCESS : EXIT_VALIDATION_FAILURE;
  },
};
