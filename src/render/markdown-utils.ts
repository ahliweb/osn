/**
 * Tiny Markdown-formatting helpers shared by more than one renderer under
 * `src/render/`. Kept separate from `src/cli/format-plan.ts`'s own
 * `escapeCell` (issue #20) because `src/render/` must not import from
 * `src/cli/` (renderers are pure, CLI-independent) -- see each renderer's
 * docblock.
 */

/**
 * Escapes a value for safe embedding inside a Markdown table cell: no `|`,
 * no newlines. Identical behaviour to `src/cli/format-plan.ts`'s
 * `escapeCell`, duplicated intentionally rather than shared across the
 * `render`/`cli` layering boundary.
 */
export function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}
