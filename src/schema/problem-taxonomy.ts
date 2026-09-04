/**
 * Zod schemas for the Problem Taxonomy ("Tag: official-topic, prerequisite,
 * difficulty, stage, complexity, common traps, expected solution") defined
 * in the §13 "Tata Kelola Implementasi AhliKoding.com" table of the
 * syllabus corpus (`docs/silabus/13-tata-kelola.md`), plus the controlled
 * vocabulary wrapper for `data/problem-taxonomy-vocab.json`.
 *
 * §13 names the seven tag dimensions but, unlike e.g. §6.1's assessment
 * weights or §6.2's status codes, gives no table of concrete values for
 * `difficulty`, `common traps`, or `expected solution` — those three are
 * open dimensions this module must still make concrete to be usable. Per
 * the task that added this module (issue #15), the vocabularies below are
 * DERIVED: kept deliberately modest, and justified either against another
 * syllabus section that already enumerates the relevant techniques (§2.1's
 * topic-family coverage, §2.2's OSN-P "baseline -> optimized solution"
 * practice model) or, failing that, against the plain meaning of §13
 * itself. Nothing here is invented beyond what the syllabus corpus
 * discusses elsewhere.
 *
 * Per the layering rules in `docs/architecture/README.md`, this module
 * must never import from `src/domain/`.
 */

import { z } from "zod";
import { nonEmptyString, slugSchema, syllabusSectionSchema } from "./common";
import { stageIdSchema } from "./stage";

// --- official-topic ---------------------------------------------------

/**
 * The ten official topic-family ids defined in §2.1
 * (`data/topic-families.json`), in that file's order. Hardcoded here
 * rather than imported, in the same style `src/schema/stage.ts` hardcodes
 * `STAGE_IDS` and `src/schema/problem-status.ts` hardcodes
 * `PROBLEM_STATUS_CODES`: `src/schema/` describes shape and constraints
 * only and never imports `data/*.json` or `src/domain/` (see
 * `docs/architecture/README.md`, "Layering rules"), so a small, stable,
 * already-finalised id set like this one is restated as a literal here.
 * `tests/unit/problem-taxonomy.test.ts` asserts this list has no drift
 * against the real `data/topic-families.json` file (via
 * `src/domain/topic-families.ts`).
 */
export const OFFICIAL_TOPIC_IDS = [
  "dasar-pemrograman",
  "logika-bitwise",
  "aritmetika",
  "aturan-berhitung",
  "rekursi",
  "search-sort",
  "strategi-problem-solving",
  "struktur-data",
  "graph-tree",
  "geometri-dasar",
] as const;

/** The literal union of valid official-topic (§2.1 topic-family) ids. */
export const officialTopicIdSchema = z
  .enum(OFFICIAL_TOPIC_IDS)
  .describe(
    `The §13 'official-topic' tag dimension: one of the ten §2.1 topic-family ids: ${OFFICIAL_TOPIC_IDS.join(", ")}.`,
  );

// --- difficulty ---------------------------------------------------------

/** The low and high ends of the difficulty scale this module defines. */
export const DIFFICULTY_MIN = 1;
export const DIFFICULTY_MAX = 5;

/**
 * The five named difficulty bands, DERIVED (§13 requires a `difficulty`
 * dimension but defines no scale). A 1-5 integer scale was chosen to match
 * the shape already used elsewhere in this corpus for a small ordered
 * scale (`src/schema/hint-policy.ts`'s five escalation levels), and the
 * band names/descriptions are anchored to the four §2.2 competition
 * stages' natural difficulty progression (OSN-K -> OSN-P -> OSN Nasional
 * -> TOKI/IOI extension) so a mentor tagging a problem has a concrete
 * reference point rather than an arbitrary number. See
 * `data/problem-taxonomy-vocab.json` for the full band descriptions and
 * `docs/architecture/data-classification.md` for the justification
 * summary.
 */
export const DIFFICULTY_BAND_IDS = ["pengantar", "dasar", "menengah", "lanjut", "elite"] as const;

