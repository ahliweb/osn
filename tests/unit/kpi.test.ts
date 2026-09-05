/**
 * Tests for the §6.3 mentor KPI metric definitions
 * (`src/schema/kpi.ts`, `data/kpi-definitions.json`) and the pure
 * computation functions over `LearningRecord`s (`src/domain/kpi.ts`).
 *
 * Every fixture below is a synthetic, obviously-fake `lr_...` learner ref
 * passed through `parseLearningRecord` (issue #15), so every fixture is
 * provably a valid `LearningRecord` -- never a hand-shaped object that
 * merely looks like one. Expected values for each metric are computed by
 * hand in the comment above each assertion and written as literals, never
 * recomputed by calling the function under test on itself.
 */

import { describe, expect, test } from "bun:test";
import {
  complexitySelectionAccuracy,
  contestTimeAllocation,
  getKpiDefinition,
  type KpiResult,
  kpiCaveat,
  listKpiDefinitions,
  repeatSolveRetention,
  statusDistributionByTopic,
  timeToFirstCorrect,
  upsolveCompletionRate,
  verdictFrequency,
} from "../../src/domain/kpi";
import { parseLearningRecord } from "../../src/domain/learning-record";
import {
  KPI_METRIC_IDS,
  kpiDefinitionSchema,
  kpiDefinitionsFileSchema,
} from "../../src/schema/kpi";
import { LEARNING_RECORD_CLASSIFICATION } from "../../src/schema/learning-record";

// --- fixture helpers ---------------------------------------------------------

/** A well-formed base record shape, overridden per fixture below. */
const BASE_RECORD = {
  learnerRef: "lr_aaaa1111",
  problemId: "problem-1",
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

/**
 * Builds one valid `LearningRecord` from {@link BASE_RECORD} plus
 * `overrides`, passed through {@link parseLearningRecord} so every fixture
 * used below is provably schema-valid, not merely shaped like one.
 */
function record(overrides: Partial<Record<string, unknown>>) {
  return parseLearningRecord({ ...BASE_RECORD, ...overrides });
}

/** Recursively asserts every number reachable from `value` is finite (never `NaN`/`Infinity`/`-Infinity`). */
function assertAllFinite(value: unknown, path = "root"): void {
  if (typeof value === "number") {
    expect(Number.isFinite(value), `${path} = ${value} is not finite`).toBe(true);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      assertAllFinite(entry, `${path}[${index}]`);
    });
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      assertAllFinite(entry, `${path}.${key}`);
    }
  }
}

/** Asserts `result` is finite if it is a value, or has a non-empty reason if insufficient. */
function assertResultIsWellFormed<T>(result: KpiResult<T>): void {
  if (result.kind === "value") {
    assertAllFinite(result.value);
  } else {
    expect(result.reason.length).toBeGreaterThan(0);
  }
}

// --- KPI metric definitions --------------------------------------------------

describe("data/kpi-definitions.json (via src/domain/kpi.ts)", () => {
  test("the real data file parses through the schema without error", () => {
    expect(() => listKpiDefinitions()).not.toThrow();
  });

  test("exposes exactly the seven expected metric ids, in order", () => {
    const ids = listKpiDefinitions().map((metric) => metric.id);
    expect(ids).toEqual([...KPI_METRIC_IDS]);
    expect(ids).toEqual([
      "status-distribution",
      "time-to-first-correct",
      "verdict-frequency",
      "upsolve-completion",
      "repeat-solve-retention",
      "complexity-selection-accuracy",
      "contest-time-allocation",
    ]);
  });

  test("every metric has non-empty name, purpose and interpretation", () => {
    for (const metric of listKpiDefinitions()) {
      expect(metric.name.length).toBeGreaterThan(0);
      expect(metric.purpose.length).toBeGreaterThan(0);
      expect(metric.interpretation.length).toBeGreaterThan(0);
    }
  });

  test("every metric's inputs are real, non-empty learning-record field names", () => {
    const validFields = new Set(Object.keys(LEARNING_RECORD_CLASSIFICATION));
    for (const metric of listKpiDefinitions()) {
      expect(metric.inputs.length).toBeGreaterThan(0);
      for (const input of metric.inputs) {
        expect(validFields.has(input), `"${input}" is not a real learning-record field`).toBe(true);
      }
    }
  });

  test("kpiCaveat() returns the non-empty §14.2 rule 7 caveat, verbatim", () => {
    expect(kpiCaveat().length).toBeGreaterThan(0);
    expect(kpiCaveat()).toBe(
      "Jumlah soal bukan satu-satunya KPI; mastery dan transfer lebih penting.",
    );
  });
});

