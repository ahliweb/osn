/**
 * Tests for the assessment schemas (`src/schema/assessment.ts`,
 * `src/schema/problem-status.ts`) and the typed loader/lookup/grading
 * helpers over the real corpus (`src/domain/assessment.ts`,
 * `data/assessment-weights.json`, `data/problem-status.json`).
 *
 * Malformed-input fixtures are constructed inline against the schemas; the
 * real data files under `data/` are never mutated by these tests.
 */

import { describe, expect, test } from "bun:test";
import {
  computeWeightedScore,
  DIAGNOSIS_DIMENSIONS,
  followUpFor,
  getComponent,
  getStatus,
  listComponents,
  listStatuses,
  resolveSchedule,
  totalWeight,
} from "../../src/domain/assessment";
import {
  ASSESSMENT_COMPONENT_IDS,
  assessmentComponentSchema,
  assessmentWeightsFileSchema,
  TOTAL_ASSESSMENT_WEIGHT,
} from "../../src/schema/assessment";
import {
  PROBLEM_STATUS_CODES,
  problemStatusFileSchema,
  problemStatusSchema,
} from "../../src/schema/problem-status";

const EXPECTED_COMPONENT_IDS = [
  "computational-thinking",
  "problem-solving",
  "implementation-correctness",
  "contest-performance",
  "upsolve-learning-process",
] as const;

const FULL_SCORES: Readonly<Record<string, number>> = {
  "computational-thinking": 80,
  "problem-solving": 60,
  "implementation-correctness": 90,
  "contest-performance": 70,
  "upsolve-learning-process": 50,
};

describe("data/assessment-weights.json (via src/domain/assessment.ts)", () => {
  test("the real data file parses through the schema without error", () => {
    expect(() => listComponents()).not.toThrow();
  });

  test("exposes exactly the five expected component ids", () => {
    const ids = listComponents().map((component) => component.id);
    expect(ids).toEqual([...EXPECTED_COMPONENT_IDS]);
  });

  test("the five component weights sum to exactly 100", () => {
    expect(totalWeight()).toBe(100);
    const sum = listComponents().reduce((total, component) => total + component.weight, 0);
    expect(sum).toBe(100);
  });

  test("every component has non-empty evidence", () => {
    for (const component of listComponents()) {
      expect(component.evidence.length).toBeGreaterThan(0);
    }
  });
});

describe("getComponent", () => {
  test("returns the matching component for a known id", () => {
    expect(getComponent("computational-thinking").name).toBe("Computational thinking & konsep");
  });

  test("throws a helpful error naming the valid ids for an unknown id", () => {
    expect(() => getComponent("not-a-component")).toThrow(/computational-thinking/);
  });
});

