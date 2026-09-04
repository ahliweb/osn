# Releasing

§13 ("Versioning") of the operational syllabus mandates that the internal
syllabus carries a version and a date, and that any official change to it
triggers a review plus a changelog entry. §14.2 rule 8 repeats this
requirement. This document describes how that is enforced mechanically —
with `@changesets/cli`, `CHANGELOG.md`, and this release procedure — rather
than left to convention.

This package is **private** (`"private": true` in `package.json`) and is
never published to a registry. Changesets is used here purely for changelog
discipline and version derivation, not for `npm publish`; there is no
`publish` script.

## Adding a changeset

Run:

```sh
bun run changeset
```

This launches the interactive `@changesets/cli` prompt, which asks which
bump type (patch/minor/major) applies and for a short human-readable
summary of the change. It writes a new Markdown file under `.changeset/`
containing that summary — commit this file alongside the change it
describes.

### When a changeset is required

Add a changeset for any **user-visible** change, meaning a change that
alters what a consumer of this repository sees or depends on:

- Curriculum data (`data/`) — new, edited, or removed content.
- The schema (`src/schema/`) — added, renamed, or removed fields; changed
  validation rules.
- CLI behaviour (`src/cli/`) — new commands, changed flags, changed output,
  changed exit codes.
- Documentation whose content changes in a way that changes its meaning
  (not a typo fix to prose, but a changed instruction, policy, or claim).

Do **not** add a changeset for:

- Pure internal refactors that do not change behaviour, output, or the
  public shape of anything (renaming a private helper, reorganising files,
  improving an internal algorithm with the same observable result).
- Test-only changes (new tests, test fixture tweaks, coverage improvements)
  that do not touch the module under test's behaviour.
- Tooling/CI configuration changes that do not change what a consumer of
  the package experiences (for example, reordering CI steps).

If in doubt, add a changeset — a redundant patch-level entry costs
nothing, while a missing one silently breaks the audit trail §13 requires.

## Version-bump policy

This project's SemVer (`package.json` `version`, `vX.Y.Z`) is decided by
the **most significant** change in the release, using the following
mapping. Because curriculum content is the primary artefact this repository
produces, the mapping is defined in terms of curriculum, schema, and CLI
changes specifically — not just generic "bug fix / feature / breaking"
labels.

### patch

- Editorial fixes and typo corrections in curriculum data or docs that do
  not change meaning.
- Clarifications — rewording that makes existing content easier to
  understand without changing what it says.
- Internal refactors (tooling, code structure) with no observable behaviour
  change. (Per the rule above, most of these don't need a changeset at all;
  when one is added — for example because it's bundled with something else
  — it is patch-level.)

### minor

- New curriculum data — a new week, topic, exercise, or resource added
  without removing or renaming anything existing.
- New tooling or CLI capability — a new command, a new non-breaking flag.
- Additive schema fields — a new optional field, or a new field with a safe
  default, that does not require existing data to change.
- New documentation sections.

### major

- Breaking schema changes — a renamed or removed field, a renamed or
  removed ID, or any change that makes previously valid curriculum data
  invalid without a corresponding data migration.
- Removal of a CLI command or flag.
- A curriculum restructure that changes any of:
  - the 28-week programme structure,
  - the ten topic families,
  - the phase gates,
  - the assessment weights.

  These four are called out explicitly because they are the load-bearing
  structural commitments of the syllabus — reshaping any of them is a
  breaking change to everyone building on this repository's curriculum
  model, even though no software schema field changed.

When a change spans more than one of these categories (for example, a PR
that both adds new curriculum data and fixes a typo elsewhere), the
changeset should record the **highest** bump level triggered by any part of
the change; the individual changeset summaries in `.changeset/*.md` still
describe each change so the eventual `CHANGELOG.md` entry is precise.

## Dual versioning: software version vs. syllabus version

This repository carries two independent version numbers, deliberately kept
separate:

- **`package.json` `version`** (`vX.Y.Z`, SemVer) is the single source of
  truth for the **software** — the schema, domain model, CLI, and tooling
  in this repository. It is bumped by `bun run version` (see below) based
  on the changesets accumulated since the last release, following the
  policy above.
