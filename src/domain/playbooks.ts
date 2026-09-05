/**
 * Executable decision helpers over the seven §7 decision playbooks
 * (`docs/silabus/07-contoh-implementasi.md`), plus the typed loader/lookup
 * helpers over `data/playbooks.json`.
 *
 * **These functions encode pedagogical guidance, not a solver, and they
 * are advisory only.** §7's playbooks convert a problem's constraints into
 * a first candidate decision (a complexity class, an algorithm, a data
 * structure) so a student has somewhere concrete to start reasoning from
 * -- they do not replace the student's own judgement, do not account for
 * every real-world wrinkle (adversarial test data, an unusual constant
 * factor, a judge's specific time limit), and **never guarantee a
 * submission will be accepted.** Every selector below returns its
 * recommendation alongside a non-empty `reason` (the applicability
 * condition the student must be able to state before coding, per §7.2)
 * and a `caveat` repeating this warning, precisely because the syllabus
 * requires students to justify applicability before coding rather than
 * pattern-match a table.
 *
 * Per the "Layering rules" in `docs/architecture/README.md`, this module
 * assumes the data it receives is valid once it has passed through
 * {@link parseDataFile}: it never re-implements validation logic of its
 * own. Loading happens once, at module load, and the result is memoised.
 */

// `resolveJsonModule` is enabled in tsconfig.json, so a static import is a
// deterministic, dependency-free way to bring the corpus file in — no
// filesystem read, no async loader, and Bun/tsc both resolve it at build
// time. The value is `unknown` as far as validity is concerned; it is
// still parsed through the schema below before anything trusts its shape.
import rawPlaybooks from "../../data/playbooks.json";
import { parseDataFile } from "../schema/common";
import { type Playbook, type PlaybooksFile, playbooksFileSchema } from "../schema/playbook";

const PLAYBOOKS_SOURCE_NAME = "data/playbooks.json";

/**
 * The validated contents of `data/playbooks.json`, parsed once at module
 * load. Throws {@link CorpusValidationError} if the file does not match
 * {@link playbooksFileSchema}.
 */
const playbooksFile: PlaybooksFile = parseDataFile(
  playbooksFileSchema,
  rawPlaybooks,
  PLAYBOOKS_SOURCE_NAME,
);

/** Every §7 decision playbook, in source (§7.1-§7.7) order. */
export function listPlaybooks(): readonly Playbook[] {
  return playbooksFile.playbooks;
}

/**
 * Looks up a §7 decision playbook by id, throwing a readable error naming
 * the unknown id and listing every valid id if none matches.
 */
export function getPlaybook(id: string): Playbook {
  const playbook = playbooksFile.playbooks.find((entry) => entry.id === id);
  if (playbook === undefined) {
    const validIds = playbooksFile.playbooks.map((entry) => entry.id).join(", ");
    throw new Error(`getPlaybook: unknown playbook id "${id}". Valid ids: ${validIds}.`);
  }
  return playbook;
}

/**
 * The standing advisory every selector's `caveat` repeats: these selectors
 * encode §7's pedagogical guidance, not a solver, and never guarantee a
 * submission will be accepted. See this module's docblock for the full
 * rationale.
 */
const ADVISORY_CAVEAT =
  "Advisory pedagogical guidance from §7 of the syllabus, not a solver: this recommendation does not guarantee acceptance by a judge. The student must still justify it before coding.";

/** Rejects non-integer or non-positive `n`, naming the offending function and value. */
function assertPositiveInteger(n: number, fnName: string): void {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`${fnName}: n must be a positive integer, got ${n}.`);
  }
}

// --- 1. complexityCandidates (§7.1 + §7.5) -----------------------------------

/**
 * The complexity classes {@link complexityCandidates} reasons about. Not
 * every class in the general complexity-theory sense -- only the ones §7.1
 * and §7.5 actually name.
 */
export type ComplexityClass = "O(N!)" | "O(2^N)" | "O(N^2)" | "O(N log N)" | "O(N)";