describe("getKpiDefinition", () => {
  test("returns the matching definition for a known id", () => {
    expect(getKpiDefinition("upsolve-completion").name).toBe("Upsolve completion");
  });

  test("throws a helpful error listing every valid id for an unknown id", () => {
    expect(() => getKpiDefinition("not-a-metric")).toThrow(/status-distribution/);
    expect(() => getKpiDefinition("not-a-metric")).toThrow(/contest-time-allocation/);
  });
});

describe("kpiDefinitionSchema (inline fixtures, real data file untouched)", () => {
  const validDefinition = {
    id: "upsolve-completion",
    name: "Upsolve completion",
    purpose: "Mengukur pembelajaran setelah contest.",
    unit: "percent",
    direction: "higher-better",
    inputs: ["resolveStatus"],
    interpretation: "Share of records requiring a re-solve that reached completed.",
  };

  test("accepts a well-formed definition", () => {
    expect(kpiDefinitionSchema.safeParse(validDefinition).success).toBe(true);
  });

  test("rejects an inputs entry that is not a real learning-record field, naming it and listing valid fields", () => {
    const result = kpiDefinitionSchema.safeParse({
      ...validDefinition,
      inputs: ["resolveStatus", "notARealField"],
    });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("unreachable");
    const messages = result.error.issues.map((issue) => issue.message).join("\n");
    expect(messages).toContain("notARealField");
    expect(messages).toContain("learnerRef");
  });

  test("rejects an empty inputs array", () => {
    expect(kpiDefinitionSchema.safeParse({ ...validDefinition, inputs: [] }).success).toBe(false);
  });

  test("rejects an unknown metric id", () => {
    expect(
      kpiDefinitionSchema.safeParse({ ...validDefinition, id: "not-a-real-metric" }).success,
    ).toBe(false);
  });
});

describe("kpiDefinitionsFileSchema (inline fixtures)", () => {
  const validFile = {
    syllabusVersion: "2.0",
    syllabusDate: "2026-09-04",
    sourceSection: "§6.3",
    caveat: "Jumlah soal bukan satu-satunya KPI; mastery dan transfer lebih penting.",
    metrics: listKpiDefinitions(),
  };

  test("accepts the real seven-metric file", () => {
    expect(kpiDefinitionsFileSchema.safeParse(validFile).success).toBe(true);
  });

  test("rejects a file with a duplicate metric id (two of the same, one missing)", () => {
    const metrics = [...validFile.metrics];
    metrics[1] = metrics[0] as (typeof metrics)[number];
    const result = kpiDefinitionsFileSchema.safeParse({ ...validFile, metrics });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("unreachable");
    const messages = result.error.issues.map((issue) => issue.message).join("\n");
    expect(messages).toContain("must contain exactly the 7 ids");
  });

  test("rejects a file with fewer than the seven expected metrics", () => {
    const result = kpiDefinitionsFileSchema.safeParse({
      ...validFile,
      metrics: validFile.metrics.slice(0, 6),
    });
    expect(result.success).toBe(false);
  });
});

// --- 1. statusDistributionByTopic --------------------------------------------

