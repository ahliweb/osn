/**
 * `osn plan` -- generates the dated 28-week cohort calendar against the §4
 * operational syllabus (issue #20). See `src/domain/cohort-plan.ts` for the
 * actual planning logic (`buildCohortPlan`); this module is only the thin
 * I/O + flag parsing + formatting + exit-code shell around it, per the
 * "Layering rules" in `docs/architecture/README.md` -- exactly the same
 * split `src/cli/commands/validate.ts` uses around `auditCorpus`.
 */

import { buildCohortPlan, type CohortPlan } from "../../domain/cohort-plan";
import type { Command } from "../command";
import { EXIT_SUCCESS, EXIT_USAGE_ERROR } from "../command";
import { formatPlanJson, formatPlanMarkdown } from "../format-plan";

const HELP_TEXT = `osn plan -- generate the dated 28-week cohort calendar

Builds the §4 28-week operational calendar from a cohort start date:
per-week date ranges, focus, session dates, mini-contest and checkpoint
markers, and the gate evidence required to proceed past a gate week.
Excluded dates (holidays, exams) shift subsequent weeks rather than
silently overlapping -- see docs/cli/README.md's "osn plan" section for
the exact week-shifting and session-date rules.

Usage: osn plan --start <YYYY-MM-DD> [options]

Options:
  --start <date>          Cohort start date, ISO YYYY-MM-DD. Required.
  --exclude <d1,d2,...>   Comma-separated ISO YYYY-MM-DD dates to exclude
                           (school holidays, exam days, ...). Optional.
  --target-stage <id>     Report against a target competition stage's
                           intensive week (osn-k, osn-p, osn-nasional, or
                           toki-ioi-extension). Optional.
  --format <md|json>      Output format. Default: md. --json is equivalent
                           to --format json.
  -h, --help              Show this help.

Exit codes:
  0   success.
  2   usage error: missing --start, an invalid/non-ISO date, an unknown
      --target-stage, or an unknown --format.`;

/** Extracts the value following the first occurrence of `flag` in `args`, or `undefined` if `flag` is absent. */
function readFlagValue(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
}

export const planCommand: Command = {
  name: "plan",
  summary: "Generate the dated 28-week cohort calendar from a start date.",
  help: () => HELP_TEXT,

  run(args, ctx) {
    if (!args.includes("--start")) {
      ctx.stderr('osn plan: --start <YYYY-MM-DD> is required. Run "osn plan --help" for usage.\n');
      return EXIT_USAGE_ERROR;
    }

    const startValue = readFlagValue(args, "--start");
    if (startValue === undefined) {
      ctx.stderr("osn plan: --start requires a date argument (YYYY-MM-DD).\n");
      return EXIT_USAGE_ERROR;
    }

    let excludedDates: readonly string[] = [];
    if (args.includes("--exclude")) {
      const excludeValue = readFlagValue(args, "--exclude");
      if (excludeValue === undefined) {
        ctx.stderr("osn plan: --exclude requires a comma-separated list of dates.\n");
        return EXIT_USAGE_ERROR;
      }
      excludedDates = excludeValue
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
    }

    let targetStage: string | undefined;
    if (args.includes("--target-stage")) {
      const targetStageValue = readFlagValue(args, "--target-stage");
      if (targetStageValue === undefined) {
        ctx.stderr("osn plan: --target-stage requires a stage id argument.\n");
        return EXIT_USAGE_ERROR;
      }
      targetStage = targetStageValue;
    }

    let format: "md" | "json" = ctx.json ? "json" : "md";
    if (args.includes("--format")) {
      const formatValue = readFlagValue(args, "--format");
      if (formatValue !== "md" && formatValue !== "json") {
        ctx.stderr(
          `osn plan: --format must be "md" or "json"; received ${JSON.stringify(formatValue ?? "")}.\n`,
        );
        return EXIT_USAGE_ERROR;
      }
      format = formatValue;
    }

    let plan: CohortPlan;
    try {
      plan = buildCohortPlan({
        startDate: startValue,
        excludedDates,
        ...(targetStage !== undefined ? { targetStage } : {}),
      });
    } catch (cause) {
      ctx.stderr(`osn plan: ${(cause as Error).message}\n`);
      return EXIT_USAGE_ERROR;
    }

    ctx.stdout(`${format === "json" ? formatPlanJson(plan) : formatPlanMarkdown(plan)}\n`);
    return EXIT_SUCCESS;
  },
};
