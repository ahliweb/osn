/**
 * Zod schema for the §12 "Sumber Belajar dan Pustaka" mentor source
 * ordering (§12.1), primary books (§12.2) and practice platforms (§12.3) of
 * the syllabus corpus (`docs/silabus/12-sumber-belajar.md`), plus the
 * whole-file wrapper for `data/source-priority.json`.
 *
 * Per the layering rules in `docs/architecture/README.md`, this module must
 * never import from `src/domain/`.
 */

import { z } from "zod";
import { citationRefSchema, nonEmptyString, syllabusSectionSchema } from "./common";

/** The lowest and highest priority ranks §12.1 defines. */
export const MIN_SOURCE_PRIORITY = 1;
export const MAX_SOURCE_PRIORITY = 5;

/**
 * A single §12.1 mentor source-priority row: its rank, the source it names,
 * its usage note, and the citations backing that row.
 */
export const sourcePriorityEntrySchema = z
  .object({
    priority: z
      .number()
      .int()
      .min(MIN_SOURCE_PRIORITY)
      .max(MAX_SOURCE_PRIORITY)
      .describe(
        `This row's rank, ${MIN_SOURCE_PRIORITY}-${MAX_SOURCE_PRIORITY}, matching the §12.1 "Prioritas" column (1 = highest priority).`,
      ),
    source: nonEmptyString.describe(
      'This row\'s source, verbatim from the §12.1 "Sumber" column, e.g. ' +
        '"Silabus OSN Informatika 2026".',
    ),
    usage: nonEmptyString.describe(
      'This row\'s usage note, verbatim from the §12.1 "Pemakaian" column, ' +
        "with the trailing citation link(s) stripped.",
    ),
    citations: z
      .array(citationRefSchema)
      .min(1)
      .describe(
        "Citation references (R1-R41) present in this row's usage note. " +
          'Where §12.1 states a range (e.g. "[[R36]]-[[R41]]"), every ' +
          "citation in that range is listed individually.",
      ),
  })
  .describe("One of the five §12.1 mentor source-priority rows.");

/** The static type inferred from {@link sourcePriorityEntrySchema}. */
export type SourcePriorityEntry = z.infer<typeof sourcePriorityEntrySchema>;

/**
 * A single §12.2 primary book: its title, its usage note, and the citation
 * backing it.
 */
export const primaryBookSchema = z
  .object({
    title: nonEmptyString.describe(
      "This book's title (with author prefix), verbatim from its §12.2 " +
        'bullet, up to the " - " usage-note separator.',
    ),
    usage: nonEmptyString.describe(
      "This book's usage note, verbatim from its §12.2 bullet, after the " +
        '" - " separator, with the trailing citation link stripped.',
    ),
    citation: citationRefSchema.describe(
      "The citation reference (R1-R41) backing this book's bullet.",
    ),
  })
  .describe("One of the three §12.2 primary books.");

/** The static type inferred from {@link primaryBookSchema}. */
export type PrimaryBook = z.infer<typeof primaryBookSchema>;

/**
 * A single §12.3 practice platform: its name and usage note. §12.3's
 * bullets carry no citation markers in the source, so this schema has no
 * `citation` field -- none should be invented.
 */
export const practicePlatformSchema = z
  .object({
    name: nonEmptyString.describe(
      "This platform's name, verbatim from its §12.3 bullet, up to the " + '" - " separator.',
    ),
    usage: nonEmptyString.describe(
      "This platform's usage note, verbatim from its §12.3 bullet, after " + 'the " - " separator.',
    ),
  })
  .describe("One of the five §12.3 practice platforms.");

/** The static type inferred from {@link practicePlatformSchema}. */
export type PracticePlatform = z.infer<typeof practicePlatformSchema>;

/**
 * The whole `data/source-priority.json` file: the five §12.1 source-priority
 * rows, the three §12.2 primary books, the five §12.3 practice platforms,
 * plus the provenance fields (`syllabusVersion`, `syllabusDate`,
 * `sourceSection`) that let the corpus carry its own versioning, per
 * ADR-0005.
 */
export const sourcePriorityFileSchema = z
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
      "The syllabus section the whole collection was transcribed from, " + '"§12".',
    ),
    priorities: z
      .array(sourcePriorityEntrySchema)
      .describe("The full set of five §12.1 mentor source-priority rows."),
    books: z.array(primaryBookSchema).describe("The full set of three §12.2 primary books."),
    platforms: z
      .array(practicePlatformSchema)
      .describe("The full set of five §12.3 practice platforms."),
  })
  .describe(
    "The full contents of `data/source-priority.json`: the §12.1 mentor " +
      "source-priority ordering, the §12.2 primary books and the §12.3 " +
      "practice platforms, with their corpus provenance.",
  );

/** The static type inferred from {@link sourcePriorityFileSchema}. */
export type SourcePriorityFile = z.infer<typeof sourcePriorityFileSchema>;
