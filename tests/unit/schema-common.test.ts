/**
 * Tests for the shared Zod primitives in `src/schema/common.ts`: each
 * primitive accepts valid input and rejects invalid input (including the
 * citation-ref boundaries R1/R41), `parseDataFile` reports every issue (not
 * just the first) and names the source file, and `CorpusValidationError`
 * carries its fields.
 */

import { describe, expect, test } from "bun:test";
import { z } from "zod";
import {
  citationRefSchema,
  CorpusValidationError,
  nonEmptyString,
  parseDataFile,
  slugSchema,
  syllabusSectionSchema,
} from "../../src/schema/common";

describe("nonEmptyString", () => {
  test("accepts a plain non-empty string", () => {
    expect(nonEmptyString.parse("hello")).toBe("hello");
  });

  test("trims surrounding whitespace", () => {
    expect(nonEmptyString.parse("  hello  ")).toBe("hello");
  });

  test("rejects an empty string", () => {
    expect(nonEmptyString.safeParse("").success).toBe(false);
  });

  test("rejects a whitespace-only string", () => {
    expect(nonEmptyString.safeParse("   ").success).toBe(false);
  });

  test("rejects a non-string value", () => {
    expect(nonEmptyString.safeParse(42).success).toBe(false);
  });

  test("carries a describe() text", () => {
    expect(nonEmptyString.description).toBeDefined();
    expect(nonEmptyString.description?.length).toBeGreaterThan(0);
  });
});

describe("slugSchema", () => {
  test("accepts a simple kebab-case slug", () => {
    expect(slugSchema.parse("dasar-pemrograman")).toBe("dasar-pemrograman");
  });

  test("accepts a single-word slug", () => {
    expect(slugSchema.parse("rekursi")).toBe("rekursi");
  });

  test("accepts digits within a segment", () => {
    expect(slugSchema.parse("phase-2-gate")).toBe("phase-2-gate");
  });

  test("rejects uppercase letters", () => {
    expect(slugSchema.safeParse("Dasar-Pemrograman").success).toBe(false);
  });

  test("rejects a leading hyphen", () => {
    expect(slugSchema.safeParse("-dasar").success).toBe(false);
  });

  test("rejects a trailing hyphen", () => {
    expect(slugSchema.safeParse("dasar-").success).toBe(false);
  });

  test("rejects a double hyphen", () => {
    expect(slugSchema.safeParse("dasar--pemrograman").success).toBe(false);
  });

  test("rejects spaces", () => {
    expect(slugSchema.safeParse("dasar pemrograman").success).toBe(false);
  });

  test("rejects underscores", () => {
    expect(slugSchema.safeParse("dasar_pemrograman").success).toBe(false);
  });

  test("rejects an empty string", () => {
    expect(slugSchema.safeParse("").success).toBe(false);
  });

  test("carries a describe() text", () => {
    expect(slugSchema.description?.length).toBeGreaterThan(0);
  });
});

describe("citationRefSchema", () => {
  test("accepts the lower boundary R1", () => {
    expect(citationRefSchema.parse("R1")).toBe("R1");
  });

  test("accepts the upper boundary R41", () => {
    expect(citationRefSchema.parse("R41")).toBe("R41");
  });

  test("accepts a two-digit value in range, e.g. R23", () => {
    expect(citationRefSchema.parse("R23")).toBe("R23");
  });

  test("rejects R0", () => {
    expect(citationRefSchema.safeParse("R0").success).toBe(false);
  });

  test("rejects R42, one past the upper boundary", () => {
    expect(citationRefSchema.safeParse("R42").success).toBe(false);
  });

  test("rejects a value with a space", () => {
    expect(citationRefSchema.safeParse("R 1").success).toBe(false);
  });

  test("rejects a lowercase prefix", () => {
    expect(citationRefSchema.safeParse("r1").success).toBe(false);
  });

  test("rejects a non-numeric suffix", () => {
    expect(citationRefSchema.safeParse("Rx").success).toBe(false);
  });

  test("rejects an empty string", () => {
    expect(citationRefSchema.safeParse("").success).toBe(false);
  });

  test("describe() mentions the reference document", () => {
    expect(citationRefSchema.description).toContain("99-referensi.md");
  });
});

