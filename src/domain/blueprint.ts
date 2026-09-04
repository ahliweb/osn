/**
 * Typed loader/lookup helpers over `data/assessment-bank.json` (the six §13
 * Assessment Bank kinds), plus `buildBlueprint()`: the §18 evaluation
 * blueprint generator that turns a `{ kind, week?, topicFamilies? }` request
 * into a structured evaluation blueprint honouring the §2.2 OSN-K/OSN-P
 * contest formats, the §4 weekly problem loads, the §4.1 phase-gate
 * evidence, and the §14.1 "at least one alternative per topic" rule.
 *
 * Per the "Layering rules" in `docs/architecture/README.md`, this module
 * assumes the data it receives is valid once it has passed through
 * {@link parseDataFile}: it never re-implements validation logic of its
 * own. Loading happens once, at module load, and the result is memoised.
 *
 * **`buildBlueprint()` never restates the §2.2 OSN-K/OSN-P item counts or
 * durations as new literals.** It reads them live from
 * `getStage("osn-k")`/`getStage("osn-p")` (`src/domain/structure.ts`,
 * backed by `data/competition-stages.json`) every time it is called, so a
 * future change to the stage data can never silently desync from this
 * module -- see `tests/unit/blueprint.test.ts` for the test that pins this.
 *
 * Invalid requests (an unknown `kind`, a missing/out-of-range `week`, a
 * `checkpoint` week that is not one of the seven §4.1 gate weeks, or an
 * unknown `topicFamilies` id) fail with a {@link BlueprintRequestError}
 * naming both what was wrong and the valid values/range, never a raw
 * exception -- so a future CLI layer (issue #19+) can catch this one error
 * class and print an actionable message.
 */

import {
  type AssessmentBankFile,
  type BankKind,
  type BankKindId,
  BANK_KIND_IDS,
  assessmentBankFileSchema,
} from "../schema/assessment-bank";
import { parseDataFile } from "../schema/common";
import { GATE_WEEKS } from "../schema/gate";
import { DIFFICULTY_BAND_IDS } from "../schema/problem-taxonomy";
import { MAX_WEEK, MIN_WEEK, type Week } from "../schema/week";
import { gateAfter, getWeek, listWeeks } from "./curriculum";
import { getStage } from "./structure";
import { isTopicFamilyId, listTopicFamilies } from "./topic-families";

// `resolveJsonModule` is enabled in tsconfig.json, so a static import is a
// deterministic, dependency-free way to bring the corpus file in — no
// filesystem read, no async loader, and Bun/tsc both resolve it at build
// time. The value is `unknown` as far as validity is concerned; it is
// still parsed through the schema below before anything trusts its shape.
import rawAssessmentBank from "../../data/assessment-bank.json";

const ASSESSMENT_BANK_SOURCE_NAME = "data/assessment-bank.json";

/**
 * The validated contents of `data/assessment-bank.json`, parsed once at
 * module load. Throws {@link CorpusValidationError} if the file does not
 * match {@link assessmentBankFileSchema}.
 */
const assessmentBankFile: AssessmentBankFile = parseDataFile(
  assessmentBankFileSchema,
  rawAssessmentBank,
  ASSESSMENT_BANK_SOURCE_NAME,
);

/** Every §13 assessment-bank kind, in source (§13 row) order. */
export function listBankKinds(): readonly BankKind[] {
  return assessmentBankFile.banks;
}

/**
 * Looks up a §13 assessment-bank kind by id, throwing a readable error
 * naming the unknown id and listing every valid id if none matches.
 */
export function getBankKind(id: string): BankKind {
  const bankKind = assessmentBankFile.banks.find((entry) => entry.id === id);
  if (bankKind === undefined) {
    const validIds = assessmentBankFile.banks.map((entry) => entry.id).join(", ");
    throw new Error(`getBankKind: unknown bank kind id "${id}". Valid ids: ${validIds}.`);
  }
  return bankKind;
}

/**
 * Thrown by {@link buildBlueprint} for every invalid request: an unknown
 * `kind`, a missing/out-of-range `week`, a `checkpoint` week that is not one
 * of the seven §4.1 gate weeks, or an unknown `topicFamilies` id. Always
 * carries an actionable message naming both what was wrong and the valid
 * values/range, so a future CLI layer can catch this one class and print it
 * directly rather than a raw stack trace.
 */
export class BlueprintRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlueprintRequestError";
  }
}

