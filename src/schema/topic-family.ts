/**
 * Zod schema for a topic family ("rumpun materi") — one of the ten official
 * core curriculum families defined in §2.1 of the syllabus corpus
 * (`docs/silabus/02-arsitektur-kompetensi.md`).
 *
 * Per the layering rules in `docs/architecture/README.md`, this module must
 * never import from `src/domain/`.
 */

import { z } from "zod";
import { citationRefSchema, nonEmptyString, slugSchema, syllabusSectionSchema } from "./common";

/**
 * A single topic family: a stable ID, its Indonesian name exactly as
 * written in §2.1, its operational coverage items ("Cakupan operasional"),
 * the citations backing that coverage, and the syllabus section it was
 * transcribed from.
 */
export const topicFamilySchema = z
  .object({
    id: slugSchema.describe(
      "Stable kebab-case identifier for this topic family, referenced by " +
        "week entries and problem taxonomy elsewhere in the corpus.",
    ),
    name: nonEmptyString.describe(
      "The topic family's Indonesian name exactly as it appears in the " +
        '§2.1 "Rumpun" column, e.g. "Dasar pemrograman".',
    ),
    coverage: z
      .array(nonEmptyString)
      .min(1)
      .describe(
        "The operational coverage items for this family, transcribed from " +
          'the §2.1 "Cakupan operasional" column (one array entry per ' +
          "comma/semicolon-separated item in that cell).",
      ),
    citations: z
      .array(citationRefSchema)
      .describe("Citation references (R1-R41) supporting this family's coverage."),
    sourceSection: syllabusSectionSchema.describe(
      "The syllabus section this topic family was transcribed from, e.g. " + '"§2.1".',
    ),
  })
  .describe(
    'One of the ten official topic families ("rumpun materi resmi") ' +
      "defined in §2.1 of the syllabus corpus.",
  );

/** The static type inferred from {@link topicFamilySchema}. */
export type TopicFamily = z.infer<typeof topicFamilySchema>;

/**
 * The whole `data/topic-families.json` file: the ten topic families plus
 * the provenance fields (`syllabusVersion`, `syllabusDate`, `sourceSection`)
 * that let the corpus carry its own versioning, per ADR-0005.
 */
export const topicFamiliesSchema = z
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
      "The syllabus section the whole collection was transcribed from, " + '"§2.1".',
    ),
    topicFamilies: z
      .array(topicFamilySchema)
      .describe("The full set of topic families defined by §2.1."),
  })
  .describe(
    "The full contents of `data/topic-families.json`: the ten official " +
      "topic families, with their corpus provenance.",
  );

/** The static type inferred from {@link topicFamiliesSchema}. */
export type TopicFamiliesFile = z.infer<typeof topicFamiliesSchema>;
