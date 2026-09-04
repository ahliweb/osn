/**
 * Zod schema for a §7 decision playbook ("contoh implementasi praktis") --
 * one of the seven worked, directly executable operational playbooks
 * defined across §7.1-§7.7 of the syllabus corpus
 * (`docs/silabus/07-contoh-implementasi.md`), plus the whole-file wrapper
 * for `data/playbooks.json`.
 *
 * Per the layering rules in `docs/architecture/README.md`, this module must
 * never import from `src/domain/`. This module owns the *transcription* of
 * each playbook's decision rules and citations only; turning those rules
 * into an executable, testable decision (with a machine-readable outcome
 * and a human-readable justification) is a domain concern -- see
 * `src/domain/playbooks.ts` (issue #17).
 */

import { z } from "zod";
import { citationRefSchema, nonEmptyString, syllabusSectionSchema } from "./common";

/** The seven §7 playbook ids, in subsection (§7.1-§7.7) order. */
export const PLAYBOOK_IDS = [
  "constraint-to-complexity",
  "shortest-path-selection",
  "range-query-selection",
  "dp-design",
  "subtask-strategy",
  "stress-testing",
  "osn-k-tracing",
] as const;

/** The literal union of valid playbook ids. */
export const playbookIdSchema = z
  .enum(PLAYBOOK_IDS)
  .describe(`One of the seven §7 playbook ids: ${PLAYBOOK_IDS.join(", ")}.`);

/** The static type inferred from {@link playbookIdSchema}. */
export type PlaybookId = (typeof PLAYBOOK_IDS)[number];

/**
 * A single §7 decision playbook: a stable id, its title (the subsection
 * heading, minus the numeric prefix), the syllabus subsection it was
 * transcribed from, its summary paragraph and decision rules (both
 * verbatim Indonesian from that subsection, with any inline citation
 * markup stripped -- markup is carried separately in `citations`), and the
 * citation references that subsection's prose actually carries.
 */
export const playbookSchema = z
  .object({
    id: playbookIdSchema,
    title: nonEmptyString.describe(
      "This playbook's title, transcribed from its §7.x subsection " +
        "heading with the leading section number removed, e.g. " +
        '"Constraint menjadi kompleksitas" for §7.1.',
    ),
    sourceSection: syllabusSectionSchema.describe(
      'The §7.x subsection this playbook was transcribed from, e.g. "§7.1".',
    ),
    summary: nonEmptyString.describe(
      "This playbook's full subsection prose, verbatim (Indonesian), with " +
        'any inline citation markup (e.g. "[[R3]](99-referensi.md#r3)") ' +
        "stripped -- the citation itself is carried in `citations`, not in " +
        "this prose.",
    ),
    rules: z
      .array(nonEmptyString)
      .min(1)
      .describe(
        "This playbook's decision rules, one array entry per clause of " +
          "the subsection's prose (split at the clause boundaries -- " +
          "semicolons, commas separating alternatives, or sentence " +
          "breaks -- that separate one decision rule from the next), " +
          "verbatim (Indonesian) substrings of `summary`.",
      ),
    citations: z
      .array(citationRefSchema)
      .describe(
        "Citation references (R1-R41) actually present in this " +
          "subsection's prose. Empty for subsections whose prose carries " +
          "no citation link -- never invented. Only §7.5 (R3) and §7.7 " +
          "(R2) carry one.",
      ),
  })
  .strict()
  .describe("One of the seven §7 decision playbooks defined across §7.1-§7.7.");

/** The static type inferred from {@link playbookSchema}. */
export type Playbook = z.infer<typeof playbookSchema>;

/**
 * The whole `data/playbooks.json` file: the seven §7 decision playbooks
 * plus the provenance fields (`syllabusVersion`, `syllabusDate`,
 * `sourceSection`) that let the corpus carry its own versioning, per
 * ADR-0005.
 *
 * The `superRefine` below enforces the one property no single playbook can
 * express on its own: the file's playbooks must be exactly the seven
 * {@link PLAYBOOK_IDS}, each appearing exactly once (no duplicates, no
 * missing id, no extra id) -- the same pattern `problemStatusFileSchema`
 * (`src/schema/problem-status.ts`) and `kpiDefinitionsFileSchema`
 * (`src/schema/kpi.ts`) use for their own fixed id sets.
 */
export const playbooksFileSchema = z
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
      'The syllabus section the whole collection was transcribed from, "§7".',
    ),
    playbooks: z
      .array(playbookSchema)
      .length(PLAYBOOK_IDS.length)
      .describe(`The full set of ${PLAYBOOK_IDS.length} decision playbooks defined by §7.`),
  })
  .superRefine((file, ctx) => {
    const ids = file.playbooks.map((playbook) => playbook.id);
    const uniqueIds = new Set(ids);
    const expectedIds = new Set<string>(PLAYBOOK_IDS);
    const isExactlyTheSevenIds =
      ids.length === PLAYBOOK_IDS.length &&
      uniqueIds.size === ids.length &&
      [...uniqueIds].every((id) => expectedIds.has(id));

    if (!isExactlyTheSevenIds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["playbooks"],
        message:
          `playbooks must contain exactly the ${PLAYBOOK_IDS.length} ids ${PLAYBOOK_IDS.join(", ")}, ` +
          `each once, with no duplicates and no other ids; got [${ids.join(", ")}]`,
      });
    }
  })
  .describe(
    "The full contents of `data/playbooks.json`: the seven §7 decision " +
      "playbooks, with their corpus provenance.",
  );

/** The static type inferred from {@link playbooksFileSchema}. */
export type PlaybooksFile = z.infer<typeof playbooksFileSchema>;
