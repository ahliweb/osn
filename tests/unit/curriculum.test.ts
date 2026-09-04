/**
 * Tests for the week/gate schemas (`src/schema/week.ts`, `src/schema/gate.ts`)
 * and the typed loader/lookup helpers over the real corpus
 * (`src/domain/curriculum.ts`, `data/weeks.json`, `data/gates.json`).
 *
 * Malformed-input fixtures are constructed inline against the schemas; the
 * real data files under `data/` are never mutated by these tests.
 */

import { describe, expect, test } from "bun:test";
import {
  assertReferentialIntegrity,
  checkpointWeeks,
  findWeek,
  gateAfter,
  getWeek,
  listGates,
  listWeeks,
  miniContestWeeks,
  weeksForTopicFamily,
} from "../../src/domain/curriculum";
import { isTopicFamilyId, listTopicFamilies } from "../../src/domain/topic-families";
import { gateSchema, gatesSchema } from "../../src/schema/gate";
import { weekSchema, weeksSchema } from "../../src/schema/week";

const GATE_WEEKS = [4, 8, 12, 16, 20, 24, 28] as const;
const MINI_CONTEST_WEEKS = [8, 16, 20] as const;
const NULL_PROBLEM_LOAD_WEEKS = [25, 26, 27, 28] as const;

describe("data/weeks.json (via src/domain/curriculum.ts)", () => {
  test("the real data file parses through the schema without error", () => {
    expect(() => listWeeks()).not.toThrow();
  });

  test("exposes exactly 28 weeks", () => {
    expect(listWeeks()).toHaveLength(28);
  });

  test("weeks are numbered 1..28 with no gaps and no duplicates", () => {
    const numbers = listWeeks().map((week) => week.week);
    expect(new Set(numbers).size).toBe(numbers.length);
    expect([...numbers].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 28 }, (_, index) => index + 1),
    );
  });

  test("every week's focus, content, outcome and practice are non-empty", () => {
    for (const week of listWeeks()) {
      expect(week.focus.length).toBeGreaterThan(0);
      expect(week.content.length).toBeGreaterThan(0);
      for (const item of week.content) {
        expect(item.length).toBeGreaterThan(0);
      }
      expect(week.outcome.length).toBeGreaterThan(0);
      expect(week.practice.length).toBeGreaterThan(0);
    }
  });

  test("every topicFamilies entry resolves to a real topic family", () => {
    for (const week of listWeeks()) {
      expect(week.topicFamilies.length).toBeGreaterThan(0);
      for (const id of week.topicFamilies) {
        expect(isTopicFamilyId(id)).toBe(true);
      }
    }
  });

  test("assertReferentialIntegrity does not throw over the real corpus", () => {
    expect(() => assertReferentialIntegrity()).not.toThrow();
  });

  test("every problemLoad satisfies min <= max", () => {
    for (const week of listWeeks()) {
      if (week.problemLoad !== null) {
        expect(week.problemLoad.min).toBeLessThanOrEqual(week.problemLoad.max);
      }
    }
  });

  test("weeks 25-28 have a null problemLoad", () => {
    for (const weekNumber of NULL_PROBLEM_LOAD_WEEKS) {
      expect(getWeek(weekNumber).problemLoad).toBeNull();
    }
  });

  test("checkpoints 1-7 each appear exactly once, on weeks 4/8/12/16/20/24/28", () => {
    const checkpointed = listWeeks().filter((week) => week.checkpoint !== null);
    expect(checkpointed).toHaveLength(7);

    for (const [index, weekNumber] of GATE_WEEKS.entries()) {
      const week = getWeek(weekNumber);
      expect(week.checkpoint).toBe(index + 1);
    }

    const checkpointNumbers = checkpointed.map((week) => week.checkpoint);
    expect(new Set(checkpointNumbers).size).toBe(7);
  });

  test("mini-contest weeks are exactly 8, 16 and 20", () => {
    const flagged = miniContestWeeks().map((week) => week.week);
    expect(flagged).toEqual([...MINI_CONTEST_WEEKS]);

    for (const week of listWeeks()) {
      expect(week.hasMiniContest).toBe(MINI_CONTEST_WEEKS.includes(week.week as 8 | 16 | 20));
    }
  });
});

describe("getWeek / findWeek", () => {
  test("getWeek returns the matching week for a valid number", () => {
    const week = getWeek(1);
    expect(week.week).toBe(1);
    expect(week.focus).toBe("Orientasi CP & C++ dasar");
  });

  test("getWeek(0) throws, naming the valid range", () => {
    expect(() => getWeek(0)).toThrow(/1-28/);
  });

  test("getWeek(29) throws, naming the valid range", () => {
    expect(() => getWeek(29)).toThrow(/1-28/);
  });

  test("findWeek returns undefined for an out-of-range week", () => {
    expect(findWeek(0)).toBeUndefined();
    expect(findWeek(29)).toBeUndefined();
  });

  test("findWeek returns the matching week for a valid number", () => {
    expect(findWeek(28)?.week).toBe(28);
  });
});

