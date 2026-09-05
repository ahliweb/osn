/**
 * Formats the `osn checklist` artefact for its two output modes: a
 * human-readable Markdown card (`renderChecklist`, `src/render/checklist.ts`
 * -- the default) and `--format json` (a stable, machine-readable shape
 * assembled from the same `src/domain/operations.ts` loaders), mirroring
 * `src/cli/format-report.ts`'s/`format-plan.ts`'s split for their own
 * commands.
 */

import {
  daysSinceLastSyllabusCheck,
  latestSyllabusCheck,
  listOperationalRules,
  listReadinessItems,
  listSyllabusChecks,
  operationsCorpusVersion,
  quickPointer,
} from "../domain/operations";
import type { OperationalRule, QuickPointer } from "../schema/operational-rules";
import type { ReadinessChecklistItem } from "../schema/readiness-checklist";
import type { SyllabusCheckEntry } from "../schema/syllabus-check";

/** The `--format json` shape for `osn checklist`: every field `renderChecklist` renders, plus the full syllabus-check log (not just the latest entry) for machine consumers that want the whole history. */
export interface ChecklistJson {
  readonly corpusVersion: { readonly syllabusVersion: string; readonly syllabusDate: string };
  readonly asOf: string;
  readonly syllabusCheck: {
    readonly latest: SyllabusCheckEntry;
    readonly daysSinceLastCheck: number;
    readonly log: readonly SyllabusCheckEntry[];
  };
  readonly readinessItems: readonly ReadinessChecklistItem[];
  readonly operationalRules: readonly OperationalRule[];
  readonly quickPointer: QuickPointer;
}

/** Assembles the `--format json` payload for `osn checklist`, relative to `asOf` (see `src/render/checklist.ts`'s docblock for why this is an explicit parameter rather than an internal `new Date()`). */
export function buildChecklistJson(asOf: Date): ChecklistJson {
  return {
    corpusVersion: operationsCorpusVersion(),
    asOf: asOf.toISOString().slice(0, 10),
    syllabusCheck: {
      latest: latestSyllabusCheck(),
      daysSinceLastCheck: daysSinceLastSyllabusCheck(asOf),
      log: listSyllabusChecks(),
    },
    readinessItems: listReadinessItems(),
    operationalRules: listOperationalRules(),
    quickPointer: quickPointer(),
  };
}

/** Renders `osn checklist --format json`'s output: {@link buildChecklistJson}'s result, pretty-printed. */
export function formatChecklistJson(asOf: Date): string {
  return JSON.stringify(buildChecklistJson(asOf), null, 2);
}
