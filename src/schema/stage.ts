/**
 * Zod schema for a competition stage ("tahap kompetisi") — one of the four
 * OSN-K/OSN-P/OSN Nasional/TOKI-IOI-extension stages defined in §2.2 of the
 * syllabus corpus (`docs/silabus/02-arsitektur-kompetensi.md`), plus the
 * whole-file wrapper for `data/competition-stages.json`.
 *
 * Per the layering rules in `docs/architecture/README.md`, this module must
 * never import from `src/domain/`.
 */

import { z } from "zod";
import { citationRefSchema, nonEmptyString, syllabusSectionSchema } from "./common";

/** The four stage IDs §2.2 defines, in table order. */
export const STAGE_IDS = ["osn-k", "osn-p", "osn-nasional", "toki-ioi-extension"] as const;

/** The literal union of valid stage IDs. */
export const stageIdSchema = z
  .enum(STAGE_IDS)
  .describe(`One of the four §2.2 competition stages: ${STAGE_IDS.join(", ")}.`);

/**
 * The contest format for a stage that sits a fixed problem-set exam (OSN-K):
 * a range of item counts and a total duration.
 */
const problemSetFormatSchema = z.object({
  kind: z.literal("problem-set").describe("Discriminant: this is a problem-set contest format."),
  minItems: z
    .number()
    .int()
    .positive()
    .describe("The low end of the problem-count range, e.g. 30 for OSN-K's 30-50 soal."),
  maxItems: z
    .number()
    .int()
    .positive()
    .describe("The high end of the problem-count range, e.g. 50 for OSN-K's 30-50 soal."),
  durationMinutes: z
    .number()
    .int()
    .positive()
    .describe("The total contest duration in minutes, e.g. 150 for OSN-K's 2,5 jam."),
});

/**
 * The contest format for a stage built on case studies (OSN-P): a range of
 * case counts, a total duration, and the fixed comprehension/programming
 * task shape within each case.
 */
const caseStudyFormatSchema = z.object({
  kind: z.literal("case-study").describe("Discriminant: this is a case-study contest format."),
  minItems: z
    .number()
    .int()
    .positive()
    .describe("The low end of the case-study count range, e.g. 5 for OSN-P's 5-8 studi kasus."),
  maxItems: z
    .number()
    .int()
    .positive()
    .describe("The high end of the case-study count range, e.g. 8 for OSN-P's 5-8 studi kasus."),
  durationMinutes: z
    .number()
    .int()
    .positive()
    .describe("The total contest duration in minutes, e.g. 180 for OSN-P's 3 jam."),
  comprehensionPerCase: z
    .number()
    .int()
    .positive()
    .describe('The number of "soal pemahaman" (comprehension tasks) each case carries, e.g. 3.'),
  programmingPerCase: z
    .number()
    .int()
    .positive()
    .describe(
      'The number of "soal pemrograman" (programming tasks, with easy/hard subtasks) each ' +
        "case carries, e.g. 1.",
    ),
});

/**
 * A stage's structured contest format, or `null` where §2.2 gives that
 * stage no numeric format (OSN Nasional, TOKI/IOI extension). Refined so
 * `minItems <= maxItems` on whichever variant applies.
 */
export const contestFormatSchema = z
  .discriminatedUnion("kind", [problemSetFormatSchema, caseStudyFormatSchema])
  .refine((value) => value.minItems <= value.maxItems, {
    message: "minItems must be less than or equal to maxItems",
    path: ["minItems"],
  })
  .nullable()
  .describe(
    "This stage's structured contest format: a problem-set shape (OSN-K), " +
      "a case-study shape (OSN-P), or `null` where §2.2 gives no numeric " +
      "format (OSN Nasional, TOKI/IOI extension).",
  );

/** The static type inferred from {@link contestFormatSchema}. */
export type ContestFormat = z.infer<typeof contestFormatSchema>;

/**
 * A single competition stage: a stable ID, its printed label, its dominant
 * competencies and practice model, the citations backing that row, and its
 * structured contest format, transcribed from the §2.2 table.
 */
export const stageSchema = z
  .object({
    id: stageIdSchema,
    name: nonEmptyString.describe(
      'The stage label exactly as printed in the §2.2 "Tahap" column, e.g. ' + '"OSN-K".',
    ),
    dominantCompetencies: z
      .array(nonEmptyString)
      .min(1)
      .describe(
        "The dominant competencies for this stage, transcribed from the " +
          '§2.2 "Dominan kompetensi" column (one array entry per ' +
          "comma/semicolon-separated item in that cell, excluding the " +
          "citation link, Indonesian verbatim).",
      ),
    practiceModel: z
      .array(nonEmptyString)
      .min(1)
      .describe(
        "The practice model for this stage, transcribed from the §2.2 " +
          '"Model latihan" column (one array entry per comma-separated ' +
          "item in that cell, Indonesian verbatim).",
      ),
    citations: z
      .array(citationRefSchema)
      .describe(
        "Citation references (R1-R41) actually present in this stage's " +
          "row. Empty for stages whose row carries no citation link — " +
          "never invented.",
      ),
    contestFormat: contestFormatSchema,
  })
  .describe("One of the four competition stages defined by §2.2.");

/** The static type inferred from {@link stageSchema}. */
export type Stage = z.infer<typeof stageSchema>;

/**
 * The whole `data/competition-stages.json` file: the four competition
 * stages plus the provenance fields (`syllabusVersion`, `syllabusDate`,
 * `sourceSection`) that let the corpus carry its own versioning, per
 * ADR-0005.
 */
export const stagesFileSchema = z
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
      "The syllabus section the whole collection was transcribed from, " + '"§2.2".',
    ),
    stages: z
      .array(stageSchema)
      .describe("The full set of four competition stages defined by §2.2."),
  })
  .describe(
    "The full contents of `data/competition-stages.json`: the four " +
      "competition stages, with their corpus provenance.",
  );

/** The static type inferred from {@link stagesFileSchema}. */
export type StagesFile = z.infer<typeof stagesFileSchema>;
