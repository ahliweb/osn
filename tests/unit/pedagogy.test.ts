/**
 * Tests for the pedagogy schemas (`src/schema/session-template.ts`,
 * `src/schema/mentor-sop.ts`, `src/schema/hint-policy.ts`) and the typed
 * loader/lookup helpers over the real corpus (`src/domain/pedagogy.ts`,
 * `data/session-template.json`, `data/mentor-sop.json`,
 * `data/hint-policy.json`).
 *
 * Malformed-input fixtures are constructed inline against the schemas; the
 * real data files under `data/` are never mutated by these tests.
 */

import { describe, expect, test } from "bun:test";
import {
  getHintLevel,
  getSession,
  hintLevels,
  hintPolicyCallout,
  minimumTests,
  nextHintLevel,
  postAcceptedQuestions,
  requiresResolve,
  sessionSegments,
  sessionTotalMinutes,
  sopSteps,
} from "../../src/domain/pedagogy";
import { hintLevelSchema, hintPolicyFileSchema } from "../../src/schema/hint-policy";
import { mentorSopFileSchema, sopStepSchema } from "../../src/schema/mentor-sop";
import {
  segmentSchema,
  sessionSchema,
  sessionTemplateFileSchema,
} from "../../src/schema/session-template";

const EXPECTED_HINT_LEVEL_IDS = [
  "pertanyaan-pemodelan",
  "arah-complexity",
  "observasi-kunci",
  "pseudocode-parsial",
  "editorial",
] as const;

const EXPECTED_MINIMUM_TESTS = [
  "contoh",
  "batas minimum",
  "batas maksimum konseptual",
  "duplikasi",
  "urutan buruk",
  "overflow",
  "disconnected/negative-edge bila relevan",
] as const;