describe("weeksForTopicFamily", () => {
  test("returns a non-empty list for every one of the ten topic families", () => {
    for (const family of listTopicFamilies()) {
      const weeks = weeksForTopicFamily(family.id);
      expect(weeks.length).toBeGreaterThan(0);
      for (const week of weeks) {
        expect(week.topicFamilies).toContain(family.id);
      }
    }
  });

  test("throws for an unknown topic family id", () => {
    expect(() => weeksForTopicFamily("does-not-exist")).toThrow(/does-not-exist/);
  });
});

describe("data/gates.json (via src/domain/curriculum.ts)", () => {
  test("the real data file parses through the schema without error", () => {
    expect(() => listGates()).not.toThrow();
  });

  test("exposes exactly 7 gates, at weeks 4/8/12/16/20/24/28", () => {
    const gates = listGates();
    expect(gates).toHaveLength(7);
    expect(gates.map((gate) => gate.afterWeek)).toEqual([...GATE_WEEKS]);
  });

  test("every gate has non-empty evidence and blocksProgression true", () => {
    for (const gate of listGates()) {
      expect(gate.evidence.length).toBeGreaterThan(0);
      for (const item of gate.evidence) {
        expect(item.length).toBeGreaterThan(0);
      }
      expect(gate.blocksProgression).toBe(true);
    }
  });
});

describe("gateAfter", () => {
  test("returns the right gate for each gate week", () => {
    for (const weekNumber of GATE_WEEKS) {
      expect(gateAfter(weekNumber)?.afterWeek).toBe(weekNumber);
    }
  });

  test("returns undefined for a non-gate week", () => {
    expect(gateAfter(1)).toBeUndefined();
    expect(gateAfter(5)).toBeUndefined();
  });
});

describe("checkpointWeeks", () => {
  test("returns exactly the 7 checkpointed weeks, in order", () => {
    const weeks = checkpointWeeks().map((week) => week.week);
    expect(weeks).toEqual([...GATE_WEEKS]);
  });
});

describe("weekSchema (inline fixtures, real data file untouched)", () => {
  const validWeek = {
    week: 1,
    focus: "Orientasi CP & C++ dasar",
    content: ["Algoritma/pseudocode", "I/O"],
    outcome: "Menulis program dasar.",
    practice: "6-10 soal dasar.",
    topicFamilies: ["dasar-pemrograman"],
    problemLoad: { min: 6, max: 10 },
    hasMiniContest: false,
    checkpoint: null,
  };

  test("accepts a well-formed week", () => {
    expect(weekSchema.safeParse(validWeek).success).toBe(true);
  });

  test("accepts a well-formed week with a null problemLoad and a checkpoint", () => {
    const result = weekSchema.safeParse({
      ...validWeek,
      problemLoad: null,
      checkpoint: 1,
    });
    expect(result.success).toBe(true);
  });

  test("rejects week 0", () => {
    expect(weekSchema.safeParse({ ...validWeek, week: 0 }).success).toBe(false);
  });

  test("rejects week 29", () => {
    expect(weekSchema.safeParse({ ...validWeek, week: 29 }).success).toBe(false);
  });

  test("rejects an empty content array", () => {
    expect(weekSchema.safeParse({ ...validWeek, content: [] }).success).toBe(false);
  });

  test("rejects a content array containing an empty string", () => {
    expect(weekSchema.safeParse({ ...validWeek, content: ["ok", ""] }).success).toBe(false);
  });

  test("rejects an empty topicFamilies array", () => {
    expect(weekSchema.safeParse({ ...validWeek, topicFamilies: [] }).success).toBe(false);
  });

  test("rejects a non-slug topicFamilies entry", () => {
    const result = weekSchema.safeParse({ ...validWeek, topicFamilies: ["Not A Slug"] });
    expect(result.success).toBe(false);
  });

  test("rejects problemLoad with min > max", () => {
    const result = weekSchema.safeParse({
      ...validWeek,
      problemLoad: { min: 12, max: 8 },
    });
    expect(result.success).toBe(false);
  });

  test("accepts problemLoad with min === max", () => {
    const result = weekSchema.safeParse({
      ...validWeek,
      problemLoad: { min: 10, max: 10 },
    });
    expect(result.success).toBe(true);
  });

  test("rejects checkpoint 0", () => {
    expect(weekSchema.safeParse({ ...validWeek, checkpoint: 0 }).success).toBe(false);
  });

  test("rejects checkpoint 8", () => {
    expect(weekSchema.safeParse({ ...validWeek, checkpoint: 8 }).success).toBe(false);
  });

  test("rejects an empty focus string", () => {
    expect(weekSchema.safeParse({ ...validWeek, focus: "" }).success).toBe(false);
  });

  test("rejects a record missing a required field", () => {
    const { hasMiniContest: _hasMiniContest, ...withoutMiniContest } = validWeek;
    expect(weekSchema.safeParse(withoutMiniContest).success).toBe(false);
  });

  test("rejects an unknown-shaped object entirely", () => {
    expect(weekSchema.safeParse({ foo: "bar" }).success).toBe(false);
  });

  test("rejects a non-object value", () => {
    expect(weekSchema.safeParse("not a week").success).toBe(false);
  });
});

