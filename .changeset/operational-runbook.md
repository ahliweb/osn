---
"osn-informatika-2026": minor
---

Add the §14.1/§14.2 operational checklist: the eight cohort-readiness
checklist items (`data/readiness-checklist.json`) with their verification
method and required evidence, the eight final operational rules and the
ten-stage mentor quick-pointer callout (`data/operational-rules.json`),
and a dated §14.2 rule 8 syllabus-check log (`data/syllabus-check-log.json`,
seeded with an initial entry recording that this corpus was transcribed
from the v2.0 source document dated 2026-09-04 and that no live network
check of the external OSN/IOI sources was performed for that entry).
Exposes typed loaders and lookups in `src/domain/operations.ts`
(`listReadinessItems`, `getReadinessItem`, `listOperationalRules`,
`quickPointer`, `listSyllabusChecks`, `latestSyllabusCheck`, and a
UTC-safe `daysSinceLastSyllabusCheck`), a pure Markdown renderer
(`src/render/checklist.ts`), and `osn checklist [--format md|json] [--out]
[--force]` (`src/cli/commands/checklist.ts`). Registers the three new
data files in `osn validate`'s `DATA_FILE_REGISTRY`
(`src/domain/corpus-audit.ts`) with their structural invariants (8 items,
8 rules, 10 quick-pointer stages, a non-empty syllabus-check log). Adds
`docs/operations/runbook.md` (cohort-start procedure, the weekly cycle,
the contest → postmortem → upsolve loop, the monthly review, and the §13
governance roles) and `docs/operations/syllabus-check.md` (the mandatory
pre-cohort-cycle syllabus-check procedure against R1/R2/R3/R7/R8, and how
a detected change flows into a `curriculum-change` issue, a changeset, and
a `CHANGELOG.md` entry), plus a `bun run check:checklist-fidelity` script
that verifies every transcribed item/rule/quick-pointer field against its
source `docs/silabus/14-checklist-dan-aturan-operasional.md` line
verbatim.