/** {@link buildBlueprint}'s request shape. `kind` is validated at runtime, not restricted to {@link BankKindId} at the type level, so an invalid `kind` fails with a {@link BlueprintRequestError} rather than a compile-time-only guarantee. */
export interface BuildBlueprintRequest {
  /** One of the six §13 bank-kind ids (see {@link BANK_KIND_IDS}). */
  readonly kind: string;
  /** Required for `weekly` and `checkpoint`; an integer {@link MIN_WEEK}-{@link MAX_WEEK}. */
  readonly week?: number;
  /**
   * Optional topic-family id override. When given, every id must be a known
   * §2.1 topic-family id (see `src/domain/topic-families.ts`); the whole
   * list then replaces this blueprint's default `topicCoverage` (documented
   * per-kind via a leading `notes` entry when this happens).
   */
  readonly topicFamilies?: readonly string[];
}

/**
 * A bank kind's item/case count: a `{min, max}` range where §2.2/§4 give one
 * (OSN-K, OSN-P, a week with a non-null `problemLoad`), or `null` where the
 * source gives no numeric count at all (diagnostic, checkpoint, OSN
 * Nasional, or a week whose `problemLoad` is `null`) -- never invented in
 * that case; see the accompanying `notes` entry instead.
 */
export type ItemCount = { readonly min: number; readonly max: number } | null;

/** The OSN-P §2.2 per-case structure: 3 comprehension + 1 programming task per case. */
export interface CaseStructure {
  readonly comprehensionPerCase: number;
  readonly programmingPerCase: number;
}

/**
 * The structured evaluation blueprint {@link buildBlueprint} returns: item
 * counts, time allocation, topic coverage, difficulty spread, and the §14.1
 * per-topic alternative rule, plus whatever kind-specific structure applies
 * (`week`/`gateEvidence` for `checkpoint`, `week` for `weekly`,
 * `caseStructure` for `osn-p-style`).
 */
export interface EvaluationBlueprint {
  /** The bank kind this blueprint was built for. */
  readonly kind: BankKindId;
  /** This bank kind's item/case count, or `null` if the source gives none (see `notes`). */
  readonly itemCount: ItemCount;
  /** This bank kind's total time allocation in minutes, or `null` if the source gives none (see `notes`). */
  readonly timeAllocationMinutes: number | null;
  /** The topic-family ids (or, for `diagnostic`, the §14.1 diagnostic areas) in scope. */
  readonly topicCoverage: readonly string[];
  /** The corpus's five named difficulty bands (`src/schema/problem-taxonomy.ts`), reused rather than a new scale. */
  readonly difficultySpread: readonly string[];
  /** The §14.1 minimum number of alternative problems required per topic; always `>= 1`. */
  readonly alternativesPerTopic: number;
  /** This bank kind's scoring model (see `src/schema/assessment-bank.ts`). `"partial"` for `osn-p-style`. */
  readonly scoringModel: BankKind["scoringModel"];
  /** Explanatory notes: what was derived vs. read live from the source, and any explicit "no count is defined" statements. */
  readonly notes: readonly string[];
  /** The standing advisory: a blueprint is a spec for the bank, not the assembled/reviewed problem set itself. */
  readonly caveat: string;
  /** Present for `weekly` and `checkpoint`: the week number the request resolved. */
  readonly week?: number;
  /** Present for `osn-p-style`: the §2.2 per-case comprehension/programming task structure. */
  readonly caseStructure?: CaseStructure;
  /** Present for `checkpoint`: the §4.1 gate evidence required at this week. */
  readonly gateEvidence?: readonly string[];
}

/**
 * The §14.1 "Siapkan problem bank terkurasi untuk semua minggu dan minimal
 * satu alternatif per topik" minimum: every blueprint carries
 * `alternativesPerTopic >= MIN_ALTERNATIVES_PER_TOPIC`.
 */
export const MIN_ALTERNATIVES_PER_TOPIC = 1;

const ALTERNATIVES_RULE_NOTE = `§14.1: prepare a curated problem bank for every week with at least one alternative problem per topic -- every blueprint carries alternativesPerTopic >= ${MIN_ALTERNATIVES_PER_TOPIC}.`;

/**
 * The standing advisory every blueprint's `caveat` repeats: a blueprint
 * specifies the *shape* of a bank (counts, timing, coverage), it is not the
 * assembled problem set itself. Grounded in §13's "Quality Review" row
 * ("Audit problem statement, solution, generator/test data, dan
 * pedagogical fit sebelum digunakan"): a mentor still selects and reviews
 * the actual problems against this shape before use.
 */
