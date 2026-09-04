---
"osn-informatika-2026": minor
---

Add `osn render`, the mentor artefact generator: `osn render weekly
--week <1-28>` (a mentor-ready session plan -- focus, content, outcome,
the curated problem-load range, both §5.1 120-minute session templates
with their segment timings, the §5.1 exit-ticket instruction, the §5.2 SOP
reminder, the §5.3 hint ladder, and the §4.1 gate evidence on a gate
week), `osn render checkpoint --number <1-7>` (the gate evidence required,
the §6.1 rubric weights table, the §6.2 A/B/C/D recording grid with
follow-up actions, and the §6.3 KPI snapshot fields), and `osn render sop`
(a one-page mentor SOP card).

The rendering logic (`src/render/weekly.ts`, `src/render/checkpoint.ts`,
`src/render/sop.ts`) is pure -- no file I/O, no `process` access, no
dates -- and fails loudly with a named `RenderRequestError` naming the
valid range on any out-of-range request, rather than ever emitting a
partially-filled document. `--out <path>` writes the rendered Markdown to
disk via a thin, separate I/O layer (`src/cli/output-writer.ts`); without
`--force`, an existing file at `--out` is left byte-for-byte untouched
(exit 2) rather than silently overwritten.
