/**
 * Runs the same completeness checks as `bun run check:requirements`, but
 * imports the checker's pure functions directly instead of shelling out, so
 * the requirements register is covered by `bun test` (and therefore by CI)
 * and its parsing/validation logic contributes to the coverage gate.
 *
 * See docs/requirements/README.md for what "the register is honest and
 * complete" means, and scripts/check-requirements.ts for the implementation.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  checkRegister,
  checkTraceability,
  formatProblems,
  type IssueRow,
  MAX_ISSUE,
  MAX_SECTION,
  MIN_ISSUE,
  MIN_SECTION,
  parseMarkdownTables,
  parseRegister,
  parseTraceabilityIssues,
  parseTraceabilitySections,
  REQUIREMENT_ID_PATTERN,
  type RegisterRow,
  runChecks,
  type SectionRow,
  STATUSES,
  VERIFICATION_METHODS,
} from "../../scripts/check-requirements";

const repoRoot = join(import.meta.dir, "..", "..");
const registerText = readFileSync(join(repoRoot, "docs", "requirements", "register.md"), "utf-8");
const traceabilityText = readFileSync(
  join(repoRoot, "docs", "requirements", "traceability.md"),
  "utf-8",
);

describe("docs/requirements/register.md and traceability.md", () => {
  test("pass the full completeness check with zero problems", () => {
    const result = runChecks(registerText, traceabilityText);
    expect(formatProblems(result.problems)).toBe(
      "check-requirements: OK — register and traceability matrices are consistent.",
    );
    expect(result.problems).toEqual([]);
  });

  test("register.md defines at least one requirement per FR/TR/OR/ER/GR prefix", () => {
    const rows = parseRegister(registerText);
    expect(rows.length).toBeGreaterThan(0);

    const prefixes = new Set(rows.map((row) => row.id.split("-")[0]));
    for (const prefix of ["FR", "TR", "OR", "ER", "GR"]) {
      expect(prefixes.has(prefix)).toBe(true);
    }
  });

  test("every requirement ID is unique and matches the ID scheme", () => {
    const rows = parseRegister(registerText);
    const ids = rows.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(REQUIREMENT_ID_PATTERN);
    }
  });

  test("every requirement cites a source, a statement and a known verification method", () => {
    const rows = parseRegister(registerText);
    for (const row of rows) {
      expect(row.source.length).toBeGreaterThan(0);
      expect(row.statement.length).toBeGreaterThan(0);
      expect(VERIFICATION_METHODS).toContain(
        row.verification as (typeof VERIFICATION_METHODS)[number],
      );
      expect(STATUSES).toContain(row.status as (typeof STATUSES)[number]);
    }
  });

  test("every requirement references at least one issue within #1-#26", () => {
    const rows = parseRegister(registerText);
    for (const row of rows) {
      expect(row.issues.length).toBeGreaterThan(0);
      for (const issue of row.issues) {
        expect(issue).toBeGreaterThanOrEqual(MIN_ISSUE);
        expect(issue).toBeLessThanOrEqual(MAX_ISSUE);
      }
    }
  });

  test("every syllabus section §1-§14 appears in the traceability matrix with a requirement", () => {
    const sectionRows = parseTraceabilitySections(traceabilityText);
    const bySection = new Map(sectionRows.map((row) => [row.section, row]));

    for (let section = MIN_SECTION; section <= MAX_SECTION; section += 1) {
      const row = bySection.get(section);
      expect(row).toBeDefined();
      expect(row?.requirementIds.length ?? 0).toBeGreaterThan(0);
    }
  });

  test("every issue #1-#26 appears in the traceability matrix with a requirement", () => {
    const issueRows = parseTraceabilityIssues(traceabilityText);
    const byIssue = new Map(issueRows.map((row) => [row.issue, row]));

    for (let issue = MIN_ISSUE; issue <= MAX_ISSUE; issue += 1) {
      const row = byIssue.get(issue);
      expect(row).toBeDefined();
      expect(row?.requirementIds.length ?? 0).toBeGreaterThan(0);
    }
  });

  test("no requirement ID is orphaned in either direction between register and matrices", () => {
    const registerRows = parseRegister(registerText);
    const sectionRows = parseTraceabilitySections(traceabilityText);
    const issueRows = parseTraceabilityIssues(traceabilityText);

    const registerIds = new Set(registerRows.map((row) => row.id));
    const matrixIds = new Set<string>();
    for (const row of [...sectionRows, ...issueRows]) {
      for (const id of row.requirementIds) matrixIds.add(id);
    }

    for (const id of registerIds) {
      expect(matrixIds.has(id)).toBe(true);
    }
    for (const id of matrixIds) {
      expect(registerIds.has(id)).toBe(true);
    }
  });
});

describe("check-requirements pure functions (unit-level, fixture-driven)", () => {
  test("parseMarkdownTables extracts header and rows from a minimal GFM table", () => {
    const text = ["| A | B |", "| --- | --- |", "| 1 | 2 |", "| 3 | 4 |"].join("\n");
    const tables = parseMarkdownTables(text);
    expect(tables).toHaveLength(1);
    expect(tables[0]?.header).toEqual(["A", "B"]);
    expect(tables[0]?.rows).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  test("parseMarkdownTables finds multiple tables and ignores non-table text", () => {
    const text = [
      "# Heading",
      "",
      "Some prose that is not a table.",
      "",
      "| ID | Title |",
      "| --- | --- |",
      "| FR-01 | Example |",
      "",
      "More prose.",
      "",
      "| Issue | Requirements covered |",
      "| --- | --- |",
      "| #1 | FR-01 |",
    ].join("\n");

    const tables = parseMarkdownTables(text);
    expect(tables).toHaveLength(2);
    expect(tables[0]?.header).toEqual(["ID", "Title"]);
    expect(tables[1]?.header).toEqual(["Issue", "Requirements covered"]);
  });

  test("parseRegister returns [] and checkRegister reports a header-mismatch problem when the table is absent", () => {
    const rows = parseRegister("# No tables here\n");
    expect(rows).toEqual([]);
    const problems = checkRegister(rows);
    expect(problems).toContain(
      "register.md: no requirement rows were found (table header mismatch?)",
    );
  });

  test("checkRegister flags a malformed ID, empty fields, an unknown verification method, an out-of-range issue and a bad status", () => {
    const badRows: RegisterRow[] = [
      {
        id: "XX-01",
        title: "",
        source: "",
        statement: "",
        verification: "vibes",
        issues: [27],
        status: "done",
      },
    ];
    const problems = checkRegister(badRows);
    expect(problems.some((p) => p.includes('ID "XX-01" does not match'))).toBe(true);
    expect(problems.some((p) => p.includes("Title is empty"))).toBe(true);
    expect(problems.some((p) => p.includes("Source is empty"))).toBe(true);
    expect(problems.some((p) => p.includes("Statement is empty"))).toBe(true);
    expect(problems.some((p) => p.includes('Verification "vibes"'))).toBe(true);
    expect(problems.some((p) => p.includes("references issue #27"))).toBe(true);
    expect(problems.some((p) => p.includes('Status "done"'))).toBe(true);
  });

  test("checkRegister flags an empty Issue(s) cell and a duplicate ID", () => {
    const rows: RegisterRow[] = [
      {
        id: "FR-01",
        title: "A",
        source: "§1",
        statement: "The system shall do a thing.",
        verification: "unit test",
        issues: [],
        status: "planned",
      },
      {
        id: "FR-01",
        title: "B",
        source: "§1",
        statement: "The system shall do another thing.",
        verification: "unit test",
        issues: [9],
        status: "planned",
      },
    ];
    const problems = checkRegister(rows);
    expect(problems.some((p) => p.includes("Issue(s) is empty"))).toBe(true);
    expect(problems.some((p) => p.includes('ID "FR-01" appears 2 times'))).toBe(true);
  });

  test("checkTraceability reports missing sections, missing issues and orphaned IDs in both directions", () => {
    const registerRows: RegisterRow[] = [
      {
        id: "FR-01",
        title: "Only requirement",
        source: "§1",
        statement: "The system shall do a thing.",
        verification: "unit test",
        issues: [9],
        status: "planned",
      },
    ];
    // Section matrix covers only §1 (of §1-§14) and references a requirement
    // that does not exist in the register (FR-99).
    const sectionRows: SectionRow[] = [
      {
        section: 1,
        label: "§1",
        requirementIds: ["FR-01", "FR-99"],
        issues: [9],
        status: "planned",
      },
    ];
    // Issue matrix covers only #9 (of #1-#26) and #9 has no requirements listed.
    const issueRows: IssueRow[] = [{ issue: 9, label: "#9", requirementIds: [] }];

    const problems = checkTraceability(registerRows, sectionRows, issueRows);

    expect(problems.some((p) => p.includes("§2 is missing"))).toBe(true);
    expect(problems.some((p) => p.includes("§14 is missing"))).toBe(true);
    expect(problems.some((p) => p.includes("#9 has no requirements listed"))).toBe(true);
    expect(problems.some((p) => p.includes("#1 is missing"))).toBe(true);
    expect(problems.some((p) => p.includes("#26 is missing"))).toBe(true);
    expect(
      problems.some((p) =>
        p.includes("FR-99 is referenced in a matrix but absent from register.md"),
      ),
    ).toBe(true);
  });

  test("checkTraceability reports a section present but with zero requirements", () => {
    const registerRows: RegisterRow[] = [];
    const sectionRows: SectionRow[] = Array.from({ length: 14 }, (_, index) => ({
      section: index + 1,
      label: `§${index + 1}`,
      requirementIds: index === 4 ? [] : ["FR-01"],
      issues: [1],
      status: "planned",
    }));
    const issueRows: IssueRow[] = Array.from({ length: 26 }, (_, index) => ({
      issue: index + 1,
      label: `#${index + 1}`,
      requirementIds: ["FR-01"],
    }));

    const problems = checkTraceability(registerRows, sectionRows, issueRows);
    expect(problems.some((p) => p.includes("§5 has no requirements listed"))).toBe(true);
  });

  test("formatProblems renders a numbered, human-readable list and a clean OK message", () => {
    expect(formatProblems([])).toBe(
      "check-requirements: OK — register and traceability matrices are consistent.",
    );
    const rendered = formatProblems(["first problem", "second problem"]);
    expect(rendered).toContain("FAILED — 2 problem(s) found");
    expect(rendered).toContain("1. first problem");
    expect(rendered).toContain("2. second problem");
  });

  test("parseTraceabilitySections and parseTraceabilityIssues return [] when their table is absent", () => {
    expect(parseTraceabilitySections("# nothing here\n")).toEqual([]);
    expect(parseTraceabilityIssues("# nothing here\n")).toEqual([]);
  });
});
