---
"osn-informatika-2026": patch
---

Enforce Biome's import organization in CI via a new `assist:check` script.
`biome.json` had declared organize-imports on since the project began, but
neither `format:check` nor `lint` runs Biome's assist actions, so the rule
was never checked — 36 files had unsorted imports. Those are now sorted and
the gap is closed by a dedicated CI step.
