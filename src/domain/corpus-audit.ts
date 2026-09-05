/**
 * Whole-corpus audit: the file->schema registry and the pure invariant
 * checks that back `osn validate` (issue #19).
 *
 * **This module is deliberately unlike every other module in
 * `src/domain/`.** Every other domain module owns a fixed static import of
 * the real `data/*.json` files, parses them once at module load, and throws
 * on the first problem found (see `docs/architecture/README.md`,
 * "Layering rules": "Validation happens at load, once"). That shape is
 * wrong for a corpus-wide *auditor* for two reasons specific to `osn
 * validate`'s job:
 *
 *  1. **Report every problem, not just the first.** A loader that throws on
 *     the first bad file can never tell you about the second bad file in
 *     the same run.
 *  2. **Testable against a fixture, not only the committed corpus.** A
 *     module that statically imports `../../data/weeks.json` can only ever
 *     see the real, committed file — there is no way to point it at a
 *     temp-directory copy with one file deliberately corrupted, which is
 *     exactly what `tests/unit/domain/corpus-audit.test.ts` and
 *     `tests/integration/cli-validate.test.ts` need to do to prove a
 *     corrupted corpus is reported precisely (path, message, exit code),
 *     not just "some domain module happened to throw somewhere."
 *
 * So this module takes the corpus as an explicit, injected {@link
 * CorpusSource} parameter instead: every function here is a pure function
 * of its arguments plus the schemas in `src/schema/` (never a data import),
 * has no side effects, and returns every finding it can, never throws for
 * an ordinary bad-data case. The one piece of I/O this whole file needs —
 * reading `data/*.json` off disk — deliberately lives in `src/cli/`
 * instead (see `src/cli/corpus-loader.ts`), which is where I/O belongs per
 * the "Layering rules". This file only ever consumes already-in-memory
 * `unknown` JSON values.
 *
 * Per those same layering rules, this module still only imports from
 * `src/schema/` (schema-to-domain is the allowed direction) and never from
 * `src/cli/` or `src/render/`.
 *
 * **On "reusing `assertNoDanglingCitations`":** issue #19 asks the
 * citation check to reuse `assertNoDanglingCitations`/the exported walker
 * from `src/domain/registers.ts`. That was not possible without breaking
 * the fixture-testability requirement above: `findDanglingCitations` in
 * `registers.ts` resolves every candidate citation against
 * `registers.ts`'s own eagerly-loaded, statically-imported
 * `data/references.json` — the *real*, committed file, regardless of what
 * corpus a caller is actually auditing. A fixture that corrupts a citation
 * to `"R99"` would still be (correctly) flagged, since `R99` is not a real
 * reference either way, but a fixture that instead *removes* a real
 * reference (e.g. deletes `R41` from a fixture copy of `references.json`)
 * would silently pass, because `registers.ts` would still resolve `R41`
 * against the real corpus. {@link findDanglingCitationsAgainst} below is
 * therefore a small, independent re-implementation of the same walk
 * (same recognition pattern, same recursive strategy), parameterised on an
 * injected known-id set instead of a module-level import, so it is correct
 * against whatever corpus it is actually given.
 */

