/**
 * Formats a `KpiReport` (`src/domain/report.ts`) for `osn report`'s two
 * output modes: a human-readable Markdown mentor dashboard (the default)
 * and `--format json` (a stable, machine-readable shape -- the report
 * object itself, unmodified, mirroring `src/cli/format-plan.ts`'s split
 * for `osn plan` and `src/cli/format-audit.ts`'s for `osn validate`).
 */

import {
  type ComplexitySelectionAccuracyResult,
  type ContestTimeAllocationResult,
  getKpiDefinition,
  kpiCaveat,
  type RepeatSolveRetentionResult,
  type StatusDistributionResult,
  type TimeToFirstCorrectResult,
  type UpsolveCompletionResult,
  type VerdictFrequencyResult,
} from "../domain/kpi";
import {
  KPI_METRIC_REPORT_KEYS,
  type KpiReport,
  type KpiReportMetrics,
  type KpiReportSection,
  type ScheduledResolveEntry,
} from "../domain/report";
import type { KpiResult } from "../domain/kpi";

/** Escapes a value for safe embedding inside a Markdown table cell: no `|`, no newlines. */
function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

/** Renders a fraction as a percentage string with one decimal place, e.g. `0.6667` -> `"66.7%"`. */
function formatPercent(share: number): string {
  return `${(share * 100).toFixed(1)}%`;
}

/** Renders a seconds count with one decimal place, e.g. `"123.5s"`. */
function formatSeconds(seconds: number): string {
  return `${seconds.toFixed(1)}s`;
}

/** Formats one metric's `KpiResult<T>` as one or more Markdown lines: either `"insufficient data: <reason>"`, or a value-specific rendering supplied by `renderValue`. */
function formatKpiResult<T>(result: KpiResult<T>, renderValue: (value: T) => string[]): string[] {
  if (result.kind === "insufficient-data") {
    return [`_Insufficient data: ${result.reason}_`];
  }
  return renderValue(result.value);
}

function renderStatusDistribution(value: StatusDistributionResult): string[] {
  const lines: string[] = [`Total records: ${value.totalRecords}`, ""];
  lines.push("| Topic | Total | A | B | C | D |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const topic of value.topics) {
    lines.push(
      `| ${escapeCell(topic.topic)} | ${topic.total} | ` +
        `${topic.counts.A} (${formatPercent(topic.shares.A)}) | ` +
        `${topic.counts.B} (${formatPercent(topic.shares.B)}) | ` +
        `${topic.counts.C} (${formatPercent(topic.shares.C)}) | ` +
        `${topic.counts.D} (${formatPercent(topic.shares.D)}) |`,
    );
  }
  return lines;
}

function renderTimeToFirstCorrect(value: TimeToFirstCorrectResult): string[] {
  return [
    `Sample size (learner, problem) pairs with an AC: ${value.sampleSize}`,
    `Median: ${formatSeconds(value.medianSeconds)}. Mean: ${formatSeconds(value.meanSeconds)}.`,
  ];
}

function renderVerdictFrequency(value: VerdictFrequencyResult): string[] {
  return [
    `Total attempts: ${value.totalAttempts}`,
    `WA: ${value.counts.WA} (${formatPercent(value.shares.WA)}). ` +
      `TLE: ${value.counts.TLE} (${formatPercent(value.shares.TLE)}). ` +
      `RE: ${value.counts.RE} (${formatPercent(value.shares.RE)}).`,
  ];
}

function renderUpsolveCompletion(value: UpsolveCompletionResult): string[] {
  return [
    `Required a re-solve: ${value.requiredCount}. Completed: ${value.completedCount} ` +
      `(${formatPercent(value.completionRate)}).`,
  ];
}

function renderRepeatSolveRetention(value: RepeatSolveRetentionResult): string[] {
  return [
    `Completed re-solves: ${value.resolvedCount}. Retained (no hint, no editorial, AC): ` +
      `${value.retainedCount} (${formatPercent(value.retentionRate)}).`,
  ];
}

function renderComplexitySelectionAccuracy(value: ComplexitySelectionAccuracyResult): string[] {
  return [
    `Total attempts: ${value.totalAttempts}. TLE: ${value.tleCount}. Non-TLE (proxy accuracy): ` +
      `${value.nonTleCount} (${formatPercent(value.accuracy)}).`,
  ];
}

function renderContestTimeAllocation(value: ContestTimeAllocationResult): string[] {
  return [
    `Attempts: ${value.attemptCount}. Total: ${formatSeconds(value.totalSeconds)}. ` +
      `Mean: ${formatSeconds(value.meanSeconds)}. Median: ${formatSeconds(value.medianSeconds)}. ` +
      `Max: ${formatSeconds(value.maxSeconds)}.`,
    `Unsolved (status D) time share: ${formatPercent(value.unsolvedTimeShare)}.`,
  ];
}

