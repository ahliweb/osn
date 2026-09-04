/**
 * Tests for `src/render/weekly.ts`'s `renderWeeklyPlan` (issue #21): pure
 * Markdown rendering from a validated week number, checked against the
 * real corpus. Snapshot tests use Bun's built-in `toMatchSnapshot()`
 * (`bun test` v1.4.0 supports it natively -- verified against a scratch
 * test before committing these; see the task report), so no separate
 * fixture files are needed under `tests/fixtures/`.
 */

import { describe, expect, test } from "bun:test";
import { RenderRequestError } from "../../src/render/errors";
import { renderWeeklyPlan } from "../../src/render/weekly";

/** Matches an unresolved template artefact that should never survive into rendered output. */
const UNRESOLVED_PLACEHOLDER = /\{\{|undefined|NaN|TODO/;

/** The exact segment-boundary labels §5.1 defines, in row order, for one 120-minute session. */
const SEGMENT_LABELS = ["0-15", "15-45", "45-90", "90-115", "115-120"];

describe("renderWeeklyPlan: snapshots", () => {
  test("week 1 matches its committed snapshot", () => {
    expect(renderWeeklyPlan(1)).toMatchSnapshot();
  });

  test("week 14 matches its committed snapshot", () => {
    expect(renderWeeklyPlan(14)).toMatchSnapshot();
  });

  test("week 28 matches its committed snapshot", () => {
    expect(renderWeeklyPlan(28)).toMatchSnapshot();
  });
});

describe("renderWeeklyPlan: structural content", () => {
  test("week 1 contains its focus, content, outcome, and problem-load range", () => {
    const markdown = renderWeeklyPlan(1);
    expect(markdown).toContain("# Week 1: Orientasi CP & C++ dasar");
    expect(markdown).toContain("Algoritma/pseudocode");
    expect(markdown).toContain("Menulis program dasar, dry-run, membedakan int/long long.");
    expect(markdown).toContain("Curated problem-load target: 6-10 soal");
  });

  test("every valid week's output contains all five §5.1 segment timings for both sessions", () => {
    for (let week = 1; week <= 28; week++) {
      const markdown = renderWeeklyPlan(week);
      for (const label of SEGMENT_LABELS) {
        const occurrences = markdown.split(label).length - 1;
        expect(occurrences).toBeGreaterThanOrEqual(2);
      }
    }
  });

  test("includes both session focuses, the SOP reminder, and the hint ladder", () => {
    const markdown = renderWeeklyPlan(1);
    expect(markdown).toContain("konsep & guided practice");
    expect(markdown).toContain("problem solving & feedback");
    expect(markdown).toContain("## SOP reminder (§5.2)");
    expect(markdown).toContain("## Hint policy ladder (§5.3)");
    expect(markdown).toContain("pertanyaan pemodelan");
    expect(markdown).toContain("editorial");
  });

  test("includes the §5.1 exit-ticket instruction", () => {
    const markdown = renderWeeklyPlan(1);
    expect(markdown).toContain("## Exit ticket (§5.1)");
    expect(markdown).toContain("Exit ticket: 3 poin yang dipahami + 1 gap.");
  });

  test("a week with a null problemLoad states there is no fixed count (week 28)", () => {
    const markdown = renderWeeklyPlan(28);
    expect(markdown).toContain("no fixed count for this week");
    expect(markdown).not.toContain("Curated problem-load target:");
  });

  test("a gate week (28) includes its §4.1 gate evidence; a non-gate week (14) does not include a gate-evidence section", () => {
    const gateWeekMarkdown = renderWeeklyPlan(28);
    expect(gateWeekMarkdown).toContain("## Gate evidence (§4.1, checkpoint 7)");
    expect(gateWeekMarkdown).toContain(
      "Menyelesaikan simulasi sesuai tahap target, melakukan postmortem dan upsolve mandiri.",
    );

    const nonGateWeekMarkdown = renderWeeklyPlan(14);
    expect(nonGateWeekMarkdown).not.toContain("Gate evidence");
  });
});

describe("renderWeeklyPlan: out-of-range input", () => {
  test("week 0 throws RenderRequestError naming the valid 1-28 range", () => {
    expect(() => renderWeeklyPlan(0)).toThrow(RenderRequestError);
    expect(() => renderWeeklyPlan(0)).toThrow(/Valid range: 1-28/);
  });

  test("week 29 throws RenderRequestError naming the valid 1-28 range", () => {
    expect(() => renderWeeklyPlan(29)).toThrow(RenderRequestError);
    expect(() => renderWeeklyPlan(29)).toThrow(/Valid range: 1-28/);
  });

  test("a non-integer week throws RenderRequestError", () => {
    expect(() => renderWeeklyPlan(1.5)).toThrow(RenderRequestError);
  });
});

describe("renderWeeklyPlan: no unresolved placeholders, every valid week", () => {
  test("weeks 1-28 contain no {{, undefined, NaN, or TODO", () => {
    for (let week = 1; week <= 28; week++) {
      const markdown = renderWeeklyPlan(week);
      expect(markdown).not.toMatch(UNRESOLVED_PLACEHOLDER);
    }
  });
});

describe("renderWeeklyPlan: non-trivial output", () => {
  test("every valid week's rendered plan exceeds a sensible minimum length", () => {
    for (let week = 1; week <= 28; week++) {
      expect(renderWeeklyPlan(week).length).toBeGreaterThan(800);
    }
  });
});
