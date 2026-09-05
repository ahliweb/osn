/**
 * Zod schema for a Learning Record ("Attempt, verdict, waktu, hint/
 * editorial status, error taxonomy, re-solve status") -- the §13 "Tata
 * Kelola Implementasi AhliKoding.com" Learning Record row
 * (`docs/silabus/13-tata-kelola.md`) -- together with the privacy
 * machinery ADR-0004 requires around it.
 *
 * **This is the most safety-sensitive schema in this repository.** The
 * programme's participants are school-age minors under UU No. 27 Tahun
 * 2022 (Pelindungan Data Pribadi). §10's "Data peserta di bawah umur"
 * callout requires data minimisation among other controls, and ADR-0004
 * ("No learner personal data in the repository") is the binding decision
 * this schema implements: a learning record identifies a learner only by
 * an opaque pseudonymous `learnerRef` (GR-03), never a name or other
 * direct identifier, and this repository stores no real learner data of
 * any kind -- see `src/domain/learning-record.ts`'s docblock and
 * ADR-0004 for the full reasoning.
 *
 * Two independent mechanical defences enforce that, per ADR-0004 §
 * "Decision detail: enforcement mechanism":
 *
 *  1. `learningRecordSchema` is built with `.strict()`, so any unknown key
 *     (e.g. a downstream platform bolting on a `name` field) is rejected
 *     outright -- this is the primary defence (GR-02).
 *  2. {@link findDirectIdentifiers} / {@link assertNoDirectIdentifiers}, a
 *     general-purpose recursive scanner against
 *     {@link DIRECT_IDENTIFIER_DENYLIST}, used both as a `.superRefine` on
 *     this schema (defence in depth alongside `.strict()`) and directly by
 *     `tests/unit/learning-record.test.ts`'s scan of every file under
 *     `data/` (GR-04) -- because the danger `.strict()` alone cannot catch
 *     is a *nested* identifier (e.g. a hypothetical `metadata: { email:
 *     ... } }` field), the scanner walks objects and arrays recursively.
 *
 * Per the layering rules in `docs/architecture/README.md`, this module
 * must never import from `src/domain/`.
 */

import { z } from "zod";
import { HINT_LEVEL_COUNT } from "./hint-policy";
import { problemStatusCodeSchema } from "./problem-status";
import { problemIdSchema } from "./problem-taxonomy";

// --- privacy classification -------------------------------------------

/**
 * The three privacy classifications a field in this corpus's learner-
 * facing schemas can carry. `personal` is reserved for a field that is
 * (or derives) a direct or indirect identifier -- by ADR-0004's design,
 * no field in {@link learningRecordSchema} is ever classified `personal`;
 * the classification exists as a category so the framework is meaningful
 * (and testable) even though this particular schema never uses it.
 */
export const PRIVACY_CLASSIFICATIONS = ["public", "internal", "personal"] as const;

/** The literal union of valid privacy classifications. */
export type PrivacyClassification = (typeof PRIVACY_CLASSIFICATIONS)[number];

export const privacyClassificationSchema = z.enum(PRIVACY_CLASSIFICATIONS);

/**
 * Field-by-field privacy classification for {@link learningRecordSchema},
 * machine-readable so it can be tested against both the schema's own
 * field set (`tests/unit/learning-record.test.ts`, "no drift") and the
 * table in `docs/architecture/data-classification.md` (same test file,
 * "doc matches map"). `problemId` is `public` because a problem's id is
 * already public curriculum content (defined in
 * `src/schema/problem-taxonomy.ts`); every other field is `internal`
 * because, even though none of them are direct identifiers, ADR-0004
 * itself notes that a pattern of problem-attempt behaviour is a
 * documented re-identification risk factor for a small, targeted cohort
 * -- so none of it belongs in a public view, only within a downstream
 * platform's own role-based access controls.
 */