const BLUEPRINT_CAVEAT =
  "This is a structured evaluation blueprint (item/case counts, timing, topic coverage) -- not " +
  "the assembled problem set itself. Per §13's Quality Review step, a mentor must still audit " +
  "the actual problem statements, solutions, generator/test data and pedagogical fit against " +
  "this shape before use.";

/**
 * The §14.1 item 3 diagnostic areas ("Lakukan diagnostic C++, logika,
 * matematika, complexity, dan problem solving"), verbatim. Deliberately a
 * separate small vocabulary from the ten §2.1 topic-family ids: §14.1's
 * diagnostic areas are broader/coarser categories (e.g. "matematika" spans
 * several §2.1 families), not a subset of `topic-families.json`.
 */
export const DIAGNOSTIC_AREAS = [
  "C++",
  "logika",
  "matematika",
  "complexity",
  "problem solving",
] as const;

function isBankKindId(id: string): id is BankKindId {
  return (BANK_KIND_IDS as readonly string[]).includes(id);
}

function requireBankKind(kindId: string): BankKind {
  if (!isBankKindId(kindId)) {
    throw new BlueprintRequestError(
      `buildBlueprint: unknown bank kind "${kindId}". Valid kinds: ${BANK_KIND_IDS.join(", ")}.`,
    );
  }
  return getBankKind(kindId);
}

/**
 * Validates an optional `topicFamilies` request override: `undefined` is
 * passed through unchanged (no override requested); every id in a given
 * list must be a known §2.1 topic-family id, or this throws a
 * {@link BlueprintRequestError} naming every unknown id and listing every
 * valid one.
 */
function resolveTopicFamiliesOverride(
  topicFamilies: readonly string[] | undefined,
): readonly string[] | undefined {
  if (topicFamilies === undefined) {
    return undefined;
  }

  const unknownIds = topicFamilies.filter((id) => !isTopicFamilyId(id));
  if (unknownIds.length > 0) {
    const validIds = listTopicFamilies()
      .map((family) => family.id)
      .join(", ");
    throw new BlueprintRequestError(
      `buildBlueprint: unknown topic family id(s): ${unknownIds.join(", ")}. Valid ids: ${validIds}.`,
    );
  }

  return topicFamilies;
}

/**
 * Requires `request.week` to be present and resolvable to a real week,
 * throwing a {@link BlueprintRequestError} naming the valid {@link MIN_WEEK}-
 * {@link MAX_WEEK} range either way (missing, non-integer, or out of range).
 */
function requireWeek(request: BuildBlueprintRequest, kindId: BankKindId): Week {
  if (request.week === undefined) {
    throw new BlueprintRequestError(
      `buildBlueprint: kind "${kindId}" requires a "week" (an integer ${MIN_WEEK}-${MAX_WEEK}); none was given.`,
    );
  }

  try {
    return getWeek(request.week);
  } catch (error) {
    throw new BlueprintRequestError(`buildBlueprint: ${(error as Error).message}`);
  }
}

/**
 * {@link requireWeek}, plus the `checkpoint`-only requirement that the
 * resolved week actually carries a checkpoint (one of the seven §4.1 gate
 * weeks, {@link GATE_WEEKS}) -- otherwise a {@link BlueprintRequestError}
 * naming every valid checkpoint week.
 */
function requireCheckpointWeek(request: BuildBlueprintRequest): Week {
  const week = requireWeek(request, "checkpoint");
  if (week.checkpoint === null) {
    throw new BlueprintRequestError(
      `buildBlueprint: week ${week.week} is not a checkpoint week. Valid checkpoint weeks: ${GATE_WEEKS.join(", ")}.`,
    );
  }
  return week;
}

/** Every §2.1 topic-family id, in source order -- the default `topicCoverage` for stage-facing/national-mixed banks. */
function allTopicFamilyIds(): readonly string[] {
  return listTopicFamilies().map((family) => family.id);
}

/**
 * The cumulative, de-duplicated set of topic-family ids exercised by every
 * week from week 1 through `uptoWeek` inclusive, in first-appearance order.
 */