describe("statusDistributionByTopic", () => {
  function resolveTopic(problemId: string): string | undefined {
    if (problemId.startsWith("problem-a")) return "topic-x";
    if (problemId.startsWith("problem-b")) return "topic-y";
    return undefined;
  }

  test("hand-verified: 7 records across two topics plus an unresolvable one", () => {
    const records = [
      record({ problemId: "problem-a-1", status: "A" }),
      record({ problemId: "problem-a-1", status: "B" }),
      record({ problemId: "problem-a-2", status: "A" }),
      record({ problemId: "problem-b-1", status: "C" }),
      record({ problemId: "problem-b-1", status: "D" }),
      record({ problemId: "problem-unknown-1", status: "A" }),
      record({ problemId: "problem-unknown-1", status: "B" }),
    ];

    const result = statusDistributionByTopic(records, resolveTopic);
    expect(result.kind).toBe("value");
    if (result.kind !== "value") throw new Error("unreachable");

    // topic-x: A,B,A -> A=2 B=1 C=0 D=0, total 3
    // topic-y: C,D -> A=0 B=0 C=1 D=1, total 2
    // unresolved: A,B -> A=1 B=1 C=0 D=0, total 2
    expect(result.value).toEqual({
      topics: [
        {
          topic: "topic-x",
          total: 3,
          counts: { A: 2, B: 1, C: 0, D: 0 },
          shares: { A: 2 / 3, B: 1 / 3, C: 0, D: 0 },
        },
        {
          topic: "topic-y",
          total: 2,
          counts: { A: 0, B: 0, C: 1, D: 1 },
          shares: { A: 0, B: 0, C: 0.5, D: 0.5 },
        },
        {
          topic: "unresolved",
          total: 2,
          counts: { A: 1, B: 1, C: 0, D: 0 },
          shares: { A: 0.5, B: 0.5, C: 0, D: 0 },
        },
      ],
      totalRecords: 7,
    });
  });

  test("unresolvable topics land in the explicit unresolved bucket, never dropped (counts sum to input length)", () => {
    const records = [
      record({ problemId: "problem-z-1", status: "A" }),
      record({ problemId: "problem-z-2", status: "B" }),
      record({ problemId: "problem-z-3", status: "D" }),
    ];
    const result = statusDistributionByTopic(records, () => undefined);
    expect(result.kind).toBe("value");
    if (result.kind !== "value") throw new Error("unreachable");

    const sumOfTotals = result.value.topics.reduce((sum, topic) => sum + topic.total, 0);
    expect(sumOfTotals).toBe(records.length);
    expect(result.value.topics).toHaveLength(1);
    expect(result.value.topics[0]?.topic).toBe("unresolved");
  });

  test("single record produces a one-topic, one-status result", () => {
    const result = statusDistributionByTopic(
      [record({ problemId: "problem-a-1", status: "A" })],
      resolveTopic,
    );
    expect(result.kind).toBe("value");
    if (result.kind !== "value") throw new Error("unreachable");
    expect(result.value).toEqual({
      topics: [
        {
          topic: "topic-x",
          total: 1,
          counts: { A: 1, B: 0, C: 0, D: 0 },
          shares: { A: 1, B: 0, C: 0, D: 0 },
        },
      ],
      totalRecords: 1,
    });
  });

  test("empty input is insufficient data, with a non-empty reason", () => {
    const result = statusDistributionByTopic([], resolveTopic);
    expect(result.kind).toBe("insufficient-data");
    if (result.kind !== "insufficient-data") throw new Error("unreachable");
    expect(result.reason.length).toBeGreaterThan(0);
  });
});

// --- 2. timeToFirstCorrect ----------------------------------------------------

describe("timeToFirstCorrect", () => {
  test("hand-verified: two learners across three problems, some with multiple AC attempts", () => {
    const records = [
      // learner A, problem-1: WA then AC(120) -> first AC duration 120
      record({
        learnerRef: "lr_aaaa1111",
        problemId: "problem-1",
        attemptNo: 1,
        verdict: "WA",
        durationSeconds: 50,
      }),
      record({
        learnerRef: "lr_aaaa1111",
        problemId: "problem-1",
        attemptNo: 2,
        verdict: "AC",
        durationSeconds: 120,
      }),
      // learner A, problem-2: AC(200) on first try
      record({
        learnerRef: "lr_aaaa1111",
        problemId: "problem-2",
        attemptNo: 1,
        verdict: "AC",
        durationSeconds: 200,
      }),
      // learner B, problem-1: AC(80) then a later AC(60) re-solve -> first AC is attemptNo 1, duration 80
      record({
        learnerRef: "lr_bbbb2222",
        problemId: "problem-1",
        attemptNo: 1,
        verdict: "AC",
        durationSeconds: 80,
      }),
      record({
        learnerRef: "lr_bbbb2222",
        problemId: "problem-1",
        attemptNo: 2,
        verdict: "AC",
        durationSeconds: 60,
      }),
      // learner B, problem-3: never accepted -> excluded entirely
      record({
        learnerRef: "lr_bbbb2222",
        problemId: "problem-3",
        attemptNo: 1,
        verdict: "WA",
        durationSeconds: 30,
      }),
    ];

    const result = timeToFirstCorrect(records);
    expect(result.kind).toBe("value");
    if (result.kind !== "value") throw new Error("unreachable");

    // samples: [120, 200, 80] -> sorted [80, 120, 200]
    // median (n=3, middle index 1) = 120
    // mean = (120 + 200 + 80) / 3 = 400 / 3
    expect(result.value.sampleSize).toBe(3);
    expect(result.value.medianSeconds).toBe(120);
    expect(result.value.meanSeconds).toBe(400 / 3);
  });

  test("single AC record", () => {
    const result = timeToFirstCorrect([
      record({
        learnerRef: "lr_cccc3333",
        problemId: "problem-9",
        attemptNo: 1,
        verdict: "AC",
        durationSeconds: 45,
      }),
    ]);
    expect(result.kind).toBe("value");
    if (result.kind !== "value") throw new Error("unreachable");
    expect(result.value).toEqual({ sampleSize: 1, medianSeconds: 45, meanSeconds: 45 });
  });

  test("no AC records at all is insufficient data, with a non-empty reason", () => {
    const result = timeToFirstCorrect([record({ verdict: "WA" }), record({ verdict: "TLE" })]);
    expect(result.kind).toBe("insufficient-data");
    if (result.kind !== "insufficient-data") throw new Error("unreachable");
    expect(result.reason.length).toBeGreaterThan(0);
  });

  test("empty input is insufficient data", () => {
    const result = timeToFirstCorrect([]);
    expect(result.kind).toBe("insufficient-data");
    if (result.kind !== "insufficient-data") throw new Error("unreachable");
    expect(result.reason.length).toBeGreaterThan(0);
  });
});

