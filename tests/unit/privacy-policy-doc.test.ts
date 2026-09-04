/**
 * Asserts `docs/governance/privacy.md`'s "Must-not-collect list" stays in
 * lockstep with `DIRECT_IDENTIFIER_DENYLIST`
 * (`src/schema/learning-record.ts`), in both directions -- the same
 * "doc cannot drift from code" discipline
 * `tests/unit/learning-record.test.ts` already applies to
 * `docs/architecture/data-classification.md` and
 * `LEARNING_RECORD_CLASSIFICATION`.
 *
 * Without this test, a future change to `DIRECT_IDENTIFIER_DENYLIST` (a
 * token added or removed) could silently leave the privacy policy's
 * must-not-collect list stating something the code no longer enforces
 * (or vice versa) -- exactly the drift issue #23's acceptance criterion
 * "The policy is consistent with the schemas actually implemented" is
 * meant to prevent.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DIRECT_IDENTIFIER_DENYLIST } from "../../src/schema/learning-record";

const DOC_PATH = join(import.meta.dir, "..", "..", "docs", "governance", "privacy.md");

/**
 * Extracts every backticked token from a Markdown bullet list item shaped
 * like `- \`token\`` within the section of `markdown` that starts at
 * `heading` and runs until the next `##`/`###` heading of the same or
 * higher level.
 */
function extractMustNotCollectTokens(markdown: string): string[] {
  const heading = "### Must-not-collect list";
  const startIndex = markdown.indexOf(heading);
  expect(startIndex).toBeGreaterThanOrEqual(0);

  const rest = markdown.slice(startIndex + heading.length);
  const nextHeadingIndex = rest.search(/\n#{1,6} /);
  const section = nextHeadingIndex === -1 ? rest : rest.slice(0, nextHeadingIndex);

  const tokens: string[] = [];
  for (const line of section.split("\n")) {
    const match = /^-\s*`([^`]+)`\s*$/.exec(line.trim());
    if (match?.[1] !== undefined) {
      tokens.push(match[1]);
    }
  }
  return tokens;
}

describe("docs/governance/privacy.md matches DIRECT_IDENTIFIER_DENYLIST", () => {
  const docText = readFileSync(DOC_PATH, "utf-8");
  const docTokens = extractMustNotCollectTokens(docText);
  const codeTokens = [...DIRECT_IDENTIFIER_DENYLIST];

  test("the doc's must-not-collect list is non-empty (the heading and list format didn't silently break)", () => {
    expect(docTokens.length).toBeGreaterThan(0);
  });

  test("every DIRECT_IDENTIFIER_DENYLIST token appears in the doc's must-not-collect list", () => {
    for (const token of codeTokens) {
      expect(docTokens).toContain(token);
    }
  });

  test("every token in the doc's must-not-collect list is a real DIRECT_IDENTIFIER_DENYLIST entry", () => {
    for (const token of docTokens) {
      expect(DIRECT_IDENTIFIER_DENYLIST.has(token)).toBe(true);
    }
  });

  test("the two sets are exactly equal, with no duplicates on either side", () => {
    expect([...docTokens].sort()).toEqual([...codeTokens].sort());
    expect(new Set(docTokens).size).toBe(docTokens.length);
  });
});

describe("docs/governance/privacy.md: other required content is present", () => {
  const docText = readFileSync(DOC_PATH, "utf-8");

  test("states the repository holds no learner data", () => {
    expect(docText).toContain("This repository stores no learner data");
  });

  test("states plainly that subjects are minors", () => {
    expect(docText).toContain("## Subjects are minors");
  });

  test("cites R19, R20 and R21", () => {
    expect(docText).toContain("R19");
    expect(docText).toContain("R20");
    expect(docText).toContain("R21");
  });

  test("cross-links data-classification.md and ADR-0004", () => {
    expect(docText).toContain("docs/architecture/data-classification.md");
    expect(docText).toContain("adr/0004-no-learner-personal-data.md");
  });

  test("includes a role-based access matrix naming all four roles", () => {
    expect(docText).toContain("## Role-based access");
    for (const role of ["Learner", "Mentor", "Curriculum board", "Administrator"]) {
      expect(docText).toContain(role);
    }
  });

  test("includes a retention schedule and deletion procedure", () => {
    expect(docText).toContain("## Retention schedule");
    expect(docText).toContain("### Deletion procedure");
  });

  test("includes a clearly-marked placeholder for the data-subject-rights contact, not an invented one", () => {
    expect(docText).toContain("[PLACEHOLDER");
    expect(docText).not.toMatch(/[a-zA-Z0-9._%+-]+@(?!example)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  });

  test("states this document is not a legal opinion / requires legal review", () => {
    expect(docText.toLowerCase()).toContain("not a legal opinion");
    expect(docText.toLowerCase()).toContain("legal review");
  });
});
