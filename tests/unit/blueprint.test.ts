/**
 * Tests for the assessment-bank schema (`src/schema/assessment-bank.ts`)
 * and the typed loader/lookup/blueprint-building helpers over the real
 * corpus (`src/domain/blueprint.ts`, `data/assessment-bank.json`), plus its
 * cross-checks against `data/competition-stages.json` (via
 * `src/domain/structure.ts`) and `data/weeks.json`/`data/gates.json` (via
 * `src/domain/curriculum.ts`).
 *
 * Malformed-input fixtures are constructed inline against the schema; the
 * real data files under `data/` are never mutated by these tests.
 */

import { describe, expect, test } from "bun:test";
import {
  BlueprintRequestError,
  buildBlueprint,
  DIAGNOSTIC_AREAS,
  getBankKind,
  listBankKinds,
  MIN_ALTERNATIVES_PER_TOPIC,
} from "../../src/domain/blueprint";
import { gateAfter } from "../../src/domain/curriculum";
import { getStage } from "../../src/domain/structure";
import {
  assessmentBankFileSchema,
  BANK_KIND_IDS,
  type BankKindId,
  bankKindSchema,
} from "../../src/schema/assessment-bank";
import { GATE_WEEKS } from "../../src/schema/gate";

const EXPECTED_BANK_KIND_IDS = [
  "diagnostic",
  "weekly",
  "checkpoint",
  "osn-k-style",
  "osn-p-style",
  "national-mixed",
] as const;

const CHECKPOINT_WEEKS = [4, 8, 12, 16, 20, 24, 28] as const;
const NON_CHECKPOINT_WEEKS = [5, 13, 27] as const;

describe("data/assessment-bank.json (via src/domain/blueprint.ts)", () => {
  test("the real data file parses through the schema without error", () => {
    expect(() => listBankKinds()).not.toThrow();
  });

  test("exposes exactly the six expected bank-kind ids", () => {
    const ids = listBankKinds().map((bank) => bank.id);
    expect(ids).toEqual([...EXPECTED_BANK_KIND_IDS]);
    expect(BANK_KIND_IDS).toEqual([...EXPECTED_BANK_KIND_IDS]);
  });

  test('osn-p-style uses scoringModel "partial", per §2.2\'s Partial scoring', () => {
    expect(getBankKind("osn-p-style").scoringModel).toBe("partial");
  });

  test("every bank kind has a non-empty name, purpose, and at least one sourceSection", () => {
    for (const bank of listBankKinds()) {
      expect(bank.name.length).toBeGreaterThan(0);
      expect(bank.purpose.length).toBeGreaterThan(0);
      expect(bank.sourceSections.length).toBeGreaterThan(0);
    }
  });

  test("diagnostic/weekly/checkpoint are not tied to one competition stage", () => {
    expect(getBankKind("diagnostic").servesStage).toBeNull();
    expect(getBankKind("weekly").servesStage).toBeNull();
    expect(getBankKind("checkpoint").servesStage).toBeNull();
  });

  test("the three stage-facing kinds serve the matching §2.2 stage", () => {
    expect(getBankKind("osn-k-style").servesStage).toBe("osn-k");
    expect(getBankKind("osn-p-style").servesStage).toBe("osn-p");
    expect(getBankKind("national-mixed").servesStage).toBe("osn-nasional");
  });

  test("osn-k-style and osn-p-style leave timingMinutes null (read live from stage data instead)", () => {
    expect(getBankKind("osn-k-style").timingMinutes).toBeNull();
    expect(getBankKind("osn-p-style").timingMinutes).toBeNull();
  });
});

describe("getBankKind / listBankKinds", () => {
  test("getBankKind returns the matching bank kind for a known id", () => {
    expect(getBankKind("checkpoint").id).toBe("checkpoint");
  });

  test("getBankKind throws a helpful error listing valid ids for an unknown id", () => {
    expect(() => getBankKind("not-a-bank-kind")).toThrow(/diagnostic/);

    try {
      getBankKind("not-a-bank-kind");
      throw new Error("expected getBankKind to throw");
    } catch (error) {
      const message = (error as Error).message;
      for (const id of EXPECTED_BANK_KIND_IDS) {
        expect(message).toContain(id);
      }
    }
  });
});

