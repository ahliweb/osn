/**
 * Pure planning logic for `osn plan` (issue #20): turns a cohort start date,
 * an optional set of excluded dates (school holidays, exam days, ...), and
 * an optional target competition stage into a dated 28-week calendar
 * against the §4 operational syllabus.
 *
 * Per the "Layering rules" in `docs/architecture/README.md`, this module is
 * `src/domain/`: no I/O, no formatting, no CLI argument parsing. It composes
 * two existing domain modules (`src/domain/curriculum.ts` for week
 * focus/mini-contest/checkpoint/gate facts, `src/domain/structure.ts` for
 * competition-stage lookup) rather than re-deriving anything they already
 * expose. `src/cli/commands/plan.ts` is the thin I/O + formatting shell
 * around {@link buildCohortPlan}, exactly as `src/cli/commands/validate.ts`
 * is the shell around `src/domain/corpus-audit.ts`'s `auditCorpus`.
 *
 * ## Determinism and date arithmetic (TR-07)
 *
 * TR-07 requires `osn plan` to produce byte-identical output across
 * repeated runs, computed with UTC date arithmetic only -- no date library,
 * no host-timezone dependence. This module follows the same convention
 * already established by `src/domain/assessment.ts`'s `addUtcDays`: dates
 * are represented as the epoch-millisecond instant of UTC midnight on that
 * calendar day (`Date.UTC(year, month - 1, day)`), arithmetic is plain
 * addition of `days * MS_PER_DAY` (never `Date#setDate`/`Date#getDate`,
 * which read/write the *host's local* calendar), and every value read back
 * out uses only `Date#getUTC*` accessors. A `Date` instance is only ever
 * constructed fresh from a computed millisecond value and immediately read
 * -- never mutated in place -- so the result cannot depend on the process's
 * `TZ` environment variable or the host's local timezone. Every function
 * here is a pure function of its arguments, so identical inputs always
 * produce an identical {@link CohortPlan} (and, transitively, identical
 * `JSON.stringify` output and identical rendered Markdown).
 */

import { gateAfter, getWeek } from "./curriculum";
import { getStage } from "./structure";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Strict `YYYY-MM-DD` shape, captured into (year, month, day) groups. */
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The fixed length of the operational syllabus (§4): 28 weeks. */
const WEEK_COUNT = 28;

/**
 * The number of *usable* (non-excluded) calendar days a week must contain.
 * This is the "7 calendar days" from the issue: every week covers 7 days
 * that are actually available for the programme, not 7 raw calendar-day
 * slots that might include an unusable holiday/exam day.
 */
const USABLE_DAYS_PER_WEEK = 7;

/**
 * The zero-based indexes, into a week's 7 usable days, that {@link
 * buildCohortPlan} picks as that week's two session dates: the 1st and 4th
 * usable day. See {@link buildCohortPlan}'s docblock, "Session-date rule",
 * for the rationale.
 */
const SESSION_USABLE_DAY_INDEXES = [0, 3] as const;

/**
 * The schedule-slip warning threshold, in days: see {@link
 * buildCohortPlan}'s docblock, "Target-stage warning", for why 14 days and
 * why this is gated on `targetStage` being supplied.
 */
const SCHEDULE_SLIP_WARNING_THRESHOLD_DAYS = 14;

/**
 * §4's mapping from competition stage to the week its intensive
 * preparation lands on, plus a human-readable label and note. `osn-k`,
 * `osn-p` and `osn-nasional` are verbatim from §4 (weeks 25/26/27); the
 * §4.1/§4 corpus gives no dedicated intensive week for the fourth stage
 * (`toki-ioi-extension`, an extension track layered on top of the core
 * 28-week programme, per §2.2), so it is mapped to week 28 ("Final
 * readiness & individualized repair") as the closest applicable milestone
 * -- a DERIVED reading, not verbatim source text, and called out as such in
 * its `note`.
 */
