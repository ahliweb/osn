/**
 * Zod schema for a syllabus-check log entry -- the mandatory-before-every-
 * cohort-cycle check against official OSN/IOI sources required by §14.2
 * rule 8 ("Setiap versi silabus harus memiliki tanggal, changelog, dan
 * syllabus check.") and restated by the "Catatan Penutup" closing note of
 * `docs/silabus/99-referensi.md` ("Sebelum setiap siklus pembinaan, Tim
 * Riset AhliKoding.com dari AhliWeb.com perlu melakukan syllabus check
 * terhadap sumber resmi OSN/IOI...") -- plus the whole-file wrapper for
 * `data/syllabus-check-log.json`.
 *
 * Per the layering rules in `docs/architecture/README.md`, this module must
 * never import from `src/domain/`. It reuses {@link citationRefSchema} from
 * `src/schema/common.ts` for `sources`, so a syllabus check's cited sources
 * are always real, resolvable §99 references (R1-R41) -- never a free-text
 * source name that could silently drift from the reference register.
 */

import { z } from "zod";
import { citationRefSchema, nonEmptyString } from "./common";

/** Strict `YYYY-MM-DD` shape. Calendar-date validity (e.g. rejecting `2026-02-30`) is a domain concern, not enforced at the schema level -- see `src/domain/operations.ts`. */
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** A date a syllabus check was performed on, as a strict ISO `YYYY-MM-DD` string. */
export const isoDateSchema = z
  .string()
  .regex(ISO_DATE_PATTERN, 'must be an ISO "YYYY-MM-DD" date string')
  .describe('An ISO "YYYY-MM-DD" date string, e.g. "2026-09-05".');

/** The two possible outcomes of a syllabus check. */
export const SYLLABUS_CHECK_OUTCOMES = ["no-change", "change-detected"] as const;

/** The literal union of valid syllabus-check outcomes. */
export const syllabusCheckOutcomeSchema = z
  .enum(SYLLABUS_CHECK_OUTCOMES)
  .describe(
    'This check\'s outcome: "no-change" (the official sources still match this corpus) or ' +
      '"change-detected" (an official source has moved, requiring a curriculum-change issue -- ' +
      "see docs/operations/syllabus-check.md).",
  );

/** The static type inferred from {@link syllabusCheckOutcomeSchema}. */
export type SyllabusCheckOutcome = z.infer<typeof syllabusCheckOutcomeSchema>;

/**
 * A single syllabus-check log entry: when it was performed, which official
 * sources were checked (§99 citation refs -- in practice R1/R2/R3 for OSN
 * and R7/R8 for IOI, per `docs/operations/syllabus-check.md`), its outcome,
 * a free-text note recording exactly what was and was not done, and any
 * `curriculum-change` issue(s) a `change-detected` outcome produced (empty
 * for `no-change`).
 */
export const syllabusCheckEntrySchema = z
  .object({
    checkedOn: isoDateSchema.describe("The date this syllabus check was performed."),
    sources: z
      .array(citationRefSchema)
      .min(1)
      .describe(
        "The official sources checked, as §99 citation refs (R1-R41). Must be non-empty -- a " +
          "syllabus check with no named source checked is not a real check.",
      ),
    outcome: syllabusCheckOutcomeSchema,
    notes: nonEmptyString.describe(
      "A free-text record of exactly what was checked and how, and -- critically -- what was " +
        "NOT done (e.g. no live network check was performed, if that is true). Never overstates " +
        "what actually happened.",
    ),
    resultingIssues: z
      .array(nonEmptyString)
      .describe(
        'Every `curriculum-change` issue this check produced (e.g. "#42"), in the order they ' +
          "were filed. Empty for a `no-change` outcome, or for a `change-detected` outcome whose " +
          "issue has not been filed yet.",
      ),
  })
  .strict()
  .describe("One syllabus-check log entry (§14.2 rule 8 / the Catatan Penutup requirement).");

/** The static type inferred from {@link syllabusCheckEntrySchema}. */
export type SyllabusCheckEntry = z.infer<typeof syllabusCheckEntrySchema>;

/**
 * The whole `data/syllabus-check-log.json` file: the dated log of syllabus
 * checks (append-only in intent; never rewritten in place), plus the
 * provenance fields (`syllabusVersion`, `syllabusDate`) that let the corpus
 * carry its own versioning, per ADR-0005. There is no single §-numbered
 * source section for this file (the requirement spans §14.2 rule 8 and the
 * unnumbered "Catatan Penutup" of `docs/silabus/99-referensi.md`), so
 * `sourceSection` here is fixed to `"§14.2"` (the rule that names the
 * three mandatory artefacts: a date, a changelog, and a syllabus check).
 *
 * `checks` must be non-empty: a syllabus-check log with zero entries would
 * mean no cohort cycle has ever actually been checked against an official
 * source, which this schema treats as an invalid (unseeded) log.
 */
export const syllabusCheckLogFileSchema = z
  .object({
    syllabusVersion: nonEmptyString.describe(
      "The source syllabus document's own version string this data was " +
        'transcribed from, e.g. "2.0" (see ADR-0005: dual versioning).',
    ),
    syllabusDate: nonEmptyString.describe(
      "The source syllabus document's own revision date this data was " +
        'transcribed from, e.g. "2026-09-04" (see ADR-0005: dual versioning).',
    ),
    sourceSection: z
      .literal("§14.2")
      .describe(
        'Fixed to "§14.2" (rule 8: "Setiap versi silabus harus memiliki tanggal, changelog, dan ' +
          'syllabus check.") -- this requirement also restated by the unnumbered "Catatan Penutup" ' +
          "of docs/silabus/99-referensi.md.",
      ),
    checks: z
      .array(syllabusCheckEntrySchema)
      .min(1)
      .describe("The dated log of syllabus checks, in the order they were performed. Non-empty."),
  })
  .strict()
  .describe(
    "The full contents of `data/syllabus-check-log.json`: the dated log of " +
      "§14.2 rule 8 syllabus checks, with their corpus provenance.",
  );

/** The static type inferred from {@link syllabusCheckLogFileSchema}. */
export type SyllabusCheckLogFile = z.infer<typeof syllabusCheckLogFileSchema>;
