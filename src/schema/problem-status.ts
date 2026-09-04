/**
 * Zod schema for a problem-completion status code ("Status penyelesaian
 * soal") -- one of the four A/B/C/D statuses defined in §6.2 of the
 * syllabus corpus (`docs/silabus/06-evaluasi-rubrik-kpi.md`), plus the
 * whole-file wrapper for `data/problem-status.json`.
 *
 * Per the layering rules in `docs/architecture/README.md`, this module must
 * never import from `src/domain/`. This module owns the *definition* of the
 * four statuses and their prescribed follow-ups only; re-solve *scheduling*
 * (the §6.2 3-7 day window for B, C's mandatory reimplementation, D's gap
 * diagnosis) is a domain concern -- see `src/domain/assessment.ts` (issue
 * #14).
 */

import { z } from "zod";
import { nonEmptyString, syllabusSectionSchema } from "./common";

/** The four problem-completion status codes §6.2 defines, in table order. */
export const PROBLEM_STATUS_CODES = ["A", "B", "C", "D"] as const;

/** The literal union of valid problem-completion status codes. */
export const problemStatusCodeSchema = z
  .enum(PROBLEM_STATUS_CODES)
  .describe(
    `One of the four §6.2 problem-completion status codes: ${PROBLEM_STATUS_CODES.join(", ")}.`,
  );

/**
 * A single problem-completion status: its code, its meaning, and its
 * prescribed follow-up, transcribed from the §6.2 table.
 */
export const problemStatusSchema = z
  .object({
    code: problemStatusCodeSchema,
    meaning: nonEmptyString.describe(
      'This status\'s meaning exactly as printed in the §6.2 "Makna" ' +
        'column, e.g. "Solved independently".',
    ),
    followUp: nonEmptyString.describe(
      "This status's prescribed follow-up, verbatim (Indonesian) from " +
        'the §6.2 "Tindak lanjut" column.',
    ),
  })
  .describe("One of the four problem-completion status codes defined by §6.2.");

/** The static type inferred from {@link problemStatusSchema}. */
export type ProblemStatus = z.infer<typeof problemStatusSchema>;

/**
 * The whole `data/problem-status.json` file: the four §6.2 problem-completion
 * statuses plus the provenance fields (`syllabusVersion`, `syllabusDate`,
 * `sourceSection`) that let the corpus carry its own versioning, per
 * ADR-0005.
 *
 * The `superRefine` below enforces the one property no single status can
 * express on its own: taken together, the file's statuses must be exactly
 * the four codes A, B, C, D, each appearing exactly once (no duplicates, no
 * missing code, no fifth code).
 */
export const problemStatusFileSchema = z
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
      "The syllabus section the whole collection was transcribed from, " + '"§6.2".',
    ),
    statuses: z
      .array(problemStatusSchema)
      .describe(
        `The full set of ${PROBLEM_STATUS_CODES.length} problem-completion status codes defined by §6.2.`,
      ),
  })
  .superRefine((file, ctx) => {
    const codes = file.statuses.map((status) => status.code);
    const uniqueCodes = new Set(codes);
    const expectedCodes = new Set<string>(PROBLEM_STATUS_CODES);
    const isExactlyTheFourCodes =
      codes.length === PROBLEM_STATUS_CODES.length &&
      uniqueCodes.size === codes.length &&
      [...uniqueCodes].every((code) => expectedCodes.has(code));

    if (!isExactlyTheFourCodes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["statuses"],
        message:
          `statuses must contain exactly the four codes ${PROBLEM_STATUS_CODES.join(", ")}, ` +
          `each once, with no duplicates and no other codes; got [${codes.join(", ")}]`,
      });
    }
  })
  .describe(
    "The full contents of `data/problem-status.json`: the four A/B/C/D " +
      "problem-completion status codes defined by §6.2, with their corpus " +
      "provenance.",
  );

/** The static type inferred from {@link problemStatusFileSchema}. */
export type ProblemStatusFile = z.infer<typeof problemStatusFileSchema>;