function cumulativeTopicFamilies(uptoWeek: number): readonly string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const week of listWeeks()) {
    if (week.week > uptoWeek) {
      continue;
    }
    for (const familyId of week.topicFamilies) {
      if (!seen.has(familyId)) {
        seen.add(familyId);
        ordered.push(familyId);
      }
    }
  }

  return ordered;
}

/** Assembles the fields every {@link EvaluationBlueprint} carries, plus whichever kind-specific fields are supplied. */
function finalizeBlueprint(params: {
  readonly bankKind: BankKind;
  readonly itemCount: ItemCount;
  readonly timeAllocationMinutes: number | null;
  readonly topicCoverage: readonly string[];
  readonly notes: readonly string[];
  readonly week?: number;
  readonly caseStructure?: CaseStructure;
  readonly gateEvidence?: readonly string[];
}): EvaluationBlueprint {
  const {
    bankKind,
    itemCount,
    timeAllocationMinutes,
    topicCoverage,
    notes,
    week,
    caseStructure,
    gateEvidence,
  } = params;

  return {
    kind: bankKind.id,
    itemCount,
    timeAllocationMinutes,
    topicCoverage,
    difficultySpread: [...DIFFICULTY_BAND_IDS],
    alternativesPerTopic: MIN_ALTERNATIVES_PER_TOPIC,
    scoringModel: bankKind.scoringModel,
    notes: [...notes, ALTERNATIVES_RULE_NOTE],
    caveat: BLUEPRINT_CAVEAT,
    ...(week !== undefined ? { week } : {}),
    ...(caseStructure !== undefined ? { caseStructure } : {}),
    ...(gateEvidence !== undefined ? { gateEvidence } : {}),
  };
}

/** The leading note {@link finalizeBlueprint}'s callers prepend when the caller's `topicFamilies` overrides the kind's default coverage. */
function overrideNote(defaultDescription: string): string {
  return `topicCoverage was overridden by the caller's requested topicFamilies rather than ${defaultDescription}.`;
}

function buildDiagnosticBlueprint(
  bankKind: BankKind,
  topicFamiliesOverride: readonly string[] | undefined,
): EvaluationBlueprint {
  const topicCoverage = topicFamiliesOverride ?? [...DIAGNOSTIC_AREAS];

  const notes: string[] = [
    "§14.1 item 3: the diagnostic bank covers C++, logika, matematika, complexity, dan problem " +
      "solving before the 28-week programme starts (§13.1 step 1: diagnostic baseline -> profil " +
      "kompetensi per siswa).",
    "No item count is defined in the source for the diagnostic bank; §14.1 requires area " +
      "coverage, not a soal count, so itemCount is left null here rather than invented.",
  ];
  if (topicFamiliesOverride !== undefined) {
    notes.unshift(overrideNote("the default §14.1 diagnostic areas"));
  }

  return finalizeBlueprint({
    bankKind,
    itemCount: null,
    timeAllocationMinutes: null,
    topicCoverage,
    notes,
  });
}

function buildWeeklyBlueprint(
  bankKind: BankKind,
  request: BuildBlueprintRequest,
  topicFamiliesOverride: readonly string[] | undefined,
): EvaluationBlueprint {
  const week = requireWeek(request, "weekly");
  const topicCoverage = topicFamiliesOverride ?? week.topicFamilies;

  const notes: string[] = [
    `topicCoverage is drawn from data/weeks.json's topicFamilies for week ${week.week} (§4).`,
  ];

  let itemCount: ItemCount;
  if (week.problemLoad === null) {
    itemCount = null;
    notes.push(
      `Week ${week.week}'s problemLoad is null in the source (§4) -- its Praktik/Evaluasi cell describes a simulation/contest rather than a numeric problem count, so no count is invented here.`,
    );
  } else {
    itemCount = { min: week.problemLoad.min, max: week.problemLoad.max };
  }

  if (topicFamiliesOverride !== undefined) {
    notes.unshift(overrideNote(`week ${week.week}'s own topicFamilies`));
  }

  return finalizeBlueprint({
    bankKind,
    itemCount,
    timeAllocationMinutes: null,
    topicCoverage,
    notes,
    week: week.week,
  });
}

