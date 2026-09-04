/**
 * Tests for the learning-record schema (`src/schema/learning-record.ts`)
 * and its thin parsing helpers (`src/domain/learning-record.ts`).
 *
 * This is the most safety-sensitive test file in the repository: every
 * fixture here must be obviously synthetic (per ADR-0004 and
 * `AGENTS.md`'s Privacy section) -- pseudonymous `lr_...` refs, problem
 * ids like `problem-demo-1`, no plausible real name anywhere, including in
 * comments.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  LearningRecordsValidationError,
  classificationOf,
  isPersonalField,
  parseLearningRecord,
  parseLearningRecords,
} from "../../src/domain/learning-record";
import {
  DIRECT_IDENTIFIER_DENYLIST,
  ERROR_TAXONOMY_CLASSES,
  LEARNING_RECORD_CLASSIFICATION,
  RESOLVE_STATUSES,
  VERDICTS,
  assertNoDirectIdentifiers,
  findDirectIdentifiers,
  isDenylistedKey,
  learningRecordSchema,
  learningRecordShapeSchema,
} from "../../src/schema/learning-record";
import { PROBLEM_STATUS_CODES } from "../../src/schema/problem-status";

/** A well-formed, obviously synthetic learning record used across many tests below. */
const VALID_RECORD = {
  learnerRef: "lr_ab12cd34",
  problemId: "problem-demo-1",
  attemptNo: 1,
  verdict: "AC",
  durationSeconds: 300,
  hintLevelUsed: null,
  usedEditorial: false,
  errorTaxonomy: null,
  status: "A",
  resolveStatus: "not-required",
  recordedAt: "2026-09-04T10:00:00Z",
} as const;

describe("learningRecordSchema: valid record", () => {
  test("a well-formed synthetic pseudonymous record parses", () => {
    const result = learningRecordSchema.safeParse(VALID_RECORD);
    expect(result.success).toBe(true);
  });
});

describe("learningRecordSchema: .strict() rejects unknown keys", () => {
  test("rejects an unrelated unknown key", () => {
    const result = learningRecordSchema.safeParse({ ...VALID_RECORD, extraField: "nope" });
    expect(result.success).toBe(false);
  });
});

describe("learningRecordSchema: direct-identifier guard, top level", () => {
  const denylistedTopLevelFixtures: Record<string, unknown> = {
    name: "nope",
    email: "nope@example.invalid",
    nisn: "0012345678",
    sekolah: "nope",
    tanggalLahir: "2010-01-01",
  };

  for (const [key, value] of Object.entries(denylistedTopLevelFixtures)) {
    test(`rejects a record carrying a top-level "${key}" key`, () => {
      const result = learningRecordSchema.safeParse({ ...VALID_RECORD, [key]: value });
      expect(result.success).toBe(false);
    });
  }
});

describe("findDirectIdentifiers / assertNoDirectIdentifiers: recursive guard", () => {
  test("finds no violations in a clean, flat object", () => {
    expect(findDirectIdentifiers(VALID_RECORD)).toEqual([]);
    expect(() => assertNoDirectIdentifiers(VALID_RECORD)).not.toThrow();
  });

  const denylistedKeys = ["name", "email", "nisn", "sekolah", "tanggalLahir"] as const;

  for (const key of denylistedKeys) {
    test(`finds a top-level "${key}" key`, () => {
      const violations = findDirectIdentifiers({ [key]: "nope" });
      expect(violations.map((v) => v.key)).toContain(key);
    });

    test(`finds "${key}" nested inside a metadata object`, () => {
      const violations = findDirectIdentifiers({
        learnerRef: "lr_ab12cd34",
        metadata: { [key]: "nope" },
      });
      expect(violations.map((v) => v.key)).toContain(key);
    });

    test(`finds "${key}" nested inside an array element`, () => {
      const violations = findDirectIdentifiers({
        learnerRef: "lr_ab12cd34",
        history: [{ note: "ok" }, { [key]: "nope" }],
      });
      expect(violations.map((v) => v.key)).toContain(key);
    });

    test(`assertNoDirectIdentifiers throws for "${key}"`, () => {
      expect(() => assertNoDirectIdentifiers({ [key]: "nope" })).toThrow();
    });
  }

  test("reports every violation found, not just the first", () => {
    const violations = findDirectIdentifiers({
      name: "a",
      metadata: { email: "b" },
      history: [{ nisn: "c" }],
    });
    expect(violations.length).toBe(3);
  });

  describe("case-insensitive and snake/camel variants", () => {
    const variantFixtures: Record<string, unknown> = {
      Email: { Email: "nope@example.invalid" },
      student_name: { student_name: "nope" },
      birthDate: { birthDate: "2010-01-01" },
    };

    for (const [label, fixture] of Object.entries(variantFixtures)) {
      test(`isDenylistedKey / findDirectIdentifiers catch "${label}"`, () => {
        const [key] = Object.keys(fixture as Record<string, unknown>);
        expect(isDenylistedKey(key as string)).toBe(true);
        expect(findDirectIdentifiers(fixture).length).toBeGreaterThan(0);
      });
    }
  });

  test("does not flag an unrelated key that merely contains denylisted letters as a substring", () => {
    // "shipping" contains "ip" as a substring but is not itself a
    // denylisted word or word-boundary match -- the guard must not
    // false-positive on it.
    expect(isDenylistedKey("shippingNote")).toBe(false);
    expect(findDirectIdentifiers({ shippingNote: "ok" })).toEqual([]);
  });
});

