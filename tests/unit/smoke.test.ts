/**
 * Smoke tests: does the project entrypoint load, and is the package
 * metadata well formed and consistent with what the docs promise?
 *
 * This is deliberately the first test in the suite (see
 * docs/development/testing.md) — it exists to catch a broken build or a
 * package.json/src drift before any schema or domain test would.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { CURRICULUM_SOURCE, packageInfo } from "../../src/index";

interface PackageJson {
  readonly name: string;
  readonly type?: string;
  readonly private?: boolean;
  readonly scripts?: Readonly<Record<string, string>>;
}

const packageJsonPath = join(import.meta.dir, "..", "..", "package.json");
const packageJson: PackageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

describe("src/index.ts entrypoint", () => {
  test("exports CURRICULUM_SOURCE as a non-empty string", () => {
    expect(typeof CURRICULUM_SOURCE).toBe("string");
    expect(CURRICULUM_SOURCE.length).toBeGreaterThan(0);
  });

  test("exports packageInfo carrying the curriculum source", () => {
    expect(packageInfo.source).toBe(CURRICULUM_SOURCE);
  });

  test("packageInfo.name matches the name declared in package.json", () => {
    expect(packageJson.name).toBe(packageInfo.name);
  });
});

describe("package.json metadata", () => {
  test("declares an ES module package", () => {
    expect(packageJson.type).toBe("module");
  });

  test("is marked private (this is not a publishable package)", () => {
    expect(packageJson.private).toBe(true);
  });

  test("declares every script the docs promise", () => {
    const requiredScripts = ["typecheck", "lint", "format:check", "test", "build", "validate"];

    for (const scriptName of requiredScripts) {
      expect(packageJson.scripts).toHaveProperty(scriptName);
      expect(typeof packageJson.scripts?.[scriptName]).toBe("string");
      expect(packageJson.scripts?.[scriptName]?.length).toBeGreaterThan(0);
    }
  });
});