// --- 3. verdictFrequency ------------------------------------------------------

describe("verdictFrequency", () => {
  test("hand-verified: 6 attempts with a mix of verdicts", () => {
    const records = [
      record({ verdict: "AC" }),
      record({ verdict: "WA" }),
      record({ verdict: "WA" }),
      record({ verdict: "TLE" }),
      record({ verdict: "RE" }),
      record({ verdict: "CE" }),
    ];
    const result = verdictFrequency(records);
    expect(result.kind).toBe("value");
    if (result.kind !== "value") throw new Error("unreachable");

    // WA=2, TLE=1, RE=1, total=6
    expect(result.value).toEqual({
      totalAttempts: 6,
      counts: { WA: 2, TLE: 1, RE: 1 },
      shares: { WA: 2 / 6, TLE: 1 / 6, RE: 1 / 6 },
    });
  });

  test("single record with a verdict outside WA/TLE/RE", () => {
    const result = verdictFrequency([record({ verdict: "MLE" })]);
    expect(result.kind).toBe("value");
    if (result.kind !== "value") throw new Error("unreachable");
    expect(result.value).toEqual({
      totalAttempts: 1,
      counts: { WA: 0, TLE: 0, RE: 0 },
      shares: { WA: 0, TLE: 0, RE: 0 },
    });
  });

  test("empty input is insufficient data", () => {
    const result = verdictFrequency([]);
    expect(result.kind).toBe("insufficient-data");
    if (result.kind !== "insufficient-data") throw new Error("unreachable");
    expect(result.reason.length).toBeGreaterThan(0);
  });
});

// --- 4. upsolveCompletionRate --------------------------------------------------

describe("upsolveCompletionRate", () => {
  test("hand-verified: 5 records, 4 requiring a re-solve, 2 completed", () => {
    const records = [
      record({ resolveStatus: "not-required" }),
      record({ resolveStatus: "scheduled" }),
      record({ resolveStatus: "completed" }),
      record({ resolveStatus: "completed" }),
      record({ resolveStatus: "overdue" }),
    ];
    const result = upsolveCompletionRate(records);
    expect(result.kind).toBe("value");
    if (result.kind !== "value") throw new Error("unreachable");

    // required = scheduled + completed + completed + overdue = 4
    // completed = 2 -> rate 2/4 = 0.5
    expect(result.value).toEqual({ requiredCount: 4, completedCount: 2, completionRate: 0.5 });
  });

  test("single record requiring a re-solve, not yet completed", () => {
    const result = upsolveCompletionRate([record({ resolveStatus: "scheduled" })]);
    expect(result.kind).toBe("value");
    if (result.kind !== "value") throw new Error("unreachable");
    expect(result.value).toEqual({ requiredCount: 1, completedCount: 0, completionRate: 0 });
  });

  test("nothing requiring a re-solve is insufficient data", () => {
    const result = upsolveCompletionRate([record({ resolveStatus: "not-required" })]);
    expect(result.kind).toBe("insufficient-data");
    if (result.kind !== "insufficient-data") throw new Error("unreachable");
    expect(result.reason.length).toBeGreaterThan(0);
  });

  test("empty input is insufficient data", () => {
    const result = upsolveCompletionRate([]);
    expect(result.kind).toBe("insufficient-data");
    if (result.kind !== "insufficient-data") throw new Error("unreachable");
    expect(result.reason.length).toBeGreaterThan(0);
  });
});

