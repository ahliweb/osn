/**
 * `renderSopCard` -- a pure function producing a one-page mentor SOP card
 * as Markdown (issue #21): the §5.2 seven-step mentor SOP, its minimum
 * test checklist and its four post-Accepted questions, plus the §5.3 hint
 * policy ladder and its mandatory re-solve obligation. All sourced from
 * `src/domain/pedagogy.ts`.
 *
 * **Pure**: no file I/O, no `process` access, no dates, no randomness, and
 * no parameters at all -- it always renders the same corpus-derived card.
 * File writing is a thin separate layer in `src/cli/commands/render.ts`;
 * this module never touches the filesystem. Unlike `renderWeeklyPlan`/
 * `renderCheckpointSheet`, there is no numeric input to be out of range, so
 * this function never throws `RenderRequestError` (`src/render/errors.ts`)
 * at all.
 */

import {
  hintLevels,
  hintPolicyCallout,
  minimumTests,
  postAcceptedQuestions,
  sopSteps,
} from "../domain/pedagogy";

/**
 * Renders the one-page mentor SOP card: the 7-step §5.2 SOP, step 6's
 * minimum test checklist, step 7's four post-Accepted questions, and the
 * §5.3 progressive-hinting ladder together with the mandatory re-solve
 * obligation it carries from level 4 ("pseudocode-parsial") onward.
 */
export function renderSopCard(): string {
  const lines: string[] = [];
  lines.push("# Mentor SOP card");
  lines.push("");

  lines.push("## 7-step SOP (§5.2)");
  for (const step of sopSteps()) {
    lines.push(`${step.order}. ${step.instruction}`);
  }
  lines.push("");

  lines.push("## Minimum test checklist (§5.2, step 6)");
  for (const test of minimumTests()) {
    lines.push(`- ${test}`);
  }
  lines.push("");

  lines.push("## Post-Accepted questions (§5.2, step 7)");
  for (const question of postAcceptedQuestions()) {
    lines.push(`- ${question}`);
  }
  lines.push("");

  lines.push("## Hint policy ladder (§5.3)");
  lines.push(hintPolicyCallout());
  lines.push("");
  for (const level of hintLevels()) {
    const resolveNote = level.requiresResolve
      ? " -- requires a hint-free re-solve at the next interval"
      : "";
    lines.push(`${level.level}. ${level.description}${resolveNote}`);
  }
  lines.push("");
  lines.push(
    "Re-solve obligation: every problem that reached a hint level requiring re-solve above " +
      "must be re-solved without help at the next interval.",
  );

  return lines.join("\n");
}
