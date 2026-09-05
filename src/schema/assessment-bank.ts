/**
 * Zod schema for an assessment-bank kind ("Assessment Bank" row) -- one of
 * the six separated problem-bank kinds required by §13 "Tata Kelola
 * Implementasi AhliKoding.com" of the syllabus corpus
 * (`docs/silabus/13-tata-kelola.md`: "Pisahkan diagnostic, weekly,
 * checkpoint, OSN-K style, OSN-P style, national mixed."), plus the
 * whole-file wrapper for `data/assessment-bank.json`.
 *
 * §13's row names the six kinds but gives no per-kind purpose, timing, or
 * scoring-model text of its own -- unlike most `data/*.json` files in this
 * corpus, `purpose` and the `scoringModel` choice below are DERIVED, each
 * grounded against another syllabus section that *does* say something
 * concrete about that bank kind (§13.1's data-driven coaching cycle, §1.3's
 * baseline learning load, §4.1's phase gates, §14.1's checklist, and §2.2's
 * per-stage contest format/practice model -- the one exception being OSN-P,
 * where §2.2's practice model states "Partial scoring" outright, so
 * `scoringModel: "partial"` for `osn-p-style` is the one non-derived,
 * directly-stated choice). See `src/domain/blueprint.ts` for the per-kind
 * justification of each `scoringModel` choice.
 *
 * This module deliberately does NOT restate the §2.2 OSN-K/OSN-P item
 * counts or durations as new literals: `timingMinutes` is `null` for
 * `osn-k-style` and `osn-p-style` here, and the blueprint builder
 * (`src/domain/blueprint.ts`, issue #18) reads the real numbers from
 * `getStage("osn-k")`/`getStage("osn-p")` (`src/domain/structure.ts`,
 * backed by `data/competition-stages.json`) instead, so the two files can
 * never silently desync.
 *
 * Per the layering rules in `docs/architecture/README.md`, this module must
 * never import from `src/domain/`. It reuses {@link stageIdSchema} from
 * `src/schema/stage.ts` (a schema-to-schema import, not a domain import) so
 * the four competition-stage ids are never restated as a second literal
 * union.
 */

import { z } from "zod";
import { nonEmptyString, syllabusSectionSchema } from "./common";
import { stageIdSchema } from "./stage";

/** The six §13 Assessment Bank kinds, in the order §13's row lists them. */
export const BANK_KIND_IDS = [
  "diagnostic",
  "weekly",
  "checkpoint",
  "osn-k-style",
  "osn-p-style",
  "national-mixed",
] as const;

/** The literal union of valid bank-kind ids. */
export const bankKindIdSchema = z
  .enum(BANK_KIND_IDS)
  .describe(`One of the six §13 Assessment Bank kinds: ${BANK_KIND_IDS.join(", ")}.`);

/** The static type inferred from {@link bankKindIdSchema}. */
export type BankKindId = (typeof BANK_KIND_IDS)[number];

/**
 * The three scoring models a bank kind can carry. `partial` is required for
 * `osn-p-style` (§2.2's OSN-P practice model states "Partial scoring"
 * outright); the other five kinds' scoring models are DERIVED -- see this
 * module's docblock and `src/domain/blueprint.ts`.
 */
export const SCORING_MODELS = ["binary", "partial", "rubric"] as const;

/** The literal union of valid scoring models. */
export const scoringModelSchema = z
  .enum(SCORING_MODELS)
  .describe(
    `A bank kind's scoring model: ${SCORING_MODELS.join(", ")}. "binary" is a plain accept/reject verdict per item; "partial" awards credit per subtask/case (mandatory for osn-p-style, per §2.2's "Partial scoring"); "rubric" grades against named mastery criteria rather than a single pass/fail or subtask signal.`,
  );

/** The static type inferred from {@link scoringModelSchema}. */
export type ScoringModel = z.infer<typeof scoringModelSchema>;

