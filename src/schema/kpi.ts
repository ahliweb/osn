/**
 * Zod schema for a mentor KPI metric definition ("Metrik" / "Tujuan
 * penggunaan") -- one of the seven §6.3 "KPI dashboard mentor" metrics
 * defined in the syllabus corpus
 * (`docs/silabus/06-evaluasi-rubrik-kpi.md`), plus the whole-file wrapper
 * for `data/kpi-definitions.json`.
 *
 * Per the layering rules in `docs/architecture/README.md`, this module must
 * never import from `src/domain/`. This module owns the *definition* of
 * the seven metrics only (their name, purpose, unit, direction, inputs and
 * interpretation guidance); actually *computing* a metric from a batch of
 * learning records is a domain concern -- see `src/domain/kpi.ts` (issue
 * #16).
 *
 * `inputs` names the `LearningRecord` fields (`src/schema/learning-
 * record.ts`) a metric consumes. Validating each entry against
 * {@link LEARNING_RECORD_CLASSIFICATION}'s keys means this module imports
 * from `./learning-record` -- a schema importing another schema, which the
 * "Layering rules" allow; the forbidden direction is a `src/schema/` module
 * importing from `src/domain/`, not schema-to-schema.
 */

import { z } from "zod";
import { nonEmptyString, syllabusSectionSchema } from "./common";
import { LEARNING_RECORD_CLASSIFICATION } from "./learning-record";

/** The seven §6.3 KPI metric ids, in the table's row order. */
export const KPI_METRIC_IDS = [
  "status-distribution",
  "time-to-first-correct",
  "verdict-frequency",
  "upsolve-completion",
  "repeat-solve-retention",
  "complexity-selection-accuracy",
  "contest-time-allocation",
] as const;

/** The literal union of valid KPI metric ids. */
export const kpiMetricIdSchema = z
  .enum(KPI_METRIC_IDS)
  .describe(`One of the seven §6.3 KPI metric ids: ${KPI_METRIC_IDS.join(", ")}.`);

/** The static type inferred from {@link kpiMetricIdSchema}. */
export type KpiMetricId = (typeof KPI_METRIC_IDS)[number];

/**
 * The measurement unit a metric's computed value is expressed in. Not a
 * §6.3 table column -- the source table only names the metric and its
 * purpose -- this classification is DERIVED so downstream rendering
 * (issue #22) knows how to format a value without re-deriving it.
 */
export const KPI_UNITS = ["percent", "seconds", "distribution", "ratio"] as const;

/** The literal union of valid KPI units. */
export const kpiUnitSchema = z
  .enum(KPI_UNITS)
  .describe(`The unit a metric's computed value is expressed in: ${KPI_UNITS.join(", ")}.`);

/**
 * Whether a higher, lower, or neither computed value is preferable. Also
 * DERIVED (see {@link KPI_UNITS}): §6.3 states each metric's purpose but not
 * its directionality. `neutral` marks a metric that is itself a breakdown
 * or distribution rather than a single value with an obvious better/worse
 * direction (e.g. `status-distribution`'s per-topic A/B/C/D shares, or
 * `contest-time-allocation`'s strategy breakdown) -- even though some of
 * their *components* have an intuitive direction (e.g. a higher A-share is
 * better), the metric as a whole does not reduce to one.
 */
export const KPI_DIRECTIONS = ["higher-better", "lower-better", "neutral"] as const;

/** The literal union of valid KPI directions. */
export const kpiDirectionSchema = z
  .enum(KPI_DIRECTIONS)
  .describe(
    `Whether a higher, lower, or neither value is preferable: ${KPI_DIRECTIONS.join(", ")}.`,
  );

/**
 * The set of valid `LearningRecord` field names, sourced from
 * {@link LEARNING_RECORD_CLASSIFICATION}'s keys -- the single place that
 * enumerates them -- so this schema can never drift from
 * `src/schema/learning-record.ts`'s actual field set.
 */
const LEARNING_RECORD_FIELD_NAMES: ReadonlySet<string> = new Set(
  Object.keys(LEARNING_RECORD_CLASSIFICATION),
);

/**
 * A single §6.3 KPI metric definition: its id, its name and purpose
 * (verbatim from the §6.3 table), the unit and direction its computed
 * value carries, which `LearningRecord` fields feed it, and guidance on
 * how to interpret its computed value.
 *
 * `inputs` is validated (via `superRefine` below) against
 * {@link LEARNING_RECORD_FIELD_NAMES}, so a typo or a field renamed in
 * `src/schema/learning-record.ts` without updating this file fails
 * validation immediately, naming the offending entry and listing every
 * valid field name.
 */