import type { z } from "zod";
import {
  type AssessmentWeightsFile,
  assessmentWeightsFileSchema,
  TOTAL_ASSESSMENT_WEIGHT,
} from "../schema/assessment";
import {
  type AssessmentBankFile,
  assessmentBankFileSchema,
  BANK_KIND_IDS,
} from "../schema/assessment-bank";
import { CATEGORY_IDS, type CategoriesFile, categoriesFileSchema } from "../schema/category";
import { GATE_WEEKS, type GatesFile, gatesSchema } from "../schema/gate";
import { HINT_LEVEL_COUNT, type HintPolicyFile, hintPolicyFileSchema } from "../schema/hint-policy";
import { KPI_METRIC_IDS, type KpiDefinitionsFile, kpiDefinitionsFileSchema } from "../schema/kpi";
import { learningLoadFileSchema } from "../schema/learning-load";
import { mentorSopFileSchema } from "../schema/mentor-sop";
import {
  OPERATIONAL_RULE_COUNT,
  type OperationalRulesFile,
  operationalRulesFileSchema,
  QUICK_POINTER_STAGE_COUNT,
} from "../schema/operational-rules";
import { PLAYBOOK_IDS, type PlaybooksFile, playbooksFileSchema } from "../schema/playbook";
import {
  PROBLEM_STATUS_CODES,
  type ProblemStatusFile,
  problemStatusFileSchema,
} from "../schema/problem-status";
import { OFFICIAL_TOPIC_IDS, problemTaxonomyVocabFileSchema } from "../schema/problem-taxonomy";
import {
  READINESS_ITEM_COUNT,
  type ReadinessChecklistFile,
  readinessChecklistFileSchema,
} from "../schema/readiness-checklist";
import { type ReferencesFile, referencesFileSchema } from "../schema/reference";
import { regulationsFileSchema } from "../schema/regulation";
import {
  SESSION_TOTAL_MINUTES,
  type SessionTemplateFile,
  sessionTemplateFileSchema,
} from "../schema/session-template";
import { sourcePriorityFileSchema } from "../schema/source-priority";
import { STAGE_IDS, type StagesFile, stagesFileSchema } from "../schema/stage";
import { standardsFileSchema } from "../schema/standard";
import type { SyllabusCheckLogFile } from "../schema/syllabus-check";
import { syllabusCheckLogFileSchema } from "../schema/syllabus-check";
import { type TopicFamiliesFile, topicFamiliesSchema } from "../schema/topic-family";
import { MAX_WEEK, MIN_WEEK, type WeeksFile, weeksSchema } from "../schema/week";

// --- corpus source shape ---------------------------------------------------

/** One `data/*.json` file's content, already read and `JSON.parse`d by the caller (or a parse failure). */
export type CorpusEntry =
  | { readonly ok: true; readonly data: unknown }
  | { readonly ok: false; readonly error: string };

/**
 * The whole corpus, as an injected map of file name (e.g. `"weeks.json"`,
 * no directory prefix) to its {@link CorpusEntry}. Built by the caller
 * (`src/cli/corpus-loader.ts` reading the real `data/` directory, or a test
 * constructing one by hand or by reading a fixture directory) -- this
 * module never reads a filesystem itself.
 */
export type CorpusSource = ReadonlyMap<string, CorpusEntry>;

// --- findings ---------------------------------------------------------------

/** How serious a finding is. Every finding {@link auditCorpus} currently produces is `"error"`; the type allows for a future `"warning"` tier without a breaking change. */
export type FindingSeverity = "error" | "warning";

/** One reported problem, always naming the file and an in-file path so it is actionable without re-reading the whole corpus. */
export interface CorpusFinding {
  /** The `data/*.json` file name this finding is about, e.g. `"weeks.json"`. */
  readonly file: string;
  /** A path within that file, dot-separated (array indices in `[]`), or `"(file)"`/`"(root)"` when the finding is not about one field. */
  readonly path: string;
  readonly message: string;
  readonly severity: FindingSeverity;
}

/** Aggregate counts over an {@link AuditResult}'s findings, for a one-line summary. */
export interface AuditSummary {
  /** How many files in {@link DATA_FILE_REGISTRY} were present in the audited corpus and parsed successfully. */
  readonly filesValidated: number;
  /** How many files {@link DATA_FILE_REGISTRY} expects that were absent from the audited corpus. */
  readonly filesMissing: number;
  /** How many `.json` files were present in the audited corpus but are not covered by {@link DATA_FILE_REGISTRY}. */
  readonly filesUnregistered: number;
  readonly findingCount: number;
  readonly errorCount: number;
  readonly warningCount: number;
}

/** The full result of {@link auditCorpus}. */
export interface AuditResult {
  /** `true` exactly when `findings` is empty. */
  readonly ok: boolean;
  readonly findings: readonly CorpusFinding[];
  readonly summary: AuditSummary;
}

