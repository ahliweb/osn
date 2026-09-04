/**
 * Formats a `CohortPlan` (`src/domain/cohort-plan.ts`) for `osn plan`'s two
 * output modes: a human-readable Markdown calendar table (the default) and
 * `--format json` (a stable, machine-readable shape -- the plan object
 * itself, unmodified). Mirrors `src/cli/format-audit.ts`'s split for `osn
 * validate`.
 */

import type { CohortPlan, CohortWeekPlan } from "../domain/cohort-plan";

/** Escapes a value for safe embedding inside a Markdown table cell: no `|`, no newlines. */
function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

/** Renders one week as a Markdown table row. */
function formatWeekRow(week: CohortWeekPlan): string {
  const sessions = week.sessionDates.join(", ");
  const miniContest = week.hasMiniContest ? "yes" : "no";
  const checkpoint = week.checkpoint === null ? "-" : String(week.checkpoint);
  const gateEvidence = week.gateEvidence === null ? "-" : escapeCell(week.gateEvidence.join("; "));

  return (
    `| ${week.week} | ${week.startDate} | ${week.endDate} | ${escapeCell(week.focus)} | ` +
    `${sessions} | ${miniContest} | ${checkpoint} | ${gateEvidence} |`
  );
}

/**
 * Renders a `CohortPlan` as a Markdown document: a short summary (start
 * date, excluded dates, target stage, projected/baseline end dates), any
 * target-stage informational entry and warnings, then a 28-row calendar
 * table (one row per week).
 */
export function formatPlanMarkdown(plan: CohortPlan): string {
  const lines: string[] = [];

  lines.push("# osn plan: cohort calendar");
  lines.push("");
  lines.push(`Start date: ${plan.startDate}`);
  lines.push(
    plan.excludedDates.length > 0
      ? `Excluded dates (${plan.excludedDates.length}): ${plan.excludedDates.join(", ")}`
      : "Excluded dates: none",
  );
  lines.push(`Target stage: ${plan.targetStage ?? "none"}`);
  lines.push(
    `Projected end date: ${plan.projectedEndDate} (un-excluded baseline: ${plan.baselineEndDate})`,
  );

  if (plan.targetStageInfo !== null) {
    const info = plan.targetStageInfo;
    lines.push("");
    lines.push(
      `Target stage "${info.stageId}" (${info.stageName}): intensive preparation lands on ` +
        `week ${info.intensiveWeek}, ${info.intensiveWeekStartDate} to ` +
        `${info.intensiveWeekEndDate}. ${info.note}`,
    );
  }

  if (plan.warnings.length > 0) {
    lines.push("");
    for (const warning of plan.warnings) {
      lines.push(`WARNING: ${warning}`);
    }
  }

  lines.push("");
  lines.push(
    "| Week | Start | End | Focus | Sessions | Mini-contest | Checkpoint | Gate evidence |",
  );
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const week of plan.weeks) {
    lines.push(formatWeekRow(week));
  }

  return lines.join("\n");
}

/** Machine-readable `--format json` output for `osn plan`: the `CohortPlan` itself, pretty-printed. */
export function formatPlanJson(plan: CohortPlan): string {
  return JSON.stringify(plan, null, 2);
}