/** The full result of {@link complexityCandidates}. */
export interface ComplexityCandidatesResult {
  /** The tightest complexity class §7.1/§7.5 recommend for this `n`. */
  readonly recommended: ComplexityClass;
  /** Other complexity classes that remain viable at this `n`, tightest first. */
  readonly alternatives: readonly ComplexityClass[];
  /** Complexity classes explicitly rejected as a baseline at this `n` (see §7.1). */
  readonly rejected: readonly ComplexityClass[];
  /** Non-empty justification, citing §7.1/§7.5, for `recommended`. */
  readonly reason: string;
  /** The §7.1 reminder to then check time limit/constant factor/memory, plus the standing advisory. */
  readonly caveat: string;
}

/**
 * §7.1 + §7.5: converts an input-size bound `n` into feasible complexity
 * class candidates.
 *
 * The four bands, in order, are exactly §7.1's and §7.5's boundaries:
 * `n <= 20` (brute force/bitmask, per §7.5), `n <= 2.000` (O(N^2)
 * plausible, per §7.5), `n <= 200.000` (seek O(N log N)/O(N); §7.1's
 * central instruction is that O(N^2) must be REJECTED as a production
 * baseline for per-element operations here), and `n > 200.000` (O(N) or
 * O(N log N) required, same rejection carried forward).
 *
 * Per §7.1's own instruction, `caveat` always repeats the reminder to then
 * check the time limit, the constant factor, and memory -- narrowing to a
 * complexity class is the first step, not the last one.
 *
 * Throws if `n` is not a positive integer (`n < 1` or non-integer).
 */
export function complexityCandidates(n: number): ComplexityCandidatesResult {
  assertPositiveInteger(n, "complexityCandidates");

  const timeLimitReminder =
    "§7.1: after narrowing to a complexity candidate, still check the time limit, the constant factor, and memory before committing to it.";
  const caveat = `${timeLimitReminder} ${ADVISORY_CAVEAT}`;

  if (n <= 20) {
    return {
      recommended: "O(2^N)",
      alternatives: ["O(N!)", "O(N^2)", "O(N log N)", "O(N)"],
      rejected: [],
      reason: `§7.5: N = ${n} <= 20, so brute force/bitmask enumeration is viable -- O(2^N) in general, or O(N!) for very small N -- and every tighter complexity class is also safely within budget at this size.`,
      caveat,
    };
  }

  if (n <= 2000) {
    return {
      recommended: "O(N^2)",
      alternatives: ["O(N log N)", "O(N)"],
      rejected: [],
      reason: `§7.5: N = ${n} <= 2.000, so O(N^2) is a plausible baseline; O(N log N) or O(N) remain available as tighter alternatives if O(N^2) is still too slow.`,
      caveat,
    };
  }

  if (n <= 200000) {
    return {
      recommended: "O(N log N)",
      alternatives: ["O(N)"],
      rejected: ["O(N^2)"],
      reason: `§7.1/§7.5: N = ${n} <= 200.000, so O(N^2) must be explicitly REJECTED as a production baseline for per-element operations; seek an O(N log N) or O(N) candidate instead.`,
      caveat,
    };
  }

  return {
    recommended: "O(N)",
    alternatives: ["O(N log N)"],
    rejected: ["O(N^2)"],
    reason: `§7.1: N = ${n} is beyond §7.1/§7.5's explicit 200.000 bound, so an O(N) or O(N log N) candidate is required; O(N^2) remains rejected as a baseline.`,
    caveat,
  };
}

// --- 2. selectShortestPath (§7.2) --------------------------------------------

/** The shortest-path algorithms {@link selectShortestPath} chooses among. */
export type ShortestPathAlgorithm = "BFS" | "Dijkstra" | "Bellman-Ford" | "Floyd-Warshall";

/** The input {@link selectShortestPath} decides over. */
export interface SelectShortestPathParams {
  /** Whether edges carry (non-uniform) weights. `false` means unweighted or every edge the same weight. */
  readonly weighted: boolean;
  /** Whether at least one edge has a negative weight. */
  readonly negativeEdges: boolean;
  /** Whether shortest paths are needed between every pair of vertices, not just from one source. */
  readonly allPairs: boolean;
  /** The graph's vertex count, used only to judge whether all-pairs N is "small" per §7.2. */
  readonly n: number;
}

