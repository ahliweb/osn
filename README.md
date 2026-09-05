# osn-informatika-2026

Curriculum-as-code for the **Silabus Operasional Pembinaan OSN Informatika
2026** (v2.0, 4 September 2026): a typed, validated, versioned
representation of the 28-week operational syllabus, plus the governance
documentation that syllabus mandates.

> **Non-affiliation notice**
>
> The source document states, verbatim: *"Dokumen kurikulum independen.
> Bukan dokumen resmi Puspresnas, IA TOKI, atau IOI."* — this is an
> independent curriculum document and **not** an official document of
> **Puspresnas**, **IA TOKI**, or the **IOI** (International Olympiad in
> Informatics). This repository, as a machine-readable encoding of that
> document, inherits that non-affiliated status. It is authored by **Tim
> Riset AhliKoding.com dari AhliWeb.com** and is not published, endorsed,
> or reviewed by Puspresnas, IA TOKI, or the IOI.

## What this repository is not

- **Not a judge.** It does not compile, run, or score submitted code.
- **Not an LMS.** It does not deliver lessons, track enrolment, or manage
  cohorts.
- **Not a student data store.** It holds no learner personal data. Sample
  data used anywhere in this repository is synthetic.

What it *is*: a schema, domain model, CLI, and rendering pipeline that
turn the syllabus's structure — the 28-week programme, the ten official
topic families, phase gates, assessment weights, mentor SOPs — into
version-controlled, testable artefacts.

## Quick start

Prerequisites: [Bun](https://bun.sh) (the project pins `1.4.0` in CI —
see `.github/workflows/ci.yml`).

```sh
bun install
bun run format:check
bun run lint
bun run typecheck
bun test
```

## Repository map

| Path | Contents |
| --- | --- |
| `src/schema/` | Zod schemas for curriculum data — the single source of truth for both runtime validation and inferred static types (ADR-0003). |
| `src/domain/` | Domain model / business rules over parsed curriculum data: KPI engine, decision playbooks, cohort planning, learning records, and more. |
| `src/cli/` | The `osn` CLI's command handlers (`validate`, `plan`, `render`, `report`, `privacy-check`, `checklist`) and dispatcher. |
| `src/render/` | Pure functions that turn domain data into mentor-facing Markdown artefacts (weekly plan, checkpoint sheet, SOP card, checklist). |
| `src/index.ts` | Package entrypoint, built by `bun run build` into `dist/`. |
| `data/` | The curriculum corpus: 22 schema-validated JSON files (topic families, weeks, gates, references, assessment model, KPI definitions, playbooks, and more). |
| `tests/unit/` | Fast, isolated tests, one module at a time. |
| `tests/integration/` | Cross-module tests (requirements-register verification, full-corpus and CLI end-to-end tests). |
| `docs/development/` | Engineering process docs: testing, CI/CD, releasing. |
| `docs/architecture/` | System architecture overview, repository map, and Architecture Decision Records (`adr/`). |
| `docs/requirements/` | The requirements register and its traceability matrices. |
| `docs/cli/` | The `osn` CLI command reference. |
| `docs/governance/` | Privacy policy, security policy, and incident-response procedure. |
| `docs/operations/` | The operational runbook and syllabus-check procedure. |
| `docs/silabus/` | The faithful Markdown transcription of the source syllabus PDF. |
| `docs/*.pdf` | The source syllabus document itself. |
| `.github/workflows/` | CI pipeline (`ci.yml`). |
| `.github/ISSUE_TEMPLATE/` | Bug, feature, and curriculum-change issue forms. |
| `.changeset/` | Pending changesets (see `docs/development/releasing.md`). |

See `docs/architecture/repository-map.md` for the exhaustive,
directory-by-directory description.

## Command reference

All commands are run with `bun run <script>` (or directly, e.g. `bun
test`). This table matches `package.json` exactly.