/** The §13 'difficulty' tag dimension: an integer from {@link DIFFICULTY_MIN} to {@link DIFFICULTY_MAX}. */
export const difficultyLevelSchema = z
  .number()
  .int()
  .min(DIFFICULTY_MIN)
  .max(DIFFICULTY_MAX)
  .describe(
    `The §13 'difficulty' tag dimension: an integer ${DIFFICULTY_MIN}-${DIFFICULTY_MAX} matching one of the named bands in data/problem-taxonomy-vocab.json (in order: ${DIFFICULTY_BAND_IDS.join(", ")}). DERIVED scale -- see the module docblock.`,
  );

// --- complexity -----------------------------------------------------------

/**
 * Standard Big-O notation, e.g. `O(1)`, `O(log n)`, `O(n log n)`,
 * `O(n^2)`, `O(2^n)`, `O(V+E)` (graph problems). Deliberately permissive
 * about the interior expression -- this module does not attempt to parse
 * or normalise complexity expressions, only to reject strings that are
 * not shaped like Big-O notation at all.
 */
const BIG_O_PATTERN = /^O\([A-Za-z0-9+\-*/^.,! ()]+\)$/;

/** The §13 'complexity' tag dimension: the problem's expected solution complexity class. */
export const complexityClassSchema = z
  .string()
  .trim()
  .regex(BIG_O_PATTERN, 'must be standard Big-O notation, e.g. "O(n log n)" or "O(V+E)"')
  .describe(
    "The §13 'complexity' tag dimension: the expected solution's time " +
      'complexity class in Big-O notation, e.g. "O(n log n)". DERIVED ' +
      "notation choice -- §13 names the dimension but not a notation; " +
      "standard Big-O is the smallest possible choice that says anything " +
      "concrete.",
  );

// --- common-traps ---------------------------------------------------------

/**
 * A modest set of common-trap categories, DERIVED from the kinds of
 * mistake the syllabus corpus actually discusses: §2.2's OSN-K dominant
 * competencies name "kompleksitas" and "tracing" explicitly (motivating
 * `excessive-complexity`), §2.1's `geometri-dasar` family motivates
 * `floating-point-precision`, and the five §13.1 postmortem error classes
 * (conceptual/modeling/complexity/implementation/debugging -- see
 * `src/schema/learning-record.ts`) motivate `incorrect-modeling` as the
 * tactical, problem-specific counterpart of the record-level `modeling`
 * error class. `off-by-one`, `integer-overflow` and
 * `empty-or-degenerate-input` are the three most common implementation-
 * level mistakes in competitive programming generally and fall under the
 * §13.1 `implementation`/`debugging` classes. Kept intentionally short --
 * this is not an attempt to enumerate every possible mistake.
 */
export const COMMON_TRAP_IDS = [
  "off-by-one",
  "integer-overflow",
  "excessive-complexity",
  "empty-or-degenerate-input",
  "floating-point-precision",
  "incorrect-modeling",
] as const;

/** The literal union of valid common-trap ids. */
export const commonTrapIdSchema = z
  .enum(COMMON_TRAP_IDS)
  .describe(`The §13 'common traps' tag dimension: one of ${COMMON_TRAP_IDS.join(", ")}.`);

// --- expected-solution ---------------------------------------------------

/**
 * A modest set of expected-solution technique classes, DERIVED directly
 * from what the syllabus corpus names: `brute-force`, `greedy`,
 * `divide-and-conquer` and `dynamic-programming` are exactly the four
 * items in §2.1's `strategi-problem-solving` family coverage (plus
 * `complete-search-pruning`, that family's fifth item, kept as its own
 * class since "complete search with pruning" is a distinct technique from
 * unoptimised brute force -- both are named because §2.2's OSN-P practice
 * model is explicitly "baseline -> optimized solution", i.e. a brute-force
 * baseline is a real, intended solution class, not just a mistake).
 * `graph` and `data-structure` come from §2.1's `graph-tree` and
 * `struktur-data` families; `geometry` from `geometri-dasar`.
 */
export const EXPECTED_SOLUTION_CLASS_IDS = [
  "brute-force",
  "complete-search-pruning",
  "greedy",
  "divide-and-conquer",
  "dynamic-programming",
  "graph",
  "data-structure",
  "geometry",
] as const;

/** The literal union of valid expected-solution-class ids. */
export const expectedSolutionClassIdSchema = z
  .enum(EXPECTED_SOLUTION_CLASS_IDS)
  .describe(
    `The §13 'expected solution' tag dimension: one of ${EXPECTED_SOLUTION_CLASS_IDS.join(", ")}.`,
  );

