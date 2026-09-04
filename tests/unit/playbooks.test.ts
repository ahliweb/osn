/**
 * Tests for the §7 playbook schema (`src/schema/playbook.ts`) and the
 * typed loader/lookup helpers plus the four executable decision selectors
 * over the real corpus (`src/domain/playbooks.ts`, `data/playbooks.json`).
 *
 * Malformed-input fixtures are constructed inline against the schemas; the
 * real data file under `data/` is never mutated by these tests.
 */

import { describe, expect, test } from "bun:test";
import {
  type ComplexityClass,
  complexityCandidates,
  dpDesignChecklist,
  FLOYD_WARSHALL_MAX_N,
  getPlaybook,
  listPlaybooks,
  selectRangeStructure,
  selectShortestPath,
  stressTestPlan,
} from "../../src/domain/playbooks";
import { playbookSchema, playbooksFileSchema } from "../../src/schema/playbook";

const EXPECTED_IDS = [
  "constraint-to-complexity",
  "shortest-path-selection",
  "range-query-selection",
  "dp-design",
  "subtask-strategy",
  "stress-testing",
  "osn-k-tracing",
] as const;

// --- data/playbooks.json (via src/domain/playbooks.ts) ----------------------

describe("data/playbooks.json (via src/domain/playbooks.ts)", () => {
  test("the real data file parses through the schema without error", () => {
    expect(() => listPlaybooks()).not.toThrow();
  });

  test("exposes exactly 7 playbooks with the expected ids, in order", () => {
    const ids = listPlaybooks().map((playbook) => playbook.id);
    expect(ids).toEqual([...EXPECTED_IDS]);
  });

  test("every playbook has a non-empty title, summary, and at least one rule", () => {
    for (const playbook of listPlaybooks()) {
      expect(playbook.title.length).toBeGreaterThan(0);
      expect(playbook.summary.length).toBeGreaterThan(0);
      expect(playbook.rules.length).toBeGreaterThan(0);
      for (const rule of playbook.rules) {
        expect(rule.length).toBeGreaterThan(0);
      }
    }
  });

  test("every rule is a verbatim substring of that playbook's summary", () => {
    for (const playbook of listPlaybooks()) {
      for (const rule of playbook.rules) {
        expect(playbook.summary.includes(rule)).toBe(true);
      }
    }
  });

  test("citations are exactly R3 for subtask-strategy (§7.5) and R2 for osn-k-tracing (§7.7), empty otherwise", () => {
    const citationsById = new Map(
      listPlaybooks().map((playbook) => [playbook.id, playbook.citations]),
    );

    expect(citationsById.get("constraint-to-complexity")).toEqual([]);
    expect(citationsById.get("shortest-path-selection")).toEqual([]);
    expect(citationsById.get("range-query-selection")).toEqual([]);
    expect(citationsById.get("dp-design")).toEqual([]);
    expect(citationsById.get("subtask-strategy")).toEqual(["R3"]);
    expect(citationsById.get("stress-testing")).toEqual([]);
    expect(citationsById.get("osn-k-tracing")).toEqual(["R2"]);
  });

  test("every playbook's sourceSection matches its id's §7.x subsection", () => {
    const sectionsById = new Map(
      listPlaybooks().map((playbook) => [playbook.id, playbook.sourceSection]),
    );

    expect(sectionsById.get("constraint-to-complexity")).toBe("§7.1");
    expect(sectionsById.get("shortest-path-selection")).toBe("§7.2");
    expect(sectionsById.get("range-query-selection")).toBe("§7.3");
    expect(sectionsById.get("dp-design")).toBe("§7.4");
    expect(sectionsById.get("subtask-strategy")).toBe("§7.5");
    expect(sectionsById.get("stress-testing")).toBe("§7.6");
    expect(sectionsById.get("osn-k-tracing")).toBe("§7.7");
  });

  test("getPlaybook returns the matching playbook for a known id", () => {
    expect(getPlaybook("dp-design").title).toBe("Mendesain DP");
  });

  test("getPlaybook throws a helpful error listing every valid id for an unknown id", () => {
    expect(() => getPlaybook("does-not-exist")).toThrow(/does-not-exist/);

    try {
      getPlaybook("does-not-exist");
      throw new Error("expected getPlaybook to throw");
    } catch (error) {
      const message = (error as Error).message;
      for (const id of EXPECTED_IDS) {
        expect(message).toContain(id);
      }
    }
  });
});