describe("computeWeightedScore", () => {
  test("returns 100 when every component scores 100", () => {
    const scores = Object.fromEntries(EXPECTED_COMPONENT_IDS.map((id) => [id, 100]));
    expect(computeWeightedScore(scores)).toBe(100);
  });

  test("returns 0 when every component scores 0", () => {
    const scores = Object.fromEntries(EXPECTED_COMPONENT_IDS.map((id) => [id, 0]));
    expect(computeWeightedScore(scores)).toBe(0);
  });

  test("a hand-computed mixed case returns the exact expected value", () => {
    // 80*20 + 60*25 + 90*25 + 70*20 + 50*10 = 1600+1500+2250+1400+500 = 7250
    // 7250 / 100 = 72.5
    expect(computeWeightedScore(FULL_SCORES)).toBe(72.5);
  });

  test("rejects a score of -1, naming the offending component", () => {
    const scores = { ...FULL_SCORES, "computational-thinking": -1 };
    expect(() => computeWeightedScore(scores)).toThrow(/computational-thinking/);
    expect(() => computeWeightedScore(scores)).toThrow(/-1/);
  });

  test("rejects a score of 101, naming the offending component", () => {
    const scores = { ...FULL_SCORES, "implementation-correctness": 101 };
    expect(() => computeWeightedScore(scores)).toThrow(/implementation-correctness/);
  });

  test("rejects an unknown component id", () => {
    const scores = { ...FULL_SCORES, "not-a-real-component": 50 };
    expect(() => computeWeightedScore(scores)).toThrow(/not-a-real-component/);
  });

  test("rejects a componentScores missing a required id, naming which is absent", () => {
    const { "upsolve-learning-process": _omitted, ...withoutUpsolve } = FULL_SCORES;
    expect(() => computeWeightedScore(withoutUpsolve)).toThrow(/upsolve-learning-process/);
  });

  test("avoids floating-point drift via integer arithmetic (naive per-term division would drift)", () => {
    const allOnes = Object.fromEntries(EXPECTED_COMPONENT_IDS.map((id) => [id, 1]));

    // Naive approach: divide each component's contribution by 100
    // individually, then sum -- this is the drift this function's
    // documented rounding rule (integer sum first, one division at the
    // end) is designed to avoid.
    let naive = 0;
    for (const component of listComponents()) {
      const score = allOnes[component.id];
      naive += ((score ?? 0) * component.weight) / 100;
    }

    // The weights sum to exactly 100, so with every score at 1 the exact
    // mathematical result is exactly 1 -- but the naive approach drifts
    // below it due to IEEE-754 double-precision rounding.
    expect(naive).not.toBe(1);
    expect(naive).toBeCloseTo(1, 10);

    expect(computeWeightedScore(allOnes)).toBe(1);
  });
});

describe("data/problem-status.json (via src/domain/assessment.ts)", () => {
  test("the real data file parses through the schema without error", () => {
    expect(() => listStatuses()).not.toThrow();
  });

  test("exposes exactly the four A/B/C/D status codes", () => {
    const codes = listStatuses().map((status) => status.code);
    expect(codes).toEqual(["A", "B", "C", "D"]);
  });

  test("followUpFor returns non-empty text for every status", () => {
    for (const code of ["A", "B", "C", "D"] as const) {
      expect(followUpFor(code).length).toBeGreaterThan(0);
    }
  });
});

describe("getStatus", () => {
  test("returns the matching status for a known code", () => {
    expect(getStatus("B").meaning).toBe("Solved after hint");
  });

  test("throws a helpful error naming the valid codes for an unknown code", () => {
    expect(() => getStatus("Z")).toThrow(/A, B, C, D/);
  });
});

