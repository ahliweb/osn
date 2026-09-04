/**
 * Tests for the category/stage/learning-load schemas
 * (`src/schema/category.ts`, `src/schema/stage.ts`,
 * `src/schema/learning-load.ts`) and the typed loader/lookup helpers over
 * the real corpus (`src/domain/structure.ts`, `data/curriculum-categories.json`,
 * `data/competition-stages.json`, `data/learning-load.json`).
 *
 * Malformed-input fixtures are constructed inline against the schemas; the
 * real data files under `data/` are never mutated by these tests.
 */

import { describe, expect, test } from "bun:test";
import {
  dependencyRule,
  findCategory,
  findLearningLoadComponent,
  findStage,
  getCategory,
  getLearningLoadComponent,
  getStage,
  isDeprioritized,
  isExtensionAllowed,
  listCategories,
  listLearningLoad,
  listStages,
} from "../../src/domain/structure";
import { categoriesFileSchema, categorySchema } from "../../src/schema/category";
import {
  learningLoadComponentSchema,
  learningLoadFileSchema,
} from "../../src/schema/learning-load";
import { contestFormatSchema, stageSchema, stagesFileSchema } from "../../src/schema/stage";

const EXPECTED_CATEGORY_IDS = ["core", "support", "extension", "de-prioritized"] as const;
const EXPECTED_STAGE_IDS = ["osn-k", "osn-p", "osn-nasional", "toki-ioi-extension"] as const;

describe("data/curriculum-categories.json (via src/domain/structure.ts)", () => {
  test("the real data file parses through the schema without error", () => {
    expect(() => listCategories()).not.toThrow();
  });

  test("exposes exactly 4 categories with the expected ids", () => {
    const ids = listCategories().map((category) => category.id);
    expect(ids).toEqual([...EXPECTED_CATEGORY_IDS]);
  });

  test("every category has a non-empty rule and non-empty contents", () => {
    for (const category of listCategories()) {
      expect(category.rule.length).toBeGreaterThan(0);
      expect(category.contents.length).toBeGreaterThan(0);
      for (const item of category.contents) {
        expect(item.length).toBeGreaterThan(0);
      }
    }
  });

  test("category names are printed exactly as in §3", () => {
    expect(getCategory("core").name).toBe("CORE");
    expect(getCategory("support").name).toBe("SUPPORT");
    expect(getCategory("extension").name).toBe("EXTENSION");
    expect(getCategory("de-prioritized").name).toBe("DE-PRIORITIZED");
  });

  test("dependencyRule() returns the non-empty §3 callout text", () => {
    expect(dependencyRule().length).toBeGreaterThan(0);
    expect(dependencyRule()).toContain("prasyarat konsep");
  });
});

describe("getCategory / findCategory", () => {
  test("getCategory returns the matching category for a known id", () => {
    expect(getCategory("core").id).toBe("core");
  });

  test("getCategory throws a helpful error listing valid ids for an unknown id", () => {
    expect(() => getCategory("does-not-exist")).toThrow(/does-not-exist/);

    try {
      getCategory("does-not-exist");
      throw new Error("expected getCategory to throw");
    } catch (error) {
      const message = (error as Error).message;
      for (const id of EXPECTED_CATEGORY_IDS) {
        expect(message).toContain(id);
      }
    }
  });

  test("findCategory returns undefined for an unknown id", () => {
    expect(findCategory("does-not-exist")).toBeUndefined();
  });
});

