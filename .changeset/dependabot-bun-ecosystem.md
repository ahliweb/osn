---
"osn-informatika-2026": patch
---

Switch Dependabot to the `bun` ecosystem so `bun.lock` is maintained
automatically, removing the lockfile drift that made every npm-ecosystem
dependency pull request fail CI. Documents the lockfile discipline in
`CONTRIBUTING.md`.
