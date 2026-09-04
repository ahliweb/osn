/**
 * Zod schema for an internal assessment component ("Bobot internal") -- one
 * of the five weighted components defined in §6.1 of the syllabus corpus
 * (`docs/silabus/06-evaluasi-rubrik-kpi.md`), plus the whole-file wrapper
 * for `data/assessment-weights.json`.
 *
 * Per the layering rules in `docs/architecture/README.md`, this module must
 * never import from `src/domain/`. This module owns the *definition* of the
 * five components and their fixed weights only; weighted-score computation
 * is a domain concern -- see `src/domain/assessment.ts` (issue #14).
 */

import { z } from "zod";
import { nonEmptyString, syllabusSectionSchema } from "./common";

/** The five assessment component IDs §6.1 defines, in table order. */
export const ASSESSMENT_COMPONENT_IDS = [
  "computational-thinking",
  "problem-solving",
  "implementation-correctness",
  "contest-performance",
  "upsolve-learning-process",
] as const;

/** The percentage the five §6.1 component weights must sum to exactly. */
export const TOTAL_ASSESSMENT_WEIGHT = 100;

/** The literal union of valid assessment component IDs. */
export const assessmentComponentIdSchema = z
  .enum(ASSESSMENT_COMPONENT_IDS)
  .describe(`One of the five §6.1 assessment components: ${ASSESSMENT_COMPONENT_IDS.join(", ")}.`);

/**
 * A single internal assessment component: a stable ID, its printed name,
 * its integer percent weight, and the evidence used to score it,
 * transcribed from the §6.1 table.
 */
export const assessmentComponentSchema = z
  .object({
    id: assessmentComponentIdSchema,
    name: nonEmptyString.describe(
      'This component\'s name exactly as printed in the §6.1 "Komponen" ' +
        'column, e.g. "Computational thinking & konsep".',
    ),
    weight: z
      .number()
      .int()
      .min(1)
      .max(TOTAL_ASSESSMENT_WEIGHT)
      .describe(
        "This component's weight as an integer percent, from the §6.1 " +
          '"Bobot" column (e.g. 20 for "20%"). The five components\' ' +
          "weights must sum to exactly 100 -- enforced at file level by " +
          "`assessmentWeightsFileSchema`'s `superRefine`, since no single " +
          "component can express that constraint on its own.",
      ),
    evidence: z
      .array(nonEmptyString)
      .min(1)
      .describe(
        "The evidence used to score this component, transcribed from the " +
          '§6.1 "Evidence" column (one array entry per comma-separated ' +
          "item in that cell, verbatim as printed).",
      ),
  })
  .describe("One of the five internal assessment components defined by §6.1.");

/** The static type inferred from {@link assessmentComponentSchema}. */
export type AssessmentComponent = z.infer<typeof assessmentComponentSchema>;

/**
 * The whole `data/assessment-weights.json` file: the five §6.1 assessment
 * components plus the provenance fields (`syllabusVersion`, `syllabusDate`,
 * `sourceSection`) that let the corpus carry its own versioning, per
 * ADR-0005.
 *
 * The `superRefine` below enforces the two properties no single component
 * can express on its own: the five components' `weight` values must sum to
 * exactly {@link TOTAL_ASSESSMENT_WEIGHT}, and their `id` values must be
 * pairwise distinct (so every one of the five {@link ASSESSMENT_COMPONENT_IDS}
 * is represented exactly once -- a DERIVED invariant, not stated verbatim by
 * §6.1, but required for `getComponent`/`computeWeightedScore` in
 * `src/domain/assessment.ts` to behave sensibly over this file).
 */
export const assessmentWeightsFileSchema = z
  .object({
    syllabusVersion: nonEmptyString.describe(
      "The source syllabus document's own version string this data was " +
        'transcribed from, e.g. "2.0" (see ADR-0005: dual versioning).',
    ),
    syllabusDate: nonEmptyString.describe(
      "The source syllabus document's own revision date this data was " +
        'transcribed from, e.g. "2026-09-04" (see ADR-0005: dual versioning).',
    ),
    sourceSection: syllabusSectionSchema.describe(
      "The syllabus section the whole collection was transcribed from, " + '"§6.1".',
    ),
    components: z
      .array(assessmentComponentSchema)
      .length(ASSESSMENT_COMPONENT_IDS.length)
      .describe(
        `The full set of ${ASSESSMENT_COMPONENT_IDS.length} internal assessment components defined by §6.1.`,
      ),
  })
  .superRefine((file, ctx) => {
    const sum = file.components.reduce((total, component) => total + component.weight, 0);
    if (sum !== TOTAL_ASSESSMENT_WEIGHT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["components"],
        message: `component weights must sum to exactly ${TOTAL_ASSESSMENT_WEIGHT}; got ${sum}`,
      });
    }

    const ids = file.components.map((component) => component.id);
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["components"],
        message: `component ids must be pairwise distinct; got [${ids.join(", ")}]`,
      });
    }
  })
  .describe(
    "The full contents of `data/assessment-weights.json`: the five §6.1 " +
      "internal assessment components, with their corpus provenance.",
  );

/** The static type inferred from {@link assessmentWeightsFileSchema}. */
export type AssessmentWeightsFile = z.infer<typeof assessmentWeightsFileSchema>;