describe("data/competition-stages.json (via src/domain/structure.ts)", () => {
  test("the real data file parses through the schema without error", () => {
    expect(() => listStages()).not.toThrow();
  });

  test("exposes exactly 4 stages with the expected ids", () => {
    const ids = listStages().map((stage) => stage.id);
    expect(ids).toEqual([...EXPECTED_STAGE_IDS]);
  });

  test("stage names are printed exactly as in §2.2", () => {
    expect(getStage("osn-k").name).toBe("OSN-K");
    expect(getStage("osn-p").name).toBe("OSN-P");
    expect(getStage("osn-nasional").name).toBe("OSN Nasional");
    expect(getStage("toki-ioi-extension").name).toBe("TOKI/IOI extension");
  });

  test("OSN-K contest format: 30-50 items over 150 minutes", () => {
    const format = getStage("osn-k").contestFormat;
    expect(format).not.toBeNull();
    if (format?.kind === "problem-set") {
      expect(format.minItems).toBe(30);
      expect(format.maxItems).toBe(50);
      expect(format.durationMinutes).toBe(150);
    } else {
      throw new Error("expected OSN-K contestFormat to be a problem-set format");
    }
  });

  test("OSN-P contest format: 5-8 cases over 180 minutes, 3 comprehension + 1 programming per case", () => {
    const format = getStage("osn-p").contestFormat;
    expect(format).not.toBeNull();
    if (format?.kind === "case-study") {
      expect(format.minItems).toBe(5);
      expect(format.maxItems).toBe(8);
      expect(format.durationMinutes).toBe(180);
      expect(format.comprehensionPerCase).toBe(3);
      expect(format.programmingPerCase).toBe(1);
    } else {
      throw new Error("expected OSN-P contestFormat to be a case-study format");
    }
  });

  test("OSN Nasional and TOKI/IOI extension have a null contest format", () => {
    expect(getStage("osn-nasional").contestFormat).toBeNull();
    expect(getStage("toki-ioi-extension").contestFormat).toBeNull();
  });

  test("citations: OSN-K cites R2, OSN-P cites R3, the other two cite nothing", () => {
    expect(getStage("osn-k").citations).toEqual(["R2"]);
    expect(getStage("osn-p").citations).toEqual(["R3"]);
    expect(getStage("osn-nasional").citations).toEqual([]);
    expect(getStage("toki-ioi-extension").citations).toEqual([]);
  });

  test("every stage has non-empty dominantCompetencies and practiceModel", () => {
    for (const stage of listStages()) {
      expect(stage.dominantCompetencies.length).toBeGreaterThan(0);
      expect(stage.practiceModel.length).toBeGreaterThan(0);
    }
  });
});

describe("getStage / findStage", () => {
  test("getStage returns the matching stage for a known id", () => {
    expect(getStage("osn-p").id).toBe("osn-p");
  });

  test("getStage throws a helpful error listing valid ids for an unknown id", () => {
    expect(() => getStage("does-not-exist")).toThrow(/does-not-exist/);

    try {
      getStage("does-not-exist");
      throw new Error("expected getStage to throw");
    } catch (error) {
      const message = (error as Error).message;
      for (const id of EXPECTED_STAGE_IDS) {
        expect(message).toContain(id);
      }
    }
  });

  test("findStage returns undefined for an unknown id", () => {
    expect(findStage("does-not-exist")).toBeUndefined();
  });
});

describe("data/learning-load.json (via src/domain/structure.ts)", () => {
  test("the real data file parses through the schema without error", () => {
    expect(() => listLearningLoad()).not.toThrow();
  });

  test("exposes exactly 5 components", () => {
    expect(listLearningLoad()).toHaveLength(5);
  });

  test("mentor sessions are 2 x 120 minutes/week", () => {
    const component = getLearningLoadComponent("Sesi mentor");
    expect(component.quantity).toEqual({
      kind: "mentor-sessions",
      sessionsPerWeek: 2,
      minutesPerSession: 120,
    });
  });

  test("curated problems are 8-12/week", () => {
    const component = getLearningLoadComponent("Soal terkurasi");
    expect(component.quantity).toEqual({
      kind: "count-range",
      minPerWeek: 8,
      maxPerWeek: 12,
    });
  });

  test("independent practice is 4-8 hours/week", () => {
    const component = getLearningLoadComponent("Latihan mandiri");
    expect(component.quantity).toEqual({
      kind: "hour-range",
      minHoursPerWeek: 4,
      maxHoursPerWeek: 8,
    });
  });

  test("every component has a non-empty baseline and note", () => {
    for (const component of listLearningLoad()) {
      expect(component.baseline.length).toBeGreaterThan(0);
      expect(component.note.length).toBeGreaterThan(0);
    }
  });
});

describe("getLearningLoadComponent / findLearningLoadComponent", () => {
  test("getLearningLoadComponent returns the matching component for a known name", () => {
    expect(getLearningLoadComponent("Contest").component).toBe("Contest");
  });

  test("getLearningLoadComponent throws a helpful error listing valid names for an unknown name", () => {
    expect(() => getLearningLoadComponent("does-not-exist")).toThrow(/does-not-exist/);

    try {
      getLearningLoadComponent("does-not-exist");
      throw new Error("expected getLearningLoadComponent to throw");
    } catch (error) {
      const message = (error as Error).message;
      for (const component of listLearningLoad()) {
        expect(message).toContain(component.component);
      }
    }
  });

  test("findLearningLoadComponent returns undefined for an unknown name", () => {
    expect(findLearningLoadComponent("does-not-exist")).toBeUndefined();
  });
});

