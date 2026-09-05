/**
 * Tests for the §14.1/§14.2 readiness-checklist/operational-rules/
 * syllabus-check schemas (`src/schema/readiness-checklist.ts`,
 * `src/schema/operational-rules.ts`, `src/schema/syllabus-check.ts`) and
 * the typed loader/lookup helpers over the real corpus
 * (`src/domain/operations.ts`, issue #25).
 *
 * Malformed-input fixtures are constructed inline against the schemas; the
 * real data files under `data/` are never mutated by these tests.
 */

import { describe, expect, test } from "bun:test";
import {
  daysSinceLastSyllabusCheck,
  getReadinessItem,
  latestSyllabusCheck,
  listOperationalRules,
  listReadinessItems,
  listSyllabusChecks,
  operationsCorpusVersion,
  quickPointer,
} from "../../src/domain/operations";
import { operationalRulesFileSchema } from "../../src/schema/operational-rules";
import { readinessChecklistFileSchema } from "../../src/schema/readiness-checklist";
import { syllabusCheckLogFileSchema } from "../../src/schema/syllabus-check";

const QUICK_POINTER_STAGES = [
  "Problem Solving",
  "C++",
  "Complexity",
  "Math/Logic",
  "Complete Search",
  "Greedy",
  "DP",
  "Graph/Tree",
  "Data Structures",
  "Contest Engineering",
] as const;

// --- data/readiness-checklist.json (via src/domain/operations.ts) -----------

describe("data/readiness-checklist.json (via src/domain/operations.ts)", () => {
  test("the real data file parses through the schema without error", () => {
    expect(() => listReadinessItems()).not.toThrow();
  });

  test("exposes exactly 8 readiness items", () => {
    expect(listReadinessItems()).toHaveLength(8);
  });

  test("every item has a unique id and non-empty item/verificationMethod/evidenceRequired", () => {
    const items = listReadinessItems();
    const ids = items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const item of items) {
      expect(item.item.length).toBeGreaterThan(0);
      expect(item.verificationMethod.length).toBeGreaterThan(0);
      expect(item.evidenceRequired.length).toBeGreaterThan(0);
    }
  });

  test("item ordering is stable and matches §14.1's own bullet order", () => {
    const ids = listReadinessItems().map((item) => item.id);
    expect(ids).toEqual([
      "verify-official-syllabus",
      "set-28-week-calendar",
      "run-diagnostic",
      "group-students-by-gap",
      "prepare-problem-bank",
      "prepare-judge-and-dashboard",
      "set-rubric-and-policies",
      "set-data-protection",
    ]);
  });

  test("getReadinessItem returns the matching item for a known id", () => {
    expect(getReadinessItem("run-diagnostic").item).toContain("diagnostic");
  });

  test("getReadinessItem throws a helpful error listing every valid id for an unknown id", () => {
    expect(() => getReadinessItem("does-not-exist")).toThrow(/does-not-exist/);

    try {
      getReadinessItem("does-not-exist");
      throw new Error("expected getReadinessItem to throw");
    } catch (error) {
      const message = (error as Error).message;
      for (const id of listReadinessItems().map((item) => item.id)) {
        expect(message).toContain(id);
      }
    }
  });

  test("operationsCorpusVersion reflects the real file's provenance", () => {
    const version = operationsCorpusVersion();
    expect(version.syllabusVersion.length).toBeGreaterThan(0);
    expect(version.syllabusDate.length).toBeGreaterThan(0);
  });
});

// --- data/operational-rules.json (via src/domain/operations.ts) ------------