export const LEARNING_RECORD_CLASSIFICATION: Readonly<Record<string, PrivacyClassification>> = {
  learnerRef: "internal",
  problemId: "public",
  attemptNo: "internal",
  verdict: "internal",
  durationSeconds: "internal",
  hintLevelUsed: "internal",
  usedEditorial: "internal",
  errorTaxonomy: "internal",
  status: "internal",
  resolveStatus: "internal",
  recordedAt: "internal",
};

// --- direct-identifier guard ---------------------------------------------

/**
 * Normalised (lowercase, separator-free) direct/indirect identifier
 * tokens. Every entry is a single "word" as produced by
 * {@link splitIntoWords}: matching is by exact word (or exact whole-key,
 * for compound single-word keys like `birthDate`), never substring, so a
 * legitimate key like `shippingNote` is never flagged just for containing
 * the letters "ip".
 */
export const DIRECT_IDENTIFIER_DENYLIST: ReadonlySet<string> = new Set([
  "name",
  "nama",
  "email",
  "phone",
  "telepon",
  "nik",
  "nisn",
  "school",
  "sekolah",
  "address",
  "alamat",
  "birthdate",
  "tanggallahir",
  "dob",
  "photo",
  "foto",
  "ip",
  "ipaddress",
]);

/**
 * Splits an object key into lowercase word segments on camelCase,
 * snake_case and kebab-case boundaries, e.g. `"student_name"` ->
 * `["student", "name"]`, `"birthDate"` -> `["birth", "date"]`, `"NISN"` ->
 * `["nisn"]`.
 */
function splitIntoWords(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[\s_-]+/)
    .map((segment) => segment.toLowerCase())
    .filter((segment) => segment.length > 0);
}

/**
 * Whether `key` matches {@link DIRECT_IDENTIFIER_DENYLIST}, either as a
 * whole (its word segments joined back together, e.g. `"birthDate"` ->
 * `"birthdate"`) or as one of its individual word segments (e.g.
 * `"student_name"` -> the segment `"name"`). Case-insensitive; both
 * snake_case and camelCase variants are covered by {@link splitIntoWords}.
 */
export function isDenylistedKey(key: string): boolean {
  const words = splitIntoWords(key);
  if (words.length === 0) {
    return false;
  }
  if (DIRECT_IDENTIFIER_DENYLIST.has(words.join(""))) {
    return true;
  }
  return words.some((word) => DIRECT_IDENTIFIER_DENYLIST.has(word));
}

/** One direct-identifier-shaped key found by {@link findDirectIdentifiers}. */
export interface DirectIdentifierViolation {
  /** Dot/bracket path to the offending key's parent, or `"(root)"`. */
  readonly path: string;
  /** The offending key itself. */
  readonly key: string;
}

/**
 * Recursively walks `value` (objects and arrays; any other type is a
 * leaf) looking for object keys that match
 * {@link DIRECT_IDENTIFIER_DENYLIST}, at any depth -- this is the
 * recursion `.strict()` alone cannot provide, since `.strict()` only
 * rejects unknown keys at the object level it is attached to. Returns
 * every violation found (not just the first), so a caller can report them
 * all at once.
 */
export function findDirectIdentifiers(
  value: unknown,
  path: readonly string[] = [],
): DirectIdentifierViolation[] {
  const violations: DirectIdentifierViolation[] = [];

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      violations.push(...findDirectIdentifiers(item, [...path, `[${index}]`]));
    });
    return violations;
  }

  if (value !== null && typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (isDenylistedKey(key)) {
        violations.push({ path: path.length > 0 ? path.join(".") : "(root)", key });
      }
      violations.push(...findDirectIdentifiers(nested, [...path, key]));
    }
  }

  return violations;
}

/**
 * Throws a readable {@link Error} naming every direct-identifier-shaped
 * key {@link findDirectIdentifiers} finds in `value`, or returns silently
 * if none are found.
 */
