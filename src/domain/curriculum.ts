/**
 * Typed loaders and lookup helpers over `data/weeks.json` and
 * `data/gates.json`: the 28-week operational syllabus (§4) and its seven
 * phase gates (§4.1).
 *
 * Per the "Layering rules" in `docs/architecture/README.md`, this module
 * assumes the data it receives is valid once it has passed through
 * {@link parseDataFile}: it never re-implements validation logic of its
 * own. Loading happens once, at module load, and the result is memoised.
 * The one exception is {@link assertReferentialIntegrity}, which checks a
 * cross-file fact (week -> topic family) that no single file's schema can
 * express on its own; it runs eagerly at module load so bad data fails
 * fast rather than surfacing later as a lookup bug.
 */

import { parseDataFile } from "../schema/common";
import { type Gate, type GatesFile, gatesSchema } from "../schema/gate";
import { type Week, type WeeksFile, weeksSchema } from "../schema/week";
import { isTopicFamilyId } from "./topic-families";

// `resolveJsonModule` is enabled in tsconfig.json, so a static import is a
// deterministic, dependency-free way to bring the corpus files in — no
// filesystem read, no async loader, and Bun/tsc both resolve it at build
// time. The value is `unknown` as far as validity is concerned; it is
// still parsed through the schema below before anything trusts its shape.
import rawGates from "../../data/gates.json";
import rawWeeks from "../../data/weeks.json";

const WEEKS_SOURCE_NAME = "data/weeks.json";
const GATES_SOURCE_NAME = "data/gates.json";

/**
 * The validated contents of `data/weeks.json`, parsed once at module load.
 * Throws {@link CorpusValidationError} if the file does not match
 * {@link weeksSchema}.
 */
const weeksFile: WeeksFile = parseDataFile(weeksSchema, rawWeeks, WEEKS_SOURCE_NAME);

/**
 * The validated contents of `data/gates.json`, parsed once at module load.
 * Throws {@link CorpusValidationError} if the file does not match
 * {@link gatesSchema}.
 */
const gatesFile: GatesFile = parseDataFile(gatesSchema, rawGates, GATES_SOURCE_NAME);

/**
 * Checks that every `topicFamilies` reference in `data/weeks.json` resolves
 * to a topic family defined by `data/topic-families.json`. Throws a
 * readable error naming the first offending week and topic-family id if
 * not — this is the one referential-integrity fact that spans two data
 * files, so it cannot live inside either file's own schema.
 *
 * Called eagerly at module load (see below) so a bad cross-reference fails
 * fast at import time rather than surfacing later as a silent empty query
 * result.
 */
export function assertReferentialIntegrity(): void {
  for (const week of weeksFile.weeks) {
    for (const topicFamilyId of week.topicFamilies) {
      if (!isTopicFamilyId(topicFamilyId)) {
        throw new Error(
          `assertReferentialIntegrity: week ${week.week} references unknown topic ` +
            `family id "${topicFamilyId}" (data/weeks.json vs data/topic-families.json)`,
        );
      }
    }
  }
}

assertReferentialIntegrity();

/** Every week of the 28-week programme, in source (week-number) order. */
export function listWeeks(): readonly Week[] {
  return weeksFile.weeks;
}

/**
 * Looks up a week by number, returning `undefined` if no week with that
 * number exists.
 */
export function findWeek(week: number): Week | undefined {
  return weeksFile.weeks.find((entry) => entry.week === week);
}

/**
 * Looks up a week by number, throwing a readable error naming the valid
 * range if `week` is out of range.
 */
export function getWeek(week: number): Week {
  const found = findWeek(week);
  if (found === undefined) {
    const weekNumbers = weeksFile.weeks.map((entry) => entry.week);
    const min = Math.min(...weekNumbers);
    const max = Math.max(...weekNumbers);
    throw new Error(`getWeek: week ${week} is out of range. Valid range: ${min}-${max}.`);
  }
  return found;
}

/**
 * Every week whose `topicFamilies` includes `id`. Throws a readable error
 * naming the unknown id if `id` is not a known topic family — this is a
 * usage error (querying a family that does not exist), distinct from a
 * query that legitimately returns no weeks.
 */
export function weeksForTopicFamily(id: string): readonly Week[] {
  if (!isTopicFamilyId(id)) {
    throw new Error(`weeksForTopicFamily: unknown topic family id "${id}"`);
  }
  return weeksFile.weeks.filter((week) => week.topicFamilies.includes(id));
}

/** Every phase gate defined by §4.1, in source (week-number) order. */
export function listGates(): readonly Gate[] {
  return gatesFile.gates;
}

/**
 * The phase gate that follows `week`, or `undefined` if `week` is not a
 * gate week.
 */
export function gateAfter(week: number): Gate | undefined {
  return gatesFile.gates.find((gate) => gate.afterWeek === week);
}

/** Every week that carries a non-null checkpoint, in source order. */
export function checkpointWeeks(): readonly Week[] {
  return weeksFile.weeks.filter((week) => week.checkpoint !== null);
}

/** Every week flagged as a mini-contest week, in source order. */
export function miniContestWeeks(): readonly Week[] {
  return weeksFile.weeks.filter((week) => week.hasMiniContest);
}