// --- the file -> schema registry --------------------------------------------

/** One entry of {@link DATA_FILE_REGISTRY}: a `data/*.json` file name and the schema it must parse against. */
export interface DataFileRegistryEntry {
  /** The file name, with no directory prefix, e.g. `"weeks.json"` (the real file is `data/weeks.json`). */
  readonly file: string;
  /** A short human description, used only in output/docs -- never parsed. */
  readonly description: string;
  readonly schema: z.ZodTypeAny;
}

/**
 * The explicit, typed file->schema registry every `data/*.json` file must
 * be listed in. This is the single source of truth `auditCorpus` uses to
 * decide (a) which schema a file must parse against and (b) whether a
 * `.json` file under `data/` that nobody wired up here should itself be
 * reported as a finding (see {@link auditCorpus}'s "unregistered file"
 * check) -- a new data file landing without a matching entry here is a bug
 * this registry is built specifically to catch, not to silently ignore.
 */
export const DATA_FILE_REGISTRY: readonly DataFileRegistryEntry[] = [
  {
    file: "assessment-bank.json",
    description: "The six §13 assessment-bank kinds.",
    schema: assessmentBankFileSchema,
  },
  {
    file: "assessment-weights.json",
    description: "The five §6.1 weighted internal assessment components.",
    schema: assessmentWeightsFileSchema,
  },
  {
    file: "competition-stages.json",
    description: "The four §2.2 competition stages.",
    schema: stagesFileSchema,
  },
  {
    file: "curriculum-categories.json",
    description: "The four §3 CORE/SUPPORT/EXTENSION/DE-PRIORITIZED categories.",
    schema: categoriesFileSchema,
  },
  {
    file: "gates.json",
    description: "The seven §4.1 phase gates.",
    schema: gatesSchema,
  },
  {
    file: "hint-policy.json",
    description: "The five §5.3 progressive-hinting escalation levels.",
    schema: hintPolicyFileSchema,
  },
  {
    file: "kpi-definitions.json",
    description: "The seven §6.3 mentor KPI metric definitions.",
    schema: kpiDefinitionsFileSchema,
  },
  {
    file: "learning-load.json",
    description: "The five §1.3 baseline learning-load components.",
    schema: learningLoadFileSchema,
  },
  {
    file: "mentor-sop.json",
    description: "The seven §5.2 mentor SOP steps.",
    schema: mentorSopFileSchema,
  },
  {
    file: "playbooks.json",
    description: "The seven §7 decision playbooks.",
    schema: playbooksFileSchema,
  },
  {
    file: "problem-status.json",
    description: "The four §6.2 A/B/C/D problem-completion statuses.",
    schema: problemStatusFileSchema,
  },
  {
    file: "problem-taxonomy-vocab.json",
    description: "The controlled vocabulary for the open §13 Problem Taxonomy dimensions.",
    schema: problemTaxonomyVocabFileSchema,
  },
  {
    file: "readiness-checklist.json",
    description: "The eight §14.1 cohort-readiness checklist items.",
    schema: readinessChecklistFileSchema,
  },
  {
    file: "operational-rules.json",
    description: "The eight §14.2 operational rules and the mentor quick-pointer callout.",
    schema: operationalRulesFileSchema,
  },
  {
    file: "syllabus-check-log.json",
    description: "The §14.2 rule 8 / Catatan Penutup syllabus-check log.",
    schema: syllabusCheckLogFileSchema,
  },
  {
    file: "references.json",
    description: "The 41 §99 references, R1-R41.",
    schema: referencesFileSchema,
  },
  {
    file: "regulations.json",
    description: "The seven §10 Indonesian regulations.",
    schema: regulationsFileSchema,
  },
  {
    file: "session-template.json",
    description: "The two §5.1 weekly sessions.",
    schema: sessionTemplateFileSchema,
  },
  {
    file: "source-priority.json",
    description: "The §12 mentor source-priority register.",
    schema: sourcePriorityFileSchema,
  },
  {
    file: "standards.json",
    description: "The 14 §11 ISO/IEC standards.",
    schema: standardsFileSchema,
  },
  {
    file: "topic-families.json",
    description: "The ten §2.1 official topic families.",
    schema: topicFamiliesSchema,
  },
  {
    file: "weeks.json",
    description: "The 28-week §4 operational syllabus.",
    schema: weeksSchema,
  },
];

