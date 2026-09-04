# Repository map

Directory-by-directory description of what belongs in this repository and
what must never go there. This is the detailed companion to the "four
layers" summary in `docs/architecture/README.md` and to the repository-map
table in `README.md` / `AGENTS.md` — if those tables and this document
ever disagree, treat it as drift to fix, not as intentional variance.

Only directories that exist today, or that a specific numbered issue will
create, are described. A directory not listed here and not named by an
issue should not be created without a new issue scoping it (per
`AGENTS.md`, "Do not create new top-level directories without a
corresponding issue scoping them").

## `data/`

**What belongs here:** curriculum data files, one JSON file (or small
family of files) per curriculum concept — topic families, the 28-week
dataset, phase gates, curriculum categories, competition stages, the
reference/regulation/standards registers, session templates, assessment
weights, KPI definitions, decision playbooks, assessment bank taxonomy,
problem-taxonomy vocabulary, and the syllabus-check log. Every file here
must be validated by a schema in `src/schema/` (see "Ordering rule" in
`AGENTS.md`: schema first, then data, never the reverse).

**What must never go here:** executable code of any kind, computed or
derived values, real learner personal data (see ADR-0004), or a data file
for a shape that has no corresponding schema.

**State today:** empty scaffold (`data/.gitkeep`). First real files land
in issue #9 (`data/topic-families.json`).

## `src/schema/`

**What belongs here:** Zod schemas — the single source of truth for both
runtime validation and the static TypeScript types inferred from them
(ADR-0003). Includes shared primitives (`src/schema/common.ts`: branded
ID/slug types, `CitationRef`, `SyllabusSection`) and one schema module per
data shape.

**What must never go here:** imports from `src/domain/`, `src/cli/`, or
`src/render/` (schema is the innermost layer — see "Layering rules" in
`docs/architecture/README.md`); business logic beyond shape/constraint
validation; anything that reads from disk or the network itself (loading
is a domain-layer concern).

**State today:** empty scaffold (`src/schema/.gitkeep`). First schemas
land in issue #9 (`common.ts`, `topic-family.ts`); most of M3 (#9-#12) and
M4 (#13-#18) issues add further schemas.

## `src/domain/`

**What belongs here:** typed loaders (parse a `data/*.json` file through
its schema), typed lookup/query helpers over already-validated data, and
business rules that operate on that data (e.g. KPI computation, the
core-before-extension gate, hint-level escalation, decision-playbook
selectors).

**What must never go here:** imports from `src/cli/` or `src/render/`
(domain logic is presentation-agnostic); re-validation of data the schema
layer already guaranteed valid; direct construction of CLI output strings
or Markdown.

**State today:** empty scaffold (`src/domain/.gitkeep`). First module
lands in issue #9 (`topic-families.ts`); further modules land through M3
and M4 (issues #10-#18), and the KPI engine, decision selectors, and
blueprint generator specifically in #16, #17, #18.

## `src/render/`

**What belongs here:** pure functions that turn validated domain data into
mentor-facing Markdown artefacts — weekly session plans, checkpoint
sheets, SOP cards (issue #21).

**What must never go here:** data loading or validation (that is
`src/domain/`'s job, consumed here already-valid); CLI argument parsing or
`process.exit` calls (that is `src/cli/`'s job); network I/O.

**State today:** empty scaffold (`src/render/.gitkeep`). First render
modules land in issue #21, after the CLI foundation (#19) and the domain
modules they render (#9-#18) exist.

## `src/cli/`

**What belongs here:** the `osn` command-line entrypoint (`src/cli/index.ts`,
planned #19) — subcommand dispatch, `--help`, `--version`, `--json` output
mode, and consistent exit codes (0 success, 1 validation failure, 2 usage
error), implemented without an external CLI framework dependency (TR-11).
Individual command handlers: `validate` (#19), `plan` (#20), `render`
(#21), `report` (#22), `checklist` (#25).

**What must never go here:** domain business logic (call into
`src/domain/` instead); Markdown template logic beyond assembling render
output for display (call into `src/render/` instead).

**State today:** empty scaffold (`src/cli/.gitkeep`). First code lands in
issue #19, alongside a `bin` entry added to `package.json`.

## `src/index.ts`

**What belongs here:** the package entrypoint. Currently a minimal
placeholder exporting `CURRICULUM_SOURCE` and `packageInfo`, built by `bun
run build` into `dist/`. It will grow into the aggregation point that
re-exports the public surface of `src/schema/`, `src/domain/`,
`src/render/`, and `src/cli/` as those layers land.

**What must never go here:** business logic that belongs in one of the
layer-specific directories above.

## `dist/`

**What belongs here:** nothing checked in — this is the build output
directory produced by `bun run build` (`bun build ./src/index.ts --outdir
dist --target bun`). Not a source directory.

## `tests/unit/`

**What belongs here:** fast, isolated tests, one module at a time — a
schema, a domain function, a CLI command handler, a render helper — with
no filesystem I/O beyond what the module itself needs and no network
calls. Loosely mirrors `src/`'s shape. See `docs/development/testing.md`
for the full policy (what must be tested, coverage gate).

**What must never go here:** tests that cross module boundaries (that
belongs in `tests/integration/`); production code.

**State today:** `tests/unit/smoke.test.ts` exists, covering the
placeholder `src/index.ts`.

## `tests/integration/`

**What belongs here:** tests that exercise multiple modules together —
parsing real curriculum data through the schema layer into the domain
model, cross-register referential integrity over the whole corpus, or a
CLI command run end-to-end asserting on output/exit code.

**What must never go here:** single-module tests (belongs in
`tests/unit/`).

**State today:** `tests/integration/requirements.test.ts` exists (issue
#7, verifies the requirements register and traceability matrices via
`scripts/check-requirements.ts`); `tests/integration/.gitkeep` otherwise,
pending schema/domain/CLI integration tests from M3 onward.

## `scripts/`

**What belongs here:** standalone tooling scripts invoked by `package.json`
scripts or CI, outside the `src/` layer boundaries (they are development
tooling, not part of the curriculum-as-code pipeline itself). Today:
`scripts/check-requirements.ts` (issue #7, backs `bun run
check:requirements`).

**What must never go here:** curriculum domain logic (belongs in `src/`).

## `docs/silabus/`

**What belongs here:** the faithful Markdown transcription of the source
syllabus PDF — `README.md` plus `01-identitas-program.md` through
`14-checklist-dan-aturan-operasional.md` and `99-referensi.md` — preserving
structure, tables, and citation markers without translation or
summarisation (TR-10, issue #6, done).

**What must never go here:** machine-readable data (belongs in `data/`);
editorializing or content not present in the source document (per
"Curriculum content fidelity" in `AGENTS.md`).

## `docs/requirements/`

**What belongs here:** the requirements register (`register.md`), its
explanatory `README.md` (ID scheme, status vocabulary, verification
methods), and `traceability.md` (the two completeness matrices). Issue #7,
done.

**What must never go here:** the requirements themselves duplicated
anywhere else — `register.md` is the single source of truth other
documents (including this one and `docs/architecture/README.md`) link to
rather than restate.

## `docs/development/`

**What belongs here:** engineering-process documentation — `testing.md`,
`ci-cd.md`, `releasing.md`. Issues #1-#4, done.

## `docs/architecture/` (this issue, #8)

**What belongs here:** this file, `README.md` (system overview), and
`adr/` (Architecture Decision Records). Also the future home of
`docs/architecture/data-classification.md` (planned, **issue #15** — the
field-by-field privacy classification table for the learning-record and
problem-taxonomy schemas, cross-linked from ADR-0004 below).

**What must never go here:** engineering-process policy that belongs in
`docs/development/` (testing, CI, releasing); governance/privacy policy
documents, which belong in `docs/governance/` (see below).

## `docs/governance/` (planned, issues #23-#24)

Not present today. Planned to hold `privacy.md` (issue #23),
`security.md` and `incident-response.md` (issue #24). Named here because
`docs/architecture/README.md` and ADR-0004 reference it; do not create it
under this issue (#8) — it is out of scope for architecture documentation
and is scoped to #23/#24.

## `docs/cli/` (planned, issue #19)

Not present today. Planned to hold the CLI command reference
(`README.md`) once `src/cli/` has real commands. Named here for the same
reason as `docs/governance/` above; not created by this issue.

## `.changeset/`

**What belongs here:** one Markdown file per pending, unreleased
user-visible change, written by `bun run changeset`. See
`docs/development/releasing.md` for the full policy (this map does not
duplicate it).

## `.github/workflows/`

**What belongs here:** the CI pipeline (`ci.yml`). See
`docs/development/ci-cd.md`.

## `.github/ISSUE_TEMPLATE/`

**What belongs here:** issue forms, including the `curriculum-change.yml`
form used to propose or record a curriculum content change (per
`AGENTS.md`, "Curriculum content fidelity").
