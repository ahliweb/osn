/**
 * Tests for `src/domain/cohort-plan.ts`'s `buildCohortPlan`: the pure
 * planning logic behind `osn plan` (issue #20 / TR-07 / FR-23 / OR-03).
 *
 * Every date literal asserted against below was hand-computed independently
 * of the implementation (plain calendar-day counting, documented inline)
 * before being checked against `buildCohortPlan`'s actual output -- these
 * are not merely "whatever the code currently returns" assertions.
 */

import { describe, expect, test } from "bun:test";
import { buildCohortPlan } from "../../src/domain/cohort-plan";

const START = "2026-01-05";
const EXCLUDED_FOR_TZ_TEST = "2026-01-07";

describe("buildCohortPlan: no exclusions", () => {
  test("produces exactly 28 weeks", () => {
    const plan = buildCohortPlan({ startDate: START });
    expect(plan.weeks).toHaveLength(28);
  });

  test("week 1 starts on startDate and spans a plain 7-day range", () => {
    // 2026-01-05 + 6 days = 2026-01-11 (Jan has 31 days, well within bounds).
    const plan = buildCohortPlan({ startDate: START });
    const week1 = plan.weeks[0];
    expect(week1?.week).toBe(1);
    expect(week1?.startDate).toBe("2026-01-05");
    expect(week1?.endDate).toBe("2026-01-11");
  });

  test("week 1's session dates are its 1st and 4th usable day (05 and 08)", () => {
    const plan = buildCohortPlan({ startDate: START });
    expect(plan.weeks[0]?.sessionDates).toEqual(["2026-01-05", "2026-01-08"]);
  });

  test("week 28 ends on the 196th day (28 * 7) after startDate", () => {
    // 2026-01-05 + 195 days = 2026-07-19, hand-computed by calendar-day
    // counting: Jan has 26 remaining days after the 5th (05..31), then
    // Feb 28 (2026 is not a leap year), Mar 31, Apr 30, May 31, Jun 30,
    // leaving the balance in July.
    const plan = buildCohortPlan({ startDate: START });
    const week28 = plan.weeks[27];
    expect(week28?.week).toBe(28);
    expect(week28?.endDate).toBe("2026-07-19");
    expect(plan.projectedEndDate).toBe("2026-07-19");
    expect(plan.baselineEndDate).toBe("2026-07-19");
  });

  test("every week's endDate is exactly 6 days after its startDate", () => {
    const plan = buildCohortPlan({ startDate: START });
    for (const week of plan.weeks) {
      const start = new Date(`${week.startDate}T00:00:00.000Z`);
      const end = new Date(`${week.endDate}T00:00:00.000Z`);
      const diffDays = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
      expect(diffDays).toBe(6);
    }
  });

  test("weeks are contiguous: each week starts the day after the previous week ends", () => {
    const plan = buildCohortPlan({ startDate: START });
    for (let i = 1; i < plan.weeks.length; i++) {
      const previousEnd = new Date(`${plan.weeks[i - 1]?.endDate}T00:00:00.000Z`);
      const thisStart = new Date(`${plan.weeks[i]?.startDate}T00:00:00.000Z`);
      const diffDays = (thisStart.getTime() - previousEnd.getTime()) / (24 * 60 * 60 * 1000);
      expect(diffDays).toBe(1);
    }
  });

  test("gates and checkpoints land on weeks 4/8/12/16/20/24/28, numbered 1-7", () => {
    const plan = buildCohortPlan({ startDate: START });
    const gateWeeks = [4, 8, 12, 16, 20, 24, 28];
    for (const [index, weekNumber] of gateWeeks.entries()) {
      const week = plan.weeks[weekNumber - 1];
      expect(week?.checkpoint).toBe(index + 1);
      expect(week?.gateEvidence).not.toBeNull();
      expect(week?.gateEvidence?.length).toBeGreaterThan(0);
    }
  });

  test("non-gate weeks have a null checkpoint and null gateEvidence", () => {
    const plan = buildCohortPlan({ startDate: START });
    for (const week of plan.weeks) {
      const isGateWeek = [4, 8, 12, 16, 20, 24, 28].includes(week.week);
      if (!isGateWeek) {
        expect(week.checkpoint).toBeNull();
        expect(week.gateEvidence).toBeNull();
      }
    }
  });

  test("mini-contest weeks match the domain data (8, 16, 20)", () => {
    const plan = buildCohortPlan({ startDate: START });
    const miniContestWeeks = plan.weeks.filter((week) => week.hasMiniContest).map((w) => w.week);
    expect(miniContestWeeks).toEqual([8, 16, 20]);
  });

  test("focus text matches the domain data for a known week", () => {
    const plan = buildCohortPlan({ startDate: START });
    expect(plan.weeks[0]?.focus).toBe("Orientasi CP & C++ dasar");
  });

  test("excludedDates is empty, targetStage/targetStageInfo are null, warnings is empty", () => {
    const plan = buildCohortPlan({ startDate: START });
    expect(plan.excludedDates).toEqual([]);
    expect(plan.targetStage).toBeNull();
    expect(plan.targetStageInfo).toBeNull();
    expect(plan.warnings).toEqual([]);
  });
});