// --- complexityCandidates (§7.1 + §7.5) --------------------------------------

describe("complexityCandidates", () => {
  const cases: Array<{
    readonly n: number;
    readonly recommended: ComplexityClass;
    readonly rejectsSquare: boolean;
  }> = [
    { n: 1, recommended: "O(2^N)", rejectsSquare: false },
    { n: 20, recommended: "O(2^N)", rejectsSquare: false },
    { n: 21, recommended: "O(N^2)", rejectsSquare: false },
    { n: 2000, recommended: "O(N^2)", rejectsSquare: false },
    { n: 2001, recommended: "O(N log N)", rejectsSquare: true },
    { n: 200000, recommended: "O(N log N)", rejectsSquare: true },
    { n: 200001, recommended: "O(N)", rejectsSquare: true },
    { n: 10_000_000, recommended: "O(N)", rejectsSquare: true },
  ];

  for (const { n, recommended, rejectsSquare } of cases) {
    test(`n = ${n} recommends ${recommended} and ${rejectsSquare ? "rejects" : "does not reject"} O(N^2)`, () => {
      const result = complexityCandidates(n);
      expect(result.recommended).toBe(recommended);
      expect(result.rejected.includes("O(N^2)")).toBe(rejectsSquare);
      expect(result.reason.length).toBeGreaterThan(0);
      expect(result.caveat.length).toBeGreaterThan(0);
    });
  }

  test("the O(N^2) rejection appears exactly at n > 2.000 (per §7.1/§7.5), never below it", () => {
    expect(complexityCandidates(2000).rejected).toEqual([]);
    expect(complexityCandidates(2001).rejected).toEqual(["O(N^2)"]);
  });

  test("throws for n = 0", () => {
    expect(() => complexityCandidates(0)).toThrow();
  });

  test("throws for n = -1", () => {
    expect(() => complexityCandidates(-1)).toThrow();
  });

  test("throws for n = 1.5 (non-integer)", () => {
    expect(() => complexityCandidates(1.5)).toThrow();
  });
});

// --- selectShortestPath (§7.2) -----------------------------------------------

