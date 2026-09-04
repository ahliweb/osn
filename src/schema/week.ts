/**
 * Zod schema for a single week of the 28-week operational syllabus (§4 of
 * the syllabus corpus, `docs/silabus/04-silabus-28-minggu.md`), plus the
 * whole-file wrapper for `data/weeks.json`.
 *
 * Per the layering rules in `docs/architecture/README.md`, this module must
 * never import from `src/domain/`.
 */

import { z } from "zod";
import { nonEmptyString, slugSchema, syllabusSectionSchema } from "./common";

/** The lowest and highest week numbers the 28-week programme defines. */
export const MIN_WEEK = 1;
export const MAX_WEEK = 28;

/**
 * The number of problems a week's practice/evaluation activity targets,
 * parsed from a "N-M soal" style entry in the "Praktik/Evaluasi" column
 * (e.g. "8-12 soal" -> `{ min: 8, max: 12 }`). `null` where that cell
 * describes a simulation or contest instead of a numeric problem count
 * (e.g. weeks 8, 12, 16, 20, 24-28).
 */
export const problemLoadSchema = z
  .object({
    min: z.number().int().positive().describe("The low end of the problem-count range."),
    max: z.number().int().positive().describe("The high end of the problem-count range."),
  })
  .refine((value) => value.min <= value.max, {
    message: "min must be less than or equal to max",
    path: ["min"],
  })
  .nullable()
  .describe(
    "The problem-count range for a week's practice/evaluation activity, " +
      'parsed from a "N-M soal" style "Praktik/Evaluasi" cell, or `null` ' +
      "where that cell describes a simulation or contest instead of a " +
      'numeric count. Per §4: "Angka soal adalah kapasitas kerja internal, ' +
      'bukan ambang resmi kelulusan" — this is internal workload guidance ' +
      "for mentors, not an official pass/fail threshold.",
  );

/**
 * A single week of the 28-week operational syllabus: its focus, main
 * content, learning outcome, and practice/evaluation activity, transcribed
 * verbatim (in Indonesian) from the corresponding row of the §4 table.
 */
export const weekSchema = z
  .object({
    week: z
      .number()
      .int()
      .min(MIN_WEEK)
      .max(MAX_WEEK)
      .describe(`The week number, ${MIN_WEEK}-${MAX_WEEK}, matching the "Mg" column of §4.`),
    focus: nonEmptyString.describe(
      'This week\'s focus, verbatim from the "Fokus" column of §4, e.g. ' +
        '"Orientasi CP & C++ dasar".',
    ),
    content: z
      .array(nonEmptyString)
      .min(1)
      .describe(
        'The main content items for this week, transcribed from the "Isi ' +
          'utama" column of §4 (one array entry per semicolon-separated ' +
          "item in that cell).",
      ),
    outcome: nonEmptyString.describe(
      'This week\'s learning outcome, verbatim from the "Capaian" column ' + "of §4.",
    ),
    practice: nonEmptyString.describe(
      "This week's practice/evaluation activity, verbatim from the " +
        '"Praktik/Evaluasi" column of §4.',
    ),
    topicFamilies: z
      .array(slugSchema)
      .min(1)
      .describe(
        "The topic-family IDs (see `src/schema/topic-family.ts`) this " +
          "week's content exercises. DERIVED, not transcribed: §4 does not " +
          "map weeks onto the §2.1 rumpun materi, so this mapping is an " +
          "editorial inference from each week's `content`, and may be " +
          "revised without a syllabus change. Every other field on this " +
          "schema is verbatim source text. Referential integrity against " +
          "the real topic-family catalogue is enforced in the domain layer " +
          "(`src/domain/curriculum.ts`), not here.",
      ),
    problemLoad: problemLoadSchema,
    hasMiniContest: z
      .boolean()
      .describe(
        'Whether this week\'s "Praktik/Evaluasi" cell names a "Mini-contest" ' +
          "(weeks 8, 16 and 20 in the current corpus).",
      ),
    checkpoint: z
      .number()
      .int()
      .min(1)
      .max(7)
      .nullable()
      .describe(
        'The checkpoint number (1-7) named as "Checkpoint N" in this ' +
          'week\'s "Praktik/Evaluasi" cell, or `null` if this week has no ' +
          "checkpoint.",
      ),
  })
  .describe("One week of the 28-week operational syllabus defined by §4.");

/** The static type inferred from {@link weekSchema}. */
export type Week = z.infer<typeof weekSchema>;

/**
 * The whole `data/weeks.json` file: all 28 weeks plus the provenance fields
 * (`syllabusVersion`, `syllabusDate`, `sourceSection`) that let the corpus
 * carry its own versioning, per ADR-0005.
 */
export const weeksSchema = z
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
      "The syllabus section the whole collection was transcribed from, " + '"§4".',
    ),
    weeks: z.array(weekSchema).describe("The full 28-week programme defined by §4."),
  })
  .describe(
    "The full contents of `data/weeks.json`: the 28-week operational " +
      "syllabus, with its corpus provenance.",
  );

/** The static type inferred from {@link weeksSchema}. */
export type WeeksFile = z.infer<typeof weeksSchema>;