describe("syllabusSectionSchema", () => {
  test("accepts a top-level section reference", () => {
    expect(syllabusSectionSchema.parse("§4")).toBe("§4");
  });

  test("accepts a subsection reference", () => {
    expect(syllabusSectionSchema.parse("§2.1")).toBe("§2.1");
  });

  test("rejects a value missing the § sign", () => {
    expect(syllabusSectionSchema.safeParse("2.1").success).toBe(false);
  });

  test("rejects a two-level subsection", () => {
    expect(syllabusSectionSchema.safeParse("§2.1.3").success).toBe(false);
  });

  test("rejects a non-numeric section", () => {
    expect(syllabusSectionSchema.safeParse("§a").success).toBe(false);
  });

  test("carries a describe() text", () => {
    expect(syllabusSectionSchema.description?.length).toBeGreaterThan(0);
  });
});

describe("parseDataFile", () => {
  const fixtureSchema = z.object({
    id: nonEmptyString,
    count: z.number().int().positive(),
  });

  test("returns the typed, validated value on success", () => {
    const result = parseDataFile(fixtureSchema, { id: "abc", count: 3 }, "fixture.json");
    expect(result).toEqual({ id: "abc", count: 3 });
  });

  test("throws CorpusValidationError naming the source file on failure", () => {
    expect(() => parseDataFile(fixtureSchema, { id: "", count: -1 }, "fixture.json")).toThrow(
      CorpusValidationError,
    );

    try {
      parseDataFile(fixtureSchema, { id: "", count: -1 }, "fixture.json");
      throw new Error("expected parseDataFile to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(CorpusValidationError);
      const validationError = error as CorpusValidationError;
      expect(validationError.sourceName).toBe("fixture.json");
      expect(validationError.message).toContain("fixture.json");
    }
  });

  test("reports every issue, not just the first", () => {
    try {
      parseDataFile(fixtureSchema, { id: "", count: -1 }, "fixture.json");
      throw new Error("expected parseDataFile to throw");
    } catch (error) {
      const validationError = error as CorpusValidationError;
      expect(validationError.issues.length).toBeGreaterThanOrEqual(2);

      const paths = validationError.issues.map((issue) => issue.path);
      expect(paths).toContain("id");
      expect(paths).toContain("count");

      // The message must list all issues, one per line, as "path: message".
      for (const issue of validationError.issues) {
        expect(validationError.message).toContain(`${issue.path}: ${issue.message}`);
      }
    }
  });

  test("reports a missing field with its path", () => {
    try {
      parseDataFile(fixtureSchema, { count: 5 }, "fixture.json");
      throw new Error("expected parseDataFile to throw");
    } catch (error) {
      const validationError = error as CorpusValidationError;
      expect(validationError.issues.some((issue) => issue.path === "id")).toBe(true);
    }
  });

  test("reports a root-level issue when the input is not an object at all", () => {
    try {
      parseDataFile(fixtureSchema, "not an object", "fixture.json");
      throw new Error("expected parseDataFile to throw");
    } catch (error) {
      const validationError = error as CorpusValidationError;
      expect(validationError.issues.length).toBeGreaterThan(0);
      expect(validationError.issues[0]?.path).toBe("(root)");
    }
  });
});

describe("CorpusValidationError", () => {
  test("carries sourceName and issues, and has the expected error name", () => {
    const issues = [
      { path: "a", message: "bad a" },
      { path: "b", message: "bad b" },
    ];
    const error = new CorpusValidationError("some-file.json", issues);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("CorpusValidationError");
    expect(error.sourceName).toBe("some-file.json");
    expect(error.issues).toEqual(issues);
    expect(error.message).toContain("some-file.json");
    expect(error.message).toContain("a: bad a");
    expect(error.message).toContain("b: bad b");
  });
});
