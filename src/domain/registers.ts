/**
 * Typed loaders and lookup helpers over the reference, regulation, standard
 * and source-priority registers: `data/references.json` (§99),
 * `data/regulations.json` (§10), `data/standards.json` (§11) and
 * `data/source-priority.json` (§12).
 *
 * Per the "Layering rules" in `docs/architecture/README.md`, this module
 * assumes the data it receives is valid once it has passed through
 * {@link parseDataFile}: it never re-implements validation logic of its
 * own. Loading happens once, at module load, and the result is memoised.
 * The one exception is {@link assertNoDanglingCitations}, which checks a
 * cross-corpus fact (every `Rnn` citation used anywhere under `data/`
 * resolves to a real reference) that no single file's schema can express
 * on its own; it runs eagerly at module load so a dangling citation fails
 * fast rather than surfacing later as a silent broken link.
 */

import rawStages from "../../data/competition-stages.json";
// The rest of the corpus, imported here purely so
// {@link assertNoDanglingCitations} can walk it for stray `Rnn` citations.
// Static imports (rather than a runtime directory scan) keep the check
// deterministic and dependency-free, per issue #12's implementation notes.
import rawCategories from "../../data/curriculum-categories.json";
import rawGates from "../../data/gates.json";
import rawLearningLoad from "../../data/learning-load.json";
// `resolveJsonModule` is enabled in tsconfig.json, so a static import is a
// deterministic, dependency-free way to bring the corpus files in — no
// filesystem read, no async loader, and Bun/tsc both resolve it at build
// time. The value is `unknown` as far as validity is concerned; it is
// still parsed through the schema below before anything trusts its shape.
import rawReferences from "../../data/references.json";
import rawRegulations from "../../data/regulations.json";
import rawSourcePriority from "../../data/source-priority.json";
import rawStandards from "../../data/standards.json";
import rawTopicFamilies from "../../data/topic-families.json";
import rawWeeks from "../../data/weeks.json";
import { parseDataFile } from "../schema/common";
import {
  type Reference,
  type ReferenceKind,
  type ReferencesFile,
  referencesFileSchema,
} from "../schema/reference";
import { type Regulation, type RegulationsFile, regulationsFileSchema } from "../schema/regulation";
import {
  type PracticePlatform,
  type PrimaryBook,
  type SourcePriorityEntry,
  type SourcePriorityFile,
  sourcePriorityFileSchema,
} from "../schema/source-priority";
import { type Standard, type StandardsFile, standardsFileSchema } from "../schema/standard";

const REFERENCES_SOURCE_NAME = "data/references.json";
const REGULATIONS_SOURCE_NAME = "data/regulations.json";
const STANDARDS_SOURCE_NAME = "data/standards.json";
const SOURCE_PRIORITY_SOURCE_NAME = "data/source-priority.json";

/**
 * The validated contents of `data/references.json`, parsed once at module
 * load. Throws {@link CorpusValidationError} if the file does not match
 * {@link referencesFileSchema}.
 */
const referencesFile: ReferencesFile = parseDataFile(
  referencesFileSchema,
  rawReferences,
  REFERENCES_SOURCE_NAME,
);

/**
 * The validated contents of `data/regulations.json`, parsed once at module
 * load. Throws {@link CorpusValidationError} if the file does not match
 * {@link regulationsFileSchema}.
 */
const regulationsFile: RegulationsFile = parseDataFile(
  regulationsFileSchema,
  rawRegulations,
  REGULATIONS_SOURCE_NAME,
);

/**
 * The validated contents of `data/standards.json`, parsed once at module
 * load. Throws {@link CorpusValidationError} if the file does not match
 * {@link standardsFileSchema}.
 */
const standardsFile: StandardsFile = parseDataFile(
  standardsFileSchema,
  rawStandards,
  STANDARDS_SOURCE_NAME,
);

/**
 * The validated contents of `data/source-priority.json`, parsed once at
 * module load. Throws {@link CorpusValidationError} if the file does not
 * match {@link sourcePriorityFileSchema}.
 */
const sourcePriorityFile: SourcePriorityFile = parseDataFile(
  sourcePriorityFileSchema,
  rawSourcePriority,
  SOURCE_PRIORITY_SOURCE_NAME,
);

/** Every reference defined by §99, in R1..R41 source order. */
export function listReferences(): readonly Reference[] {
  return referencesFile.references;
}

/**
 * Looks up a reference by its R-id, returning `undefined` if no reference
 * with that id exists.
 */
export function findReference(id: string): Reference | undefined {
  return referencesFile.references.find((reference) => reference.id === id);
}

/**
 * Looks up a reference by its R-id, throwing a readable error naming the
 * unknown id and listing every valid id if none matches.
 */
export function getReference(id: string): Reference {
  const reference = findReference(id);
  if (reference === undefined) {
    const validIds = referencesFile.references.map((entry) => entry.id).join(", ");
    throw new Error(`getReference: unknown reference id "${id}". Valid ids: ${validIds}`);
  }
  return reference;
}

/** Every reference of the given `kind`, in source order. */
export function referencesByKind(kind: ReferenceKind): readonly Reference[] {
  return referencesFile.references.filter((reference) => reference.kind === kind);
}

/**
 * Resolves every id in `ids` to its {@link Reference}, in the same order as
 * `ids` (duplicates preserved). Throws a single readable error naming
 * *every* unknown id at once -- not just the first -- if any id does not
 * resolve to a real reference.
 */
export function resolveCitations(ids: readonly string[]): readonly Reference[] {
  const unknownIds = ids.filter((id) => findReference(id) === undefined);
  if (unknownIds.length > 0) {
    throw new Error(`resolveCitations: unknown citation id(s): ${unknownIds.join(", ")}`);
  }
  return ids.map((id) => getReference(id));
}

