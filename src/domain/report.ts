/**
 * `buildKpiReport` -- the pure reporting logic behind `osn report` (issue
 * #22): assembles the seven §6.3 mentor KPI metrics
 * (`src/domain/kpi.ts`), a §13.1 step-4 postmortem error-taxonomy
 * breakdown, and a §13.1 step-5 scheduled-re-solves listing
 * (`src/domain/assessment.ts`'s `resolveSchedule`) into one report over a
 * batch of already-validated {@link LearningRecord}s.
 *
 * **Pure**: no file I/O, no `process` access, no "current time" reads (the
 * scheduled-re-solves section reports each B/C record's due *window*,
 * derived only from that record's own `recordedAt`, never compared
 * against "now" -- see {@link buildScheduledResolves}'s docblock for why).
 * Reading a `--records` file, running the privacy gate, and formatting the
 * result as Markdown/JSON are all issue #22's CLI-layer concerns
 * (`src/cli/commands/report.ts`, `src/cli/format-report.ts`), per the
 * "Layering rules" in `docs/architecture/README.md`. This module assumes
 * every record it receives already passed through `learningRecordSchema`
 * (`src/domain/learning-record.ts`'s `parseLearningRecord`/
 * `parseLearningRecords`): it never re-implements that validation, and it
 * never re-implements the privacy gate either (that is `findDirectIdentifiers`'s
 * job, run by the CLI layer before this module is ever called).
 *
 * ## Grouping: why `resolveTopic`/`resolveWeek` are required, not optional-with-fallback
 *
 * A {@link LearningRecord} carries a `problemId` and a `recordedAt`
 * timestamp, but no topic-family id and no week number of its own (see
 * `src/domain/kpi.ts`'s `statusDistributionByTopic` docblock for the same
 * point about topic). Grouping the *whole report* by topic or week
 * therefore needs a caller-supplied resolver function -- there is no
 * default mapping this module could invent that would not silently lie
 * about which topic/week a record belongs to. Per this module's
 * acceptance criteria, requesting `groupBy: "topic"` or `groupBy: "week"`
 * without the matching resolver is a **usage error**, reported by throwing
 * {@link ReportRequestError} with an actionable message -- this module
 * never silently falls back to an ungrouped report when grouping was
 * explicitly requested.
 *
 * This is independent of `statusDistributionByTopic` (§6.3 metric 1,
 * "A/B/C/D per topic"), which is inherently topic-shaped regardless of
 * `groupBy` -- computing it needs *some* `resolveTopic`, or every record
 * falls into `kpi.ts`'s own `"unresolved"` bucket. So `resolveTopic` here
 * does double duty: if given, it both (a) is used to compute that one
 * metric accurately in every section of the report (`overall` and, when
 * `groupBy: "topic"`, every per-topic section too), and (b) partitions
 * records into per-topic sections when `groupBy: "topic"` is requested.
 * If omitted, (a) degrades gracefully (every record lands in
 * `"unresolved"` -- still a valid, non-crashing `KpiResult`, per
 * `kpi.ts`'s own designed fallback), but (b) is a hard requirement: with
 * `groupBy: "topic"` there is no case where an omitted resolver is
 * tolerated.
 *
 * ## Empty input
 *
 * An empty (or otherwise insufficient) `records` array must never crash
 * this module. Every `src/domain/kpi.ts` function already returns an
 * explicit `{ kind: "insufficient-data", reason }` for an empty input (see
 * that module's "no NaN/Infinity, ever" contract), so `computeMetrics`
 * below inherits that guarantee automatically; {@link buildPostmortem} and
 * {@link buildScheduledResolves} apply the same discipline for the two
 * sections this module adds on top.
 */

import { ERROR_TAXONOMY_CLASSES, type LearningRecord } from "../schema/learning-record";
import {
  type ReimplementAndResolveSchedule,
  resolveSchedule,
  type ScheduledResolveSchedule,
} from "./assessment";
import {
  type ComplexitySelectionAccuracyResult,
  type ContestTimeAllocationResult,
  complexitySelectionAccuracy,
  contestTimeAllocation,
  type KpiResult,
  type RepeatSolveRetentionResult,
  repeatSolveRetention,
  type StatusDistributionResult,
  statusDistributionByTopic,
  type TimeToFirstCorrectResult,
  timeToFirstCorrect,
  type UpsolveCompletionResult,
  upsolveCompletionRate,
  type VerdictFrequencyResult,
  verdictFrequency,
} from "./kpi";

