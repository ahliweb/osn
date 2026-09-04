/**
 * Zod schema for a curriculum category ("kategori kurikulum") — one of the
 * four CORE/SUPPORT/EXTENSION/DE-PRIORITIZED buckets defined in §3 of the
 * syllabus corpus (`docs/silabus/03-struktur-kurikulum.md`), plus the
 * whole-file wrapper for `data/curriculum-categories.json`.
 *
 * Per the layering rules in `docs/architecture/README.md`, this module must
 * never import from `src/domain/`.
 */

import { z } from "zod";
import { nonEmptyString, syllabusSectionSchema } from "./common";

/** The four category IDs §3 defines, in table order. */
export const CATEGORY_IDS = ["core", "support", "extension", "de-prioritized"] as const;

/** The literal union of valid category IDs. */
export const categoryIdSchema = z
  .enum(CATEGORY_IDS)
  .describe(`One of the four §3 curriculum categories: ${CATEGORY_IDS.join(", ")}.`);

/**
 * A single curriculum category: a stable ID, its printed label, its
 * contents ("Isi"), and the rule governing when it may be taught
 * ("Aturan"), transcribed verbatim (in Indonesian) from the §3 table.
 */
export const categorySchema = z
  .object({
    id: categoryIdSchema,
    name: nonEmptyString.describe(
      'The category label exactly as printed in the §3 "Kategori" column, ' + 'e.g. "CORE".',
    ),
    contents: z
      .array(nonEmptyString)
      .min(1)
      .describe(
        'The contents of this category, transcribed from the §3 "Isi" ' +
          "column (one array entry per comma/semicolon-separated item in " +
          "that cell, Indonesian verbatim).",
      ),
    rule: nonEmptyString.describe(
      'The rule governing this category, verbatim from the §3 "Aturan" ' + "column.",
    ),
  })
  .describe("One of the four CORE/SUPPORT/EXTENSION/DE-PRIORITIZED categories defined by §3.");

/** The static type inferred from {@link categorySchema}. */
export type Category = z.infer<typeof categorySchema>;

/**
 * The whole `data/curriculum-categories.json` file: the four categories,
 * the §3 "Aturan dependency" callout (verbatim, at file level since it
 * governs all four categories jointly rather than any single row), plus the
 * provenance fields (`syllabusVersion`, `syllabusDate`, `sourceSection`)
 * that let the corpus carry its own versioning, per ADR-0005.
 */
export const categoriesFileSchema = z
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
      "The syllabus section the whole collection was transcribed from, " + '"§3".',
    ),
    dependencyRule: nonEmptyString.describe(
      'The §3 "Aturan dependency" callout, verbatim: advanced structures/' +
        "algorithms are never introduced merely because they are popular; " +
        "new material is only given once its prerequisite concepts, " +
        "complexity, and implementation ability are stable enough.",
    ),
    categories: z
      .array(categorySchema)
      .describe("The full set of four curriculum categories defined by §3."),
  })
  .describe(
    "The full contents of `data/curriculum-categories.json`: the four " +
      "CORE/SUPPORT/EXTENSION/DE-PRIORITIZED categories, the dependency " +
      "rule, and their corpus provenance.",
  );

/** The static type inferred from {@link categoriesFileSchema}. */
export type CategoriesFile = z.infer<typeof categoriesFileSchema>;
