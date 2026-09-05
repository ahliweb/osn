/**
 * Thin typed parsing helpers over `src/schema/learning-record.ts`.
 *
 * **This repository defines schemas. It does not store learner data.**
 * There is no database, no file write, no network call anywhere in this
 * module or the schema it wraps -- `parseLearningRecord`/
 * `parseLearningRecords` accept a value already in memory (e.g. a fixture
 * in a test, or a record a downstream platform is about to store in its
 * *own* system) and return the validated, typed result. Nothing here
 * reads from or writes to `data/*.json`, unlike
 * `src/domain/topic-families.ts`/`structure.ts`/`assessment.ts`, because
 * ADR-0004 ("No learner personal data in the repository") means there is
 * no `data/learning-records.json` for this schema to load: real learner
 * data belongs to whatever downstream LMS/dashboard platform eventually
 * implements the programme, never to this repository. **A future
 * contributor must not add one.**
 *
 * Per the "Layering rules" in `docs/architecture/README.md`, this module
 * assumes the data it receives is valid once it has passed through the
 * schema: it never re-implements validation logic of its own.
 */

import type { z } from "zod";
import {
  LEARNING_RECORD_CLASSIFICATION,
  type LearningRecord,
  learningRecordSchema,
  type PrivacyClassification,
} from "../schema/learning-record";

/** One invalid record from a {@link parseLearningRecords} call, with its index in the input array. */
export interface LearningRecordIssue {
  /** The record's 0-indexed position in the array passed to {@link parseLearningRecords}. */
  readonly index: number;
  /** The failing field path within that record (`"(root)"` if the issue has no path). */
  readonly path: string;
  /** The Zod-reported validation message. */
  readonly message: string;
}

/**
 * Thrown by {@link parseLearningRecords} when one or more records fail
 * validation. Carries every issue found (not just the first), each tagged
 * with the index of the record it came from, so a single caught error is
 * enough to see every problem across the whole batch at once.
 */
export class LearningRecordsValidationError extends Error {
  readonly issues: readonly LearningRecordIssue[];

  constructor(issues: readonly LearningRecordIssue[]) {
    const lines = issues
      .map((issue) => `  - [index ${issue.index}] ${issue.path}: ${issue.message}`)
      .join("\n");
    super(`parseLearningRecords: ${issues.length} invalid record(s) found:\n${lines}`);
    this.name = "LearningRecordsValidationError";
    this.issues = issues;
  }
}

function zodIssuesToLearningRecordIssues(index: number, error: z.ZodError): LearningRecordIssue[] {
  return error.issues.map((issue) => ({
    index,
    path: issue.path.length > 0 ? issue.path.join(".") : "(root)",
    message: issue.message,
  }));
}

/**
 * Parses a single unknown value as a {@link LearningRecord}, throwing a
 * readable {@link Error} listing every validation issue (not just the
 * first) if it does not match {@link learningRecordSchema}.
 */
export function parseLearningRecord(value: unknown): LearningRecord {
  const result = learningRecordSchema.safeParse(value);
  if (result.success) {
    return result.data;
  }

  const issues = zodIssuesToLearningRecordIssues(0, result.error);
  const lines = issues.map((issue) => `  - ${issue.path}: ${issue.message}`).join("\n");
  throw new Error(`parseLearningRecord: invalid learning record:\n${lines}`);
}

/**
 * Parses an array of unknown values as {@link LearningRecord}s, returning
 * every parsed record if all are valid. If any are invalid, throws a
 * single {@link LearningRecordsValidationError} listing **every** invalid
 * record's index and issues -- not just the first invalid one -- so a
 * batch import can be fixed in one pass rather than one failure at a time.
 */
export function parseLearningRecords(values: readonly unknown[]): LearningRecord[] {
  const parsed: LearningRecord[] = [];
  const issues: LearningRecordIssue[] = [];

  values.forEach((value, index) => {
    const result = learningRecordSchema.safeParse(value);
    if (result.success) {
      parsed.push(result.data);
    } else {
      issues.push(...zodIssuesToLearningRecordIssues(index, result.error));
    }
  });

  if (issues.length > 0) {
    throw new LearningRecordsValidationError(issues);
  }

  return parsed;
}

/**
 * The privacy classification (`public` | `internal` | `personal`) for a
 * learning-record field name, or `undefined` if `field` is not a known
 * field. Backed by {@link LEARNING_RECORD_CLASSIFICATION}.
 */
export function classificationOf(field: string): PrivacyClassification | undefined {
  return LEARNING_RECORD_CLASSIFICATION[field];
}

/**
 * Whether `field` is classified `personal`. Always `false` today for
 * every real field of {@link LearningRecord} -- by ADR-0004's design, this
 * schema has no `personal` field -- but kept as a named predicate so
 * calling code does not have to know the exact classification string.
 */
export function isPersonalField(field: string): boolean {
  return classificationOf(field) === "personal";
}