/**
 * The literal union of §13.1 step-4 postmortem error classes. Not exported
 * by `src/schema/learning-record.ts` itself (only {@link ERROR_TAXONOMY_CLASSES},
 * the runtime array, and its Zod schema are); derived locally here rather
 * than modifying that schema module, which is out of scope for issue #22.
 */
type ErrorTaxonomyClass = (typeof ERROR_TAXONOMY_CLASSES)[number];

/**
 * Thrown by {@link buildKpiReport} for a usage error it can detect before
 * doing any computation -- today, exclusively "grouping requested without
 * the resolver it needs" (see this module's docblock). Mirrors
 * `RenderRequestError` (`src/render/errors.ts`): always carries an
 * actionable message, so `src/cli/commands/report.ts` can catch this one
 * class and report a clean usage error instead of a raw stack trace.
 */
export class ReportRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportRequestError";
  }
}

// --- shared result shape re-exports (so callers need only import from here) -

export type { KpiResult } from "./kpi";

// --- resolvers --------------------------------------------------------------

/**
 * Maps a `problemId` to a topic-family id, or `undefined` if unknown.
 * Same shape as `statusDistributionByTopic`'s own `resolveTopic` parameter
 * (`src/domain/kpi.ts`) -- this repository ships no problemId->topic
 * registry of its own (see that module's docblock), so a real resolver is
 * always caller-supplied.
 */
export type TopicResolver = (problemId: string) => string | undefined;

/**
 * Maps a whole {@link LearningRecord} to a §4 week number (1-28), or
 * `undefined` if unknown. Takes the whole record (not just `recordedAt`)
 * so a caller can resolve week number however it needs to (typically:
 * comparing `recordedAt` against a cohort's `buildCohortPlan` output,
 * `src/domain/cohort-plan.ts` -- something this module deliberately does
 * not do itself, since that requires a cohort start date/exclusion list
 * this module has no way to receive).
 */
export type WeekResolver = (record: LearningRecord) => number | undefined;

const UNRESOLVED_GROUP_LABEL = "unresolved";

/** A `resolveTopic` that resolves nothing -- every record lands in `kpi.ts`'s own `"unresolved"` bucket. Used when the caller omits `resolveTopic` and `groupBy` is not `"topic"` (see this module's docblock). */
const NULL_TOPIC_RESOLVER: TopicResolver = () => undefined;

// --- per-section KPI metrics -------------------------------------------------

/** All seven §6.3 KPI metrics, computed over one set of records. Keyed by a stable camelCase name; `src/cli/format-report.ts` pairs each key with its `kpi-definitions.json` id/name via {@link KPI_METRIC_REPORT_KEYS} for display. */
export interface KpiReportMetrics {
  readonly statusDistribution: KpiResult<StatusDistributionResult>;
  readonly timeToFirstCorrect: KpiResult<TimeToFirstCorrectResult>;
  readonly verdictFrequency: KpiResult<VerdictFrequencyResult>;
  readonly upsolveCompletion: KpiResult<UpsolveCompletionResult>;
  readonly repeatSolveRetention: KpiResult<RepeatSolveRetentionResult>;
  readonly complexitySelectionAccuracy: KpiResult<ComplexitySelectionAccuracyResult>;
  readonly contestTimeAllocation: KpiResult<ContestTimeAllocationResult>;
}

/**
 * Pairs each {@link KpiReportMetrics} key with the matching
 * `data/kpi-definitions.json` metric id (`src/domain/kpi.ts`'s
 * `listKpiDefinitions()`/`getKpiDefinition()`), in §6.3 table order, so a
 * formatter can walk the seven official definitions and look up each
 * one's computed result without hard-coding the pairing itself.
 */
export const KPI_METRIC_REPORT_KEYS: ReadonlyArray<{
  readonly id: string;
  readonly key: keyof KpiReportMetrics;
}> = [
  { id: "status-distribution", key: "statusDistribution" },
  { id: "time-to-first-correct", key: "timeToFirstCorrect" },
  { id: "verdict-frequency", key: "verdictFrequency" },
  { id: "upsolve-completion", key: "upsolveCompletion" },
  { id: "repeat-solve-retention", key: "repeatSolveRetention" },
  { id: "complexity-selection-accuracy", key: "complexitySelectionAccuracy" },
  { id: "contest-time-allocation", key: "contestTimeAllocation" },
];

