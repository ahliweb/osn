/**
 * Zod schema for a §14.2 final operational rule ("Aturan operasional
 * final") -- one of the eight numbered rules defined in §14.2 of the
 * syllabus corpus (`docs/silabus/14-checklist-dan-aturan-operasional.md`)
 * -- plus the §14.2 "Pointer cepat untuk mentor" callout (the ten-stage
 * mentor sequencing pointer and its closing extension condition), and the
 * whole-file wrapper for `data/operational-rules.json`.
 *
 * Both `rule` (the eight numbered rules) and the callout's `stages`/
 * `extensionCondition` are transcribed verbatim (Indonesian, except the
 * stage names themselves, which the callout already gives in English --
 * "Problem Solving -> C++ -> ... -> Contest Engineering").
 *
 * Per the layering rules in `docs/architecture/README.md`, this module must
 * never import from `src/domain/`.
 */

import { z } from "zod";
import { nonEmptyString, syllabusSectionSchema } from "./common";

/** The number of §14.2 numbered operational rules. */
export const OPERATIONAL_RULE_COUNT = 8;

/** The number of ordered stages in the §14.2 "Pointer cepat untuk mentor" callout. */
export const QUICK_POINTER_STAGE_COUNT = 10;

/**
 * A single §14.2 operational rule: its 1-8 position in the numbered list,
 * and its rule text transcribed verbatim (Indonesian). Global ordering (no
 * gaps, no duplicates) is a file-level property enforced by
 * {@link operationalRulesFileSchema}'s `superRefine`, since it cannot be
 * expressed by a single rule in isolation -- the same split
 * `sopStepSchema`/`mentorSopFileSchema` (`src/schema/mentor-sop.ts`) uses
 * for the §5.2 ordered SOP steps.
 */
export const operationalRuleSchema = z
  .object({
    order: z
      .number()
      .int()
      .min(1)
      .max(OPERATIONAL_RULE_COUNT)
      .describe(`This rule's 1-${OPERATIONAL_RULE_COUNT} position in the §14.2 numbered list.`),
    rule: nonEmptyString.describe(
      "This rule's text, verbatim (Indonesian) from the matching numbered " +
        'item of §14.2, e.g. "Core OSN harus lebih dahulu daripada extension."',
    ),
  })
  .strict()
  .describe("One of the eight ordered operational rules defined by §14.2.");

/** The static type inferred from {@link operationalRuleSchema}. */
export type OperationalRule = z.infer<typeof operationalRuleSchema>;

/**
 * The §14.2 "Pointer cepat untuk mentor" callout: the ten-stage mentor
 * sequencing pointer (in the callout's own order, verbatim: "Problem
 * Solving -> C++ -> Complexity -> Math/Logic -> Complete Search -> Greedy
 * -> DP -> Graph/Tree -> Data Structures -> Contest Engineering") and the
 * callout's closing condition that extension only follows once core is
 * stable, verbatim (Indonesian): "Extension hanya setelah core stabil."
 */
export const quickPointerSchema = z
  .object({
    stages: z
      .array(nonEmptyString)
      .length(QUICK_POINTER_STAGE_COUNT)
      .describe(
        `The callout's ${QUICK_POINTER_STAGE_COUNT} mentor-sequencing stages, in its own arrow order, verbatim: "Problem Solving", "C++", "Complexity", "Math/Logic", "Complete Search", "Greedy", "DP", "Graph/Tree", "Data Structures", "Contest Engineering".`,
      ),
    extensionCondition: nonEmptyString.describe(
      "The callout's closing condition, verbatim (Indonesian): \"Extension " +
        'hanya setelah core stabil." -- extension only follows once core is stable.',
    ),
  })
  .strict()
  .describe('The §14.2 "Pointer cepat untuk mentor" callout.');

/** The static type inferred from {@link quickPointerSchema}. */
export type QuickPointer = z.infer<typeof quickPointerSchema>;

/**
 * The whole `data/operational-rules.json` file: the eight §14.2 numbered
 * operational rules, the §14.2 mentor quick-pointer callout, plus the
 * provenance fields (`syllabusVersion`, `syllabusDate`, `sourceSection`)
 * that let the corpus carry its own versioning, per ADR-0005.
 *
 * The `superRefine` below enforces the one property no single rule can
 * express on its own: taken together, the eight rules' `order` values must
 * be exactly 1..8 with no gap and no duplicate -- the same pattern
 * `mentorSopFileSchema` (`src/schema/mentor-sop.ts`) uses for its own
 * seven-step ordering.
 */
export const operationalRulesFileSchema = z
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
      "The syllabus section the whole collection was transcribed from, " + '"§14.2".',
    ),
    rules: z
      .array(operationalRuleSchema)
      .length(OPERATIONAL_RULE_COUNT)
      .describe(
        `The full set of ${OPERATIONAL_RULE_COUNT} ordered operational rules defined by §14.2.`,
      ),
    quickPointer: quickPointerSchema,
  })
  .superRefine((file, ctx) => {
    const orders = file.rules.map((rule) => rule.order);
    const sorted = [...orders].sort((a, b) => a - b);
    const isExactlyOneToEight =
      sorted.length === OPERATIONAL_RULE_COUNT &&
      sorted.every((value, index) => value === index + 1);
    if (!isExactlyOneToEight) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rules"],
        message:
          `rules must have order values exactly 1..${OPERATIONAL_RULE_COUNT} with no duplicates ` +
          `or gaps; got [${orders.join(", ")}]`,
      });
    }
  })
  .describe(
    "The full contents of `data/operational-rules.json`: the eight §14.2 " +
      "operational rules and the §14.2 mentor quick-pointer callout, with " +
      "their corpus provenance.",
  );

/** The static type inferred from {@link operationalRulesFileSchema}. */
export type OperationalRulesFile = z.infer<typeof operationalRulesFileSchema>;
