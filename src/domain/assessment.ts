/**
 * Typed loaders, lookup helpers, and grading/scheduling logic over
 * `data/assessment-weights.json` and `data/problem-status.json`: the §6.1
 * five weighted internal assessment components and the §6.2 A/B/C/D
 * problem-completion status codes.
 *
 * Per the "Layering rules" in `docs/architecture/README.md`, this module
 * assumes the data it receives is valid once it has passed through
 * {@link parseDataFile}: it never re-implements validation logic of its
 * own (the weights-sum-to-100 and exactly-four-distinct-codes invariants
 * are enforced by the schemas in `src/schema/`, not re-checked here).
 * Loading happens once, at module load, and the result is memoised.
 *
 * This module owns re-solve *scheduling* (`resolveSchedule`). Hint
 * *escalation* is owned by `src/domain/pedagogy.ts` (issue #13); the two
 * modules are deliberately kept decoupled -- this module does not import
 * from `pedagogy.ts`, and vice versa.
 */

// `resolveJsonModule` is enabled in tsconfig.json, so a static import is a
// deterministic, dependency-free way to bring the corpus files in — no
// filesystem read, no async loader, and Bun/tsc both resolve it at build
// time. The value is `unknown` as far as validity is concerned; it is
// still parsed through the schema below before anything trusts its shape.
import rawAssessmentWeights from "../../data/assessment-weights.json";
import rawProblemStatus from "../../data/problem-status.json";
import {
  type AssessmentComponent,
  type AssessmentWeightsFile,
  assessmentWeightsFileSchema,
} from "../schema/assessment";
import { parseDataFile } from "../schema/common";
import {
  type ProblemStatus,
  type ProblemStatusFile,
  problemStatusFileSchema,
} from "../schema/problem-status";

const ASSESSMENT_WEIGHTS_SOURCE_NAME = "data/assessment-weights.json";
const PROBLEM_STATUS_SOURCE_NAME = "data/problem-status.json";

/**
 * The validated contents of `data/assessment-weights.json`, parsed once at
 * module load. Throws {@link CorpusValidationError} if the file does not
 * match {@link assessmentWeightsFileSchema}.
 */
const assessmentWeightsFile: AssessmentWeightsFile = parseDataFile(
  assessmentWeightsFileSchema,
  rawAssessmentWeights,
  ASSESSMENT_WEIGHTS_SOURCE_NAME,
);

/**
 * The validated contents of `data/problem-status.json`, parsed once at
 * module load. Throws {@link CorpusValidationError} if the file does not
 * match {@link problemStatusFileSchema}.
 */
const problemStatusFile: ProblemStatusFile = parseDataFile(
  problemStatusFileSchema,
  rawProblemStatus,
  PROBLEM_STATUS_SOURCE_NAME,
);

/** Every §6.1 assessment component, in source order. */
export function listComponents(): readonly AssessmentComponent[] {
  return assessmentWeightsFile.components;
}

/**
 * Looks up a §6.1 assessment component by ID, throwing a readable error
 * naming the unknown ID and listing every valid ID if none matches.
 */
export function getComponent(id: string): AssessmentComponent {
  const component = assessmentWeightsFile.components.find((entry) => entry.id === id);
  if (component === undefined) {
    const validIds = assessmentWeightsFile.components.map((entry) => entry.id).join(", ");
    throw new Error(`getComponent: unknown component id "${id}". Valid ids: ${validIds}.`);
  }
  return component;
}

/**
 * The sum of every §6.1 component's weight. Computed from the loaded data
 * rather than hard-coded to 100, so a schema/data change would be reflected
 * here too; {@link assessmentWeightsFileSchema}'s `superRefine` already
 * guarantees this is exactly 100 for the real corpus.
 */
export function totalWeight(): number {
  return assessmentWeightsFile.components.reduce((total, component) => total + component.weight, 0);
}

/** Every §6.2 problem-completion status, in source order. */
export function listStatuses(): readonly ProblemStatus[] {
  return problemStatusFile.statuses;
}

/**
 * Looks up a §6.2 problem-completion status by code, throwing a readable
 * error naming the unknown code and listing every valid code if none
 * matches.
 */
export function getStatus(code: string): ProblemStatus {
  const status = problemStatusFile.statuses.find((entry) => entry.code === code);
  if (status === undefined) {
    const validCodes = problemStatusFile.statuses.map((entry) => entry.code).join(", ");
    throw new Error(`getStatus: unknown status code "${code}". Valid codes: ${validCodes}.`);
  }
  return status;
}

/**
 * The §6.2 prescribed follow-up action for `code`, verbatim. Throws (via
 * {@link getStatus}) for an unknown code, naming the valid codes.
 */