/** Computes all seven §6.3 metrics over `records`, using `resolveTopic` for the one metric (`statusDistribution`) that is inherently topic-shaped. Never throws for an empty `records` -- every `kpi.ts` function already handles that (see this module's docblock). */
function computeMetrics(
  records: readonly LearningRecord[],
  resolveTopic: TopicResolver,
): KpiReportMetrics {
  return {
    statusDistribution: statusDistributionByTopic(records, resolveTopic),
    timeToFirstCorrect: timeToFirstCorrect(records),
    verdictFrequency: verdictFrequency(records),
    upsolveCompletion: upsolveCompletionRate(records),
    repeatSolveRetention: repeatSolveRetention(records),
    complexitySelectionAccuracy: complexitySelectionAccuracy(records),
    contestTimeAllocation: contestTimeAllocation(records),
  };
}

/** One section of a {@link KpiReport}: either the whole-input `overall` section, or one per-group section when `groupBy` is `"topic"`/`"week"`. */
export interface KpiReportSection {
  /** `"overall"` for the whole-input section; a topic-family id, a week number (as a string), or `"unresolved"` for a per-group section. */
  readonly label: string;
  readonly recordCount: number;
  readonly metrics: KpiReportMetrics;
}

// --- postmortem: §13.1 step-4 error-taxonomy classification ------------------

/** One of the five §13.1 step-4 postmortem error classes, its count, and its share of {@link PostmortemBreakdown.totalClassifiedErrors}. */
export interface ErrorClassCount {
  readonly errorClass: ErrorTaxonomyClass;
  readonly count: number;
  /** `count / totalClassifiedErrors`, or `0` if `totalClassifiedErrors` is `0` (never `NaN`). */
  readonly share: number;
}

/** The full result of {@link buildPostmortem}. */
export interface PostmortemBreakdown {
  /** How many records in the input carry a non-null `errorTaxonomy` (i.e. were actually classified). */
  readonly totalClassifiedErrors: number;
  /** Exactly one entry per {@link ERROR_TAXONOMY_CLASSES} class, in that (§13.1) order -- always all five, even a class with a zero count. */
  readonly classes: readonly ErrorClassCount[];
}

/**
 * §13.1 step 4 ("Postmortem -> klasifikasi conceptual/modeling/complexity/
 * implementation/debugging error."): counts and shares of `errorTaxonomy`
 * across `records`, one entry per class, always all five present (a class
 * nobody hit that batch is reported as `count: 0`, not omitted).
 *
 * Insufficient data when no record in the input carries a non-null
 * `errorTaxonomy` -- including the empty-input case, and the all-AC case
 * where every record's `errorTaxonomy` is legitimately `null`.
 */
export function buildPostmortem(
  records: readonly LearningRecord[],
): KpiResult<PostmortemBreakdown> {
  const classified = records.filter((record) => record.errorTaxonomy !== null);

  if (classified.length === 0) {
    return {
      kind: "insufficient-data",
      reason:
        "no record in the input carries a non-null errorTaxonomy (either the input is empty, " +
        "or every record's verdict was AC with no postmortem classification recorded)",
    };
  }

  const counts = new Map<ErrorTaxonomyClass, number>(
    ERROR_TAXONOMY_CLASSES.map((errorClass) => [errorClass, 0]),
  );
  for (const record of classified) {
    // `classified` only contains records whose `errorTaxonomy` is non-null,
    // so this cast is safe -- narrowed by the `.filter` above.
    const errorClass = record.errorTaxonomy as ErrorTaxonomyClass;
    counts.set(errorClass, (counts.get(errorClass) ?? 0) + 1);
  }

  const classes: ErrorClassCount[] = ERROR_TAXONOMY_CLASSES.map((errorClass) => {
    const count = counts.get(errorClass) ?? 0;
    return { errorClass, count, share: count / classified.length };
  });

  return { kind: "value", value: { totalClassifiedErrors: classified.length, classes } };
}

// --- scheduled re-solves: §13.1 step-5 upsolve ------------------------------

/** One record whose §6.2 status (`B` or `C`) requires a scheduled re-solve, with the §6.2 schedule {@link resolveSchedule} (`src/domain/assessment.ts`) prescribes for it. */
export interface ScheduledResolveEntry {
  readonly learnerRef: string;
  readonly problemId: string;
  readonly status: "B" | "C";
  /** The original record's `recordedAt` -- the "solved on" date {@link resolveSchedule}'s window is computed from. */
  readonly recordedAt: string;
  readonly schedule: ScheduledResolveSchedule | ReimplementAndResolveSchedule;
}

