---
"osn-informatika-2026": patch
---

Upgrade `@biomejs/biome` from 1.9.4 to 2.5.11 (resolved to 2.5.12 under the
existing `^2.5.11` range; `bun.lock` regenerated to match). Migrated
`biome.json` to the Biome 2 configuration schema with `bunx biome migrate
--write`: `files.ignore` became `files.includes` with negated globs (same
excluded paths — `dist`, `coverage`, `node_modules`, `docs/**/*.pdf`),
`organizeImports` moved under `assist.actions.source.organizeImports`, and
`linter.rules.recommended` became `linter.rules.preset`. VCS integration,
the 2-space/100-column formatter settings, and the double-quote/semicolons
always/trailing-commas-all JS style are unchanged. Fixed the two new
Biome 2 recommended-rule findings this surfaced: an
`useIterableCallbackReturn` violation in `tests/unit/kpi.test.ts` (an
arrow `forEach` callback with an implicit return was wrapped in braces)
and a stale `biome-ignore lint/performance/noDelete` suppression comment
in `tests/unit/cohort-plan.test.ts`, now unneeded because Biome 2's
`noDelete` rule carries a built-in `delete process.env.NAME` exception.
Also applied three safe `noUselessEscapeInString` fixes (unnecessary
`\'` escapes inside backtick template literals) and Biome's new default
JSON formatting of `package.json`'s `trustedDependencies` array (expanded
to one entry per line). This is a dev-tooling-only change — no runtime
dependency, CLI behaviour, schema, or curriculum data changed — so it is
patch-level per this repository's own changeset policy
(`docs/development/releasing.md`, "internal refactors ... with no
observable behaviour change").
