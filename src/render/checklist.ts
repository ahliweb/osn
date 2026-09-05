/**
 * `renderChecklist` -- a pure function producing the `osn checklist`
 * Markdown artefact (issue #25): the corpus version, the latest §14.2
 * rule 8 syllabus-check status, the eight §14.1 cohort-readiness checklist
 * items, the eight §14.2 operational rules, and the §14.2 mentor
 * quick-pointer callout. All sourced from `src/domain/operations.ts`.
 * Follows the same style as `src/render/weekly.ts`/`src/render/sop.ts`.
 *
 * **Pure, given `asOf`**: no file I/O, no `process` access, no randomness
 * -- identical `asOf` always produces byte-identical output. Unlike
 * `renderSopCard` (which takes no parameters at all because it has no
 * date-dependent content), this renderer's "days since last syllabus
 * check" line is necessarily relative to *some* current date -- so, exactly
 * as `src/domain/cohort-plan.ts`'s `buildCohortPlan` takes its dates as
 * explicit input rather than calling `new Date()` itself, this renderer
 * takes `asOf` as an explicit parameter. The CLI layer
 * (`src/cli/commands/checklist.ts`) is the one place that actually reads
 * the wall clock; this module never does.
 */

import {
  daysSinceLastSyllabusCheck,
  latestSyllabusCheck,
  listOperationalRules,
  listReadinessItems,
  operationsCorpusVersion,
  quickPointer,
} from "../domain/operations";
import { escapeCell } from "./markdown-utils";

/** Renders the §14.1 readiness checklist as a numbered list with verification method and evidence for each item. */
function renderReadinessSection(): string[] {
  const lines: string[] = ["## Cohort readiness checklist (§14.1)", ""];
  listReadinessItems().forEach((item, index) => {
    lines.push(`${index + 1}. **${escapeCell(item.item)}** (\`${item.id}\`)`);
    lines.push(`   - Verification: ${item.verificationMethod}`);
    lines.push(`   - Evidence required: ${item.evidenceRequired}`);
  });
  return lines;
}

/** Renders the eight §14.2 operational rules as a numbered list, in `order`. */
function renderOperationalRulesSection(): string[] {
  const lines: string[] = ["## Operational rules (§14.2)", ""];
  for (const rule of listOperationalRules()) {
    lines.push(`${rule.order}. ${rule.rule}`);
  }
  return lines;
}

/** Renders the §14.2 mentor quick-pointer callout: the ten ordered stages and the closing extension condition. */
function renderQuickPointerSection(): string[] {
  const pointer = quickPointer();
  return [
    "## Mentor quick pointer (§14.2 callout)",
    "",
    pointer.stages.join(" -> "),
    "",
    pointer.extensionCondition,
  ];
}

/** Renders the latest §14.2 rule 8 syllabus-check status: its date, outcome, and days since (relative to `asOf`). */
function renderSyllabusCheckSection(asOf: Date): string[] {
  const latest = latestSyllabusCheck();
  const daysSince = daysSinceLastSyllabusCheck(asOf);
  const asOfIso = asOf.toISOString().slice(0, 10);

  return [
    "## Syllabus-check status (§14.2 rule 8)",
    "",
    `Latest check: ${latest.checkedOn} -- outcome: ${latest.outcome}.`,
    `Sources checked: ${latest.sources.join(", ")}.`,
    `Days since last check (as of ${asOfIso}): ${daysSince}.`,
  ];
}

/**
 * Renders the full `osn checklist` Markdown artefact: the corpus version,
 * the latest syllabus-check status (date, outcome, sources, and days since
 * -- computed relative to `asOf`), the eight §14.1 readiness-checklist
 * items (each with its verification method and required evidence), the
 * eight §14.2 operational rules in order, and the §14.2 mentor
 * quick-pointer callout (its ten ordered stages and closing extension
 * condition).
 */
export function renderChecklist(asOf: Date): string {
  const version = operationsCorpusVersion();

  const lines: string[] = [];
  lines.push("# osn checklist: cohort readiness & operational rules");
  lines.push("");
  lines.push(`Corpus version: ${version.syllabusVersion} (${version.syllabusDate})`);
  lines.push("");

  lines.push(...renderSyllabusCheckSection(asOf));
  lines.push("");

  lines.push(...renderReadinessSection());
  lines.push("");

  lines.push(...renderOperationalRulesSection());
  lines.push("");

  lines.push(...renderQuickPointerSection());

  return lines.join("\n");
}
