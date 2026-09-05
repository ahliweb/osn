/**
 * Fidelity check for issue #25: proves every verbatim-Indonesian field in
 * `data/readiness-checklist.json` (the §14.1 items) and
 * `data/operational-rules.json` (the §14.2 rules and the mentor
 * quick-pointer callout) is byte-identical to the corresponding line of
 * `docs/silabus/14-checklist-dan-aturan-operasional.md` -- the source
 * document those two data files were transcribed from.
 *
 * This is a **transcription-fidelity** check, distinct from
 * `bun run validate` (schema/structural conformance) and
 * `bun run check:requirements` (requirements-traceability consistency):
 * neither of those compares a data file's prose against the Markdown
 * source it was copied from. Run standalone:
 *
 *   bun run scripts/check-checklist-fidelity.ts
 *
 * Exits 0 with a summary line if every field matches; exits 1 and lists
 * every mismatch (not just the first) otherwise.
 */

import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "..");
const SOURCE_MD_PATH = join(REPO_ROOT, "docs", "silabus", "14-checklist-dan-aturan-operasional.md");
const READINESS_JSON_PATH = join(REPO_ROOT, "data", "readiness-checklist.json");
const OPERATIONAL_RULES_JSON_PATH = join(REPO_ROOT, "data", "operational-rules.json");

interface ReadinessItem {
  readonly id: string;
  readonly item: string;
}
interface ReadinessFile {
  readonly items: readonly ReadinessItem[];
}

interface OperationalRule {
  readonly order: number;
  readonly rule: string;
}
interface OperationalRulesFile {
  readonly rules: readonly OperationalRule[];
  readonly quickPointer: {
    readonly stages: readonly string[];
    readonly extensionCondition: string;
  };
}

/** Extracts the §14.1 bullet list (the lines between the "## 14.1" and "## 14.2" headings), each bullet's text with its leading "- " stripped. */
export function extractReadinessBullets(markdown: string): string[] {
  const section = extractBetween(markdown, "## 14.1 Checklist sebelum memulai cohort", "## 14.2");
  return section
    .split("\n")
    .filter((line) => line.trim().startsWith("- "))
    .map((line) => line.trim().replace(/^- /, ""));
}

/** Extracts the §14.2 numbered rule list (the lines between the "## 14.2" heading and the "> **Pointer cepat" blockquote), each rule's text with its leading "N. " stripped. */
export function extractOperationalRuleLines(markdown: string): string[] {
  const section = extractBetween(markdown, "## 14.2 Aturan operasional final", "> **Pointer cepat");
  return section
    .split("\n")
    .filter((line) => /^\d+\.\s/.test(line.trim()))
    .map((line) => line.trim().replace(/^\d+\.\s/, ""));
}

/** Extracts the "Pointer cepat untuk mentor" callout's own text (the blockquote line, "> " stripped). */
export function extractQuickPointerLine(markdown: string): string {
  const line = markdown
    .split("\n")
    .find((candidate) => candidate.trim().startsWith("> **Pointer cepat"));
  if (line === undefined) {
    throw new Error(
      'check-checklist-fidelity: no "> **Pointer cepat" line found in source markdown.',
    );
  }
  return line.trim().replace(/^>\s*/, "");
}

function extractBetween(markdown: string, startMarker: string, endMarker: string): string {
  const startIndex = markdown.indexOf(startMarker);
  if (startIndex === -1) {
    throw new Error(`check-checklist-fidelity: marker ${JSON.stringify(startMarker)} not found.`);
  }
  const afterStart = markdown.slice(startIndex + startMarker.length);
  const endIndex = afterStart.indexOf(endMarker);
  if (endIndex === -1) {
    throw new Error(`check-checklist-fidelity: marker ${JSON.stringify(endMarker)} not found.`);
  }
  return afterStart.slice(0, endIndex);
}

export interface FidelityProblem {
  readonly context: string;
  readonly expected: string;
  readonly actual: string;
}

/** Compares every readiness item / operational rule / quick-pointer field against the source markdown, returning every mismatch found (not just the first). */
export function checkFidelity(
  sourceMarkdown: string,
  readinessFile: ReadinessFile,
  operationalRulesFile: OperationalRulesFile,
): FidelityProblem[] {
  const problems: FidelityProblem[] = [];

  const readinessBullets = extractReadinessBullets(sourceMarkdown);
  if (readinessBullets.length !== readinessFile.items.length) {
    problems.push({
      context: "readiness-checklist.json item count vs. §14.1 bullet count",
      expected: String(readinessBullets.length),
      actual: String(readinessFile.items.length),
    });
  } else {
    readinessFile.items.forEach((item, index) => {
      const expected = readinessBullets[index];
      if (expected !== undefined && item.item !== expected) {
        problems.push({
          context: `readiness-checklist.json items[${index}] ("${item.id}").item`,
          expected,
          actual: item.item,
        });
      }
    });
  }

  const ruleLines = extractOperationalRuleLines(sourceMarkdown);
  if (ruleLines.length !== operationalRulesFile.rules.length) {
    problems.push({
      context: "operational-rules.json rule count vs. §14.2 numbered-list count",
      expected: String(ruleLines.length),
      actual: String(operationalRulesFile.rules.length),
    });
  } else {
    operationalRulesFile.rules.forEach((rule, index) => {
      const expected = ruleLines[index];
      if (expected !== undefined && rule.rule !== expected) {
        problems.push({
          context: `operational-rules.json rules[${index}] (order ${rule.order}).rule`,
          expected,
          actual: rule.rule,
        });
      }
    });
  }

  const quickPointerLine = extractQuickPointerLine(sourceMarkdown);
  const { stages, extensionCondition } = operationalRulesFile.quickPointer;
  const stagesArrow = stages.join(" -> ");
  if (!quickPointerLine.includes(stagesArrow)) {
    problems.push({
      context: "operational-rules.json quickPointer.stages (joined with ' -> ')",
      expected: `(a substring of) ${quickPointerLine}`,
      actual: stagesArrow,
    });
  }
  if (!quickPointerLine.includes(extensionCondition)) {
    problems.push({
      context: "operational-rules.json quickPointer.extensionCondition",
      expected: `(a substring of) ${quickPointerLine}`,
      actual: extensionCondition,
    });
  }

  return problems;
}

export function formatFidelityProblems(problems: readonly FidelityProblem[]): string {
  if (problems.length === 0) {
    return "check-checklist-fidelity: OK -- every readiness item, operational rule, and quick-pointer field matches docs/silabus/14-checklist-dan-aturan-operasional.md verbatim.";
  }
  const lines = problems.map(
    (problem, index) =>
      `  ${index + 1}. ${problem.context}\n     expected: ${JSON.stringify(problem.expected)}\n     actual:   ${JSON.stringify(problem.actual)}`,
  );
  return [
    `check-checklist-fidelity: FAILED -- ${problems.length} mismatch(es) found:`,
    ...lines,
  ].join("\n");
}

if (import.meta.main) {
  const [sourceMarkdown, readinessText, operationalRulesText] = await Promise.all([
    Bun.file(SOURCE_MD_PATH).text(),
    Bun.file(READINESS_JSON_PATH).text(),
    Bun.file(OPERATIONAL_RULES_JSON_PATH).text(),
  ]);

  const readinessFile = JSON.parse(readinessText) as ReadinessFile;
  const operationalRulesFile = JSON.parse(operationalRulesText) as OperationalRulesFile;

  const problems = checkFidelity(sourceMarkdown, readinessFile, operationalRulesFile);
  console.log(formatFidelityProblems(problems));
  process.exit(problems.length === 0 ? 0 : 1);
}