const REGISTRY_BY_FILE: ReadonlyMap<string, DataFileRegistryEntry> = new Map(
  DATA_FILE_REGISTRY.map((entry) => [entry.file, entry]),
);

// --- small shared helpers ---------------------------------------------------

function error(file: string, path: string, message: string): CorpusFinding {
  return { file, path, message, severity: "error" };
}

/**
 * Reports a finding unless `actual` contains exactly the elements of
 * `expected`, each exactly once (order-independent on both sides). Used for
 * every "exactly these N ids/numbers, no more, no fewer, no duplicates"
 * structural invariant in {@link structuralInvariantFindings}.
 */
function findingsForExactSet<T extends string | number>(
  file: string,
  path: string,
  label: string,
  actual: readonly T[],
  expected: readonly T[],
): CorpusFinding[] {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const isExact =
    actual.length === actualSet.size &&
    actualSet.size === expectedSet.size &&
    [...expectedSet].every((value) => actualSet.has(value));

  if (isExact) {
    return [];
  }

  return [
    error(
      file,
      path,
      `${label} must be exactly [${expected.join(", ")}], each appearing once; got [${actual.join(", ")}]`,
    ),
  ];
}

// --- 1. schema conformance + registry coverage ------------------------------

/** The result of {@link schemaConformanceFindings}: findings, plus the successfully-parsed value for every registry file present and valid in the source. */
interface SchemaConformanceResult {
  readonly findings: readonly CorpusFinding[];
  /** Keyed by registry file name (e.g. `"weeks.json"`); only present when that file parsed successfully. */
  readonly parsed: ReadonlyMap<string, unknown>;
  readonly filesValidated: number;
  readonly filesMissing: number;
  readonly filesUnregistered: number;
}

/**
 * Checks every file in {@link DATA_FILE_REGISTRY} against `source`: missing
 * (finding), invalid JSON (finding), or fails its schema (one finding per
 * Zod issue, `path` set to the issue's own path or `"(root)"`). Also checks
 * the reverse direction: every `.json` file present in `source` that is
 * *not* in the registry is itself reported as a finding -- this is what
 * makes a new, unwired data file loud instead of silently ignored.
 */
function schemaConformanceFindings(source: CorpusSource): SchemaConformanceResult {
  const findings: CorpusFinding[] = [];
  const parsed = new Map<string, unknown>();
  let filesValidated = 0;
  let filesMissing = 0;

  for (const entry of DATA_FILE_REGISTRY) {
    const found = source.get(entry.file);

    if (found === undefined) {
      filesMissing += 1;
      findings.push(
        error(
          entry.file,
          "(file)",
          `required data file is missing from the corpus (expected at data/${entry.file})`,
        ),
      );
      continue;
    }

    if (!found.ok) {
      findings.push(error(entry.file, "(file)", `invalid JSON: ${found.error}`));
      continue;
    }

    const result = entry.schema.safeParse(found.data);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
        findings.push(error(entry.file, path, issue.message));
      }
      continue;
    }

    filesValidated += 1;
    parsed.set(entry.file, result.data);
  }

  let filesUnregistered = 0;
  for (const file of source.keys()) {
    if (!REGISTRY_BY_FILE.has(file)) {
      filesUnregistered += 1;
      findings.push(
        error(
          file,
          "(file)",
          "this data file is not covered by any schema in the CLI's file->schema registry " +
            "(DATA_FILE_REGISTRY in src/domain/corpus-audit.ts) -- add it there so it is validated " +
            "rather than silently ignored",
        ),
      );
    }
  }

  return { findings, parsed, filesValidated, filesMissing, filesUnregistered };
}

// --- 2. structural invariants ------------------------------------------------

