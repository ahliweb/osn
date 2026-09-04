# ADR-0001: Curriculum-as-code instead of an LMS or judge implementation

## Status

Accepted, 2026-09-05.

## Context

*Silabus Operasional Pembinaan OSN Informatika 2026* §13 ("Tata Kelola
Implementasi AhliKoding.com") mandates governance mechanisms — a
Curriculum Board, a Quality Review audit before any artefact is used, a
Problem Taxonomy, a Learning Record, an Assessment Bank, Mentor
Calibration, and Versioning — for however the programme's 28-week
curriculum, its ten topic families, its phase gates, and its assessment
model are actually implemented (TR-05, `docs/requirements/register.md`).

The syllabus itself does not describe a single monolithic platform. §8
("Perbandingan Lima Model/Kasus Pembinaan") compares five different
national olympiad training programmes, each combining a *judge*, a
*dashboard*, and *mentor feedback* as separate, loosely coupled
components — not one integrated system. §11's ISO/IEC mapping preamble is
explicit that the standards listed there govern "tata kelola organisasi
dan platform pembinaan, bukan materi ujian OSN" (organisational and
platform governance, not the OSN exam material itself) — i.e. the syllabus
already treats "the platform" as a separate, separately-governed concern
from "the curriculum."

The question this ADR answers: given that mandate, what should this
repository actually *be* — a document, a full platform, or something in
between?

## Options considered

1. **Documentation-only Markdown.** Transcribe the syllabus into
   well-organised Markdown (which this repository does, in
   `docs/silabus/`, independent of this decision) and stop there — no
   schemas, no validated data, no tooling.
2. **Full LMS + judge platform.** Build the actual learner-facing
   platform: account management, a code judge/execution sandbox, lesson
   delivery, cohort enrolment, a KPI dashboard, and a database backing all
   of it.
3. **Curriculum-as-code: schema + validated data + domain model + CLI
   tooling, no platform.** Encode the syllabus's structural facts (topic
   families, weeks, gates, assessment weights, KPI definitions, SOPs,
   decision playbooks, taxonomies) as version-controlled, schema-validated
   data with typed domain queries and a CLI that renders mentor artefacts
   and validates the corpus — and explicitly leave the LMS/judge/database
   layer to a separate, downstream system.

## Decision

Option 3: curriculum-as-code. This repository is a schema, a domain
model, and a CLI/rendering pipeline over version-controlled curriculum
data (see `docs/architecture/README.md` for the four-layer architecture
this produces) — not a document and not a platform.

### Why option 1 (documentation-only) was rejected

Markdown alone cannot make §13's governance mandate mechanically true.
"Quality Review" requires auditing an artefact "before it is used" — with
no schema and no validation, there is nothing to audit except prose, and
nothing stops a week's data (were it ever added informally, e.g. as a
spreadsheet) from silently drifting out of sync with the syllabus, having
a duplicate week number, or referencing a topic family that doesn't exist.
"Versioning" (§13) requires the syllabus to "carry a version and a date"
that a "review + changelog" is triggered against — a Markdown-only
repository has no mechanical way to distinguish an intentional syllabus
revision from an accidental edit. Every one of the eight §13 governance
rows becomes an unenforced convention rather than a checked property.
`docs/requirements/register.md`'s TR-06 through TR-09 (schema-first
ordering, deterministic output, full-corpus referential integrity,
machine-verified requirements register) are exactly the properties that
documentation-only Markdown cannot provide.

### Why option 2 (full LMS + judge) was rejected

- **Scope and attack surface.** A judge is a code-execution sandbox — one
  of the highest-risk components any software project can contain,
  requiring sandboxing, resource limits, and constant security
  maintenance against a stream of adversarial input (submitted source
  code, deliberately or not). An LMS requires session management,
  role-based access control, and a persistent database, none of which this
  team is positioned to operate safely and continuously alongside a
  curriculum-content project.
- **Minors' personal data.** §10's "Data peserta di bawah umur" callout
  and UU No. 27 Tahun 2022 apply directly to an LMS that enrols and tracks
  real students — but not to a repository that only *defines* schemas (see
  ADR-0004). Building the platform would mean this repository becomes the
  thing UU 27/2022 regulates, with all the lawful-basis, consent, access-
  logging, and retention obligations that entails, for a team whose actual
  deliverable is the curriculum.
- **Unmaintainable scope for the actual goal.** The stated deliverable
  (per `README.md`) is a typed, validated, versioned representation of the
  syllabus. A judge and LMS are a multi-year, multi-person engineering
  project in their own right, orthogonal to whether the curriculum content
  is correct — conflating the two would mean the curriculum is never
  finished because the platform never is.
- **The syllabus itself treats them as separate systems.** As noted in
  Context, §8's five case studies and §11's ISO preamble both model "the
  platform" as a distinct, separately governed thing from the curriculum
  content — building them together contradicts the syllabus's own
  implicit architecture.

## Consequences

- **Easier:** the curriculum can be authored, reviewed, versioned, and
  validated with the same rigor as software — schema validation, CI,
  automated tests, changesets — using a small, well-understood toolchain
  (ADR-0002), without also having to build and operate a production
  learner-facing service.
- **Easier:** the repository can be open, inspectable, and consumed by any
  downstream platform (an LMS someone else builds, a different judge, a
  static site) as a data/tooling dependency, rather than being tied to one
  specific platform's implementation choices.
- **Harder:** this repository alone is not a usable training programme for
  a mentor or student — see "Out of scope" in `docs/architecture/README.md`
  for exactly what a downstream consumer must still build (LMS UI, judge,
  auth, database, network APIs).
- **Risk:** a downstream platform builder might assume this repository
  provides more than it does (e.g. expects a database or an API). This is
  mitigated by the explicit "What this repository is not" section in
  `README.md`, the non-affiliation notice, and the "Out of scope" section
  of `docs/architecture/README.md`.