const STAGE_INTENSIVE_WEEK: Readonly<
  Record<string, { readonly week: number; readonly label: string; readonly note: string }>
> = {
  "osn-k": {
    week: 25,
    label: "OSN-K intensive",
    note: "§4 places OSN-K intensive preparation at week 25.",
  },
  "osn-p": {
    week: 26,
    label: "OSN-P intensive",
    note: "§4 places OSN-P intensive preparation at week 26.",
  },
  "osn-nasional": {
    week: 27,
    label: "Nasional mixed contest",
    note: "§4 places national mixed-contest preparation at week 27.",
  },
  "toki-ioi-extension": {
    week: 28,
    label: "Final readiness & individualized repair",
    note:
      "§4 gives no dedicated intensive week for the TOKI/IOI extension track; " +
      "week 28 (final readiness & individualized repair) is the closest " +
      "applicable milestone -- a derived reading, not verbatim source text.",
  },
};

/** One week of the {@link buildCohortPlan} output. */
export interface CohortWeekPlan {
  /** The week number, 1-28, matching `src/domain/curriculum.ts`'s `Week.week`. */
  readonly week: number;
  /** This week's focus, verbatim from §4 (`getWeek(week).focus`). */
  readonly focus: string;
  /** This week's first calendar day, ISO `YYYY-MM-DD`. */
  readonly startDate: string;
  /**
   * This week's last calendar day, ISO `YYYY-MM-DD`. `endDate - startDate`
   * is 6 days (a plain 7-day week) unless one or more excluded dates fall
   * inside the week, in which case it is extended -- see {@link
   * buildCohortPlan}'s docblock, "Week-shifting rule".
   */
  readonly endDate: string;
  /**
   * The two session dates for this week, ISO `YYYY-MM-DD`, always in
   * ascending order. See {@link buildCohortPlan}'s docblock,
   * "Session-date rule".
   */
  readonly sessionDates: readonly [string, string];
  /** Whether this week carries a mini-contest (`getWeek(week).hasMiniContest`). */
  readonly hasMiniContest: boolean;
  /** This week's checkpoint number, 1-7, or `null` (`getWeek(week).checkpoint`). */
  readonly checkpoint: number | null;
  /**
   * The evidence required by the §4.1 gate that follows this week
   * (`gateAfter(week)?.evidence`), or `null` if this week is not a gate
   * week.
   */
  readonly gateEvidence: readonly string[] | null;
}

/** The informational entry {@link buildCohortPlan} emits when `targetStage` is given. */
export interface TargetStageInfo {
  /** The validated target stage id, e.g. `"osn-k"`. */
  readonly stageId: string;
  /** The stage's printed label (`src/domain/structure.ts`'s `Stage.name`). */
  readonly stageName: string;
  /** The week number this stage's intensive preparation lands on, per §4. */
  readonly intensiveWeek: number;
  /** `intensiveWeek`'s first calendar day in *this* plan (post-shift), ISO `YYYY-MM-DD`. */
  readonly intensiveWeekStartDate: string;
  /** `intensiveWeek`'s last calendar day in *this* plan (post-shift), ISO `YYYY-MM-DD`. */
  readonly intensiveWeekEndDate: string;
  /** A human-readable note on how `intensiveWeek` was derived (see {@link STAGE_INTENSIVE_WEEK}). */
  readonly note: string;
}

/** {@link buildCohortPlan}'s input. */
export interface BuildCohortPlanInput {
  /** The cohort's start date, ISO `YYYY-MM-DD`. Required. */
  readonly startDate: string;
  /**
   * Dates to exclude from the plan (school holidays, exam days, ...), ISO
   * `YYYY-MM-DD` each. Order does not matter and duplicates are harmless --
   * the output normalises this list (deduplicated, ascending). Defaults to
   * `[]`.
   */
  readonly excludedDates?: readonly string[];
  /**
   * An optional competition-stage id to report against (one of
   * `src/domain/structure.ts`'s `STAGE_IDS`: `osn-k`, `osn-p`,
   * `osn-nasional`, `toki-ioi-extension`). See {@link buildCohortPlan}'s
   * docblock, "Target-stage warning".
   */
  readonly targetStage?: string;
}