/**
 * A single §13 assessment-bank kind: a stable id, its printed name, its
 * purpose (DERIVED and grounded against the syllabus sections in
 * `sourceSections` -- see this module's docblock), the competition stage it
 * serves (or `null` where the bank is not tied to one stage), its scoring
 * model, its total timing in minutes (or `null` where no fixed duration
 * applies, including `osn-k-style`/`osn-p-style` -- see this module's
 * docblock), and the syllabus sections that ground it.
 */
export const bankKindSchema = z
  .object({
    id: bankKindIdSchema,
    name: nonEmptyString.describe(
      'This bank kind\'s printed name, e.g. "Diagnostic bank" for `diagnostic`.',
    ),
    purpose: nonEmptyString.describe(
      "This bank kind's purpose, grounded in the syllabus sections listed " +
        "in `sourceSections`. DERIVED -- §13 names the six kinds but not " +
        "their individual purposes; see this module's docblock.",
    ),
    servesStage: stageIdSchema
      .nullable()
      .describe(
        "The §2.2 competition-stage id this bank kind serves, or `null` " +
          "where the bank is not tied to one specific stage (e.g. " +
          "diagnostic, weekly, checkpoint).",
      ),
    scoringModel: scoringModelSchema,
    timingMinutes: z
      .number()
      .int()
      .positive()
      .nullable()
      .describe(
        "This bank kind's total timing in minutes, or `null` where no " +
          "fixed duration applies. Deliberately `null` for `osn-k-style` " +
          "and `osn-p-style` -- the real §2.2 durations (150 / 180 " +
          "minutes) are read from `getStage()` in `src/domain/structure.ts` " +
          "at blueprint-build time, not restated here.",
      ),
    sourceSections: z
      .array(syllabusSectionSchema)
      .min(1)
      .describe("The syllabus sections that ground this bank kind's purpose and scoring model."),
  })
  .describe("One of the six §13 Assessment Bank kinds.");

/** The static type inferred from {@link bankKindSchema}. */
export type BankKind = z.infer<typeof bankKindSchema>;

/**
 * The whole `data/assessment-bank.json` file: the six §13 assessment-bank
 * kinds plus the provenance fields (`syllabusVersion`, `syllabusDate`,
 * `sourceSection`) that let the corpus carry its own versioning, per
 * ADR-0005.
 *
 * The `superRefine` below enforces the one property no single bank kind can
 * express on its own: the file's kinds must be exactly the six
 * {@link BANK_KIND_IDS}, each appearing exactly once (no duplicates, no
 * missing id, no extra id) -- the same pattern `playbooksFileSchema`
 * (`src/schema/playbook.ts`) and `problemStatusFileSchema`
 * (`src/schema/problem-status.ts`) use for their own fixed id sets.
 */
export const assessmentBankFileSchema = z
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
      "The syllabus section the whole collection was transcribed from, " + '"§13".',
    ),
    banks: z
      .array(bankKindSchema)
      .length(BANK_KIND_IDS.length)
      .describe(`The full set of ${BANK_KIND_IDS.length} assessment-bank kinds defined by §13.`),
  })
  .superRefine((file, ctx) => {
    const ids = file.banks.map((bank) => bank.id);
    const uniqueIds = new Set(ids);
    const expectedIds = new Set<string>(BANK_KIND_IDS);
    const isExactlyTheSixIds =
      ids.length === BANK_KIND_IDS.length &&
      uniqueIds.size === ids.length &&
      [...uniqueIds].every((id) => expectedIds.has(id));

    if (!isExactlyTheSixIds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["banks"],
        message:
          `banks must contain exactly the ${BANK_KIND_IDS.length} ids ${BANK_KIND_IDS.join(", ")}, ` +
          `each once, with no duplicates and no other ids; got [${ids.join(", ")}]`,
      });
    }
  })
  .describe(
    "The full contents of `data/assessment-bank.json`: the six §13 " +
      "assessment-bank kinds, with their corpus provenance.",
  );

/** The static type inferred from {@link assessmentBankFileSchema}. */
export type AssessmentBankFile = z.infer<typeof assessmentBankFileSchema>;