/** Every regulation defined by §10, in source order. */
export function listRegulations(): readonly Regulation[] {
  return regulationsFile.regulations;
}

/**
 * Looks up a regulation by its slug id, throwing a readable error naming
 * the unknown id and listing every valid id if none matches.
 */
export function getRegulation(id: string): Regulation {
  const regulation = regulationsFile.regulations.find((entry) => entry.id === id);
  if (regulation === undefined) {
    const validIds = regulationsFile.regulations.map((entry) => entry.id).join(", ");
    throw new Error(`getRegulation: unknown regulation id "${id}". Valid ids: ${validIds}`);
  }
  return regulation;
}

/** Every standard defined by §11, in source order. */
export function listStandards(): readonly Standard[] {
  return standardsFile.standards;
}

/**
 * Looks up a standard by its slug id, throwing a readable error naming the
 * unknown id and listing every valid id if none matches.
 */
export function getStandard(id: string): Standard {
  const standard = standardsFile.standards.find((entry) => entry.id === id);
  if (standard === undefined) {
    const validIds = standardsFile.standards.map((entry) => entry.id).join(", ");
    throw new Error(`getStandard: unknown standard id "${id}". Valid ids: ${validIds}`);
  }
  return standard;
}

/**
 * The whole §12 mentor source-priority register: the §12.1 priority-ordered
 * rows, the §12.2 primary books and the §12.3 practice platforms.
 */
export interface SourcePriorityRegister {
  readonly priorities: readonly SourcePriorityEntry[];
  readonly books: readonly PrimaryBook[];
  readonly platforms: readonly PracticePlatform[];
}

/** The §12 mentor source-priority register (see {@link SourcePriorityRegister}). */
export function sourcePriority(): SourcePriorityRegister {
  return {
    priorities: sourcePriorityFile.priorities,
    books: sourcePriorityFile.books,
    platforms: sourcePriorityFile.platforms,
  };
}

/** A citation id found somewhere in the corpus that does not resolve to a real reference. */
export interface DanglingCitation {
  /** The citation id that was found, e.g. `"R99"`. */
  readonly id: string;
  /** The label identifying where it was found, e.g. `"data/weeks.json"`. */
  readonly label: string;
}

/**
 * Matches any bare `"R<digits>"` token, e.g. `"R1"`, `"R41"`, `"R0"` or
 * `"R99"`. Deliberately broader than `citationRefSchema`'s R1-R41 range
 * (`src/schema/common.ts`): every citation-typed *field* in this corpus
 * already goes through `citationRefSchema` at parse time, so an in-range
 * dangling id can only arise from a real gap in `data/references.json`.
 * This walker's job is the defense-in-depth case -- catching a stray
 * out-of-range or malformed `"Rxx"`-shaped token wherever it appears in
 * raw, not-yet-schema-checked JSON (including inline test fixtures) -- so
 * it recognises the token shape first and always defers the "is it a real
 * reference" question to {@link findReference}.
 */
const CITATION_REF_PATTERN = /^R\d+$/;

/**
 * Recursively walks `value` (arbitrary parsed JSON), collecting every
 * string that looks like a citation id (matches {@link CITATION_REF_PATTERN})
 * but does not resolve to a real reference in `data/references.json`.
 * `label` identifies `value`'s origin (typically a `data/*.json` file name)
 * and is attached to every {@link DanglingCitation} this call returns.
 *
 * A pure function of its arguments plus the already-loaded reference
 * register -- it performs no I/O and has no side effects, so it can be
 * exercised directly against inline fixtures in tests, independent of
 * {@link assertNoDanglingCitations}'s corpus-wide sweep.
 */
export function findDanglingCitations(value: unknown, label: string): DanglingCitation[] {
  const dangling: DanglingCitation[] = [];

  const visit = (node: unknown): void => {
    if (typeof node === "string") {
      if (CITATION_REF_PATTERN.test(node) && findReference(node) === undefined) {
        dangling.push({ id: node, label });
      }
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) {
        visit(item);
      }
      return;
    }
    if (node !== null && typeof node === "object") {
      for (const child of Object.values(node)) {
        visit(child);
      }
    }
  };

  visit(value);
  return dangling;
}

/**
 * Asserts that every citation id used anywhere in the corpus resolves to a
 * real reference in `data/references.json`. Scans every other `data/*.json`
 * file (statically imported above, not read from disk at runtime, to keep
 * this deterministic and dependency-free) with {@link findDanglingCitations}
 * and throws a single error naming *every* dangling id and the file it was
 * found in -- not just the first -- if any are found.
 *
 * Called eagerly at module load (see below) so bad data fails fast at
 * import time rather than surfacing later as a silently broken citation
 * link.
 */
export function assertNoDanglingCitations(): void {
  const corpus: ReadonlyArray<readonly [string, unknown]> = [
    ["data/topic-families.json", rawTopicFamilies],
    ["data/weeks.json", rawWeeks],
    ["data/gates.json", rawGates],
    ["data/curriculum-categories.json", rawCategories],
    ["data/competition-stages.json", rawStages],
    ["data/learning-load.json", rawLearningLoad],
    ["data/regulations.json", rawRegulations],
    ["data/standards.json", rawStandards],
    ["data/source-priority.json", rawSourcePriority],
  ];

  const dangling = corpus.flatMap(([label, raw]) => findDanglingCitations(raw, label));

  if (dangling.length > 0) {
    const lines = dangling.map((entry) => `  - ${entry.id} in ${entry.label}`).join("\n");
    throw new Error(
      `assertNoDanglingCitations: found ${dangling.length} dangling citation reference(s) ` +
        `that do not resolve to a real reference in data/references.json:\n${lines}`,
    );
  }
}

assertNoDanglingCitations();
