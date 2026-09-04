/**
 * Unit tests for the pure privacy-scan logic
 * (`src/domain/privacy-scan.ts`) behind `osn privacy-check` (issue #23,
 * GR-04). These tests inject entries directly -- no filesystem access --
 * so they exercise `scanEntriesForDirectIdentifiers` in isolation from
 * `src/cli/privacy-scan-loader.ts`'s recursive directory read (covered
 * instead by `tests/integration/cli-privacy-check.test.ts`, against the
 * real CLI).
 */

import { describe, expect, test } from "bun:test";
import {
  TOLERATED_KEY,
  type PrivacyScanEntry,
  scanEntriesForDirectIdentifiers,
} from "../../src/domain/privacy-scan";

/** A sentinel value that must never appear anywhere in a finding's output -- findings carry only `file`/`path`/`key`, never the value found there. */
const SENTINEL_VALUE = "sentinel-value-must-never-leak-into-a-finding";

describe("scanEntriesForDirectIdentifiers: clean input", () => {
  test("returns no findings for entries with no denylisted keys", () => {
    const entries: PrivacyScanEntry[] = [
      { file: "topic-families.json", value: { id: "rekursi", label: "Rekursi" } },
      {
        file: "competition-stages.json",
        value: [{ id: "osn-k", label: "OSN-K", description: "..." }],
      },
    ];

    expect(scanEntriesForDirectIdentifiers(entries)).toEqual([]);
  });

  test("returns no findings for an empty entry list", () => {
    expect(scanEntriesForDirectIdentifiers([])).toEqual([]);
  });
});

describe("scanEntriesForDirectIdentifiers: a nested denylisted key is caught with its path", () => {
  test("finds an email nested inside a metadata object, reporting file/path/key", () => {
    const entries: PrivacyScanEntry[] = [
      {
        file: "samples/learning-records.sample.jsonl:7",
        value: {
          learnerRef: "lr_ab12cd34",
          metadata: { email: SENTINEL_VALUE },
        },
      },
    ];

    const findings = scanEntriesForDirectIdentifiers(entries);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toEqual({
      file: "samples/learning-records.sample.jsonl:7",
      path: "metadata",
      key: "email",
    });
  });

  test("finds a denylisted key nested inside an array element", () => {
    const entries: PrivacyScanEntry[] = [
      {
        file: "fixture.json",
        value: { history: [{ note: "ok" }, { nisn: SENTINEL_VALUE }] },
      },
    ];

    const findings = scanEntriesForDirectIdentifiers(entries);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.key).toBe("nisn");
    expect(findings[0]?.path).toBe("history.[1]");
  });

  test("reports every finding across multiple entries, not just the first", () => {
    const entries: PrivacyScanEntry[] = [
      { file: "a.json", value: { email: "x" } },
      { file: "b.json", value: { clean: true } },
      { file: "c.jsonl:1", value: { nested: { phone: "y" } } },
    ];

    const findings = scanEntriesForDirectIdentifiers(entries);
    expect(findings).toHaveLength(2);
    expect(findings.map((finding) => finding.file).sort()).toEqual(["a.json", "c.jsonl:1"]);
  });
});

describe("scanEntriesForDirectIdentifiers: the 'name' tolerance", () => {
  test("a top-level 'name' field (curriculum entity label) is not reported", () => {
    const entries: PrivacyScanEntry[] = [
      { file: "competition-stages.json", value: { id: "osn-k", name: "OSN-K" } },
    ];

    expect(scanEntriesForDirectIdentifiers(entries)).toEqual([]);
  });

  test("a nested 'name' field is also tolerated", () => {
    const entries: PrivacyScanEntry[] = [
      { file: "fixture.json", value: { wrapper: { name: "Some Entity" } } },
    ];

    expect(scanEntriesForDirectIdentifiers(entries)).toEqual([]);
  });

  test("TOLERATED_KEY is exactly 'name'", () => {
    expect(TOLERATED_KEY).toBe("name");
  });

  test("the tolerance does not extend to any other denylisted key alongside 'name'", () => {
    const entries: PrivacyScanEntry[] = [
      { file: "fixture.json", value: { name: "OSN-K", email: SENTINEL_VALUE } },
    ];

    const findings = scanEntriesForDirectIdentifiers(entries);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.key).toBe("email");
  });
});

describe("scanEntriesForDirectIdentifiers: values are never present in the finding output", () => {
  test("the sentinel value never appears anywhere in a finding, even when it is the identifier's value", () => {
    const entries: PrivacyScanEntry[] = [
      { file: "fixture.json", value: { email: SENTINEL_VALUE, phone: SENTINEL_VALUE } },
    ];

    const findings = scanEntriesForDirectIdentifiers(entries);
    const serialized = JSON.stringify(findings);
    expect(serialized).not.toContain(SENTINEL_VALUE);
    expect(findings.every((finding) => Object.keys(finding).sort())).toBeTruthy();
    for (const finding of findings) {
      expect(Object.keys(finding).sort()).toEqual(["file", "key", "path"]);
    }
  });
});

describe("scanEntriesForDirectIdentifiers: deterministic ordering", () => {
  test("findings are sorted by file, then path, then key", () => {
    const entries: PrivacyScanEntry[] = [
      { file: "z.json", value: { email: "1" } },
      { file: "a.json", value: { phone: "2", email: "3" } },
    ];

    const findings = scanEntriesForDirectIdentifiers(entries);
    expect(findings.map((finding) => `${finding.file}:${finding.key}`)).toEqual([
      "a.json:email",
      "a.json:phone",
      "z.json:email",
    ]);
  });
});
