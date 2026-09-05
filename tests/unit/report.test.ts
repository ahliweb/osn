/**
 * Tests for `src/domain/report.ts` (`buildKpiReport`, `buildPostmortem`,
 * `buildScheduledResolves`) -- the reporting logic behind `osn report`
 * (issue #22).
 *
 * Every fixture below is a synthetic, obviously-fake `lr_...`/
 * `demo-problem-...` record passed through `parseLearningRecord` (issue
 * #15), so every fixture is provably a valid `LearningRecord` -- never a
 * hand-shaped object that merely looks like one.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getKpiDefinition, listKpiDefinitions } from "../../src/domain/kpi";
import { parseLearningRecord, parseLearningRecords } from "../../src/domain/learning-record";
import {
  buildKpiReport,
  buildPostmortem,
  buildScheduledResolves,
  KPI_METRIC_REPORT_KEYS,
  ReportRequestError,
} from "../../src/domain/report";
import { ERROR_TAXONOMY_CLASSES, findDirectIdentifiers } from "../../src/schema/learning-record";

const SAMPLE_PATH = join(
  import.meta.dir,
  "..",
  "..",
  "data",
  "samples",
  "learning-records.sample.jsonl",
);

function loadSampleRecords() {
  const text = readFileSync(SAMPLE_PATH, "utf-8");
  const values = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));
  return parseLearningRecords(values);
}

/** A well-formed base record shape, overridden per fixture below. */
const BASE_RECORD = {
  learnerRef: "lr_aaaa1111",
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

// --- sample dataset: schema + privacy sanity --------------------------------

describe("data/samples/learning-records.sample.jsonl", () => {
  test("every record passes parseLearningRecord (via parseLearningRecords)", () => {
    expect(() => loadSampleRecords()).not.toThrow();
  });

  test("has enough records to exercise every metric (40-60 range)", () => {
    const records = loadSampleRecords();
    expect(records.length).toBeGreaterThanOrEqual(40);
    expect(records.length).toBeLessThanOrEqual(60);
  });

  test("contains no denylisted identifier key anywhere", () => {
    const text = readFileSync(SAMPLE_PATH, "utf-8");
    const values = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line));
    for (const value of values) {
      expect(findDirectIdentifiers(value)).toEqual([]);
    }
  });

  test("every learnerRef is an obviously synthetic lr_demo... pseudonym", () => {
    for (const r of loadSampleRecords()) {
      expect(r.learnerRef).toMatch(/^lr_demo\d+$/);
    }
  });
});

// --- buildKpiReport: all seven KPIs appear ----------------------------------

describe("buildKpiReport: over the sample dataset", () => {
  const report = buildKpiReport({ records: loadSampleRecords(), groupBy: "none" });

  test("recordCount matches the input", () => {
    expect(report.recordCount).toBe(loadSampleRecords().length);
  });

  test("the overall section carries all seven §6.3 KPI metrics", () => {
    expect(KPI_METRIC_REPORT_KEYS).toHaveLength(7);
    for (const { id, key } of KPI_METRIC_REPORT_KEYS) {
      const definition = getKpiDefinition(id);
      expect(definition.name.length).toBeGreaterThan(0);
      expect(report.overall.metrics[key]).toBeDefined();
    }
  });

  test("every KPI metric id in kpi-definitions.json is represented", () => {
    const reportedIds = new Set(KPI_METRIC_REPORT_KEYS.map((entry) => entry.id));
    for (const definition of listKpiDefinitions()) {
      expect(reportedIds.has(definition.id)).toBe(true);
    }
  });

  test("groups is empty when groupBy is none", () => {
    expect(report.groups).toEqual([]);
  });

  test("statusDistribution is a real value (not insufficient-data) for a non-empty batch", () => {
    expect(report.overall.metrics.statusDistribution.kind).toBe("value");
  });
});

// --- postmortem: covers the five §13.1 step-4 classes -----------------------

