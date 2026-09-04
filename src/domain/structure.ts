/**
 * Typed loaders and lookup helpers over `data/curriculum-categories.json`,
 * `data/competition-stages.json` and `data/learning-load.json`: the §3
 * CORE/SUPPORT/EXTENSION/DE-PRIORITIZED categories, the §2.2 competition
 * stages, and the §1.3 baseline learning load.
 *
 * Per the "Layering rules" in `docs/architecture/README.md`, this module
 * assumes the data it receives is valid once it has passed through
 * {@link parseDataFile}: it never re-implements validation logic of its
 * own. Loading happens once, at module load, and the result is memoised.
 */

import { type Category, type CategoriesFile, categoriesFileSchema } from "../schema/category";
import { parseDataFile } from "../schema/common";
import {
  type LearningLoadComponent,
  type LearningLoadFile,
  learningLoadFileSchema,
} from "../schema/learning-load";
import { type Stage, type StagesFile, stagesFileSchema } from "../schema/stage";

// `resolveJsonModule` is enabled in tsconfig.json, so a static import is a
// deterministic, dependency-free way to bring the corpus files in — no
// filesystem read, no async loader, and Bun/tsc both resolve it at build
// time. The value is `unknown` as far as validity is concerned; it is
// still parsed through the schema below before anything trusts its shape.
import rawCategories from "../../data/curriculum-categories.json";
import rawStages from "../../data/competition-stages.json";
import rawLearningLoad from "../../data/learning-load.json";

const CATEGORIES_SOURCE_NAME = "data/curriculum-categories.json";
const STAGES_SOURCE_NAME = "data/competition-stages.json";
const LEARNING_LOAD_SOURCE_NAME = "data/learning-load.json";

/**
 * The validated contents of `data/curriculum-categories.json`, parsed once
 * at module load. Throws {@link CorpusValidationError} if the file does not
 * match {@link categoriesFileSchema}.
 */
const categoriesFile: CategoriesFile = parseDataFile(
  categoriesFileSchema,
  rawCategories,
  CATEGORIES_SOURCE_NAME,
);

/**
 * The validated contents of `data/competition-stages.json`, parsed once at
 * module load. Throws {@link CorpusValidationError} if the file does not
 * match {@link stagesFileSchema}.
 */
const stagesFile: StagesFile = parseDataFile(stagesFileSchema, rawStages, STAGES_SOURCE_NAME);

/**
 * The validated contents of `data/learning-load.json`, parsed once at
 * module load. Throws {@link CorpusValidationError} if the file does not
 * match {@link learningLoadFileSchema}.
 */
const learningLoadFile: LearningLoadFile = parseDataFile(
  learningLoadFileSchema,
  rawLearningLoad,
  LEARNING_LOAD_SOURCE_NAME,
);

/** Every curriculum category defined by §3, in source order. */
export function listCategories(): readonly Category[] {
  return categoriesFile.categories;
}

/**
 * Looks up a curriculum category by ID, returning `undefined` if no
 * category with that ID exists.
 */
export function findCategory(id: string): Category | undefined {
  return categoriesFile.categories.find((category) => category.id === id);
}

/**
 * Looks up a curriculum category by ID, throwing a readable error naming
 * the unknown ID and listing every valid ID if none matches.
 */
export function getCategory(id: string): Category {
  const category = findCategory(id);
  if (category === undefined) {
    const validIds = categoriesFile.categories.map((entry) => entry.id).join(", ");
    throw new Error(`getCategory: unknown category id "${id}". Valid ids: ${validIds}`);
  }
  return category;
}

/**
 * The §3 "Aturan dependency" callout, verbatim: advanced structures/
 * algorithms are never introduced merely because they are popular.
 */
export function dependencyRule(): string {
  return categoriesFile.dependencyRule;
}

/** Every competition stage defined by §2.2, in source order. */
export function listStages(): readonly Stage[] {
  return stagesFile.stages;
}

