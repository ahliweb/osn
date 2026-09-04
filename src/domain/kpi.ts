/**
 * Pure computation of the seven §6.3 mentor KPI metrics
 * (`docs/silabus/06-evaluasi-rubrik-kpi.md`) over a batch of
 * {@link LearningRecord}s (issue #15's output), plus the typed loader/
 * lookup helpers over `data/kpi-definitions.json`.
 *
 * **Everything in this module is a pure function over `readonly
 * LearningRecord[]`.** There is no I/O, no formatting, and no rendering
 * here -- turning a computed result into mentor-facing text/HTML/tables is
 * issue #22's job, not this module's. Per the "Layering rules" in
 * `docs/architecture/README.md`, this module assumes the records it
 * receives already passed through `learningRecordSchema`
 * (`src/domain/learning-record.ts`'s `parseLearningRecord`/
 * `parseLearningRecords`): it never re-implements that validation.
 *
 * ## The "no NaN/Infinity, ever" contract
 *
 * Per §14.2 rule 7 ("Jumlah soal bukan satu-satunya KPI; mastery dan
 * transfer lebih penting.") and this module's acceptance criteria, **no
 * function here may ever return `NaN` or `Infinity`**, and an empty (or
 * otherwise insufficient) input must produce an explicit, typed
 * "insufficient data" result rather than a bogus number from a 0/0
 * division. {@link KpiResult} is the shared shape that makes this
 * unrepresentable: every computation function returns either
 * `{ kind: "value", value: T }` or `{ kind: "insufficient-data", reason }`,
 * never a bare number. Every division in this file is guarded by a
 * denominator check before it runs, and every "insufficient data" branch
 * carries a non-empty, specific `reason` string.
 */

import { type KpiDefinition, kpiDefinitionsFileSchema } from "../schema/kpi";
import { parseDataFile } from "../schema/common";
import type { LearningRecord } from "../schema/learning-record";

// `resolveJsonModule` is enabled in tsconfig.json, so a static import is a
// deterministic, dependency-free way to bring the corpus file in — no
// filesystem read, no async loader, and Bun/tsc both resolve it at build
// time. The value is `unknown` as far as validity is concerned; it is
// still parsed through the schema below before anything trusts its shape.
import rawKpiDefinitions from "../../data/kpi-definitions.json";

const KPI_DEFINITIONS_SOURCE_NAME = "data/kpi-definitions.json";

/**
 * The validated contents of `data/kpi-definitions.json`, parsed once at
 * module load. Throws {@link CorpusValidationError} if the file does not
 * match {@link kpiDefinitionsFileSchema}.
 */
const kpiDefinitionsFile = parseDataFile(
  kpiDefinitionsFileSchema,
  rawKpiDefinitions,
  KPI_DEFINITIONS_SOURCE_NAME,
);

/** Every §6.3 KPI metric definition, in source (table) order. */
export function listKpiDefinitions(): readonly KpiDefinition[] {
  return kpiDefinitionsFile.metrics;
}

/**
 * Looks up a §6.3 KPI metric definition by id, throwing a readable error
 * naming the unknown id and listing every valid id if none matches.
 */
export function getKpiDefinition(id: string): KpiDefinition {
  const definition = kpiDefinitionsFile.metrics.find((metric) => metric.id === id);
  if (definition === undefined) {
    const validIds = kpiDefinitionsFile.metrics.map((metric) => metric.id).join(", ");
    throw new Error(`getKpiDefinition: unknown KPI metric id "${id}". Valid ids: ${validIds}.`);
  }
  return definition;
}

/**
 * The §14.2 rule 7 caveat, verbatim (Indonesian): every metric this module
 * computes must be read alongside it -- problem count alone is never the
 * KPI.
 */
export function kpiCaveat(): string {
  return kpiDefinitionsFile.caveat;
}

// --- shared result shape ---------------------------------------------------

/**
 * A metric computed over a non-empty (or otherwise sufficient) input.
 * `T` is the metric-specific payload shape.
 */
export interface KpiValueResult<T> {
  readonly kind: "value";
  readonly value: T;
}