describe("buildBlueprint: every bank kind produces a valid blueprint", () => {
  const requestsByKind: Record<BankKindId, { readonly kind: BankKindId; readonly week?: number }> =
    {
      diagnostic: { kind: "diagnostic" },
      weekly: { kind: "weekly", week: 1 },
      checkpoint: { kind: "checkpoint", week: 4 },
      "osn-k-style": { kind: "osn-k-style" },
      "osn-p-style": { kind: "osn-p-style" },
      "national-mixed": { kind: "national-mixed" },
    };

  for (const kind of EXPECTED_BANK_KIND_IDS) {
    test(`kind "${kind}" builds without throwing and carries alternativesPerTopic >= ${MIN_ALTERNATIVES_PER_TOPIC}`, () => {
      const blueprint = buildBlueprint(requestsByKind[kind]);
      expect(blueprint.kind).toBe(kind);
      expect(blueprint.alternativesPerTopic).toBeGreaterThanOrEqual(MIN_ALTERNATIVES_PER_TOPIC);
      expect(blueprint.difficultySpread.length).toBeGreaterThan(0);
      expect(blueprint.notes.length).toBeGreaterThan(0);
      expect(blueprint.caveat.length).toBeGreaterThan(0);
      expect(blueprint.topicCoverage.length).toBeGreaterThan(0);
    });
  }
});

describe("buildBlueprint: diagnostic", () => {
  test("topicCoverage defaults to the five §14.1 diagnostic areas", () => {
    const blueprint = buildBlueprint({ kind: "diagnostic" });
    expect(blueprint.topicCoverage).toEqual([...DIAGNOSTIC_AREAS]);
    expect(blueprint.topicCoverage).toEqual([
      "C++",
      "logika",
      "matematika",
      "complexity",
      "problem solving",
    ]);
  });

  test("itemCount and timeAllocationMinutes are null (no count defined in the source)", () => {
    const blueprint = buildBlueprint({ kind: "diagnostic" });
    expect(blueprint.itemCount).toBeNull();
    expect(blueprint.timeAllocationMinutes).toBeNull();
  });
});

describe("buildBlueprint: osn-k-style", () => {
  test("itemCount is 30-50 and timeAllocationMinutes is 150", () => {
    const blueprint = buildBlueprint({ kind: "osn-k-style" });
    expect(blueprint.itemCount).toEqual({ min: 30, max: 50 });
    expect(blueprint.timeAllocationMinutes).toBe(150);
  });

  test('those numbers equal getStage("osn-k").contestFormat, so a future stage-data change cannot silently desync', () => {
    const blueprint = buildBlueprint({ kind: "osn-k-style" });
    const format = getStage("osn-k").contestFormat;
    expect(format).not.toBeNull();
    if (format?.kind !== "problem-set") throw new Error("expected a problem-set format");

    expect(blueprint.itemCount).toEqual({ min: format.minItems, max: format.maxItems });
    expect(blueprint.timeAllocationMinutes).toBe(format.durationMinutes);
  });

  test("topicCoverage defaults to all ten topic families", () => {
    const blueprint = buildBlueprint({ kind: "osn-k-style" });
    expect(blueprint.topicCoverage).toHaveLength(10);
  });

  test("caseStructure is absent (this is a problem-set format, not a case-study one)", () => {
    const blueprint = buildBlueprint({ kind: "osn-k-style" });
    expect(blueprint.caseStructure).toBeUndefined();
  });
});