describe("data/session-template.json (via src/domain/pedagogy.ts)", () => {
  test("the real data file parses through the schema without error", () => {
    expect(() => getSession(1)).not.toThrow();
    expect(() => getSession(2)).not.toThrow();
  });

  test("both sessions total exactly 120 minutes", () => {
    expect(sessionTotalMinutes(1)).toBe(120);
    expect(sessionTotalMinutes(2)).toBe(120);
  });

  test("both sessions' segments are contiguous from 0 with no gaps or overlaps", () => {
    for (const sessionNo of [1, 2] as const) {
      const segments = sessionSegments(sessionNo);
      expect(segments.length).toBeGreaterThan(0);

      let expectedStart = 0;
      for (const segment of segments) {
        expect(segment.startMinute).toBe(expectedStart);
        expect(segment.startMinute).toBeLessThan(segment.endMinute);
        expectedStart = segment.endMinute;
      }
      expect(expectedStart).toBe(120);
    }
  });

  test("session 1 is konsep & guided practice, session 2 is problem solving & feedback", () => {
    expect(getSession(1).focus).toBe("konsep & guided practice");
    expect(getSession(2).focus).toBe("problem solving & feedback");
  });

  test("every segment has non-empty, Indonesian-verbatim activity text", () => {
    for (const sessionNo of [1, 2] as const) {
      for (const segment of sessionSegments(sessionNo)) {
        expect(segment.activity.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("getSession", () => {
  test("throws a helpful error listing valid session numbers for an unknown session", () => {
    // @ts-expect-error -- intentionally invalid input to exercise the error path
    expect(() => getSession(3)).toThrow(/1, 2/);
  });
});

describe("data/mentor-sop.json (via src/domain/pedagogy.ts)", () => {
  test("the real data file parses through the schema without error", () => {
    expect(() => sopSteps()).not.toThrow();
  });

  test("exposes exactly 7 SOP steps ordered 1..7 with no gaps", () => {
    const steps = sopSteps();
    expect(steps).toHaveLength(7);
    expect(steps.map((step) => step.order)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  test("every step has non-empty, Indonesian-verbatim instruction text", () => {
    for (const step of sopSteps()) {
      expect(step.instruction.length).toBeGreaterThan(0);
    }
  });

  test("minimumTests() has the 7 source items from step 6", () => {
    expect(minimumTests()).toEqual([...EXPECTED_MINIMUM_TESTS]);
  });

  test("postAcceptedQuestions() has the 4 source items from step 7", () => {
    expect(postAcceptedQuestions()).toEqual([
      "mengapa benar",
      "mengapa cukup cepat",
      "apa alternatifnya",
      "kapan teknik ini tidak berlaku",
    ]);
  });
});

describe("data/hint-policy.json (via src/domain/pedagogy.ts)", () => {
  test("the real data file parses through the schema without error", () => {
    expect(() => hintLevels()).not.toThrow();
  });

  test("exposes exactly 5 hint levels ordered 1..5 with the expected ids", () => {
    const levels = hintLevels();
    expect(levels).toHaveLength(5);
    expect(levels.map((level) => level.level)).toEqual([1, 2, 3, 4, 5]);
    expect(levels.map((level) => level.id)).toEqual([...EXPECTED_HINT_LEVEL_IDS]);
  });

  test("hintPolicyCallout() returns the non-empty §5.3 callout text, verbatim", () => {
    expect(hintPolicyCallout().length).toBeGreaterThan(0);
    expect(hintPolicyCallout()).toContain("pertanyaan pemodelan");
    expect(hintPolicyCallout()).toContain("editorial");
    expect(hintPolicyCallout()).toContain("dire-solve");
  });
});

describe("getHintLevel", () => {
  test("returns the matching level for a known level number", () => {
    expect(getHintLevel(1).id).toBe("pertanyaan-pemodelan");
    expect(getHintLevel(5).id).toBe("editorial");
  });

  test("throws a helpful error naming the valid range for an out-of-range level", () => {
    expect(() => getHintLevel(0)).toThrow(/1-5/);
    expect(() => getHintLevel(6)).toThrow(/1-5/);
  });
});

describe("nextHintLevel", () => {
  test("is strictly monotonic across 1 -> 2 -> 3 -> 4 -> 5", () => {
    let current = 1;
    const visited = [current];
    for (let i = 0; i < 4; i++) {
      const next = nextHintLevel(current);
      expect(next).not.toBeNull();
      const nextLevel = next?.level ?? 0;
      expect(nextLevel).toBeGreaterThan(current);
      current = nextLevel;
      visited.push(current);
    }
    expect(visited).toEqual([1, 2, 3, 4, 5]);
  });

  test("returns null at the terminal editorial level (level 5), the explicit terminal case", () => {
    expect(nextHintLevel(5)).toBeNull();
  });

  test("does not wrap back to level 1 at the terminal level", () => {
    const next = nextHintLevel(5);
    expect(next).not.toEqual(getHintLevel(1));
  });
});

describe("requiresResolve", () => {
  test("is false for levels 1-3", () => {
    expect(requiresResolve(1)).toBe(false);
    expect(requiresResolve(2)).toBe(false);
    expect(requiresResolve(3)).toBe(false);
  });

  test("is true for levels 4 and 5", () => {
    expect(requiresResolve(4)).toBe(true);
    expect(requiresResolve(5)).toBe(true);
  });

  test("throws for level 0, naming the valid range", () => {
    expect(() => requiresResolve(0)).toThrow(/1-5/);
  });

  test("throws for level 6, naming the valid range", () => {
    expect(() => requiresResolve(6)).toThrow(/1-5/);
  });
});

describe("segmentSchema (inline fixtures, real data file untouched)", () => {
  const validSegment = { startMinute: 0, endMinute: 15, activity: "Retrieval quiz." };

  test("accepts a well-formed segment", () => {
    expect(segmentSchema.safeParse(validSegment).success).toBe(true);
  });

  test("rejects startMinute >= endMinute", () => {
    expect(
      segmentSchema.safeParse({ ...validSegment, startMinute: 15, endMinute: 15 }).success,
    ).toBe(false);
    expect(
      segmentSchema.safeParse({ ...validSegment, startMinute: 20, endMinute: 15 }).success,
    ).toBe(false);
  });

  test("rejects an empty activity", () => {
    expect(segmentSchema.safeParse({ ...validSegment, activity: "" }).success).toBe(false);
  });
});

describe("sessionSchema (inline fixtures, real data file untouched)", () => {
  const validSession = {
    sessionNo: 1,
    focus: "konsep & guided practice",
    segments: [
      { startMinute: 0, endMinute: 15, activity: "A" },
      { startMinute: 15, endMinute: 45, activity: "B" },
      { startMinute: 45, endMinute: 90, activity: "C" },
      { startMinute: 90, endMinute: 115, activity: "D" },
      { startMinute: 115, endMinute: 120, activity: "E" },
    ],
  };

  test("accepts a well-formed session", () => {
    expect(sessionSchema.safeParse(validSession).success).toBe(true);
  });

  test("rejects a session whose segments leave a gap", () => {
    const withGap = {
      ...validSession,
      segments: [
        { startMinute: 0, endMinute: 15, activity: "A" },
        // gap: next segment should start at 15, starts at 20 instead
        { startMinute: 20, endMinute: 45, activity: "B" },
        { startMinute: 45, endMinute: 90, activity: "C" },
        { startMinute: 90, endMinute: 115, activity: "D" },
        { startMinute: 115, endMinute: 120, activity: "E" },
      ],
    };
    const result = sessionSchema.safeParse(withGap);
    expect(result.success).toBe(false);
  });

  test("rejects a session ending at 115 instead of 120", () => {
    const shortSession = {
      ...validSession,
      segments: [
        { startMinute: 0, endMinute: 15, activity: "A" },
        { startMinute: 15, endMinute: 45, activity: "B" },
        { startMinute: 45, endMinute: 90, activity: "C" },
        { startMinute: 90, endMinute: 110, activity: "D" },
        { startMinute: 110, endMinute: 115, activity: "E" },
      ],
    };
    const result = sessionSchema.safeParse(shortSession);
    expect(result.success).toBe(false);
  });

  test("rejects overlapping segments", () => {
    const overlapping = {
      ...validSession,
      segments: [
        { startMinute: 0, endMinute: 15, activity: "A" },
        { startMinute: 15, endMinute: 45, activity: "B" },
        // overlap: starts at 40, before the previous segment ended at 45
        { startMinute: 40, endMinute: 90, activity: "C" },
        { startMinute: 90, endMinute: 115, activity: "D" },
        { startMinute: 115, endMinute: 120, activity: "E" },
      ],
    };
    const result = sessionSchema.safeParse(overlapping);
    expect(result.success).toBe(false);
  });

  test("rejects a session with fewer than 5 segments", () => {
    const result = sessionSchema.safeParse({
      ...validSession,
      segments: validSession.segments.slice(0, 4),
    });
    expect(result.success).toBe(false);
  });
});

describe("sessionTemplateFileSchema (inline fixtures)", () => {
  const validFile = {
    syllabusVersion: "2.0",
    syllabusDate: "2026-09-04",
    sourceSection: "§5.1",
    sessions: [
      {
        sessionNo: 1,
        focus: "konsep & guided practice",
        segments: [
          { startMinute: 0, endMinute: 15, activity: "A" },
          { startMinute: 15, endMinute: 45, activity: "B" },
          { startMinute: 45, endMinute: 90, activity: "C" },
          { startMinute: 90, endMinute: 115, activity: "D" },
          { startMinute: 115, endMinute: 120, activity: "E" },
        ],
      },
      {
        sessionNo: 2,
        focus: "problem solving & feedback",
        segments: [
          { startMinute: 0, endMinute: 15, activity: "A" },
          { startMinute: 15, endMinute: 45, activity: "B" },
          { startMinute: 45, endMinute: 90, activity: "C" },
          { startMinute: 90, endMinute: 115, activity: "D" },
          { startMinute: 115, endMinute: 120, activity: "E" },
        ],
      },
    ],
  };

  test("accepts a well-formed file", () => {
    expect(sessionTemplateFileSchema.safeParse(validFile).success).toBe(true);
  });

  test("rejects a file with two sessions both numbered 1", () => {
    const invalidFile = {
      ...validFile,
      sessions: [validFile.sessions[0], { ...validFile.sessions[1], sessionNo: 1 }],
    };
    expect(sessionTemplateFileSchema.safeParse(invalidFile).success).toBe(false);
  });

  test("rejects a file whose sessions contains an invalid entry", () => {
    const invalidFile = {
      ...validFile,
      sessions: [
        {
          ...validFile.sessions[0],
          segments: (validFile.sessions[0]?.segments ?? []).slice(0, 4),
        },
        validFile.sessions[1],
      ],
    };
    expect(sessionTemplateFileSchema.safeParse(invalidFile).success).toBe(false);
  });
});

describe("sopStepSchema (inline fixtures, real data file untouched)", () => {
  const validStep = { order: 1, instruction: "Mulai dari problem." };

  test("accepts a well-formed step", () => {
    expect(sopStepSchema.safeParse(validStep).success).toBe(true);
  });

  test("rejects order 0", () => {
    expect(sopStepSchema.safeParse({ ...validStep, order: 0 }).success).toBe(false);
  });

  test("rejects order 8", () => {
    expect(sopStepSchema.safeParse({ ...validStep, order: 8 }).success).toBe(false);
  });

  test("rejects an empty instruction", () => {
    expect(sopStepSchema.safeParse({ ...validStep, instruction: "" }).success).toBe(false);
  });
});

describe("mentorSopFileSchema (inline fixtures)", () => {
  const validFile = {
    syllabusVersion: "2.0",
    syllabusDate: "2026-09-04",
    sourceSection: "§5.2",
    steps: [1, 2, 3, 4, 5, 6, 7].map((order) => ({
      order,
      instruction: `Step ${order}.`,
    })),
    minimumTests: [...EXPECTED_MINIMUM_TESTS],
    postAcceptedQuestions: [
      "mengapa benar",
      "mengapa cukup cepat",
      "apa alternatifnya",
      "kapan teknik ini tidak berlaku",
    ],
  };

  test("accepts a well-formed file", () => {
    expect(mentorSopFileSchema.safeParse(validFile).success).toBe(true);
  });

  test("rejects steps ordered 1, 2, 4 (a gap, missing 3, 5, 6, 7 too short to even reach 7)", () => {
    const invalidFile = {
      ...validFile,
      steps: [
        { order: 1, instruction: "Step 1." },
        { order: 2, instruction: "Step 2." },
        { order: 4, instruction: "Step 4." },
      ],
    };
    const result = mentorSopFileSchema.safeParse(invalidFile);
    expect(result.success).toBe(false);
  });

  test("rejects seven steps with a gap (1,2,3,4,5,6,6 -- duplicate 6, missing 7)", () => {
    const invalidFile = {
      ...validFile,
      steps: [1, 2, 3, 4, 5, 6, 6].map((order) => ({
        order,
        instruction: `Step ${order}.`,
      })),
    };
    const result = mentorSopFileSchema.safeParse(invalidFile);
    expect(result.success).toBe(false);
  });

  test("rejects a file whose minimumTests does not have exactly 7 items", () => {
    const invalidFile = { ...validFile, minimumTests: validFile.minimumTests.slice(0, 6) };
    expect(mentorSopFileSchema.safeParse(invalidFile).success).toBe(false);
  });

  test("rejects a file whose postAcceptedQuestions does not have exactly 4 items", () => {
    const invalidFile = {
      ...validFile,
      postAcceptedQuestions: validFile.postAcceptedQuestions.slice(0, 3),
    };
    expect(mentorSopFileSchema.safeParse(invalidFile).success).toBe(false);
  });
});

describe("hintLevelSchema (inline fixtures, real data file untouched)", () => {
  const validLevel = {
    level: 1,
    id: "pertanyaan-pemodelan",
    description: "pertanyaan pemodelan",
    requiresResolve: false,
  };

  test("accepts a well-formed level", () => {
    expect(hintLevelSchema.safeParse(validLevel).success).toBe(true);
  });

  test("rejects level 6", () => {
    const result = hintLevelSchema.safeParse({ ...validLevel, level: 6 });
    expect(result.success).toBe(false);
  });

  test("rejects level 0", () => {
    const result = hintLevelSchema.safeParse({ ...validLevel, level: 0 });
    expect(result.success).toBe(false);
  });

  test("rejects an unknown id", () => {
    const result = hintLevelSchema.safeParse({ ...validLevel, id: "not-a-level" });
    expect(result.success).toBe(false);
  });
});

describe("hintPolicyFileSchema (inline fixtures)", () => {
  const validFile = {
    syllabusVersion: "2.0",
    syllabusDate: "2026-09-04",
    sourceSection: "§5.3",
    calloutText: "Progressive hinting callout text.",
    resolvePolicy: "Resolve policy summary.",
    levels: [
      {
        level: 1,
        id: "pertanyaan-pemodelan",
        description: "pertanyaan pemodelan",
        requiresResolve: false,
      },
      { level: 2, id: "arah-complexity", description: "arah complexity", requiresResolve: false },
      { level: 3, id: "observasi-kunci", description: "observasi kunci", requiresResolve: false },
      {
        level: 4,
        id: "pseudocode-parsial",
        description: "pseudocode parsial",
        requiresResolve: true,
      },
      { level: 5, id: "editorial", description: "editorial", requiresResolve: true },
    ],
  };

  test("accepts a well-formed file", () => {
    expect(hintPolicyFileSchema.safeParse(validFile).success).toBe(true);
  });

  test("rejects a file with a level 6 entry (only 5 levels allowed, and level must be 1-5)", () => {
    const invalidFile = {
      ...validFile,
      levels: [...validFile.levels.slice(0, 4), { ...validFile.levels[4], level: 6 }],
    };
    const result = hintPolicyFileSchema.safeParse(invalidFile);
    expect(result.success).toBe(false);
  });

  test("rejects a file with duplicate levels (1,2,3,4,4)", () => {
    const invalidFile = {
      ...validFile,
      levels: [...validFile.levels.slice(0, 4), { ...validFile.levels[3] }],
    };
    const result = hintPolicyFileSchema.safeParse(invalidFile);
    expect(result.success).toBe(false);
  });

  test("rejects a file missing calloutText", () => {
    const { calloutText: _calloutText, ...withoutCallout } = validFile;
    expect(hintPolicyFileSchema.safeParse(withoutCallout).success).toBe(false);
  });

  test("rejects a file missing resolvePolicy", () => {
    const { resolvePolicy: _resolvePolicy, ...withoutPolicy } = validFile;
    expect(hintPolicyFileSchema.safeParse(withoutPolicy).success).toBe(false);
  });
});
