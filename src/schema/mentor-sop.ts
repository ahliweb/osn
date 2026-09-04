/**
 * Zod schema for the seven-step mentor SOP ("SOP pengajaran setiap
 * algoritma/struktur data") defined in §5.2 of the syllabus corpus
 * (`docs/silabus/05-format-pembelajaran-dan-sop.md`), plus the whole-file
 * wrapper for `data/mentor-sop.json`.
 *
 * Per the layering rules in `docs/architecture/README.md`, this module must
 * never import from `src/domain/`.
 */

import { z } from "zod";
import { nonEmptyString, syllabusSectionSchema } from "./common";

/** The number of ordered steps §5.2 defines. */
export const SOP_STEP_COUNT = 7;

/** The number of minimum-test checklist items step 6 of §5.2 defines. */
export const MINIMUM_TEST_COUNT = 7;

/** The number of post-Accepted questions step 7 of §5.2 defines. */
export const POST_ACCEPTED_QUESTION_COUNT = 4;

/**
 * One ordered step of the §5.2 SOP: its 1-7 position and its instruction
 * text, transcribed verbatim (in Indonesian) from the corresponding
 * numbered item. Global ordering (no gaps, no duplicates across the whole
 * set of steps) is a file-level property enforced by
 * {@link mentorSopFileSchema}'s `superRefine`, since it cannot be expressed
 * by a single step in isolation.
 */
export const sopStepSchema = z
  .object({
    order: z
      .number()
      .int()
      .min(1)
      .max(SOP_STEP_COUNT)
      .describe(`This step's 1-${SOP_STEP_COUNT} position in the §5.2 numbered list.`),
    instruction: nonEmptyString.describe(
      "This step's instruction, verbatim (Indonesian) from the matching " +
        'numbered item of §5.2, e.g. "Mulai dari problem yang membutuhkan ' +
        'teknik tersebut, bukan definisi algoritma terlebih dahulu."',
    ),
  })
  .describe("One of the seven ordered SOP steps defined by §5.2.");

/** The static type inferred from {@link sopStepSchema}. */
export type SopStep = z.infer<typeof sopStepSchema>;

/**
 * The whole `data/mentor-sop.json` file: the seven ordered §5.2 SOP steps,
 * step 6's minimum-test checklist, step 7's post-Accepted questions, plus
 * the provenance fields (`syllabusVersion`, `syllabusDate`,
 * `sourceSection`) that let the corpus carry its own versioning, per
 * ADR-0005.
 *
 * The `superRefine` below enforces the one property no single step can
 * express on its own: taken together, the seven steps' `order` values must
 * be exactly 1..7 with no gap and no duplicate.
 */
export const mentorSopFileSchema = z
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
      "The syllabus section the whole collection was transcribed from, " + '"§5.2".',
    ),
    steps: z
      .array(sopStepSchema)
      .length(SOP_STEP_COUNT)
      .describe(`The full set of ${SOP_STEP_COUNT} ordered SOP steps defined by §5.2.`),
    minimumTests: z
      .array(nonEmptyString)
      .length(MINIMUM_TEST_COUNT)
      .describe(
        "Step 6's minimum test checklist, transcribed as one array entry " +
          'per comma-separated item of its "Uji minimal: ..." instruction ' +
          '(Indonesian verbatim), e.g. "contoh", "batas minimum", "batas ' +
          'maksimum konseptual", "duplikasi", "urutan buruk", "overflow", ' +
          '"disconnected/negative-edge bila relevan".',
      ),
    postAcceptedQuestions: z
      .array(nonEmptyString)
      .length(POST_ACCEPTED_QUESTION_COUNT)
      .describe(
        "Step 7's four post-Accepted questions, transcribed as one array " +
          'entry per comma-separated item of its "wajib jawab: ..." ' +
          'instruction (Indonesian verbatim), e.g. "mengapa benar", ' +
          '"mengapa cukup cepat", "apa alternatifnya", "kapan teknik ini ' +
          'tidak berlaku".',
      ),
  })
  .superRefine((file, ctx) => {
    const orders = file.steps.map((step) => step.order);
    const sorted = [...orders].sort((a, b) => a - b);
    const isExactlyOneToSeven =
      sorted.length === SOP_STEP_COUNT && sorted.every((value, index) => value === index + 1);
    if (!isExactlyOneToSeven) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["steps"],
        message:
          `steps must have order values exactly 1..${SOP_STEP_COUNT} with no duplicates or ` +
          `gaps; got [${orders.join(", ")}]`,
      });
    }
  })
  .describe(
    "The full contents of `data/mentor-sop.json`: the seven ordered §5.2 " +
      "SOP steps, step 6's minimum test checklist, step 7's post-Accepted " +
      "questions, with their corpus provenance.",
  );

/** The static type inferred from {@link mentorSopFileSchema}. */
export type MentorSopFile = z.infer<typeof mentorSopFileSchema>;
