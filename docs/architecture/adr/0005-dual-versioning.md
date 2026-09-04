# ADR-0005: Dual versioning — software SemVer vs. independent syllabus version

## Status

Accepted, 2026-09-05.

## Context

§13's "Versioning" row requires: "Silabus internal memiliki versi/tanggal;
perubahan resmi memicu review + changelog" (the internal syllabus carries
a version and date; an official change triggers a review and changelog
entry). §14.2 rule 8 repeats this requirement. This repository, per
ADR-0001, is simultaneously **software** (a schema, domain model, CLI, and
render tooling, released under SemVer via `package.json` `version`) and a
**curriculum corpus** (the encoded syllabus content under `data/`, which
tracks the source document's own `syllabusVersion`/`syllabusDate`). This
ADR records the decision to keep those two version numbers independent
rather than collapsing them into one.

The full mechanics of this — the SemVer bump-level mapping, when a
changeset is required, the release procedure, and the cross-checking rule
that keeps the two numbers consistent without being the same counter —
are already documented in `docs/development/releasing.md` ("Dual
versioning: software version vs. syllabus version" and "Cross-checking the
two"). This ADR records the *decision* and *why*, and defers to that
document for policy detail rather than restating it.

## Options considered

1. **One version number for both.** A single `package.json` `version`
   that is bumped for both software changes and curriculum content
   changes, with no separate `syllabusVersion` field.
2. **Version only the curriculum**, with the software (schema, domain
   model, CLI, tooling) left unversioned or versioned informally (e.g. by
   commit SHA only), since this package is private and never published to
   a registry (`docs/development/releasing.md`: `"private": true`, no
   `publish` script).
3. **Two independent version numbers**: `package.json` `version` (SemVer)
   for the software, and a separate `syllabusVersion`/`syllabusDate` field
   carried by the curriculum corpus data itself (planned, issue #10),
   tracking the source syllabus document's own versioning.

## Decision

Option 3, as already specified in `docs/development/releasing.md`: two
independent version numbers, cross-checked but never collapsed. This ADR
does not change or add to that policy — it records why the split exists at
an architectural level, since it directly shapes what `data/` must
contain (a `syllabusVersion`/`syllabusDate` field, validated by `osn
validate` per `docs/development/releasing.md`'s note on issue #19) as
opposed to being purely a release-process concern.

### Why option 1 (one version for both) was rejected

The two numbers answer different questions that change on different,
uncorrelated schedules. A typo fix in `src/cli/` — a patch-level software
change with zero curriculum meaning — would, under a single counter,
force a version bump that looks to any consumer like it might reflect a
curriculum revision, when nothing about the syllabus changed at all.
Conversely, the source syllabus document can be officially re-issued
(a new `syllabusVersion`) with **no software change whatsoever** — the
schema, domain model, and CLI don't need a new release just because the
upstream document was revised. Collapsing the two into one counter means
every consumer has to read the diff to find out which kind of change a
version bump actually represents, defeating the purpose of having a
version number as a quick signal at all.

### Why option 2 (version only the curriculum) was rejected

This package is private and never published to a registry, but that does
not mean the software's own changes are invisible to consumers — anyone
depending on this repository at a given commit (a downstream LMS/dashboard
builder, per ADR-0001) still needs to know when a schema field was
renamed or removed, when a CLI command's flags or exit codes changed, or
when a breaking change landed in the domain layer, none of which is a
curriculum content change and none of which `syllabusVersion` would ever
reflect. `docs/development/releasing.md`'s major-bump policy calls out
exactly this class of change ("Breaking schema changes... Removal of a
CLI command or flag"). Leaving the software unversioned would make every
one of those breaking changes invisible to anyone not reading the commit
history, which is the same failure mode option 1 has, just in the other
direction.

## Consequences

- **Easier:** a consumer can answer "which revision of the official
  syllabus does this data represent" and "which release of the
  tooling/schema/CLI am I running" as two separate, independently
  meaningful questions, exactly as posed in
  `docs/development/releasing.md`.
- **Easier:** the syllabus corpus can be revised (new `syllabusVersion`)
  without forcing a spurious software release, and the software can ship
  several releases (CLI improvements, bug fixes) without implying the
  curriculum content changed.
- **Harder:** the two numbers must be actively cross-checked rather than
  trusted to stay in sync automatically — `docs/development/releasing.md`
  assigns this to the PR template's "Syllabus check" item and to `osn
  validate` (planned, #19) asserting `syllabusVersion`/`syllabusDate` are
  present and well-formed, so the cross-check is a reviewer/CI
  responsibility rather than something the version scheme enforces by
  construction.
- See `docs/development/releasing.md` for the full bump-level mapping,
  changeset policy, and release procedure — not restated here.