export function followUpFor(code: string): string {
  return getStatus(code).followUp;
}

/**
 * Computes the §6.1 weighted assessment aggregate from per-component
 * scores: one 0-100 score per component id returned by
 * {@link listComponents} -- all five are required, no more and no fewer.
 *
 * Validation, in order:
 *  1. Rejects any key in `componentScores` that is not a known component
 *     id, naming the unknown id(s) and listing the valid ids.
 *  2. Rejects a `componentScores` missing any known component id, naming
 *     which id(s) are absent.
 *  3. Rejects any score outside the inclusive 0-100 range, naming the
 *     offending component id and the out-of-range value.
 *
 * Rounding rule (deterministic, documented here so it can never silently
 * drift from this comment): every term is first computed as the *integer*
 * product `score * weight` (weight is always an integer per
 * `assessmentComponentSchema`; when `score` is also an integer -- the
 * common case -- every product, and their sum, is an exact integer with no
 * floating-point representation error at all). These per-component
 * products are summed as a single running total; only then, once, at the
 * very end, is that sum divided by 100. The final result is rounded to two
 * decimal places with `Math.round(x * 100) / 100` (round-half-away-from-zero
 * on the third decimal digit).
 *
 * Computing this way -- one division at the very end instead of one
 * division *per component* folded into a running sum -- is what avoids
 * floating-point drift: dividing every term by 100 individually before
 * summing can accumulate binary floating-point rounding error across the
 * five additions (100 is not a power of two, so `score * weight / 100` is
 * frequently inexact in IEEE-754 double precision even when the true
 * mathematical value is exact). See the "avoids floating-point drift" test
 * in `tests/unit/assessment.test.ts`, which shows an all-scores-of-1 case
 * (weighted sum exactly 100, so the exact expected result is exactly `1`)
 * drifting to `0.9999999999999999` under that naive per-term-division
 * approach, while this function still returns exactly `1`.
 */
export function computeWeightedScore(componentScores: Readonly<Record<string, number>>): number {
  const components = listComponents();
  const validIds: string[] = components.map((component) => component.id);

  const unknownIds = Object.keys(componentScores).filter((id) => !validIds.includes(id));
  if (unknownIds.length > 0) {
    throw new Error(
      `computeWeightedScore: unknown component id(s): ${unknownIds.join(", ")}. ` +
        `Valid ids: ${validIds.join(", ")}.`,
    );
  }

  const missingIds = validIds.filter((id) => !(id in componentScores));
  if (missingIds.length > 0) {
    throw new Error(
      `computeWeightedScore: missing score(s) for required component id(s): ${missingIds.join(", ")}.`,
    );
  }

  let weightedSum = 0;
  for (const component of components) {
    const score = componentScores[component.id];
    if (score === undefined || Number.isNaN(score) || score < 0 || score > 100) {
      throw new Error(
        `computeWeightedScore: score for component "${component.id}" must be between 0 and ` +
          `100 inclusive; got ${score}.`,
      );
    }
    weightedSum += score * component.weight;
  }

  const raw = weightedSum / 100;
  return Math.round(raw * 100) / 100;
}

/** The §6.2 "Diagnosis gap" dimensions for status D, in source order. */
export const DIAGNOSIS_DIMENSIONS = [
  "konsep",
  "modeling",
  "complexity",
  "implementation",
  "debugging",
] as const;

/** One of the five §6.2 status-D gap-diagnosis dimensions. */
export type DiagnosisDimension = (typeof DIAGNOSIS_DIMENSIONS)[number];

/** Status A's schedule: a short review only, with no scheduled re-solve. */
export interface ReviewOnlySchedule {
  readonly kind: "review-only";
  readonly action: string;
}

/** Status B's schedule: a scheduled, hint-free re-solve within the §6.2 3-7 day window. */
export interface ScheduledResolveSchedule {
  readonly kind: "scheduled-resolve";
  readonly earliest: Date;
  readonly latest: Date;
  readonly action: string;
}

/**
 * Status C's schedule: mandatory reimplementation, plus a mandatory
 * explanation of the solution's invariant/state, plus a scheduled
 * re-solve. §6.2 prescribes only "re-solve terjadwal" for C, with no
 * explicit window; per {@link resolveSchedule}'s documented operational
 * reading, C carries over the same 3-7 day window used for B rather than
 * inventing an unrelated one -- a DERIVED decision, not verbatim source
 * text.
 */
export interface ReimplementAndResolveSchedule {
  readonly kind: "reimplement-and-resolve";
  readonly requiresReimplementation: true;
  readonly requiresExplanation: true;
  readonly earliest: Date;
  readonly latest: Date;
  readonly action: string;
}

