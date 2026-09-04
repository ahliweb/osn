/**
 * Structural checks over the governance documents added by issue #24
 * (`SECURITY.md`, `docs/governance/security.md`,
 * `docs/governance/incident-response.md`), plus a cross-repository
 * "no invented contact" scan over every governance document (including
 * the pre-existing `docs/governance/privacy.md`).
 *
 * These are the same "doc cannot silently drift from what it must
 * contain" checks issue #23's `tests/unit/privacy-policy-doc.test.ts`
 * already applies to `docs/governance/privacy.md` -- extended to the
 * three documents this issue adds, and to the acceptance-criteria items
 * from issue #24 that are otherwise only reviewer-checked:
 *
 * - All fourteen §11 standards appear in `docs/governance/security.md`.
 * - Each of the six §13 security controls has a section there.
 * - The risk register's rows are all fully populated (no silently empty
 *   cell in a required column).
 * - `SECURITY.md` exists and actually has a reporting section.
 * - `docs/governance/incident-response.md` defines at least three
 *   severity levels, each with a stated response timeline.
 * - No governance document contains an invented-looking email address
 *   outside an explicitly-marked placeholder.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "..", "..");

const SECURITY_MD_PATH = join(REPO_ROOT, "SECURITY.md");
const GOVERNANCE_SECURITY_PATH = join(REPO_ROOT, "docs", "governance", "security.md");
const INCIDENT_RESPONSE_PATH = join(REPO_ROOT, "docs", "governance", "incident-response.md");
const PRIVACY_PATH = join(REPO_ROOT, "docs", "governance", "privacy.md");
const STANDARDS_JSON_PATH = join(REPO_ROOT, "data", "standards.json");

const securityMdText = readFileSync(SECURITY_MD_PATH, "utf-8");
const governanceSecurityText = readFileSync(GOVERNANCE_SECURITY_PATH, "utf-8");
const incidentResponseText = readFileSync(INCIDENT_RESPONSE_PATH, "utf-8");
const privacyText = readFileSync(PRIVACY_PATH, "utf-8");

type Standard = {
  id: string;
  designation: string;
  relevance: string;
  application: string;
  citation: string;
};

type StandardsFile = {
  standards: Standard[];
};

const standardsFile = JSON.parse(readFileSync(STANDARDS_JSON_PATH, "utf-8")) as StandardsFile;

/**
 * Extracts the Markdown section (from `heading` up to, but not
 * including, the next heading of the same or higher level) from
 * `markdown`. Mirrors the extraction helper `tests/unit/privacy-policy-
 * doc.test.ts` already uses for the same purpose, generalised to accept
 * any heading string.
 */
function extractSection(markdown: string, heading: string): string {
  const startIndex = markdown.indexOf(heading);
  expect(startIndex).toBeGreaterThanOrEqual(0);

  const rest = markdown.slice(startIndex + heading.length);
  const headingLevel = heading.match(/^#+/)?.[0].length ?? 1;
  const nextHeadingPattern = new RegExp(`\\n#{1,${headingLevel}} `);
  const nextHeadingIndex = rest.search(nextHeadingPattern);
  return nextHeadingIndex === -1 ? rest : rest.slice(0, nextHeadingIndex);
}

/**
 * Parses a GitHub-flavoured-Markdown pipe table into an array of rows,
 * each row an array of trimmed cell strings. Skips the header row and
 * the `---` separator row. Assumes a single table starting at the first
 * `|`-prefixed line found in `markdown`.
 */
function parseMarkdownTable(markdown: string): string[][] {
  const lines = markdown.split("\n").filter((line) => line.trim().startsWith("|"));
  // First `|` line is the header, second is the `---` separator.
  const dataLines = lines.slice(2);
  return dataLines.map((line) =>
    line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim()),
  );
}

describe("data/standards.json has all fourteen §11 standards", () => {
  test("the fixture itself has fourteen entries (sanity check on the assertion below)", () => {
    expect(standardsFile.standards.length).toBe(14);
  });
});

describe("docs/governance/security.md: all fourteen §11 standard ids appear", () => {
  for (const standard of standardsFile.standards) {
    test(`${standard.id} (${standard.designation}, ${standard.citation}) appears`, () => {
      expect(governanceSecurityText).toContain(standard.id);
    });
  }
});

