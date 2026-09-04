---
"osn-informatika-2026": minor
---

Add the `osn` CLI foundation (`src/cli/index.ts`, no external CLI
framework dependency) with subcommand dispatch, `--help`/`-h`,
`--version`/`-V`, `--json`, and consistent exit codes (0 success, 1
validation failure, 2 usage error), plus the `osn validate` command that
validates the entire `data/*.json` corpus in one pass: schema conformance
against a typed file-schema registry (which also flags any data file
nobody wired up), the fixed structural invariants (28 weeks, 7 gates, 10
topic families, 41 references, and so on), and referential integrity
(week → topic family, week checkpoint numbering ↔ gate weeks,
assessment-bank kind → competition stage, every `Rnn` citation → the
reference register). Replaces the placeholder `bun run validate` script
from #3 and wires it into CI (no workflow changes needed — the step
already called `bun run validate`). Adds a `bin` entry to `package.json`
and `docs/cli/README.md` as the command reference.
