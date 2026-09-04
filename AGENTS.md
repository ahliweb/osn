# AGENTS.md

Instructions for AI coding agents working in this repository. This
repository encodes the **Silabus Operasional Pembinaan OSN Informatika
2026** (v2.0, 4 September 2026) as code. It is an independent curriculum
document — not official Puspresnas / IA TOKI / IOI material. See
`README.md` for full context.

This file must stay accurate to the *current* state of the repository, not
aspiration. It is re-verified against the final implementation at the end
of the programme ([issue #26](https://github.com/ahliweb/osn/issues/26)).
Tables, not prose — drift should be visible at a glance.

## Repository layout

| Path | What belongs here |
| --- | --- |
| `src/schema/` | Zod schemas that validate curriculum data shapes. |
| `src/domain/` | Business rules operating on parsed (schema-valid) curriculum data. |
| `src/cli/` | CLI command handlers (`osn <command>`). |
| `src/render/` | Generators that turn domain data into mentor-facing output. |
| `src/index.ts` | Package entrypoint. |
| `data/` | Curriculum data files (schema-validated content, not code). |
| `tests/unit/` | One module tested in isolation. Mirrors `src/` loosely. |
| `tests/integration/` | Cross-module tests (schema → domain → CLI/render). |
| `docs/development/` | Engineering process docs (testing, CI/CD, releasing). |
| `docs/*.pdf` | The source syllabus document. |
| `.changeset/` | Pending changesets — one Markdown file per user-visible change. |
| `.github/workflows/` | CI pipeline. |
| `.github/ISSUE_TEMPLATE/` | Bug / feature / curriculum-change issue forms. |

Do not create new top-level directories without a corresponding issue
scoping them.

## Command table

Matches `package.json` exactly — verify against it before trusting this
table.

| Command | Purpose |
| --- | --- |
| `bun install` | Install dependencies. |
| `bun run typecheck` | `tsc --noEmit`. |
| `bun run lint` | `biome lint .`. |
| `bun run lint:fix` | `biome lint --write .`. |
| `bun run format` | `biome format --write .`. |
| `bun run format:check` | `biome format .` (check-only). |
| `bun test` | Run the full test suite. |
| `bun run test:coverage` | `bun test --coverage`; enforces the 85% lines/functions gate in `bunfig.toml`. |
| `bun run build` | `bun build ./src/index.ts --outdir dist --target bun`. |
| `bun run validate` | **Placeholder** — not yet implemented. Prints a TODO, exits 0. Real implementation: [#19](https://github.com/ahliweb/osn/issues/19). |
| `bun run changeset` | Create a changeset (interactive). |
| `bun run version` | Consume changesets into `CHANGELOG.md` / bump version. |

## Atomic-issue workflow

Work one GitHub issue at a time, in this order:

1. Read the issue in full, including acceptance criteria and dependencies.
2. Implement the change, scoped to that issue only.
3. Add/update tests (`tests/unit/`, `tests/integration/` as appropriate).
4. Run lint, typecheck, and the full local quality suite.
5. Update docs (`docs/`, `README.md`, this file) if behavior, setup, or
   process changed.
6. Add a changeset if the change is user-visible (see
   `docs/development/releasing.md` — do not duplicate that policy here).
7. Commit, referencing the issue number (e.g. `feat: add topic-family
   schema (#9)`).
8. Verify CI passes on the branch/PR.
9. Close the issue (or let the PR merge close it via `Closes #N`).

Do not bundle multiple issues into one PR. Do not exceed an issue's stated
scope.

## Ordering rule for curriculum work

**Schema first, then data, then domain, then tests — never data without a
schema.**

1. `src/schema/` — define or extend the Zod schema for the shape being
   added.
2. `data/` — add data that the schema validates.
3. `src/domain/` — add business logic that consumes the validated data.
4. `tests/` — cover the schema, the data (via schema validation), and the
   domain logic.

Never commit a `data/` file for a shape that has no corresponding schema.

## Curriculum content fidelity

- Curriculum content is **transcribed faithfully** from the source
  syllabus, in Indonesian. It is never invented, translated, or
  "improved" in meaning.
- Any change to curriculum content requires a **syllabus check** against
  the official sources before it is made:
  - OSN: R1 (`osn.toki.id/silabus`), R2 (`osn.toki.id/silabus/kota`), R3
    (`osn.toki.id/silabus/provinsi`).
  - IOI: R7 (`ioinformatics.org/page/syllabus/12`), R8 (IOI Syllabus PDF).
- Use the **`curriculum-change`** issue form
  (`.github/ISSUE_TEMPLATE/curriculum-change.yml`) to propose or record
  such a change — it captures the source checked, the date checked, and
  the expected changelog impact (§14.2 rule 8).
- Any curriculum content change requires a **changeset**
  (`docs/development/releasing.md`).

## Privacy

- **Never commit real learner data.** This repository holds no learner
  personal data (see `README.md`, "What this repository is not").
- Any sample/fixture data representing a learner must be **obviously
  synthetic and pseudonymous** (e.g. clearly fake names, no real school,
  no real identifiers).

## What requires a changeset

See `docs/development/releasing.md`, "When a changeset is required" — do
not duplicate that policy here; that document is the source of truth.

## Verification checklist (run before claiming an issue done)

- [ ] `bun run format:check` passes.
- [ ] `bun run lint` passes.
- [ ] `bun run typecheck` passes.
- [ ] `bun test` (or `bun run test:coverage`) passes, coverage gate met.
- [ ] `bun run build` passes.
- [ ] `bun run validate` passes (currently a no-op placeholder — still run it).
- [ ] Every command and path mentioned in any doc you touched actually
      exists — verify, don't assume.
- [ ] Tests added/updated for the change (per `docs/development/testing.md`).
- [ ] Docs updated if behavior, setup, or process changed.
- [ ] Changeset added if the change is user-visible.
- [ ] For curriculum content changes: syllabus check done, source and date
      recorded.
- [ ] No real learner data, secrets, or credentials committed.
- [ ] Commit message references the issue number.
