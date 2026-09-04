/**
 * `osn render <weekly|checkpoint|sop>` -- turns validated corpus data into
 * mentor-facing Markdown artefacts (issue #21). See `src/render/weekly.ts`,
 * `src/render/checkpoint.ts` and `src/render/sop.ts` for the actual pure
 * rendering logic; this module is only the thin subcommand/flag parsing +
 * `--out`/`--force` file-writing + exit-code shell around them, per the
 * "Layering rules" in `docs/architecture/README.md` -- exactly the same
 * split `src/cli/commands/plan.ts` uses around `buildCohortPlan`.
 */

import { resolve } from "node:path";
import { renderCheckpointSheet } from "../../render/checkpoint";
import { RenderRequestError } from "../../render/errors";
import { renderSopCard } from "../../render/sop";
import { renderWeeklyPlan } from "../../render/weekly";
import type { Command } from "../command";
import { EXIT_SUCCESS, EXIT_USAGE_ERROR } from "../command";
import { writeOutputFile } from "../output-writer";

const SUBCOMMANDS = ["weekly", "checkpoint", "sop"] as const;
type RenderSubcommand = (typeof SUBCOMMANDS)[number];

function isRenderSubcommand(value: string | undefined): value is RenderSubcommand {
  return value !== undefined && (SUBCOMMANDS as readonly string[]).includes(value);
}

const HELP_TEXT = `osn render -- render mentor-facing Markdown artefacts

Turns the validated curriculum corpus into mentor-ready Markdown: a
weekly session plan (focus, content, outcome, both §5.1 120-minute
session templates, the SOP reminder, the hint ladder, the exit ticket,
and -- on a gate week -- the §4.1 gate evidence), a checkpoint sheet
(gate evidence, §6.1 rubric weights, the §6.2 A/B/C/D recording grid,
and the §6.3 KPI snapshot fields), or a one-page mentor SOP card (the
§5.2 seven-step SOP, minimum test checklist, post-Accepted questions,
and the §5.3 hint ladder).

Usage:
  osn render weekly --week <1-28> [--out <path>] [--force]
  osn render checkpoint --number <1-7> [--out <path>] [--force]
  osn render sop [--out <path>] [--force]

Options:
  --week <n>      Week number, 1-28. Required for "weekly".
  --number <n>    Checkpoint number, 1-7. Required for "checkpoint".
  --out <path>    Write the rendered Markdown to this path instead of
                  stdout.
  --force         Overwrite --out if it already exists. Without it, an
                  existing file at --out is left byte-for-byte untouched
                  and the command exits 2.
  -h, --help      Show this help.

Exit codes:
  0   success.
  2   usage error: missing/unknown subcommand, a missing required flag
      (--week/--number), --week/--number outside its valid range, or
      --out already exists without --force.`;

/** Extracts the value following the first occurrence of `flag` in `args`, or `undefined` if `flag` is absent (or has nothing after it). */
function readFlagValue(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
}

/** Parses `rawValue` as a plain base-10 integer (optionally signed), returning `null` for anything else -- no leading/trailing junk, no decimals, no scientific notation, no `Infinity`/`NaN`. */
function parseInteger(rawValue: string): number | null {
  const trimmed = rawValue.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    return null;
  }
  return Number(trimmed);
}

export const renderCommand: Command = {
  name: "render",
  summary: "Render mentor-facing Markdown artefacts (weekly plan, checkpoint sheet, SOP card).",
  help: () => HELP_TEXT,

  async run(args, ctx) {
    const subcommand = args[0];
    if (!isRenderSubcommand(subcommand)) {
      const problem =
        subcommand === undefined
          ? "a subcommand is required"
          : `unknown subcommand ${JSON.stringify(subcommand)}`;
      ctx.stderr(
        `osn render: ${problem}. Valid subcommands: ${SUBCOMMANDS.join(", ")}. Run "osn render --help" for usage.\n`,
      );
      return EXIT_USAGE_ERROR;
    }

    const rest = args.slice(1);
    let content: string;

    if (subcommand === "weekly") {
      const weekRaw = readFlagValue(rest, "--week");
      if (weekRaw === undefined) {
        ctx.stderr("osn render weekly: --week <1-28> is required.\n");
        return EXIT_USAGE_ERROR;
      }
      const week = parseInteger(weekRaw);
      if (week === null) {
        ctx.stderr(
          `osn render weekly: --week must be an integer (1-28); received ${JSON.stringify(weekRaw)}.\n`,
        );
        return EXIT_USAGE_ERROR;
      }
      try {
        content = renderWeeklyPlan(week);
      } catch (cause) {
        if (cause instanceof RenderRequestError) {
          ctx.stderr(`osn render weekly: ${cause.message}\n`);
          return EXIT_USAGE_ERROR;
        }
        throw cause;
      }
    } else if (subcommand === "checkpoint") {
      const numberRaw = readFlagValue(rest, "--number");
      if (numberRaw === undefined) {
        ctx.stderr("osn render checkpoint: --number <1-7> is required.\n");
        return EXIT_USAGE_ERROR;
      }
      const number = parseInteger(numberRaw);
      if (number === null) {
        ctx.stderr(
          `osn render checkpoint: --number must be an integer (1-7); received ${JSON.stringify(numberRaw)}.\n`,
        );
        return EXIT_USAGE_ERROR;
      }
      try {
        content = renderCheckpointSheet(number);
      } catch (cause) {
        if (cause instanceof RenderRequestError) {
          ctx.stderr(`osn render checkpoint: ${cause.message}\n`);
          return EXIT_USAGE_ERROR;
        }
        throw cause;
      }
    } else {
      content = renderSopCard();
    }

    const output = `${content}\n`;
    const outValue = readFlagValue(rest, "--out");

    if (outValue === undefined) {
      ctx.stdout(output);
      return EXIT_SUCCESS;
    }

    const force = rest.includes("--force");
    const outPath = resolve(ctx.cwd, outValue);
    const result = await writeOutputFile(outPath, output, force);

    if (!result.ok) {
      if (result.reason === "exists") {
        ctx.stderr(
          `osn render ${subcommand}: --out ${JSON.stringify(outValue)} already exists. Use --force to overwrite it.\n`,
        );
      } else {
        ctx.stderr(
          `osn render ${subcommand}: failed to write ${JSON.stringify(outValue)}: ${result.message}\n`,
        );
      }
      return EXIT_USAGE_ERROR;
    }

    ctx.stdout(`osn render ${subcommand}: wrote ${outValue}\n`);
    return EXIT_SUCCESS;
  },
};
