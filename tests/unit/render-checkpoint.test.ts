/**
 * Tests for `src/render/checkpoint.ts`'s `renderCheckpointSheet` (issue
 * #21): pure Markdown rendering from a validated checkpoint number (1-7),
 * checked against the real corpus. Snapshot tests use Bun's built-in
 * `toMatchSnapshot()` (see `tests/unit/render-weekly.test.ts`'s docblock
 * for why fixture files were not needed instead).
 */

import { describe, expect, test } from "bun:test";
import { renderCheckpointSheet } from "../../src/render/checkpoint";
import { RenderRequestError } from "../../src/render/errors";

/** Matches an unresolved template artefact that should never survive into rendered output. */
const UNRESOLVED_PLACEHOLDER = /\{\{|undefined|NaN|TODO/;

/** The five §6.1 assessment component names, verbatim from `data/assessment-weights.json`. */
const RUBRIC_COMPONENT_NAMES = [
  "Computational thinking & konsep",
  "Problem solving & algorithm selection",
  "Implementation correctness",
  "Contest performance",
  "Upsolve & learning process",
];

/** The four §6.2 problem-completion status codes. */
const STATUS_CODES = ["A", "B", "C", "D"];

/** The seven §6.3 KPI metric names, verbatim from `data/kpi-definitions.json`. */
const KPI_METRIC_NAMES = [
  "A/B/C/D per topic",
  "Time-to-first-correct",
  "WA/TLE/RE frequency",
  "Upsolve completion",
  "Repeat-solve retention",
  "Complexity-selection accuracy",
  "Contest time allocation",
];

describe("renderCheckpointSheet: snapshots", () => {
  test("checkpoint 1 matches its committed snapshot", () => {
    expect(renderCheckpointSheet(1)).toMatchSnapshot();
  });

  test("checkpoint 7 matches its committed snapshot", () => {
    expect(renderCheckpointSheet(7)).toMatchSnapshot();
  });
});

describe("renderCheckpointSheet: structural content", () => {
  test("checkpoint 1 names the week it follows and its §4.1 gate evidence", () => {
    const markdown = renderCheckpointSheet(1);
    expect(markdown).toContain("# Checkpoint 1 (after week 4");
    expect(markdown).toContain("Dapat coding dasar tanpa template berlebihan");
  });

  test("every checkpoint's output contains all five §6.1 rubric components with their weights", () => {
    for (let checkpoint = 1; checkpoint <= 7; checkpoint++) {
      const markdown = renderCheckpointSheet(checkpoint);
      for (const name of RUBRIC_COMPONENT_NAMES) {
        expect(markdown).toContain(name);
      }
      expect(markdown).toContain("20%");
      expect(markdown).toContain("25%");
      expect(markdown).toContain("10%");
    }
  });

  test("every checkpoint's output contains all four A/B/C/D codes and their follow-up actions", () => {
    for (let checkpoint = 1; checkpoint <= 7; checkpoint++) {
      const markdown = renderCheckpointSheet(checkpoint);
      for (const code of STATUS_CODES) {
        expect(markdown).toContain(`| ${code} |`);
      }
      expect(markdown).toContain("Re-solve 3-7 hari tanpa hint.");
      expect(markdown).toContain(
        "Diagnosis gap: konsep, modeling, complexity, implementation, debugging.",
      );
    }
  });

  test("every checkpoint's output contains all seven §6.3 KPI metric names", () => {
    for (let checkpoint = 1; checkpoint <= 7; checkpoint++) {
      const markdown = renderCheckpointSheet(checkpoint);
      for (const name of KPI_METRIC_NAMES) {
        expect(markdown).toContain(name);
      }
    }
  });
});

describe("renderCheckpointSheet: out-of-range input", () => {
  test("checkpoint 0 throws RenderRequestError naming the valid 1-7 range", () => {
    expect(() => renderCheckpointSheet(0)).toThrow(RenderRequestError);
    expect(() => renderCheckpointSheet(0)).toThrow(/Valid range: 1-7/);
  });

  test("checkpoint 8 throws RenderRequestError naming the valid 1-7 range", () => {
    expect(() => renderCheckpointSheet(8)).toThrow(RenderRequestError);
    expect(() => renderCheckpointSheet(8)).toThrow(/Valid range: 1-7/);
  });

  test("a non-integer checkpoint number throws RenderRequestError", () => {
    expect(() => renderCheckpointSheet(2.5)).toThrow(RenderRequestError);
  });
});

describe("renderCheckpointSheet: no unresolved placeholders, every valid checkpoint", () => {
  test("checkpoints 1-7 contain no {{, undefined, NaN, or TODO", () => {
    for (let checkpoint = 1; checkpoint <= 7; checkpoint++) {
      expect(renderCheckpointSheet(checkpoint)).not.toMatch(UNRESOLVED_PLACEHOLDER);
    }
  });
});

describe("renderCheckpointSheet: non-trivial output", () => {
  test("every valid checkpoint's rendered sheet exceeds a sensible minimum length", () => {
    for (let checkpoint = 1; checkpoint <= 7; checkpoint++) {
      expect(renderCheckpointSheet(checkpoint).length).toBeGreaterThan(600);
    }
  });
});
