# Testing strategy

This project treats the curriculum as code. §13 ("Quality Review") and §14.2
rule 8 of the operational syllabus require every curriculum artefact to be
audited before use — mechanically, that means the data and the tooling that
processes it must be covered by automated tests from the first commit.

Tests run on `bun:test` (Bun's built-in test runner). No other test
framework (Vitest, Jest, Mocha, …) and no external coverage tool (c8, nyc,
…) is used — Bun's own coverage engine is sufficient and is what CI and
local development both rely on.

## Layout: unit vs. integration

```
tests/
  unit/         fast, isolated tests — one module at a time
  integration/  tests that exercise multiple modules together
```

- **`tests/unit/`** — tests a single module (a schema, a domain function, a
  CLI command handler, a render helper) in isolation. No filesystem I/O
  beyond what the module itself needs, no network, no shelling out to other
  commands. This is where the bulk of the suite lives.
- **`tests/integration/`** — tests that cross module boundaries: for
  example, parsing real curriculum data through the schema layer and into
  the domain model, or running a CLI command end-to-end and asserting on its
  output/exit code. This directory is currently empty (kept alive with
  `.gitkeep`) because there is no cross-module behaviour to integrate yet;
  it will gain tests as the schema, domain, CLI, and render layers land.

Both directories mirror the shape of `src/` closely enough that a reader can
find the test for a given module without guessing — exact mirroring is not
enforced, but tests should live next to the concept they cover, not be
dumped in one flat file.

## What must be tested

This is not optional coverage-for-its-own-sake: every one of the following
must have a test before it is considered done, per §13/§14.2 rule 8:

- **Every schema** (`src/schema/`) — valid input parses to the expected
  shape, and invalid input is rejected with a clear error, for each field
  and constraint the schema declares.
- **Every domain rule** (`src/domain/`) — the business logic that operates
  on parsed curriculum data, including edge cases and rule violations, not
  just the happy path.
- **Every CLI command** (`src/cli/`) — inputs, outputs, and exit codes,
  covering both success and failure paths.

Render output (`src/render/`) should be tested where it has non-trivial
logic; pure templating with no branching is lower priority but still
benefits from at least one snapshot-style assertion once it exists.

## Naming convention

Test files are named `*.test.ts` and live under `tests/unit/` or
`tests/integration/`. Bun's default test runner picks up any file matching
that pattern; there is no separate configuration step required to register
a new test file.

## Running tests

```sh
bun test                 # run the full suite
bun run test:coverage    # run the full suite with coverage reporting
```

`bun run test:coverage` is a thin wrapper around `bun test --coverage`,
defined as an explicit script so coverage runs the same way locally and in
CI without anyone needing to remember the flag.

## Coverage gate

Coverage is configured in `bunfig.toml`:

```toml
[test]
coverage = true
coverageSkipTestFiles = true
coverageThreshold = { lines = 0.85, functions = 0.85 }
```

- `coverage = true` — coverage is collected on every `bun test` run, not
  only when `--coverage` is passed explicitly.
- `coverageSkipTestFiles = true` — test files themselves are excluded from
  the coverage percentages; only the code under `src/` that tests exercise
  counts.
- `coverageThreshold = { lines = 0.85, functions = 0.85 }` — **the build
  fails if line coverage or function coverage drops below 85%.** This is
  the actual, currently-enforced floor.

  The repository measures 100% today, because `src/` holds a single trivial
  entrypoint. The gate is nonetheless set at 85% deliberately: a 100% gate
  combined with the ratchet policy below would deadlock as soon as the CLI
  lands, because CLI error paths, `process.exit` calls, and defensive
  branches that should never be reached are exactly the code that cannot be
  driven to 100% without writing tests that assert nothing. 85% is a floor
  that catches a genuinely untested module while leaving the ratchet room
  to move honestly.

  Note the key names: Bun's threshold table uses the plural `lines` /
  `functions` (not `line` / `function`) — the singular keys are silently
  ignored rather than rejected, so a typo there would silently disable the
  gate. This has been verified empirically against Bun 1.4.0: an
  out-of-range value under the correct plural keys reliably fails the
  build, and the CLI-reported "% Funcs" / "% Lines" columns are what the
  threshold is checked against.

### Ratchet policy

The threshold only ever moves **up**. As new modules land under
`src/schema/`, `src/domain/`, `src/cli/`, and `src/render/` and gain their
required tests, the threshold in `bunfig.toml` should be raised to lock in
the improvement once the higher level is comfortably held.

The threshold must never be lowered to make a failing build pass. If a
change would drop coverage below the current gate, the fix is to add the
missing tests, not to relax the gate. Lowering the gate is a deliberate
architectural decision that must be justified in the commit message that
changes it — never a side effect of an unrelated change.