describe("learnerRef validation", () => {
  test("rejects an email-shaped learnerRef", () => {
    const result = learningRecordSchema.safeParse({
      ...VALID_RECORD,
      learnerRef: "student@example.invalid",
    });
    expect(result.success).toBe(false);
  });

  test("accepts a valid pseudonymous learnerRef", () => {
    const result = learningRecordSchema.safeParse({ ...VALID_RECORD, learnerRef: "lr_ab12cd34" });
    expect(result.success).toBe(true);
  });

  test("rejects a too-short learnerRef", () => {
    const result = learningRecordSchema.safeParse({ ...VALID_RECORD, learnerRef: "lr_short" });
    expect(result.success).toBe(false);
  });

  test("rejects a learnerRef with uppercase characters", () => {
    const result = learningRecordSchema.safeParse({ ...VALID_RECORD, learnerRef: "lr_AB12CD34" });
    expect(result.success).toBe(false);
  });
});

describe("every enum value is representable", () => {
  test("every verdict is representable", () => {
    for (const verdict of VERDICTS) {
      const result = learningRecordSchema.safeParse({ ...VALID_RECORD, verdict });
      expect(result.success).toBe(true);
    }
  });

  test("every §13.1 error-taxonomy class is representable", () => {
    for (const errorTaxonomy of ERROR_TAXONOMY_CLASSES) {
      const result = learningRecordSchema.safeParse({
        ...VALID_RECORD,
        verdict: "WA",
        errorTaxonomy,
      });
      expect(result.success).toBe(true);
    }
  });

  test("errorTaxonomy null is representable", () => {
    const result = learningRecordSchema.safeParse({ ...VALID_RECORD, errorTaxonomy: null });
    expect(result.success).toBe(true);
  });

  test("every §6.2 A/B/C/D status is representable", () => {
    for (const status of PROBLEM_STATUS_CODES) {
      const result = learningRecordSchema.safeParse({ ...VALID_RECORD, status });
      expect(result.success).toBe(true);
    }
  });

  test("every resolveStatus is representable", () => {
    for (const resolveStatus of RESOLVE_STATUSES) {
      const result = learningRecordSchema.safeParse({ ...VALID_RECORD, resolveStatus });
      expect(result.success).toBe(true);
    }
  });

  test("every hintLevelUsed 1-5 is representable, plus null", () => {
    for (const hintLevelUsed of [1, 2, 3, 4, 5, null]) {
      const result = learningRecordSchema.safeParse({ ...VALID_RECORD, hintLevelUsed });
      expect(result.success).toBe(true);
    }
  });

  test("hintLevelUsed 0 and 6 are rejected", () => {
    expect(learningRecordSchema.safeParse({ ...VALID_RECORD, hintLevelUsed: 0 }).success).toBe(
      false,
    );
    expect(learningRecordSchema.safeParse({ ...VALID_RECORD, hintLevelUsed: 6 }).success).toBe(
      false,
    );
  });
});