function buildCheckpointBlueprint(
  bankKind: BankKind,
  request: BuildBlueprintRequest,
  topicFamiliesOverride: readonly string[] | undefined,
): EvaluationBlueprint {
  const week = requireCheckpointWeek(request);
  const cumulative = cumulativeTopicFamilies(week.week);
  const topicCoverage = topicFamiliesOverride ?? cumulative;

  const gate = gateAfter(week.week);
  if (gate === undefined) {
    // Every checkpoint week (weekSchema's `checkpoint` field, backed by
    // data/weeks.json) coincides with a §4.1 gate week (GATE_WEEKS) in the
    // real corpus -- this is a corpus-consistency invariant, not a request
    // error, so it is asserted rather than surfaced as a
    // BlueprintRequestError.
    throw new Error(
      `buildBlueprint: checkpoint week ${week.week} has no matching §4.1 gate -- data/weeks.json and data/gates.json have desynced.`,
    );
  }

  const notes: string[] = [
    `Checkpoint blueprints are only valid at the seven §4.1 gate weeks (${GATE_WEEKS.join(", ")}); week ${week.week} is one of them.`,
    `topicCoverage is the cumulative set of topic families exercised from week 1 through week ${week.week} (data/weeks.json, §4).`,
  ];
  if (topicFamiliesOverride !== undefined) {
    notes.unshift(overrideNote(`the cumulative week 1-${week.week} topic-family set`));
  }

  return finalizeBlueprint({
    bankKind,
    itemCount: null,
    timeAllocationMinutes: null,
    topicCoverage,
    notes,
    week: week.week,
    gateEvidence: gate.evidence,
  });
}

function buildOsnKBlueprint(
  bankKind: BankKind,
  topicFamiliesOverride: readonly string[] | undefined,
): EvaluationBlueprint {
  const format = getStage("osn-k").contestFormat;
  if (format === null || format.kind !== "problem-set") {
    throw new Error(
      `buildBlueprint: expected getStage("osn-k").contestFormat to be a problem-set format, got ${JSON.stringify(format)}.`,
    );
  }

  const topicCoverage = topicFamiliesOverride ?? allTopicFamilyIds();
  const notes: string[] = [
    'itemCount and timeAllocationMinutes are read live from getStage("osn-k").contestFormat ' +
      "(§2.2), not restated as new literals.",
  ];
  if (topicFamiliesOverride !== undefined) {
    notes.unshift(overrideNote("the default full topic-family set"));
  }

  return finalizeBlueprint({
    bankKind,
    itemCount: { min: format.minItems, max: format.maxItems },
    timeAllocationMinutes: format.durationMinutes,
    topicCoverage,
    notes,
  });
}

function buildOsnPBlueprint(
  bankKind: BankKind,
  topicFamiliesOverride: readonly string[] | undefined,
): EvaluationBlueprint {
  if (bankKind.scoringModel !== "partial") {
    // Defense in depth: `osn-p-style` must always score `"partial"` per
    // §2.2's "Partial scoring" -- if a future edit to
    // data/assessment-bank.json ever drifted from that, fail loudly here
    // rather than silently returning a wrong scoring model.
    throw new Error(
      `buildBlueprint: osn-p-style must use scoringModel "partial" per §2.2\'s "Partial scoring"; data/assessment-bank.json now has "${bankKind.scoringModel}".`,
    );
  }

  const format = getStage("osn-p").contestFormat;
  if (format === null || format.kind !== "case-study") {
    throw new Error(
      `buildBlueprint: expected getStage("osn-p").contestFormat to be a case-study format, got ${JSON.stringify(format)}.`,
    );
  }

  const topicCoverage = topicFamiliesOverride ?? allTopicFamilyIds();
  const notes: string[] = [
    "itemCount, timeAllocationMinutes and caseStructure are read live from " +
      'getStage("osn-p").contestFormat (§2.2), not restated as new literals.',
  ];
  if (topicFamiliesOverride !== undefined) {
    notes.unshift(overrideNote("the default full topic-family set"));
  }

  return finalizeBlueprint({
    bankKind,
    itemCount: { min: format.minItems, max: format.maxItems },
    timeAllocationMinutes: format.durationMinutes,
    topicCoverage,
    notes,
    caseStructure: {
      comprehensionPerCase: format.comprehensionPerCase,
      programmingPerCase: format.programmingPerCase,
    },
  });
}

