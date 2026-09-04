/**
 * Zod schema for a baseline learning-load component ("Beban belajar
 * baseline") — one of the five operational rows (Sesi mentor, Latihan
 * mandiri, Soal terkurasi, Contest, Checkpoint) defined in §1.3 of the
 * syllabus corpus (`docs/silabus/01-identitas-program.md`), plus the
 * whole-file wrapper for `data/learning-load.json`.
 *
 * Per the layering rules in `docs/architecture/README.md`, this module must
 * never import from `src/domain/`.
 */

import { z } from "zod";
import { nonEmptyString, syllabusSectionSchema } from "./common";

/**
 * A fixed cadence of mentor sessions per week, each of a fixed duration,
 * e.g. "2 x 120 menit/minggu" -> `{ sessionsPerWeek: 2, minutesPerSession:
 * 120 }`.
 */
const mentorSessionsQuantitySchema = z.object({
  kind: z.literal("mentor-sessions").describe("Discriminant: a fixed weekly session cadence."),
  sessionsPerWeek: z.number().int().positive().describe("How many sessions run per week."),
  minutesPerSession: z.number().int().positive().describe("How many minutes each session runs."),
});

/**
 * An hours-per-week range, e.g. "4-8 jam/minggu" -> `{ minHoursPerWeek: 4,
 * maxHoursPerWeek: 8 }`.
 */
const hourRangeQuantitySchema = z.object({
  kind: z.literal("hour-range").describe("Discriminant: an hours-per-week range."),
  minHoursPerWeek: z.number().positive().describe("The low end of the weekly hour range."),
  maxHoursPerWeek: z.number().positive().describe("The high end of the weekly hour range."),
});

/**
 * A count-per-week range, e.g. "Umumnya 8-12/minggu" -> `{ minPerWeek: 8,
 * maxPerWeek: 12 }`.
 */
const countRangeQuantitySchema = z.object({
  kind: z.literal("count-range").describe("Discriminant: a count-per-week range."),
  minPerWeek: z.number().int().positive().describe("The low end of the weekly count range."),
  maxPerWeek: z.number().int().positive().describe("The high end of the weekly count range."),
});

/**
 * A fixed recurrence measured in weeks, e.g. "Akhir setiap 4 minggu" ->
 * `{ everyWeeks: 4 }`.
 */
const cadenceWeeksQuantitySchema = z.object({
  kind: z.literal("cadence-weeks").describe("Discriminant: a fixed N-week recurrence."),
  everyWeeks: z.number().int().positive().describe("The recurrence period, in weeks."),
});

/**
 * A learning-load component's baseline reduced to a structured quantity, or
 * `null` where the baseline text is not cleanly reducible to a single
 * numeric shape (e.g. the Contest row's two-clause "1 mini-contest/2
 * minggu; meningkat menjadi mingguan", which mixes a fixed cadence with a
 * qualitative escalation). A discriminated union rather than one
 * all-optional shape so each variant's fields are always fully present
 * (never `undefined`), which keeps this schema well-typed under
 * `exactOptionalPropertyTypes`.
 */
export const learningLoadQuantitySchema = z
  .discriminatedUnion("kind", [
    mentorSessionsQuantitySchema,
    hourRangeQuantitySchema,
    countRangeQuantitySchema,
    cadenceWeeksQuantitySchema,
  ])
  .nullable()
  .describe(
    "This component's baseline reduced to a structured quantity, or " +
      "`null` where the baseline text does not reduce to a single numeric " +
      "shape.",
  );

/** The static type inferred from {@link learningLoadQuantitySchema}. */
export type LearningLoadQuantity = z.infer<typeof learningLoadQuantitySchema>;

/**
 * A single baseline learning-load component: its name, its operational
 * baseline and note transcribed verbatim (in Indonesian) from the §1.3
 * table, and a structured quantity where the baseline is numerically
 * expressible.
 */
export const learningLoadComponentSchema = z
  .object({
    component: nonEmptyString.describe(
      'This component\'s name exactly as printed in the §1.3 "Komponen" ' +
        'column, e.g. "Sesi mentor".',
    ),
    baseline: nonEmptyString.describe(
      "This component's operational baseline, verbatim from the §1.3 " +
        '"Baseline operasional" column.',
    ),
    note: nonEmptyString.describe(
      'This component\'s note, verbatim from the §1.3 "Catatan" column.',
    ),
    quantity: learningLoadQuantitySchema,
  })
  .describe("One of the five baseline learning-load components defined by §1.3.");

/** The static type inferred from {@link learningLoadComponentSchema}. */
export type LearningLoadComponent = z.infer<typeof learningLoadComponentSchema>;

/**
 * The whole `data/learning-load.json` file: the five baseline learning-load
 * components plus the provenance fields (`syllabusVersion`, `syllabusDate`,
 * `sourceSection`) that let the corpus carry its own versioning, per
 * ADR-0005.
 */
export const learningLoadFileSchema = z
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
      "The syllabus section the whole collection was transcribed from, " + '"§1.3".',
    ),
    components: z
      .array(learningLoadComponentSchema)
      .describe("The full set of five baseline learning-load components defined by §1.3."),
  })
  .describe(
    "The full contents of `data/learning-load.json`: the five baseline " +
      "learning-load components, with their corpus provenance.",
  );

/** The static type inferred from {@link learningLoadFileSchema}. */
export type LearningLoadFile = z.infer<typeof learningLoadFileSchema>;
