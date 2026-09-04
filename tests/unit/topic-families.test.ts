/**
 * Tests for the topic-family schema (`src/schema/topic-family.ts`) and the
 * typed loader/lookup helpers over the real corpus
 * (`src/domain/topic-families.ts`, `data/topic-families.json`).
 *
 * Malformed-input fixtures are constructed inline against the schema; the
 * real data file under `data/` is never mutated by these tests.
 */

import { describe, expect, test } from "bun:test";
import {
  findTopicFamily,
  getTopicFamily,
  isTopicFamilyId,
  listTopicFamilies,
} from "../../src/domain/topic-families";
import { topicFamiliesSchema, topicFamilySchema } from "../../src/schema/topic-family";

const EXPECTED_IDS = [
  "dasar-pemrograman",
  "logika-bitwise",
  "aritmetika",
  "aturan-berhitung",
  "rekursi",
  "search-sort",
  "strategi-problem-solving",
  "struktur-data",
  "graph-tree",
  "geometri-dasar",
] as const;

describe("data/topic-families.json (via src/domain/topic-families.ts)", () => {
  test("the real data file parses through the schema without error", () => {
    expect(() => listTopicFamilies()).not.toThrow();
  });

  test("exposes exactly 10 topic families", () => {
    expect(listTopicFamilies()).toHaveLength(10);
  });

  test("every topic family ID is unique", () => {
    const ids = listTopicFamilies().map((family) => family.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("IDs match the exact expected list from §2.1, in order", () => {
    const ids = listTopicFamilies().map((family) => family.id);
    expect(ids).toEqual([...EXPECTED_IDS]);
  });

  test("every coverage array is non-empty", () => {
    for (const family of listTopicFamilies()) {
      expect(family.coverage.length).toBeGreaterThan(0);
      for (const item of family.coverage) {
        expect(item.length).toBeGreaterThan(0);
      }
    }
  });

  test("every family cites at least R1 and references §2.1", () => {
    for (const family of listTopicFamilies()) {
      expect(family.citations).toContain("R1");
      expect(family.sourceSection).toBe("§2.1");
    }
  });

  test("getTopicFamily returns the right record for a known id", () => {
    const family = getTopicFamily("rekursi");
    expect(family.id).toBe("rekursi");
    expect(family.name).toBe("Rekursi");
  });

  test("getTopicFamily throws a helpful error listing valid ids for an unknown id", () => {
    expect(() => getTopicFamily("does-not-exist")).toThrow(/does-not-exist/);

    try {
      getTopicFamily("does-not-exist");
      throw new Error("expected getTopicFamily to throw");
    } catch (error) {
      const message = (error as Error).message;
      for (const id of EXPECTED_IDS) {
        expect(message).toContain(id);
      }
    }
  });

  test("findTopicFamily returns the record for a known id", () => {
    expect(findTopicFamily("geometri-dasar")?.name).toBe("Geometri dasar");
  });

  test("findTopicFamily returns undefined for an unknown id", () => {
    expect(findTopicFamily("does-not-exist")).toBeUndefined();
  });

  test("isTopicFamilyId is true for known ids and false for unknown ones", () => {
    expect(isTopicFamilyId("struktur-data")).toBe(true);
    expect(isTopicFamilyId("does-not-exist")).toBe(false);
  });
});

describe("topicFamilySchema (inline fixtures, real data file untouched)", () => {
  const validFamily = {
    id: "dasar-pemrograman",
    name: "Dasar pemrograman",
    coverage: ["variabel", "tipe data"],
    citations: ["R1"],
    sourceSection: "§2.1",
  };

  test("accepts a well-formed topic family", () => {
    expect(topicFamilySchema.safeParse(validFamily).success).toBe(true);
  });

  test("rejects a non-slug id", () => {
    const result = topicFamilySchema.safeParse({ ...validFamily, id: "Dasar Pemrograman" });
    expect(result.success).toBe(false);
  });

  test("rejects an empty name", () => {
    const result = topicFamilySchema.safeParse({ ...validFamily, name: "" });
    expect(result.success).toBe(false);
  });

  test("rejects an empty coverage array", () => {
    const result = topicFamilySchema.safeParse({ ...validFamily, coverage: [] });
    expect(result.success).toBe(false);
  });

  test("rejects a coverage array containing an empty string", () => {
    const result = topicFamilySchema.safeParse({ ...validFamily, coverage: ["ok", ""] });
    expect(result.success).toBe(false);
  });

  test("rejects an out-of-range citation ref", () => {
    const result = topicFamilySchema.safeParse({ ...validFamily, citations: ["R42"] });
    expect(result.success).toBe(false);
  });

  test("rejects a malformed source section", () => {
    const result = topicFamilySchema.safeParse({ ...validFamily, sourceSection: "2.1" });
    expect(result.success).toBe(false);
  });

  test("rejects a record missing a required field", () => {
    const { citations: _citations, ...withoutCitations } = validFamily;
    const result = topicFamilySchema.safeParse(withoutCitations);
    expect(result.success).toBe(false);
  });
});

describe("topicFamiliesSchema (inline fixtures)", () => {
  const validFile = {
    syllabusVersion: "2.0",
    syllabusDate: "2026-09-04",
    sourceSection: "§2.1",
    topicFamilies: [
      {
        id: "dasar-pemrograman",
        name: "Dasar pemrograman",
        coverage: ["variabel"],
        citations: ["R1"],
        sourceSection: "§2.1",
      },
    ],
  };

  test("accepts a well-formed file", () => {
    expect(topicFamiliesSchema.safeParse(validFile).success).toBe(true);
  });

  test("rejects a file missing syllabusVersion", () => {
    const { syllabusVersion: _syllabusVersion, ...withoutVersion } = validFile;
    expect(topicFamiliesSchema.safeParse(withoutVersion).success).toBe(false);
  });

  test("rejects a file whose topicFamilies contains an invalid entry", () => {
    const invalidFile = {
      ...validFile,
      topicFamilies: [{ ...validFile.topicFamilies[0], id: "Not A Slug" }],
    };
    expect(topicFamiliesSchema.safeParse(invalidFile).success).toBe(false);
  });

  test("rejects a file where topicFamilies is not an array", () => {
    const invalidFile = { ...validFile, topicFamilies: "nope" };
    expect(topicFamiliesSchema.safeParse(invalidFile).success).toBe(false);
  });
});
