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

Adding a new subcommand (`plan` #20, done -- see below; `render` #21,
`report` #22, `checklist` #25, still planned) means writing a new
`src/cli/commands/<name>.ts`
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

## `osn plan`

Generates the dated 28-week cohort calendar against the §4 operational
syllabus: for each week, its date range, focus, two session dates,
mini-contest/checkpoint markers, and (on a gate week) the evidence required
to proceed past that gate. Implements TR-07 (deterministic, UTC-only date
arithmetic), FR-23 and OR-03.

```sh
osn plan --start <YYYY-MM-DD> [options]
```

The actual planning logic (`buildCohortPlan`) lives in
`src/domain/cohort-plan.ts` as a pure function with no I/O -- `osn plan`
itself (`src/cli/commands/plan.ts`) is only flag parsing plus the two
renderers in `src/cli/format-plan.ts` (`formatPlanMarkdown`,
`formatPlanJson`), exactly the same split `osn validate` uses around
`auditCorpus`.

### Options

| Flag | Meaning |
| --- | --- |
| `--start <date>` | The cohort's start date, ISO `YYYY-MM-DD`. **Required.** |
| `--exclude <d1,d2,...>` | A comma-separated list of ISO `YYYY-MM-DD` dates to exclude (school holidays, exam days, ...). Optional; defaults to none. Order and duplicates don't matter -- the output normalises this list (deduplicated, ascending). |
| `--target-stage <id>` | Report against a target competition stage's intensive-preparation week: one of `osn-k`, `osn-p`, `osn-nasional`, `toki-ioi-extension` (`src/domain/structure.ts`'s `STAGE_IDS`). Optional. See "Target-stage informational entry and schedule-slip warning" below. |
| `--format <md\|json>` | Output format. Default `md`. `--json` (the global flag) is equivalent to `--format json`; an explicit `--format` wins if both are given. |
| `-h`, `--help` | Show `osn plan`'s own help. |

### Week-shifting rule

A week is **7 usable calendar days** -- calendar days that are not in
`--exclude`. Weeks are laid out back-to-back with no gaps and no overlap:
week 1 starts on `--start`; every later week starts the calendar day
immediately after the previous week's last day. Within a week, days are
consumed one at a time from that week's start: an excluded date is
consumed (so it lies inside exactly one week's date range and is never
silently dropped, and can never reappear in a later week) but does **not**
count toward that week's 7 usable days -- the walk simply continues one
more calendar day to make up the shortfall. A week's end date is therefore
its 7th usable day, whatever calendar date that turns out to be: it is 6
days after that week's start when no excluded date falls inside it, and
grows by exactly one calendar day for every excluded date that does. Since
every following week starts the day after the previous one ends, one
excluded date pushes every subsequent week's whole date range one day
later, and this accumulates: two excluded dates anywhere in weeks 1-10
push week 11 onward two days later in total, regardless of which of those
ten weeks each one fell in.

### Session-date rule

Each week's two session dates (§1.3's "2 sesi mentor/minggu" baseline) are
that week's **1st and 4th usable day** (i.e. the 1st and 4th non-excluded
calendar day counting from the week's start). This is fully deterministic
and does not assume any particular weekday alignment -- `--exclude` already
carries whatever school-specific calendar structure matters. An excluded
day can never be picked as a session date, since it is never one of a
week's usable days in the first place.

### Target-stage informational entry and schedule-slip warning

§4 places OSN-K intensive preparation at week 25, OSN-P at week 26,
national mixed at week 27, and final readiness at week 28 (`toki-ioi-extension`
has no dedicated intensive week in §4, so it is mapped to week 28,
final readiness, as the closest applicable milestone -- a derived reading,
noted as such in the output). Issue #20 asks for a warning "when the
corresponding intensive week falls after a supplied target date", but `osn
plan` has no target-*date* input, only `--target-stage`. Given `--target-stage`,
two things are reported instead:

1. **An informational entry** naming which week that stage's intensive
   preparation lands on and that week's *actual*, post-shift date range in
   this specific plan -- so a mentor can see exactly which calendar dates
   the relevant intensive week now covers once `--exclude` is accounted
   for.
2. **A schedule-slip warning**, only if `projectedEndDate` is pushed more
   than 14 days later than `baselineEndDate` (what the same 28 weeks would
   look like with zero excluded dates) -- a slip that large is exactly the
   kind of drift that could push an intensive week past the real-world
   selection dates §14.1 requires the calendar to be aligned against.

Both are gated on `--target-stage` being given, by design: `baselineEndDate`
itself is always reported regardless (it costs nothing and is useful
context on its own), but the warning only fires once a stage has actually
been named -- an `--exclude`-heavy plan with no stated target is not
assumed to be "wrong" just because it runs long, since without a named
target there is no operational deadline it could have slipped against.

### Determinism (TR-07)

All date arithmetic is UTC-only: dates are represented as the epoch-
millisecond instant of UTC midnight on that calendar day, arithmetic is
plain millisecond addition, and every value is read back out via
`Date#getUTC*` accessors only (never `Date#setDate`/`Date#getDate`, which
are sensitive to the host's local timezone) -- see
`src/domain/cohort-plan.ts`'s docblock. No date library is used. `osn plan`
is a pure function of its flags: identical `--start`/`--exclude`/
`--target-stage`/`--format` produce byte-identical stdout, on any machine,
regardless of host timezone.

### Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success. |
| `2` | Usage error: `--start` missing, `--start`/an `--exclude` entry is not a real ISO `YYYY-MM-DD` calendar date, an unknown `--target-stage`, or an unknown `--format`. |

### Example

```text
$ osn plan --start 2026-01-05 --exclude 2026-01-07 --target-stage osn-k
# osn plan: cohort calendar

Start date: 2026-01-05
Excluded dates (1): 2026-01-07
Target stage: osn-k
Projected end date: 2026-07-20 (un-excluded baseline: 2026-07-19)

Target stage "osn-k" (OSN-K): intensive preparation lands on week 25, 2026-06-23 to 2026-06-29. §4 places OSN-K intensive preparation at week 25.

| Week | Start | End | Focus | Sessions | Mini-contest | Checkpoint | Gate evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 2026-01-05 | 2026-01-12 | Orientasi CP & C++ dasar | 2026-01-05, 2026-01-09 | no | - | - |
| 2 | 2026-01-13 | 2026-01-19 | Control flow, fungsi, array/string | 2026-01-13, 2026-01-16 | no | - | - |
...
```

Note week 1's date range is extended by one day (05-12, not 05-11) and its
second session date shifts from 08 to 09, since 2026-01-07 was excluded --
see "Week-shifting rule" and "Session-date rule" above.

## Planned commands (not yet implemented)

The following subcommands are named in `docs/architecture/README.md` and
scoped by their own issues, but do not exist yet -- `osn <name>` for any of
them today is simply an unknown command (exit `2`):

| Command | Issue | Purpose |
| --- | --- | --- |
| `osn render` | [#21](https://github.com/ahliweb/osn/issues/21) | Turns domain data into mentor-facing Markdown artefacts (weekly session plans, checkpoint sheets, SOP cards) via `src/render/`. |
| `osn report` | [#22](https://github.com/ahliweb/osn/issues/22) | Computes the §6.3 mentor KPIs (`src/domain/kpi.ts`) from already-produced learning-record data. |
| `osn checklist` | [#25](https://github.com/ahliweb/osn/issues/25) | Generates an operational checklist artefact. |

Each will be added as a new `src/cli/commands/<name>.ts` module registered
in `src/cli/commands/index.ts`, per "Command dispatch and how new commands
are added" above -- no change to the dispatcher itself.