/** The full result of {@link selectShortestPath}. */
export interface ShortestPathSelection {
  readonly recommended: ShortestPathAlgorithm;
  readonly alternatives: readonly ShortestPathAlgorithm[];
  /** Non-empty applicability condition, stated per §7.2's requirement, before the student codes. */
  readonly reason: string;
  readonly caveat: string;
}

/**
 * The all-pairs vertex count under which Floyd-Warshall's O(N^3) stays
 * inside a typical competitive-programming time limit (500^3 = 1.25e8
 * elementary operations). §7.2 says only "N kecil" ("small N"); this is
 * the concrete threshold that operationalises it.
 */
export const FLOYD_WARSHALL_MAX_N = 500;

/**
 * §7.2: chooses a shortest-path algorithm from the graph's shape.
 *
 * **Precedence (highest to lowest) -- deliberately NOT the plain textual
 * order §7.2's sentence lists (BFS, Dijkstra, Bellman-Ford,
 * Floyd-Warshall):**
 *
 * 1. `allPairs && n <= {@link FLOYD_WARSHALL_MAX_N}` -> Floyd-Warshall.
 *    All-pairs-with-small-N wins over every single-source algorithm
 *    (BFS/Dijkstra/Bellman-Ford), even when edges are negative --
 *    Floyd-Warshall tolerates negative edge weights as long as there is
 *    no negative cycle, so it stays correct there too.
 * 2. `negativeEdges` -> Bellman-Ford. Checked before the weighted
 *    condition specifically so negative edges always beat Dijkstra:
 *    Dijkstra is unsound in the presence of a negative edge and must
 *    never be recommended when one is present.
 * 3. `weighted` (and, by this point, known non-negative) -> Dijkstra.
 * 4. Otherwise (unweighted, or every edge the same weight) -> BFS.
 *
 * This order is exactly the two conflicts §7.2's own text calls out:
 * "all-pairs with small N should win over the single-source choices" and
 * "negative edges must beat Dijkstra" -- both are unconditional (checked
 * before, not after, the branches they override), which is what makes the
 * ordering above a total, unambiguous precedence rather than four
 * independent conditions that could disagree.
 *
 * `reason` always states the applicability condition that justifies the
 * pick, per §7.2's "Siswa harus menjelaskan syarat berlaku sebelum
 * coding" ("the student must explain the applicable condition before
 * coding").
 *
 * Throws if `n` is not a positive integer.
 */