// --- 5. repeatSolveRetention ---------------------------------------------------

describe("repeatSolveRetention", () => {
  test("hand-verified: 4 completed re-solves, only 1 clean", () => {
    const records = [
      // clean: no hint, no editorial, AC -> retained
      record({
        resolveStatus: "completed",
        hintLevelUsed: null,
        usedEditorial: false,
        verdict: "AC",
      }),
      // used a hint -> not retained
      record({ resolveStatus: "completed", hintLevelUsed: 2, usedEditorial: false, verdict: "AC" }),
      // used the editorial -> not retained
      record({
        resolveStatus: "completed",
        hintLevelUsed: null,
        usedEditorial: true,
        verdict: "AC",
      }),
      // still failed -> not retained
      record({
        resolveStatus: "completed",
        hintLevelUsed: null,
        usedEditorial: false,
        verdict: "WA",
      }),
      // not a completed re-solve at all -> excluded from the denominator
      record({
        resolveStatus: "scheduled",
        hintLevelUsed: null,
        usedEditorial: false,
        verdict: "AC",
      }),
    ];
    const result = repeatSolveRetention(records);
    expect(result.kind).toBe("value");
    if (result.kind !== "value") throw new Error("unreachable");

    // resolved = 4 completed records; retained = 1 (only the first) -> rate 1/4 = 0.25
    expect(result.value).toEqual({ resolvedCount: 4, retainedCount: 1, retentionRate: 0.25 });
  });

  test("single completed re-solve meeting the retention criteria", () => {
    const result = repeatSolveRetention([
      record({
        resolveStatus: "completed",
        hintLevelUsed: null,
        usedEditorial: false,
        verdict: "AC",
      }),
    ]);
    expect(result.kind).toBe("value");
    if (result.kind !== "value") throw new Error("unreachable");
    expect(result.value).toEqual({ resolvedCount: 1, retainedCount: 1, retentionRate: 1 });
  });

  test("no completed re-solves is insufficient data", () => {
    const result = repeatSolveRetention([record({ resolveStatus: "scheduled" })]);
    expect(result.kind).toBe("insufficient-data");
    if (result.kind !== "insufficient-data") throw new Error("unreachable");
    expect(result.reason.length).toBeGreaterThan(0);
  });

  test("empty input is insufficient data", () => {
    const result = repeatSolveRetention([]);
    expect(result.kind).toBe("insufficient-data");
    if (result.kind !== "insufficient-data") throw new Error("unreachable");
    expect(result.reason.length).toBeGreaterThan(0);
  });
});

// --- 6. complexitySelectionAccuracy --------------------------------------------

describe("complexitySelectionAccuracy", () => {
  test("hand-verified: 5 attempts, 2 TLE", () => {
    const records = [
      record({ verdict: "TLE" }),
      record({ verdict: "TLE" }),
      record({ verdict: "AC" }),
      record({ verdict: "WA" }),
      record({ verdict: "RE" }),
    ];
    const result = complexitySelectionAccuracy(records);
    expect(result.kind).toBe("value");
    if (result.kind !== "value") throw new Error("unreachable");

    // tle=2, nonTle=3, total=5 -> accuracy 3/5 = 0.6
    expect(result.value).toEqual({ totalAttempts: 5, tleCount: 2, nonTleCount: 3, accuracy: 0.6 });
  });

  test("single TLE record", () => {
    const result = complexitySelectionAccuracy([record({ verdict: "TLE" })]);
    expect(result.kind).toBe("value");
    if (result.kind !== "value") throw new Error("unreachable");
    expect(result.value).toEqual({ totalAttempts: 1, tleCount: 1, nonTleCount: 0, accuracy: 0 });
  });

  test("empty input is insufficient data", () => {
    const result = complexitySelectionAccuracy([]);
    expect(result.kind).toBe("insufficient-data");
    if (result.kind !== "insufficient-data") throw new Error("unreachable");
    expect(result.reason.length).toBeGreaterThan(0);
  });
});

// --- 7. contestTimeAllocation ---------------------------------------------------