describe("buildCohortPlan: exclusions shift subsequent weeks", () => {
  // Hand-computed (see the test above's method): with startDate 2026-01-05
  // and 2026-01-07 excluded, week 1 walks 05, 06, (skip 07), 08, 09, 10, 11,
  // 12 to collect 7 usable days -- so week 1 becomes an 8-calendar-day span
  // (05-12), and every following week is pushed one day later than the
  // no-exclusion baseline.
  const EXCLUDED = "2026-01-07";

  test("week 1 is extended by exactly one day and week 2 starts the day after", () => {
    const plan = buildCohortPlan({ startDate: START, excludedDates: [EXCLUDED] });
    expect(plan.weeks[0]?.startDate).toBe("2026-01-05");
    expect(plan.weeks[0]?.endDate).toBe("2026-01-12");
    expect(plan.weeks[1]?.startDate).toBe("2026-01-13");
    expect(plan.weeks[1]?.endDate).toBe("2026-01-19");
  });

  test("week 1's session dates skip the excluded day (1st and 4th usable day: 05 and 09)", () => {
    const plan = buildCohortPlan({ startDate: START, excludedDates: [EXCLUDED] });
    expect(plan.weeks[0]?.sessionDates).toEqual(["2026-01-05", "2026-01-09"]);
  });

  test("no week's sessionDates ever contains the excluded date", () => {
    const plan = buildCohortPlan({ startDate: START, excludedDates: [EXCLUDED] });
    for (const week of plan.weeks) {
      expect(week.sessionDates).not.toContain(EXCLUDED);
    }
  });

  test("projectedEndDate is pushed exactly one day later than the un-excluded baseline", () => {
    const plan = buildCohortPlan({ startDate: START, excludedDates: [EXCLUDED] });
    expect(plan.baselineEndDate).toBe("2026-07-19");
    expect(plan.projectedEndDate).toBe("2026-07-20");
  });

  test("gate/checkpoint week numbers are unaffected by the shift (still 4/8/12/16/20/24/28)", () => {
    const plan = buildCohortPlan({ startDate: START, excludedDates: [EXCLUDED] });
    const gateWeeks = plan.weeks.filter((week) => week.checkpoint !== null).map((w) => w.week);
    expect(gateWeeks).toEqual([4, 8, 12, 16, 20, 24, 28]);
  });

  test("two exclusions in different weeks shift every week after the later one by two days total", () => {
    // 2026-01-07 falls in week 1; 2026-03-20 falls well after week 1 in the
    // shifted calendar. Regardless of which weeks they land in, by week 28
    // the cumulative shift is exactly 2 days versus baseline.
    const plan = buildCohortPlan({
      startDate: START,
      excludedDates: [EXCLUDED, "2026-03-20"],
    });
    expect(plan.baselineEndDate).toBe("2026-07-19");
    expect(plan.projectedEndDate).toBe("2026-07-21");
  });

  test("duplicate and out-of-order excluded dates are deduplicated and sorted in the output", () => {
    const plan = buildCohortPlan({
      startDate: START,
      excludedDates: ["2026-03-20", EXCLUDED, EXCLUDED, "2026-03-20"],
    });
    expect(plan.excludedDates).toEqual(["2026-01-07", "2026-03-20"]);
  });

  test("an excluded date exactly on startDate extends week 1 without error", () => {
    const plan = buildCohortPlan({ startDate: START, excludedDates: [START] });
    expect(plan.weeks[0]?.startDate).toBe(START);
    expect(plan.weeks[0]?.endDate).toBe("2026-01-12");
    expect(plan.weeks[0]?.sessionDates).toEqual(["2026-01-06", "2026-01-09"]);
  });
});

