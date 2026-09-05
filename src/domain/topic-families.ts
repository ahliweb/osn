/**
 * Typed loader and lookup helpers over `data/topic-families.json`, the ten
 * official topic families ("rumpun materi resmi") defined in §2.1 of the
 * syllabus corpus.
 *
 * Per the "Layering rules" in `docs/architecture/README.md`, this module
 * assumes the data it receives is valid once it has passed through
 * {@link parseDataFile}: it never re-implements validation logic of its
 * own. Loading happens once, at module load, and the result is memoised.
 */

// `resolveJsonModule` is enabled in tsconfig.json, so a static import is a
// deterministic, dependency-free way to bring the corpus file in — no
// filesystem read, no async loader, and Bun/tsc both resolve it at build
// time. The value is `unknown` as far as validity is concerned; it is
// still parsed through the schema below before anything trusts its shape.
import rawTopicFamilies from "../../data/topic-families.json";
import { parseDataFile } from "../schema/common";
import {
  type TopicFamiliesFile,
  type TopicFamily,
  topicFamiliesSchema,
} from "../schema/topic-family";

const SOURCE_NAME = "data/topic-families.json";

/**
 * The validated contents of `data/topic-families.json`, parsed once at
 * module load. Throws {@link CorpusValidationError} if the file does not
 * match {@link topicFamiliesSchema}.
 */
const topicFamiliesFile: TopicFamiliesFile = parseDataFile(
  topicFamiliesSchema,
  rawTopicFamilies,
  SOURCE_NAME,
);

/** Every topic family defined by §2.1, in source order. */
export function listTopicFamilies(): readonly TopicFamily[] {
  return topicFamiliesFile.topicFamilies;
}

/**
 * Looks up a topic family by ID, returning `undefined` if no family with
 * that ID exists.
 */
export function findTopicFamily(id: string): TopicFamily | undefined {
  return topicFamiliesFile.topicFamilies.find((family) => family.id === id);
}

/** Returns whether `id` names a known topic family. */
export function isTopicFamilyId(id: string): boolean {
  return findTopicFamily(id) !== undefined;
}

/**
 * Looks up a topic family by ID, throwing a readable error naming the
 * unknown ID and listing every valid ID if none matches.
 */
export function getTopicFamily(id: string): TopicFamily {
  const family = findTopicFamily(id);
  if (family === undefined) {
    const validIds = topicFamiliesFile.topicFamilies.map((entry) => entry.id).join(", ");
    throw new Error(`getTopicFamily: unknown topic family id "${id}". Valid ids: ${validIds}`);
  }
  return family;
}
