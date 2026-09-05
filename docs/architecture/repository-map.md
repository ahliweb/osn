# Repository map

Directory-by-directory description of what belongs in this repository and
what must never go there. This is the detailed companion to the "four
layers" summary in `docs/architecture/README.md` and to the repository-map
table in `README.md` / `AGENTS.md` — if those tables and this document
ever disagree, treat it as drift to fix, not as intentional variance.

Only directories that exist today are described. A directory not listed
here should not be created without a new issue scoping it (per
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

**State today:** 22 schema-validated JSON files, one per curriculum
concept (`data/topic-families.json`, `data/weeks.json`, `data/gates.json`,
`data/references.json`, `data/assessment-weights.json`,
`data/kpi-definitions.json`, `data/playbooks.json`, and so on — see
`osn validate`'s output for the exhaustive, currently-registered list),
plus `data/samples/` (synthetic sample learning records — see
`data/samples/README.md`). `osn validate` and `osn privacy-check` both
run recursively/registry-driven over this directory in CI.

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

**State today:** one schema module per `data/*.json` shape (`common.ts`,
`topic-family.ts`, `week.ts`, `gate.ts`, `category.ts`, `stage.ts`,
`reference.ts`, `regulation.ts`, `standard.ts`, `source-priority.ts`,
`session-template.ts`, `hint-policy.ts`, `mentor-sop.ts`, `assessment.ts`,
`learning-load.ts`, `problem-status.ts`, `kpi.ts`, `playbook.ts`,
`assessment-bank.ts`, `problem-taxonomy.ts`, `learning-record.ts`,
`readiness-checklist.ts`, `operational-rules.ts`, `syllabus-check.ts`).

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

**State today:** `topic-families.ts` (the ten §2.1 topic families),
`curriculum.ts` (weeks and gates), `structure.ts` (categories, stages,
learning load), `registers.ts` (references/regulations/standards/source
priority), `pedagogy.ts` (session template, mentor SOP, hint policy),
`assessment.ts` (weights, A/B/C/D status, re-solve scheduling), `kpi.ts`
(the seven §6.3 KPI metrics), `playbooks.ts` (the seven §7 decision
playbooks), `blueprint.ts` (evaluation blueprint generator),
`learning-record.ts` (parsing/validation helpers over the learning-record
schema), `privacy-scan.ts` (the `osn privacy-check` scan logic),
`operations.ts` (readiness checklist, operational rules, syllabus-check
log), `cohort-plan.ts` (the `osn plan` calendar generator), `report.ts`
(the `osn report` KPI dashboard), and `corpus-audit.ts` (the `osn
validate` whole-corpus audit).

## `src/render/`

**What belongs here:** pure functions that turn validated domain data into
mentor-facing Markdown artefacts — weekly session plans, checkpoint
sheets, SOP cards, and the cohort readiness checklist.

**What must never go here:** data loading or validation (that is
`src/domain/`'s job, consumed here already-valid); CLI argument parsing or
`process.exit` calls (that is `src/cli/`'s job); network I/O.

**State today:** `weekly.ts`, `checkpoint.ts`, `sop.ts`, `checklist.ts`
(the four renderers), plus `markdown-utils.ts` (shared formatting
helpers) and `errors.ts` (`RenderRequestError`).

## `src/cli/`

**What belongs here:** the `osn` command-line entrypoint (`src/cli/index.ts`)
— subcommand dispatch, `--help`, `--version`, `--json` output
mode, and consistent exit codes (0 success, 1 validation failure, 2 usage
error), implemented without an external CLI framework dependency (TR-11).
Individual command handlers, under `src/cli/commands/`: `validate`,
`plan`, `render`, `report`, `privacy-check`, `checklist`.

**What must never go here:** domain business logic (call into
`src/domain/` instead); Markdown template logic beyond assembling render
output for display (call into `src/render/` instead).

**State today:** `index.ts` (the thin `process.*`-touching shell),
`run-cli.ts` (the dispatcher core), `command.ts` (the `Command` interface
and exit-code constants), `commands/index.ts` (the command registry) and
`commands/*.ts` (the six command handlers), plus the shared I/O/formatting
helpers each command uses (`corpus-loader.ts`, `privacy-scan-loader.ts`,
`output-writer.ts`, `format-audit.ts`, `format-plan.ts`, `format-report.ts`,
`format-privacy-check.ts`, `format-checklist.ts`). A `bin` entry
(`"osn": "src/cli/index.ts"`) is registered in `package.json`.

## `src/index.ts`

**What belongs here:** the package entrypoint, built by `bun run build`
into `dist/`.

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

**State today:** one test file per `src/` module (schema, domain, CLI
command, render helper), plus `smoke.test.ts` and Markdown snapshot
fixtures under `tests/unit/__snapshots__/` for the render layer.

## `tests/integration/`

**What belongs here:** tests that exercise multiple modules together —
parsing real curriculum data through the schema layer into the domain
model, cross-register referential integrity over the whole corpus, or a
CLI command run end-to-end asserting on output/exit code.

**What must never go here:** single-module tests (belongs in
`tests/unit/`).

**State today:** `requirements.test.ts` (verifies the requirements
register and traceability matrices via `scripts/check-requirements.ts`),
`checklist-fidelity.test.ts` (verifies transcription fidelity via
`scripts/check-checklist-fidelity.ts`), `cli-validate.test.ts` and
`cli-validate-fixtures.test.ts` (the full corpus, and a deliberately
corrupted fixture corpus), and one end-to-end test per remaining CLI
command (`cli-plan.test.ts`, `cli-render.test.ts`, `cli-report.test.ts`,
`cli-privacy-check.test.ts`, `cli-checklist.test.ts`).

## `scripts/`

**What belongs here:** standalone tooling scripts invoked by `package.json`
scripts or CI, outside the `src/` layer boundaries (they are development
tooling, not part of the curriculum-as-code pipeline itself).

**What must never go here:** curriculum domain logic (belongs in `src/`).

**State today:** `check-requirements.ts` (backs `bun run
check:requirements`) and `check-checklist-fidelity.ts` (backs `bun run
check:checklist-fidelity`).

## `docs/silabus/`

**What belongs here:** the faithful Markdown transcription of the source
syllabus PDF — `README.md` plus `01-identitas-program.md` through
`14-checklist-dan-aturan-operasional.md` and `99-referensi.md` — preserving
structure, tables, and citation markers without translation or
summarisation (TR-10).

**What must never go here:** machine-readable data (belongs in `data/`);
editorializing or content not present in the source document (per
"Curriculum content fidelity" in `AGENTS.md`).

## `docs/requirements/`

**What belongs here:** the requirements register (`register.md`), its
explanatory `README.md` (ID scheme, status vocabulary, verification
methods), and `traceability.md` (the two completeness matrices).

**What must never go here:** the requirements themselves duplicated
anywhere else — `register.md` is the single source of truth other
documents (including this one and `docs/architecture/README.md`) link to
rather than restate.

## `docs/development/`

**What belongs here:** engineering-process documentation — `testing.md`,
`ci-cd.md`, `releasing.md`.

## `docs/architecture/`

**What belongs here:** this file, `README.md` (system overview),
`data-classification.md` (the field-by-field privacy classification table
for the learning-record and problem-taxonomy schemas, cross-linked from
ADR-0004 below), and `adr/` (Architecture Decision Records).

**What must never go here:** engineering-process policy that belongs in
`docs/development/` (testing, CI, releasing); governance/privacy policy
documents, which belong in `docs/governance/` (see below).

## `docs/governance/`

**What belongs here:** `privacy.md` (the privacy policy for minors' data),
`security.md` (the ISO/IEC control mapping and risk register), and
`incident-response.md` (severity levels, roles, response timeline).

## `docs/cli/`

**What belongs here:** the `osn` CLI command reference (`README.md`) —
every subcommand, flag, and exit code, kept in sync with
`src/cli/commands/`.

## `docs/operations/`

**What belongs here:** `runbook.md` (the cohort-start procedure, weekly
cycle, contest→postmortem→upsolve loop, and monthly review) and
`syllabus-check.md` (the §14.2 rule 8 syllabus-check procedure).

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