/**
 * §13.1 step 5 ("Upsolve -> re-solve tanpa bantuan pada interval
 * terjadwal."): every record whose `status` is `B` or `C` (the two §6.2
 * statuses that carry a scheduled re-solve obligation -- `A` is
 * review-only, `D` is a gap diagnosis with no dated window), paired with
 * the §6.2 3-7 day window {@link resolveSchedule} computes for it from
 * that record's own `recordedAt`.
 *
 * Deliberately reports each entry's due *window* only, never an
 * "isOverdue"/"isDue" boolean computed against the current wall-clock
 * time: this module is a pure function of its input with no `Date.now()`
 * read (per this module's docblock), and a record's own `resolveStatus`
 * field (`not-required`/`scheduled`/`completed`/`overdue`) is already the
 * authoritative, caller-supplied source of truth for whether a given
 * re-solve is still outstanding -- recomputing that here from "now" could
 * only ever disagree with it, never improve on it.
 *
 * Entries are sorted by the schedule's `earliest` date ascending (ties
 * broken by `learnerRef` then `problemId`), so the listing is
 * deterministic regardless of input order. Empty array (never throws) for
 * an input with no B/C records, including the empty-input case.
 */
export function buildScheduledResolves(
  records: readonly LearningRecord[],
): readonly ScheduledResolveEntry[] {
  const entries: ScheduledResolveEntry[] = [];

  for (const record of records) {
    if (record.status !== "B" && record.status !== "C") {
      continue;
    }
    const schedule = resolveSchedule(record.status, new Date(record.recordedAt));
    if (schedule.kind !== "scheduled-resolve" && schedule.kind !== "reimplement-and-resolve") {
      // Unreachable: `resolveSchedule("B" | "C", ...)` always returns one
      // of these two variants (see its own docblock). Guarded rather than
      // asserted so a future change to `resolveSchedule` fails loudly here
      // instead of silently mis-typing `entries`.
      throw new Error(
        `buildScheduledResolves: unreachable -- resolveSchedule("${record.status}", ...) returned ` +
          `unexpected kind "${schedule.kind}"`,
      );
    }
    entries.push({
      learnerRef: record.learnerRef,
      problemId: record.problemId,
      status: record.status,
      recordedAt: record.recordedAt,
      schedule,
    });
  }

  return entries.sort((a, b) => {
    const byEarliest = a.schedule.earliest.getTime() - b.schedule.earliest.getTime();
    if (byEarliest !== 0) return byEarliest;
    const byLearner = a.learnerRef.localeCompare(b.learnerRef);
    if (byLearner !== 0) return byLearner;
    return a.problemId.localeCompare(b.problemId);
  });
}

// --- the report itself -------------------------------------------------------

/** How `buildKpiReport` should group its per-section KPI metrics. `"none"` produces only the `overall` section; `"topic"`/`"week"` also produce one `KpiReportSection` per resolved group. */
export type ReportGroupBy = "topic" | "week" | "none";

/** Options for {@link buildKpiReport}. See this module's docblock, "Grouping", for why `resolveTopic`/`resolveWeek` are required exactly when `groupBy` names them. */
export interface BuildKpiReportOptions {
  readonly records: readonly LearningRecord[];
  readonly groupBy: ReportGroupBy;
  /**
   * Required when `groupBy` is `"topic"`. Also used (optionally, when
   * `groupBy` is `"week"`/`"none"`) to compute the `statusDistribution`
   * metric accurately in every section -- see this module's docblock.
   */
  readonly resolveTopic?: TopicResolver;
  /** Required when `groupBy` is `"week"`. Unused otherwise. */
  readonly resolveWeek?: WeekResolver;
}

/** The full result of {@link buildKpiReport}. */
export interface KpiReport {
  readonly groupBy: ReportGroupBy;
  readonly recordCount: number;
  /** The seven §6.3 metrics computed over every input record, regardless of `groupBy`. */
  readonly overall: KpiReportSection;
  /** One section per resolved group. Empty when `groupBy` is `"none"`. */
  readonly groups: readonly KpiReportSection[];
  readonly postmortem: KpiResult<PostmortemBreakdown>;
  readonly scheduledResolves: readonly ScheduledResolveEntry[];
}

