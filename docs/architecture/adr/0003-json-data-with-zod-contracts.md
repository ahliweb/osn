# ADR-0003: JSON data with Zod schemas as the contract

## Status

Accepted, 2026-09-05.

## Context

ADR-0002 fixed Zod as the validation library. This ADR is narrower: given
Zod, what file format should `data/` actually use to store the curriculum
corpus — the ten topic families, the 28-week dataset, phase gates,
curriculum categories, competition stages, references R1-R41, the
regulation and standards registers, session templates, assessment
weights, KPI definitions, decision playbooks, the assessment bank, and the
problem-taxonomy vocabulary (FR-01 through FR-20 in
`docs/requirements/register.md`)?

The data in question is: generated once per curriculum concept by a human
transcribing from `docs/silabus/` (per AGENTS.md's "Ordering rule for
curriculum work" — schema first, then data), reviewed in pull requests
like code, and consumed by both the TypeScript domain layer in this
repository and, per ADR-0001, potentially by downstream non-TypeScript
platforms. It is a few hundred structured records at most (28 weeks, 10
topic families, 41 references, 7 gates, and similarly small counts
elsewhere) — not a dataset with scaling or query-performance concerns.

## Options considered

1. **YAML**, validated the same way (parsed, then checked against a Zod
   schema).
2. **TypeScript literal modules** — e.g. `export const topicFamilies:
   TopicFamily[] = [...]` — with the array's type checked structurally
   against a Zod-inferred type at compile time.
3. **SQLite or another embedded database** — data stored in a `.sqlite`
   file, queried via SQL.
4. **Plain JSON files under `data/`, validated by Zod schemas in
   `src/schema/`** that also produce the static TypeScript types the
   domain layer uses (`z.infer`).

## Decision

Option 4: plain JSON under `data/*.json`, with a Zod schema per shape
under `src/schema/`, parsed once at load time (see "Layering rules" in
`docs/architecture/README.md`). This is already the direction reflected in
`README.md`'s repository map ("Curriculum data files") and in issue #9's
scope (`data/topic-families.json` alongside `src/schema/topic-family.ts`).

### Why option 1 (YAML) was rejected

YAML is more pleasant to hand-edit than JSON — but this project's data is
not hand-edited in bulk; it is transcribed once from `docs/silabus/` per
concept and then changed rarely, under review, per AGENTS.md's curriculum-
content-fidelity rule. The editing-convenience advantage YAML offers does
not apply here, while its costs do: YAML has ambiguous implicit typing
(the "Norway problem" — bare `no`/`off`/`on`/`yes` parse as booleans in
some parsers, version numbers like `2.0` can parse as a float and lose a
trailing zero, and date-like strings can be auto-converted), all of which
are exactly the wrong failure mode for data whose fields include version
strings (`syllabusVersion`), IDs, and other structured values (ADR-0005)
that must round-trip exactly. JSON's stricter, smaller grammar has no
such implicit-conversion surface, at zero editing cost for
generated/reviewed data.

### Why option 2 (TypeScript literal modules) was rejected

Storing data as TypeScript source (`export const topicFamilies = [...]`)
gets compile-time type checking "for free" without a separate parse step.
It was rejected for two concrete reasons: first, it makes the corpus
consumable only by a TypeScript/JavaScript toolchain — a plain-JSON corpus
can be read by any downstream platform (Python, a static site generator, a
different language's judge) with a standard JSON parser and no build
step, which matters directly for the "what a consumer must build
themselves" boundary in ADR-0001. Second, diffs get noisier: a JSON file
is data and only data, so a pull request changing one week's outcome text
shows a clean, minimal diff; a TypeScript module mixes data with
formatting/syntax noise (quote style, trailing commas, `as const`
assertions) that Biome's formatter can still reformat unpredictably around
data edits, and it invites the temptation to slip small logic (a helper
function, a computed field) into what is supposed to be inert data — which
"Layering rules" in `docs/architecture/README.md` explicitly forbids
("data files are inert JSON with no logic").

### Why option 3 (SQLite / a database) was rejected

A database is unneeded operational weight for a few hundred static
records that change rarely and are reviewed like code. SQLite would add a
binary file format that is opaque to `git diff` and code review (exactly
the audit trail §13's Quality Review and Versioning rows require),
require a query layer and a migration story neither the corpus's size nor
its change cadence justifies, and reintroduce the "network I/O / database"
surface ADR-0001 explicitly puts out of scope for this repository. JSON
files under version control give free diffing, free history, and free
code review with no additional tooling.

## Consequences

- **Easier:** a Zod schema is simultaneously the validator and the source
  of the static type the domain layer uses (`z.infer<typeof Schema>`) —
  there is exactly one place to update when a field's shape changes, and
  the TypeScript compiler enforces that domain code stays in sync with it
  (TR-06). Corpus files stay diff-friendly and reviewable as plain data in
  pull requests. Any downstream platform, regardless of language, can
  consume `data/*.json` directly with a standard JSON parser.
- **Harder:** JSON has no comments, so any explanatory note about why a
  field has a particular value must live in the schema (as a Zod
  `.describe()` or a code comment) or in `docs/silabus/`, not inline next
  to the data itself.
- **Risk:** without discipline, nothing stops a `data/*.json` file from
  being committed without a corresponding schema, or from being edited
  without going back through validation. This is mitigated by the
  "Ordering rule for curriculum work" in `AGENTS.md` (schema first, never
  data without a schema) and by `osn validate`'s
  requirement to parse **every** `data/*.json` file against its schema in
  one pass (FR-22, TR-08, issue #19) — a corpus file with no
  schema, or that fails its schema, fails CI (`docs/development/ci-cd.md`).
