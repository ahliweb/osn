/**
 * Tests for `src/domain/corpus-audit.ts`: the pure whole-corpus auditor
 * backing `osn validate` (issue #19).
 *
 * Per this module's own docblock, it is a pure function of an injected
 * `CorpusSource` -- never a static import of `data/*.json` -- specifically
 * so it can be tested against fixtures without touching disk. Every test
 * here builds its `CorpusSource` in-memory: a fresh clone of the real
 * corpus's shape (read once via `Bun.file`, not via any `src/domain/`
 * loader, to avoid the eager-parse-on-import behaviour those modules have)
 * with exactly one property corrupted, so each test proves one specific
 * finding fires -- and, together, that multiple distinct problems across
 * different files are all reported in a single `auditCorpus` call.
 */

import { describe, expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  type AuditResult,
  type CorpusEntry,
  type CorpusSource,
  DATA_FILE_REGISTRY,
  auditCorpus,
} from "../../src/domain/corpus-audit";

const DATA_DIR = join(import.meta.dir, "..", "..", "data");

/** Reads and JSON-parses every `.json` file directly under `data/`, independent of any `src/domain/` loader. */
async function loadRealCorpus(): Promise<Map<string, unknown>> {
  const fileNames = (await readdir(DATA_DIR)).filter((name) => name.endsWith(".json"));
  const files = new Map<string, unknown>();
  for (const name of fileNames) {
    const text = await Bun.file(join(DATA_DIR, name)).text();
    files.set(name, JSON.parse(text));
  }
  return files;
}

/** Deep-clones every file's parsed JSON so tests can freely mutate a clone without touching the shared fixture. */
function cloneCorpus(files: ReadonlyMap<string, unknown>): Map<string, unknown> {
  const clone = new Map<string, unknown>();
  for (const [name, data] of files) {
    clone.set(name, structuredClone(data));
  }
  return clone;
}

/** Builds a `CorpusSource` from a plain `file -> parsed JSON` map, wrapping every entry as `{ ok: true }`. */
function toSource(files: ReadonlyMap<string, unknown>): CorpusSource {
  const source = new Map<string, CorpusEntry>();
  for (const [name, data] of files) {
    source.set(name, { ok: true, data });
  }
  return source;
}

function findingMessages(result: AuditResult, file: string): string[] {
  return result.findings
    .filter((finding) => finding.file === file)
    .map((finding) => finding.message);
}

const realCorpus = await loadRealCorpus();