export function selectShortestPath(params: SelectShortestPathParams): ShortestPathSelection {
  const { weighted, negativeEdges, allPairs, n } = params;
  assertPositiveInteger(n, "selectShortestPath");

  if (allPairs && n <= FLOYD_WARSHALL_MAX_N) {
    return {
      recommended: "Floyd-Warshall",
      alternatives: negativeEdges ? [] : ["Dijkstra", "Bellman-Ford"],
      reason: `Applicability condition (state this before coding, per §7.2): all-pairs shortest paths are required and N = ${n} <= ${FLOYD_WARSHALL_MAX_N}, so §7.2's "all-pairs dan N kecil -> Floyd-Warshall" branch applies and takes precedence over every single-source algorithm, even with negative edges present -- Floyd-Warshall stays correct as long as there is no negative cycle.`,
      caveat: ADVISORY_CAVEAT,
    };
  }

  if (negativeEdges) {
    return {
      recommended: "Bellman-Ford",
      alternatives: [],
      reason: `Applicability condition (state this before coding, per §7.2): the graph carries at least one negative edge, so §7.2's "edge negatif -> Bellman-Ford" branch applies; Dijkstra is unsound with negative edges and must not be used here${
        allPairs
          ? `, and N = ${n} exceeds Floyd-Warshall's practical all-pairs bound of ${FLOYD_WARSHALL_MAX_N}.`
          : "."
      }`,
      caveat: ADVISORY_CAVEAT,
    };
  }

  if (weighted) {
    return {
      recommended: "Dijkstra",
      alternatives: ["Bellman-Ford"],
      reason:
        "Applicability condition (state this before coding, per §7.2): edges are weighted and " +
        'none is negative, so §7.2\'s "bobot non-negatif -> Dijkstra" branch applies.',
      caveat: ADVISORY_CAVEAT,
    };
  }

  return {
    recommended: "BFS",
    alternatives: [],
    reason:
      "Applicability condition (state this before coding, per §7.2): the graph is unweighted, " +
      'or every edge shares the same weight, so §7.2\'s "unweighted/sama bobot -> BFS" branch applies.',
    caveat: ADVISORY_CAVEAT,
  };
}

// --- 3. selectRangeStructure (§7.3) ------------------------------------------

/** The range-query structures {@link selectRangeStructure} chooses among. */
export type RangeStructure = "PrefixSum" | "Fenwick" | "SegmentTree";

/**
 * Whether the required aggregation is a plain range sum (where prefix sum
 * and Fenwick both apply) or something more general -- min/max/gcd/any
 * other associative combine -- where only a Segment Tree's flexible
 * combine function applies, per §7.3.
 */
export type RangeAggregationKind = "sum" | "general";

/** The input {@link selectRangeStructure} decides over. */
export interface SelectRangeStructureParams {
  /** Whether individual elements are updated after the structure is built. */
  readonly pointUpdate: boolean;
  /** Whether the workload queries a range (rather than a single point). */
  readonly rangeQuery: boolean;
  readonly aggregation: RangeAggregationKind;
}

/** The full result of {@link selectRangeStructure}. */
export interface RangeStructureSelection {
  readonly recommended: RangeStructure;
  readonly alternatives: readonly RangeStructure[];
  readonly reason: string;
  readonly caveat: string;
}

/**
 * §7.3: chooses a range-query structure from the operations mix.
 *
 * - General aggregation (not a plain sum) -> Segment Tree: it is the only
 *   one of the three whose combine function is not fixed to `+`.
 * - Range sum, no point updates -> Prefix Sum: O(1) query, but an O(N)
 *   rebuild on every update, so it only wins when updates never happen.
 * - Range sum with point updates -> Fenwick: O(log N) update/query beats
 *   prefix sum's expensive updates, and is simpler to implement correctly
 *   than a Segment Tree for this specific (sum, point-update) shape.
 *
 * `reason` always states the applicability condition (per the same "state
 * it before coding" spirit as §7.2) and echoes back the operations-matrix
 * inputs (`pointUpdate`/`rangeQuery`/`aggregation`) plus the §7.3
 * trade-off rationale and its instruction to build an operations matrix
 * before choosing.
 */
export function selectRangeStructure(params: SelectRangeStructureParams): RangeStructureSelection {
  const { pointUpdate, rangeQuery, aggregation } = params;

  const inputsNote = `(pointUpdate=${pointUpdate}, rangeQuery=${rangeQuery}, aggregation="${aggregation}")`;
  const tradeoff =
    "§7.3 trade-off: prefix sum has cheap O(1) queries but an expensive O(N) rebuild on every " +
    "update; Fenwick gives O(log N) update/query for sum-shaped aggregation; Segment Tree is more " +
    "flexible for general aggregation at the same O(log N) update/query cost. Build an operations " +
    "matrix (which operations occur, how often) before choosing, per §7.3.";

  if (aggregation === "general") {
    return {
      recommended: "SegmentTree",
      alternatives: [],
      reason: `Applicability condition (state this before coding, per §7.3): the required aggregation is more general than a plain range sum ${inputsNote}, so only Segment Tree's flexible combine function applies. ${tradeoff}`,
      caveat: ADVISORY_CAVEAT,
    };
  }

  if (!pointUpdate) {
    return {
      recommended: "PrefixSum",
      alternatives: ["Fenwick", "SegmentTree"],
      reason: `Applicability condition (state this before coding, per §7.3): the aggregation is a range sum with no point updates ${inputsNote}, so prefix sum's cheap O(1) queries outweigh its expensive-but-never-triggered update cost. ${tradeoff}`,
      caveat: ADVISORY_CAVEAT,
    };
  }

  return {
    recommended: "Fenwick",
    alternatives: ["SegmentTree"],
    reason: `Applicability condition (state this before coding, per §7.3): the aggregation is a range sum with point updates ${inputsNote}, so Fenwick's O(log N) update/query beats prefix sum's expensive updates while staying simpler than a full Segment Tree. ${tradeoff}`,
    caveat: ADVISORY_CAVEAT,
  };
}

