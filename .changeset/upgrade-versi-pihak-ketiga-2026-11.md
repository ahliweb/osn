---
"osn-informatika-2026": patch
---

Update third-party dependencies within their current major: zod 4.6.7, @changesets/cli 3.0.3, @types/bun 1.4.4 and transitive packages. Two upgrades are deliberately held back: Bun stays pinned at 1.4.0 in CI because Bun 1.4.4 counts lines differently and drops `scripts/check-checklist-fidelity.ts` to 84.82% line coverage, under the 85% per-file threshold in `bunfig.toml` (85.95% on 1.4.0), and Biome stays on 2.5.x because 2.6 starts formatting Markdown and would reformat every document.
