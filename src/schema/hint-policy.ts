/**
 * Zod schema for the progressive-hinting escalation policy ("Aturan
 * hint/editorial") defined in §5.3 of the syllabus corpus
 * (`docs/silabus/05-format-pembelajaran-dan-sop.md`), plus the whole-file
 * wrapper for `data/hint-policy.json`.
 *
 * Per the layering rules in `docs/architecture/README.md`, this module must
 * never import from `src/domain/`. In particular, the mandatory re-solve
 * *obligation* is encoded here (`requiresResolve`); re-solve *scheduling*
 * is out of scope for this module -- see issue #14.
 */

import { z } from "zod";
import { nonEmptyString, syllabusSectionSchema } from "./common";

/**
 * The five escalation levels' stable ids, in the order §5.3's "Progressive
 * hinting" callout lists them (`pertanyaan pemodelan -> arah complexity ->
 * observasi kunci -> pseudocode parsial -> editorial`).
 */
export const HINT_LEVEL_IDS = [
  "pertanyaan-pemodelan",
  "arah-complexity",
  "observasi-kunci",
  "pseudocode-parsial",
  "editorial",
] as const;

/** The number of escalation levels §5.3 defines. */
export const HINT_LEVEL_COUNT = HINT_LEVEL_IDS.length;

/** The 1-indexed level at which the mandatory re-solve obligation begins (see `requiresResolve` below). */
export const RESOLVE_REQUIRED_FROM_LEVEL = 4;

/** The literal union of valid hint-level ids. */
export const hintLevelIdSchema = z
  .enum(HINT_LEVEL_IDS)
  .describe(`One of the five §5.3 escalation-level ids, in order: ${HINT_LEVEL_IDS.join(", ")}.`);

/**
 * One escalation level of the §5.3 progressive-hinting policy: its 1-5
 * position, its stable id, its description, and whether reaching it
 * triggers the mandatory re-solve obligation. Global ordering (levels
 * exactly 1..5, no gaps or duplicates) is a file-level property enforced by
 * {@link hintPolicyFileSchema}'s `superRefine`, since it cannot be
 * expressed by a single level in isolation.
 */
export const hintLevelSchema = z
  .object({
    level: z
      .number()
      .int()
      .min(1)
      .max(HINT_LEVEL_COUNT)
      .describe(`This level's 1-${HINT_LEVEL_COUNT} position in the §5.3 escalation order.`),
    id: hintLevelIdSchema,
    description: nonEmptyString.describe(
      "This level's description, verbatim (Indonesian) from its segment " +
        "of the §5.3 callout's escalation list, e.g. \"pertanyaan " +
        'pemodelan" or "arah complexity".',
    ),
    requiresResolve: z
      .boolean()
      .describe(
        `Whether a problem that reached this hint level must be re-solved without help at the next interval, per the §5.3 callout's "Semua soal yang membutuhkan editorial wajib dire-solve tanpa bantuan pada interval berikutnya" rule. DERIVED operational reading, not verbatim source text: the callout only names the terminal "editorial" level explicitly, but this schema treats the obligation as beginning one level earlier, at level ${RESOLVE_REQUIRED_FROM_LEVEL} ("pseudocode-parsial") through the terminal level ("editorial") -- on the reading that handing over a partial pseudocode solution already crosses the same line the callout is guarding (the student no longer solved the problem unaided), even though the source text itself only says "editorial". Renders as false for levels 1-3.`,
      ),
  })
  .describe("One of the five progressive-hinting escalation levels defined by §5.3.");

/** The static type inferred from {@link hintLevelSchema}. */
export type HintLevel = z.infer<typeof hintLevelSchema>;

/**
 * The whole `data/hint-policy.json` file: the five §5.3 escalation levels,
 * the callout text itself (verbatim), a derived summary of the re-solve
 * obligation, plus the provenance fields (`syllabusVersion`,
 * `syllabusDate`, `sourceSection`) that let the corpus carry its own
 * versioning, per ADR-0005.
 *
 * The `superRefine` below enforces the one property no single level can
 * express on its own: taken together, the five levels' `level` values must
 * be exactly 1..5 with no gap and no duplicate.
 */
export const hintPolicyFileSchema = z
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
      "The syllabus section the whole collection was transcribed from, " + '"§5.3".',
    ),
    calloutText: nonEmptyString.describe(
      'The full §5.3 "Progressive hinting" callout, verbatim (Indonesian, ' +
        "markdown emphasis/blockquote markers stripped): the escalation " +
        "order, the full-solution-as-last-resort rule, and the mandatory " +
        "re-solve rule, as one continuous string.",
    ),
    resolvePolicy: nonEmptyString.describe(
      "A structured, English summary of the §5.3 mandatory re-solve rule: " +
        "any problem that reached the terminal editorial level must be " +
        "re-solved without help at the next interval. DERIVED, not " +
        "verbatim source text. Records the obligation only -- re-solve " +
        '*scheduling* (when "the next interval" falls, how it is ' +
        "tracked) is out of scope for this module; see issue #14.",
    ),
    levels: z
      .array(hintLevelSchema)
      .length(HINT_LEVEL_COUNT)
      .describe(`The full set of ${HINT_LEVEL_COUNT} escalation levels defined by §5.3, in order.`),
  })
  .superRefine((file, ctx) => {
    const levels = file.levels.map((level) => level.level);
    const sorted = [...levels].sort((a, b) => a - b);
    const isExactlyOneToFive =
      sorted.length === HINT_LEVEL_COUNT && sorted.every((value, index) => value === index + 1);
    if (!isExactlyOneToFive) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["levels"],
        message:
          `levels must have level values exactly 1..${HINT_LEVEL_COUNT} with no duplicates or ` +
          `gaps; got [${levels.join(", ")}]`,
      });
    }
  })
  .describe(
    "The full contents of `data/hint-policy.json`: the five §5.3 " +
      "progressive-hinting escalation levels, the callout text, and the " +
      "re-solve policy summary, with their corpus provenance.",
  );

/** The static type inferred from {@link hintPolicyFileSchema}. */
export type HintPolicyFile = z.infer<typeof hintPolicyFileSchema>;
