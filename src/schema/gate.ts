/**
 * Zod schema for a phase gate ("gate per fase") — one of the seven
 * progression checkpoints defined in §4.1 of the syllabus corpus
 * (`docs/silabus/04-silabus-28-minggu.md`), plus the whole-file wrapper for
 * `data/gates.json`.
 *
 * Per the layering rules in `docs/architecture/README.md`, this module must
 * never import from `src/domain/`.
 */

import { z } from "zod";
import { nonEmptyString, syllabusSectionSchema } from "./common";

/** The seven week numbers §4.1 defines a phase gate after, in order. */
export const GATE_WEEKS = [4, 8, 12, 16, 20, 24, 28] as const;

/** The literal union of valid gate week numbers, e.g. `4 | 8 | ... | 28`. */
const afterWeekSchema = z
  .union([
    z.literal(4),
    z.literal(8),
    z.literal(12),
    z.literal(16),
    z.literal(20),
    z.literal(24),
    z.literal(28),
  ])
  .describe(
    `The week this gate follows: one of ${GATE_WEEKS.join(", ")}, matching a "Minggu N" row of the §4.1 "Gate per fase" table.`,
  );

/**
 * A single phase gate: the week it follows, the minimum evidence required
 * before a learner may proceed past it, and whether it blocks progression.
 */
export const gateSchema = z
  .object({
    afterWeek: afterWeekSchema,
    evidence: z
      .array(nonEmptyString)
      .min(1)
      .describe(
        "The minimum evidence required before proceeding, transcribed " +
          'from the "Minimal evidence sebelum lanjut" column of §4.1 (one ' +
          "array entry per semicolon-separated item in that cell).",
      ),
    blocksProgression: z
      .boolean()
      .describe(
        "Whether this gate blocks progression to the next phase until its " +
          "evidence is met. Every gate defined by §4.1 is a progression " +
          "gate, so this is `true` for all current records.",
      ),
  })
  .describe("One of the seven phase gates defined by §4.1.");

/** The static type inferred from {@link gateSchema}. */
export type Gate = z.infer<typeof gateSchema>;

/**
 * The whole `data/gates.json` file: the seven phase gates plus the
 * provenance fields (`syllabusVersion`, `syllabusDate`, `sourceSection`)
 * that let the corpus carry its own versioning, per ADR-0005.
 */
export const gatesSchema = z
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
      "The syllabus section the whole collection was transcribed from, " + '"§4.1".',
    ),
    gates: z.array(gateSchema).describe("The full set of seven phase gates defined by §4.1."),
  })
  .describe(
    "The full contents of `data/gates.json`: the seven phase gates, with " +
      "their corpus provenance.",
  );

/** The static type inferred from {@link gatesSchema}. */
export type GatesFile = z.infer<typeof gatesSchema>;
