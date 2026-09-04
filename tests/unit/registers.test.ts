/**
 * Tests for the reference/regulation/standard/source-priority schemas
 * (`src/schema/reference.ts`, `src/schema/regulation.ts`,
 * `src/schema/standard.ts`, `src/schema/source-priority.ts`) and the typed
 * loader/lookup helpers over the real corpus (`src/domain/registers.ts`,
 * `data/references.json`, `data/regulations.json`, `data/standards.json`,
 * `data/source-priority.json`).
 *
 * Malformed-input fixtures are constructed inline against the schemas; the
 * real data files under `data/` are never mutated by these tests.
 */

import { describe, expect, test } from "bun:test";
import {
  findDanglingCitations,
  findReference,
  getReference,
  getRegulation,
  getStandard,
  listReferences,
  listRegulations,
  listStandards,
  referencesByKind,
  resolveCitations,
  sourcePriority,
  assertNoDanglingCitations,
} from "../../src/domain/registers";
import { referenceSchema, referencesFileSchema } from "../../src/schema/reference";
import { regulationSchema } from "../../src/schema/regulation";
import { sourcePriorityEntrySchema } from "../../src/schema/source-priority";
import { standardSchema } from "../../src/schema/standard";

const EXPECTED_REFERENCE_COUNT = 41;
const EXPECTED_REGULATION_COUNT = 7;
const EXPECTED_STANDARD_COUNT = 14;
const EXPECTED_LAW_COUNT = 7;

function expectedReferenceIds(): string[] {
  return Array.from({ length: EXPECTED_REFERENCE_COUNT }, (_, index) => `R${index + 1}`);
}

describe("data/references.json (via src/domain/registers.ts)", () => {
  test("the real data file parses through the schema without error", () => {
    expect(() => listReferences()).not.toThrow();
  });

  test("exposes exactly 41 references", () => {
    expect(listReferences()).toHaveLength(EXPECTED_REFERENCE_COUNT);
  });

  test("ids are exactly R1..R41, no gaps, no duplicates, in source order", () => {
    const ids = listReferences().map((reference) => reference.id);
    expect(ids).toEqual(expectedReferenceIds());
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every url starts with https:// and parses as a URL", () => {
    for (const reference of listReferences()) {
      expect(reference.url.startsWith("https://")).toBe(true);
      expect(() => new URL(reference.url)).not.toThrow();
    }
  });

  test("every reference has a non-empty title", () => {
    for (const reference of listReferences()) {
      expect(reference.title.length).toBeGreaterThan(0);
    }
  });
});

describe("getReference / findReference", () => {
  test("getReference returns the matching reference for a known id", () => {
    expect(getReference("R1").id).toBe("R1");
    expect(getReference("R41").id).toBe("R41");
  });

  test("getReference throws a helpful error listing valid ids for an unknown id", () => {
    expect(() => getReference("R99")).toThrow(/R99/);

    try {
      getReference("R99");
      throw new Error("expected getReference to throw");
    } catch (error) {
      const message = (error as Error).message;
      for (const id of ["R1", "R20", "R41"]) {
        expect(message).toContain(id);
      }
    }
  });

  test("findReference returns undefined for an unknown id", () => {
    expect(findReference("R99")).toBeUndefined();
  });
});

describe("referencesByKind", () => {
  test('returns exactly the 7 "law" references', () => {
    const laws = referencesByKind("law");
    expect(laws).toHaveLength(EXPECTED_LAW_COUNT);
    for (const reference of laws) {
      expect(reference.kind).toBe("law");
    }
    expect(laws.map((reference) => reference.id)).toEqual([
      "R15",
      "R16",
      "R17",
      "R18",
      "R19",
      "R20",
      "R21",
    ]);
  });

  test("returns an empty array for a kind with no members among edge cases still present", () => {
    // Every one of the 8 declared kinds is actually used by the current
    // corpus, so this asserts non-emptiness for each instead of hunting for
    // an unused kind (which would be a false signal, not a real edge case).
    const kinds = [
      "official-syllabus",
      "archive",
      "journal",
      "law",
      "standard",
      "book",
      "platform",
      "historical",
    ] as const;
    for (const kind of kinds) {
      expect(referencesByKind(kind).length).toBeGreaterThan(0);
    }
  });
});