describe("docs/governance/security.md: all six §13 security controls have a section", () => {
  const requiredControls = [
    "least privilege",
    "data minimisation",
    "secure auth",
    "logging",
    "backup",
    "incident procedure",
  ];

  const headings = [...governanceSecurityText.matchAll(/^#{2,4} .+$/gm)].map((match) =>
    match[0].toLowerCase(),
  );

  for (const control of requiredControls) {
    test(`a heading mentions "${control}"`, () => {
      const found = headings.some((heading) => heading.includes(control));
      expect(found).toBe(true);
    });
  }
});

describe("docs/governance/security.md: risk register rows are fully populated", () => {
  const section = extractSection(governanceSecurityText, "## Risk register");
  const rows = parseMarkdownTable(section);

  const REQUIRED_COLUMNS = 7; // ID, Description, Likelihood, Impact, Owner, Mitigations, Residual risk

  test("the register has at least five rows (the five risks issue #24 requires, at minimum)", () => {
    expect(rows.length).toBeGreaterThanOrEqual(5);
  });

  test("every row has exactly the required number of columns", () => {
    for (const row of rows) {
      expect(row.length).toBe(REQUIRED_COLUMNS);
    }
  });

  test("every cell in every row is non-empty", () => {
    for (const row of rows) {
      for (const cell of row) {
        expect(cell.length).toBeGreaterThan(0);
      }
    }
  });

  test("every row's id follows the RISK-nn pattern and ids are unique", () => {
    const ids = rows.map((row) => row[0]);
    for (const id of ids) {
      expect(id).toMatch(/^RISK-\d{2}$/);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("the five domain risks issue #24 names by scenario are all present", () => {
    const descriptions = rows.map((row) => row[1]?.toLowerCase() ?? "");
    const mustMention = [
      "minor", // minors' data exposure
      "leak", // contest integrity / problem leakage
      "judge", // judge availability during a contest
      "drift", // curriculum drift from the official syllabus
      "dependency", // dependency supply-chain compromise
    ];
    for (const term of mustMention) {
      const found = descriptions.some((description) => description.includes(term));
      expect(found).toBe(true);
    }
  });
});

describe("SECURITY.md exists and contains a reporting section", () => {
  test("has a 'Reporting a vulnerability' heading", () => {
    expect(securityMdText).toMatch(/^## Reporting a vulnerability/m);
  });

  test("states no production secrets/credentials/learner data are present, and to report anyway", () => {
    expect(securityMdText.toLowerCase()).toContain("no production secrets");
    expect(securityMdText.toLowerCase()).toContain("please report it anyway");
  });

  test("states supported versions", () => {
    expect(securityMdText).toContain("## Supported versions");
  });

  test("states expected acknowledgement/response timeframes as intentions, not guarantees", () => {
    expect(securityMdText).toContain("not guarantees");
  });

  test("states coordinated-disclosure expectations", () => {
    expect(securityMdText).toContain("## Coordinated disclosure");
  });

  test("marks the reporting contact as an explicit, not-yet-configured placeholder", () => {
    expect(securityMdText).toContain("[SECURITY-CONTACT-NOT-YET-CONFIGURED]");
    expect(securityMdText.toLowerCase()).toContain("contact placeholder");
  });
});

describe("docs/governance/incident-response.md: severity levels and response timeline", () => {
  const severitySection = extractSection(incidentResponseText, "## Severity levels");
  const severityRows = parseMarkdownTable(severitySection);

  const timelineSection = extractSection(incidentResponseText, "## Response timeline per severity");
  const timelineRows = parseMarkdownTable(timelineSection);

  test("at least three severity levels are defined", () => {
    expect(severityRows.length).toBeGreaterThanOrEqual(3);
  });

  test("every severity level has a non-empty name, definition, and example scenario", () => {
    for (const row of severityRows) {
      expect(row.length).toBeGreaterThanOrEqual(3);
      for (const cell of row) {
        expect(cell.length).toBeGreaterThan(0);
      }
    }
  });

  test("the response-timeline table defines the same severity levels", () => {
    const severityNames = severityRows.map((row) => row[0]);
    const timelineSeverityNames = timelineRows.map((row) => row[0]);
    for (const name of severityNames) {
      expect(timelineSeverityNames).toContain(name);
    }
  });

  test("every severity level has a stated (non-empty) response timeline for every timeline column", () => {
    for (const row of timelineRows) {
      // Columns: Severity, Acknowledge/triage, Containment, Resolution, Communication.
      expect(row.length).toBeGreaterThanOrEqual(4);
      for (const cell of row) {
        expect(cell.length).toBeGreaterThan(0);
      }
    }
  });

  test("defines roles as roles, and covers the UU 27/2022 personal-data-breach escalation duty", () => {
    expect(incidentResponseText).toContain("## Roles");
    expect(incidentResponseText).toContain("Incident Commander");
    expect(incidentResponseText).toContain("UU No. 27 Tahun 2022");
    expect(incidentResponseText.toLowerCase()).toContain("personal-data breach");
  });

  test("defines a post-incident review procedure", () => {
    expect(incidentResponseText).toContain("## Post-incident review");
  });

  test("marks contacts as explicit placeholders, not invented ones", () => {
    expect(incidentResponseText).toContain("NOT-YET-CONFIGURED");
    expect(incidentResponseText.toLowerCase()).toContain("contact placeholders");
  });
});

/**
 * "No invented-looking email address other than inside an explicitly-
 * marked placeholder."
 *
 * The robust rule this suite applies: scan every governance document for
 * any substring shaped like an email address (`local-part@domain.tld`,
 * the same permissive shape `tests/unit/privacy-policy-doc.test.ts`
 * already uses for `docs/governance/privacy.md`). This project's actual
 * placeholder convention is a **bracketed token**
 * (`[SOMETHING-NOT-YET-CONFIGURED]`), not an email-shaped placeholder
 * like `name@example.com` -- so the correct outcome, given that
 * convention, is that **zero** email-shaped substrings appear anywhere
 * in these documents at all. A future revision that legitimately needs
 * an email-shaped placeholder (e.g. `dpo@example.org`) would have to
 * both introduce it and update this test to allow-list that exact,
 * clearly-fake pattern -- which keeps the burden of proof on
 * demonstrating the address is a placeholder, not on this test guessing
 * which `@`-containing string is "probably fine."
 */
describe("no governance document contains an invented-looking email address", () => {
  const EMAIL_SHAPE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

  const documents: Array<[string, string]> = [
    ["SECURITY.md", securityMdText],
    ["docs/governance/security.md", governanceSecurityText],
    ["docs/governance/incident-response.md", incidentResponseText],
    ["docs/governance/privacy.md", privacyText],
  ];

  for (const [label, text] of documents) {
    test(`${label} contains no email-shaped substring`, () => {
      const matches = [...text.matchAll(EMAIL_SHAPE)];
      expect(matches.map((match) => match[0])).toEqual([]);
    });
  }
});