describe("selectShortestPath", () => {
  test("unweighted -> BFS", () => {
    const result = selectShortestPath({
      weighted: false,
      negativeEdges: false,
      allPairs: false,
      n: 10,
    });
    expect(result.recommended).toBe("BFS");
    expect(result.reason.length).toBeGreaterThan(0);
  });

  test("weighted, non-negative -> Dijkstra", () => {
    const result = selectShortestPath({
      weighted: true,
      negativeEdges: false,
      allPairs: false,
      n: 10,
    });
    expect(result.recommended).toBe("Dijkstra");
    expect(result.reason.length).toBeGreaterThan(0);
  });

  test("negative edges (single-source) -> Bellman-Ford, never Dijkstra", () => {
    const result = selectShortestPath({
      weighted: true,
      negativeEdges: true,
      allPairs: false,
      n: 10,
    });
    expect(result.recommended).toBe("Bellman-Ford");
    expect(result.recommended).not.toBe("Dijkstra");
    expect(result.alternatives).not.toContain("Dijkstra");
    expect(result.reason.length).toBeGreaterThan(0);
  });

  test("negative edges + allPairs false -> Bellman-Ford", () => {
    const result = selectShortestPath({
      weighted: true,
      negativeEdges: true,
      allPairs: false,
      n: 50,
    });
    expect(result.recommended).toBe("Bellman-Ford");
    expect(result.reason.length).toBeGreaterThan(0);
  });

  test("all-pairs with small N -> Floyd-Warshall", () => {
    const result = selectShortestPath({
      weighted: true,
      negativeEdges: false,
      allPairs: true,
      n: FLOYD_WARSHALL_MAX_N,
    });
    expect(result.recommended).toBe("Floyd-Warshall");
    expect(result.reason.length).toBeGreaterThan(0);
  });

  test("all-pairs with negative edges and small N -> Floyd-Warshall (beats Bellman-Ford)", () => {
    const result = selectShortestPath({
      weighted: true,
      negativeEdges: true,
      allPairs: true,
      n: 100,
    });
    expect(result.recommended).toBe("Floyd-Warshall");
    expect(result.recommended).not.toBe("Dijkstra");
    expect(result.reason.length).toBeGreaterThan(0);
  });

  test("all-pairs with negative edges but N too large for Floyd-Warshall -> Bellman-Ford", () => {
    const result = selectShortestPath({
      weighted: true,
      negativeEdges: true,
      allPairs: true,
      n: FLOYD_WARSHALL_MAX_N + 1,
    });
    expect(result.recommended).toBe("Bellman-Ford");
    expect(result.recommended).not.toBe("Dijkstra");
    expect(result.reason.length).toBeGreaterThan(0);
  });

  test("all-pairs, non-negative, N too large for Floyd-Warshall -> falls back to Dijkstra", () => {
    const result = selectShortestPath({
      weighted: true,
      negativeEdges: false,
      allPairs: true,
      n: FLOYD_WARSHALL_MAX_N + 1,
    });
    expect(result.recommended).toBe("Dijkstra");
    expect(result.reason.length).toBeGreaterThan(0);
  });

  test("throws for a non-positive-integer n", () => {
    expect(() =>
      selectShortestPath({ weighted: false, negativeEdges: false, allPairs: false, n: 0 }),
    ).toThrow();
  });
});

// --- selectRangeStructure (§7.3) ---------------------------------------------

describe("selectRangeStructure", () => {
  test("no updates + range sum -> Prefix Sum", () => {
    const result = selectRangeStructure({
      pointUpdate: false,
      rangeQuery: true,
      aggregation: "sum",
    });
    expect(result.recommended).toBe("PrefixSum");
    expect(result.reason.length).toBeGreaterThan(0);
  });

  test("point update + range sum -> Fenwick", () => {
    const result = selectRangeStructure({
      pointUpdate: true,
      rangeQuery: true,
      aggregation: "sum",
    });
    expect(result.recommended).toBe("Fenwick");
    expect(result.reason.length).toBeGreaterThan(0);
  });

  test("general aggregation -> Segment Tree, regardless of pointUpdate", () => {
    const withoutUpdate = selectRangeStructure({
      pointUpdate: false,
      rangeQuery: true,
      aggregation: "general",
    });
    const withUpdate = selectRangeStructure({
      pointUpdate: true,
      rangeQuery: true,
      aggregation: "general",
    });
    expect(withoutUpdate.recommended).toBe("SegmentTree");
    expect(withUpdate.recommended).toBe("SegmentTree");
    expect(withoutUpdate.reason.length).toBeGreaterThan(0);
    expect(withUpdate.reason.length).toBeGreaterThan(0);
  });
});

// --- dpDesignChecklist (§7.4) ------------------------------------------------

describe("dpDesignChecklist", () => {
  test("returns exactly 7 ordered items, 1..7 with no gaps or duplicates", () => {
    const { items } = dpDesignChecklist();
    expect(items).toHaveLength(7);
    expect(items.map((entry) => entry.order)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const entry of items) {
      expect(entry.item.length).toBeGreaterThan(0);
    }
  });

  test("carries the advisory caveat", () => {
    expect(dpDesignChecklist().caveat.length).toBeGreaterThan(0);
  });
});

// --- stressTestPlan (§7.6) ----------------------------------------------------