describe("resolveCitations", () => {
  test("resolves known ids in the given order", () => {
    const resolved = resolveCitations(["R1", "R41"]);
    expect(resolved.map((reference) => reference.id)).toEqual(["R1", "R41"]);
  });

  test("throws naming every unknown id at once, not just the first", () => {
    expect(() => resolveCitations(["R99", "R0"])).toThrow();

    try {
      resolveCitations(["R99", "R0"]);
      throw new Error("expected resolveCitations to throw");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("R99");
      expect(message).toContain("R0");
    }
  });
});

describe("data/regulations.json (via src/domain/registers.ts)", () => {
  test("the real data file parses through the schema without error", () => {
    expect(() => listRegulations()).not.toThrow();
  });

  test("exposes exactly 7 regulations", () => {
    expect(listRegulations()).toHaveLength(EXPECTED_REGULATION_COUNT);
  });

  test("every regulation's citation resolves to a real reference", () => {
    for (const regulation of listRegulations()) {
      expect(() => getReference(regulation.citation)).not.toThrow();
    }
  });

  test("every regulation has a non-empty title and relevance", () => {
    for (const regulation of listRegulations()) {
      expect(regulation.title.length).toBeGreaterThan(0);
      expect(regulation.relevance.length).toBeGreaterThan(0);
    }
  });
});

describe("getRegulation", () => {
  test("returns the matching regulation for a known id", () => {
    expect(getRegulation("uu-20-2003").citation).toBe("R15");
  });

  test("throws a helpful error listing valid ids for an unknown id", () => {
    expect(() => getRegulation("does-not-exist")).toThrow(/does-not-exist/);

    try {
      getRegulation("does-not-exist");
      throw new Error("expected getRegulation to throw");
    } catch (error) {
      const message = (error as Error).message;
      for (const regulation of listRegulations()) {
        expect(message).toContain(regulation.id);
      }
    }
  });
});

describe("data/standards.json (via src/domain/registers.ts)", () => {
  test("the real data file parses through the schema without error", () => {
    expect(() => listStandards()).not.toThrow();
  });

  test("exposes exactly 14 standards", () => {
    expect(listStandards()).toHaveLength(EXPECTED_STANDARD_COUNT);
  });

  test("every standard's citation resolves to a real reference", () => {
    for (const standard of listStandards()) {
      expect(() => getReference(standard.citation)).not.toThrow();
    }
  });

  test("every standard has a non-empty designation, relevance and application", () => {
    for (const standard of listStandards()) {
      expect(standard.designation.length).toBeGreaterThan(0);
      expect(standard.relevance.length).toBeGreaterThan(0);
      expect(standard.application.length).toBeGreaterThan(0);
    }
  });
});

describe("getStandard", () => {
  test("returns the matching standard for a known id", () => {
    expect(getStandard("iso-27001-2022").citation).toBe("R23");
  });

  test("throws a helpful error listing valid ids for an unknown id", () => {
    expect(() => getStandard("does-not-exist")).toThrow(/does-not-exist/);

    try {
      getStandard("does-not-exist");
      throw new Error("expected getStandard to throw");
    } catch (error) {
      const message = (error as Error).message;
      for (const standard of listStandards()) {
        expect(message).toContain(standard.id);
      }
    }
  });
});

