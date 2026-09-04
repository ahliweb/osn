/**
 * Zod schema for a single Indonesian regulation ("Regulasi Indonesia yang
 * Relevan") defined in §10 of the syllabus corpus
 * (`docs/silabus/10-regulasi-indonesia.md`), plus the whole-file wrapper for
 * `data/regulations.json`.
 *
 * Per the layering rules in `docs/architecture/README.md`, this module must
 * never import from `src/domain/`.
 */

import { z } from "zod";
import { citationRefSchema, nonEmptyString, slugSchema, syllabusSectionSchema } from "./common";

/**
 * A single regulation: a stable slug ID, its printed title, its practical
 * relevance, and the citation backing it, transcribed verbatim (in
 * Indonesian) from the §10 table.
 */
export const regulationSchema = z
  .object({
    id: slugSchema.describe('Stable kebab-case identifier for this regulation, e.g. "uu-20-2003".'),
    title: nonEmptyString.describe(
      'This regulation\'s title exactly as printed in the §10 "Regulasi" ' +
        "column, verbatim, with the trailing citation link stripped.",
    ),
    relevance: nonEmptyString.describe(
      "This regulation's practical relevance, verbatim from the §10 " +
        '"Relevansi praktis" column.',
    ),
    citation: citationRefSchema.describe(
      "The citation reference (R1-R41) backing this regulation's row.",
    ),
  })
  .describe("One of the seven Indonesian regulations defined by §10.");

/** The static type inferred from {@link regulationSchema}. */
export type Regulation = z.infer<typeof regulationSchema>;

/**
 * The whole `data/regulations.json` file: the seven regulations, the §10
 * preamble sentence and "Data peserta di bawah umur" callout (verbatim, at
 * file level since both govern the whole table rather than any single row),
 * plus the provenance fields (`syllabusVersion`, `syllabusDate`,
 * `sourceSection`) that let the corpus carry its own versioning, per
 * ADR-0005.
 */
export const regulationsFileSchema = z
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
      "The syllabus section the whole collection was transcribed from, " + '"§10".',
    ),
    preamble: nonEmptyString.describe(
      "The §10 preamble sentence, verbatim: these regulations do not " +
        "determine the OSN algorithm list, but are relevant to running the " +
        "education programme, talent management, the digital platform, and " +
        "participant data protection.",
    ),
    minorParticipantsCallout: nonEmptyString.describe(
      'The §10 "Data peserta di bawah umur" callout, verbatim (heading and ' +
        'body joined by " - ", Markdown bold markers stripped): data ' +
        "minimisation, role-based access, access logs, limited retention, " +
        "account security, context-appropriate consent/authorisation, and " +
        "an easy-to-understand privacy policy for underage participants.",
    ),
    regulations: z
      .array(regulationSchema)
      .describe("The full set of seven Indonesian regulations defined by §10."),
  })
  .describe(
    "The full contents of `data/regulations.json`: the seven Indonesian " +
      "regulations, the §10 preamble and minor-participants callout, with " +
      "their corpus provenance.",
  );

/** The static type inferred from {@link regulationsFileSchema}. */
export type RegulationsFile = z.infer<typeof regulationsFileSchema>;
