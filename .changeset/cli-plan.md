---
"osn-informatika-2026": minor
---

Add `osn plan`, the §4 cohort calendar generator: a pure `buildCohortPlan`
(`src/domain/cohort-plan.ts`) that turns a start date, an optional set of
excluded dates (holidays, exams), and an optional target competition stage
into a dated 28-week calendar with session dates, mini-contest/checkpoint
markers, and gate evidence. Excluded dates shift subsequent weeks rather
than silently overlapping (documented as the "week-shifting rule"), the two
weekly session dates are picked deterministically (the 1st and 4th usable
day, the "session-date rule"), and a target stage yields both an
intensive-week informational entry and a schedule-slip warning when the
plan runs more than 14 days past the un-excluded baseline. All date
arithmetic is UTC-only (no `Date` mutation, no date library, no host-
timezone dependence), satisfying TR-07's byte-identical-output requirement.
Adds `--start`/`--exclude`/`--target-stage`/`--format md|json` to the CLI,
registered via the same command-registry seam `osn validate` (#19) added,
plus Markdown/JSON renderers in `src/cli/format-plan.ts` and a full
`docs/cli/README.md` section documenting the rules above.
