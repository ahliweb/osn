/**
 * Tests for `src/cli/format-report.ts`'s two `KpiReport` renderers,
 * exercised directly against `buildKpiReport` output -- including the
 * grouped-section path (`--by topic`/`--by week` with a resolver
 * supplied), which `osn report`'s own CLI tests never reach today since
 * this repository ships no topic/week resolver of its own (see
 * `docs/cli/README.md`'s "osn report" section, "Grouping"). Mirrors
 * `tests/unit/format-plan.test.ts`'s role for `osn plan`.
 */

import { describe, expect, test } from "bun:test";
import { formatReportJson, formatReportMarkdown } from "../../src/cli/format-report";
import { listKpiDefinitions } from "../../src/domain/kpi";
import { parseLearningRecord } from "../../src/domain/learning-record";
import { buildKpiReport } from "../../src/domain/report";

const BASE_RECORD = {
  learnerRef: "lr_fmttest01",
  problemId: "demo-problem-1",
  attemptNo: 1,
  verdict: "AC",
  durationSeconds: 100,
  hintLevelUsed: null,
  usedEditorial: false,
  errorTaxonomy: null,
  status: "A",
  resolveStatus: "not-required",
  recordedAt: "2026-09-04T10:00:00Z",
} as const;

function record(overrides: Partial<Record<string, unknown>>) {
  return parseLearningRecord({ ...BASE_RECORD, ...overrides });
}

describe("formatReportMarkdown: empty input", () => {
  test("renders a valid document with every metric marked insufficient data, and no scheduled re-solves", () => {
    const report = buildKpiReport({ records: [], groupBy: "none" });
    const markdown = formatReportMarkdown(report);

    expect(markdown).toContain("# osn report: mentor KPI dashboard");
    expect(markdown).toContain('Generated from 0 learning record(s), grouped by "none".');
    for (const definition of listKpiDefinitions()) {
      expect(markdown).toContain(definition.name);
    }
    expect(markdown).toContain("_Insufficient data:");
    expect(markdown).toContain("No records with status B or C in this input");
  });
});

describe("formatReportMarkdown: a small mixed batch", () => {
  const records = [
    record({ status: "A" }),
    record({
      attemptNo: 2,
      status: "B",
      verdict: "WA",
      errorTaxonomy: "conceptual",
      resolveStatus: "scheduled",
      recordedAt: "2026-09-01T10:00:00Z",
    }),
    record({
      attemptNo: 3,
      status: "C",
      verdict: "WA",
      errorTaxonomy: "modeling",
      resolveStatus: "completed",
      hintLevelUsed: 4,
      recordedAt: "2026-09-02T10:00:00Z",
    }),
  ];
  const report = buildKpiReport({ records, groupBy: "none" });
  const markdown = formatReportMarkdown(report);

  test("renders the record count and every KPI metric name", () => {
    expect(markdown).toContain("Generated from 3 learning record(s)");
    for (const definition of listKpiDefinitions()) {
      expect(markdown).toContain(definition.name);
    }
  });

  test("renders the postmortem table with the classes actually hit", () => {
    expect(markdown).toContain("Postmortem");
    expect(markdown).toContain("conceptual");
    expect(markdown).toContain("modeling");
  });

  test("renders the scheduled re-solves table, including a reimplement-and-resolve (status C) row", () => {
    expect(markdown).toContain("Scheduled re-solves");
    expect(markdown).toContain("reimplementation + explanation required");
  });

  test("has no group sections when groupBy is none", () => {
    expect(markdown).not.toContain("Grouped sections");
  });
});

describe("formatReportMarkdown: grouped by topic", () => {
  const records = [
    record({ problemId: "demo-problem-1" }),
    record({
      attemptNo: 2,
      problemId: "demo-problem-2",
      verdict: "WA",
      errorTaxonomy: "debugging",
    }),
    record({ attemptNo: 3, problemId: "demo-problem-unknown" }),
  ];
  const resolveTopic = (problemId: string) =>
    problemId === "demo-problem-1" || problemId === "demo-problem-2"
      ? "dasar-pemrograman"
      : undefined;
  const report = buildKpiReport({ records, groupBy: "topic", resolveTopic });
  const markdown = formatReportMarkdown(report);

  test("renders a 'Grouped sections' heading and one sub-section per group", () => {
    expect(markdown).toContain("## Grouped sections (by topic)");
    expect(markdown).toContain("### dasar-pemrograman (2 record(s))");
    expect(markdown).toContain("### unresolved (1 record(s))");
  });

  test("each group section still lists all seven KPI metric names", () => {
    for (const definition of listKpiDefinitions()) {
      expect(markdown).toContain(definition.name);
    }
  });
});

describe("formatReportMarkdown: grouped by week", () => {
  const records = [record({}), record({ attemptNo: 2 })];
  const report = buildKpiReport({ records, groupBy: "week", resolveWeek: () => 3 });
  const markdown = formatReportMarkdown(report);

  test("renders a week-numbered group section", () => {
    expect(markdown).toContain("## Grouped sections (by week)");
    expect(markdown).toContain("### 3 (2 record(s))");
  });
});

describe("formatReportJson", () => {
  test("round-trips through JSON.parse with the expected top-level shape", () => {
    const report = buildKpiReport({ records: [record({})], groupBy: "none" });
    const json = formatReportJson(report);
    const parsed = JSON.parse(json);

    expect(parsed.groupBy).toBe("none");
    expect(parsed.recordCount).toBe(1);
    expect(parsed.overall.metrics.statusDistribution.kind).toBe("value");
    expect(Array.isArray(parsed.scheduledResolves)).toBe(true);
  });
});
