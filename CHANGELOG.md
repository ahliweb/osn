# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Version numbers here (`vX.Y.Z`) track the software in this repository —
schema, domain model, CLI, and tooling. They are independent of the
curriculum corpus's own `syllabusVersion` (currently `2.0`, dated
`2026-09-04`), which tracks the source document. See
[`docs/development/releasing.md`](docs/development/releasing.md) for how the
two relate.

## [Unreleased]

Nothing yet.

## [1.1.0] — 2026-09-05

Toolchain and dependency modernisation. No curriculum content, schema shape
or CLI behaviour changed; the corpus is byte-identical to v1.0.0.

### Changed

- **Zod 3 → 4** — the validation library backing all 26 schema modules. The
  one deprecated call site (`z.string().url()`) is migrated to `z.url()` in
  the same change, rather than left as fresh debt for Zod 5 to break.
  Validation behaviour was verified unchanged by probing the schemas that
  carry security or correctness weight, not by relying on the test suite
  alone: the https URL validator still rejects `http:`, `javascript:`,
  malformed input and the empty string; `parseDataFile` still reports every
  issue at once and names the source file; and the learning-record guard
  still rejects all five identifier-injection vectors from #15.
- **TypeScript 5 → 7** — the native compiler rewrite. The risk with a
  rewrite is strict options being accepted but silently ignored, which
  would remove type safety while CI stayed green, so enforcement was probed
  directly: `noUncheckedIndexedAccess` still errors. The full strict config
  typechecks with no unsupported-option warnings.
- **Biome 1 → 2** — `biome.json` migrated to the Biome 2 schema with
  identical intent. The five findings from Biome 2's expanded recommended
  rules are fixed in the code; no rule was disabled and no suppression
  added.
- **`actions/checkout` v4 → v7** in CI.

### Added

- `bun run assist:check` and a matching CI step, enforcing Biome's import
  organization. See **Fixed** below.

### Fixed

- **An import standard that nothing enforced.** `biome.json` has declared
  organize-imports on since the project began, but neither `format:check`
  nor `lint` runs Biome's assist actions — only `biome check` does. 36 of
  137 files had unsorted imports. The ordering is applied and the gap is
  now closed by a dedicated CI step.
- **Dependabot lockfile drift.** The `npm` ecosystem updates
  `package.json` without touching `bun.lock`, so every dependency pull
  request failed CI on `--frozen-lockfile` and needed manual regeneration.
  Switched to the `bun` ecosystem, which maintains the lockfile itself.
  Relaxing `--frozen-lockfile` was rejected: it is a supply-chain control
  (RISK-05), and removing a security control to silence a build error is
  the wrong trade.

### Documentation

- `CONTRIBUTING.md` records the lockfile discipline, including that
  removing `--frozen-lockfile` is not an acceptable workaround.
- `README.md`, `AGENTS.md`, `CONTRIBUTING.md` and
  `docs/development/ci-cd.md` updated for the new `assist:check` command
  and the now eleven-step CI pipeline.

### Notes

- No breaking changes. The version is `minor` rather than `patch` because
  Zod 4's inferred types differ subtly from Zod 3's, and the exported
  schemas are this library layer's public surface.
- All known limitations recorded in the v1.0.0 notes below still stand,
  unchanged.

## [1.0.0] — 2026-09-05

Initial stable release. The *Silabus Operasional Pembinaan OSN Informatika
2026* (v2.0, 4 September 2026) is now available as a validated,
version-controlled corpus with a mentor-facing CLI and the governance
documentation the syllabus itself mandates.

### Added — curriculum corpus

- The complete source syllabus as structured Markdown under
  [`docs/silabus/`](docs/silabus/): an index with the document control table
  and executive summary, one file per numbered section §1–§14, and the
  R1–R41 reference register. The transcription keeps the original
  Indonesian, preserves every table row and column, links every citation
  marker to its reference anchor, and retains the five operational callouts
  as blockquotes.
- A requirements register and traceability matrices under
  [`docs/requirements/`](docs/requirements/): **77 requirements** across
  functional, technical, operational, educational and governance
  categories, each citing its source section, a verification method and its
  implementing issue.

### Added — curriculum data model

- The ten official topic families (§2.1), the 28-week operational syllabus
  and seven phase gates (§4, §4.1), the four curriculum categories (§3),
  the four competition stages with structured contest formats (§2.2), and
  the §1.3 baseline learning load — all as JSON validated by Zod contracts.
- The reference (R1–R41), regulation (§10), ISO/IEC standard (§11) and
  mentor source-priority (§12) registers.
- `assertNoDanglingCitations()` walks the whole corpus at load, so a
  citation can never point at a reference that does not exist.

### Added — pedagogy and assessment

- The §5.1 two-session weekly template, with the schema enforcing
  contiguous segments totalling exactly 120 minutes; the §5.2 seven-step
  mentor SOP with its minimum test checklist and post-Accepted questions;
  and the §5.3 progressive hint ladder with terminal escalation.
- The §6.1 weighted rubric, with the schema enforcing that the five
  components sum to 100, and a weighted-score computation that avoids
  floating-point drift by summing integer products and dividing once.
- The §6.2 A/B/C/D status engine, including `resolveSchedule` and the 3–7
  day re-solve window.