describe("buildCohortPlan: target-stage informational entry and schedule-slip warning", () => {
  test("with no targetStage, targetStageInfo is null and warnings is empty even with a large slip", () => {
    // Six exclusions all inside week 1 push the whole plan back by 6 days,
    // well past the 14-day threshold if it were checked -- but with no
    // targetStage given, neither the info entry nor the warning fires.
    const plan = buildCohortPlan({
      startDate: START,
      excludedDates: [
        "2026-01-05",
        "2026-01-06",
        "2026-01-07",
        "2026-01-08",
        "2026-01-09",
        "2026-01-10",
      ],
    });
    expect(plan.targetStageInfo).toBeNull();
    expect(plan.warnings).toEqual([]);
  });

  test("osn-k names week 25 and its post-shift date range", () => {
    const plan = buildCohortPlan({ startDate: START, targetStage: "osn-k" });
    expect(plan.targetStage).toBe("osn-k");
    expect(plan.targetStageInfo?.stageId).toBe("osn-k");
    expect(plan.targetStageInfo?.intensiveWeek).toBe(25);
    expect(plan.targetStageInfo?.intensiveWeekStartDate).toBe(plan.weeks[24]?.startDate);
    expect(plan.targetStageInfo?.intensiveWeekEndDate).toBe(plan.weeks[24]?.endDate);
  });

  test("osn-p names week 26, osn-nasional names week 27, toki-ioi-extension names week 28", () => {
    expect(
      buildCohortPlan({ startDate: START, targetStage: "osn-p" }).targetStageInfo?.intensiveWeek,
    ).toBe(26);
    expect(
      buildCohortPlan({ startDate: START, targetStage: "osn-nasional" }).targetStageInfo
        ?.intensiveWeek,
    ).toBe(27);
    expect(
      buildCohortPlan({ startDate: START, targetStage: "toki-ioi-extension" }).targetStageInfo
        ?.intensiveWeek,
    ).toBe(28);
  });

  test("no schedule-slip warning when the slip is 14 days or less", () => {
    // 14 exclusions all inside week 1 push the plan back by exactly 14
    // days -- at, not over, the threshold, so no warning fires.
    const fourteenExclusions = Array.from({ length: 14 }, (_, i) => {
      const day = 5 + i; // 2026-01-05 .. 2026-01-18
      return `2026-01-${String(day).padStart(2, "0")}`;
    });
    const plan = buildCohortPlan({
      startDate: START,
      excludedDates: fourteenExclusions,
      targetStage: "osn-k",
    });
    const slip =
      (new Date(`${plan.projectedEndDate}T00:00:00.000Z`).getTime() -
        new Date(`${plan.baselineEndDate}T00:00:00.000Z`).getTime()) /
      (24 * 60 * 60 * 1000);
    expect(slip).toBe(14);
    expect(plan.warnings).toEqual([]);
  });

  test("a schedule-slip warning fires once the slip exceeds 14 days", () => {
    const fifteenExclusions = Array.from({ length: 15 }, (_, i) => {
      const day = 5 + i; // 2026-01-05 .. 2026-01-19
      return `2026-01-${String(day).padStart(2, "0")}`;
    });
    const plan = buildCohortPlan({
      startDate: START,
      excludedDates: fifteenExclusions,
      targetStage: "osn-p",
    });
    expect(plan.warnings).toHaveLength(1);
    expect(plan.warnings[0]).toContain("Schedule slip");
    expect(plan.warnings[0]).toContain("15 day");
  });
});