| Command | Runs | Notes |
| --- | --- | --- |
| `bun install` | Install dependencies | — |
| `bun run typecheck` | `tsc --noEmit` | — |
| `bun run lint` | `biome lint .` | — |
| `bun run lint:fix` | `biome lint --write .` | — |
| `bun run format` | `biome format --write .` | — |
| `bun run format:check` | `biome format .` | Check-only, no rewrite. |
| `bun test` | `bun test` | Full test suite. |
| `bun run test:coverage` | `bun test --coverage` | Enforces the coverage gate in `bunfig.toml` (see `docs/development/testing.md`). |
| `bun run build` | `bun build ./src/index.ts --outdir dist --target bun` | — |
| `bun run validate` | `osn validate` | Validates every `data/*.json` file (schema, structural invariants, referential integrity). Exits 0 clean / 1 on any finding. See `docs/cli/README.md`. |
| `bun run privacy-check` | `osn privacy-check` | Recursively scans `data/` for direct-identifier-shaped keys (GR-04). Exits 0 clean / 1 on any finding. See `docs/cli/README.md`. |
| `bun run check:requirements` | `bun run scripts/check-requirements.ts` | Verifies `docs/requirements/register.md` and `traceability.md` are internally consistent and exhaustive. |
| `bun run check:checklist-fidelity` | `bun run scripts/check-checklist-fidelity.ts` | Verifies the §14.1/§14.2 data in `data/` matches the source syllabus verbatim. |
| `bun run changeset` | `changeset` | Interactive changeset creation. See `docs/development/releasing.md`. |
| `bun run version` | `changeset version` | Consumes changesets into `CHANGELOG.md` and bumps `package.json` version. |

## Roadmap

Milestones as tracked in the GitHub repository (`ahliweb/osn`):

| Milestone | Scope | Status |
| --- | --- | --- |
| **M1: Engineering Foundation** | Repo scaffolding, toolchain, CI/CD, release engineering, agent docs | Complete |
| **M2: Curriculum Corpus** | PDF to Markdown, requirements register, architecture docs | Complete |
| **M3: Curriculum Data Model** | Typed, validated machine-readable curriculum datasets | Complete |
| **M4: Pedagogy & Assessment** | Session template, SOP, hint policy, rubric, KPI, playbooks | Complete |
| **M5: CLI & Generators** | `osn` CLI: validate, plan, render, report, checklist | Complete |
| **M6: Governance & Release** | Privacy, security, ISO mapping, runbook, v1.0.0 | Complete except the release itself — [#26](https://github.com/ahliweb/osn/issues/26) (this documentation-audit step included) is in progress. |

See `gh issue list --repo ahliweb/osn --state all` (or the
[Issues](https://github.com/ahliweb/osn/issues) tab) for the individual
issues backing each milestone.

## Further reading

- [`docs/development/testing.md`](docs/development/testing.md) — testing strategy and coverage gate.
- [`docs/development/ci-cd.md`](docs/development/ci-cd.md) — what CI runs and why.
- [`docs/development/releasing.md`](docs/development/releasing.md) — changesets, versioning, release procedure.
- [`AGENTS.md`](AGENTS.md) — instructions for AI coding agents working in this repository.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — how to contribute, including proposing curriculum changes.
- Source document: [`docs/Silabus_Operasional_OSN_Informatika_2026_Siap_Pakai_AhliKoding_AhliWeb.pdf`](docs/Silabus_Operasional_OSN_Informatika_2026_Siap_Pakai_AhliKoding_AhliWeb.pdf) — Silabus Operasional Pembinaan OSN Informatika 2026, v2.0, 4 September 2026, Tim Riset AhliKoding.com dari AhliWeb.com.

## Licence

[MIT](LICENSE) — Copyright (c) 2026 Tim Riset AhliKoding.com — AhliWeb.com.

The MIT licence covers the software (schema, domain model, CLI, tooling)
in this repository. It does not by itself grant rights over the source
syllabus document's own content beyond what the document's authors have
made available here; see the source PDF for its own terms.
