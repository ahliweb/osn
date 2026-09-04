/**
 * `renderWeeklyPlan` -- a pure function from a validated week number to a
 * mentor-ready Markdown plan for that week of the §4 28-week syllabus
 * (issue #21). Combines `src/domain/curriculum.ts` (this week's focus,
 * content, outcome, practice target, problem-load range, and -- on a gate
 * week -- the §4.1 gate evidence) with `src/domain/pedagogy.ts` (the two
 * §5.1 120-minute session templates, the §5.2 seven-step SOP, and the
 * §5.3 hint policy ladder).
 *
 * **Pure**: no file I/O, no `process` access, no dates, no randomness --
 * identical input always produces byte-identical output. File writing is a
 * thin separate layer in `src/cli/commands/render.ts`; this module never
 * touches the filesystem. Fails loudly (throws {@link RenderRequestError})
 * on an out-of-range week instead of ever emitting a partially-filled
 * document.
 */

import { gateAfter, getWeek } from "../domain/curriculum";
import { getSession, hintLevels, sopSteps } from "../domain/pedagogy";
import { MAX_WEEK, MIN_WEEK } from "../schema/week";
import { RenderRequestError } from "./errors";
import { escapeCell } from "./markdown-utils";

/**
 * Throws {@link RenderRequestError} naming the valid {@link MIN_WEEK}-
 * {@link MAX_WEEK} range if `week` is not an integer in that range.
 * Validated here, ahead of `getWeek` (`src/domain/curriculum.ts`), so this
 * module always throws its own named error rather than `getWeek`'s plain
 * `Error` for the exact same condition.
 */
function requireWeekInRange(week: number): void {
  if (!Number.isInteger(week) || week < MIN_WEEK || week > MAX_WEEK) {
    throw new RenderRequestError(
      `renderWeeklyPlan: week ${week} is out of range. Valid range: ${MIN_WEEK}-${MAX_WEEK}.`,
    );
  }
}

/**
 * Finds the §5.1 "Exit ticket" instruction: the final segment, among
 * either session, whose activity text names an exit ticket. Searches
 * rather than hard-coding "session 1's last segment" so this stays correct
 * even if the exit ticket ever moved to session 2's final segment instead
 * -- in the current corpus (`data/session-template.json`) it is session
 * 1's segment 115-120 ("Exit ticket: 3 poin yang dipahami + 1 gap.").
 *
 * Throws {@link RenderRequestError} if neither session's final segment
 * names an exit ticket -- this should never happen for the real corpus
 * (enforced structurally: every session's final segment ends at minute
 * 120), but a renderer must fail loudly rather than silently omit the
 * exit-ticket instruction if the source data ever changed shape.
 */
function findExitTicketInstruction(): string {
  for (const sessionNo of [1, 2] as const) {
    const segments = getSession(sessionNo).segments;
    const finalSegment = segments[segments.length - 1];
    if (finalSegment !== undefined && /exit ticket/i.test(finalSegment.activity)) {
      return finalSegment.activity;
    }
  }
  throw new RenderRequestError(
    "renderWeeklyPlan: no session's final segment (§5.1) names an exit ticket -- " +
      "data/session-template.json may have changed shape.",
  );
}

/** Renders one §5.1 session (its focus and its five timed segments) as a Markdown table. */
function renderSessionSection(sessionNo: 1 | 2): string {
  const session = getSession(sessionNo);
  const lines: string[] = [];
  lines.push(`### Session ${session.sessionNo} -- ${session.focus}`);
  lines.push("");
  lines.push("| Minutes | Activity |");
  lines.push("| --- | --- |");
  for (const segment of session.segments) {
    lines.push(`| ${segment.startMinute}-${segment.endMinute} | ${escapeCell(segment.activity)} |`);
  }
  return lines.join("\n");
}

/**
 * Renders a mentor-ready Markdown plan for `week` (an integer
 * {@link MIN_WEEK}-{@link MAX_WEEK}): the week number and focus, the
 * content list, the learning outcome, the practice/evaluation target and
 * curated problem-load range (or an explicit "no fixed count" note where
 * `problemLoad` is `null`), both 120-minute §5.1 session templates with
 * their segment timings and activities, the §5.1 exit-ticket instruction,
 * the §5.2 SOP reminder (7 steps), the §5.3 hint policy ladder, and --
 * only on a gate week -- the §4.1 gate evidence required to proceed.
 *
 * Throws {@link RenderRequestError} for a `week` outside
 * {@link MIN_WEEK}-{@link MAX_WEEK} (including non-integer values), naming
 * the valid range, before doing anything else.
 */
export function renderWeeklyPlan(week: number): string {
  requireWeekInRange(week);
  const weekData = getWeek(week);

  const lines: string[] = [];
  lines.push(`# Week ${weekData.week}: ${weekData.focus}`);
  lines.push("");
  lines.push(`Topic families: ${weekData.topicFamilies.join(", ")}`);
  if (weekData.hasMiniContest) {
    lines.push("This week includes a mini-contest.");
  }
  lines.push("");

  lines.push("## Content");
  for (const item of weekData.content) {
    lines.push(`- ${item}`);
  }
  lines.push("");

  lines.push("## Outcome");
  lines.push(weekData.outcome);
  lines.push("");

  lines.push("## Practice / evaluation target");
  lines.push(weekData.practice);
  if (weekData.problemLoad === null) {
    lines.push(
      "Curated problem-load: no fixed count for this week -- the practice/evaluation " +
        "activity above is a simulation or contest, not a numeric problem target.",
    );
  } else {
    lines.push(
      `Curated problem-load target: ${weekData.problemLoad.min}-${weekData.problemLoad.max} soal (internal workload guidance for mentors, not an official pass/fail threshold -- §4).`,
    );
  }
  lines.push("");

  lines.push("## Session templates (§5.1)");
  lines.push("");
  lines.push(renderSessionSection(1));
  lines.push("");
  lines.push(renderSessionSection(2));
  lines.push("");

  lines.push("## Exit ticket (§5.1)");
  lines.push(findExitTicketInstruction());
  lines.push("");

  lines.push("## SOP reminder (§5.2)");
  for (const step of sopSteps()) {
    lines.push(`${step.order}. ${step.instruction}`);
  }
  lines.push("");

  lines.push("## Hint policy ladder (§5.3)");
  for (const level of hintLevels()) {
    const resolveNote = level.requiresResolve
      ? " -- requires a hint-free re-solve at the next interval"
      : "";
    lines.push(`${level.level}. ${level.description}${resolveNote}`);
  }

  if (weekData.checkpoint !== null) {
    const gate = gateAfter(weekData.week);
    if (gate === undefined) {
      throw new RenderRequestError(
        `renderWeeklyPlan: week ${weekData.week} carries checkpoint ${weekData.checkpoint} but has no matching §4.1 gate -- data/weeks.json and data/gates.json have desynced.`,
      );
    }
    lines.push("");
    lines.push(`## Gate evidence (§4.1, checkpoint ${weekData.checkpoint})`);
    for (const item of gate.evidence) {
      lines.push(`- ${item}`);
    }
  }

  return lines.join("\n");
}
