---
"osn-informatika-2026": minor
---

Add `osn report`: computes the seven §6.3 mentor KPI metrics, a §13.1
step-4 postmortem error-taxonomy breakdown, and a §13.1 step-5
scheduled-re-solves listing from a `.jsonl`/`.json` file of learning
records. Before anything is computed, every record is scanned for a
personal-identifier-shaped field at any depth and the whole file is
refused (with the offending field paths and record indices named, but
never the values) if any is found; schema-invalid records are reported
with every failing index, not just the first. Adds a committed,
clearly-synthetic sample dataset under `data/samples/` for docs and tests.
