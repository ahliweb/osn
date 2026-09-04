/**
 * Verifies `docs/requirements/register.md` and `docs/requirements/traceability.md`
 * against the completeness rule described in `docs/requirements/README.md`:
 *
 *   1. Every requirement ID is unique and matches `^(FR|TR|OR|ER|GR)-\d{2}$`.
 *   2. Every requirement row has a non-empty source, statement, verification and
 *      issue reference, and the verification method is one of the fixed set.
 *   3. Every referenced issue number is in the range 1-26.
 *   4. Every syllabus section §1-§14 appears in the traceability matrix with at
 *      least one requirement.
 *   5. Every issue 1-26 appears in the traceability matrix with at least one
 *      requirement.
 *   6. No requirement ID appears in the traceability matrix that is absent from
 *      the register, and vice versa.
 *
 * All parsing is done against plain Markdown tables — no remark/markdown-it
 * dependency — so the functions here are pure string-in, string-out and are
 * exercised directly (not via a subprocess) by
 * `tests/integration/requirements.test.ts`.
 */

import { join } from "node:path";

export const VERIFICATION_METHODS = [
  "schema validation",
  "unit test",
  "integration test",
  "CI check",
  "document review",
] as const;

export type VerificationMethod = (typeof VERIFICATION_METHODS)[number];

export const STATUSES = ["planned", "implemented", "verified"] as const;

export type Status = (typeof STATUSES)[number];

export const REQUIREMENT_ID_PATTERN = /^(FR|TR|OR|ER|GR)-\d{2}$/;

export const MIN_ISSUE = 1;
export const MAX_ISSUE = 26;

export const MIN_SECTION = 1;
export const MAX_SECTION = 14;

export interface RegisterRow {
  readonly id: string;
  readonly title: string;
  readonly source: string;
  readonly statement: string;
  readonly verification: string;
  readonly issues: readonly number[];
  readonly status: string;
}

export interface SectionRow {
  readonly section: number;
  readonly label: string;
  readonly requirementIds: readonly string[];
  readonly issues: readonly number[];
  readonly status: string;
}

export interface IssueRow {
  readonly issue: number;
  readonly label: string;
  readonly requirementIds: readonly string[];
}