describe("sourcePriority (via src/domain/registers.ts)", () => {
  test("the real data file parses through the schema without error", () => {
    expect(() => sourcePriority()).not.toThrow();
  });

  test("priorities are exactly 1..5, in order", () => {
    const { priorities } = sourcePriority();
    expect(priorities.map((entry) => entry.priority)).toEqual([1, 2, 3, 4, 5]);
  });

  test("every priority row's citations resolve to real references", () => {
    const { priorities } = sourcePriority();
    for (const entry of priorities) {
      expect(() => resolveCitations(entry.citations)).not.toThrow();
    }
  });

  test("exposes exactly 3 primary books, each with a citation that resolves", () => {
    const { books } = sourcePriority();
    expect(books).toHaveLength(3);
    for (const book of books) {
      expect(() => getReference(book.citation)).not.toThrow();
    }
  });

  test("exposes exactly 5 practice platforms, each with a non-empty name and usage", () => {
    const { platforms } = sourcePriority();
    expect(platforms).toHaveLength(5);
    for (const platform of platforms) {
      expect(platform.name.length).toBeGreaterThan(0);
      expect(platform.usage.length).toBeGreaterThan(0);
    }
  });
});

describe("cross-register citation integrity", () => {
  test("assertNoDanglingCitations() does not throw over the real corpus", () => {
    expect(() => assertNoDanglingCitations()).not.toThrow();
  });

  test("findDanglingCitations detects a bogus R99 in an inline fixture", () => {
    const fixture = {
      foo: "R1",
      nested: { citations: ["R41", "R99"] },
      deeplyNested: [{ list: ["R2", { citation: "R0" }] }],
    };

    const dangling = findDanglingCitations(fixture, "fixture.json");

    expect(dangling).toHaveLength(2);
    expect(dangling.map((entry) => entry.id).sort()).toEqual(["R0", "R99"]);
    for (const entry of dangling) {
      expect(entry.label).toBe("fixture.json");
    }
  });

  test("findDanglingCitations returns an empty array when every citation resolves", () => {
    const fixture = { citations: ["R1", "R41"], nested: { id: "R20" } };
    expect(findDanglingCitations(fixture, "fixture.json")).toEqual([]);
  });

  test("findDanglingCitations ignores strings that merely resemble a citation id", () => {
    const fixture = { note: "see R1 above", notACitation: "R1a", empty: "" };
    expect(findDanglingCitations(fixture, "fixture.json")).toEqual([]);
  });
});

describe("referenceSchema (inline fixtures, real data file untouched)", () => {
  const validReference = {
    id: "R1",
    kind: "official-syllabus",
    title: "Silabus OSN Informatika 2026",
    authors: "IA TOKI",
    year: null,
    url: "https://osn.toki.id/silabus",
    notes: null,
  };

  test("accepts a well-formed reference", () => {
    expect(referenceSchema.safeParse(validReference).success).toBe(true);
  });

  test("accepts non-null authors/year/notes", () => {
    const result = referenceSchema.safeParse({
      ...validReference,
      authors: "Kurnia, I. W.",
      year: 2010,
      notes: "Some note",
    });
    expect(result.success).toBe(true);
  });

  test("rejects a non-https url", () => {
    const result = referenceSchema.safeParse({
      ...validReference,
      url: "http://osn.toki.id/silabus",
    });
    expect(result.success).toBe(false);
  });

  test("rejects a syntactically invalid url", () => {
    const result = referenceSchema.safeParse({ ...validReference, url: "not-a-url" });
    expect(result.success).toBe(false);
  });

  test('rejects id "R42" (out of the R1-R41 range)', () => {
    const result = referenceSchema.safeParse({ ...validReference, id: "R42" });
    expect(result.success).toBe(false);
  });

  test('rejects id "R0" (out of the R1-R41 range)', () => {
    const result = referenceSchema.safeParse({ ...validReference, id: "R0" });
    expect(result.success).toBe(false);
  });

  test("rejects an unknown kind", () => {
    const result = referenceSchema.safeParse({ ...validReference, kind: "webpage" });
    expect(result.success).toBe(false);
  });

  test("rejects an empty title", () => {
    const result = referenceSchema.safeParse({ ...validReference, title: "" });
    expect(result.success).toBe(false);
  });
});