describe("other field constraints", () => {
  test("rejects attemptNo <= 0", () => {
    expect(learningRecordSchema.safeParse({ ...VALID_RECORD, attemptNo: 0 }).success).toBe(false);
  });

  test("rejects a negative durationSeconds", () => {
    expect(learningRecordSchema.safeParse({ ...VALID_RECORD, durationSeconds: -1 }).success).toBe(
      false,
    );
  });

  test("accepts durationSeconds of exactly 0", () => {
    expect(learningRecordSchema.safeParse({ ...VALID_RECORD, durationSeconds: 0 }).success).toBe(
      true,
    );
  });

  test("rejects a non-ISO-8601 recordedAt", () => {
    expect(
      learningRecordSchema.safeParse({ ...VALID_RECORD, recordedAt: "2026-09-04" }).success,
    ).toBe(false);
  });

  test("rejects a recordedAt with a non-UTC offset", () => {
    expect(
      learningRecordSchema.safeParse({ ...VALID_RECORD, recordedAt: "2026-09-04T10:00:00+07:00" })
        .success,
    ).toBe(false);
  });
});

describe("parseLearningRecord", () => {
  test("returns the parsed record for valid input", () => {
    const record = parseLearningRecord(VALID_RECORD);
    expect(record.learnerRef).toBe("lr_ab12cd34");
  });

  test("throws a readable error for invalid input", () => {
    expect(() => parseLearningRecord({ ...VALID_RECORD, verdict: "NOT-A-VERDICT" })).toThrow();
  });
});