/**
 * The fixed structural invariants named by issue #19: exact counts/id-sets
 * that no single file's own schema enforces (or that are worth restating
 * here as a corpus-wide, explicit check even where the schema already
 * enforces them -- e.g. the assessment weights summing to 100). Only runs
 * against files that parsed successfully; a file that failed schema
 * conformance already has its own finding(s) from
 * {@link schemaConformanceFindings} and is skipped here to avoid cascading
 * noise.
 */
function structuralInvariantFindings(parsed: ReadonlyMap<string, unknown>): CorpusFinding[] {
  const findings: CorpusFinding[] = [];

  const weeksFile = parsed.get("weeks.json") as WeeksFile | undefined;
  if (weeksFile !== undefined) {
    const expectedWeeks = Array.from(
      { length: MAX_WEEK - MIN_WEEK + 1 },
      (_, index) => index + MIN_WEEK,
    );
    findings.push(
      ...findingsForExactSet(
        "weeks.json",
        "weeks",
        "week numbers",
        weeksFile.weeks.map((week) => week.week),
        expectedWeeks,
      ),
    );
  }

  const gatesFile = parsed.get("gates.json") as GatesFile | undefined;
  if (gatesFile !== undefined) {
    findings.push(
      ...findingsForExactSet(
        "gates.json",
        "gates",
        "gate afterWeek values",
        gatesFile.gates.map((gate) => gate.afterWeek),
        GATE_WEEKS,
      ),
    );
  }

  const topicFamiliesFile = parsed.get("topic-families.json") as TopicFamiliesFile | undefined;
  if (topicFamiliesFile !== undefined) {
    findings.push(
      ...findingsForExactSet(
        "topic-families.json",
        "topicFamilies",
        "topic family ids",
        topicFamiliesFile.topicFamilies.map((family) => family.id),
        OFFICIAL_TOPIC_IDS,
      ),
    );
  }

  const referencesFile = parsed.get("references.json") as ReferencesFile | undefined;
  if (referencesFile !== undefined) {
    const expectedReferenceIds = Array.from({ length: 41 }, (_, index) => `R${index + 1}`);
    findings.push(
      ...findingsForExactSet(
        "references.json",
        "references",
        "reference ids",
        referencesFile.references.map((reference) => reference.id),
        expectedReferenceIds,
      ),
    );
  }

  const stagesFile = parsed.get("competition-stages.json") as StagesFile | undefined;
  if (stagesFile !== undefined) {
    findings.push(
      ...findingsForExactSet(
        "competition-stages.json",
        "stages",
        "stage ids",
        stagesFile.stages.map((stage) => stage.id),
        STAGE_IDS,
      ),
    );
  }

  const categoriesFile = parsed.get("curriculum-categories.json") as CategoriesFile | undefined;
  if (categoriesFile !== undefined) {
    findings.push(
      ...findingsForExactSet(
        "curriculum-categories.json",
        "categories",
        "category ids",
        categoriesFile.categories.map((category) => category.id),
        CATEGORY_IDS,
      ),
    );
  }

  const weightsFile = parsed.get("assessment-weights.json") as AssessmentWeightsFile | undefined;
  if (weightsFile !== undefined) {
    const sum = weightsFile.components.reduce((total, component) => total + component.weight, 0);
    if (sum !== TOTAL_ASSESSMENT_WEIGHT) {
      findings.push(
        error(
          "assessment-weights.json",
          "components",
          `component weights must sum to exactly ${TOTAL_ASSESSMENT_WEIGHT}; got ${sum}`,
        ),
      );
    }
  }

  const sessionFile = parsed.get("session-template.json") as SessionTemplateFile | undefined;
  if (sessionFile !== undefined) {
    for (const session of sessionFile.sessions) {
      const total = session.segments.reduce(
        (sum, segment) => sum + (segment.endMinute - segment.startMinute),
        0,
      );
      if (total !== SESSION_TOTAL_MINUTES) {
        findings.push(
          error(
            "session-template.json",
            `sessions[sessionNo=${session.sessionNo}].segments`,
            `session ${session.sessionNo}'s segments must sum to exactly ${SESSION_TOTAL_MINUTES} minutes; got ${total}`,
          ),
        );
      }
    }
  }

  const hintPolicyFile = parsed.get("hint-policy.json") as HintPolicyFile | undefined;
  if (hintPolicyFile !== undefined && hintPolicyFile.levels.length !== HINT_LEVEL_COUNT) {
    findings.push(
      error(
        "hint-policy.json",
        "levels",
        `must define exactly ${HINT_LEVEL_COUNT} hint levels; got ${hintPolicyFile.levels.length}`,
      ),
    );
  }

  const statusFile = parsed.get("problem-status.json") as ProblemStatusFile | undefined;
  if (statusFile !== undefined) {
    findings.push(
      ...findingsForExactSet(
        "problem-status.json",
        "statuses",
        "status codes",
        statusFile.statuses.map((status) => status.code),
        PROBLEM_STATUS_CODES,
      ),
    );
  }

  const kpiFile = parsed.get("kpi-definitions.json") as KpiDefinitionsFile | undefined;
  if (kpiFile !== undefined) {
    findings.push(
      ...findingsForExactSet(
        "kpi-definitions.json",
        "metrics",
        "KPI metric ids",
        kpiFile.metrics.map((metric) => metric.id),
        KPI_METRIC_IDS,
      ),
    );
  }

  const playbooksFile = parsed.get("playbooks.json") as PlaybooksFile | undefined;
  if (playbooksFile !== undefined) {
    findings.push(
      ...findingsForExactSet(
        "playbooks.json",
        "playbooks",
        "playbook ids",
        playbooksFile.playbooks.map((playbook) => playbook.id),
        PLAYBOOK_IDS,
      ),
    );
  }

  const bankFile = parsed.get("assessment-bank.json") as AssessmentBankFile | undefined;
  if (bankFile !== undefined) {
    findings.push(
      ...findingsForExactSet(
        "assessment-bank.json",
        "banks",
        "assessment bank kind ids",
        bankFile.banks.map((bank) => bank.id),
        BANK_KIND_IDS,
      ),
    );
  }

  const readinessChecklistFile = parsed.get("readiness-checklist.json") as
    | ReadinessChecklistFile
    | undefined;
  if (
    readinessChecklistFile !== undefined &&
    readinessChecklistFile.items.length !== READINESS_ITEM_COUNT
  ) {
    findings.push(
      error(
        "readiness-checklist.json",
        "items",
        `must define exactly ${READINESS_ITEM_COUNT} readiness-checklist items; got ${readinessChecklistFile.items.length}`,
      ),
    );
  }

  const operationalRulesFile = parsed.get("operational-rules.json") as
    | OperationalRulesFile
    | undefined;
  if (operationalRulesFile !== undefined) {
    if (operationalRulesFile.rules.length !== OPERATIONAL_RULE_COUNT) {
      findings.push(
        error(
          "operational-rules.json",
          "rules",
          `must define exactly ${OPERATIONAL_RULE_COUNT} operational rules; got ${operationalRulesFile.rules.length}`,
        ),
      );
    }
    if (operationalRulesFile.quickPointer.stages.length !== QUICK_POINTER_STAGE_COUNT) {
      findings.push(
        error(
          "operational-rules.json",
          "quickPointer.stages",
          `must define exactly ${QUICK_POINTER_STAGE_COUNT} quick-pointer stages; got ${operationalRulesFile.quickPointer.stages.length}`,
        ),
      );
    }
  }

  const syllabusCheckLogFile = parsed.get("syllabus-check-log.json") as
    | SyllabusCheckLogFile
    | undefined;
  if (syllabusCheckLogFile !== undefined && syllabusCheckLogFile.checks.length === 0) {
    findings.push(
      error(
        "syllabus-check-log.json",
        "checks",
        "the syllabus-check log must contain at least one entry; got an empty log",
      ),
    );
  }

  return findings;
}