describe("resolveSchedule", () => {
  test("A resolves to review-only", () => {
    const result = resolveSchedule("A", new Date("2026-01-01T00:00:00.000Z"));
    expect(result.kind).toBe("review-only");
    expect(result.action.length).toBeGreaterThan(0);
  });

  test("B resolves to a scheduled-resolve window of exactly 3 and 7 days after solvedOn", () => {
    const solvedOn = new Date("2026-01-01T00:00:00.000Z");
    const result = resolveSchedule("B", solvedOn);
    expect(result.kind).toBe("scheduled-resolve");
    if (result.kind !== "scheduled-resolve") throw new Error("unreachable");
    expect(result.earliest.toISOString()).toBe("2026-01-04T00:00:00.000Z");
    expect(result.latest.toISOString()).toBe("2026-01-08T00:00:00.000Z");
  });

  test("B window is timezone-independent (UTC-only arithmetic)", () => {
    const solvedOn = new Date("2026-06-15T12:34:56.789Z");
    const result = resolveSchedule("B", solvedOn);
    if (result.kind !== "scheduled-resolve") throw new Error("unreachable");
    expect(result.earliest.toISOString()).toBe("2026-06-18T12:34:56.789Z");
    expect(result.latest.toISOString()).toBe("2026-06-22T12:34:56.789Z");
  });

  test("does not mutate the input solvedOn Date", () => {
    const solvedOn = new Date("2026-01-01T00:00:00.000Z");
    const originalIso = solvedOn.toISOString();
    const originalTime = solvedOn.getTime();
    resolveSchedule("B", solvedOn);
    expect(solvedOn.toISOString()).toBe(originalIso);
    expect(solvedOn.getTime()).toBe(originalTime);
  });

  test("C resolves to reimplement-and-resolve with both flags true and the same 3-7 day window", () => {
    const solvedOn = new Date("2026-01-01T00:00:00.000Z");
    const result = resolveSchedule("C", solvedOn);
    expect(result.kind).toBe("reimplement-and-resolve");
    if (result.kind !== "reimplement-and-resolve") throw new Error("unreachable");
    expect(result.requiresReimplementation).toBe(true);
    expect(result.requiresExplanation).toBe(true);
    expect(result.earliest.toISOString()).toBe("2026-01-04T00:00:00.000Z");
    expect(result.latest.toISOString()).toBe("2026-01-08T00:00:00.000Z");
  });

  test("D resolves to diagnose-gap with exactly the five failure dimensions", () => {
    const result = resolveSchedule("D", new Date("2026-01-01T00:00:00.000Z"));
    expect(result.kind).toBe("diagnose-gap");
    if (result.kind !== "diagnose-gap") throw new Error("unreachable");
    expect(result.dimensions).toEqual([...DIAGNOSIS_DIMENSIONS]);
    expect(result.dimensions).toEqual([
      "konsep",
      "modeling",
      "complexity",
      "implementation",
      "debugging",
    ]);
  });

  test("throws for an unknown status code", () => {
    expect(() => resolveSchedule("Z", new Date("2026-01-01T00:00:00.000Z"))).toThrow(/A, B, C, D/);
  });
});

describe("assessmentComponentSchema (inline fixtures, real data file untouched)", () => {
  const validComponent = {
    id: "computational-thinking",
    name: "Computational thinking & konsep",
    weight: 20,
    evidence: ["Tracing"],
  };

  test("accepts a well-formed component", () => {
    expect(assessmentComponentSchema.safeParse(validComponent).success).toBe(true);
  });

  test("rejects empty evidence", () => {
    const result = assessmentComponentSchema.safeParse({ ...validComponent, evidence: [] });
    expect(result.success).toBe(false);
  });

  test("rejects a non-integer weight", () => {
    const result = assessmentComponentSchema.safeParse({ ...validComponent, weight: 20.5 });
    expect(result.success).toBe(false);
  });

  test("rejects an unknown component id", () => {
    const result = assessmentComponentSchema.safeParse({ ...validComponent, id: "not-a-known-id" });
    expect(result.success).toBe(false);
  });
});