describe("parseLearningRecords", () => {
  test("returns every parsed record when all are valid", () => {
    const records = parseLearningRecords([
      VALID_RECORD,
      { ...VALID_RECORD, attemptNo: 2, learnerRef: "lr_ef56gh78" },
    ]);
    expect(records).toHaveLength(2);
  });

  test("reports ALL invalid indices at once, not just the first", () => {
    const batch = [
      VALID_RECORD,
      { ...VALID_RECORD, verdict: "NOT-A-VERDICT" }, // index 1: invalid
      { ...VALID_RECORD, learnerRef: "lr_ef56gh78" }, // index 2: valid
      { ...VALID_RECORD, attemptNo: -1 }, // index 3: invalid
    ];

    let caught: unknown;
    try {
      parseLearningRecords(batch);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(LearningRecordsValidationError);
    const validationError = caught as LearningRecordsValidationError;
    const invalidIndices = new Set(validationError.issues.map((issue) => issue.index));
    expect(invalidIndices.has(1)).toBe(true);
    expect(invalidIndices.has(3)).toBe(true);
    expect(invalidIndices.has(0)).toBe(false);
    expect(invalidIndices.has(2)).toBe(false);
  });
});

describe("classificationOf / isPersonalField", () => {
  test("returns the correct classification for a known field", () => {
    expect(classificationOf("learnerRef")).toBe("internal");
    expect(classificationOf("problemId")).toBe("public");
  });

  test("returns undefined for an unknown field", () => {
    expect(classificationOf("notAField")).toBeUndefined();
  });

  test("no learning-record field is classified personal", () => {
    for (const field of Object.keys(LEARNING_RECORD_CLASSIFICATION)) {
      expect(isPersonalField(field)).toBe(false);
    }
  });
});

describe("LEARNING_RECORD_CLASSIFICATION: no drift against the schema", () => {
  test("every schema field appears in the classification map", () => {
    const schemaFields = Object.keys(learningRecordShapeSchema.shape);
    for (const field of schemaFields) {
      expect(LEARNING_RECORD_CLASSIFICATION).toHaveProperty(field);
    }
  });

  test("every classification-map key is a real schema field", () => {
    const schemaFields = new Set(Object.keys(learningRecordShapeSchema.shape));
    for (const field of Object.keys(LEARNING_RECORD_CLASSIFICATION)) {
      expect(schemaFields.has(field)).toBe(true);
    }
  });
});

describe("docs/architecture/data-classification.md matches LEARNING_RECORD_CLASSIFICATION", () => {
  const docPath = join(
    import.meta.dir,
    "..",
    "..",
    "docs",
    "architecture",
    "data-classification.md",
  );
  const docText = readFileSync(docPath, "utf-8");

  function extractSection(markdown: string, heading: string): string {
    const startIndex = markdown.indexOf(heading);
    expect(startIndex).toBeGreaterThanOrEqual(0);
    const rest = markdown.slice(startIndex + heading.length);
    const nextHeadingIndex = rest.indexOf("\n## ");
    return nextHeadingIndex === -1 ? rest : rest.slice(0, nextHeadingIndex);
  }

  function parseFieldTable(section: string): Record<string, string> {
    const table: Record<string, string> = {};
    const lines = section.split("\n").filter((line) => line.trim().startsWith("|"));
    for (const line of lines) {
      const cells = line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim());
      const [rawField, classification] = cells;
      if (rawField === undefined || classification === undefined) continue;
      if (rawField.startsWith("Field") || rawField.startsWith("---") || rawField.startsWith(":--"))
        continue;
      const field = rawField.replace(/`/g, "").trim();
      if (field.length === 0) continue;
      table[field] = classification;
    }
    return table;
  }

  test("the doc table has exactly the same fields, with the same classifications", () => {
    const section = extractSection(docText, "## Learning Record (`src/schema/learning-record.ts`)");
    const docTable = parseFieldTable(section);

    expect(Object.keys(docTable).sort()).toEqual(
      Object.keys(LEARNING_RECORD_CLASSIFICATION).sort(),
    );
    for (const [field, classification] of Object.entries(LEARNING_RECORD_CLASSIFICATION)) {
      expect(docTable[field]).toBe(classification);
    }
  });
});

describe("no file under data/ contains any denylisted identifier key", () => {
  const dataDir = join(import.meta.dir, "..", "..", "data");
  const jsonFiles = readdirSync(dataDir).filter((name) => name.endsWith(".json"));

  /**
   * "name" is a documented, audited exception to an otherwise zero-
   * tolerance scan, for one reason: this repository's pre-existing
   * curriculum corpus (topic families, competition stages, curriculum
   * categories, assessment components, source-priority platforms --
   * every one of them landed by earlier issues, #9-#14, well before this
   * denylist existed) legitimately carries a `"name"` field for the
   * *entity's* printed name, e.g. `{ "id": "osn-k", "name": "OSN-K" }` in
   * `data/competition-stages.json`. None of it is a person's name, and
   * modifying those pre-existing files is out of scope for this issue.
   * Every OTHER denylisted term -- nama, email, phone/telepon, nik, nisn,
   * school/sekolah, address/alamat, birthdate/tanggalLahir, dob,
   * photo/foto, ip/ipAddress -- could never plausibly describe a
   * curriculum entity, so this scan holds those to real zero tolerance,
   * matching the GR-04 CI-scan intent in ADR-0004.
   *
   * Deliberately NOT asserted: an exact count of tolerated `"name"`
   * occurrences. Later curriculum datasets (playbooks, the assessment
   * bank, operational rules) legitimately add more named entities, so a
   * count assertion would fail for reasons that have nothing to do with
   * privacy. A test that routinely fails for non-security reasons trains
   * contributors to bump the number without reading it, which is a worse
   * outcome than not asserting it at all. The zero-tolerance half of this
   * scan is the part that carries security signal, and it is exact.
   *
   * Note that `name` is tolerated ONLY for curriculum data. On a learning
   * record -- the one place a `name` really would be a person's name --
   * the schema guard still rejects it outright, which is asserted above.
   */
  const TOLERATED_KEY = "name";

  test("the data/ directory actually has JSON files to check", () => {
    expect(jsonFiles.length).toBeGreaterThan(0);
  });

  for (const fileName of jsonFiles) {
    test(`${fileName} contains no denylisted identifier keys beyond the audited "name" exception`, () => {
      const raw = readFileSync(join(dataDir, fileName), "utf-8");
      const parsed: unknown = JSON.parse(raw);
      const violations = findDirectIdentifiers(parsed);
      const unexpected = violations.filter((violation) => violation.key !== TOLERATED_KEY);
      expect(unexpected).toEqual([]);
    });
  }
});

describe("DIRECT_IDENTIFIER_DENYLIST sanity", () => {
  test("carries the documented set of denylisted tokens", () => {
    const expected = [
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
    ];
    expect([...DIRECT_IDENTIFIER_DENYLIST].sort()).toEqual([...expected].sort());
  });
});