describe("buildBlueprint: osn-p-style", () => {
  test("itemCount is 5-8, timeAllocationMinutes is 180, scoringModel is partial", () => {
    const blueprint = buildBlueprint({ kind: "osn-p-style" });
    expect(blueprint.itemCount).toEqual({ min: 5, max: 8 });
    expect(blueprint.timeAllocationMinutes).toBe(180);
    expect(blueprint.scoringModel).toBe("partial");
  });

  test("caseStructure is 3 comprehension + 1 programming task per case", () => {
    const blueprint = buildBlueprint({ kind: "osn-p-style" });
    expect(blueprint.caseStructure).toEqual({ comprehensionPerCase: 3, programmingPerCase: 1 });
  });

  test('those numbers equal getStage("osn-p").contestFormat, so a future stage-data change cannot silently desync', () => {
    const blueprint = buildBlueprint({ kind: "osn-p-style" });
    const format = getStage("osn-p").contestFormat;
    expect(format).not.toBeNull();
    if (format?.kind !== "case-study") throw new Error("expected a case-study format");

    expect(blueprint.itemCount).toEqual({ min: format.minItems, max: format.maxItems });
    expect(blueprint.timeAllocationMinutes).toBe(format.durationMinutes);
    expect(blueprint.caseStructure).toEqual({
      comprehensionPerCase: format.comprehensionPerCase,
      programmingPerCase: format.programmingPerCase,
    });
  });
});

describe("buildBlueprint: national-mixed", () => {
  test("itemCount and timeAllocationMinutes are null (§2.2 gives OSN Nasional no numeric format)", () => {
    const blueprint = buildBlueprint({ kind: "national-mixed" });
    expect(blueprint.itemCount).toBeNull();
    expect(blueprint.timeAllocationMinutes).toBeNull();
    expect(getStage("osn-nasional").contestFormat).toBeNull();
  });

  test("topicCoverage defaults to all ten topic families", () => {
    const blueprint = buildBlueprint({ kind: "national-mixed" });
    expect(blueprint.topicCoverage).toHaveLength(10);
  });
});

describe("buildBlueprint: weekly", () => {
  test("week 1 (problemLoad 6-10) carries that exact range", () => {
    const blueprint = buildBlueprint({ kind: "weekly", week: 1 });
    expect(blueprint.itemCount).toEqual({ min: 6, max: 10 });
    expect(blueprint.week).toBe(1);
    expect(blueprint.topicCoverage).toEqual(["dasar-pemrograman"]);
  });

  test("week 25 (problemLoad null) states no count is defined rather than inventing one", () => {
    const blueprint = buildBlueprint({ kind: "weekly", week: 25 });
    expect(blueprint.itemCount).toBeNull();
    expect(blueprint.notes.some((note) => note.includes("25"))).toBe(true);
  });

  test("requires a week", () => {
    expect(() => buildBlueprint({ kind: "weekly" })).toThrow(BlueprintRequestError);
    expect(() => buildBlueprint({ kind: "weekly" })).toThrow(/week/i);
  });
});

describe("buildBlueprint: checkpoint", () => {
  for (const week of CHECKPOINT_WEEKS) {
    test(`succeeds for checkpoint week ${week}`, () => {
      const blueprint = buildBlueprint({ kind: "checkpoint", week });
      expect(blueprint.week).toBe(week);
      expect(blueprint.gateEvidence).toBeDefined();
      expect(blueprint.gateEvidence?.length).toBeGreaterThan(0);
    });
  }

  for (const week of NON_CHECKPOINT_WEEKS) {
    test(`fails for non-checkpoint week ${week}, naming the valid checkpoint weeks`, () => {
      expect(() => buildBlueprint({ kind: "checkpoint", week })).toThrow(BlueprintRequestError);
      try {
        buildBlueprint({ kind: "checkpoint", week });
        throw new Error("expected buildBlueprint to throw");
      } catch (error) {
        const message = (error as Error).message;
        for (const validWeek of GATE_WEEKS) {
          expect(message).toContain(String(validWeek));
        }
      }
    });
  }

  test("week 28's cumulative topicCoverage includes every family that appears from week 1-28", () => {
    const blueprint = buildBlueprint({ kind: "checkpoint", week: 28 });
    expect(blueprint.topicCoverage).toHaveLength(10);
    expect(new Set(blueprint.topicCoverage).size).toBe(10);
  });

  test("gateEvidence matches gateAfter(week) from src/domain/curriculum.ts", () => {
    const blueprint = buildBlueprint({ kind: "checkpoint", week: 12 });
    expect(blueprint.gateEvidence).toEqual(gateAfter(12)?.evidence);
  });
});

