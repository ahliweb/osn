---
"osn-informatika-2026": minor
---

Add the problem taxonomy and learning-record schemas with privacy
classification. The learning record is strict-mode with a recursive
direct-identifier guard, so a downstream platform that bolts on a name,
email or NISN field — at any nesting depth — gets a validation error rather
than silent acceptance. Adds `docs/architecture/data-classification.md`,
kept in sync with the exported classification map by test.