/** Renders one {@link KpiReportSection}: a heading naming its label and record count, then all seven KPI metrics in §6.3 table order, each with its official name and purpose from `data/kpi-definitions.json`. */
function formatSection(section: KpiReportSection, headingLevel: 2 | 3): string[] {
  const heading = "#".repeat(headingLevel);
  const lines: string[] = [`${heading} ${section.label} (${section.recordCount} record(s))`, ""];

  for (const { id, key } of KPI_METRIC_REPORT_KEYS) {
    const definition = getKpiDefinition(id);
    lines.push(`${heading}# ${definition.name}`);
    lines.push("");
    lines.push(`_${definition.purpose}_`);
    lines.push("");

    const result = section.metrics[key];
    let rendered: string[];
    switch (key) {
      case "statusDistribution":
        rendered = formatKpiResult(
          result as KpiResult<StatusDistributionResult>,
          renderStatusDistribution,
        );
        break;
      case "timeToFirstCorrect":
        rendered = formatKpiResult(
          result as KpiResult<TimeToFirstCorrectResult>,
          renderTimeToFirstCorrect,
        );
        break;
      case "verdictFrequency":
        rendered = formatKpiResult(
          result as KpiResult<VerdictFrequencyResult>,
          renderVerdictFrequency,
        );
        break;
      case "upsolveCompletion":
        rendered = formatKpiResult(
          result as KpiResult<UpsolveCompletionResult>,
          renderUpsolveCompletion,
        );
        break;
      case "repeatSolveRetention":
        rendered = formatKpiResult(
          result as KpiResult<RepeatSolveRetentionResult>,
          renderRepeatSolveRetention,
        );
        break;
      case "complexitySelectionAccuracy":
        rendered = formatKpiResult(
          result as KpiResult<ComplexitySelectionAccuracyResult>,
          renderComplexitySelectionAccuracy,
        );
        break;
      default:
        rendered = formatKpiResult(
          result as KpiResult<ContestTimeAllocationResult>,
          renderContestTimeAllocation,
        );
        break;
    }
    lines.push(...rendered);
    lines.push("");
  }

  return lines;
}

function formatPostmortem(report: KpiReport): string[] {
  const lines: string[] = ["## Postmortem: §13.1 step-4 error-taxonomy classification", ""];
  if (report.postmortem.kind === "insufficient-data") {
    lines.push(`_Insufficient data: ${report.postmortem.reason}_`);
    return lines;
  }

  const { totalClassifiedErrors, classes } = report.postmortem.value;
  lines.push(`Total classified errors: ${totalClassifiedErrors}`, "");
  lines.push("| Error class | Count | Share |");
  lines.push("| --- | --- | --- |");
  for (const entry of classes) {
    lines.push(`| ${entry.errorClass} | ${entry.count} | ${formatPercent(entry.share)} |`);
  }
  return lines;
}

function formatScheduledResolveRow(entry: ScheduledResolveEntry): string {
  const earliest = entry.schedule.earliest.toISOString().slice(0, 10);
  const latest = entry.schedule.latest.toISOString().slice(0, 10);
  const extra =
    entry.schedule.kind === "reimplement-and-resolve"
      ? " (reimplementation + explanation required)"
      : "";
  return (
    `| ${escapeCell(entry.learnerRef)} | ${escapeCell(entry.problemId)} | ${entry.status} | ` +
    `${earliest} to ${latest} | ${escapeCell(entry.schedule.action)}${extra} |`
  );
}

function formatScheduledResolves(report: KpiReport): string[] {
  const lines: string[] = ["## Scheduled re-solves (§13.1 step-5 upsolve, status B/C)", ""];
  if (report.scheduledResolves.length === 0) {
    lines.push("_No records with status B or C in this input -- nothing scheduled._");
    return lines;
  }

  lines.push("| Learner | Problem | Status | Window | Action |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const entry of report.scheduledResolves) {
    lines.push(formatScheduledResolveRow(entry));
  }
  return lines;
}

/**
 * Renders a `KpiReport` as a Markdown document: a summary line, the
 * `overall` section's seven KPI metrics, the postmortem breakdown, the
 * scheduled-re-solves listing, and -- when `groupBy` is `"topic"`/`"week"`
 * -- one further section per resolved group.
 */
export function formatReportMarkdown(report: KpiReport): string {
  const lines: string[] = [];

  lines.push("# osn report: mentor KPI dashboard");
  lines.push("");
  lines.push(
    `Generated from ${report.recordCount} learning record(s), grouped by "${report.groupBy}".`,
  );
  lines.push(`§6.3 caveat: every metric below must be read alongside "${kpiCaveat()}"`);
  lines.push("");

  lines.push(...formatSection(report.overall, 2));

  lines.push(...formatPostmortem(report));
  lines.push("");
  lines.push(...formatScheduledResolves(report));

  if (report.groups.length > 0) {
    lines.push("");
    lines.push(`## Grouped sections (by ${report.groupBy})`);
    lines.push("");
    for (const group of report.groups) {
      lines.push(...formatSection(group, 3));
    }
  }

  return lines.join("\n");
}

/** Machine-readable `--format json` output for `osn report`: the `KpiReport` itself, pretty-printed. Every `Date` inside `scheduledResolves[*].schedule` serialises via `JSON.stringify`'s default `Date#toJSON` (ISO 8601 UTC). */
export function formatReportJson(report: KpiReport): string {
  return JSON.stringify(report, null, 2);
}

// Re-exported so KpiReportMetrics stays a documented part of this module's
// public surface for tests/tools that only import from format-report.ts.
export type { KpiReportMetrics };