describe("buildPostmortem", () => {
  test("insufficient data for an empty input", () => {
    const result = buildPostmortem([]);
    expect(result.kind).toBe("insufficient-data");
  });

  test("insufficient data when every record's errorTaxonomy is null (all AC)", () => {
    const records = [record({}), record({ attemptNo: 2 })];
    const result = buildPostmortem(records);
    expect(result.kind).toBe("insufficient-data");
  });

  test("covers all five §13.1 step-4 classes with counts and shares summing to totalClassifiedErrors", () => {
    const records = ERROR_TAXONOMY_CLASSES.map((errorClass, index) =>
      record({
        attemptNo: index + 1,
        verdict: "WA",
        errorTaxonomy: errorClass,
      }),
    );
    const result = buildPostmortem(records);
    expect(result.kind).toBe("value");
    if (result.kind !== "value") return;

    expect(result.value.totalClassifiedErrors).toBe(ERROR_TAXONOMY_CLASSES.length);
    expect(result.value.classes).toHaveLength(ERROR_TAXONOMY_CLASSES.length);
    expect(result.value.classes.map((entry) => entry.errorClass).sort()).toEqual(
      [...ERROR_TAXONOMY_CLASSES].sort(),
    );
    for (const entry of result.value.classes) {
      expect(entry.count).toBe(1);
      expect(entry.share).toBeCloseTo(1 / ERROR_TAXONOMY_CLASSES.length, 10);
    }
  });

  test("a class nobody hit is still listed, with count 0", () => {
    const records = [record({ verdict: "WA", errorTaxonomy: "conceptual" })];
    const result = buildPostmortem(records);
    expect(result.kind).toBe("value");
    if (result.kind !== "value") return;
    const debugging = result.value.classes.find((entry) => entry.errorClass === "debugging");
    expect(debugging).toBeDefined();
    expect(debugging?.count).toBe(0);
    expect(debugging?.share).toBe(0);
  });

  test("the sample dataset's postmortem covers all five classes", () => {
    const result = buildPostmortem(loadSampleRecords());
    expect(result.kind).toBe("value");
    if (result.kind !== "value") return;
    for (const errorClass of ERROR_TAXONOMY_CLASSES) {
      const entry = result.value.classes.find((candidate) => candidate.errorClass === errorClass);
      expect(entry).toBeDefined();
      expect(entry?.count).toBeGreaterThan(0);
    }
  });
});

// --- scheduled re-solves: appear for B/C records ----------------------------

describe("buildScheduledResolves", () => {
  test("empty for an empty input", () => {
    expect(buildScheduledResolves([])).toEqual([]);
  });

  test("empty when no record has status B or C", () => {
    const records = [record({ status: "A" }), record({ attemptNo: 2, status: "D" })];
    expect(buildScheduledResolves(records)).toEqual([]);
  });

  test("one entry per B/C record, with a scheduled-resolve/reimplement-and-resolve window", () => {
    const records = [
      record({ learnerRef: "lr_bbbb2222", status: "B", recordedAt: "2026-09-01T10:00:00Z" }),
      record({
        learnerRef: "lr_cccc3333",
        attemptNo: 2,
        status: "C",
        recordedAt: "2026-09-02T10:00:00Z",
      }),
      record({ learnerRef: "lr_dddd4444", attemptNo: 3, status: "A" }),
      record({ learnerRef: "lr_eeee5555", attemptNo: 4, status: "D" }),
    ];

    const entries = buildScheduledResolves(records);
    expect(entries).toHaveLength(2);

    const byLearner = new Map(entries.map((entry) => [entry.learnerRef, entry]));
    const bEntry = byLearner.get("lr_bbbb2222");
    expect(bEntry).toBeDefined();
    expect(bEntry?.status).toBe("B");
    expect(bEntry?.schedule.kind).toBe("scheduled-resolve");
    expect(bEntry?.schedule.earliest.getTime()).toBeLessThan(
      bEntry?.schedule.latest.getTime() ?? 0,
    );

    const cEntry = byLearner.get("lr_cccc3333");
    expect(cEntry).toBeDefined();
    expect(cEntry?.status).toBe("C");
    expect(cEntry?.schedule.kind).toBe("reimplement-and-resolve");
  });

  test("entries are sorted by the schedule's earliest date ascending", () => {
    const records = [
      record({ learnerRef: "lr_bbbb2222", status: "B", recordedAt: "2026-09-10T10:00:00Z" }),
      record({
        learnerRef: "lr_cccc3333",
        attemptNo: 2,
        status: "B",
        recordedAt: "2026-09-01T10:00:00Z",
      }),
    ];
    const entries = buildScheduledResolves(records);
    expect(entries.map((entry) => entry.learnerRef)).toEqual(["lr_cccc3333", "lr_bbbb2222"]);
  });

  test("the sample dataset's report includes scheduled re-solves for its B/C records", () => {
    const records = loadSampleRecords();
    const expectedCount = records.filter((r) => r.status === "B" || r.status === "C").length;
    expect(expectedCount).toBeGreaterThan(0);

    const report = buildKpiReport({ records, groupBy: "none" });
    expect(report.scheduledResolves).toHaveLength(expectedCount);
  });
});

