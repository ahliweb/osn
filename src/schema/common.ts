/**
 * Shared Zod primitives used by every curriculum schema under `src/schema/`.
 *
 * Per the layering rules in `docs/architecture/README.md`, this module must
 * never import from `src/domain/`: it only describes shape and constraints,
 * with no knowledge of the queries or business rules that later run over
 * validated data.
 */

import { z } from "zod";

/** A string that, after trimming surrounding whitespace, is non-empty. */
export const nonEmptyString = z.string().trim().min(1).describe("A trimmed, non-empty string.");

/**
 * A stable kebab-case identifier: lowercase letters and digits, grouped into
 * hyphen-separated segments (e.g. `dasar-pemrograman`). Used for every
 * curriculum record ID that other records reference by value.
 */
export const slugSchema = z
  .string()
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    'must be a kebab-case identifier: lowercase letters/digits, hyphen-separated (e.g. "dasar-pemrograman")',
  )
  .describe('A stable kebab-case identifier, e.g. "dasar-pemrograman".');

/**
 * A citation reference into `docs/silabus/99-referensi.md`, restricted to
 * the R1-R41 range that document actually defines (see the "Daftar
 * Referensi" section there).
 */
export const citationRefSchema = z
  .string()
  .regex(/^R([1-9]|[1-3][0-9]|4[01])$/, 'must be a citation ID in the range "R1"-"R41"')
  .describe(
    'A citation reference (e.g. "R1") into the numbered reference list in ' +
      "`docs/silabus/99-referensi.md`. Valid values are R1 through R41, the " +
      "full range that document currently defines.",
  );

/**
 * A reference to a source section of the syllabus corpus under
 * `docs/silabus/`, e.g. `§2.1`. Optionally carries one decimal subsection
 * level (`§4` or `§4.2`, not `§4.2.1`).
 */
export const syllabusSectionSchema = z
  .string()
  .regex(/^§\d+(\.\d+)?$/, 'must be a syllabus section reference such as "§2.1"')
  .describe(
    "A reference to a source section of the syllabus corpus under " +
      '`docs/silabus/`, e.g. "§2.1".',
  );

/** One reported problem from a failed schema parse, in `path: message` form. */
export interface DataFileIssue {
  readonly path: string;
  readonly message: string;
}

/**
 * Thrown by {@link parseDataFile} when a `data/*.json` file fails to
 * validate against its schema. Carries the source file name and every
 * reported issue (not just the first) so a single error message is enough
 * to fix the data file.
 */
export class CorpusValidationError extends Error {
  readonly sourceName: string;
  readonly issues: readonly DataFileIssue[];

  constructor(sourceName: string, issues: readonly DataFileIssue[]) {
    const issueLines = issues.map((issue) => `  - ${issue.path}: ${issue.message}`).join("\n");
    super(`${sourceName}: failed schema validation with ${issues.length} issue(s):\n${issueLines}`);
    this.name = "CorpusValidationError";
    this.sourceName = sourceName;
    this.issues = issues;
  }
}

/**
 * Parses unknown JSON (already `JSON.parse`d, so `unknown`, not a raw
 * string) through a Zod schema, returning the validated, typed value.
 *
 * On failure, throws a {@link CorpusValidationError} whose message names
 * `sourceName` and lists every issue Zod reported (not just the first) as
 * `path: message`. This is the single point, per
 * `docs/architecture/README.md`'s "Layering rules", where a `data/*.json`
 * file is validated — everything downstream may assume the result is valid.
 */
export function parseDataFile<T>(schema: z.ZodType<T>, raw: unknown, sourceName: string): T {
  const result = schema.safeParse(raw);
  if (result.success) {
    return result.data;
  }

  const issues: DataFileIssue[] = result.error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join(".") : "(root)",
    message: issue.message,
  }));

  throw new CorpusValidationError(sourceName, issues);
}