/** Partitions `records` by `resolveTopic(record.problemId) ?? "unresolved"`, preserving first-seen bucket order (same convention as `kpi.ts`'s `statusDistributionByTopic`). */
function partitionByTopic(
  records: readonly LearningRecord[],
  resolveTopic: TopicResolver,
): Map<string, LearningRecord[]> {
  const buckets = new Map<string, LearningRecord[]>();
  for (const record of records) {
    const label = resolveTopic(record.problemId) ?? UNRESOLVED_GROUP_LABEL;
    const bucket = buckets.get(label);
    if (bucket === undefined) {
      buckets.set(label, [record]);
    } else {
      bucket.push(record);
    }
  }
  return buckets;
}

/** Partitions `records` by `resolveWeek(record) ?? "unresolved"` (the week number stringified), preserving first-seen bucket order. */
function partitionByWeek(
  records: readonly LearningRecord[],
  resolveWeek: WeekResolver,
): Map<string, LearningRecord[]> {
  const buckets = new Map<string, LearningRecord[]>();
  for (const record of records) {
    const week = resolveWeek(record);
    const label = week === undefined ? UNRESOLVED_GROUP_LABEL : String(week);
    const bucket = buckets.get(label);
    if (bucket === undefined) {
      buckets.set(label, [record]);
    } else {
      bucket.push(record);
    }
  }
  return buckets;
}

/**
 * Builds the full mentor KPI report over `options.records`: the seven
 * §6.3 metrics (overall, plus per-group when `groupBy` is `"topic"`/
 * `"week"`), the §13.1 step-4 postmortem breakdown, and the §13.1 step-5
 * scheduled-re-solves listing.
 *
 * Throws {@link ReportRequestError} -- before computing anything -- when
 * `groupBy` is `"topic"` and `resolveTopic` is omitted, or `groupBy` is
 * `"week"` and `resolveWeek` is omitted. Never silently degrades to an
 * ungrouped report in either case (see this module's docblock).
 *
 * Never throws for an empty (or otherwise insufficient) `records`: every
 * metric, the postmortem, and the scheduled-resolves listing all produce
 * their own explicit "insufficient data"/empty result instead (see this
 * module's docblock, "Empty input").
 */
export function buildKpiReport(options: BuildKpiReportOptions): KpiReport {
  const { records, groupBy } = options;

  if (groupBy === "topic" && options.resolveTopic === undefined) {
    throw new ReportRequestError(
      'buildKpiReport: groupBy "topic" requires a resolveTopic(problemId) => topic family id | ' +
        "undefined function. A LearningRecord carries a problemId but no topic family of its own " +
        "-- that mapping lives in a problem bank/taxonomy, out of the learning-record schema's " +
        "scope (see src/schema/problem-taxonomy.ts). Pass options.resolveTopic, or use " +
        'groupBy: "none" (or "week") instead.',
    );
  }
  if (groupBy === "week" && options.resolveWeek === undefined) {
    throw new ReportRequestError(
      'buildKpiReport: groupBy "week" requires a resolveWeek(record) => week number | undefined ' +
        "function. A LearningRecord carries a recordedAt timestamp but no week number of its own " +
        "-- mapping a timestamp to a §4 week number depends on a specific cohort's start date and " +
        "excluded days (see src/domain/cohort-plan.ts's buildCohortPlan), which this module has no " +
        'way to receive on its own. Pass options.resolveWeek, or use groupBy: "none" (or "topic") ' +
        "instead.",
    );
  }

  const resolveTopic = options.resolveTopic ?? NULL_TOPIC_RESOLVER;

  const overall: KpiReportSection = {
    label: "overall",
    recordCount: records.length,
    metrics: computeMetrics(records, resolveTopic),
  };

  const groups: KpiReportSection[] = [];
  if (groupBy === "topic") {
    // Non-null per the guard above.
    const buckets = partitionByTopic(records, options.resolveTopic as TopicResolver);
    for (const [label, groupRecords] of buckets) {
      groups.push({
        label,
        recordCount: groupRecords.length,
        metrics: computeMetrics(groupRecords, resolveTopic),
      });
    }
  } else if (groupBy === "week") {
    // Non-null per the guard above.
    const buckets = partitionByWeek(records, options.resolveWeek as WeekResolver);
    for (const [label, groupRecords] of buckets) {
      groups.push({
        label,
        recordCount: groupRecords.length,
        metrics: computeMetrics(groupRecords, resolveTopic),
      });
    }
  }

  return {
    groupBy,
    recordCount: records.length,
    overall,
    groups,
    postmortem: buildPostmortem(records),
    scheduledResolves: buildScheduledResolves(records),
  };
}