// --- 4. dpDesignChecklist (§7.4) ---------------------------------------------

/** One ordered item of {@link dpDesignChecklist}. */
export interface DpChecklistItem {
  /** This item's 1-7 position in §7.4's design order. */
  readonly order: number;
  /** This checklist item's name, verbatim (Indonesian) from §7.4. */
  readonly item: string;
}

/** The full result of {@link dpDesignChecklist}. */
export interface DpDesignChecklistResult {
  /** The seven §7.4 design items, in order (state, transition, ..., compression). */
  readonly items: readonly DpChecklistItem[];
  readonly caveat: string;
}

/**
 * §7.4's seven checklist items, verbatim (Indonesian), in the exact order
 * the subsection lists them: "definisikan state minimum, transition, base
 * case, dependency/order, jumlah state x transition, reconstruction, dan
 * kemungkinan compression."
 */
const DP_CHECKLIST_ITEMS: readonly string[] = [
  "state minimum",
  "transition",
  "base case",
  "dependency/order",
  "jumlah state x transition",
  "reconstruction",
  "kemungkinan compression",
];

/**
 * §7.4: the seven-item DP design checklist a student must complete BEFORE
 * writing code, as ordered structured items (not one blob of text) so
 * each item can be checked off individually.
 *
 * §7.4 also notes Knapsack/LCS/LIS are treated as worked examples of this
 * state-design process -- that note is carried in `caveat`, not as an
 * eighth checklist item, since it is guidance about the checklist rather
 * than a design step itself.
 */
export function dpDesignChecklist(): DpDesignChecklistResult {
  return {
    items: DP_CHECKLIST_ITEMS.map((item, index) => ({ order: index + 1, item })),
    caveat: `§7.4: complete all seven items, in order, before writing code. Knapsack/LCS/LIS are §7.4's worked examples of this state-design process, not a substitute for working through it. ${ADVISORY_CAVEAT}`,
  };
}

// --- 5. stressTestPlan (§7.6) -------------------------------------------------

/** One ordered step of {@link stressTestPlan}. */
export interface StressTestStep {
  /** This step's 1-4 position in §7.6's plan. */
  readonly order: number;
  /** This step's instruction, verbatim (Indonesian) from §7.6. */
  readonly step: string;
}

/** The full result of {@link stressTestPlan}. */
export interface StressTestPlanResult {
  /** The four §7.6 steps, in order. */
  readonly steps: readonly StressTestStep[];
  /** The problem categories §7.6 names as especially prone to needing this. */
  readonly appliesTo: readonly string[];
  readonly caveat: string;
}

/** §7.6's four stress-test steps, verbatim (Indonesian), in order. */
const STRESS_TEST_STEPS: readonly string[] = [
  "Buat brute-force oracle untuk N kecil",
  "Buat random generator",
  "Bandingkan solusi cepat vs oracle",
  "Simpan counterexample minimal ketika berbeda",
];

/** §7.6's "Terapkan khususnya pada" list, verbatim (Indonesian) category names. */
const STRESS_TEST_APPLIES_TO: readonly string[] = [
  "DP",
  "greedy",
  "graph",
  "data structure yang rawan edge case",
];

/**
 * §7.6: the four-step stress-test plan (brute-force oracle for small N, a
 * random generator, comparing the fast solution against the oracle, and
 * retaining the minimal counterexample on a mismatch), plus the §7.6 note
 * that this applies especially to DP, greedy, graph, and edge-case-prone
 * data structure solutions.
 */
export function stressTestPlan(): StressTestPlanResult {
  return {
    steps: STRESS_TEST_STEPS.map((step, index) => ({ order: index + 1, step })),
    appliesTo: STRESS_TEST_APPLIES_TO,
    caveat: `§7.6: apply this especially to DP, greedy, graph, and edge-case-prone data structure solutions. ${ADVISORY_CAVEAT}`,
  };
}
