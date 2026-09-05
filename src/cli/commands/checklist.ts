/**
 * `osn checklist` -- renders the §14.1 cohort-readiness checklist, the
 * §14.2 operational rules and mentor quick-pointer, and the latest §14.2
 * rule 8 syllabus-check status (issue #25). See `src/render/checklist.ts`
 * for the Markdown renderer and `src/cli/format-checklist.ts` for the
 * `--format json` shape; this module is only the thin flag parsing +
 * `--out`/`--force` file-writing + exit-code shell around them, per the
 * "Layering rules" in `docs/architecture/README.md` -- exactly the same
 * split `src/cli/commands/render.ts` uses around its renderers.
 */

import { resolve } from "node:path";
import { formatChecklistJson } from "../format-checklist";
import { renderChecklist } from "../../render/checklist";
import type { Command } from "../command";
import { EXIT_SUCCESS, EXIT_USAGE_ERROR } from "../command";
import { writeOutputFile } from "../output-writer";

const HELP_TEXT = `osn checklist -- render the cohort readiness checklist and operational rules

Renders the §14.1 eight-item cohort-readiness checklist (each with its
verification method and required evidence), the §14.2 eight operational
rules, the §14.2 mentor quick-pointer callout (its ten ordered stages and
closing extension condition), and the latest §14.2 rule 8 syllabus-check
status (date, outcome, sources checked, and days since), alongside this
corpus's own syllabusVersion/syllabusDate.

Usage: osn checklist [--format md|json] [--out <path>] [--force]

Options:
  --format <md|json>   Output format. Default: md. --json (the global
                       flag) is equivalent to --format json; an explicit
                       --format wins if both are given.
  --out <path>         Write the rendered checklist to this path instead
                       of stdout.
  --force              Overwrite --out if it already exists. Without it,
                       an existing file at --out is left byte-for-byte
                       untouched and the command exits 2.
  -h, --help           Show this help.

Exit codes:
  0   success.
  2   usage error: an unknown --format, or --out already exists without
      --force.`;

/** Extracts the value following the first occurrence of `flag` in `args`, or `undefined` if `flag` is absent (or has nothing after it). */
function readFlagValue(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
}

export const checklistCommand: Command = {
  name: "checklist",
  summary: "Render the §14.1 cohort readiness checklist and §14.2 operational rules.",
  help: () => HELP_TEXT,

  async run(args, ctx) {
    let format: "md" | "json" = ctx.json ? "json" : "md";
    if (args.includes("--format")) {
      const formatValue = readFlagValue(args, "--format");
      if (formatValue !== "md" && formatValue !== "json") {
        ctx.stderr(
          `osn checklist: --format must be "md" or "json"; received ${JSON.stringify(formatValue ?? "")}.\n`,
        );
        return EXIT_USAGE_ERROR;
      }
      format = formatValue;
    }

    // The one place this command reads the wall clock -- both the renderer
    // (src/render/checklist.ts) and the JSON formatter (src/cli/format-
    // checklist.ts) take `asOf` as an explicit parameter and stay pure/
    // deterministic given it.
    const asOf = new Date();
    const content = format === "json" ? formatChecklistJson(asOf) : renderChecklist(asOf);
    const output = `${content}\n`;

    const outValue = readFlagValue(args, "--out");
    if (outValue === undefined) {
      ctx.stdout(output);
      return EXIT_SUCCESS;
    }

    const force = args.includes("--force");
    const outPath = resolve(ctx.cwd, outValue);
    const result = await writeOutputFile(outPath, output, force);

    if (!result.ok) {
      if (result.reason === "exists") {
        ctx.stderr(
          `osn checklist: --out ${JSON.stringify(outValue)} already exists. Use --force to overwrite it.\n`,
        );
      } else {
        ctx.stderr(
          `osn checklist: failed to write ${JSON.stringify(outValue)}: ${result.message}\n`,
        );
      }
      return EXIT_USAGE_ERROR;
    }

    ctx.stdout(`osn checklist: wrote ${outValue}\n`);
    return EXIT_SUCCESS;
  },
};