describe("assessmentWeightsFileSchema (inline fixtures)", () => {
  const validFile = {
    syllabusVersion: "2.0",
    syllabusDate: "2026-09-04",
    sourceSection: "§6.1",
    components: [
      {
        id: "computational-thinking",
        name: "Computational thinking & konsep",
        weight: 20,
        evidence: ["Tracing"],
      },
      {
        id: "problem-solving",
        name: "Problem solving & algorithm selection",
        weight: 25,
        evidence: ["Constraint analysis"],
      },
      {
        id: "implementation-correctness",
        name: "Implementation correctness",
        weight: 25,
        evidence: ["Accepted rate"],
      },
      { id: "contest-performance", name: "Contest performance", weight: 20, evidence: ["Score"] },
      {
        id: "upsolve-learning-process",
        name: "Upsolve & learning process",
        weight: 10,
        evidence: ["Re-solve"],
      },
    ],
  };

  test("accepts a well-formed file whose weights sum to exactly 100", () => {
    expect(assessmentWeightsFileSchema.safeParse(validFile).success).toBe(true);
  });

  test("rejects weights summing to 99, with a message stating the actual sum", () => {
    const invalidFile = {
      ...validFile,
      components: [...validFile.components.slice(0, 4), { ...validFile.components[4], weight: 9 }],
    };
    const result = assessmentWeightsFileSchema.safeParse(invalidFile);
    expect(result.success).toBe(false);
    if (result.success) throw new Error("unreachable");
    const messages = result.error.issues.map((issue) => issue.message).join("\n");
    expect(messages).toContain("99");
    expect(messages).toContain("sum to exactly 100");
  });

  test("rejects a file with fewer than the five expected components", () => {
    const invalidFile = { ...validFile, components: validFile.components.slice(0, 4) };
    expect(assessmentWeightsFileSchema.safeParse(invalidFile).success).toBe(false);
  });

  test("rejects a file with a duplicate component id", () => {
    const invalidFile = {
      ...validFile,
      components: [...validFile.components.slice(0, 4), { ...validFile.components[3] }],
    };
    const result = assessmentWeightsFileSchema.safeParse(invalidFile);
    expect(result.success).toBe(false);
  });

  test("ASSESSMENT_COMPONENT_IDS and TOTAL_ASSESSMENT_WEIGHT match the real corpus", () => {
    expect(ASSESSMENT_COMPONENT_IDS).toEqual(EXPECTED_COMPONENT_IDS);
    expect(TOTAL_ASSESSMENT_WEIGHT).toBe(100);
  });
});

describe("problemStatusSchema (inline fixtures, real data file untouched)", () => {
  const validStatus = { code: "A", meaning: "Solved independently", followUp: "Review singkat." };

  test("accepts a well-formed status", () => {
    expect(problemStatusSchema.safeParse(validStatus).success).toBe(true);
  });

  test("rejects an unknown code", () => {
    expect(problemStatusSchema.safeParse({ ...validStatus, code: "E" }).success).toBe(false);
  });

  test("rejects an empty followUp", () => {
    expect(problemStatusSchema.safeParse({ ...validStatus, followUp: "" }).success).toBe(false);
  });
});

describe("problemStatusFileSchema (inline fixtures)", () => {
  const validFile = {
    syllabusVersion: "2.0",
    syllabusDate: "2026-09-04",
    sourceSection: "§6.2",
    statuses: [
      {
        code: "A",
        meaning: "Solved independently",
        followUp: "Review singkat; tandai pola transfer.",
      },
      { code: "B", meaning: "Solved after hint", followUp: "Re-solve 3-7 hari tanpa hint." },
      {
        code: "C",
        meaning: "Solved after editorial/solution",
        followUp: "Wajib reimplement + jelaskan invariant/state + re-solve terjadwal.",
      },
      {
        code: "D",
        meaning: "Unsolved/blocked",
        followUp: "Diagnosis gap: konsep, modeling, complexity, implementation, debugging.",
      },
    ],
  };

  test("accepts a well-formed file with exactly the four A/B/C/D codes", () => {
    expect(problemStatusFileSchema.safeParse(validFile).success).toBe(true);
  });

  test("rejects a file with a duplicate status code (two A's, missing D)", () => {
    const invalidFile = {
      ...validFile,
      statuses: [
        validFile.statuses[0],
        validFile.statuses[0],
        validFile.statuses[1],
        validFile.statuses[2],
      ],
    };
    const result = problemStatusFileSchema.safeParse(invalidFile);
    expect(result.success).toBe(false);
  });

  test("rejects a file with a fifth status code", () => {
    const invalidFile = {
      ...validFile,
      statuses: [
        ...validFile.statuses,
        { code: "E", meaning: "Not a real status", followUp: "N/A" },
      ],
    };
    const result = problemStatusFileSchema.safeParse(invalidFile);
    expect(result.success).toBe(false);
  });

  test("PROBLEM_STATUS_CODES matches the real corpus", () => {
    expect(PROBLEM_STATUS_CODES).toEqual(["A", "B", "C", "D"]);
  });
});
