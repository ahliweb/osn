/**
 * Zod schema for a single citation reference (R1-R41) into the "Daftar
 * Referensi" of `docs/silabus/99-referensi.md`, plus the whole-file wrapper
 * for `data/references.json`.
 *
 * Per the layering rules in `docs/architecture/README.md`, this module must
 * never import from `src/domain/`.
 */

import { z } from "zod";
import { citationRefSchema, nonEmptyString, syllabusSectionSchema } from "./common";

/**
 * The eight kinds of source a §99 reference may be. Classified by editorial
 * judgement against each entry's own text (see issue #12's report for the
 * per-reference rationale) rather than transcribed from any single labelled
 * column, since §99 lists references as plain numbered entries with no
 * "kind" column of its own.
 */
export const REFERENCE_KINDS = [
  "official-syllabus",
  "archive",
  "journal",
  "law",
  "standard",
  "book",
  "platform",
  "historical",
] as const;

/** The literal union of valid reference kinds. */
export const referenceKindSchema = z
  .enum(REFERENCE_KINDS)
  .describe(`One of the kinds a §99 reference falls into: ${REFERENCE_KINDS.join(", ")}.`);

/** The static type inferred from {@link referenceKindSchema}. */
export type ReferenceKind = z.infer<typeof referenceKindSchema>;

/**
 * A syntactically valid URL restricted to the `https:` scheme. Only syntax
 * and scheme are checked -- no network request is ever made to confirm the
 * URL resolves, per issue #12's implementation notes ("Do not perform
 * network requests in tests").
 */
export const httpsUrlSchema = z
  .url()
  .refine(
    (value) => {
      try {
        return new URL(value).protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "must be an https:// URL" },
  )
  .describe(
    "A syntactically valid URL using the https:// scheme. Never fetched -- " +
      "syntax and scheme are the only checks performed.",
  );

/**
 * A single reference: its stable R-id, its kind, and its bibliographic
 * fields transcribed verbatim from its numbered entry in the §99 "Daftar
 * Referensi".
 */
export const referenceSchema = z
  .object({
    id: citationRefSchema,
    kind: referenceKindSchema,
    title: nonEmptyString.describe(
      "This reference's title, transcribed verbatim from its entry in the " +
        '§99 "Daftar Referensi" (the descriptive text between the ' +
        "author/organisation prefix, if any, and the trailing URL).",
    ),
    authors: nonEmptyString
      .nullable()
      .describe(
        "This reference's stated author(s) or authoring organisation, " +
          "verbatim, or `null` where the §99 entry states none.",
      ),
    year: z
      .number()
      .int()
      .nullable()
      .describe(
        "This reference's stated year, extracted only where §99 states " +
          "one in an unambiguous bibliographic form: a parenthetical " +
          '"(YYYY)" after the author(s) (journal entries), a "Tahun YYYY" ' +
          "Indonesian legal citation (law entries), or a standard's own " +
          '"designation:YYYY" edition marker (standard entries). `null` ' +
          "everywhere else, even where a year-like number appears elsewhere " +
          'in the title (e.g. as part of a proper noun such as "Silabus ' +
          'OSN Informatika 2026") -- extracting that would require guessing ' +
          "which number is the bibliographic year.",
      ),
    url: httpsUrlSchema,
    notes: nonEmptyString
      .nullable()
      .describe(
        "Any additional note about this reference not captured by the " +
          "other fields. `null` for all 41 current references -- §99's " +
          "entries transcribe cleanly into title/authors/year/url without " +
          "requiring an extra note.",
      ),
  })
  .describe("One of the 41 references (R1-R41) defined by §99.");

/** The static type inferred from {@link referenceSchema}. */
export type Reference = z.infer<typeof referenceSchema>;

/**
 * The whole `data/references.json` file: all 41 references plus the
 * provenance fields (`syllabusVersion`, `syllabusDate`, `sourceSection`)
 * that let the corpus carry its own versioning, per ADR-0005.
 */
export const referencesFileSchema = z
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
      "The syllabus section the whole collection was transcribed from, " + '"§99".',
    ),
    references: z
      .array(referenceSchema)
      .describe("The full set of 41 references (R1-R41) defined by §99."),
  })
  .describe(
    "The full contents of `data/references.json`: all 41 references, with " +
      "their corpus provenance.",
  );

/** The static type inferred from {@link referencesFileSchema}. */
export type ReferencesFile = z.infer<typeof referencesFileSchema>;
