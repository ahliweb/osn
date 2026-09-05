/**
 * Zod schema for a §14.1 cohort-readiness checklist item ("Checklist
 * sebelum memulai cohort") -- one of the eight items defined in §14.1 of
 * the syllabus corpus (`docs/silabus/14-checklist-dan-aturan-
 * operasional.md`), plus the whole-file wrapper for
 * `data/readiness-checklist.json`.
 *
 * §14.1 states each item as a single bulleted instruction with no
 * accompanying "how do you know this is done" text of its own --
 * `verificationMethod` and `evidenceRequired` are therefore DERIVED for
 * every item here (not verbatim source text), grounded against the same
 * pattern `src/schema/assessment-bank.ts` documents for its own `purpose`
 * field: each is a concrete, checkable procedure a mentor lead can actually
 * run before a cohort starts, and a concrete artefact a mentor records as
 * proof it ran. `item` itself is the one field transcribed verbatim
 * (Indonesian) from the §14.1 bullet.
 *
 * Per the layering rules in `docs/architecture/README.md`, this module must
 * never import from `src/domain/`.
 */

import { z } from "zod";
import { nonEmptyString, slugSchema, syllabusSectionSchema } from "./common";

/** The number of §14.1 readiness-checklist items. */
export const READINESS_ITEM_COUNT = 8;

/**
 * A single §14.1 readiness-checklist item: a stable slug id, the item's
 * instruction verbatim (Indonesian) from the §14.1 bullet list, how it is
 * verified before a cohort starts, and what a mentor records as evidence
 * that it was done.
 */
export const readinessChecklistItemSchema = z
  .object({
    id: slugSchema.describe(
      'Stable kebab-case identifier for this item, e.g. "verify-official-syllabus".',
    ),
    item: nonEmptyString.describe(
      "This item's instruction, verbatim (Indonesian) from the matching " +
        '§14.1 bullet, e.g. "Verifikasi silabus resmi OSN dan halaman ' +
        'OSN-K/OSN-P terbaru."',
    ),
    verificationMethod: nonEmptyString.describe(
      "How this item is confirmed before a cohort starts. DERIVED -- §14.1 " +
        "states the requirement but not a verification procedure; see this " +
        "module's docblock.",
    ),
    evidenceRequired: nonEmptyString.describe(
      "The concrete artefact a mentor records as proof this item was done " +
        "(e.g. a sign-off, a generated report, a dated log entry). " +
        "DERIVED -- see this module's docblock.",
    ),
  })
  .strict()
  .describe("One of the eight §14.1 cohort-readiness checklist items.");

/** The static type inferred from {@link readinessChecklistItemSchema}. */
export type ReadinessChecklistItem = z.infer<typeof readinessChecklistItemSchema>;

/**
 * The whole `data/readiness-checklist.json` file: the eight §14.1
 * readiness-checklist items, plus the provenance fields (`syllabusVersion`,
 * `syllabusDate`, `sourceSection`) that let the corpus carry its own
 * versioning, per ADR-0005.
 *
 * The `superRefine` below enforces the one property no single item can
 * express on its own: every item's `id` must be unique -- the same
 * discipline `mentorSopFileSchema` (`src/schema/mentor-sop.ts`) applies to
 * its own ordered set, adapted here to an id-uniqueness check since §14.1's
 * items have no inherent numeric ordering of their own (they are always
 * rendered in the fixed array order the file carries, per this module's
 * "stable ordering" requirement).
 */
export const readinessChecklistFileSchema = z
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
      "The syllabus section the whole collection was transcribed from, " + '"§14.1".',
    ),
    items: z
      .array(readinessChecklistItemSchema)
      .length(READINESS_ITEM_COUNT)
      .describe(
        `The full set of ${READINESS_ITEM_COUNT} readiness-checklist items defined by §14.1.`,
      ),
  })
  .superRefine((file, ctx) => {
    const ids = file.items.map((item) => item.id);
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items"],
        message: `every item's id must be unique; got [${ids.join(", ")}]`,
      });
    }
  })
  .describe(
    "The full contents of `data/readiness-checklist.json`: the eight §14.1 " +
      "cohort-readiness checklist items, with their corpus provenance.",
  );

/** The static type inferred from {@link readinessChecklistFileSchema}. */
export type ReadinessChecklistFile = z.infer<typeof readinessChecklistFileSchema>;
