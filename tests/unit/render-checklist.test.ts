/**
 * Tests for `renderChecklist` (`src/render/checklist.ts`, issue #25): the
 * pure Markdown renderer behind `osn checklist`.
 */

import { describe, expect, test } from "bun:test";
import { renderChecklist } from "../../src/render/checklist";
import {
  latestSyllabusCheck,
  listOperationalRules,
  listReadinessItems,
  quickPointer,
} from "../../src/domain/operations";

const FIXED_ASOF = new Date("2026-09-10T00:00:00Z");

describe("renderChecklist", () => {
  const rendered = renderChecklist(FIXED_ASOF);

  test("is a non-empty string", () => {
    expect(rendered.length).toBeGreaterThan(0);
  });

  test("contains all 8 readiness-checklist items", () => {
    for (const item of listReadinessItems()) {
      expect(rendered).toContain(item.item);
      expect(rendered).toContain(item.id);
      expect(rendered).toContain(item.verificationMethod);
      expect(rendered).toContain(item.evidenceRequired);
    }
  });

  test("contains all 8 operational rules", () => {
    for (const rule of listOperationalRules()) {
      expect(rendered).toContain(rule.rule);
    }
  });

  test("contains all 10 quick-pointer stages, in order", () => {
    const pointer = quickPointer();
    for (const stage of pointer.stages) {
      expect(rendered).toContain(stage);
    }
    // Confirm order, not just presence: each stage's index in the rendered
    // text must be strictly increasing.
    let searchFrom = 0;
    for (const stage of pointer.stages) {
      const index = rendered.indexOf(stage, searchFrom);
      expect(index).toBeGreaterThanOrEqual(searchFrom);
      searchFrom = index + stage.length;
    }
    expect(rendered).toContain(pointer.extensionCondition);
  });

  test("contains the syllabus-check status: date, outcome, sources, and days since", () => {
    const latest = latestSyllabusCheck();
    expect(rendered).toContain(latest.checkedOn);
    expect(rendered).toContain(latest.outcome);
    for (const source of latest.sources) {
      expect(rendered).toContain(source);
    }
    expect(rendered).toMatch(/Days since last check.*: \d+\./);
  });

  test("contains the corpus version", () => {
    expect(rendered).toMatch(/Corpus version: \S+ \(\S+\)/);
  });

  test("is byte-identical for the same asOf (pure function)", () => {
    expect(renderChecklist(FIXED_ASOF)).toBe(rendered);
  });

  test("changes only the days-since figure for a different asOf, not the underlying data", () => {
    const later = renderChecklist(new Date("2026-09-20T00:00:00Z"));
    expect(later).not.toBe(rendered);
    for (const item of listReadinessItems()) {
      expect(later).toContain(item.item);
    }
  });

  test("contains no template artefacts: no {{, no literal undefined/NaN/TODO", () => {
    expect(rendered).not.toContain("{{");
    expect(rendered).not.toMatch(/\bundefined\b/);
    expect(rendered).not.toMatch(/\bNaN\b/);
    expect(rendered).not.toMatch(/\bTODO\b/);
  });
});