describe("DATA_FILE_REGISTRY", () => {
  test("covers every .json file actually present under data/", async () => {
    const fileNames = (await readdir(DATA_DIR)).filter((name) => name.endsWith(".json"));
    const registered = new Set(DATA_FILE_REGISTRY.map((entry) => entry.file));
    for (const name of fileNames) {
      expect(registered.has(name)).toBe(true);
    }
    expect(DATA_FILE_REGISTRY.length).toBe(fileNames.length);
  });

  test("has no duplicate file entries", () => {
    const names = DATA_FILE_REGISTRY.map((entry) => entry.file);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("auditCorpus against the real, unmodified corpus", () => {
  test("is ok with zero findings", () => {
    const result = auditCorpus(toSource(realCorpus));
    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([]);
    expect(result.summary.filesValidated).toBe(DATA_FILE_REGISTRY.length);
    expect(result.summary.filesMissing).toBe(0);
    expect(result.summary.filesUnregistered).toBe(0);
    expect(result.summary.errorCount).toBe(0);
  });
});

describe("schema conformance", () => {
  test("a missing required file is reported, not silently skipped", () => {
    const files = cloneCorpus(realCorpus);
    files.delete("kpi-definitions.json");
    const result = auditCorpus(toSource(files));
    expect(result.ok).toBe(false);
    expect(result.summary.filesMissing).toBe(1);
    expect(findingMessages(result, "kpi-definitions.json")).toEqual([
      expect.stringContaining("required data file is missing"),
    ]);
  });

  test("invalid JSON is reported as its own finding, not thrown", () => {
    const source = toSource(cloneCorpus(realCorpus));
    const mutable = new Map(source);
    mutable.set("weeks.json", { ok: false, error: "Unexpected token } in JSON at position 12" });
    const result = auditCorpus(mutable);
    expect(result.ok).toBe(false);
    expect(findingMessages(result, "weeks.json")).toEqual([
      expect.stringContaining("invalid JSON"),
    ]);
  });

  test("a schema violation reports every issue in the file, not just the first", () => {
    const files = cloneCorpus(realCorpus);
    // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed fixture data
    const weeks = files.get("weeks.json") as any;
    weeks.weeks[0].focus = "";
    weeks.weeks[0].outcome = "";
    const result = auditCorpus(toSource(files));
    expect(result.ok).toBe(false);
    const messages = findingMessages(result, "weeks.json");
    expect(messages.length).toBeGreaterThanOrEqual(2);
  });

  test("a .json file under data/ with no matching schema is reported as unregistered, not ignored", () => {
    const source = toSource(cloneCorpus(realCorpus));
    const mutable = new Map(source);
    mutable.set("unwired-extra.json", { ok: true, data: { anything: true } });
    const result = auditCorpus(mutable);
    expect(result.ok).toBe(false);
    expect(result.summary.filesUnregistered).toBe(1);
    expect(findingMessages(result, "unwired-extra.json")).toEqual([
      expect.stringContaining("not covered by any schema"),
    ]);
  });
});

describe("structural invariants", () => {
  test("weeks.json: fewer than 28 weeks is reported", () => {
    const files = cloneCorpus(realCorpus);
    // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed fixture data
    const weeksFile = files.get("weeks.json") as any;
    weeksFile.weeks = weeksFile.weeks.filter((week: { week: number }) => week.week !== 27);
    const result = auditCorpus(toSource(files));
    expect(result.ok).toBe(false);
    expect(findingMessages(result, "weeks.json").some((m) => m.includes("week numbers"))).toBe(
      true,
    );
  });

  test("gates.json: a gate at the wrong week is reported", () => {
    const files = cloneCorpus(realCorpus);
    // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed fixture data
    const gatesFile = files.get("gates.json") as any;
    gatesFile.gates[0].afterWeek = 8; // duplicate of an existing gate week, so 4 disappears from the set
    const result = auditCorpus(toSource(files));
    expect(result.ok).toBe(false);
    expect(
      findingMessages(result, "gates.json").some((m) => m.includes("gate afterWeek values")),
    ).toBe(true);
  });

  test("references.json: removing a reference breaks the exact R1-R41 set", () => {
    const files = cloneCorpus(realCorpus);
    // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed fixture data
    const referencesFile = files.get("references.json") as any;
    referencesFile.references = referencesFile.references.filter(
      (reference: { id: string }) => reference.id !== "R41",
    );
    const result = auditCorpus(toSource(files));
    expect(result.ok).toBe(false);
    expect(
      findingMessages(result, "references.json").some((m) => m.includes("reference ids")),
    ).toBe(true);
  });

  test("assessment-weights.json: weights not summing to 100 is reported even though the schema also rejects it", () => {
    const files = cloneCorpus(realCorpus);
    // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed fixture data
    const weightsFile = files.get("assessment-weights.json") as any;
    weightsFile.components[0].weight -= 1;
    const result = auditCorpus(toSource(files));
    expect(result.ok).toBe(false);
    // The schema's own superRefine already rejects this, so the structural-invariant
    // check (which only runs on successfully-parsed files) never gets to run --
    // this asserts the schema-level rejection still surfaces a clear message.
    expect(
      findingMessages(result, "assessment-weights.json").some((m) => m.includes("sum to exactly")),
    ).toBe(true);
  });

  test("session-template.json: a session not summing to 120 minutes is reported", () => {
    const files = cloneCorpus(realCorpus);
    // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed fixture data
    const sessionFile = files.get("session-template.json") as any;
    // Shrink the last segment's end so the session totals less than 120 --
    // the schema's own superRefine already requires the last segment to end
    // at 120, so this is caught at schema level, proving the message is clear.
    sessionFile.sessions[0].segments.at(-1).endMinute = 119;
    const result = auditCorpus(toSource(files));
    expect(result.ok).toBe(false);
    expect(findingMessages(result, "session-template.json").length).toBeGreaterThan(0);
  });

  test("competition-stages.json: removing a stage breaks the exact 4-stage set", () => {
    const files = cloneCorpus(realCorpus);
    // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed fixture data
    const stagesFile = files.get("competition-stages.json") as any;
    stagesFile.stages = stagesFile.stages.filter(
      (stage: { id: string }) => stage.id !== "toki-ioi-extension",
    );
    const result = auditCorpus(toSource(files));
    expect(result.ok).toBe(false);
    expect(
      findingMessages(result, "competition-stages.json").some((m) => m.includes("stage ids")),
    ).toBe(true);
  });

  test("curriculum-categories.json: removing a category breaks the exact 4-category set", () => {
    const files = cloneCorpus(realCorpus);
    // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed fixture data
    const categoriesFile = files.get("curriculum-categories.json") as any;
    categoriesFile.categories = categoriesFile.categories.filter(
      (category: { id: string }) => category.id !== "de-prioritized",
    );
    const result = auditCorpus(toSource(files));
    expect(result.ok).toBe(false);
    expect(
      findingMessages(result, "curriculum-categories.json").some((m) => m.includes("category ids")),
    ).toBe(true);
  });
});

describe("referential integrity", () => {
  test("weeks.json: an unknown topicFamilies id is reported", () => {
    const files = cloneCorpus(realCorpus);
    // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed fixture data
    const weeksFile = files.get("weeks.json") as any;
    weeksFile.weeks[0].topicFamilies = ["not-a-real-topic-family"];
    const result = auditCorpus(toSource(files));
    expect(result.ok).toBe(false);
    expect(
      findingMessages(result, "weeks.json").some((m) => m.includes("unknown topic family id")),
    ).toBe(true);
  });

  test("weeks.json vs gates.json: a checkpoint week that is not a gate week is reported", () => {
    const files = cloneCorpus(realCorpus);
    // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed fixture data
    const weeksFile = files.get("weeks.json") as any;
    const week5 = weeksFile.weeks.find((week: { week: number }) => week.week === 5);
    week5.checkpoint = 1;
    const result = auditCorpus(toSource(files));
    expect(result.ok).toBe(false);
    expect(
      findingMessages(result, "weeks.json").some((m) =>
        m.includes("must exactly match the gate weeks"),
      ),
    ).toBe(true);
  });

  test("weeks.json: checkpoint numbers out of ascending order are reported", () => {
    const files = cloneCorpus(realCorpus);
    // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed fixture data
    const weeksFile = files.get("weeks.json") as any;
    const week4 = weeksFile.weeks.find((week: { week: number }) => week.week === 4);
    const week8 = weeksFile.weeks.find((week: { week: number }) => week.week === 8);
    week4.checkpoint = 2;
    week8.checkpoint = 1;
    const result = auditCorpus(toSource(files));
    expect(result.ok).toBe(false);
    expect(
      findingMessages(result, "weeks.json").filter((m) => m.includes("checkpoint number must be"))
        .length,
    ).toBe(2);
  });

  test("assessment-bank.json vs competition-stages.json: a servesStage not present in the stages file is reported", () => {
    const files = cloneCorpus(realCorpus);
    // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed fixture data
    const stagesFile = files.get("competition-stages.json") as any;
    stagesFile.stages = stagesFile.stages.filter((stage: { id: string }) => stage.id !== "osn-k");
    const result = auditCorpus(toSource(files));
    expect(result.ok).toBe(false);
    expect(
      findingMessages(result, "assessment-bank.json").some((m) =>
        m.includes('unknown stage id "osn-k"'),
      ),
    ).toBe(true);
  });

  test("a citation to a reference that does not exist (e.g. a removed R41) is reported wherever it appears", () => {
    const files = cloneCorpus(realCorpus);
    // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed fixture data
    const referencesFile = files.get("references.json") as any;
    referencesFile.references = referencesFile.references.filter(
      (reference: { id: string }) => reference.id !== "R41",
    );
    // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed fixture data
    const sourcePriorityFile = files.get("source-priority.json") as any;
    const citingRow = sourcePriorityFile.priorities.find((row: { citations: string[] }) =>
      row.citations.includes("R41"),
    );
    expect(citingRow).toBeDefined();
    const result = auditCorpus(toSource(files));
    expect(result.ok).toBe(false);
    expect(
      result.findings.some(
        (finding) =>
          finding.file === "source-priority.json" &&
          finding.message.includes('citation "R41" does not resolve'),
      ),
    ).toBe(true);
  });

  test("a citation is not falsely flagged just because it is a substring of prose (e.g. 'R99' inside a sentence)", () => {
    const files = cloneCorpus(realCorpus);
    // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed fixture data
    const gatesFile = files.get("gates.json") as any;
    gatesFile.gates[0].evidence.push(
      "a sentence mentioning R99 in passing, not as a citation value",
    );
    const result = auditCorpus(toSource(files));
    // The pattern only matches a whole string exactly shaped like "R<digits>",
    // never a substring, so embedding "R99" inside a longer sentence must not
    // be reported as a dangling citation.
    expect(result.findings.some((finding) => finding.message.includes('citation "R99"'))).toBe(
      false,
    );
  });
});

describe("multiple distinct problems in one pass", () => {
  test("a fixture with 3 unrelated problems across 3 files yields all 3 as findings in one auditCorpus call", () => {
    const files = cloneCorpus(realCorpus);

    // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed fixture data
    const weeksFile = files.get("weeks.json") as any;
    weeksFile.weeks = weeksFile.weeks.filter((week: { week: number }) => week.week !== 27);

    // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed fixture data
    const referencesFile = files.get("references.json") as any;
    referencesFile.references = referencesFile.references.filter(
      (reference: { id: string }) => reference.id !== "R41",
    );

    // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed fixture data
    const categoriesFile = files.get("curriculum-categories.json") as any;
    categoriesFile.categories = categoriesFile.categories.filter(
      (category: { id: string }) => category.id !== "core",
    );

    const result = auditCorpus(toSource(files));

    expect(result.ok).toBe(false);
    const filesWithFindings = new Set(result.findings.map((finding) => finding.file));
    expect(filesWithFindings.has("weeks.json")).toBe(true);
    expect(filesWithFindings.has("references.json")).toBe(true);
    expect(filesWithFindings.has("curriculum-categories.json")).toBe(true);
    expect(result.findings.length).toBeGreaterThanOrEqual(3);
  });
});