export function assertNoDirectIdentifiers(value: unknown): void {
  const violations = findDirectIdentifiers(value);
  if (violations.length === 0) {
    return;
  }

  const lines = violations
    .map((violation) => `  - ${violation.path}: key "${violation.key}"`)
    .join("\n");
  throw new Error(
    `assertNoDirectIdentifiers: found ${violations.length} direct-identifier-shaped key(s), ` +
      `not allowed per ADR-0004:\n${lines}`,
  );
}

// --- learnerRef -----------------------------------------------------------

/**
 * The required shape of an opaque pseudonymous learner reference: `lr_`
 * followed by 8-32 lowercase letters/digits, e.g. `"lr_ab12cd34"`.
 */
const LEARNER_REF_PATTERN = /^lr_[a-z0-9]{8,32}$/;

/**
 * The §13/§10 learner identifier: an opaque pseudonymous reference, never
 * a name, email, phone number, school or any other direct identifier
 * (GR-03). This value must be a pseudonym with **no derivable link to
 * identity** on its own -- mapping a `learnerRef` back to a real person is
 * entirely the responsibility of whatever downstream platform holds that
 * mapping under its own access controls (ADR-0004); it is never this
 * repository's concern, and this repository never stores that mapping.
 *
 * Rejects any value shaped like a direct identifier (containing `@`, or
 * looking like a phone number) independently of the base pattern check
 * below, so the rule is explicit and does not rely solely on the pattern
 * happening to exclude those characters.
 */
export const learnerRefSchema = z
  .string()
  .superRefine((value, ctx) => {
    const looksLikeEmail = value.includes("@");
    const looksLikePhone = /^\+?[\d\s().-]{7,}$/.test(value);
    if (looksLikeEmail || looksLikePhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'learnerRef must be an opaque pseudonym; it must not contain "@" or be shaped ' +
          "like a phone number (see ADR-0004).",
      });
    }
    if (!LEARNER_REF_PATTERN.test(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'learnerRef must match "lr_" followed by 8-32 lowercase letters/digits, e.g. ' +
          '"lr_ab12cd34".',
      });
    }
  })
  .describe(
    "classification: internal. An opaque pseudonymous learner reference " +
      '(e.g. "lr_ab12cd34") with no derivable link to identity. Mapping it ' +
      "back to a person is a downstream platform's responsibility under " +
      "its own access control -- never this repository's concern (ADR-0004, GR-03).",
  );

// --- verdict ---------------------------------------------------------------

/** The six judge verdicts a learning-record attempt can carry. */
export const VERDICTS = ["AC", "WA", "TLE", "RE", "CE", "MLE"] as const;

/** The literal union of valid verdicts. */
export const verdictSchema = z
  .enum(VERDICTS)
  .describe(
    `classification: internal. The attempt's judge verdict: one of ${VERDICTS.join(", ")}.`,
  );

// --- error taxonomy ---------------------------------------------------------

/**
 * The five §13.1 step-4 postmortem error classes, verbatim from "4.
 * Postmortem -> klasifikasi conceptual/modeling/complexity/implementation/
 * debugging error." (`docs/silabus/13-tata-kelola.md`).
 *
 * Note this is a distinct enumeration from `DIAGNOSIS_DIMENSIONS` in
 * `src/domain/assessment.ts` (§6.2's status-D gap-diagnosis dimensions,
 * which spells the first item "konsep" rather than "conceptual") -- the
 * two source tables (§6.2 and §13.1) describe a parallel five-way
 * breakdown in two different places with two different labels for the
 * first item; this is a pre-existing property of the syllabus corpus, not
 * a bug introduced here, and each module transcribes its own source
 * table's wording exactly.
 */
export const ERROR_TAXONOMY_CLASSES = [
  "conceptual",
  "modeling",
  "complexity",
  "implementation",
  "debugging",
] as const;

/** The literal union of valid error-taxonomy classes. */
export const errorTaxonomyClassSchema = z
  .enum(ERROR_TAXONOMY_CLASSES)
  .describe(
    `classification: internal. The §13.1 step-4 postmortem error class: one of ${ERROR_TAXONOMY_CLASSES.join(", ")}.`,
  );