describe("isExtensionAllowed", () => {
  test("is false when coreStable is false (syllabusChecked true)", () => {
    const verdict = isExtensionAllowed({ coreStable: false, syllabusChecked: true });
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason.length).toBeGreaterThan(0);
    expect(verdict.reason).toMatch(/core/i);
  });

  test("is false when syllabusChecked is false (coreStable true)", () => {
    const verdict = isExtensionAllowed({ coreStable: true, syllabusChecked: false });
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason.length).toBeGreaterThan(0);
    expect(verdict.reason).toMatch(/syllabus/i);
  });

  test("is false when both are false", () => {
    const verdict = isExtensionAllowed({ coreStable: false, syllabusChecked: false });
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason.length).toBeGreaterThan(0);
    expect(verdict.reason).toMatch(/core/i);
    expect(verdict.reason).toMatch(/syllabus/i);
  });

  test("is true only when both are true", () => {
    const verdict = isExtensionAllowed({ coreStable: true, syllabusChecked: true });
    expect(verdict.allowed).toBe(true);
    expect(verdict.reason.length).toBeGreaterThan(0);
  });
});

describe("isDeprioritized", () => {
  test("is true for a known de-prioritised topic (AVL)", () => {
    expect(isDeprioritized("AVL")).toBe(true);
  });

  test("is true for a known de-prioritised topic (KMP), case-insensitively", () => {
    expect(isDeprioritized("kmp")).toBe(true);
  });

  test("is false for a core topic", () => {
    expect(isDeprioritized("rekursi")).toBe(false);
    expect(isDeprioritized("contest strategy")).toBe(false);
  });
});

describe("categorySchema (inline fixtures, real data file untouched)", () => {
  const validCategory = {
    id: "core",
    name: "CORE",
    contents: ["Seluruh rumpun resmi OSN 2026"],
    rule: "Wajib dikuasai sebelum memperluas materi.",
  };

  test("accepts a well-formed category", () => {
    expect(categorySchema.safeParse(validCategory).success).toBe(true);
  });

  test("rejects an unknown category id", () => {
    const result = categorySchema.safeParse({ ...validCategory, id: "not-a-category" });
    expect(result.success).toBe(false);
  });

  test("rejects an empty contents array", () => {
    const result = categorySchema.safeParse({ ...validCategory, contents: [] });
    expect(result.success).toBe(false);
  });

  test("rejects an empty rule", () => {
    const result = categorySchema.safeParse({ ...validCategory, rule: "" });
    expect(result.success).toBe(false);
  });
});

describe("categoriesFileSchema (inline fixtures)", () => {
  const validFile = {
    syllabusVersion: "2.0",
    syllabusDate: "2026-09-04",
    sourceSection: "§3",
    dependencyRule: "Tidak memperkenalkan struktur data/algoritma lanjutan hanya karena populer.",
    categories: [
      {
        id: "core",
        name: "CORE",
        contents: ["Seluruh rumpun resmi OSN 2026"],
        rule: "Wajib dikuasai sebelum memperluas materi.",
      },
    ],
  };

  test("accepts a well-formed file", () => {
    expect(categoriesFileSchema.safeParse(validFile).success).toBe(true);
  });

  test("rejects a file missing dependencyRule", () => {
    const { dependencyRule: _dependencyRule, ...withoutRule } = validFile;
    expect(categoriesFileSchema.safeParse(withoutRule).success).toBe(false);
  });
});

describe("contestFormatSchema (inline fixtures)", () => {
  test("accepts a well-formed problem-set format", () => {
    const result = contestFormatSchema.safeParse({
      kind: "problem-set",
      minItems: 30,
      maxItems: 50,
      durationMinutes: 150,
    });
    expect(result.success).toBe(true);
  });

  test("accepts a well-formed case-study format", () => {
    const result = contestFormatSchema.safeParse({
      kind: "case-study",
      minItems: 5,
      maxItems: 8,
      durationMinutes: 180,
      comprehensionPerCase: 3,
      programmingPerCase: 1,
    });
    expect(result.success).toBe(true);
  });

  test("accepts null", () => {
    expect(contestFormatSchema.safeParse(null).success).toBe(true);
  });

  test("rejects minItems > maxItems on a problem-set format", () => {
    const result = contestFormatSchema.safeParse({
      kind: "problem-set",
      minItems: 50,
      maxItems: 30,
      durationMinutes: 150,
    });
    expect(result.success).toBe(false);
  });

  test("rejects minItems > maxItems on a case-study format", () => {
    const result = contestFormatSchema.safeParse({
      kind: "case-study",
      minItems: 8,
      maxItems: 5,
      durationMinutes: 180,
      comprehensionPerCase: 3,
      programmingPerCase: 1,
    });
    expect(result.success).toBe(false);
  });

  test("rejects an unknown discriminant kind", () => {
    const result = contestFormatSchema.safeParse({
      kind: "essay",
      minItems: 1,
      maxItems: 2,
      durationMinutes: 60,
    });
    expect(result.success).toBe(false);
  });
});

