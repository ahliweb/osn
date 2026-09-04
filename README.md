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

What it *is*: a schema, domain model, and (eventually) CLI and rendering
pipeline that turn the syllabus's structure — the 28-week programme, the
ten official topic families, phase gates, assessment weights, mentor SOPs
— into version-controlled, testable artefacts.

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
| `src/schema/` | Zod schemas for curriculum data (empty scaffold today). |
| `src/domain/` | Domain model / business rules over parsed curriculum data (empty scaffold today). |
| `src/cli/` | CLI command handlers (empty scaffold today). |
| `src/render/` | Output generators — mentor artefacts, reports (empty scaffold today). |
| `src/index.ts` | Package entrypoint; currently a minimal placeholder. |
| `data/` | Curriculum data files (empty scaffold today). |
| `tests/unit/` | Fast, isolated tests, one module at a time. |
| `tests/integration/` | Cross-module tests (currently empty; see `docs/development/testing.md`). |
| `docs/development/` | Engineering process docs: testing, CI/CD, releasing. |
| `docs/*.pdf` | The source syllabus document itself. |
| `.github/workflows/` | CI pipeline (`ci.yml`). |
| `.github/ISSUE_TEMPLATE/` | Bug, feature, and curriculum-change issue forms. |
| `.changeset/` | Pending changesets (see `docs/development/releasing.md`). |

Several `src/` subdirectories and `data/` currently hold only a
`.gitkeep` placeholder — they are scaffolded ahead of the issues that
populate them (see Roadmap below).

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
| `bun run validate` | placeholder script | **Not yet implemented.** Currently prints a TODO and exits 0. Real implementation tracked in [issue #19](https://github.com/ahliweb/osn/issues/19). |
| `bun run changeset` | `changeset` | Interactive changeset creation. See `docs/development/releasing.md`. |
| `bun run version` | `changeset version` | Consumes changesets into `CHANGELOG.md` and bumps `package.json` version. |

## Roadmap

Milestones as tracked in the GitHub repository (`ahliweb/osn`):

| Milestone | Scope | Status |
| --- | --- | --- |
| **M1: Engineering Foundation** | Repo scaffolding, toolchain, CI/CD, release engineering, agent docs | In progress — scaffolding, test harness, CI/CD, and release engineering are done; this documentation issue ([#5](https://github.com/ahliweb/osn/issues/5)) is in progress. |
| **M2: Curriculum Corpus** | PDF to Markdown, requirements register, architecture docs | Not started |
| **M3: Curriculum Data Model** | Typed, validated machine-readable curriculum datasets | Not started |
| **M4: Pedagogy & Assessment** | Session template, SOP, hint policy, rubric, KPI, playbooks | Not started |
| **M5: CLI & Generators** | `osn` CLI: validate, plan, render, report, checklist | Not started |
| **M6: Governance & Release** | Privacy, security, ISO mapping, runbook, v1.0.0 | Not started |

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