// --- resolve status ---------------------------------------------------------

/** The four re-solve states a learning-record attempt can carry. */
export const RESOLVE_STATUSES = ["not-required", "scheduled", "completed", "overdue"] as const;

/** The literal union of valid resolve statuses. */
export const resolveStatusSchema = z
  .enum(RESOLVE_STATUSES)
  .describe(
    `classification: internal. The §13.1 step-5 upsolve/re-solve state: one of ${RESOLVE_STATUSES.join(", ")}.`,
  );

// --- the learning record itself ---------------------------------------------

/**
 * The learning-record object shape, exported separately (before
 * `.superRefine` wraps it below) so tests can read `.shape` off it
 * directly to check for classification-map drift, without needing to
 * unwrap a `ZodEffects`.
 */
export const learningRecordShapeSchema = z
  .object({
    learnerRef: learnerRefSchema,
    problemId: problemIdSchema.describe(
      "classification: public. The problem this attempt was made against " +
        "-- a problem id is already public curriculum content, defined in " +
        "src/schema/problem-taxonomy.ts.",
    ),
    attemptNo: z
      .number()
      .int()
      .positive()
      .describe(
        "classification: internal. This attempt's 1-indexed position " +
          "among this learner's attempts at this problem.",
      ),
    verdict: verdictSchema,
    durationSeconds: z
      .number()
      .int()
      .nonnegative()
      .describe(
        "classification: internal. Wall-clock time spent on this attempt, in whole seconds.",
      ),
    hintLevelUsed: z
      .union([z.number().int().min(1).max(HINT_LEVEL_COUNT), z.null()])
      .describe(
        `classification: internal. The highest §5.3 hint escalation level (1-${HINT_LEVEL_COUNT}) used on this attempt, or null if no hint was used.`,
      ),
    usedEditorial: z
      .boolean()
      .describe(
        "classification: internal. Whether this attempt used the terminal " +
          "§5.3 editorial hint level.",
      ),
    errorTaxonomy: errorTaxonomyClassSchema
      .nullable()
      .describe(
        "classification: internal. The §13.1 step-4 postmortem error " +
          "class for this attempt, or null if the attempt succeeded " +
          "(verdict AC) and no postmortem classification applies.",
      ),
    status: problemStatusCodeSchema.describe(
      "classification: internal. This attempt's §6.2 A/B/C/D problem-" + "completion status.",
    ),
    resolveStatus: resolveStatusSchema,
    recordedAt: z
      .string()
      .datetime()
      .describe(
        "classification: internal. When this record was captured, as an " +
          'ISO 8601 UTC datetime string (e.g. "2026-09-04T10:00:00Z").',
      ),
  })
  .strict();

/**
 * A single Learning Record: the §13 "Attempt, verdict, waktu, hint/
 * editorial status, error taxonomy, re-solve status" row, plus the §6.2
 * A/B/C/D status.
 *
 * `.strict()` (on {@link learningRecordShapeSchema}) is the primary
 * defence against a bolted-on direct-identifier field: an unrecognised
 * key fails validation outright. The `.superRefine` below adds the
 * recursive {@link findDirectIdentifiers} scan as defence in depth --
 * today's field set is flat (no nested object/array field could hide a
 * `metadata: { email: ... } }`), so this mostly future-proofs a schema
 * change that adds one, while giving a clear, ADR-0004-citing error
 * message rather than a generic "unrecognized key" one whenever it does
 * fire.
 */
export const learningRecordSchema = learningRecordShapeSchema.superRefine((value, ctx) => {
  const violations = findDirectIdentifiers(value);
  for (const violation of violations) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path:
        violation.path === "(root)"
          ? [violation.key]
          : [...violation.path.split("."), violation.key],
      message: `field "${violation.key}" looks like a direct or indirect personal identifier and is not allowed in a learning record (see ADR-0004).`,
    });
  }
});

/** The static type inferred from {@link learningRecordSchema}. */
export type LearningRecord = z.infer<typeof learningRecordSchema>;