/** {@link buildCohortPlan}'s output: the full 28-week cohort calendar. */
export interface CohortPlan {
  /** The validated, normalised start date, ISO `YYYY-MM-DD` (echoes the input). */
  readonly startDate: string;
  /** The normalised excluded-dates list: deduplicated, ascending, ISO `YYYY-MM-DD` each. */
  readonly excludedDates: readonly string[];
  /** The validated target stage id, or `null` if none was given. */
  readonly targetStage: string | null;
  /** The 28 weeks, in week-number order. */
  readonly weeks: readonly CohortWeekPlan[];
  /** The last week's `endDate`: when this specific plan (with its exclusions) finishes. */
  readonly projectedEndDate: string;
  /**
   * When the plan would finish with *no* excluded dates at all (a plain
   * `28 * 7 = 196`-day span from `startDate`). Always present, regardless
   * of whether `targetStage` was given, as the reference point the
   * schedule-slip warning (see `warnings`) is computed against.
   */
  readonly baselineEndDate: string;
  /** The target-stage informational entry, or `null` if `targetStage` was not given. */
  readonly targetStageInfo: TargetStageInfo | null;
  /**
   * Warnings about this plan. Currently at most one: the schedule-slip
   * warning, present only when `targetStage` was given AND
   * `projectedEndDate` is more than {@link SCHEDULE_SLIP_WARNING_THRESHOLD_DAYS}
   * days later than `baselineEndDate`. Always an array (empty, not
   * `null`/`undefined`, when there is nothing to warn about).
   */
  readonly warnings: readonly string[];
}

/**
 * Parses `value` as a strict ISO `YYYY-MM-DD` date, returning the epoch-
 * millisecond instant of UTC midnight on that day. Throws a clear error
 * naming `label` (the field this value came from, e.g. `"startDate"` or
 * `"excludedDates[2]"`) in three cases: `value` does not match the
 * `YYYY-MM-DD` shape at all; `value` matches the shape but is not a real
 * calendar date (e.g. `2026-02-30`, a day that does not exist -- caught by
 * round-tripping through `Date.UTC`/`getUTC*` and checking the components
 * survive unchanged, since `Date.UTC` silently normalises an out-of-range
 * day/month instead of rejecting it).
 */
