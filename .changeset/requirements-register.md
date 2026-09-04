---
"osn-informatika-2026": minor
---

Add the requirements register and traceability matrices under
`docs/requirements/`: 77 requirements derived from the syllabus across five
categories (functional, technical, operational, educational, governance),
each citing its source section, a concrete verification method and the
issue that implements it.

Adds `scripts/check-requirements.ts` and `bun run check:requirements`,
enforced by an integration test so CI fails on an orphaned requirement ID,
an uncovered syllabus section or an uncovered backlog issue.