describe("contestTimeAllocation", () => {
  test("hand-verified: 5 attempts, 2 ending unsolved (status D)", () => {
    const records = [
      record({ durationSeconds: 100, status: "A" }),
      record({ durationSeconds: 200, status: "B" }),
      record({ durationSeconds: 300, status: "C" }),
      record({ durationSeconds: 400, status: "D" }),
      record({ durationSeconds: 500, status: "D" }),
    ];
    const result = contestTimeAllocation(records);
    expect(result.kind).toBe("value");
    if (result.kind !== "value") throw new Error("unreachable");

    // total = 100+200+300+400+500 = 1500; mean = 1500/5 = 300
    // sorted = [100,200,300,400,500]; median (n=5, mid index 2) = 300
    // max = 500; unsolved seconds = 400+500 = 900 -> share 900/1500 = 0.6
    expect(result.value).toEqual({
      attemptCount: 5,
      totalSeconds: 1500,
      meanSeconds: 300,
      medianSeconds: 300,
      maxSeconds: 500,
      unsolvedTimeShare: 0.6,
    });
  });

  test("single record, not unsolved", () => {
    const result = contestTimeAllocation([record({ durationSeconds: 50, status: "A" })]);
    expect(result.kind).toBe("value");
    if (result.kind !== "value") throw new Error("unreachable");
    expect(result.value).toEqual({
      attemptCount: 1,
      totalSeconds: 50,
      meanSeconds: 50,
      medianSeconds: 50,
      maxSeconds: 50,
      unsolvedTimeShare: 0,
    });
  });

  test("all-zero durations never produce NaN (unsolvedTimeShare is 0, not NaN)", () => {
    const records = [
      record({ durationSeconds: 0, status: "D" }),
      record({ durationSeconds: 0, status: "D" }),
      record({ durationSeconds: 0, status: "A" }),
    ];
    const result = contestTimeAllocation(records);
    expect(result.kind).toBe("value");
    if (result.kind !== "value") throw new Error("unreachable");
    expect(result.value).toEqual({
      attemptCount: 3,
      totalSeconds: 0,
      meanSeconds: 0,
      medianSeconds: 0,
      maxSeconds: 0,
      unsolvedTimeShare: 0,
    });
  });

  test("empty input is insufficient data", () => {
    const result = contestTimeAllocation([]);
    expect(result.kind).toBe("insufficient-data");
    if (result.kind !== "insufficient-data") throw new Error("unreachable");
    expect(result.reason.length).toBeGreaterThan(0);
  });
});

// --- cross-cutting: no NaN/Infinity ever ----------------------------------------

describe("no metric ever returns NaN or Infinity, across degenerate inputs", () => {
  function resolveNone(): string | undefined {
    return undefined;
  }
  function resolveAll(): string | undefined {
    return "some-topic";
  }

  const degenerateInputSets: Record<string, () => ReturnType<typeof record>[]> = {
    empty: () => [],
    "single record": () => [record({})],
    "all-zero durations": () => [
      record({ durationSeconds: 0 }),
      record({ durationSeconds: 0, status: "D" }),
      record({ durationSeconds: 0, verdict: "TLE" }),
    ],
    "all TLE": () => [
      record({ verdict: "TLE" }),
      record({ verdict: "TLE" }),
      record({ verdict: "TLE" }),
    ],
    "all AC": () => [
      record({ verdict: "AC", learnerRef: "lr_dddd4444", attemptNo: 1 }),
      record({ verdict: "AC", learnerRef: "lr_eeee5555", attemptNo: 1 }),
    ],
    "all resolveStatus completed": () => [
      record({ resolveStatus: "completed" }),
      record({ resolveStatus: "completed" }),
    ],
    "unresolvable topics": () => [
      record({ problemId: "mystery-1" }),
      record({ problemId: "mystery-2", status: "D" }),
    ],
  };

  for (const [label, buildRecords] of Object.entries(degenerateInputSets)) {
    test(`${label}`, () => {
      const records = buildRecords();
      assertResultIsWellFormed(statusDistributionByTopic(records, resolveNone));
      assertResultIsWellFormed(statusDistributionByTopic(records, resolveAll));
      assertResultIsWellFormed(timeToFirstCorrect(records));
      assertResultIsWellFormed(verdictFrequency(records));
      assertResultIsWellFormed(upsolveCompletionRate(records));
      assertResultIsWellFormed(repeatSolveRetention(records));
      assertResultIsWellFormed(complexitySelectionAccuracy(records));
      assertResultIsWellFormed(contestTimeAllocation(records));
    });
  }
});