export const kpiDefinitionSchema = z
  .object({
    id: kpiMetricIdSchema,
    name: nonEmptyString.describe(
      'This metric\'s name exactly as printed in the §6.3 "Metrik" ' +
        'column, e.g. "A/B/C/D per topic".',
    ),
    purpose: nonEmptyString.describe(
      "This metric's purpose, verbatim (Indonesian) from the §6.3 " + '"Tujuan penggunaan" column.',
    ),
    unit: kpiUnitSchema,
    direction: kpiDirectionSchema,
    inputs: z
      .array(nonEmptyString)
      .min(1)
      .describe(
        "The non-empty list of `LearningRecord` field names " +
          "(`src/schema/learning-record.ts`) this metric consumes, e.g. " +
          '["verdict", "durationSeconds"]. Every entry must be a real ' +
          "learning-record field name (validated by this schema's " +
          "`superRefine`).",
      ),
    interpretation: nonEmptyString.describe(
      "Guidance (DERIVED, not verbatim §6.3 text) on how to read this " +
        "metric's computed value -- what a high or low value suggests, " +
        "and any caveat specific to this metric (e.g. that " +
        "`complexity-selection-accuracy` is a proxy, not a direct " +
        "measurement).",
    ),
  })
  .strict()
  .superRefine((definition, ctx) => {
    const unknownInputs = definition.inputs.filter(
      (input) => !LEARNING_RECORD_FIELD_NAMES.has(input),
    );
    if (unknownInputs.length > 0) {
      const validFields = [...LEARNING_RECORD_FIELD_NAMES].join(", ");
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["inputs"],
        message:
          `inputs contains unknown learning-record field(s): ${unknownInputs.join(", ")}. ` +
          `Valid fields: ${validFields}.`,
      });
    }
  })
  .describe("One of the seven §6.3 mentor KPI metrics.");

/** The static type inferred from {@link kpiDefinitionSchema}. */
export type KpiDefinition = z.infer<typeof kpiDefinitionSchema>;

/**
 * The whole `data/kpi-definitions.json` file: the seven §6.3 KPI metric
 * definitions, the §14.2 rule 7 caveat ("Jumlah soal bukan satu-satunya
 * KPI; mastery dan transfer lebih penting.", verbatim), plus the
 * provenance fields (`syllabusVersion`, `syllabusDate`, `sourceSection`)
 * that let the corpus carry its own versioning, per ADR-0005.
 *
 * The `superRefine` below enforces the one property no single metric can
 * express on its own: the file's metrics must be exactly the seven
 * {@link KPI_METRIC_IDS}, each appearing exactly once (no duplicates, no
 * missing id, no extra id) -- the same pattern
 * `problemStatusFileSchema` (`src/schema/problem-status.ts`) uses for its
 * four A/B/C/D codes.
 */
export const kpiDefinitionsFileSchema = z
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
      "The syllabus section the whole collection was transcribed from, " + '"§6.3".',
    ),
    caveat: nonEmptyString.describe(
      "The §14.2 rule 7 caveat, verbatim (Indonesian): " +
        '"Jumlah soal bukan satu-satunya KPI; mastery dan transfer lebih ' +
        'penting." Every one of these seven metrics must be read ' +
        "alongside this caveat -- none of them, alone or together, are a " +
        "substitute for a mentor's own judgement of mastery and transfer.",
    ),
    metrics: z
      .array(kpiDefinitionSchema)
      .length(KPI_METRIC_IDS.length)
      .describe(`The full set of ${KPI_METRIC_IDS.length} KPI metrics defined by §6.3.`),
  })
  .superRefine((file, ctx) => {
    const ids = file.metrics.map((metric) => metric.id);
    const uniqueIds = new Set(ids);
    const expectedIds = new Set<string>(KPI_METRIC_IDS);
    const isExactlyTheSevenIds =
      ids.length === KPI_METRIC_IDS.length &&
      uniqueIds.size === ids.length &&
      [...uniqueIds].every((id) => expectedIds.has(id));

    if (!isExactlyTheSevenIds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["metrics"],
        message:
          `metrics must contain exactly the ${KPI_METRIC_IDS.length} ids ${KPI_METRIC_IDS.join(", ")}, ` +
          `each once, with no duplicates and no other ids; got [${ids.join(", ")}]`,
      });
    }
  })
  .describe(
    "The full contents of `data/kpi-definitions.json`: the seven §6.3 " +
      "mentor KPI metrics, the §14.2 rule 7 caveat, with their corpus " +
      "provenance.",
  );

/** The static type inferred from {@link kpiDefinitionsFileSchema}. */
export type KpiDefinitionsFile = z.infer<typeof kpiDefinitionsFileSchema>;