describe("buildBlueprint: error handling", () => {
  test("throws BlueprintRequestError for an unknown kind, naming the valid kinds", () => {
    expect(() => buildBlueprint({ kind: "not-a-real-kind" })).toThrow(BlueprintRequestError);
    try {
      buildBlueprint({ kind: "not-a-real-kind" });
      throw new Error("expected buildBlueprint to throw");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("not-a-real-kind");
      for (const id of EXPECTED_BANK_KIND_IDS) {
        expect(message).toContain(id);
      }
    }
  });

  test("throws BlueprintRequestError for week 0, naming the valid range", () => {
    expect(() => buildBlueprint({ kind: "weekly", week: 0 })).toThrow(BlueprintRequestError);
    expect(() => buildBlueprint({ kind: "weekly", week: 0 })).toThrow(/1-28/);
  });

  test("throws BlueprintRequestError for week 29, naming the valid range", () => {
    expect(() => buildBlueprint({ kind: "weekly", week: 29 })).toThrow(BlueprintRequestError);
    expect(() => buildBlueprint({ kind: "weekly", week: 29 })).toThrow(/1-28/);
  });

  test("throws BlueprintRequestError for an unknown topic family id, naming the valid ids", () => {
    expect(() =>
      buildBlueprint({ kind: "weekly", week: 1, topicFamilies: ["not-a-real-family"] }),
    ).toThrow(BlueprintRequestError);
    try {
      buildBlueprint({ kind: "weekly", week: 1, topicFamilies: ["not-a-real-family"] });
      throw new Error("expected buildBlueprint to throw");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("not-a-real-family");
      expect(message).toContain("dasar-pemrograman");
    }
  });

  test("a valid topicFamilies override replaces the default topicCoverage", () => {
    const blueprint = buildBlueprint({
      kind: "national-mixed",
      topicFamilies: ["graph-tree", "struktur-data"],
    });
    expect(blueprint.topicCoverage).toEqual(["graph-tree", "struktur-data"]);
    expect(blueprint.notes.some((note) => note.includes("overridden"))).toBe(true);
  });
});

describe("buildBlueprint: topicFamilies override, per kind", () => {
  const override = ["geometri-dasar"] as const;

  test("diagnostic: overrides the default §14.1 diagnostic areas", () => {
    const blueprint = buildBlueprint({ kind: "diagnostic", topicFamilies: [...override] });
    expect(blueprint.topicCoverage).toEqual([...override]);
    expect(blueprint.notes.some((note) => note.includes("overridden"))).toBe(true);
  });

  test("weekly: overrides the week's own topicFamilies", () => {
    const blueprint = buildBlueprint({
      kind: "weekly",
      week: 1,
      topicFamilies: [...override],
    });
    expect(blueprint.topicCoverage).toEqual([...override]);
    expect(blueprint.notes.some((note) => note.includes("overridden"))).toBe(true);
  });

  test("checkpoint: overrides the cumulative topic-family set", () => {
    const blueprint = buildBlueprint({
      kind: "checkpoint",
      week: 4,
      topicFamilies: [...override],
    });
    expect(blueprint.topicCoverage).toEqual([...override]);
    expect(blueprint.notes.some((note) => note.includes("overridden"))).toBe(true);
  });

  test("osn-k-style: overrides the default full topic-family set", () => {
    const blueprint = buildBlueprint({ kind: "osn-k-style", topicFamilies: [...override] });
    expect(blueprint.topicCoverage).toEqual([...override]);
    expect(blueprint.notes.some((note) => note.includes("overridden"))).toBe(true);
  });

  test("osn-p-style: overrides the default full topic-family set", () => {
    const blueprint = buildBlueprint({ kind: "osn-p-style", topicFamilies: [...override] });
    expect(blueprint.topicCoverage).toEqual([...override]);
    expect(blueprint.notes.some((note) => note.includes("overridden"))).toBe(true);
  });
});