/** Status D's schedule: a gap diagnosis across the five §6.2 failure dimensions. */
export interface DiagnoseGapSchedule {
  readonly kind: "diagnose-gap";
  readonly dimensions: readonly DiagnosisDimension[];
  readonly action: string;
}

/**
 * The discriminated-union result of {@link resolveSchedule}, one variant
 * per §6.2 status code (`review-only` for A, `scheduled-resolve` for B,
 * `reimplement-and-resolve` for C, `diagnose-gap` for D).
 */
export type ResolveSchedule =
  | ReviewOnlySchedule
  | ScheduledResolveSchedule
  | ReimplementAndResolveSchedule
  | DiagnoseGapSchedule;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The low end (in days) of the §6.2 B re-solve window ("Re-solve 3-7 hari
 * tanpa hint"). Also carried over to C; see
 * {@link ReimplementAndResolveSchedule}.
 */
const RESOLVE_WINDOW_EARLIEST_DAYS = 3;

/** The high end (in days) of the §6.2 B re-solve window. Also carried over to C. */
const RESOLVE_WINDOW_LATEST_DAYS = 7;

/**
 * Adds `days` whole days to `date` via pure epoch-millisecond arithmetic,
 * returning a new `Date` and never mutating `date`. Deliberately
 * UTC-only/timezone-independent: `Date#getTime()` already reports a UTC
 * instant (milliseconds since the Unix epoch), so adding a fixed
 * `days * 24 * 60 * 60 * 1000` to it can never be pulled off course by a
 * local calendar's DST transitions or timezone offset, the way the
 * local-timezone-sensitive `Date#setDate`/`Date#getDate` pair could be.
 */
function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/**
 * The §6.2 B/C re-solve window: `solvedOn + 3 days` to `solvedOn + 7 days`,
 * both endpoints inclusive, computed without mutating `solvedOn` (see
 * {@link addUtcDays}).
 */
function resolveWindow(solvedOn: Date): { readonly earliest: Date; readonly latest: Date } {
  return {
    earliest: addUtcDays(solvedOn, RESOLVE_WINDOW_EARLIEST_DAYS),
    latest: addUtcDays(solvedOn, RESOLVE_WINDOW_LATEST_DAYS),
  };
}

/**
 * Resolves the §6.2 follow-up schedule for a problem completed with status
 * `status`, solved on `solvedOn`:
 *  - `A` -> {@link ReviewOnlySchedule}: a short review, no scheduled
 *    re-solve.
 *  - `B` -> {@link ScheduledResolveSchedule}: a hint-free re-solve within
 *    `[solvedOn + 3 days, solvedOn + 7 days]` (both ends inclusive), per
 *    §6.2's "Re-solve 3-7 hari tanpa hint".
 *  - `C` -> {@link ReimplementAndResolveSchedule}: mandatory
 *    reimplementation, a mandatory explanation of the solution's
 *    invariant/state, and a scheduled re-solve. §6.2 only says "re-solve
 *    terjadwal" for C, giving no explicit number of days; this function
 *    carries over B's 3-7 day window as an operational reading (DERIVED,
 *    not verbatim source text) on the basis that §6.2 gives no other
 *    candidate window and a scheduled re-solve without hints is the same
 *    underlying obligation as B's, just preceded by mandatory
 *    reimplementation and explanation.
 *  - `D` -> {@link DiagnoseGapSchedule}: a gap diagnosis across all five
 *    §6.2 failure dimensions ({@link DIAGNOSIS_DIMENSIONS}).
 *
 * `solvedOn` is never mutated, and all date arithmetic is UTC-only (see
 * {@link addUtcDays}). Throws (via {@link getStatus}) for a `status` that
 * is not one of the four known codes, naming the valid codes.
 */
export function resolveSchedule(status: string, solvedOn: Date): ResolveSchedule {
  const record = getStatus(status);
  const action = record.followUp;

  if (record.code === "A") {
    return { kind: "review-only", action };
  }

  if (record.code === "B") {
    const { earliest, latest } = resolveWindow(solvedOn);
    return { kind: "scheduled-resolve", earliest, latest, action };
  }

  if (record.code === "C") {
    const { earliest, latest } = resolveWindow(solvedOn);
    return {
      kind: "reimplement-and-resolve",
      requiresReimplementation: true,
      requiresExplanation: true,
      earliest,
      latest,
      action,
    };
  }

  // The schema restricts `record.code` to "A" | "B" | "C" | "D", so this is
  // necessarily "D".
  return { kind: "diagnose-gap", dimensions: DIAGNOSIS_DIMENSIONS, action };
}
