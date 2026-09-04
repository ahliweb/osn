/**
 * `renderCheckpointSheet` -- a pure function from a validated checkpoint
 * number (1-7) to a mentor-ready Markdown checkpoint sheet (issue #21).
 * Combines `src/domain/curriculum.ts` (the §4.1 gate evidence required to
 * proceed past this checkpoint), `src/domain/assessment.ts` (the §6.1
 * rubric weights and the §6.2 A/B/C/D problem-completion statuses), and
 * `src/domain/kpi.ts` (the §6.3 KPI metric definitions).
 *
 * **Pure**: no file I/O, no `process` access, no dates, no randomness --
 * identical input always produces byte-identical output. File writing is a
 * thin separate layer in `src/cli/commands/render.ts`; this module never
 * touches the filesystem. Fails loudly (throws {@link RenderRequestError})
 * on an out-of-range checkpoint number instead of ever emitting a
 * partially-filled document.
 */

import { listComponents, listStatuses } from "../domain/assessment";
import { checkpointWeeks, gateAfter } from "../domain/curriculum";
import { listKpiDefinitions } from "../domain/kpi";
import { GATE_WEEKS } from "../schema/gate";
import { RenderRequestError } from "./errors";
import { escapeCell } from "./markdown-utils";

/** The lowest and highest checkpoint numbers §4.1 defines -- one per gate, so exactly {@link GATE_WEEKS}'s length. */
const MIN_CHECKPOINT = 1;
const MAX_CHECKPOINT = GATE_WEEKS.length;

/**
 * Throws {@link RenderRequestError} naming the valid
 * {@link MIN_CHECKPOINT}-{@link MAX_CHECKPOINT} range if `checkpointNumber`
 * is not an integer in that range.
 */
function requireCheckpointInRange(checkpointNumber: number): void {
  if (
    !Number.isInteger(checkpointNumber) ||
    checkpointNumber < MIN_CHECKPOINT ||
    checkpointNumber > MAX_CHECKPOINT
  ) {
    throw new RenderRequestError(
      `renderCheckpointSheet: checkpoint ${checkpointNumber} is out of range. Valid range: ` +
        `${MIN_CHECKPOINT}-${MAX_CHECKPOINT}.`,
    );
  }
}

/**
 * Renders a mentor-ready Markdown checkpoint sheet for `checkpointNumber`
 * (an integer {@link MIN_CHECKPOINT}-{@link MAX_CHECKPOINT}): the §4.1 gate
 * evidence required to proceed past this checkpoint, the §6.1 rubric
 * weights table (with each component's evidence column), an A/B/C/D
 * recording grid (§6.2, with each status's prescribed follow-up action),
 * and the §6.3 KPI snapshot fields.
 *
 * Throws {@link RenderRequestError} for a `checkpointNumber` outside
 * {@link MIN_CHECKPOINT}-{@link MAX_CHECKPOINT} (including non-integer
 * values), naming the valid range, before doing anything else.
 */
export function renderCheckpointSheet(checkpointNumber: number): string {
  requireCheckpointInRange(checkpointNumber);

  const week = checkpointWeeks().find((entry) => entry.checkpoint === checkpointNumber);
  if (week === undefined) {
    throw new RenderRequestError(
      `renderCheckpointSheet: no week carries checkpoint ${checkpointNumber} -- data/weeks.json has no matching checkpoint entry.`,
    );
  }

  const gate = gateAfter(week.week);
  if (gate === undefined) {
    throw new RenderRequestError(
      `renderCheckpointSheet: week ${week.week} carries checkpoint ${checkpointNumber} but has no matching §4.1 gate -- data/weeks.json and data/gates.json have desynced.`,
    );
  }

  const lines: string[] = [];
  lines.push(`# Checkpoint ${checkpointNumber} (after week ${week.week}: ${week.focus})`);
  lines.push("");

  lines.push("## Gate evidence required (§4.1)");
  for (const item of gate.evidence) {
    lines.push(`- ${item}`);
  }
  lines.push("");

  lines.push("## Rubric weights (§6.1)");
  lines.push("| Component | Weight | Evidence |");
  lines.push("| --- | --- | --- |");
  for (const component of listComponents()) {
    lines.push(
      `| ${escapeCell(component.name)} | ${component.weight}% | ` +
        `${escapeCell(component.evidence.join("; "))} |`,
    );
  }
  lines.push("");

  lines.push("## A/B/C/D recording grid (§6.2)");
  lines.push("| Code | Meaning | Follow-up action |");
  lines.push("| --- | --- | --- |");
  for (const status of listStatuses()) {
    lines.push(
      `| ${status.code} | ${escapeCell(status.meaning)} | ${escapeCell(status.followUp)} |`,
    );
  }
  lines.push("");

  lines.push("## KPI snapshot fields (§6.3)");
  lines.push("| Metric | Unit | Direction | Purpose |");
  lines.push("| --- | --- | --- | --- |");
  for (const metric of listKpiDefinitions()) {
    lines.push(
      `| ${escapeCell(metric.name)} | ${metric.unit} | ${metric.direction} | ` +
        `${escapeCell(metric.purpose)} |`,
    );
  }

  return lines.join("\n");
}