describe("weeksSchema (inline fixtures)", () => {
  const validFile = {
    syllabusVersion: "2.0",
    syllabusDate: "2026-09-04",
    sourceSection: "§4",
    weeks: [
      {
        week: 1,
        focus: "Orientasi CP & C++ dasar",
        content: ["Algoritma/pseudocode"],
        outcome: "Menulis program dasar.",
        practice: "6-10 soal dasar.",
        topicFamilies: ["dasar-pemrograman"],
        problemLoad: { min: 6, max: 10 },
        hasMiniContest: false,
        checkpoint: null,
      },
    ],
  };

  test("accepts a well-formed file", () => {
    expect(weeksSchema.safeParse(validFile).success).toBe(true);
  });

  test("rejects a file missing sourceSection", () => {
    const { sourceSection: _sourceSection, ...withoutSection } = validFile;
    expect(weeksSchema.safeParse(withoutSection).success).toBe(false);
  });

  test("rejects a file whose weeks contains an invalid entry", () => {
    const invalidFile = {
      ...validFile,
      weeks: [{ ...validFile.weeks[0], week: 0 }],
    };
    expect(weeksSchema.safeParse(invalidFile).success).toBe(false);
  });

  test("rejects a file where weeks is not an array", () => {
    expect(weeksSchema.safeParse({ ...validFile, weeks: "nope" }).success).toBe(false);
  });
});

describe("gateSchema (inline fixtures, real data file untouched)", () => {
  const validGate = {
    afterWeek: 4,
    evidence: ["Dapat coding dasar."],
    blocksProgression: true,
  };

  test("accepts a well-formed gate", () => {
    expect(gateSchema.safeParse(validGate).success).toBe(true);
  });

  test("accepts every documented afterWeek value", () => {
    for (const weekNumber of GATE_WEEKS) {
      const result = gateSchema.safeParse({ ...validGate, afterWeek: weekNumber });
      expect(result.success).toBe(true);
    }
  });

  test("rejects an afterWeek not in the gate-week set", () => {
    expect(gateSchema.safeParse({ ...validGate, afterWeek: 5 }).success).toBe(false);
    expect(gateSchema.safeParse({ ...validGate, afterWeek: 0 }).success).toBe(false);
  });

  test("rejects an empty evidence array", () => {
    expect(gateSchema.safeParse({ ...validGate, evidence: [] }).success).toBe(false);
  });

  test("rejects an evidence array containing an empty string", () => {
    expect(gateSchema.safeParse({ ...validGate, evidence: ["ok", ""] }).success).toBe(false);
  });

  test("rejects a non-boolean blocksProgression", () => {
    const result = gateSchema.safeParse({ ...validGate, blocksProgression: "yes" });
    expect(result.success).toBe(false);
  });

  test("rejects a record missing a required field", () => {
    const { blocksProgression: _blocksProgression, ...withoutFlag } = validGate;
    expect(gateSchema.safeParse(withoutFlag).success).toBe(false);
  });

  test("rejects an unknown-shaped object entirely", () => {
    expect(gateSchema.safeParse({ foo: "bar" }).success).toBe(false);
  });
});

describe("gatesSchema (inline fixtures)", () => {
  const validFile = {
    syllabusVersion: "2.0",
    syllabusDate: "2026-09-04",
    sourceSection: "§4.1",
    gates: [
      {
        afterWeek: 4,
        evidence: ["Dapat coding dasar."],
        blocksProgression: true,
      },
    ],
  };

  test("accepts a well-formed file", () => {
    expect(gatesSchema.safeParse(validFile).success).toBe(true);
  });

  test("rejects a file missing syllabusDate", () => {
    const { syllabusDate: _syllabusDate, ...withoutDate } = validFile;
    expect(gatesSchema.safeParse(withoutDate).success).toBe(false);
  });

  test("rejects a file whose gates contains an invalid entry", () => {
    const invalidFile = {
      ...validFile,
      gates: [{ ...validFile.gates[0], afterWeek: 5 }],
    };
    expect(gatesSchema.safeParse(invalidFile).success).toBe(false);
  });

  test("rejects a file where gates is not an array", () => {
    expect(gatesSchema.safeParse({ ...validFile, gates: "nope" }).success).toBe(false);
  });
});