/**
 * A metric that could not be computed because the input did not contain
 * enough of the right kind of record. `reason` is always a non-empty,
 * specific explanation (e.g. "no AC records in the input"), never a
 * generic placeholder.
 */
export interface KpiInsufficientDataResult {
  readonly kind: "insufficient-data";
  readonly reason: string;
}

/**
 * The shared discriminated-union result shape every metric in this module
 * returns. Deliberately makes "not enough data" a distinct, explicit case
 * rather than a number that might be `NaN`/`Infinity` -- see this module's
 * docblock, "The 'no NaN/Infinity, ever' contract".
 */
export type KpiResult<T> = KpiValueResult<T> | KpiInsufficientDataResult;

function value<T>(payload: T): KpiValueResult<T> {
  return { kind: "value", value: payload };
}

function insufficientData(reason: string): KpiInsufficientDataResult {
  return { kind: "insufficient-data", reason };
}

// --- shared numeric helpers --------------------------------------------------

/**
 * The arithmetic mean of `values`. Caller must guarantee `values` is
 * non-empty (every call site below is guarded by an
 * {@link insufficientData} check first), so this never divides by zero.
 */
function mean(values: readonly number[]): number {
  const total = values.reduce((sum, entry) => sum + entry, 0);
  return total / values.length;
}

/**
 * The median of `values` (ascending-sorted internally; the input array is
 * never mutated). Caller must guarantee `values` is non-empty. Even-length
 * inputs average the two middle values.
 */
function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mid = Math.floor(n / 2);

  if (n % 2 === 1) {
    const middle = sorted[mid];
    if (middle === undefined) {
      throw new Error("median: unreachable -- index within bounds of a non-empty array");
    }
    return middle;
  }

  const lower = sorted[mid - 1];
  const upper = sorted[mid];
  if (lower === undefined || upper === undefined) {
    throw new Error("median: unreachable -- indices within bounds of a non-empty array");
  }
  return (lower + upper) / 2;
}

