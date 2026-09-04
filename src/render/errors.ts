/**
 * Thrown by every renderer in `src/render/` (`renderWeeklyPlan`,
 * `renderCheckpointSheet`) for an out-of-range or otherwise invalid
 * request -- an unknown week number, an unknown checkpoint number, or a
 * corpus desync a renderer discovers while building its output. Mirrors
 * `BlueprintRequestError` (`src/domain/blueprint.ts`) and
 * `LearningRecordsValidationError` (`src/domain/learning-record.ts`):
 * always carries an actionable message naming both what was wrong and the
 * valid range, so `src/cli/commands/render.ts` can catch this one class
 * and report a clean `osn render: ...` usage error (exit 2) instead of a
 * raw stack trace.
 *
 * A render function must **fail loudly** on invalid input -- throwing this
 * before writing anything -- rather than ever emit a partially-filled
 * Markdown document.
 */
export class RenderRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenderRequestError";
  }
}
