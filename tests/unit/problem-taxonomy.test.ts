/**
 * Tests for the problem-taxonomy schema (`src/schema/problem-taxonomy.ts`)
 * and its controlled vocabulary file (`data/problem-taxonomy-vocab.json`).
 *
 * Malformed-input fixtures are constructed inline against the schema; the
 * real data file under `data/` is never mutated by these tests. Every
 * fixture is obviously synthetic (`problem-demo-*` ids), per ADR-0004.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { listTopicFamilies } from "../../src/domain/topic-families";
import {
  COMMON_TRAP_IDS,
  DIFFICULTY_BAND_IDS,
  DIFFICULTY_MAX,
  DIFFICULTY_MIN,
  EXPECTED_SOLUTION_CLASS_IDS,
  OFFICIAL_TOPIC_IDS,
  complexityClassSchema,
  problemTagsSchema,
  problemTaxonomyVocabFileSchema,
} from "../../src/schema/problem-taxonomy";

const VALID_TAGS = {
  problemId: "problem-demo-1",
  officialTopic: "graph-tree",
  prerequisite: ["struktur-data"],
  difficulty: 3,
  stage: "osn-k",
  complexity: "O(n log n)",
  commonTraps: ["off-by-one"],
  expectedSolution: ["graph"],
} as const;

describe("OFFICIAL_TOPIC_IDS: no drift against data/topic-families.json", () => {
  test("matches the real topic-family ids exactly, in order", () => {
    const realIds = listTopicFamilies().map((family) => family.id);
    const officialTopicIds: string[] = [...OFFICIAL_TOPIC_IDS];
    expect(officialTopicIds).toEqual(realIds);
  });
});

describe("problemTagsSchema: valid input", () => {
  test("accepts a well-formed tagged problem", () => {
    expect(problemTagsSchema.safeParse(VALID_TAGS).success).toBe(true);
  });

  test("accepts an empty prerequisite array", () => {
    expect(problemTagsSchema.safeParse({ ...VALID_TAGS, prerequisite: [] }).success).toBe(true);
  });

  test("accepts multiple expectedSolution classes", () => {
    const result = problemTagsSchema.safeParse({
      ...VALID_TAGS,
      expectedSolution: ["graph", "dynamic-programming"],
    });
    expect(result.success).toBe(true);
  });
});

describe("problemTagsSchema: official-topic dimension", () => {
  test("rejects an officialTopic not in the ten topic-family ids", () => {
    const result = problemTagsSchema.safeParse({ ...VALID_TAGS, officialTopic: "not-a-topic" });
    expect(result.success).toBe(false);
  });
});

describe("problemTagsSchema: prerequisite dimension", () => {
  test("rejects a prerequisite id that is not a known topic-family id", () => {
    const result = problemTagsSchema.safeParse({ ...VALID_TAGS, prerequisite: ["not-a-topic"] });
    expect(result.success).toBe(false);
  });

  test("rejects a prerequisite that includes the problem's own officialTopic", () => {
    const result = problemTagsSchema.safeParse({
      ...VALID_TAGS,
      officialTopic: "graph-tree",
      prerequisite: ["graph-tree"],
    });
    expect(result.success).toBe(false);
  });

  test("rejects duplicate prerequisite entries", () => {
    const result = problemTagsSchema.safeParse({
      ...VALID_TAGS,
      prerequisite: ["struktur-data", "struktur-data"],
    });
    expect(result.success).toBe(false);
  });
});

describe("problemTagsSchema: difficulty dimension", () => {
  test(`accepts every level ${DIFFICULTY_MIN}-${DIFFICULTY_MAX}`, () => {
    for (let level = DIFFICULTY_MIN; level <= DIFFICULTY_MAX; level += 1) {
      expect(problemTagsSchema.safeParse({ ...VALID_TAGS, difficulty: level }).success).toBe(true);
    }
  });

  test("rejects difficulty 0 and 6", () => {
    expect(problemTagsSchema.safeParse({ ...VALID_TAGS, difficulty: 0 }).success).toBe(false);
    expect(problemTagsSchema.safeParse({ ...VALID_TAGS, difficulty: 6 }).success).toBe(false);
  });

  test("rejects a non-integer difficulty", () => {
    expect(problemTagsSchema.safeParse({ ...VALID_TAGS, difficulty: 2.5 }).success).toBe(false);
  });
});

describe("problemTagsSchema: stage dimension", () => {
  test("accepts every one of the four competition-stage ids", () => {
    for (const stage of ["osn-k", "osn-p", "osn-nasional", "toki-ioi-extension"]) {
      expect(problemTagsSchema.safeParse({ ...VALID_TAGS, stage }).success).toBe(true);
    }
  });

  test("rejects an unknown stage id", () => {
    expect(problemTagsSchema.safeParse({ ...VALID_TAGS, stage: "not-a-stage" }).success).toBe(
      false,
    );
  });
});

describe("complexityClassSchema", () => {
  test.each([["O(1)"], ["O(log n)"], ["O(n)"], ["O(n log n)"], ["O(n^2)"], ["O(2^n)"], ["O(V+E)"]])(
    "accepts %s",
    (value) => {
      expect(complexityClassSchema.safeParse(value).success).toBe(true);
    },
  );

  test.each([["linear"], ["n^2"], [""], ["O()"]])("rejects %s", (value) => {
    expect(complexityClassSchema.safeParse(value).success).toBe(false);
  });
});

describe("problemTagsSchema: common-traps dimension", () => {
  test("rejects an empty commonTraps array", () => {
    expect(problemTagsSchema.safeParse({ ...VALID_TAGS, commonTraps: [] }).success).toBe(false);
  });

  test("rejects an unknown trap id", () => {
    expect(
      problemTagsSchema.safeParse({ ...VALID_TAGS, commonTraps: ["not-a-trap"] }).success,
    ).toBe(false);
  });

  test("rejects duplicate trap entries", () => {
    expect(
      problemTagsSchema.safeParse({ ...VALID_TAGS, commonTraps: ["off-by-one", "off-by-one"] })
        .success,
    ).toBe(false);
  });

  test("every documented common-trap id is representable", () => {
    for (const trapId of COMMON_TRAP_IDS) {
      expect(problemTagsSchema.safeParse({ ...VALID_TAGS, commonTraps: [trapId] }).success).toBe(
        true,
      );
    }
  });
});

describe("problemTagsSchema: expected-solution dimension", () => {
  test("rejects an empty expectedSolution array", () => {
    expect(problemTagsSchema.safeParse({ ...VALID_TAGS, expectedSolution: [] }).success).toBe(
      false,
    );
  });

  test("every documented expected-solution class id is representable", () => {
    for (const classId of EXPECTED_SOLUTION_CLASS_IDS) {
      expect(
        problemTagsSchema.safeParse({ ...VALID_TAGS, expectedSolution: [classId] }).success,
      ).toBe(true);
    }
  });
});

describe("data/problem-taxonomy-vocab.json", () => {
  const dataPath = join(import.meta.dir, "..", "..", "data", "problem-taxonomy-vocab.json");
  const raw: unknown = JSON.parse(readFileSync(dataPath, "utf-8"));

  test("the real data file parses through problemTaxonomyVocabFileSchema without error", () => {
    const result = problemTaxonomyVocabFileSchema.safeParse(raw);
    expect(result.success).toBe(true);
  });

  test(`the difficulty scale has exactly the ${DIFFICULTY_BAND_IDS.length} named bands`, () => {
    const parsed = problemTaxonomyVocabFileSchema.parse(raw);
    expect(parsed.difficultyScale).toHaveLength(DIFFICULTY_BAND_IDS.length);
    const levels = parsed.difficultyScale.map((band) => band.level).sort((a, b) => a - b);
    expect(levels).toEqual([1, 2, 3, 4, 5]);
  });

  test("commonTraps in the file exactly matches COMMON_TRAP_IDS", () => {
    const parsed = problemTaxonomyVocabFileSchema.parse(raw);
    const ids = parsed.commonTraps.map((entry) => entry.id).sort();
    expect(ids).toEqual([...COMMON_TRAP_IDS].sort());
  });

  test("expectedSolutionClasses in the file exactly matches EXPECTED_SOLUTION_CLASS_IDS", () => {
    const parsed = problemTaxonomyVocabFileSchema.parse(raw);
    const ids = parsed.expectedSolutionClasses.map((entry) => entry.id).sort();
    expect(ids).toEqual([...EXPECTED_SOLUTION_CLASS_IDS].sort());
  });

  test("rejects a file missing a required band", () => {
    const parsed = problemTaxonomyVocabFileSchema.parse(raw);
    const broken = { ...parsed, difficultyScale: parsed.difficultyScale.slice(1) };
    expect(problemTaxonomyVocabFileSchema.safeParse(broken).success).toBe(false);
  });
});