/** A share (`numerator / denominator`) guarded against division by zero; returns 0 when `denominator` is 0. */
function safeShare(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

// --- 1. status-distribution --------------------------------------------------

/** Per-topic-family counts, one entry per §6.2 status code. */
export interface StatusCounts {
  readonly A: number;
  readonly B: number;
  readonly C: number;
  readonly D: number;
}

/**
 * One topic family's (or the `"unresolved"` bucket's) A/B/C/D breakdown:
 * raw counts and each count's share of that bucket's own total (so shares
 * always sum to 1 for a bucket with `total > 0`).
 */
export interface TopicStatusDistribution {
  /** A topic family id, or the literal `"unresolved"` for records `resolveTopic` could not map. */
  readonly topic: string;
  readonly total: number;
  readonly counts: StatusCounts;
  readonly shares: StatusCounts;
}

/** The full result of {@link statusDistributionByTopic}. */
export interface StatusDistributionResult {
  /** One entry per topic family seen, plus `"unresolved"` if any record's topic could not be resolved. Source order is insertion order (first record seen for that bucket). */
  readonly topics: readonly TopicStatusDistribution[];
  readonly totalRecords: number;
}

const UNRESOLVED_TOPIC_BUCKET = "unresolved";

/**
 * §6.3 "A/B/C/D per topic": per-topic-family A/B/C/D counts and shares.
 *
 * A `LearningRecord` carries a `problemId` but no topic family of its own
 * (that mapping lives in a problem bank, out of this schema's scope), so
 * this function accepts `resolveTopic`, a caller-supplied
 * `problemId -> topic family id | undefined` function, rather than
 * inventing a problem-to-topic table here. Records whose topic cannot be
 * resolved (`resolveTopic` returns `undefined`) are counted into an
 * explicit `"unresolved"` bucket, never silently dropped -- so
 * `sum(topics[*].total) === records.length` always holds.
 *
 * Insufficient data (empty `topics`, reason set) only when `records` is
 * empty; a single record, or a run of records that are all the same
 * status/topic, both produce a normal one-bucket result.
 */
export function statusDistributionByTopic(
  records: readonly LearningRecord[],
  resolveTopic: (problemId: string) => string | undefined,
): KpiResult<StatusDistributionResult> {
  if (records.length === 0) {
    return insufficientData("no learning records provided");
  }

  const order: string[] = [];
  const counts = new Map<string, { A: number; B: number; C: number; D: number }>();

  for (const record of records) {
    const topic = resolveTopic(record.problemId) ?? UNRESOLVED_TOPIC_BUCKET;
    let bucket = counts.get(topic);
    if (bucket === undefined) {
      bucket = { A: 0, B: 0, C: 0, D: 0 };
      counts.set(topic, bucket);
      order.push(topic);
    }
    bucket[record.status] += 1;
  }

  const topics: TopicStatusDistribution[] = order.map((topic) => {
    const bucket = counts.get(topic);
    if (bucket === undefined) {
      throw new Error(
        "statusDistributionByTopic: unreachable -- bucket created for every order entry",
      );
    }
    const total = bucket.A + bucket.B + bucket.C + bucket.D;
    return {
      topic,
      total,
      counts: { ...bucket },
      shares: {
        A: safeShare(bucket.A, total),
        B: safeShare(bucket.B, total),
        C: safeShare(bucket.C, total),
        D: safeShare(bucket.D, total),
      },
    };
  });

  return value({ topics, totalRecords: records.length });
}

// --- 2. time-to-first-correct -------------------------------------------------

/** The full result of {@link timeToFirstCorrect}. */
export interface TimeToFirstCorrectResult {
  /** Number of distinct (learnerRef, problemId) pairs with at least one AC record. */
  readonly sampleSize: number;
  readonly medianSeconds: number;
  readonly meanSeconds: number;
}

/**
 * §6.3 "Time-to-first-correct": how long a learner takes to first solve a
 * problem.
 *
 * Operational definition (DERIVED -- §6.3 names the metric and its intent,
 * "Mengukur kecepatan modeling dan implementasi", but not a formula):
 * records are grouped by the pair (`learnerRef`, `problemId`) -- not by
 * `problemId` alone, since a cohort dataset holds many learners' attempts
 * at the same problem, and conflating them would average away exactly the
 * per-learner speed signal §6.3's stated purpose asks for. Within each
 * group, the AC record with the lowest `attemptNo` is that learner's first
 * accepted attempt at that problem (a learner can have more than one AC,
 * e.g. an original solve and a later re-solve; only the first counts
 * here). That record's `durationSeconds` is the group's sample. Median and
 * mean are computed over all such per-(learner, problem) samples.
 *
 * Insufficient data when there is no AC record anywhere in the input
 * (including the empty-input case).
 */
export function timeToFirstCorrect(
  records: readonly LearningRecord[],
): KpiResult<TimeToFirstCorrectResult> {
  const groups = new Map<string, LearningRecord[]>();
  for (const record of records) {
    const key = `${record.learnerRef}::${record.problemId}`;
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, [record]);
    } else {
      group.push(record);
    }
  }

  const firstCorrectDurations: number[] = [];
  for (const group of groups.values()) {
    const acRecords = group.filter((record) => record.verdict === "AC");
    if (acRecords.length === 0) {
      continue;
    }
    const first = acRecords.reduce((earliest, candidate) =>
      candidate.attemptNo < earliest.attemptNo ? candidate : earliest,
    );
    firstCorrectDurations.push(first.durationSeconds);
  }

  if (firstCorrectDurations.length === 0) {
    return insufficientData("no AC (accepted) records in the input");
  }

  return value({
    sampleSize: firstCorrectDurations.length,
    medianSeconds: median(firstCorrectDurations),
    meanSeconds: mean(firstCorrectDurations),
  });
}

// --- 3. verdict-frequency ----------------------------------------------------

/** Counts/shares for the three §6.3-named technical-failure verdicts. */
export interface VerdictCounts {
  readonly WA: number;
  readonly TLE: number;
  readonly RE: number;
}

/** The full result of {@link verdictFrequency}. */
export interface VerdictFrequencyResult {
  readonly totalAttempts: number;
  readonly counts: VerdictCounts;
  /** Each verdict's count as a share of `totalAttempts` (all attempts, not just WA/TLE/RE). */
  readonly shares: VerdictCounts;
}