function parseIsoDate(value: string, label: string): number {
  const match = ISO_DATE_PATTERN.exec(value);
  if (match === null) {
    throw new Error(
      `buildCohortPlan: ${label} must be an ISO "YYYY-MM-DD" date string; received ${JSON.stringify(value)}.`,
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  const roundTrip = new Date(ms);

  if (
    roundTrip.getUTCFullYear() !== year ||
    roundTrip.getUTCMonth() !== month - 1 ||
    roundTrip.getUTCDate() !== day
  ) {
    throw new Error(
      `buildCohortPlan: ${label} "${value}" is not a valid calendar date (that day does not exist in that month).`,
    );
  }

  return ms;
}

/** Formats an epoch-millisecond UTC-midnight instant back to ISO `YYYY-MM-DD`, via `getUTC*` only. */
function formatIsoDate(ms: number): string {
  const date = new Date(ms);
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Adds `days` whole days to `ms` (an epoch-millisecond UTC-midnight instant). Never mutates anything. */
function addDays(ms: number, days: number): number {
  return ms + days * MS_PER_DAY;
}

/** One week's computed calendar span, in epoch-millisecond form (internal to {@link buildWeekSpans}). */
interface WeekSpan {
  readonly weekNumber: number;
  readonly startMs: number;
  readonly endMs: number;
  /** Exactly {@link USABLE_DAYS_PER_WEEK} entries, ascending, none of them excluded. */
  readonly usableDaysMs: readonly number[];
}

/**
 * Builds all 28 week spans starting at `startMs`, applying the
 * week-shifting rule against `excludedMs`. See {@link buildCohortPlan}'s
 * docblock, "Week-shifting rule", for the rule this implements; this
 * function is its literal implementation.
 *
 * One pass, one cursor: for each week, walk forward one calendar day at a
 * time from the cursor, collecting every non-excluded day encountered until
 * {@link USABLE_DAYS_PER_WEEK} of them have been collected. The week's
 * `startMs` is the cursor where the walk began; its `endMs` is the last day
 * consumed (always a usable day, since the walk stops the instant the 7th
 * usable day is found). The next week's cursor is `endMs + 1 day`. An
 * excluded date encountered mid-walk is consumed (it becomes part of the
 * week's span) but does not count toward the 7, so it silently extends that
 * week by exactly one calendar day and pushes every following week back by
 * the same amount -- it can never be double-counted or dropped.
 */
function buildWeekSpans(startMs: number, excludedMs: ReadonlySet<number>): readonly WeekSpan[] {
  const spans: WeekSpan[] = [];
  let cursor = startMs;

  for (let weekNumber = 1; weekNumber <= WEEK_COUNT; weekNumber++) {
    const usableDaysMs: number[] = [];
    let day = cursor;

    while (usableDaysMs.length < USABLE_DAYS_PER_WEEK) {
      if (!excludedMs.has(day)) {
        usableDaysMs.push(day);
      }
      day = addDays(day, 1);
    }

    const endMs = addDays(day, -1);
    spans.push({ weekNumber, startMs: cursor, endMs, usableDaysMs });
    cursor = addDays(endMs, 1);
  }

  return spans;
}

/**
 * Builds the 28-week cohort calendar for `input` (issue #20 / TR-07 /
 * FR-23 / OR-03).
 *
 * ## Week-shifting rule
 *
 * A week is 7 *usable* calendar days -- days that are not in
 * `excludedDates`. Weeks are laid out back-to-back with no gaps and no
 * overlap: week 1 starts on `startDate`; each subsequent week starts the
 * calendar day immediately after the previous week's last day. Within a
 * week, days are consumed one at a time starting from that week's start:
 * an excluded date is consumed (it lies inside the week's date range, so it
 * can never re-appear inside a *later* week, and it is never silently
 * dropped) but does not count toward that week's 7 usable days, so the walk
 * simply continues one more calendar day to make up the shortfall. The
 * week's `endDate` is therefore its 7th usable day, whatever calendar date
 * that turns out to be -- `endDate - startDate` is 6 days for a week with
 * no excluded dates inside it, and grows by exactly one day for every
 * excluded date that fell inside it. Because every subsequent week starts
 * the day after the previous one ends, one excluded date shifts every
 * following week's whole date range later by exactly one day, and that
 * shift accumulates: two excluded dates anywhere in weeks 1-10 shift week
 * 11 onward by two days total, regardless of which of those ten weeks they
 * fell in. See {@link buildWeekSpans} for the literal implementation.
 *
 * ## Session-date rule
 *
 * Each week's `sessionDates` are its 1st and 4th usable day (0-indexed
 * `[0]` and `[3]` of the 7 usable days collected for that week), per §1.3's
 * "2 sesi mentor/minggu" baseline. This is deterministic and independent of
 * which real-world weekday each usable day falls on (the programme does not
 * assume a Monday-Sunday week or a fixed school timetable -- `--exclude`
 * already carries whatever school-specific calendar structure matters). An
 * excluded day is, by definition, never picked as a session date, since it
 * is never added to a week's `usableDaysMs` in the first place.
 *
 * ## Target-stage warning
 *
 * §4 places OSN-K intensive preparation at week 25, OSN-P at week 26,
 * national mixed at week 27, and final readiness at week 28. The issue
 * asks for a warning "when the corresponding intensive week falls after a
 * supplied target date", but `osn plan`'s scope (per issue #20) has no
 * target-*date* input, only `--target-stage`. This function implements the
 * closest defensible reading of that requirement given the actual inputs
 * available:
 *
 * 1. **Informational entry** (`targetStageInfo`, present whenever
 *    `targetStage` is given): names which week that stage's intensive
 *    preparation lands on (per {@link STAGE_INTENSIVE_WEEK}) and that
 *    week's *actual* date range in *this* plan -- i.e. post-shift, so a
 *    mentor planning against a target stage can see exactly which calendar
 *    dates the relevant intensive week now covers once holidays/exams are
 *    accounted for.
 * 2. **Schedule-slip warning** (`warnings`, populated only when
 *    `targetStage` is given): compares this plan's `projectedEndDate`
 *    against `baselineEndDate` (what the same 28 weeks would look like with
 *    zero excluded dates). If the difference exceeds
 *    {@link SCHEDULE_SLIP_WARNING_THRESHOLD_DAYS} (14) days, a warning
 *    fires, since a two-week-plus slip is exactly the kind of drift that
 *    could push an intensive week past the real-world OSN-K/OSN-P/national
 *    selection dates §14.1 says the calendar must be aligned against.
 *
 * Both are gated on `targetStage` being supplied (rather than always
 * computed) by design: `baselineEndDate` alone is always reported (it costs
 * nothing and is useful context regardless), but the *warning* only fires
 * once the caller has named a stage they are actually targeting --
 * `--exclude`-heavy plans with no stated target are not assumed to be
 * "wrong" just because they run long, since without a named target there
 * is no operational deadline to have slipped against. This keeps the two
 * target-stage outputs (info + warning) as one coherent feature rather than
 * surfacing a schedule-slip warning that looks like it is validating a
 * deadline nobody stated.
 *
 * ## Validation
 *
 * `startDate` and every entry of `excludedDates` must be a real ISO
 * `YYYY-MM-DD` calendar date (see {@link parseIsoDate}); a malformed or
 * non-existent date throws naming the offending field and value.
 * `excludedDates` entries strictly before `startDate` are **rejected**
 * (not silently ignored) -- an excluded date that predates the cohort
 * cannot shift anything and is far more likely to be a typo (wrong year,
 * wrong cohort) than a deliberate input, so failing loudly here is safer
 * than silently dropping it. `excludedDates` are deduplicated (by calendar
 * day) and returned sorted ascending in the output's `excludedDates`, so
 * that field is a normalised, deterministic function of the input
 * regardless of the order/duplication the caller passed. `targetStage`, if
 * given, is validated via `src/domain/structure.ts`'s `getStage` (thrown
 * error names every valid stage id) -- reused rather than re-implemented,
 * per the layering rules.
 *
 * ## Determinism
 *
 * Every step above is a pure function of `input`: no `Date.now()`, no
 * randomness, no host-timezone-sensitive operation (see this module's
 * docblock). Calling this twice with identical `input` produces two
 * results that are `JSON.stringify`-identical (byte-identical), satisfying
 * TR-07.
 */
export function buildCohortPlan(input: BuildCohortPlanInput): CohortPlan {
  const startMs = parseIsoDate(input.startDate, "startDate");
  const startDate = formatIsoDate(startMs);

  const excludedDatesInput = input.excludedDates ?? [];
  const excludedMsList = excludedDatesInput.map((value, index) =>
    parseIsoDate(value, `excludedDates[${index}]`),
  );

  for (const [index, ms] of excludedMsList.entries()) {
    if (ms < startMs) {
      throw new Error(
        `buildCohortPlan: excludedDates[${index}] "${excludedDatesInput[index]}" is before startDate "${startDate}". Excluded dates must be on or after the cohort's start date.`,
      );
    }
  }

  const excludedMsSet = new Set(excludedMsList);
  const excludedDates = [...excludedMsSet].sort((a, b) => a - b).map(formatIsoDate);

  let targetStageId: string | null = null;
  if (input.targetStage !== undefined) {
    targetStageId = getStage(input.targetStage).id;
  }

  const spans = buildWeekSpans(startMs, excludedMsSet);

  const weeks: CohortWeekPlan[] = spans.map((span) => {
    const week = getWeek(span.weekNumber);
    const gate = gateAfter(span.weekNumber);
    const firstIndex = SESSION_USABLE_DAY_INDEXES[0];
    const secondIndex = SESSION_USABLE_DAY_INDEXES[1];
    const firstSessionMs = span.usableDaysMs[firstIndex];
    const secondSessionMs = span.usableDaysMs[secondIndex];
    if (firstSessionMs === undefined || secondSessionMs === undefined) {
      throw new Error(
        `buildCohortPlan: internal error -- week ${span.weekNumber} does not have ` +
          `${USABLE_DAYS_PER_WEEK} usable days`,
      );
    }

    return {
      week: span.weekNumber,
      focus: week.focus,
      startDate: formatIsoDate(span.startMs),
      endDate: formatIsoDate(span.endMs),
      sessionDates: [formatIsoDate(firstSessionMs), formatIsoDate(secondSessionMs)],
      hasMiniContest: week.hasMiniContest,
      checkpoint: week.checkpoint,
      gateEvidence: gate?.evidence ?? null,
    };
  });

  const lastSpan = spans[spans.length - 1];
  if (lastSpan === undefined) {
    throw new Error("buildCohortPlan: internal error -- no weeks were built");
  }
  const projectedEndDate = formatIsoDate(lastSpan.endMs);

  const baselineSpans = buildWeekSpans(startMs, new Set());
  const lastBaselineSpan = baselineSpans[baselineSpans.length - 1];
  if (lastBaselineSpan === undefined) {
    throw new Error("buildCohortPlan: internal error -- no baseline weeks were built");
  }
  const baselineEndDate = formatIsoDate(lastBaselineSpan.endMs);

  let targetStageInfo: TargetStageInfo | null = null;
  const warnings: string[] = [];

  if (targetStageId !== null) {
    const stage = getStage(targetStageId);
    const mapping = STAGE_INTENSIVE_WEEK[stage.id];
    if (mapping === undefined) {
      throw new Error(
        `buildCohortPlan: internal error -- no intensive-week mapping for stage "${stage.id}"`,
      );
    }

    const intensiveSpan = spans[mapping.week - 1];
    if (intensiveSpan === undefined) {
      throw new Error(`buildCohortPlan: internal error -- week ${mapping.week} was not built`);
    }

    targetStageInfo = {
      stageId: stage.id,
      stageName: stage.name,
      intensiveWeek: mapping.week,
      intensiveWeekStartDate: formatIsoDate(intensiveSpan.startMs),
      intensiveWeekEndDate: formatIsoDate(intensiveSpan.endMs),
      note: mapping.note,
    };

    const slipDays = Math.round((lastSpan.endMs - lastBaselineSpan.endMs) / MS_PER_DAY);
    if (slipDays > SCHEDULE_SLIP_WARNING_THRESHOLD_DAYS) {
      warnings.push(
        `Schedule slip: excluded dates push the projected end date ${slipDays} day(s) later ` +
          `than the un-excluded ${WEEK_COUNT * USABLE_DAYS_PER_WEEK}-day baseline (more than ` +
          `the ${SCHEDULE_SLIP_WARNING_THRESHOLD_DAYS}-day threshold). Re-check this calendar ` +
          `against the real-world ${mapping.label} date for week ${mapping.week}.`,
      );
    }
  }

  return {
    startDate,
    excludedDates,
    targetStage: targetStageId,
    weeks,
    projectedEndDate,
    baselineEndDate,
    targetStageInfo,
    warnings,
  };
}
