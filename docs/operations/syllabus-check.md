# Syllabus check procedure

Status: mandatory internal procedure. Issue
[#25](https://github.com/ahliweb/osn/issues/25). Implements §14.2 rule 8
("Setiap versi silabus harus memiliki tanggal, changelog, dan syllabus
check.") and the "Catatan Penutup" closing note of
`docs/silabus/99-referensi.md` ("Sebelum setiap siklus pembinaan, Tim
Riset AhliKoding.com dari AhliWeb.com perlu melakukan syllabus check
terhadap sumber resmi OSN/IOI, memperbarui problem taxonomy, menyesuaikan
kalender seleksi, dan menerbitkan changelog versi kurikulum.").

## What a syllabus check is

A syllabus check is a **live comparison** of this repository's curriculum
corpus against the official OSN/IOI source documents it was transcribed
from -- confirming the transcribed content still matches what the
official sources currently say, and identifying anything that has moved.
It is not the same as `osn validate` (which only checks this repository's
own internal schema/structural consistency) or `osn privacy-check` (which
scans for identifier-shaped keys) -- both of those can pass cleanly while
the upstream official syllabus has quietly changed underneath this
corpus. A syllabus check is the one control that catches that drift.

## Official sources to check

The five official sources this corpus's own reference register
(`data/references.json`, §99) names for OSN and IOI:

| Ref | Title | URL |
| --- | --- | --- |
| **R1** | Silabus OSN Informatika 2026 | https://osn.toki.id/silabus |
| **R2** | Silabus OSN-K Informatika 2026 | https://osn.toki.id/silabus/kota |
| **R3** | Silabus OSN-P Informatika 2026 | https://osn.toki.id/silabus/provinsi |
| **R7** | Official Syllabus page (IOI) | https://ioinformatics.org/page/syllabus/12 |
| **R8** | IOI Syllabus 2025 (official PDF available at time of review) | https://ioinformatics.org/files/ioi-syllabus-2025.pdf |

These URLs are read live from `data/references.json` above (do not
hard-code them in a checklist or script -- if `data/references.json`'s
own URL for one of these refs is ever corrected, that correction should
be the single source of truth, and this table should be regenerated from
it, not maintained as a second independent copy). `osn checklist`'s
"Syllabus-check status" line reports the same five refs as the sources
the last recorded check named.

## Cadence: before every cohort cycle

Per the Catatan Penutup, a syllabus check is performed **before every
siklus pembinaan** (cohort/coaching cycle) -- not on a fixed calendar
cadence independent of cohorts. In practice this means:

- Before a new cohort's Week 1 (see `docs/operations/runbook.md`'s "Cohort
  start procedure", step 2).
- Before each `docs/operations/runbook.md` monthly review, as a
  re-confirmation that nothing has moved since the last check (step 5 of
  that procedure).
- Before cutting a release that bumps `syllabusVersion` (see
  `docs/development/releasing.md`'s "§14.2 rule 8" section) -- a version
  bump is itself evidence a check found something, so the check must have
  already happened by the time the bump is proposed.

`osn checklist` reports the number of days since the last recorded check
(`daysSinceLastSyllabusCheck`, UTC-only); a mentor lead should treat a
gap that is large relative to the upcoming cycle's length as a signal
that a fresh check is due, rather than relying on the previous entry.

## How to perform the check

For each of the five sources above:

1. Open the source's URL (from the table above, sourced from
   `data/references.json`) and read its current syllabus content.
2. Compare it against the corresponding section(s) of this repository's
   curriculum corpus (topic families, competition-stage formats,
   problem-taxonomy vocabulary, and anything else transcribed from that
   source -- see `data/source-priority.json`, §12, for which sources this
   corpus treats as authoritative for which content).
3. Note any difference: a changed topic, a changed contest format detail,
   a changed date, a changed URL, or a source that has moved/gone dark.

This is a **manual, human-performed check against a live external
website** -- this repository's own tooling has no network access and
performs no part of steps 1-2 itself (see "What this repository's tooling
does and does not do" below).

## How to record the outcome

Append (never rewrite in place) a new entry to
`data/syllabus-check-log.json`'s `checks` array:

```json
{
  "checkedOn": "2026-MM-DD",
  "sources": ["R1", "R2", "R3", "R7", "R8"],
  "outcome": "no-change",
  "notes": "Describe exactly what was checked, against which live source, and what (if anything) differed. State plainly if any part of the check was not actually performed live.",
  "resultingIssues": []
}
```

- **`checkedOn`**: the real date the check was performed (ISO
  `YYYY-MM-DD`), not a commit date.
- **`sources`**: every source ref actually checked in this pass -- omit
  a ref if it genuinely was not checked this time, rather than listing it
  for completeness.
- **`outcome`**: `"no-change"` if every checked source still matches this
  corpus; `"change-detected"` if any difference was found (see below for
  what happens next).
- **`notes`**: a precise, honest record of what was and was not done.
  **Never claim a live check happened if it did not** -- the seeded entry
  in this file (`checkedOn: "2026-09-05"`) is itself an example of this
  discipline: it records that the corpus was transcribed from the source
  document dated 2026-09-04 and that R1/R2/R3/R7/R8 are the sources that
  document cites, but explicitly states that no live check of the
  external websites was performed for that entry, because the tooling
  that produced it has no network access. A future entry that *did*
  perform the live steps above should say so just as plainly.
- **`resultingIssues`**: every `curriculum-change` issue this check's
  findings produced (see below); empty for `no-change`.

Validate the result:

```sh
osn validate
```

`data/syllabus-check-log.json` is registered in `DATA_FILE_REGISTRY`
(`src/domain/corpus-audit.ts`) and checked for schema conformance (every
entry has a real `checkedOn`, a non-empty `sources` list of valid
citation refs, a valid `outcome`) and the structural invariant that the
log itself is never empty.

## What this repository's tooling does and does not do

- **`osn checklist`** reads and reports the *latest already-recorded*
  syllabus-check entry (date, outcome, sources, days since) -- it does
  not perform a live check itself.
- **`osn validate`** confirms `data/syllabus-check-log.json` is
  well-formed and non-empty -- it does not confirm the entries it
  contains are truthful or that a live check actually happened.
- **No command in this repository has network access** and none ever
  fetches an external URL. The actual comparison against a live source
  (steps 1-2 above) is, and remains, a human procedure. Any future
  automation of part of this check must still record its result through
  the same `data/syllabus-check-log.json` entry shape, and must not
  claim a broader check happened than what it actually automated.

## When a change is detected: the flow to a changeset and a changelog entry

When step 3 above finds a real difference, `outcome: "change-detected"`
triggers this chain (see `docs/development/releasing.md` for the full
detail on each step):

1. **File a `curriculum-change` issue** using
   `.github/ISSUE_TEMPLATE/curriculum-change.yml` -- naming the official
   source checked, the date checked, precisely what changed, and the
   expected changelog/version impact. Record the issue's number (e.g.
   `"#42"`) in the log entry's `resultingIssues`.
2. **Curriculum Board reviews and approves** the change (§13's Curriculum
   Board row: "validator syllabus resmi") -- the syllabus check surfaces
   the difference; the Curriculum Board decides how the corpus is
   updated in response.
3. **Update the affected `data/*.json` file(s)** and their
   `syllabusVersion`/`syllabusDate` provenance fields, per the approved
   change.
4. **Add a changeset** (`bun run changeset`) describing the change, per
   `docs/development/releasing.md`'s "When a changeset is required" --
   curriculum data changes always need one.
5. **The changeset becomes a `CHANGELOG.md` entry** the next time
   `bun run version` runs, under the release that ships the change, and
   `package.json`'s version is bumped per the policy in
   `docs/development/releasing.md` (a curriculum-data change alone is
   ordinarily `minor`; consult that document's version-bump policy for
   the exact level, especially if the change touches the 28-week
   structure, the ten topic families, the phase gates, or the assessment
   weights, each of which is `major`).
6. **Confirm `osn validate` still passes** against the updated corpus,
   including the updated `data/syllabus-check-log.json` entry.

`outcome: "no-change"` skips steps 1-3 entirely -- only the log entry
itself is added.

## Related documents

- [`docs/operations/runbook.md`](runbook.md) -- where this procedure fits
  into the cohort-start procedure and the monthly review.
- [`docs/development/releasing.md`](../development/releasing.md) -- the
  full changeset/changelog/version-bump procedure step 4 onward above
  points to.
- [`.github/ISSUE_TEMPLATE/curriculum-change.yml`](../../.github/ISSUE_TEMPLATE/curriculum-change.yml)
  -- the issue template step 1 above uses.
- [`docs/cli/README.md`](../cli/README.md)'s "`osn checklist`" section --
  how the latest recorded check is surfaced day-to-day.