describe("buildCohortPlan: invalid inputs throw with clear messages", () => {
  test("a missing startDate throws naming the expected format", () => {
    // @ts-expect-error -- deliberately omitting the required field
    expect(() => buildCohortPlan({})).toThrow(/startDate/);
  });

  test("a non-ISO startDate throws", () => {
    expect(() => buildCohortPlan({ startDate: "01/05/2026" })).toThrow(/ISO "YYYY-MM-DD"/);
  });

  test("an out-of-range startDate throws", () => {
    expect(() => buildCohortPlan({ startDate: "2026-13-01" })).toThrow(/startDate/);
  });

  test("a startDate naming a day that does not exist throws", () => {
    expect(() => buildCohortPlan({ startDate: "2026-02-30" })).toThrow(/not a valid calendar date/);
  });

  test("a non-ISO excluded date throws, naming the offending entry", () => {
    expect(() => buildCohortPlan({ startDate: START, excludedDates: ["not-a-date"] })).toThrow(
      /excludedDates\[0\]/,
    );
  });

  test("an excluded date before startDate throws", () => {
    expect(() => buildCohortPlan({ startDate: START, excludedDates: ["2025-12-31"] })).toThrow(
      /is before startDate/,
    );
  });

  test("an unknown targetStage throws, naming the valid stage ids", () => {
    expect(() => buildCohortPlan({ startDate: START, targetStage: "not-a-stage" })).toThrow(
      /osn-k, osn-p, osn-nasional, toki-ioi-extension/,
    );
  });
});

describe("buildCohortPlan: determinism", () => {
  test("identical inputs produce byte-identical JSON.stringify output", () => {
    const input = {
      startDate: START,
      excludedDates: ["2026-01-07", "2026-03-20"],
      targetStage: "osn-k",
    };
    const first = buildCohortPlan(input);
    const second = buildCohortPlan(input);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  test("identical inputs (fresh object literals) still produce byte-identical output", () => {
    const first = buildCohortPlan({ startDate: "2026-03-02", excludedDates: ["2026-03-10"] });
    const second = buildCohortPlan({ startDate: "2026-03-02", excludedDates: ["2026-03-10"] });
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});

describe("buildCohortPlan: timezone independence", () => {
  test("output is identical regardless of the host TZ", () => {
    const originalTz = process.env.TZ;
    try {
      process.env.TZ = "Pacific/Kiritimati"; // UTC+14
      const underKiritimati = buildCohortPlan({
        startDate: START,
        excludedDates: [EXCLUDED_FOR_TZ_TEST],
        targetStage: "osn-k",
      });

      process.env.TZ = "Etc/GMT+12"; // UTC-12
      const underGmtMinus12 = buildCohortPlan({
        startDate: START,
        excludedDates: [EXCLUDED_FOR_TZ_TEST],
        targetStage: "osn-k",
      });

      // Hand-computed exact expectations (same as the "exclusions shift"
      // suite above), asserted while TZ is set to two extreme, opposite
      // offsets -- proving the result cannot depend on host TZ.
      expect(underKiritimati.weeks[0]?.startDate).toBe("2026-01-05");
      expect(underKiritimati.weeks[0]?.endDate).toBe("2026-01-12");
      expect(underKiritimati.projectedEndDate).toBe("2026-07-20");
      expect(JSON.stringify(underKiritimati)).toBe(JSON.stringify(underGmtMinus12));
    } finally {
      if (originalTz === undefined) {
        // biome-ignore lint/performance/noDelete: TZ must be actually unset here -- assigning `undefined` would coerce to the literal string "undefined" (an invalid TZ value), not remove it.
        delete process.env.TZ;
      } else {
        process.env.TZ = originalTz;
      }
    }
  });
});