describe("stageSchema (inline fixtures, real data file untouched)", () => {
  const validStage = {
    id: "osn-k",
    name: "OSN-K",
    dominantCompetencies: ["Computational thinking"],
    practiceModel: ["Worksheet analitis"],
    citations: ["R2"],
    contestFormat: null,
  };

  test("accepts a well-formed stage", () => {
    expect(stageSchema.safeParse(validStage).success).toBe(true);
  });

  test("rejects an unknown stage id", () => {
    const result = stageSchema.safeParse({ ...validStage, id: "not-a-stage" });
    expect(result.success).toBe(false);
  });

  test("rejects an empty dominantCompetencies array", () => {
    const result = stageSchema.safeParse({ ...validStage, dominantCompetencies: [] });
    expect(result.success).toBe(false);
  });

  test("rejects an empty practiceModel array", () => {
    const result = stageSchema.safeParse({ ...validStage, practiceModel: [] });
    expect(result.success).toBe(false);
  });

  test("accepts an empty citations array", () => {
    const result = stageSchema.safeParse({ ...validStage, citations: [] });
    expect(result.success).toBe(true);
  });

  test("rejects an out-of-range citation ref", () => {
    const result = stageSchema.safeParse({ ...validStage, citations: ["R42"] });
    expect(result.success).toBe(false);
  });
});

describe("stagesFileSchema (inline fixtures)", () => {
  const validFile = {
    syllabusVersion: "2.0",
    syllabusDate: "2026-09-04",
    sourceSection: "§2.2",
    stages: [
      {
        id: "osn-k",
        name: "OSN-K",
        dominantCompetencies: ["Computational thinking"],
        practiceModel: ["Worksheet analitis"],
        citations: ["R2"],
        contestFormat: null,
      },
    ],
  };

  test("accepts a well-formed file", () => {
    expect(stagesFileSchema.safeParse(validFile).success).toBe(true);
  });

  test("rejects a file whose stages contains an invalid entry", () => {
    const invalidFile = {
      ...validFile,
      stages: [{ ...validFile.stages[0], id: "not-a-stage" }],
    };
    expect(stagesFileSchema.safeParse(invalidFile).success).toBe(false);
  });
});

describe("learningLoadComponentSchema (inline fixtures, real data file untouched)", () => {
  const validComponent = {
    component: "Sesi mentor",
    baseline: "2 x 120 menit/minggu",
    note: "Dapat menjadi 3 sesi pada fase intensif.",
    quantity: { kind: "mentor-sessions", sessionsPerWeek: 2, minutesPerSession: 120 },
  };

  test("accepts a well-formed component with a structured quantity", () => {
    expect(learningLoadComponentSchema.safeParse(validComponent).success).toBe(true);
  });

  test("accepts a well-formed component with a null quantity", () => {
    const result = learningLoadComponentSchema.safeParse({ ...validComponent, quantity: null });
    expect(result.success).toBe(true);
  });

  test("rejects an empty baseline", () => {
    const result = learningLoadComponentSchema.safeParse({ ...validComponent, baseline: "" });
    expect(result.success).toBe(false);
  });

  test("rejects an empty note", () => {
    const result = learningLoadComponentSchema.safeParse({ ...validComponent, note: "" });
    expect(result.success).toBe(false);
  });

  test("rejects an unknown quantity discriminant", () => {
    const result = learningLoadComponentSchema.safeParse({
      ...validComponent,
      quantity: { kind: "not-a-kind", value: 1 },
    });
    expect(result.success).toBe(false);
  });
});

describe("learningLoadFileSchema (inline fixtures)", () => {
  const validFile = {
    syllabusVersion: "2.0",
    syllabusDate: "2026-09-04",
    sourceSection: "§1.3",
    components: [
      {
        component: "Sesi mentor",
        baseline: "2 x 120 menit/minggu",
        note: "Dapat menjadi 3 sesi pada fase intensif.",
        quantity: { kind: "mentor-sessions", sessionsPerWeek: 2, minutesPerSession: 120 },
      },
    ],
  };

  test("accepts a well-formed file", () => {
    expect(learningLoadFileSchema.safeParse(validFile).success).toBe(true);
  });

  test("rejects a file whose components contains an invalid entry", () => {
    const invalidFile = {
      ...validFile,
      components: [{ ...validFile.components[0], baseline: "" }],
    };
    expect(learningLoadFileSchema.safeParse(invalidFile).success).toBe(false);
  });
});
