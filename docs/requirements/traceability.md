# Traceability Matrices

Two views on the same 77 requirements in `register.md`, proving the register is exhaustive in
both directions (see `README.md`'s "completeness rule"):

1. **Syllabus section → requirements → issues** — proves every numbered section of the source
   syllabus, §1 through §14, plus the reference list, contributes at least one requirement.
2. **Issue → requirements covered** — proves no issue in the backlog (`#1`-`#26`) is left without
   a requirement it satisfies.

`scripts/check-requirements.ts` parses both tables below and asserts these properties
mechanically; do not hand-edit one matrix without updating the other and `register.md`.

## Matrix 1 — Syllabus section → requirements → issues

| Syllabus section | Requirements | Issues | Status |
| --- | --- | --- | --- |
| §1 — [Identitas Program, Sasaran, dan Hasil Belajar](../silabus/01-identitas-program.md) | FR-08, ER-15 | #10, #11, #17, #18 | implemented |
| §2 — [Arsitektur Kompetensi dan Tahapan Kompetisi](../silabus/02-arsitektur-kompetensi.md) | FR-01, FR-02, FR-07, FR-21 | #9, #11, #18 | implemented |
| §3 — [Struktur Kurikulum: Core, Support, dan Extension](../silabus/03-struktur-kurikulum.md) | FR-06, ER-10, ER-11 | #11 | implemented |
| §4 — [Silabus Operasional 28 Minggu](../silabus/04-silabus-28-minggu.md) | FR-03, FR-04, FR-05, ER-09 | #10, #21 | implemented |
| §5 — [Format Pembelajaran Mingguan dan SOP Mentor](../silabus/05-format-pembelajaran-dan-sop.md) | FR-14, FR-24, ER-02, ER-03, ER-04, ER-05 | #13, #21 | implemented |
| §6 — [Sistem Evaluasi, Rubrik, dan KPI](../silabus/06-evaluasi-rubrik-kpi.md) | FR-17, FR-25, ER-06, ER-07, ER-08, ER-12, OR-09 | #14, #16, #22 | implemented |
| §7 — [Contoh Implementasi Praktis](../silabus/07-contoh-implementasi.md) | FR-18, FR-19, ER-13, ER-14 | #17 | implemented |
| §8 — [Perbandingan Lima Model/Kasus Pembinaan](../silabus/08-perbandingan-model.md) | OR-10, OR-11 | #10, #15, #18, #22, #25 | implemented |
| §9 — [Sejarah dan Pelajaran dari Pendahulu](../silabus/09-sejarah-dan-pelajaran.md) | OR-07 | #25 | implemented |
| §10 — [Regulasi Indonesia yang Relevan](../silabus/10-regulasi-indonesia.md) | FR-10, GR-01, GR-02, GR-03, GR-04, GR-05 | #12, #15, #23 | implemented |
| §11 — [Pemetaan Standar ISO/IEC](../silabus/11-pemetaan-iso.md) | FR-11, GR-07, GR-08 | #12, #24 | implemented |
| §12 — [Sumber Belajar dan Pustaka](../silabus/12-sumber-belajar.md) | FR-12 | #12 | implemented |
| §13 — [Tata Kelola Implementasi AhliKoding.com](../silabus/13-tata-kelola.md) | TR-01, TR-02, TR-03, TR-04, TR-05, TR-06, TR-08, TR-09, TR-11, FR-15, FR-16, FR-20, FR-22, OR-04, OR-05, OR-12, GR-06, GR-09, GR-10 | #1, #2, #3, #4, #5, #7, #8, #9, #15, #18, #19, #24, #25, #26 | implemented |
| §14 — [Checklist Kesiapan dan Aturan Operasional](../silabus/14-checklist-dan-aturan-operasional.md) | FR-23, FR-26, TR-07, OR-01, OR-02, OR-03, OR-08, ER-16 | #18, #20, #25 | implemented |
| §99 — [Daftar Referensi](../silabus/99-referensi.md) | FR-09, FR-13, OR-06, GR-12 | #12, #25, #26 | implemented |

`Status` is `implemented` when every requirement in the row is `implemented`, `planned` when
none is, and `mixed` otherwise. As of the v1.0.0 release every issue #1-#26 is closed and every
row is `implemented`. The last two to close were OR-12 (the contributor/agent guide re-verified
against the implementation) and GR-12 (the full verification suite passing from a clean state
with version, CHANGELOG and tag updated together), both of which are satisfied by issue #26
itself.

## Matrix 2 — Issue → requirements covered

| Issue | Requirements covered |
| --- | --- |
| #1 — Repository scaffolding and TypeScript/Bun toolchain | TR-01 |
| #2 — Test harness, coverage thresholds and smoke tests | TR-02 |
| #3 — CI/CD workflows and GitHub issue/PR templates | TR-03 |
| #4 — Release engineering: changesets, semantic versioning and CHANGELOG | TR-04, GR-10 |
| #5 — Project and agent documentation: README, AGENTS.md, CONTRIBUTING.md | OR-12, GR-11 |
| #6 — Convert the source PDF into structured Markdown curriculum documentation | TR-10 |
| #7 — Requirements register with traceability to the source syllabus | TR-09 |
| #8 — Architecture documentation and Architecture Decision Records | TR-05 |
| #9 — Schema foundation and the ten official topic families (rumpun materi) | FR-01, FR-02, TR-06 |
| #10 — 28-week operational syllabus dataset and phase gates | FR-03, FR-04, FR-05, ER-09, ER-15, OR-11 |
| #11 — Curriculum categories, competition stages and baseline learning load | FR-06, FR-07, FR-08, ER-10, ER-11 |
| #12 — Reference, regulation and standards registers | FR-09, FR-10, FR-11, FR-12, FR-13 |
| #13 — Weekly session template, mentor SOP and progressive hint policy | FR-14, ER-01, ER-02, ER-03, ER-04, ER-05 |
| #14 — Assessment model: internal weights, rubric and A/B/C/D status engine | ER-06, ER-07, ER-08 |
| #15 — Learning record and problem taxonomy schemas with privacy classification | FR-15, FR-16, GR-02, GR-03, OR-10 |
| #16 — Mentor KPI definitions and computation engine | FR-17, ER-12 |
| #17 — Decision playbooks: complexity, algorithm selection, DP design and stress testing | FR-18, FR-19, ER-01, ER-13, ER-14, ER-15 |
| #18 — Assessment bank taxonomy and evaluation blueprint generator | FR-20, FR-21, ER-15, OR-08, OR-11 |
| #19 — CLI foundation and `osn validate` corpus integrity command | FR-22, TR-08, TR-11 |
| #20 — `osn plan` — cohort calendar generator for the 28-week programme | FR-23, TR-07, OR-03 |
| #21 — `osn render` — mentor artifact generators (weekly plan, checkpoint sheet, SOP card) | FR-24, ER-03, ER-09 |
| #22 — `osn report` — mentor KPI dashboard reporting from learning records | FR-25, OR-09, OR-10 |
| #23 — Privacy and personal data protection policy (UU 27/2022) with safeguards for minors | GR-01, GR-04, GR-05 |
| #24 — Security policy and ISO/IEC control mapping | GR-06, GR-07, GR-08, GR-09 |
| #25 — Operational runbook: syllabus check procedure and cohort readiness checklist | FR-26, OR-01, OR-02, OR-03, OR-04, OR-05, OR-06, OR-07, OR-08, OR-11, ER-16 |
| #26 — Release v1.0.0: final verification, versioning, changelog and tag | GR-12, OR-12 |

Every requirement ID in `register.md` appears in at least one row of each matrix, and every ID
appearing in these matrices is defined in `register.md` — `scripts/check-requirements.ts` asserts
this set equality on every run.