export interface MarkdownTable {
  readonly header: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

/** Splits a single `| a | b | c |` Markdown table row into trimmed cells. */
function splitRow(line: string): string[] {
  const trimmed = line.trim();
  const withoutEdges = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  return withoutEdges.split("|").map((cell) => cell.trim());
}

function isTableRow(line: string | undefined): line is string {
  if (line === undefined) return false;
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.length > 1;
}

function isSeparatorRow(line: string | undefined): boolean {
  if (line === undefined) return false;
  const trimmed = line.trim();
  return /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(trimmed);
}

/** Extracts every GFM pipe-table in a Markdown document, in document order. */
export function parseMarkdownTables(text: string): MarkdownTable[] {
  const lines = text.split("\n");
  const tables: MarkdownTable[] = [];
  let i = 0;

  while (i < lines.length) {
    const headerLine = lines[i];
    const separatorLine = lines[i + 1];

    if (isTableRow(headerLine) && isSeparatorRow(separatorLine)) {
      const header = splitRow(headerLine);
      i += 2;
      const rows: string[][] = [];

      while (i < lines.length && isTableRow(lines[i])) {
        const row = lines[i];
        if (row !== undefined) {
          rows.push(splitRow(row));
        }
        i += 1;
      }

      tables.push({ header, rows });
    } else {
      i += 1;
    }
  }

  return tables;
}

const REGISTER_HEADER = [
  "ID",
  "Title",
  "Source",
  "Statement",
  "Verification",
  "Issue(s)",
  "Status",
];
const SECTION_HEADER = ["Syllabus section", "Requirements", "Issues", "Status"];
const ISSUE_HEADER = ["Issue", "Requirements covered"];

function sameHeader(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((cell, index) => cell === b[index]);
}

function extractIssueNumbers(cell: string): number[] {
  const matches = cell.matchAll(/#(\d+)/g);
  const numbers: number[] = [];
  for (const match of matches) {
    const raw = match[1];
    if (raw !== undefined) numbers.push(Number.parseInt(raw, 10));
  }
  return numbers;
}

function extractRequirementIds(cell: string): string[] {
  if (cell.trim().length === 0) return [];
  return cell
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** Parses every `ID | Title | Source | ... | Status` table found in `register.md`. */
export function parseRegister(text: string): RegisterRow[] {
  const tables = parseMarkdownTables(text).filter((table) =>
    sameHeader(table.header, REGISTER_HEADER),
  );
  const rows: RegisterRow[] = [];

  for (const table of tables) {
    for (const cells of table.rows) {
      const id = cells[0] ?? "";
      const title = cells[1] ?? "";
      const source = cells[2] ?? "";
      const statement = cells[3] ?? "";
      const verification = cells[4] ?? "";
      const issuesCell = cells[5] ?? "";
      const status = cells[6] ?? "";

      rows.push({
        id,
        title,
        source,
        statement,
        verification,
        issues: extractIssueNumbers(issuesCell),
        status,
      });
    }
  }

  return rows;
}

/** Parses Matrix 1 ("Syllabus section → requirements → issues") from `traceability.md`. */
export function parseTraceabilitySections(text: string): SectionRow[] {
  const table = parseMarkdownTables(text).find((candidate) =>
    sameHeader(candidate.header, SECTION_HEADER),
  );
  if (table === undefined) return [];

  const rows: SectionRow[] = [];

  for (const cells of table.rows) {
    const label = cells[0] ?? "";
    const requirementsCell = cells[1] ?? "";
    const issuesCell = cells[2] ?? "";
    const status = cells[3] ?? "";
    const match = /^§(\d+)/.exec(label);
    if (match?.[1] === undefined) continue;

    rows.push({
      section: Number.parseInt(match[1], 10),
      label,
      requirementIds: extractRequirementIds(requirementsCell),
      issues: extractIssueNumbers(issuesCell),
      status,
    });
  }

  return rows;
}

/** Parses Matrix 2 ("Issue → requirements covered") from `traceability.md`. */
export function parseTraceabilityIssues(text: string): IssueRow[] {
  const table = parseMarkdownTables(text).find((candidate) =>
    sameHeader(candidate.header, ISSUE_HEADER),
  );
  if (table === undefined) return [];

  const rows: IssueRow[] = [];

  for (const cells of table.rows) {
    const label = cells[0] ?? "";
    const requirementsCell = cells[1] ?? "";
    const match = /^#(\d+)/.exec(label);
    if (match?.[1] === undefined) continue;

    rows.push({
      issue: Number.parseInt(match[1], 10),
      label,
      requirementIds: extractRequirementIds(requirementsCell),
    });
  }

  return rows;
}

/** Rule checks 1-3 from the module docblock, scoped to `register.md` alone. */
export function checkRegister(rows: readonly RegisterRow[]): string[] {
  const problems: string[] = [];

  if (rows.length === 0) {
    problems.push("register.md: no requirement rows were found (table header mismatch?)");
    return problems;
  }

  const seen = new Map<string, number>();

  for (const row of rows) {
    const context = `register.md: ${row.id || "(missing id)"}`;

    if (!REQUIREMENT_ID_PATTERN.test(row.id)) {
      problems.push(`${context}: ID "${row.id}" does not match ^(FR|TR|OR|ER|GR)-\\d{2}$`);
    } else {
      seen.set(row.id, (seen.get(row.id) ?? 0) + 1);
    }

    if (row.title.trim().length === 0) {
      problems.push(`${context}: Title is empty`);
    }
    if (row.source.trim().length === 0) {
      problems.push(`${context}: Source is empty`);
    }
    if (row.statement.trim().length === 0) {
      problems.push(`${context}: Statement is empty`);
    }
    if (row.verification.trim().length === 0) {
      problems.push(`${context}: Verification is empty`);
    } else if (!(VERIFICATION_METHODS as readonly string[]).includes(row.verification.trim())) {
      problems.push(
        `${context}: Verification "${row.verification}" is not one of ${VERIFICATION_METHODS.join(", ")}`,
      );
    }

    if (row.issues.length === 0) {
      problems.push(`${context}: Issue(s) is empty or names no #<number> issue`);
    }
    for (const issue of row.issues) {
      if (issue < MIN_ISSUE || issue > MAX_ISSUE) {
        problems.push(`${context}: references issue #${issue}, outside the 1-26 backlog range`);
      }
    }

    if (row.status.trim().length === 0) {
      problems.push(`${context}: Status is empty`);
    } else if (!(STATUSES as readonly string[]).includes(row.status.trim())) {
      problems.push(`${context}: Status "${row.status}" is not one of ${STATUSES.join(", ")}`);
    }
  }

  for (const [id, count] of seen) {
    if (count > 1) {
      problems.push(`register.md: ID "${id}" appears ${count} times (must be unique)`);
    }
  }

  return problems;
}

/** Rule checks 4-6 from the module docblock, cross-referencing both files. */
export function checkTraceability(
  registerRows: readonly RegisterRow[],
  sectionRows: readonly SectionRow[],
  issueRows: readonly IssueRow[],
): string[] {
  const problems: string[] = [];

  if (sectionRows.length === 0) {
    problems.push(
      'traceability.md: no "Syllabus section" matrix rows were found (table header mismatch?)',
    );
  }
  if (issueRows.length === 0) {
    problems.push('traceability.md: no "Issue" matrix rows were found (table header mismatch?)');
  }

  const sectionsSeen = new Map<number, SectionRow>();
  for (const row of sectionRows) {
    sectionsSeen.set(row.section, row);
  }
  for (let section = MIN_SECTION; section <= MAX_SECTION; section += 1) {
    const row = sectionsSeen.get(section);
    if (row === undefined) {
      problems.push(`traceability.md: §${section} is missing from the syllabus-section matrix`);
    } else if (row.requirementIds.length === 0) {
      problems.push(`traceability.md: §${section} has no requirements listed`);
    }
  }

  const issuesSeen = new Map<number, IssueRow>();
  for (const row of issueRows) {
    issuesSeen.set(row.issue, row);
  }
  for (let issue = MIN_ISSUE; issue <= MAX_ISSUE; issue += 1) {
    const row = issuesSeen.get(issue);
    if (row === undefined) {
      problems.push(`traceability.md: #${issue} is missing from the issue matrix`);
    } else if (row.requirementIds.length === 0) {
      problems.push(`traceability.md: #${issue} has no requirements listed`);
    }
  }

  const registerIds = new Set(registerRows.map((row) => row.id));
  const matrixIds = new Set<string>();
  for (const row of sectionRows) {
    for (const id of row.requirementIds) matrixIds.add(id);
  }
  for (const row of issueRows) {
    for (const id of row.requirementIds) matrixIds.add(id);
  }

  for (const id of registerIds) {
    if (!matrixIds.has(id)) {
      problems.push(
        `traceability.md: requirement ${id} is defined in register.md but absent from both matrices`,
      );
    }
  }
  for (const id of matrixIds) {
    if (!registerIds.has(id)) {
      problems.push(
        `traceability.md: requirement ${id} is referenced in a matrix but absent from register.md`,
      );
    }
  }

  return problems;
}

export interface CheckResult {
  readonly registerRows: readonly RegisterRow[];
  readonly sectionRows: readonly SectionRow[];
  readonly issueRows: readonly IssueRow[];
  readonly problems: readonly string[];
}

/** Runs every rule against the raw contents of `register.md` and `traceability.md`. */
export function runChecks(registerText: string, traceabilityText: string): CheckResult {
  const registerRows = parseRegister(registerText);
  const sectionRows = parseTraceabilitySections(traceabilityText);
  const issueRows = parseTraceabilityIssues(traceabilityText);

  const problems = [
    ...checkRegister(registerRows),
    ...checkTraceability(registerRows, sectionRows, issueRows),
  ];

  return { registerRows, sectionRows, issueRows, problems };
}

export function formatProblems(problems: readonly string[]): string {
  if (problems.length === 0) {
    return "check-requirements: OK — register and traceability matrices are consistent.";
  }
  const lines = problems.map((problem, index) => `  ${index + 1}. ${problem}`);
  return [`check-requirements: FAILED — ${problems.length} problem(s) found:`, ...lines].join("\n");
}

async function readRepoFile(relativePath: string): Promise<string> {
  const path = join(import.meta.dir, "..", relativePath);
  return Bun.file(path).text();
}

if (import.meta.main) {
  const [registerText, traceabilityText] = await Promise.all([
    readRepoFile("docs/requirements/register.md"),
    readRepoFile("docs/requirements/traceability.md"),
  ]);

  const { problems } = runChecks(registerText, traceabilityText);
  console.log(formatProblems(problems));
  process.exit(problems.length === 0 ? 0 : 1);
}