- The learning-record and problem-taxonomy schemas, with per-field privacy
  classification (see **Security** below).
- The seven §6.3 mentor KPI definitions and a pure computation engine whose
  every metric returns an explicit "insufficient data" state rather than
  `NaN`.
- The seven §7 decision playbooks with executable selectors for
  constraint-to-complexity, shortest-path choice, range-query structure
  choice, the DP design checklist and the stress-test plan. Every selector
  returns a justification alongside its decision, because the syllabus
  requires the applicability condition to be stated before coding.
- The six-kind assessment bank (§13) and a blueprint generator that derives
  OSN-K and OSN-P formats from the competition-stage data rather than
  restating them.

### Added — the `osn` CLI

- `osn validate` — audits the entire corpus in one pass: schema conformance
  against a typed file registry that flags any unwired data file,
  structural invariants, and referential integrity. Reports every problem
  found, not just the first.
- `osn plan` — generates a dated 28-week cohort calendar from a start date,
  with holiday/exam exclusions shifting subsequent weeks rather than
  overlapping. Output is byte-identical across host timezones.
- `osn render` — produces mentor-ready weekly plans, checkpoint sheets and
  the SOP card as Markdown.
- `osn report` — computes the KPI dashboard, the §13.1 postmortem error
  taxonomy and scheduled re-solves from a learning-record file.
- `osn checklist` — renders the §14.1 cohort readiness checklist with the
  corpus version and syllabus-check status.
- `osn privacy-check` — see **Security** below.

### Added — operations and governance

- [`docs/operations/runbook.md`](docs/operations/runbook.md) and
  [`docs/operations/syllabus-check.md`](docs/operations/syllabus-check.md):
  the cohort-start procedure, the weekly cycle, the contest → postmortem →
  upsolve loop, the monthly review, the §13 governance roles, and the
  mandatory pre-cycle syllabus-check procedure.
- The §14.1 readiness checklist, §14.2 operational rules and ten-stage
  mentor quick pointer as validated data, plus a dated syllabus-check log
  implementing §14.2 rule 8.

### Security

- **No learner personal data is stored in this repository, by design.** The
  learning-record schema is `.strict()` and carries a recursive
  direct-identifier guard over an 18-term English/Indonesian denylist. A
  downstream platform that bolts on a name, email or NISN field — at any
  nesting depth, in any of camelCase, snake_case or kebab-case — gets a
  validation error rather than silent acceptance.
- `osn privacy-check` runs in CI and scans `data/` recursively, including
  `.jsonl` files and `data/samples/`. Findings report file, path and key
  but **never the value**, so a privacy error cannot itself become a
  disclosure in a terminal scrollback or CI log. `osn report` applies the
  same refusal before computing anything.
- [`docs/governance/privacy.md`](docs/governance/privacy.md) — the policy
  for minors' data under UU No. 27 Tahun 2022, with a role-access matrix,
  retention schedule and regulatory mapping.
- [`docs/governance/security.md`](docs/governance/security.md) — the six
  §13 controls expanded into implementable statements, mapped to all
  fourteen §11 ISO/IEC standards, with a seven-row risk register.
- [`docs/governance/incident-response.md`](docs/governance/incident-response.md)
  and [`SECURITY.md`](SECURITY.md), including the UU 27/2022 personal-data
  breach escalation duty.
- `.github/dependabot.yml` watches npm and GitHub Actions dependencies
  weekly. CI runs with `contents: read` only.

### Architecture

- A strict one-way dependency direction — `data` → `schema` → `domain` →
  `render`/`cli` — documented in
  [`docs/architecture/`](docs/architecture/) and honoured throughout:
  schemas never import domain, and validation happens once, at load.
- Five Architecture Decision Records covering curriculum-as-code (rather
  than an LMS or judge), the Bun/TypeScript/Zod stack, JSON data with Zod
  contracts, the no-learner-personal-data rule, and dual versioning of
  software against curriculum.

### Documentation

- `README.md`, `AGENTS.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and
  developer documentation for [testing](docs/development/testing.md),
  [CI/CD](docs/development/ci-cd.md) and
  [releasing](docs/development/releasing.md).
- The [CLI command reference](docs/cli/README.md).
- The source document's non-affiliation notice is carried in `README.md`:
  this is an independent curriculum document, not an official document of
  Puspresnas, IA TOKI or the IOI.

### Notes

- **No breaking changes** — this is the initial release.
- This repository is **not certified** to any ISO/IEC standard. The
  governance documents map controls onto those standards, which is a
  different claim, and they say so explicitly.
- Contact points in `SECURITY.md`, `CODE_OF_CONDUCT.md`,
  `docs/governance/privacy.md` and
  `docs/governance/incident-response.md` are marked placeholders that must
  be filled before publication. No address or person was invented.
- The seeded syllabus-check log entry records transcription provenance
  only. No live check of the external OSN/IOI sources was performed for it,
  and the entry says so; the next check must perform the live verification
  per [`docs/operations/syllabus-check.md`](docs/operations/syllabus-check.md).

[Unreleased]: https://github.com/ahliweb/osn/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/ahliweb/osn/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/ahliweb/osn/releases/tag/v1.0.0