// --- 3. referential integrity ------------------------------------------------

/**
 * Matches any bare `"R<digits>"` token, e.g. `"R1"`, `"R41"`, `"R99"`. See
 * this module's docblock for why this is a local re-implementation rather
 * than an import of `src/domain/registers.ts`'s private pattern.
 */
const CITATION_REF_PATTERN = /^R\d+$/;

/**
 * Recursively walks `value`, collecting every string that looks like a
 * citation id ({@link CITATION_REF_PATTERN}) but is not present in
 * `knownReferenceIds`. Pure function of its arguments -- the same shape as
 * `findDanglingCitations` in `src/domain/registers.ts`, but parameterised
 * on an injected id set instead of that module's own eagerly-loaded real
 * corpus (see this module's docblock).
 */
function findDanglingCitationsAgainst(
  value: unknown,
  file: string,
  knownReferenceIds: ReadonlySet<string>,
  path: readonly (string | number)[] = [],
): CorpusFinding[] {
  if (typeof value === "string") {
    if (CITATION_REF_PATTERN.test(value) && !knownReferenceIds.has(value)) {
      return [
        error(
          file,
          path.length > 0 ? path.join(".") : "(root)",
          `citation "${value}" does not resolve to any reference in data/references.json`,
        ),
      ];
    }
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      findDanglingCitationsAgainst(item, file, knownReferenceIds, [...path, index]),
    );
  }

  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) =>
      findDanglingCitationsAgainst(nested, file, knownReferenceIds, [...path, key]),
    );
  }

  return [];
}