- **`syllabusVersion` / `syllabusDate`** is a field carried by the
  curriculum corpus itself (see issue #10), currently `"2.0"` /
  `"2026-09-04"` — taken from the source operational syllabus document.
  It tracks the **source syllabus**, not this software: it changes when the
  upstream syllabus document itself is revised (a new official version of
  the OSN Informatika operational syllabus), independent of how many times
  the software in this repository has been released.

These two numbers are deliberately **not** the same counter, because they
answer different questions:

- "Which revision of the official syllabus document does this data
  represent?" — answered by `syllabusVersion` / `syllabusDate`.
- "Which release of the tooling/schema/CLI that processes that data am I
  running?" — answered by `package.json` `version`.

A syllabus revision (e.g. `"2.0"` → `"2.1"`) can happen with no software
change at all (the tooling doesn't need a new release just because the
source document was re-issued), and conversely the software can go through
several releases (patch fixes to the CLI, new tooling) while the syllabus
corpus stays at the same `syllabusVersion`. Collapsing them into one number
would either force spurious software releases on every editorial syllabus
update, or hide syllabus revisions behind software version numbers that
consumers of the data have no reason to track.

### Cross-checking the two

Even though they are independent, they must stay **consistent**, not
just coexist:

- Every curriculum data change that would justify a `syllabusVersion` bump
  (per the source document's own versioning) must be accompanied by a
  changeset in this repository, so the change is visible in
  `CHANGELOG.md` under the software release that ships it.
- The PR template's "Syllabus check" item (`.github/pull_request_template.md`,
  enforcing §14.2 rule 8) requires that any PR touching curriculum data
  records: the official source consulted, that the date was checked against
  the source, and the changelog impact. This is the mechanical link between
  the two version numbers — a reviewer can always trace "this software
  release changed the syllabus corpus from version X to version Y, sourced
  from document dated Z."
- Curriculum validation tooling (`bun run validate`, issue #19) is expected
  to assert that `syllabusVersion` / `syllabusDate` are present and
  well-formed on the data it validates, so a missing or malformed syllabus
  version fails CI rather than being caught only by manual review.

## Release procedure

1. Ensure every merged PR since the last release carries the changeset(s)
   its changes require (see "When a changeset is required" above). CI does
   not currently enforce this automatically — it is a reviewer
   responsibility, checked via the PR template.
2. On `main`, consume the accumulated changesets and compute the next
   version:

   ```sh
   bun run version
   ```

   This runs `changeset version`, which reads every file in `.changeset/`,
   determines the overall bump (the highest of all accumulated changesets),
   updates `package.json` `version`, deletes the consumed changeset files,
   and writes the new entries into `CHANGELOG.md` under a new `## [vX.Y.Z]
   - YYYY-MM-DD` heading, moving them out of `[Unreleased]`.

3. **Verify** the result before committing:
   - Read the new `CHANGELOG.md` section — confirm every entry is
     accurate, correctly categorised (Added / Changed / Fixed / Removed per
     Keep a Changelog), and at the right bump level.
   - Confirm the new `package.json` `version` matches what the changeset
     bump levels imply.
   - Run the full local quality suite (`bun run format:check`, `bun run
     lint`, `bun run typecheck`, `bun run test:coverage`, `bun run build`,
     `bun run validate`) against the post-version working tree.
4. Commit the result:

   ```sh
   git add package.json CHANGELOG.md
   git commit -m "chore: release vX.Y.Z"
   ```

5. Tag the release with an **annotated** tag (not a lightweight tag, so the
   tag carries its own message and author/date metadata):

   ```sh
   git tag -a vX.Y.Z -m "vX.Y.Z"
   ```

6. Push the commit and the tag:

   ```sh
   git push origin main
   git push origin vX.Y.Z
   ```

7. Add a `[vX.Y.Z]: https://github.com/ahliweb/osn/compare/vPREV...vX.Y.Z`
   link-reference entry at the bottom of `CHANGELOG.md` (this is not done
   automatically by `changeset version`) and repoint `[unreleased]` to
   compare from the new tag forward. Commit this as a follow-up if it was
   missed in step 4.

No step in this procedure publishes anything to a package registry — there
is deliberately no `publish` script, per the scope note above.

## §14.2 rule 8: every syllabus version needs a date, a changelog entry, and a syllabus check

Per §14.2 rule 8, whenever the curriculum corpus's `syllabusVersion` moves,
three things must all be true before the change is considered done:

1. **A date** — the corpus's `syllabusDate` field is updated to reflect
   when the new syllabus version takes effect (sourced from the upstream
   operational syllabus document's own date, not the commit date).
2. **A changelog entry** — the change is captured in `CHANGELOG.md`, via a
   changeset (see above), under `### Added` / `### Changed` / `### Fixed`
   as appropriate, describing what changed in the syllabus and why.
3. **A syllabus check** — the PR template's checklist item ("Syllabus check
   done (per §14.2 rule 8) if curriculum data changed") is completed:
   the official source document consulted is named, the date was verified
   against that source, and the changelog impact is recorded in the PR
   description.

All three are reviewer-checked at PR time (via the template) and are
independent of the software `vX.Y.Z` release cadence described above — a
syllabus version bump can land in any software release, but it cannot land
without its date, its changelog entry, and its syllabus check.