// --- problem id -----------------------------------------------------------

/**
 * A problem's stable identifier. Reuses {@link slugSchema} (the same
 * kebab-case convention used for every other stable id in this corpus) so
 * that `src/schema/learning-record.ts`'s `problemId` field can import this
 * single definition rather than restate the pattern.
 */
export const problemIdSchema = slugSchema.describe(
  'A problem\'s stable kebab-case identifier, e.g. "problem-demo-1". Never ' +
    "a learner identifier -- see `learnerRef` in `src/schema/learning-record.ts`.",
);

// --- the tagged problem itself ---------------------------------------------

/**
 * A single tagged problem: the seven §13 Problem Taxonomy tag dimensions
 * (`officialTopic`, `prerequisite`, `difficulty`, `stage`, `complexity`,
 * `commonTraps`, `expectedSolution`), plus the `problemId` being tagged.
 *
 * `prerequisite` and `expectedSolution` are modelled as arrays (zero-or-
 * more, one-or-more respectively) rather than single values: §13 gives no
 * cardinality for either, and in practice a problem can depend on more
 * than one foundational topic, or require combining more than one
 * technique (e.g. dynamic programming *on* a tree is both `graph` and
 * `dynamic-programming`). DERIVED, not verbatim source text.
 *
 * The `superRefine` below enforces two properties no single field can
 * express alone: a topic can never be listed as its own prerequisite, and
 * `prerequisite`/`commonTraps`/`expectedSolution` must each contain no
 * duplicate entries.
 */
export const problemTagsSchema = z
  .object({
    problemId: problemIdSchema,
    officialTopic: officialTopicIdSchema,
    prerequisite: z
      .array(officialTopicIdSchema)
      .describe(
        "The §13 'prerequisite' tag dimension: the topic-family ids a " +
          "learner should already know before attempting this problem. " +
          "May be empty for a foundational problem with no prerequisite " +
          "topic.",
      ),
    difficulty: difficultyLevelSchema,
    stage: stageIdSchema.describe(
      "The §13 'stage' tag dimension: the §2.2 competition stage this " + "problem targets.",
    ),
    complexity: complexityClassSchema,
    commonTraps: z
      .array(commonTrapIdSchema)
      .min(1)
      .describe(
        "The §13 'common traps' tag dimension: at least one trap category " +
          "a learner is likely to fall into on this problem.",
      ),
    expectedSolution: z
      .array(expectedSolutionClassIdSchema)
      .min(1)
      .describe(
        "The §13 'expected solution' tag dimension: at least one solution " +
          "technique class the intended solution uses.",
      ),
  })
  .superRefine((value, ctx) => {
    if (value.prerequisite.includes(value.officialTopic)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["prerequisite"],
        message: `prerequisite must not include this problem's own officialTopic ("${value.officialTopic}")`,
      });
    }

    const duplicateCheck = (
      field: "prerequisite" | "commonTraps" | "expectedSolution",
      values: readonly string[],
    ) => {
      const unique = new Set(values);
      if (unique.size !== values.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `${field} must not contain duplicate entries; got [${values.join(", ")}]`,
        });
      }
    };

    duplicateCheck("prerequisite", value.prerequisite);
    duplicateCheck("commonTraps", value.commonTraps);
    duplicateCheck("expectedSolution", value.expectedSolution);
  })
  .describe("A single tagged problem: the seven §13 Problem Taxonomy tag dimensions.");

/** The static type inferred from {@link problemTagsSchema}. */
export type ProblemTags = z.infer<typeof problemTagsSchema>;

// --- the controlled vocabulary file ----------------------------------------

/** One named difficulty band, e.g. level 1 = "pengantar". */
const difficultyBandSchema = z.object({
  level: z
    .number()
    .int()
    .min(DIFFICULTY_MIN)
    .max(DIFFICULTY_MAX)
    .describe(`This band's position on the ${DIFFICULTY_MIN}-${DIFFICULTY_MAX} difficulty scale.`),
  id: z.enum(DIFFICULTY_BAND_IDS),
  label: nonEmptyString.describe("This band's printed label."),
  description: nonEmptyString.describe(
    "What kind of problem falls in this band, and the §2.2 stage(s) it is " +
      "typically associated with.",
  ),
});

