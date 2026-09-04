# `osn` CLI reference

The `osn` command-line interface (issue #19) is the outermost layer of
this repository (see `docs/architecture/README.md`'s "four layers"): it
dispatches subcommands that call into `src/domain/` (and, for later
issues, `src/render/`). It has no external CLI framework dependency
(TR-11) -- subcommand dispatch, flag parsing, and help text are all
hand-rolled in `src/cli/run-cli.ts`.

## Synopsis

```sh
osn <command> [options]

# equivalently, during development, without installing a bin symlink:
bun run src/cli/index.ts <command> [options]
```

## Global flags

These are recognised regardless of which subcommand (if any) is present:

| Flag | Meaning |
| --- | --- |
| `-h`, `--help` | With no subcommand: print global usage (this command list) and exit `0`. After a subcommand (`osn <command> --help`): print that command's own help and exit `0`, without running the command. |
| `-V`, `--version` | Print the version from `package.json` (never hard-coded) and exit `0`. Takes precedence over everything else -- even `osn --version bogus-command` prints the version rather than failing on the unknown command. |
| `--json` | Emit machine-readable JSON output instead of human-readable text, for commands that support it (`validate` does). May appear before or after the subcommand name. |

## Exit codes

Applied consistently across every subcommand:

| Code | Meaning |
| --- | --- |
| `0` | Success. |
| `1` | Validation failure -- the command ran to completion but found a problem (e.g. `osn validate` found one or more corpus findings). |
| `2` | Usage error -- unknown command, bad flag, or a missing required argument (including running `osn` with no subcommand at all). |

An uncaught internal error inside a command is also reported as exit `1`,
after being caught and printed as a plain message -- never as a raw stack
trace.

## Command dispatch and how new commands are added

`src/cli/run-cli.ts`'s `runCli` is the single dispatcher. It:

1. Checks `--version`/`-V` first, anywhere in argv.
2. Finds the first argv token that does not start with `-` as the
   subcommand name. No such token (bare `osn`, or only flags) -> global
   usage, exit `0` if `--help`/`-h` was given, else exit `2`.
3. Looks the subcommand up in a registry (`src/cli/commands/index.ts`'s
   `COMMAND_REGISTRY`, keyed by name). Unknown name -> an error naming
   every valid command, exit `2`.
4. If `--help`/`-h` is among the remaining args, prints that command's own
   `help()` text and exits `0` -- handled once, centrally, so no command
   has to implement `--help` itself.
5. Otherwise calls the command's `run(args, ctx)`, with the subcommand
   token and `--json` already stripped from `args`.

Adding a new subcommand (`plan` #20, `render` #21, `report` #22,
`checklist` #25) means writing a new `src/cli/commands/<name>.ts`
exporting a `Command` (`src/cli/command.ts`'s interface: `name`,
`summary`, `help()`, `run(args, ctx)`) and adding it to the `COMMANDS`
array in `src/cli/commands/index.ts` -- nothing in `run-cli.ts` itself
needs to change.

## `osn validate`

Validates the **entire** curriculum corpus (every `data/*.json` file) in
one pass and reports **every** problem found, not just the first.

```sh
osn validate [options]
```

### What it checks

1. **Schema conformance.** Every file in the typed file->schema registry
   (`DATA_FILE_REGISTRY` in `src/domain/corpus-audit.ts`) is parsed
   against its Zod schema (the same schemas under `src/schema/` the
   domain layer uses). A file that is missing, that is not valid JSON, or
   that fails its schema is reported with every issue Zod found for it
   (not just the first).

   The registry also runs in reverse: a `.json` file present under
   `data/` that is **not** listed in the registry is itself reported as a
   finding ("this data file is not covered by any schema...") rather than
   silently ignored -- this is what keeps a newly-added, unwired data file
   loud instead of invisible.

2. **Structural invariants**, checked against whichever files parsed
   successfully: 28 weeks numbered 1-28; 7 gates at weeks 4/8/12/16/20/24/28;
   10 topic families; 41 references R1-R41; assessment weights summing to
   exactly 100; both weekly session templates summing to exactly 120
   minutes; 5 hint-escalation levels; 4 problem-completion status codes; 7
   KPI metrics; 7 decision playbooks; 6 assessment-bank kinds; 4
   competition stages; 4 curriculum categories.

3. **Referential integrity**, spanning two files where the fact cannot be
   expressed by either file's own schema:
   - every week's `topicFamilies` id resolves to a real topic family
     (`data/topic-families.json`);
   - the set of weeks carrying a non-null `checkpoint` matches the gate
     weeks in `data/gates.json` exactly, and checkpoint numbers are 1..N
     in ascending week order;
   - every assessment-bank kind's non-null `servesStage` resolves to a
     real competition stage (`data/competition-stages.json`);
   - every `Rnn`-shaped citation anywhere in the corpus resolves to a real
     reference in `data/references.json`.

### Options

| Flag | Meaning |
| --- | --- |
| `--json` | Emit `{ ok, findings, summary }` instead of grouped text. |
| `--data-dir <path>` | Validate a different corpus directory instead of the repository's real `data/`. Primarily for testing against a deliberately corrupted fixture corpus (see `tests/integration/cli-validate-fixtures.test.ts`) -- not needed for normal use. |
| `-h`, `--help` | Show `osn validate`'s own help. |

### Exit codes

| Code | Meaning |
| --- | --- |
| `0` | The corpus has zero findings. |
| `1` | The corpus has one or more findings. |
| `2` | Usage error: `--data-dir` given with no path, or the given directory cannot be read. |

### Example: clean corpus

```text
$ osn validate
osn validate: corpus at /path/to/repo/data
OK -- 19 data file(s) validated, 0 problem(s) found.
```

```sh
$ osn validate --json
{
  "ok": true,
  "findings": [],
  "summary": {
    "filesValidated": 19,
    "filesMissing": 0,
    "filesUnregistered": 0,
    "findingCount": 0,
    "errorCount": 0,
    "warningCount": 0
  }
}
```

### Example: a corrupted corpus (illustrative)

```text
$ osn validate
osn validate: corpus at /path/to/repo/data
FAILED -- 2 problem(s) found (2 error(s), 0 warning(s)):

curriculum-categories.json:
  - [error] categories: category ids must be exactly [core, support, extension, de-prioritized], each appearing once; got [support, extension, de-prioritized]

weeks.json:
  - [error] weeks: week numbers must be exactly [1, 2, ..., 28], each appearing once; got [1, 2, ..., 26, 28]
```

Every finding names the file, an in-file `path` (dot-separated, e.g.
`weeks[week=4].checkpoint`, or `(file)`/`(root)` when the problem is not
about one field), and a human-readable `message` -- enough to fix the
problem without re-reading the whole corpus.

### How the validator is testable against a fixture, not just the real corpus

`osn validate`'s actual checking logic (`auditCorpus` in
`src/domain/corpus-audit.ts`) is a pure function of an injected
`CorpusSource` (a `file name -> parsed JSON` map) -- it never statically
imports `data/*.json` itself, unlike every other module under
`src/domain/`. The one piece of filesystem I/O (reading a directory of
`.json` files into that shape) lives in `src/cli/corpus-loader.ts`
instead. This is why `--data-dir` above can point at an arbitrary
directory, and why `tests/unit/corpus-audit.test.ts` can construct a
corrupted `CorpusSource` in memory without touching disk at all. See
`src/domain/corpus-audit.ts`'s docblock for the full rationale (including
why this module could not simply reuse
`assertNoDanglingCitations`/`findDanglingCitations` from
`src/domain/registers.ts`).

## Planned commands (not yet implemented)

The following subcommands are named in `docs/architecture/README.md` and
scoped by their own issues, but do not exist yet -- `osn <name>` for any of
them today is simply an unknown command (exit `2`):

| Command | Issue | Purpose |
| --- | --- | --- |
| `osn plan` | [#20](https://github.com/ahliweb/osn/issues/20) | Generates the 28-week programme calendar as data/Markdown, deterministically (byte-identical output across repeated runs, per TR-07). |
| `osn render` | [#21](https://github.com/ahliweb/osn/issues/21) | Turns domain data into mentor-facing Markdown artefacts (weekly session plans, checkpoint sheets, SOP cards) via `src/render/`. |
| `osn report` | [#22](https://github.com/ahliweb/osn/issues/22) | Computes the §6.3 mentor KPIs (`src/domain/kpi.ts`) from already-produced learning-record data. |
| `osn checklist` | [#25](https://github.com/ahliweb/osn/issues/25) | Generates an operational checklist artefact. |

Each will be added as a new `src/cli/commands/<name>.ts` module registered
in `src/cli/commands/index.ts`, per "Command dispatch and how new commands
are added" above -- no change to the dispatcher itself.
