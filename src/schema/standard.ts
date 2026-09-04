/**
 * Zod schema for a single ISO/IEC standard ("Pemetaan Standar ISO/IEC")
 * defined in §11 of the syllabus corpus
 * (`docs/silabus/11-pemetaan-iso.md`), plus the whole-file wrapper for
 * `data/standards.json`.
 *
 * Per the layering rules in `docs/architecture/README.md`, this module must
 * never import from `src/domain/`.
 */

import { z } from "zod";
import { citationRefSchema, nonEmptyString, slugSchema, syllabusSectionSchema } from "./common";

/**
 * A single standard: a stable slug ID, its designation, its relevance,
 * application and the citation backing it, transcribed verbatim (relevance
 * and application in mixed English/Indonesian, exactly as printed) from the
 * §11 table.
 */
export const standardSchema = z
  .object({
    id: slugSchema.describe(
      'Stable kebab-case identifier for this standard, e.g. "iso-27001-2022".',
    ),
    designation: nonEmptyString.describe(
      "This standard's designation exactly as printed in the §11 " +
        '"Standar" column, verbatim, with the trailing citation link ' +
        'stripped, e.g. "ISO/IEC 27001:2022".',
    ),
    relevance: nonEmptyString.describe(
      'This standard\'s relevance, verbatim from the §11 "Relevansi" column.',
    ),
    application: nonEmptyString.describe(
      'This standard\'s application, verbatim from the §11 "Penerapan" column.',
    ),
    citation: citationRefSchema.describe(
      "The citation reference (R1-R41) backing this standard's row.",
    ),
  })
  .describe("One of the 14 ISO/IEC standards defined by §11.");

/** The static type inferred from {@link standardSchema}. */
export type Standard = z.infer<typeof standardSchema>;

/**
 * The whole `data/standards.json` file: the 14 standards plus the §11
 * preamble (verbatim, at file level since it governs the whole table
 * rather than any single row) and the provenance fields
 * (`syllabusVersion`, `syllabusDate`, `sourceSection`) that let the corpus
 * carry its own versioning, per ADR-0005.
 */
export const standardsFileSchema = z
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
      "The syllabus section the whole collection was transcribed from, " + '"§11".',
    ),
    preamble: nonEmptyString.describe(
      "The §11 preamble sentence, verbatim: these standards govern the " +
        "organisation's and platform's governance, not the OSN exam " +
        "material.",
    ),
    standards: z
      .array(standardSchema)
      .describe("The full set of 14 ISO/IEC standards defined by §11."),
  })
  .describe(
    "The full contents of `data/standards.json`: the 14 ISO/IEC standards " +
      "and the §11 preamble, with their corpus provenance.",
  );

/** The static type inferred from {@link standardsFileSchema}. */
export type StandardsFile = z.infer<typeof standardsFileSchema>;