describe("bankKindSchema (inline fixtures, real data file untouched)", () => {
  const validBankKind = {
    id: "diagnostic",
    name: "Diagnostic bank",
    purpose: "Builds a baseline competency profile.",
    servesStage: null,
    scoringModel: "rubric",
    timingMinutes: null,
    sourceSections: ["§13"],
  };

  test("accepts a well-formed bank kind", () => {
    expect(bankKindSchema.safeParse(validBankKind).success).toBe(true);
  });

  test("accepts a non-null servesStage", () => {
    const result = bankKindSchema.safeParse({ ...validBankKind, servesStage: "osn-k" });
    expect(result.success).toBe(true);
  });

  test("rejects an unknown bank-kind id", () => {
    const result = bankKindSchema.safeParse({ ...validBankKind, id: "not-a-kind" });
    expect(result.success).toBe(false);
  });

  test("rejects an unknown scoringModel", () => {
    const result = bankKindSchema.safeParse({ ...validBankKind, scoringModel: "essay" });
    expect(result.success).toBe(false);
  });

  test("rejects an unknown servesStage", () => {
    const result = bankKindSchema.safeParse({ ...validBankKind, servesStage: "not-a-stage" });
    expect(result.success).toBe(false);
  });

  test("rejects a non-positive timingMinutes", () => {
    const result = bankKindSchema.safeParse({ ...validBankKind, timingMinutes: 0 });
    expect(result.success).toBe(false);
  });

  test("rejects an empty sourceSections array", () => {
    const result = bankKindSchema.safeParse({ ...validBankKind, sourceSections: [] });
    expect(result.success).toBe(false);
  });

  test("rejects an empty purpose", () => {
    const result = bankKindSchema.safeParse({ ...validBankKind, purpose: "" });
    expect(result.success).toBe(false);
  });
});

describe("assessmentBankFileSchema (inline fixtures)", () => {
  const oneBank = {
    id: "diagnostic",
    name: "Diagnostic bank",
    purpose: "Builds a baseline competency profile.",
    servesStage: null,
    scoringModel: "rubric",
    timingMinutes: null,
    sourceSections: ["§13"],
  };

  const validFile = {
    syllabusVersion: "2.0",
    syllabusDate: "2026-09-04",
    sourceSection: "§13",
    banks: BANK_KIND_IDS.map((id) => ({ ...oneBank, id })),
  };

  test("accepts a well-formed file with exactly the six expected ids", () => {
    expect(assessmentBankFileSchema.safeParse(validFile).success).toBe(true);
  });

  test("rejects a file with fewer than six banks", () => {
    const invalidFile = { ...validFile, banks: validFile.banks.slice(0, 5) };
    expect(assessmentBankFileSchema.safeParse(invalidFile).success).toBe(false);
  });

  test("rejects a file with a duplicate bank-kind id (two diagnostic, missing national-mixed)", () => {
    const invalidFile = {
      ...validFile,
      banks: [...validFile.banks.slice(0, 5), { ...oneBank, id: "diagnostic" }],
    };
    const result = assessmentBankFileSchema.safeParse(invalidFile);
    expect(result.success).toBe(false);
  });

  test("the real data file's banks list matches BANK_KIND_IDS exactly", () => {
    const ids = listBankKinds().map((bank) => bank.id);
    expect(new Set(ids)).toEqual(new Set(BANK_KIND_IDS));
    expect(ids).toHaveLength(BANK_KIND_IDS.length);
  });
});
