/**
 * Typed loaders and lookup helpers over `data/session-template.json`,
 * `data/mentor-sop.json` and `data/hint-policy.json`: the §5.1 two-session
 * weekly template, the §5.2 seven-step mentor SOP, and the §5.3
 * progressive-hinting escalation policy.
 *
 * Per the "Layering rules" in `docs/architecture/README.md`, this module
 * assumes the data it receives is valid once it has passed through
 * {@link parseDataFile}: it never re-implements validation logic of its
 * own (segment contiguity, step ordering and level ordering are all
 * enforced by the schemas in `src/schema/`, not re-checked here). Loading
 * happens once, at module load, and the result is memoised.
 *
 * This module owns hint *escalation* only. Re-solve *scheduling* -- when
 * "the next interval" falls, how a re-solve obligation is tracked to
 * completion -- belongs to the assessment module (issue #14) and is
 * deliberately not implemented here; see `hintPolicyCallout` and
 * `requiresResolve` below.
 */

import { type HintLevel, type HintPolicyFile, hintPolicyFileSchema } from "../schema/hint-policy";
import { type MentorSopFile, type SopStep, mentorSopFileSchema } from "../schema/mentor-sop";
import { parseDataFile } from "../schema/common";
import {
  type Session,
  type SessionTemplateFile,
  type Segment,
  sessionTemplateFileSchema,
} from "../schema/session-template";

// `resolveJsonModule` is enabled in tsconfig.json, so a static import is a
// deterministic, dependency-free way to bring the corpus files in — no
// filesystem read, no async loader, and Bun/tsc both resolve it at build
// time. The value is `unknown` as far as validity is concerned; it is
// still parsed through the schema below before anything trusts its shape.
import rawSessionTemplate from "../../data/session-template.json";
import rawMentorSop from "../../data/mentor-sop.json";
import rawHintPolicy from "../../data/hint-policy.json";

const SESSION_TEMPLATE_SOURCE_NAME = "data/session-template.json";
const MENTOR_SOP_SOURCE_NAME = "data/mentor-sop.json";
const HINT_POLICY_SOURCE_NAME = "data/hint-policy.json";

/**
 * The validated contents of `data/session-template.json`, parsed once at
 * module load. Throws {@link CorpusValidationError} if the file does not
 * match {@link sessionTemplateFileSchema}.
 */
const sessionTemplateFile: SessionTemplateFile = parseDataFile(
  sessionTemplateFileSchema,
  rawSessionTemplate,
  SESSION_TEMPLATE_SOURCE_NAME,
);

/**
 * The validated contents of `data/mentor-sop.json`, parsed once at module
 * load. Throws {@link CorpusValidationError} if the file does not match
 * {@link mentorSopFileSchema}.
 */
const mentorSopFile: MentorSopFile = parseDataFile(
  mentorSopFileSchema,
  rawMentorSop,
  MENTOR_SOP_SOURCE_NAME,
);

/**
 * The validated contents of `data/hint-policy.json`, parsed once at module
 * load. Throws {@link CorpusValidationError} if the file does not match
 * {@link hintPolicyFileSchema}.
 */
const hintPolicyFile: HintPolicyFile = parseDataFile(
  hintPolicyFileSchema,
  rawHintPolicy,
  HINT_POLICY_SOURCE_NAME,
);

/**
 * Looks up a §5.1 session by number, throwing a readable error naming the
 * valid session numbers if `sessionNo` does not match either session.
 */
export function getSession(sessionNo: 1 | 2): Session {
  const session = sessionTemplateFile.sessions.find((entry) => entry.sessionNo === sessionNo);
  if (session === undefined) {
    const validSessionNumbers = sessionTemplateFile.sessions
      .map((entry) => entry.sessionNo)
      .join(", ");
    throw new Error(
      `getSession: unknown session number ${sessionNo}. Valid session numbers: ${validSessionNumbers}.`,
    );
  }
  return session;
}

/** The five time segments of session `sessionNo`, in §5.1 table row order. */
export function sessionSegments(sessionNo: 1 | 2): readonly Segment[] {
  return getSession(sessionNo).segments;
}

/**
 * The total number of minutes session `sessionNo` accounts for -- the sum
 * of every segment's `endMinute - startMinute`. The schema already
 * guarantees this is exactly 120 for both sessions (contiguous from 0,
 * ending at 120); this function computes it from the segments rather than
 * hard-coding 120 so a schema change would be reflected here too.
 */
export function sessionTotalMinutes(sessionNo: 1 | 2): number {
  return sessionSegments(sessionNo).reduce(
    (total, segment) => total + (segment.endMinute - segment.startMinute),
    0,
  );
}

/** Every §5.2 SOP step, ordered 1..7. */
export function sopSteps(): readonly SopStep[] {
  return [...mentorSopFile.steps].sort((a, b) => a.order - b.order);
}

/** Step 6's minimum test checklist, in §5.2 source order. */
export function minimumTests(): readonly string[] {
  return mentorSopFile.minimumTests;
}

/** Step 7's four post-Accepted questions, in §5.2 source order. */
export function postAcceptedQuestions(): readonly string[] {
  return mentorSopFile.postAcceptedQuestions;
}

/** Every §5.3 hint escalation level, ordered 1..5. */
export function hintLevels(): readonly HintLevel[] {
  return [...hintPolicyFile.levels].sort((a, b) => a.level - b.level);
}

/**
 * Looks up a §5.3 hint level by its 1-5 position, throwing a readable error
 * naming the valid range if `level` is out of range.
 */
export function getHintLevel(level: number): HintLevel {
  const found = hintPolicyFile.levels.find((entry) => entry.level === level);
  if (found === undefined) {
    const levelNumbers = hintPolicyFile.levels.map((entry) => entry.level);
    const min = Math.min(...levelNumbers);
    const max = Math.max(...levelNumbers);
    throw new Error(`getHintLevel: level ${level} is out of range. Valid range: ${min}-${max}.`);
  }
  return found;
}

/**
 * The hint level that follows `current` in the §5.3 escalation order, or
 * `null` if `current` is already the terminal level ("editorial").
 * Escalation strictly terminates at the terminal level: this never wraps
 * back to level 1 and never throws for the terminal level itself (though it
 * still throws, via {@link getHintLevel}, if `current` is not a valid level
 * at all).
 */
export function nextHintLevel(current: number): HintLevel | null {
  getHintLevel(current);
  const levels = hintLevels();
  if (current >= levels.length) {
    return null;
  }
  return getHintLevel(current + 1);
}

/**
 * Whether a problem that reached hint `level` must be re-solved without
 * help at the next interval, per {@link HintLevel.requiresResolve}. Throws
 * a readable error naming the valid range if `level` is out of range.
 */
export function requiresResolve(level: number): boolean {
  return getHintLevel(level).requiresResolve;
}

/** The §5.3 "Progressive hinting" callout text, verbatim. */
export function hintPolicyCallout(): string {
  return hintPolicyFile.calloutText;
}