// --- empty input: valid report, never crashes -------------------------------

describe("buildKpiReport: empty input", () => {
  test("produces a valid report whose metrics are all insufficient-data, without throwing", () => {
    let report: ReturnType<typeof buildKpiReport> | undefined;
    expect(() => {
      report = buildKpiReport({ records: [], groupBy: "none" });
    }).not.toThrow();

    expect(report).toBeDefined();
    if (report === undefined) return;

    expect(report.recordCount).toBe(0);
    expect(report.groups).toEqual([]);
    expect(report.scheduledResolves).toEqual([]);
    expect(report.postmortem.kind).toBe("insufficient-data");

    for (const { key } of KPI_METRIC_REPORT_KEYS) {
      expect(report.overall.metrics[key].kind).toBe("insufficient-data");
    }
  });

  test("a single record still produces a well-formed report", () => {
    const report = buildKpiReport({ records: [record({})], groupBy: "none" });
    expect(report.recordCount).toBe(1);
    expect(report.overall.metrics.statusDistribution.kind).toBe("value");
  });
});

// --- grouping without a resolver: actionable error, no silent fallback -----

describe("buildKpiReport: grouping requires a resolver", () => {
  test('groupBy "topic" without resolveTopic throws ReportRequestError naming resolveTopic', () => {
    expect(() => buildKpiReport({ records: [record({})], groupBy: "topic" })).toThrow(
      ReportRequestError,
    );
    try {
      buildKpiReport({ records: [record({})], groupBy: "topic" });
      throw new Error("unreachable: expected buildKpiReport to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ReportRequestError);
      expect((error as Error).message).toContain("resolveTopic");
      expect((error as Error).message.toLowerCase()).toContain("topic");
    }
  });

  test('groupBy "week" without resolveWeek throws ReportRequestError naming resolveWeek', () => {
    expect(() => buildKpiReport({ records: [record({})], groupBy: "week" })).toThrow(
      ReportRequestError,
    );
    try {
      buildKpiReport({ records: [record({})], groupBy: "week" });
      throw new Error("unreachable: expected buildKpiReport to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ReportRequestError);
      expect((error as Error).message).toContain("resolveWeek");
    }
  });

  test('groupBy "topic" with resolveTopic succeeds and partitions into groups', () => {
    const records = [
      record({ problemId: "demo-problem-1" }),
      record({ attemptNo: 2, problemId: "demo-problem-2" }),
      record({ attemptNo: 3, problemId: "demo-problem-unknown" }),
    ];
    const resolveTopic = (problemId: string) =>
      problemId === "demo-problem-1" || problemId === "demo-problem-2"
        ? "dasar-pemrograman"
        : undefined;

    const report = buildKpiReport({ records, groupBy: "topic", resolveTopic });
    expect(report.groups.length).toBeGreaterThan(0);
    const labels = report.groups.map((group) => group.label).sort();
    expect(labels).toEqual(["dasar-pemrograman", "unresolved"].sort());
  });

  test('groupBy "week" with resolveWeek succeeds and partitions into groups', () => {
    const records = [record({}), record({ attemptNo: 2 })];
    const resolveWeek = () => 1;
    const report = buildKpiReport({ records, groupBy: "week", resolveWeek });
    expect(report.groups).toHaveLength(1);
    expect(report.groups[0]?.label).toBe("1");
  });

  test('groupBy "none" never requires a resolver', () => {
    expect(() => buildKpiReport({ records: [record({})], groupBy: "none" })).not.toThrow();
  });
});