/**
 * §6.3 "WA/TLE/RE frequency": counts and shares for the WA, TLE and RE
 * verdicts specifically (the metric names those three, not the full
 * {@link VERDICTS} set), against a total-attempts denominator.
 *
 * Insufficient data only when `records` is empty.
 */
export function verdictFrequency(
  records: readonly LearningRecord[],
): KpiResult<VerdictFrequencyResult> {
  if (records.length === 0) {
    return insufficientData("no learning records provided");
  }

  let wa = 0;
  let tle = 0;
  let re = 0;
  for (const record of records) {
    if (record.verdict === "WA") wa += 1;
    else if (record.verdict === "TLE") tle += 1;
    else if (record.verdict === "RE") re += 1;
  }

  const totalAttempts = records.length;
  return value({
    totalAttempts,
    counts: { WA: wa, TLE: tle, RE: re },
    shares: {
      WA: safeShare(wa, totalAttempts),
      TLE: safeShare(tle, totalAttempts),
      RE: safeShare(re, totalAttempts),
    },
  });
}

// --- 4. upsolve-completion ----------------------------------------------------

/** The full result of {@link upsolveCompletionRate}. */
export interface UpsolveCompletionResult {
  /** Records whose `resolveStatus` is `scheduled`, `completed`, or `overdue` -- i.e. required a re-solve. */
  readonly requiredCount: number;
  /** The subset of `requiredCount` whose `resolveStatus` is `completed`. */
  readonly completedCount: number;
  readonly completionRate: number;
}

const RESOLVE_REQUIRED_STATUSES = new Set(["scheduled", "completed", "overdue"]);

/**
 * §6.3 "Upsolve completion": of the records that required a re-solve
 * (`resolveStatus` of `scheduled`, `completed`, or `overdue` -- i.e.
 * anything other than `not-required`), the share that reached `completed`.
 *
 * Insufficient data when nothing in the input required a re-solve
 * (including the empty-input case).
 */
export function upsolveCompletionRate(
  records: readonly LearningRecord[],
): KpiResult<UpsolveCompletionResult> {
  const required = records.filter((record) => RESOLVE_REQUIRED_STATUSES.has(record.resolveStatus));
  if (required.length === 0) {
    return insufficientData(
      "no records required a re-solve (resolveStatus was always not-required, or the input was empty)",
    );
  }

  const completed = required.filter((record) => record.resolveStatus === "completed").length;
  return value({
    requiredCount: required.length,
    completedCount: completed,
    completionRate: safeShare(completed, required.length),
  });
}

// --- 5. repeat-solve-retention -------------------------------------------------

/** The full result of {@link repeatSolveRetention}. */
export interface RepeatSolveRetentionResult {
  /** Records representing a completed re-solve (`resolveStatus === "completed"`). */
  readonly resolvedCount: number;
  /** The subset of `resolvedCount` that met the retention criteria (see docblock). */
  readonly retainedCount: number;
  readonly retentionRate: number;
}

/**
 * §6.3 "Repeat-solve retention": "memastikan solusi tidak hanya dihafal
 * dari editorial" (ensure a solution was not merely memorised from the
 * editorial).
 *
 * §6.3 states only this intent, not a formula -- this is a DERIVED
 * operational definition. A record with `resolveStatus === "completed"`
 * is, by this schema's field semantics, the record *of* a completed
 * re-solve attempt (the "later attempt" the metric name refers to). Among
 * those records, "retained" means the later attempt was solved cleanly:
 * `hintLevelUsed === null && usedEditorial === false && verdict === "AC"`
 * -- no hint, no editorial, and actually accepted. A completed re-solve
 * that still needed a hint/editorial, or that still failed, counts as not
 * retained: it suggests the original solve leaned on the editorial rather
 * than on internalised understanding.
 *
 * Insufficient data when there are no completed-re-solve records in the
 * input (including the empty-input case).
 */