describe("referencesFileSchema (inline fixtures)", () => {
  const validFile = {
    syllabusVersion: "2.0",
    syllabusDate: "2026-09-04",
    sourceSection: "§99",
    references: [
      {
        id: "R1",
        kind: "official-syllabus",
        title: "Silabus OSN Informatika 2026",
        authors: "IA TOKI",
        year: null,
        url: "https://osn.toki.id/silabus",
        notes: null,
      },
    ],
  };

  test("accepts a well-formed file", () => {
    expect(referencesFileSchema.safeParse(validFile).success).toBe(true);
  });

  test("rejects a file whose references contains an invalid entry", () => {
    const invalidFile = {
      ...validFile,
      references: [{ ...validFile.references[0], id: "R42" }],
    };
    expect(referencesFileSchema.safeParse(invalidFile).success).toBe(false);
  });
});

describe("regulationSchema (inline fixtures, real data file untouched)", () => {
  const validRegulation = {
    id: "uu-20-2003",
    title: "UU No. 20 Tahun 2003 - Sistem Pendidikan Nasional",
    relevance: "Kerangka pendidikan nasional, mutu, relevansi.",
    citation: "R15",
  };

  test("accepts a well-formed regulation", () => {
    expect(regulationSchema.safeParse(validRegulation).success).toBe(true);
  });

  test("rejects a non-kebab-case id", () => {
    const result = regulationSchema.safeParse({ ...validRegulation, id: "UU 20 2003" });
    expect(result.success).toBe(false);
  });

  test("rejects an out-of-range citation", () => {
    const result = regulationSchema.safeParse({ ...validRegulation, citation: "R42" });
    expect(result.success).toBe(false);
  });

  test("rejects an empty relevance", () => {
    const result = regulationSchema.safeParse({ ...validRegulation, relevance: "" });
    expect(result.success).toBe(false);
  });
});

describe("standardSchema (inline fixtures, real data file untouched)", () => {
  const validStandard = {
    id: "iso-27001-2022",
    designation: "ISO/IEC 27001:2022",
    relevance: "ISMS",
    application: "Risk-based security untuk LMS, judge, akun, database, cloud.",
    citation: "R23",
  };

  test("accepts a well-formed standard", () => {
    expect(standardSchema.safeParse(validStandard).success).toBe(true);
  });

  test("rejects an empty designation", () => {
    const result = standardSchema.safeParse({ ...validStandard, designation: "" });
    expect(result.success).toBe(false);
  });

  test("rejects an out-of-range citation", () => {
    const result = standardSchema.safeParse({ ...validStandard, citation: "R0" });
    expect(result.success).toBe(false);
  });
});

describe("sourcePriorityEntrySchema (inline fixtures, real data file untouched)", () => {
  const validEntry = {
    priority: 1,
    source: "Silabus OSN Informatika 2026",
    usage: "Source of truth cakupan lokal dan perubahan tahunan.",
    citations: ["R1"],
  };

  test("accepts a well-formed entry", () => {
    expect(sourcePriorityEntrySchema.safeParse(validEntry).success).toBe(true);
  });

  test("rejects priority 0 (below the 1-5 range)", () => {
    const result = sourcePriorityEntrySchema.safeParse({ ...validEntry, priority: 0 });
    expect(result.success).toBe(false);
  });

  test("rejects priority 6 (above the 1-5 range)", () => {
    const result = sourcePriorityEntrySchema.safeParse({ ...validEntry, priority: 6 });
    expect(result.success).toBe(false);
  });

  test("rejects an empty citations array", () => {
    const result = sourcePriorityEntrySchema.safeParse({ ...validEntry, citations: [] });
    expect(result.success).toBe(false);
  });
});