/**
 * The four referential-integrity facts named by issue #19, each spanning
 * two files (so no single file's own schema can express it): week -> topic
 * family, week checkpoint numbering <-> gate weeks, assessment-bank
 * `servesStage` -> competition stage, and every `Rnn` citation anywhere in
 * the corpus -> the reference register. Only runs a given check when every
 * file it needs parsed successfully; a file that failed schema conformance
 * already has its own finding(s) and referential checks against it are
 * skipped to avoid cascading noise.
 *
 * `rawSource` (as opposed to `parsed`) is used for the citation walk
 * specifically, so a citation is still caught even inside a file that
 * otherwise parses cleanly through a schema field the citation walker
 * would not otherwise reach (e.g. free-text `notes`/`summary` prose) --
 * matching `assertNoDanglingCitations`'s own whole-corpus-raw-JSON sweep in
 * `src/domain/registers.ts`.
 */
function referentialIntegrityFindings(
  parsed: ReadonlyMap<string, unknown>,
  rawSource: CorpusSource,
): CorpusFinding[] {
  const findings: CorpusFinding[] = [];

  const weeksFile = parsed.get("weeks.json") as WeeksFile | undefined;
  const topicFamiliesFile = parsed.get("topic-families.json") as TopicFamiliesFile | undefined;
  const gatesFile = parsed.get("gates.json") as GatesFile | undefined;
  const stagesFile = parsed.get("competition-stages.json") as StagesFile | undefined;
  const bankFile = parsed.get("assessment-bank.json") as AssessmentBankFile | undefined;
  const referencesFile = parsed.get("references.json") as ReferencesFile | undefined;

  // (a) week -> topic family.
  if (weeksFile !== undefined && topicFamiliesFile !== undefined) {
    const knownFamilyIds = new Set(topicFamiliesFile.topicFamilies.map((family) => family.id));
    for (const week of weeksFile.weeks) {
      for (const familyId of week.topicFamilies) {
        if (!knownFamilyIds.has(familyId)) {
          findings.push(
            error(
              "weeks.json",
              `weeks[week=${week.week}].topicFamilies`,
              `references unknown topic family id "${familyId}" (not present in data/topic-families.json)`,
            ),
          );
        }
      }
    }
  }

  // (b) week checkpoint numbering <-> gate weeks.
  if (weeksFile !== undefined && gatesFile !== undefined) {
    const checkpointWeeks = weeksFile.weeks
      .filter((week) => week.checkpoint !== null)
      .sort((a, b) => a.week - b.week);
    const checkpointWeekNumbers = checkpointWeeks.map((week) => week.week);
    const gateWeekNumbers = [...gatesFile.gates]
      .map((gate) => gate.afterWeek)
      .sort((a, b) => a - b);

    const sameSet =
      checkpointWeekNumbers.length === gateWeekNumbers.length &&
      checkpointWeekNumbers.every((week, index) => week === gateWeekNumbers[index]);
    if (!sameSet) {
      findings.push(
        error(
          "weeks.json",
          "weeks[*].checkpoint",
          `weeks carrying a non-null checkpoint (weeks [${checkpointWeekNumbers.join(", ")}]) must ` +
            `exactly match the gate weeks in data/gates.json ([${gateWeekNumbers.join(", ")}])`,
        ),
      );
    }

    checkpointWeeks.forEach((week, index) => {
      const expectedCheckpoint = index + 1;
      if (week.checkpoint !== expectedCheckpoint) {
        findings.push(
          error(
            "weeks.json",
            `weeks[week=${week.week}].checkpoint`,
            `checkpoint number must be ${expectedCheckpoint} (checkpoint weeks are numbered ` +
              `1..N in ascending week order); got ${week.checkpoint}`,
          ),
        );
      }
    });
  }

  // (c) stage <-> assessment bank servesStage.
  if (bankFile !== undefined && stagesFile !== undefined) {
    const knownStageIds = new Set(stagesFile.stages.map((stage) => stage.id));
    for (const bank of bankFile.banks) {
      if (bank.servesStage !== null && !knownStageIds.has(bank.servesStage)) {
        findings.push(
          error(
            "assessment-bank.json",
            `banks[id=${bank.id}].servesStage`,
            `references unknown stage id "${bank.servesStage}" (not present in data/competition-stages.json)`,
          ),
        );
      }
    }
  }

  // (d) every Rnn citation anywhere in the corpus -> the reference register.
  if (referencesFile !== undefined) {
    const knownReferenceIds = new Set(referencesFile.references.map((reference) => reference.id));
    for (const [file, entry] of rawSource.entries()) {
      if (entry.ok) {
        findings.push(...findDanglingCitationsAgainst(entry.data, file, knownReferenceIds));
      }
    }
  }

  return findings;
}