export function repeatSolveRetention(
  records: readonly LearningRecord[],
): KpiResult<RepeatSolveRetentionResult> {
  const resolved = records.filter((record) => record.resolveStatus === "completed");
  if (resolved.length === 0) {
    return insufficientData(
      'no completed re-solve records (resolveStatus === "completed") in the input',
    );
  }

  const retained = resolved.filter(
    (record) =>
      record.hintLevelUsed === null && record.usedEditorial === false && record.verdict === "AC",
  ).length;

  return value({
    resolvedCount: resolved.length,
    retainedCount: retained,
    retentionRate: safeShare(retained, resolved.length),
  });
}

// --- 6. complexity-selection-accuracy ------------------------------------------

/** The full result of {@link complexitySelectionAccuracy}. */
export interface ComplexitySelectionAccuracyResult {
  readonly totalAttempts: number;
  readonly tleCount: number;
  readonly nonTleCount: number;
  readonly accuracy: number;
}

/**
 * §6.3 "Complexity-selection accuracy": "mengukur kemampuan membaca
 * constraint" (measure the ability to read constraints).
 *
 * **This is a PROXY, not a direct measurement.** A `LearningRecord` has no
 * explicit "predicted complexity" field to compare against a problem's
 * required complexity, so this function uses the observable TLE verdict as
 * a stand-in for a wrong complexity choice: `accuracy` is the share of
 * attempts whose verdict was NOT `TLE`. This conflates complexity
 * misjudgement with every other way an attempt can avoid timing out (or,
 * conversely, treats a TLE caused by e.g. a language/constant-factor issue
 * as if it were a complexity error) -- it is directionally useful but not
 * precise. A platform that captures an explicit predicted-complexity field
 * on its attempts should compute this metric directly from that field
 * (predicted vs. required complexity) and override this proxy rather than
 * relying on it.
 *
 * Insufficient data only when `records` is empty.
 */
export function complexitySelectionAccuracy(
  records: readonly LearningRecord[],
): KpiResult<ComplexitySelectionAccuracyResult> {
  if (records.length === 0) {
    return insufficientData("no learning records provided");
  }

  const tleCount = records.filter((record) => record.verdict === "TLE").length;
  const nonTleCount = records.length - tleCount;

  return value({
    totalAttempts: records.length,
    tleCount,
    nonTleCount,
    accuracy: safeShare(nonTleCount, records.length),
  });
}

// --- 7. contest-time-allocation ------------------------------------------------

/** The full result of {@link contestTimeAllocation}. */
export interface ContestTimeAllocationResult {
  readonly attemptCount: number;
  readonly totalSeconds: number;
  readonly meanSeconds: number;
  readonly medianSeconds: number;
  readonly maxSeconds: number;
  /** Share of `totalSeconds` spent on attempts with status `D` (unsolved). 0 when `totalSeconds` is 0. */
  readonly unsolvedTimeShare: number;
}

/**
 * §6.3 "Contest time allocation": "menilai strategi pemilihan soal dan
 * keputusan berhenti/pindah" (assess problem-selection strategy and
 * stop/switch decisions).
 *
 * Reports the distribution of `durationSeconds` across every attempt
 * (total, mean, median, max) plus the share of that total time spent on
 * attempts that ended unsolved (status `D`) -- a high share suggests time
 * sunk into problems that were ultimately abandoned or blocked, the
 * stop/switch signal §6.3 names.
 *
 * Insufficient data only when `records` is empty. All-zero durations are
 * handled explicitly: `unsolvedTimeShare` is 0 (not `NaN`) when
 * `totalSeconds` is 0, since {@link safeShare} guards that division.
 */
export function contestTimeAllocation(
  records: readonly LearningRecord[],
): KpiResult<ContestTimeAllocationResult> {
  if (records.length === 0) {
    return insufficientData("no learning records provided");
  }

  const durations = records.map((record) => record.durationSeconds);
  const totalSeconds = durations.reduce((sum, entry) => sum + entry, 0);
  const unsolvedSeconds = records
    .filter((record) => record.status === "D")
    .reduce((sum, record) => sum + record.durationSeconds, 0);

  return value({
    attemptCount: records.length,
    totalSeconds,
    meanSeconds: mean(durations),
    medianSeconds: median(durations),
    maxSeconds: Math.max(...durations),
    unsolvedTimeShare: safeShare(unsolvedSeconds, totalSeconds),
  });
}
