/**
 * Tests for `src/cli/format-audit.ts`: the text/JSON formatters for `osn
 * validate`'s `AuditResult` output.
 */

import { describe, expect, test } from "bun:test";
import type { AuditResult } from "../../src/domain/corpus-audit";
import { formatAuditJson, formatAuditText } from "../../src/cli/format-audit";

const OK_RESULT: AuditResult = {
  ok: true,
  findings: [],
  summary: {
    filesValidated: 19,
    filesMissing: 0,
    filesUnregistered: 0,
    findingCount: 0,
    errorCount: 0,
    warningCount: 0,
  },
};

const FAILING_RESULT: AuditResult = {
  ok: false,
  findings: [
    {
      file: "weeks.json",
      path: "weeks.0.focus",
      message: "focus must not be empty",
      severity: "error",
    },
    {
      file: "weeks.json",
      path: "weeks",
      message: "week numbers must be exactly 1-28",
      severity: "error",
    },
    {
      file: "gates.json",
      path: "(file)",
      message: "invalid JSON: unexpected token",
      severity: "error",
    },
  ],
  summary: {
    filesValidated: 17,
    filesMissing: 0,
    filesUnregistered: 0,
    findingCount: 3,
    errorCount: 3,
    warningCount: 0,
  },
};

describe("formatAuditText", () => {
  test("a clean result reports OK with the file count and zero problems", () => {
    const text = formatAuditText(OK_RESULT, "/repo/data");
    expect(text).toContain("/repo/data");
    expect(text).toContain("OK");
    expect(text).toContain("19 data file(s) validated");
    expect(text).toContain("0 problem(s) found");
  });

  test("a failing result groups findings by file and sorts each file's findings by path", () => {
    const text = formatAuditText(FAILING_RESULT, "/repo/data");
    expect(text).toContain("FAILED");
    expect(text).toContain("3 problem(s) found");

    const weeksHeaderIndex = text.indexOf("weeks.json:");
    const gatesHeaderIndex = text.indexOf("gates.json:");
    expect(weeksHeaderIndex).toBeGreaterThan(-1);
    expect(gatesHeaderIndex).toBeGreaterThan(weeksHeaderIndex);

    // "weeks" (the file-level path) sorts before "weeks.0.focus" lexicographically.
    const weeksBlock = text.slice(weeksHeaderIndex, gatesHeaderIndex);
    const pathIndex = weeksBlock.indexOf("weeks:");
    const focusIndex = weeksBlock.indexOf("weeks.0.focus:");
    expect(pathIndex).toBeGreaterThan(-1);
    expect(focusIndex).toBeGreaterThan(pathIndex);

    expect(text).toContain("[error] (file): invalid JSON: unexpected token");
  });
});

describe("formatAuditJson", () => {
  test("round-trips through JSON.parse to an equivalent AuditResult", () => {
    const json = formatAuditJson(FAILING_RESULT);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(FAILING_RESULT);
  });

  test("a clean result parses with ok: true and an empty findings array", () => {
    const parsed = JSON.parse(formatAuditJson(OK_RESULT));
    expect(parsed.ok).toBe(true);
    expect(parsed.findings).toEqual([]);
  });
});