// --- the public entry point --------------------------------------------------

/**
 * Audits `source` -- the full corpus, as file name -> {@link CorpusEntry} --
 * against every check issue #19 requires: schema conformance for every
 * registered file (plus the reverse "unregistered file" check), the
 * explicit structural invariants (28 weeks, 7 gates, 10 topic families, 41
 * references, 4 stages, 4 categories, 4 status codes, 7 KPI metrics, 7
 * playbooks, 6 assessment bank kinds, assessment weights summing to 100,
 * both session templates summing to 120 minutes, 5 hint levels), and
 * referential integrity (week -> topic family, week checkpoint numbering
 * <-> gate weeks, assessment-bank `servesStage` -> stage, every `Rnn`
 * citation -> the reference register).
 *
 * Always returns every finding it can in one pass -- never throws for an
 * ordinary bad-data case, and never stops at the first problem in a file or
 * the first bad file in the corpus.
 */
export function auditCorpus(source: CorpusSource): AuditResult {
  const schemaResult = schemaConformanceFindings(source);
  const structuralFindings = structuralInvariantFindings(schemaResult.parsed);
  const referentialFindings = referentialIntegrityFindings(schemaResult.parsed, source);

  const findings = [...schemaResult.findings, ...structuralFindings, ...referentialFindings];
  const errorCount = findings.filter((finding) => finding.severity === "error").length;
  const warningCount = findings.filter((finding) => finding.severity === "warning").length;

  return {
    ok: findings.length === 0,
    findings,
    summary: {
      filesValidated: schemaResult.filesValidated,
      filesMissing: schemaResult.filesMissing,
      filesUnregistered: schemaResult.filesUnregistered,
      findingCount: findings.length,
      errorCount,
      warningCount,
    },
  };
}