/**
 * Looks up a competition stage by ID, returning `undefined` if no stage
 * with that ID exists.
 */
export function findStage(id: string): Stage | undefined {
  return stagesFile.stages.find((stage) => stage.id === id);
}

/**
 * Looks up a competition stage by ID, throwing a readable error naming the
 * unknown ID and listing every valid ID if none matches.
 */
export function getStage(id: string): Stage {
  const stage = findStage(id);
  if (stage === undefined) {
    const validIds = stagesFile.stages.map((entry) => entry.id).join(", ");
    throw new Error(`getStage: unknown stage id "${id}". Valid ids: ${validIds}`);
  }
  return stage;
}

/** Every baseline learning-load component defined by §1.3, in source order. */
export function listLearningLoad(): readonly LearningLoadComponent[] {
  return learningLoadFile.components;
}

/**
 * Looks up a learning-load component by its `component` name, returning
 * `undefined` if no component with that name exists.
 */
export function findLearningLoadComponent(name: string): LearningLoadComponent | undefined {
  return learningLoadFile.components.find((component) => component.component === name);
}

/**
 * Looks up a learning-load component by its `component` name, throwing a
 * readable error naming the unknown name and listing every valid name if
 * none matches.
 */
export function getLearningLoadComponent(name: string): LearningLoadComponent {
  const component = findLearningLoadComponent(name);
  if (component === undefined) {
    const validNames = learningLoadFile.components.map((entry) => entry.component).join(", ");
    throw new Error(
      `getLearningLoadComponent: unknown component "${name}". Valid components: ${validNames}`,
    );
  }
  return component;
}

/** The state {@link isExtensionAllowed} evaluates against the §3 dependency rule. */
export interface ExtensionGateState {
  /** Whether CORE material is currently stable for the learner/cohort in question. */
  readonly coreStable: boolean;
  /** Whether the current syllabus has been checked for this EXTENSION topic. */
  readonly syllabusChecked: boolean;
}

/** The verdict {@link isExtensionAllowed} returns. */
export interface ExtensionGateVerdict {
  /** Whether EXTENSION material may be introduced. */
  readonly allowed: boolean;
  /** A non-empty explanation of the verdict, naming the failing precondition(s) if any. */
  readonly reason: string;
}

/**
 * Implements the §3 EXTENSION rule ("Masuk setelah core stabil; cek
 * silabus terbaru dan kebutuhan siswa.") together with the "Aturan
 * dependency" callout: EXTENSION material is only introduced once CORE is
 * stable AND the current syllabus has been checked. Returns `allowed:
 * false` with a reason naming whichever precondition(s) are unmet;
 * `allowed: true` only when both hold. `reason` is always non-empty.
 */
export function isExtensionAllowed(state: ExtensionGateState): ExtensionGateVerdict {
  const unmet: string[] = [];
  if (!state.coreStable) {
    unmet.push("core is not yet stable");
  }
  if (!state.syllabusChecked) {
    unmet.push("the current syllabus has not been checked");
  }

  if (unmet.length > 0) {
    return {
      allowed: false,
      reason: `EXTENSION material is not allowed yet: ${unmet.join(" and ")}. Per §3, EXTENSION material only enters after core is stable and the current syllabus has been checked.`,
    };
  }

  return {
    allowed: true,
    reason:
      "EXTENSION material is allowed: core is stable and the current syllabus has been checked, " +
      "satisfying both §3 preconditions.",
  };
}

/**
 * Whether `topic` names material in the DE-PRIORITIZED category, via a
 * case-insensitive substring match against that category's `contents`. Lets
 * tooling warn when a proposed problem targets de-prioritised material.
 */
export function isDeprioritized(topic: string): boolean {
  const needle = topic.toLowerCase();
  const deprioritized = getCategory("de-prioritized");
  return deprioritized.contents.some((content) => content.toLowerCase().includes(needle));
}