/** One common-trap category with its label and description. */
const commonTrapEntrySchema = z.object({
  id: commonTrapIdSchema,
  label: nonEmptyString.describe("This trap category's printed label."),
  description: nonEmptyString.describe("What this trap looks like in practice."),
});

/** One expected-solution technique class with its label and description. */
const expectedSolutionClassEntrySchema = z.object({
  id: expectedSolutionClassIdSchema,
  label: nonEmptyString.describe("This solution class's printed label."),
  description: nonEmptyString.describe(
    "What this technique class is, and which §2.1 topic family or §2.2 " +
      "stage practice it is derived from.",
  ),
});

/**
 * The whole `data/problem-taxonomy-vocab.json` file: the controlled
 * vocabulary for the three open §13 tag dimensions (`difficulty`,
 * `commonTraps`, `expectedSolution`), plus the provenance fields
 * (`syllabusVersion`, `syllabusDate`, `sourceSection`) that let the corpus
 * carry its own versioning, per ADR-0005, and a `derivationNote`
 * explaining that -- unlike most `data/*.json` files -- this file's
 * contents are DERIVED rather than transcribed verbatim from a syllabus
 * table, because §13 names these dimensions without enumerating them.
 *
 * The `superRefine` below enforces that each vocabulary array contains
 * exactly the hardcoded id set above, each exactly once -- the same
 * "exactly these ids, no more, no fewer" shape `problemStatusFileSchema`
 * and `hintPolicyFileSchema` already enforce for their own id sets.
 */
export const problemTaxonomyVocabFileSchema = z
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
      'The syllabus section this file\'s dimensions are named by, "§13". ' +
        "The vocabulary values themselves are DERIVED -- see `derivationNote`.",
    ),
    derivationNote: nonEmptyString.describe(
      "A plain statement that the difficulty scale, common-trap " +
        "categories and expected-solution classes in this file are " +
        "DERIVED, not a verbatim §13 table (§13 names the dimensions but " +
        "not their values), together with a one-line summary of what each " +
        "was derived from.",
    ),
    difficultyScale: z
      .array(difficultyBandSchema)
      .length(DIFFICULTY_BAND_IDS.length)
      .describe(`The full ${DIFFICULTY_MIN}-${DIFFICULTY_MAX} difficulty scale, in band order.`),
    commonTraps: z
      .array(commonTrapEntrySchema)
      .length(COMMON_TRAP_IDS.length)
      .describe("The full set of common-trap categories."),
    expectedSolutionClasses: z
      .array(expectedSolutionClassEntrySchema)
      .length(EXPECTED_SOLUTION_CLASS_IDS.length)
      .describe("The full set of expected-solution technique classes."),
  })
  .superRefine((file, ctx) => {
    const checkExactSet = (
      field: "difficultyScale" | "commonTraps" | "expectedSolutionClasses",
      actualIds: readonly (string | number)[],
      expectedIds: readonly (string | number)[],
    ) => {
      const actual = new Set(actualIds);
      const expected = new Set(expectedIds);
      const isExact =
        actual.size === actualIds.length &&
        actual.size === expected.size &&
        [...expected].every((id) => actual.has(id));
      if (!isExact) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message:
            `${field} must contain exactly the ids [${expectedIds.join(", ")}], each once; ` +
            `got [${actualIds.join(", ")}]`,
        });
      }
    };

    checkExactSet(
      "difficultyScale",
      file.difficultyScale.map((band) => band.level),
      [...Array(DIFFICULTY_BAND_IDS.length)].map((_, index) => index + DIFFICULTY_MIN),
    );
    checkExactSet(
      "commonTraps",
      file.commonTraps.map((entry) => entry.id),
      COMMON_TRAP_IDS,
    );
    checkExactSet(
      "expectedSolutionClasses",
      file.expectedSolutionClasses.map((entry) => entry.id),
      EXPECTED_SOLUTION_CLASS_IDS,
    );
  })
  .describe(
    "The full contents of `data/problem-taxonomy-vocab.json`: the " +
      "controlled vocabulary for the open §13 Problem Taxonomy dimensions.",
  );

/** The static type inferred from {@link problemTaxonomyVocabFileSchema}. */
export type ProblemTaxonomyVocabFile = z.infer<typeof problemTaxonomyVocabFileSchema>;
