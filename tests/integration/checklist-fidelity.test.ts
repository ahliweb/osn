/**
 * Runs the same transcription-fidelity checks as
 * `bun run check:checklist-fidelity`, but imports the checker's pure
 * functions directly instead of shelling out, so the check contributes to
 * `bun test`/CI and the coverage gate.
 *
 * See `scripts/check-checklist-fidelity.ts` for the implementation and
 * what "fidelity" means here (byte-identical to
 * `docs/silabus/14-checklist-dan-aturan-operasional.md`, the source
 * document `data/readiness-checklist.json`/`data/operational-rules.json`
 * were transcribed from).
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  checkFidelity,
  extractOperationalRuleLines,
  extractQuickPointerLine,
  extractReadinessBullets,
  formatFidelityProblems,
} from "../../scripts/check-checklist-fidelity";

const repoRoot = join(import.meta.dir, "..", "..");
const sourceMarkdown = readFileSync(
  join(repoRoot, "docs", "silabus", "14-checklist-dan-aturan-operasional.md"),
  "utf-8",
);
const readinessFile = JSON.parse(
  readFileSync(join(repoRoot, "data", "readiness-checklist.json"), "utf-8"),
) as { items: Array<{ id: string; item: string }> };
const operationalRulesFile = JSON.parse(
  readFileSync(join(repoRoot, "data", "operational-rules.json"), "utf-8"),
) as {
  rules: Array<{ order: number; rule: string }>;
  quickPointer: { stages: string[]; extensionCondition: string };
};

describe("checklist fidelity: data/readiness-checklist.json + data/operational-rules.json vs. §14 markdown", () => {
  test("passes with zero mismatches against the real corpus", () => {
    const problems = checkFidelity(sourceMarkdown, readinessFile, operationalRulesFile);
    expect(formatFidelityProblems(problems)).toContain("OK --");
    expect(problems).toEqual([]);
  });

  test("extractReadinessBullets finds exactly the 8 §14.1 bullets, verbatim", () => {
    const bullets = extractReadinessBullets(sourceMarkdown);
    expect(bullets).toHaveLength(8);
    expect(bullets[0]).toBe("Verifikasi silabus resmi OSN dan halaman OSN-K/OSN-P terbaru.");
    expect(bullets[7]).toBe(
      "Tetapkan perlindungan data, akses mentor, retensi, backup, dan incident contact.",
    );
  });

  test("extractOperationalRuleLines finds exactly the 8 §14.2 rules, verbatim, ordered", () => {
    const rules = extractOperationalRuleLines(sourceMarkdown);
    expect(rules).toHaveLength(8);
    expect(rules[0]).toBe("Core OSN harus lebih dahulu daripada extension.");
    expect(rules[7]).toBe(
      "Setiap versi silabus harus memiliki tanggal, changelog, dan syllabus check.",
    );
  });

  test("extractQuickPointerLine finds the callout line containing all ten stages and the closing condition", () => {
    const line = extractQuickPointerLine(sourceMarkdown);
    expect(line).toContain(
      "Problem Solving -> C++ -> Complexity -> Math/Logic -> Complete Search -> Greedy -> DP -> Graph/Tree -> Data Structures -> Contest Engineering",
    );
    expect(line).toContain("Extension hanya setelah core stabil.");
  });
});

describe("check-checklist-fidelity pure functions (unit-level, fixture-driven)", () => {
  const FIXTURE_MARKDOWN = [
    "## 14.1 Checklist sebelum memulai cohort",
    "",
    "- Bullet one.",
    "- Bullet two.",
    "",
    "## 14.2 Aturan operasional final",
    "",
    "1. Rule one.",
    "2. Rule two.",
    "",
    "> **Pointer cepat untuk mentor** - Stage A -> Stage B. Closing condition.",
  ].join("\n");

  test("extractReadinessBullets/extractOperationalRuleLines/extractQuickPointerLine work on a minimal fixture", () => {
    expect(extractReadinessBullets(FIXTURE_MARKDOWN)).toEqual(["Bullet one.", "Bullet two."]);
    expect(extractOperationalRuleLines(FIXTURE_MARKDOWN)).toEqual(["Rule one.", "Rule two."]);
    expect(extractQuickPointerLine(FIXTURE_MARKDOWN)).toBe(
      "**Pointer cepat untuk mentor** - Stage A -> Stage B. Closing condition.",
    );
  });

  test("checkFidelity reports a mismatched item count", () => {
    const problems = checkFidelity(
      FIXTURE_MARKDOWN,
      { items: [{ id: "only-one", item: "Bullet one." }] },
      {
        rules: [
          { order: 1, rule: "Rule one." },
          { order: 2, rule: "Rule two." },
        ],
        quickPointer: { stages: ["Stage A", "Stage B"], extensionCondition: "Closing condition." },
      },
    );
    expect(problems.some((p) => p.context.includes("item count"))).toBe(true);
  });

  test("checkFidelity reports a mismatched rule count and a mismatched item text", () => {
    const problems = checkFidelity(
      FIXTURE_MARKDOWN,
      {
        items: [
          { id: "one", item: "Bullet one." },
          { id: "two", item: "WRONG TEXT." },
        ],
      },
      {
        rules: [{ order: 1, rule: "Rule one." }],
        quickPointer: { stages: ["Stage A", "Stage B"], extensionCondition: "Closing condition." },
      },
    );
    expect(problems.some((p) => p.context.includes("rule count"))).toBe(true);
    expect(problems.some((p) => p.context.includes("items[1]") && p.actual === "WRONG TEXT.")).toBe(
      true,
    );
  });

  test("checkFidelity reports a mismatched quickPointer stages/extensionCondition", () => {
    const problems = checkFidelity(
      FIXTURE_MARKDOWN,
      {
        items: [
          { id: "one", item: "Bullet one." },
          { id: "two", item: "Bullet two." },
        ],
      },
      {
        rules: [
          { order: 1, rule: "Rule one." },
          { order: 2, rule: "Rule two." },
        ],
        quickPointer: {
          stages: ["Stage A", "Wrong Stage"],
          extensionCondition: "Wrong condition.",
        },
      },
    );
    expect(problems.some((p) => p.context.includes("quickPointer.stages"))).toBe(true);
    expect(problems.some((p) => p.context.includes("quickPointer.extensionCondition"))).toBe(true);
  });

  test("extractQuickPointerLine throws if no callout line is present", () => {
    expect(() => extractQuickPointerLine("# nothing here\n")).toThrow(/Pointer cepat/);
  });

  test("formatFidelityProblems renders a numbered list and a clean OK message", () => {
    expect(formatFidelityProblems([])).toContain("OK --");
    const rendered = formatFidelityProblems([{ context: "ctx", expected: "a", actual: "b" }]);
    expect(rendered).toContain("FAILED -- 1 mismatch(es) found");
    expect(rendered).toContain("1. ctx");
  });
});