function buildNationalMixedBlueprint(
  bankKind: BankKind,
  topicFamiliesOverride: readonly string[] | undefined,
): EvaluationBlueprint {
  const format = getStage("osn-nasional").contestFormat;
  const topicCoverage = topicFamiliesOverride ?? allTopicFamilyIds();

  const notes: string[] = [
    `OSN Nasional has no numeric contest format in §2.2 (getStage("osn-nasional").contestFormat is ${format === null ? "null" : "non-null"}); no itemCount/timeAllocationMinutes is invented here.`,
    "topicCoverage defaults to all ten §2.1 topic families -- OSN Nasional is a mixed-topic " +
      "contest integrating the full syllabus.",
  ];
  if (topicFamiliesOverride !== undefined) {
    notes.unshift(overrideNote("the default full topic-family set"));
  }

  return finalizeBlueprint({
    bankKind,
    itemCount: null,
    timeAllocationMinutes: null,
    topicCoverage,
    notes,
  });
}

/**
 * Builds a structured evaluation blueprint for `request.kind`, per the §18
 * scope:
 *
 *  - `diagnostic`: `topicCoverage` defaults to the five §14.1 diagnostic
 *    areas ({@link DIAGNOSTIC_AREAS}); no `week` required; `itemCount` is
 *    `null` (no count is defined in the source).
 *  - `weekly`: requires `week`; `topicCoverage` and `itemCount` are drawn
 *    from that week's `topicFamilies`/`problemLoad` (`data/weeks.json`,
 *    §4). Where `problemLoad` is `null` (weeks 8, 12, 16, 20, 24, 25-28),
 *    `itemCount` is `null` and `notes` says so explicitly.
 *  - `checkpoint`: requires `week`, and that week must carry a checkpoint
 *    (one of the seven §4.1 gate weeks, {@link GATE_WEEKS}) or this throws.
 *    `topicCoverage` is the cumulative topic-family set from week 1 through
 *    that week; `gateEvidence` carries that week's §4.1 gate evidence.
 *  - `osn-k-style`: `itemCount`/`timeAllocationMinutes` are read live from
 *    `getStage("osn-k").contestFormat` (§2.2: 30-50 items/150 minutes),
 *    never hard-coded.
 *  - `osn-p-style`: `itemCount`/`timeAllocationMinutes`/`caseStructure` are
 *    read live from `getStage("osn-p").contestFormat` (§2.2: 5-8 case
 *    studies/180 minutes, 3 comprehension + 1 programming task per case);
 *    `scoringModel` is always `"partial"`.
 *  - `national-mixed`: `topicCoverage` defaults to all ten §2.1 topic
 *    families; `itemCount`/`timeAllocationMinutes` are `null` (§2.2 gives
 *    OSN Nasional no numeric contest format).
 *
 * Every blueprint carries `alternativesPerTopic >= {@link
 * MIN_ALTERNATIVES_PER_TOPIC}` (the §14.1 rule) and a `difficultySpread`
 * reusing the corpus's five named difficulty bands
 * (`src/schema/problem-taxonomy.ts`).
 *
 * `request.topicFamilies`, when given, must be all known §2.1 topic-family
 * ids and then replaces the kind's default `topicCoverage` (a leading
 * `notes` entry documents this when it happens).
 *
 * Throws {@link BlueprintRequestError} -- never a raw exception -- for
 * every invalid request: an unknown `kind`, a missing/out-of-range `week`
 * on `weekly`/`checkpoint`, a non-checkpoint `week` on `checkpoint`, or an
 * unknown `topicFamilies` id. Every thrown message names both what was
 * wrong and the valid values/range.
 */
export function buildBlueprint(request: BuildBlueprintRequest): EvaluationBlueprint {
  const bankKind = requireBankKind(request.kind);
  const topicFamiliesOverride = resolveTopicFamiliesOverride(request.topicFamilies);

  if (bankKind.id === "diagnostic") {
    return buildDiagnosticBlueprint(bankKind, topicFamiliesOverride);
  }
  if (bankKind.id === "weekly") {
    return buildWeeklyBlueprint(bankKind, request, topicFamiliesOverride);
  }
  if (bankKind.id === "checkpoint") {
    return buildCheckpointBlueprint(bankKind, request, topicFamiliesOverride);
  }
  if (bankKind.id === "osn-k-style") {
    return buildOsnKBlueprint(bankKind, topicFamiliesOverride);
  }
  if (bankKind.id === "osn-p-style") {
    return buildOsnPBlueprint(bankKind, topicFamiliesOverride);
  }

  // requireBankKind already restricts bankKind.id to one of the six
  // BANK_KIND_IDS, so having ruled out the first five, this is necessarily
  // "national-mixed".
  return buildNationalMixedBlueprint(bankKind, topicFamiliesOverride);
}