describe("data/operational-rules.json (via src/domain/operations.ts)", () => {
  test("the real data file parses through the schema without error", () => {
    expect(() => listOperationalRules()).not.toThrow();
  });

  test("exposes exactly 8 rules, ordered 1..8", () => {
    const rules = listOperationalRules();
    expect(rules).toHaveLength(8);
    expect(rules.map((rule) => rule.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const rule of rules) {
      expect(rule.rule.length).toBeGreaterThan(0);
    }
  });

  test("rule 1 is the core-before-extension rule and rule 8 is the syllabus-check rule (§14.2 verbatim)", () => {
    const rules = listOperationalRules();
    expect(rules[0]?.rule).toBe("Core OSN harus lebih dahulu daripada extension.");
    expect(rules[7]?.rule).toBe(
      "Setiap versi silabus harus memiliki tanggal, changelog, dan syllabus check.",
    );
  });

  test("quickPointer has exactly 10 stages in the §14.2 callout's own order", () => {
    const pointer = quickPointer();
    expect(pointer.stages).toHaveLength(10);
    expect(pointer.stages).toEqual([...QUICK_POINTER_STAGES]);
  });

  test("quickPointer carries the callout's closing extension condition, verbatim", () => {
    expect(quickPointer().extensionCondition).toBe("Extension hanya setelah core stabil.");
  });
});

// --- data/syllabus-check-log.json (via src/domain/operations.ts) -----------

describe("data/syllabus-check-log.json (via src/domain/operations.ts)", () => {
  test("the real data file parses through the schema without error", () => {
    expect(() => listSyllabusChecks()).not.toThrow();
  });

  test("the log validates and is non-empty", () => {
    expect(listSyllabusChecks().length).toBeGreaterThan(0);
  });

  test("every entry has a checkedOn date, non-empty sources, a valid outcome, and non-empty notes", () => {
    for (const entry of listSyllabusChecks()) {
      expect(entry.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.sources.length).toBeGreaterThan(0);
      expect(["no-change", "change-detected"]).toContain(entry.outcome);
      expect(entry.notes.length).toBeGreaterThan(0);
      expect(Array.isArray(entry.resultingIssues)).toBe(true);
    }
  });

  test("the seeded entry cites R1/R2/R3/R7/R8 and does not claim a live network check was performed", () => {
    const latest = latestSyllabusCheck();
    expect(latest.sources).toEqual(["R1", "R2", "R3", "R7", "R8"]);
    expect(latest.notes.toLowerCase()).toContain("no live check");
    expect(latest.notes.toLowerCase()).toContain("no network access");
  });

  test("latestSyllabusCheck picks the entry with the greatest checkedOn date", () => {
    const latest = latestSyllabusCheck();
    for (const entry of listSyllabusChecks()) {
      expect(latest.checkedOn >= entry.checkedOn).toBe(true);
    }
  });
});

// --- daysSinceLastSyllabusCheck: UTC-safe, no mutation ----------------------

describe("daysSinceLastSyllabusCheck", () => {
  const latestCheckedOn = latestSyllabusCheck().checkedOn;
  const [year, month, day] = latestCheckedOn.split("-").map(Number) as [number, number, number];

  test("is 0 for the same calendar day as the latest check", () => {
    const asOf = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    expect(daysSinceLastSyllabusCheck(asOf)).toBe(0);
  });

  test("is a positive whole number of days for a later date", () => {
    const asOf = new Date(Date.UTC(year, month - 1, day + 5));
    expect(daysSinceLastSyllabusCheck(asOf)).toBe(5);
  });

  test("is exact across a month boundary", () => {
    // 30 days after the latest check, computed via epoch-millisecond
    // arithmetic (not calendar-naive day addition), so this is correct
    // regardless of which month(s) the 30-day span crosses.
    const latestMs = Date.UTC(year, month - 1, day);
    const asOf = new Date(latestMs + 30 * 24 * 60 * 60 * 1000);
    expect(daysSinceLastSyllabusCheck(asOf)).toBe(30);
  });

  test("does not mutate its asOf argument", () => {
    const asOf = new Date(Date.UTC(year, month - 1, day + 3, 15, 30, 0));
    const beforeMs = asOf.getTime();
    daysSinceLastSyllabusCheck(asOf);
    expect(asOf.getTime()).toBe(beforeMs);
  });

  test("is UTC-safe: reads UTC accessors only, independent of the Date's local-time components", () => {
    // A Date constructed at a UTC-midnight-crossing local hour would give a
    // different (wrong) answer if the implementation used local-timezone
    // accessors (getDate/getMonth/getFullYear) instead of getUTCDate/
    // getUTCMonth/getUTCFullYear. Constructing directly from a computed UTC
    // millisecond value and reading it back via toISOString() (always UTC)
    // is what lets this test run correctly under any TZ.
    const asOf = new Date(Date.UTC(year, month - 1, day + 1, 23, 59, 59));
    expect(asOf.toISOString().slice(0, 10)).not.toBe(latestCheckedOn);
    expect(daysSinceLastSyllabusCheck(asOf)).toBe(1);
  });
});

// --- readinessChecklistFileSchema (inline fixtures) -------------------------

describe("readinessChecklistFileSchema (inline fixtures, real data file untouched)", () => {
  function fileWithItems(ids: readonly string[]) {
    return {
      syllabusVersion: "2.0",
      syllabusDate: "2026-09-04",
      sourceSection: "§14.1",
      items: ids.map((id) => ({
        id,
        item: "Contoh item.",
        verificationMethod: "Contoh verifikasi.",
        evidenceRequired: "Contoh evidence.",
      })),
    };
  }

  const eightIds = [
    "item-one",
    "item-two",
    "item-three",
    "item-four",
    "item-five",
    "item-six",
    "item-seven",
    "item-eight",
  ];

  test("accepts a well-formed file with exactly eight unique-id items", () => {
    expect(readinessChecklistFileSchema.safeParse(fileWithItems(eightIds)).success).toBe(true);
  });

  test("rejects a file with fewer than eight items", () => {
    const result = readinessChecklistFileSchema.safeParse(fileWithItems(eightIds.slice(0, 7)));
    expect(result.success).toBe(false);
  });

  test("rejects a file with more than eight items", () => {
    const result = readinessChecklistFileSchema.safeParse(
      fileWithItems([...eightIds, "item-nine"]),
    );
    expect(result.success).toBe(false);
  });

  test("rejects a file with a duplicated id", () => {
    const duplicated = [...eightIds.slice(0, 7), "item-one"];
    const result = readinessChecklistFileSchema.safeParse(fileWithItems(duplicated));
    expect(result.success).toBe(false);
  });

  test("rejects an unknown extra field on an item (strict)", () => {
    const file = fileWithItems(eightIds);
    (file.items[0] as Record<string, unknown>).extra = "nope";
    expect(readinessChecklistFileSchema.safeParse(file).success).toBe(false);
  });
});

// --- operationalRulesFileSchema (inline fixtures) ---------------------------

describe("operationalRulesFileSchema (inline fixtures, real data file untouched)", () => {
  function fileWithOrders(orders: readonly number[]) {
    return {
      syllabusVersion: "2.0",
      syllabusDate: "2026-09-04",
      sourceSection: "§14.2",
      rules: orders.map((order) => ({ order, rule: "Contoh aturan." })),
      quickPointer: {
        stages: [...QUICK_POINTER_STAGES],
        extensionCondition: "Extension hanya setelah core stabil.",
      },
    };
  }

  test("accepts a well-formed file with rules ordered exactly 1..8", () => {
    expect(
      operationalRulesFileSchema.safeParse(fileWithOrders([1, 2, 3, 4, 5, 6, 7, 8])).success,
    ).toBe(true);
  });

  test("rejects a file missing one order value", () => {
    const result = operationalRulesFileSchema.safeParse(fileWithOrders([1, 2, 3, 4, 5, 6, 7]));
    expect(result.success).toBe(false);
  });

  test("rejects a file with a duplicated order value", () => {
    const result = operationalRulesFileSchema.safeParse(fileWithOrders([1, 2, 3, 4, 5, 6, 7, 7]));
    expect(result.success).toBe(false);
  });

  test("rejects a quickPointer with fewer than 10 stages", () => {
    const file = fileWithOrders([1, 2, 3, 4, 5, 6, 7, 8]);
    file.quickPointer.stages = file.quickPointer.stages.slice(0, 9);
    expect(operationalRulesFileSchema.safeParse(file).success).toBe(false);
  });

  test("rejects a quickPointer with more than 10 stages", () => {
    const file = fileWithOrders([1, 2, 3, 4, 5, 6, 7, 8]);
    (file.quickPointer.stages as string[]).push("Extra Stage");
    expect(operationalRulesFileSchema.safeParse(file).success).toBe(false);
  });

  test("rejects an empty extensionCondition", () => {
    const file = fileWithOrders([1, 2, 3, 4, 5, 6, 7, 8]);
    file.quickPointer.extensionCondition = "";
    expect(operationalRulesFileSchema.safeParse(file).success).toBe(false);
  });
});

// --- syllabusCheckLogFileSchema (inline fixtures) ---------------------------

describe("syllabusCheckLogFileSchema (inline fixtures, real data file untouched)", () => {
  const validEntry = {
    checkedOn: "2026-09-05",
    sources: ["R1", "R2"],
    outcome: "no-change" as const,
    notes: "Checked R1/R2 live; no differences found.",
    resultingIssues: [],
  };

  function fileWithChecks(checks: readonly unknown[]) {
    return {
      syllabusVersion: "2.0",
      syllabusDate: "2026-09-04",
      sourceSection: "§14.2",
      checks,
    };
  }

  test("accepts a well-formed file with one entry", () => {
    expect(syllabusCheckLogFileSchema.safeParse(fileWithChecks([validEntry])).success).toBe(true);
  });

  test("rejects an empty checks array", () => {
    expect(syllabusCheckLogFileSchema.safeParse(fileWithChecks([])).success).toBe(false);
  });

  test("rejects an entry with an empty sources array", () => {
    const result = syllabusCheckLogFileSchema.safeParse(
      fileWithChecks([{ ...validEntry, sources: [] }]),
    );
    expect(result.success).toBe(false);
  });

  test("rejects an entry with an invalid citation ref", () => {
    const result = syllabusCheckLogFileSchema.safeParse(
      fileWithChecks([{ ...validEntry, sources: ["R99"] }]),
    );
    expect(result.success).toBe(false);
  });

  test("rejects an entry with a malformed checkedOn", () => {
    const result = syllabusCheckLogFileSchema.safeParse(
      fileWithChecks([{ ...validEntry, checkedOn: "09-05-2026" }]),
    );
    expect(result.success).toBe(false);
  });

  test("rejects an entry with an invalid outcome", () => {
    const result = syllabusCheckLogFileSchema.safeParse(
      fileWithChecks([{ ...validEntry, outcome: "maybe" }]),
    );
    expect(result.success).toBe(false);
  });

  test("rejects an entry with empty notes", () => {
    const result = syllabusCheckLogFileSchema.safeParse(
      fileWithChecks([{ ...validEntry, notes: "" }]),
    );
    expect(result.success).toBe(false);
  });

  test("accepts an entry with an empty resultingIssues array", () => {
    expect(
      syllabusCheckLogFileSchema.safeParse(fileWithChecks([{ ...validEntry, resultingIssues: [] }]))
        .success,
    ).toBe(true);
  });

  test("rejects an unknown extra field (strict)", () => {
    const result = syllabusCheckLogFileSchema.safeParse(
      fileWithChecks([{ ...validEntry, extra: "nope" }]),
    );
    expect(result.success).toBe(false);
  });
});