describe("stressTestPlan", () => {
  test("returns exactly the 4 steps, in order", () => {
    const { steps } = stressTestPlan();
    expect(steps).toHaveLength(4);
    expect(steps.map((entry) => entry.order)).toEqual([1, 2, 3, 4]);
    for (const entry of steps) {
      expect(entry.step.length).toBeGreaterThan(0);
    }
  });

  test("names DP, greedy, graph, and edge-case-prone data structures as especially applicable", () => {
    const { appliesTo } = stressTestPlan();
    expect(appliesTo).toContain("DP");
    expect(appliesTo).toContain("greedy");
    expect(appliesTo).toContain("graph");
    expect(appliesTo.some((entry) => entry.includes("edge case"))).toBe(true);
  });
});

// --- playbookSchema / playbooksFileSchema (inline fixtures) ------------------

describe("playbookSchema (inline fixtures, real data file untouched)", () => {
  const validPlaybook = {
    id: "constraint-to-complexity",
    title: "Constraint menjadi kompleksitas",
    sourceSection: "§7.1",
    summary: "N <= 200.000.",
    rules: ["N <= 200.000."],
    citations: [],
  };

  test("accepts a well-formed playbook", () => {
    expect(playbookSchema.safeParse(validPlaybook).success).toBe(true);
  });

  test("rejects an unknown id", () => {
    const result = playbookSchema.safeParse({ ...validPlaybook, id: "not-a-real-playbook" });
    expect(result.success).toBe(false);
  });

  test("rejects an empty rules array", () => {
    const result = playbookSchema.safeParse({ ...validPlaybook, rules: [] });
    expect(result.success).toBe(false);
  });

  test("rejects a rules array containing an empty string", () => {
    const result = playbookSchema.safeParse({ ...validPlaybook, rules: ["ok", ""] });
    expect(result.success).toBe(false);
  });

  test("rejects an out-of-range citation ref", () => {
    const result = playbookSchema.safeParse({ ...validPlaybook, citations: ["R42"] });
    expect(result.success).toBe(false);
  });

  test("rejects a malformed source section", () => {
    const result = playbookSchema.safeParse({ ...validPlaybook, sourceSection: "7.1" });
    expect(result.success).toBe(false);
  });

  test("rejects an unknown extra field (strict)", () => {
    const result = playbookSchema.safeParse({ ...validPlaybook, extra: "nope" });
    expect(result.success).toBe(false);
  });
});

describe("playbooksFileSchema (inline fixtures)", () => {
  const onePlaybook = {
    id: "constraint-to-complexity",
    title: "Constraint menjadi kompleksitas",
    sourceSection: "§7.1",
    summary: "N <= 200.000.",
    rules: ["N <= 200.000."],
    citations: [],
  };

  function fileWithIds(ids: readonly string[]) {
    return {
      syllabusVersion: "2.0",
      syllabusDate: "2026-09-04",
      sourceSection: "§7",
      playbooks: ids.map((id) => ({ ...onePlaybook, id })),
    };
  }

  test("accepts a file with exactly the seven expected ids", () => {
    expect(playbooksFileSchema.safeParse(fileWithIds(EXPECTED_IDS)).success).toBe(true);
  });

  test("rejects a file missing one of the seven ids", () => {
    const result = playbooksFileSchema.safeParse(fileWithIds(EXPECTED_IDS.slice(0, 6)));
    expect(result.success).toBe(false);
  });

  test("rejects a file with a duplicated id", () => {
    const ids = [...EXPECTED_IDS.slice(0, 6), "constraint-to-complexity"];
    const result = playbooksFileSchema.safeParse(fileWithIds(ids));
    expect(result.success).toBe(false);
  });

  test("rejects a file missing syllabusVersion", () => {
    const { syllabusVersion: _syllabusVersion, ...withoutVersion } = fileWithIds(EXPECTED_IDS);
    expect(playbooksFileSchema.safeParse(withoutVersion).success).toBe(false);
  });
});
