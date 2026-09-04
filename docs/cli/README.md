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

Adding a new subcommand (`plan` #20, `render` #21, `report` #22, done --
see below; `checklist` #25, still planned) means writing a new
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

## `osn render`

Turns the validated curriculum corpus into mentor-facing Markdown
artefacts (issue #21): a weekly session plan, a checkpoint sheet, or a
one-page mentor SOP card.

```sh
osn render weekly --week <1-28> [--out <path>] [--force]
osn render checkpoint --number <1-7> [--out <path>] [--force]
osn render sop [--out <path>] [--force]
```

The actual rendering logic (`renderWeeklyPlan`, `renderCheckpointSheet`,
`renderSopCard`) lives in `src/render/weekly.ts`, `src/render/
checkpoint.ts` and `src/render/sop.ts` as **pure functions from validated
data to a Markdown string** -- no file I/O, no `process` access, no dates,
no randomness. `osn render` itself (`src/cli/commands/render.ts`) is only
subcommand/flag parsing plus the thin `--out`/`--force` file-writing layer
(`src/cli/output-writer.ts`), exactly the same split `osn plan` uses
around `buildCohortPlan`.

Every renderer fails loudly on an out-of-range request: it throws a named
`RenderRequestError` (`src/render/errors.ts`) naming the valid range,
before emitting anything, rather than ever producing a partially-filled
document. `osn render` catches that one error class and reports it as a
clean usage error (exit `2`).

### `osn render weekly`

Renders a mentor-ready plan for one week of the §4 28-week syllabus: the
week number and focus, its content list, its learning outcome, the
practice/evaluation target together with the curated problem-load range
(or an explicit "no fixed count" note where a week's `problemLoad` is
`null` -- simulation/contest weeks), both §5.1 120-minute session
templates with their five segment timings and activities, the §5.1
exit-ticket instruction, the §5.2 seven-step SOP reminder, the §5.3 hint
policy ladder, and -- only on a gate week -- the §4.1 gate evidence
required to proceed past it.

| Flag | Meaning |
| --- | --- |
| `--week <n>` | The week number, `1`-`28`. **Required.** |

### `osn render checkpoint`

Renders a checkpoint sheet for one of the seven §4.1 phase gates: the
gate evidence required to proceed, the §6.1 rubric weights table (with
each component's evidence column), an A/B/C/D recording grid (§6.2, with
each status's prescribed follow-up action), and the §6.3 KPI snapshot
fields (from `listKpiDefinitions()`).

| Flag | Meaning |
| --- | --- |
| `--number <n>` | The checkpoint number, `1`-`7`. **Required.** |

### `osn render sop`

Renders a one-page mentor SOP card: the §5.2 seven-step SOP, its minimum
test checklist, its four post-Accepted questions, and the §5.3 hint
policy ladder together with the mandatory re-solve obligation it carries
from level 4 onward. Takes no subcommand-specific flags.

### `--out` / `--force` (all three `osn render` subcommands)

| Flag | Meaning |
| --- | --- |
| `--out <path>` | Write the rendered Markdown to this path instead of printing it to stdout. Resolved against the process's current working directory. |
| `--force` | Required to overwrite a file that already exists at `--out`. Without it, an existing file is left byte-for-byte untouched (the write itself never opens the file for truncation) and the command exits `2` -- a mentor should never silently lose an edited worksheet to a repeated `osn render ... --out` invocation. |

Without `--out`, the rendered Markdown is printed to stdout and nothing is
written to disk.

### Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success. |
| `2` | Usage error: a missing or unknown subcommand, a missing required flag (`--week`/`--number`), a `--week`/`--number` value outside its valid range (or not an integer), or `--out` already exists without `--force`. |

### Example

```text
$ osn render checkpoint --number 1
# Checkpoint 1 (after week 4: Search/sort dasar & recursion)

## Gate evidence required (§4.1)
- Dapat coding dasar tanpa template berlebihan
- memahami Big-O dasar
- binary search/recursion sederhana
- tracing C++.

## Rubric weights (§6.1)
| Component | Weight | Evidence |
| --- | --- | --- |
| Computational thinking & konsep | 20% | Tracing; modeling; quiz logika/complexity. |
...
```

## `osn report`

Computes the seven §6.3 mentor KPI metrics (`src/domain/kpi.ts`), a §13.1
step-4 postmortem error-taxonomy breakdown, and a §13.1 step-5
scheduled-re-solves listing (`src/domain/assessment.ts`'s
`resolveSchedule`) from a file of already-produced §15 learning records.
Implements FR-25, OR-09, OR-10.

```sh
osn report --records <path> [options]
```

The actual reporting logic (`buildKpiReport`) lives in
`src/domain/report.ts` as a pure function with no I/O -- `osn report`
itself (`src/cli/commands/report.ts`) is only input-format detection, the
**privacy gate** (below), schema validation, and the two renderers in
`src/cli/format-report.ts` (`formatReportMarkdown`, `formatReportJson`),
exactly the same split `osn validate`/`osn plan` use around their own
domain functions.

### Options

| Flag | Meaning |
| --- | --- |
| `--records <path>` | A `.jsonl` (one JSON record per line, blank lines skipped) or `.json` (a JSON array of records) file. **Required.** See "Input format detection" below. |
| `--by <topic\|week\|none>` | Group the KPI metrics by topic family or by §4 week number, in addition to the always-present overall (ungrouped) section. Default `none`. See "Grouping: a documented current limitation" below. |
| `--format <md\|json>` | Output format. Default `md`. |
| `--out <path>` | Write the rendered report to this path instead of stdout. |
| `--force` | Required to overwrite a file that already exists at `--out`. Without it, an existing file is left byte-for-byte untouched and the command exits `2` -- same safety property as `osn render`'s `--out`/`--force` (`src/cli/output-writer.ts`). |
| `-h`, `--help` | Show `osn report`'s own help. |

### Input format detection

`--records` accepts two shapes, chosen by this rule:

1. A `.jsonl` extension (case-insensitive) -> parsed as one JSON value per
   line; blank (whitespace-only) lines are skipped entirely and consume no
   record index.
2. A `.json` extension -> parsed as a single JSON array of records.
3. Any other extension -> **content-sniffed**: the whole trimmed file is
   parsed as JSON; if that succeeds and the result is an array, it is
   treated as `.json`-mode, otherwise as `.jsonl`-mode.

A record index reported in any error message below is: for `.jsonl` input,
the record's 0-indexed position among *non-blank* lines (so a blank line
never shifts later indices); for `.json` input, its 0-indexed position in
the array.

### The privacy gate

**Before anything is computed** -- before schema validation, before any
KPI is touched -- every successfully-parsed record in the input is scanned
with `findDirectIdentifiers` (`src/schema/learning-record.ts`'s recursive
walk against `DIRECT_IDENTIFIER_DENYLIST`, at any nesting depth). If
**any** record anywhere in the file carries a denylisted-identifier-shaped
key (`name`, `email`, `nisn`, `school`, ...; see ADR-0004), the whole file
is refused outright: no report is computed, no partial output is printed,
and the command exits non-zero.

The refusal message names every offending field's **path** and the
**record index** it was found in -- **never the value found there**, so a
real identifier accidentally present in an export is never echoed back
into a terminal, a CI log, or a redirected `--out` file. For example:

```text
$ osn report --records ./export-with-a-mistake.jsonl
osn report: privacy refusal: 1 field(s) shaped like a direct or indirect personal identifier were
found (see ADR-0004). Refusing to process "./export-with-a-mistake.jsonl". Values are never logged
-- only field paths and record indices are shown below. Remove or rename these fields in the
source data and re-run:
  - [index 3] (root): key "email"
```

This gate runs strictly before schema validation, so the message a mentor
sees is unambiguously "you have personal data in this file, remove it" --
never a generic "unrecognized key" schema error that could be mistaken for
an ordinary typo (a denylisted key like `email` would also fail
`learningRecordSchema`'s `.strict()` mode, since it is not a recognised
field, but that is not the error this command reports for it).

### Invalid records

If the privacy gate passes but one or more records fail
`learningRecordSchema` (or, for `.jsonl` input, one or more lines are not
valid JSON at all), the command refuses to process the file and reports
**every** failing record index at once (not just the first) -- the same
"report every invalid index" discipline `parseLearningRecords`
(`src/domain/learning-record.ts`) already uses for #15's batch parsing.

### Grouping: a documented current limitation

`buildKpiReport` (`src/domain/report.ts`) supports grouping the report by
topic or by §4 week number, but only when given a `resolveTopic`/
`resolveWeek` function -- a `LearningRecord` carries a `problemId` and a
`recordedAt` timestamp, but no topic-family id and no week number of its
own (see that module's docblock for the full reasoning). **This repository
ships no `problemId` -> topic-family registry and no timestamp -> §4-week
registry** -- there is no `data/*.json` file mapping specific problem ids
to topic families, and mapping a timestamp to a week number needs a
cohort's own start date and excluded-days list (`src/domain/cohort-plan.ts`),
which `osn report` has no flag to supply.

Consequently, **`--by topic` and `--by week` currently always fail** with
an actionable usage error (exit `2`) explaining exactly this, and `--by
none` (the default) is the only grouping that works via the CLI today.
`buildKpiReport` itself is fully generic over any caller-supplied resolver
-- a future CLI enhancement (or a programmatic caller in the same process)
that does have a real topic/week mapping can pass `resolveTopic`/
`resolveWeek` and get real per-group sections without any change to
`src/domain/report.ts`.

### Report contents

Regardless of `--by`, every report contains:

- **The seven §6.3 KPI metrics** (`src/domain/kpi.ts`), computed over the
  whole input (the `overall` section) and, when grouping succeeds, again
  per group. Each metric is reported as either its computed value or an
  explicit `"insufficient data: <reason>"` -- never coerced to a bare `0`
  (see `src/domain/kpi.ts`'s "no NaN/Infinity, ever" contract).
- **A postmortem section** (§13.1 step 4): counts and shares of the five
  error-taxonomy classes (`conceptual`, `modeling`, `complexity`,
  `implementation`, `debugging`) across every record that carries a
  non-null `errorTaxonomy`. All five classes are always listed, even one
  nobody hit in that batch (`count: 0`).
- **A scheduled re-solves section** (§13.1 step 5): every record whose
  `status` is `B` or `C`, paired with the §6.2 3-7 day re-solve window
  `resolveSchedule` (`src/domain/assessment.ts`) computes from that
  record's own `recordedAt` -- sorted by that window's earliest date. This
  reports each entry's due *window* only, never an "is it overdue right
  now" boolean computed against the current wall-clock time (that would
  make the report non-deterministic; a record's own `resolveStatus` field
  is already the authoritative source for whether a re-solve is still
  outstanding).

### Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success. |
| `1` | Invalid input: one or more records failed schema validation (every failing index listed), or a privacy refusal (see above). Both cases exit `1`; a privacy refusal is distinguished by its message (always starting `"osn report: privacy refusal:"`), never by a different exit code -- see `src/cli/commands/report.ts`'s docblock for why this repository did not add a fourth exit code just for this one case. |
| `2` | Usage error: `--records` missing, the given path cannot be read, an unknown `--by`, an unknown `--format`, `--by topic`/`--by week` (see "Grouping" above), or `--out` already exists without `--force`. |

### Example

```text
$ osn report --records data/samples/learning-records.sample.jsonl
# osn report: mentor KPI dashboard

Generated from 58 learning record(s), grouped by "none".
§6.3 caveat: every metric below must be read alongside "Jumlah soal bukan satu-satunya KPI; mastery dan transfer lebih penting."

## overall (58 record(s))

#### A/B/C/D per topic

_Mengukur independensi dan dependency pada bantuan._

Total records: 58

| Topic | Total | A | B | C | D |
| --- | --- | --- | --- | --- | --- |
| unresolved | 58 | 30 (51.7%) | 12 (20.7%) | 10 (17.2%) | 6 (10.3%) |
...
```

(The `A/B/C/D per topic` metric shows one `unresolved` bucket here because
no `--by topic`-style `resolveTopic` was supplied for this run -- see
"Grouping" above; every record still counts, per `statusDistributionByTopic`'s
own "never silently drop a record" contract in `src/domain/kpi.ts`.)

### Sample data

`data/samples/learning-records.sample.jsonl` (see
`data/samples/README.md`) is a committed, clearly-synthetic sample dataset
-- fake pseudonymous learners (`lr_demo0001`-`lr_demo0010`), fake problem
ids (`demo-problem-001`-`demo-problem-015`), no real learner data of any
kind (ADR-0004). It exists so this command (and its tests) have real input
to run against without this repository ever holding real learner data;
**it must never be replaced with real cohort data.**

## `osn privacy-check`

A CI-checkable governance control (issue #23, GR-04): recursively scans
every `.json`/`.jsonl` file under `data/` — including nested directories
such as `data/samples/` — for object keys shaped like a direct or
indirect personal identifier, at any nesting depth. This promotes the ad
hoc scan `tests/unit/learning-record.test.ts` already ran (top-level
`data/*.json` only) to a first-class subcommand, per ADR-0004's "Decision
detail: enforcement mechanism".

```sh
osn privacy-check [options]
```

The actual scanning logic (`scanEntriesForDirectIdentifiers`) lives in
`src/domain/privacy-scan.ts` as a pure function over an injected entry
list — `osn privacy-check` itself (`src/cli/commands/privacy-check.ts`)
is only the recursive directory read (`src/cli/privacy-scan-loader.ts`)
plus the two renderers in `src/cli/format-privacy-check.ts`, exactly the
same split `osn validate` uses around `auditCorpus`.

### What it checks

Every object key found anywhere in the parsed contents of every
`.json`/`.jsonl` file under the scanned directory is compared against
`DIRECT_IDENTIFIER_DENYLIST` (`src/schema/learning-record.ts`): `name`,
`nama`, `email`, `phone`, `telepon`, `nik`, `nisn`, `school`, `sekolah`,
`address`, `alamat`, `birthdate`, `tanggallahir`, `dob`, `photo`, `foto`,
`ip`, `ipaddress` — case-insensitively, matching camelCase/snake_case/
kebab-case word boundaries, never a substring (see `isDenylistedKey`'s
docblock).

**Tolerance rule:** the key `name` is permitted everywhere under `data/`,
because this repository's pre-existing curriculum corpus (topic
families, competition stages, curriculum categories, ...) legitimately
carries a `name` field for a *curriculum entity's* printed name (e.g.
`{ "id": "osn-k", "name": "OSN-K" }` in `data/competition-stages.json`),
never a person's name. Every other denylisted term is zero-tolerance: a
single occurrence anywhere under `data/` is reported. See
`docs/governance/privacy.md`'s "Must-not-collect list" section for the
full rationale, and `TOLERATED_KEY` in `src/domain/privacy-scan.ts` for
the enforcement.

A file that is not valid JSON (or a `.jsonl` line that is not valid JSON)
is skipped and reported separately as a `parseIssues` entry — this is
`osn validate`'s concern (schema/JSON conformance), not this control's;
one malformed file never prevents every other file from being scanned,
and a parse issue never affects this command's exit code.

### Options

| Flag | Meaning |
| --- | --- |
| `--json` | Emit `{ ok, findings, parseIssues, summary }` instead of grouped text. |
| `--data-dir <path>` | Scan a different directory instead of the repository's real `data/` (primarily for testing against a fixture directory). |
| `-h`, `--help` | Show `osn privacy-check`'s own help. |

### Finding shape: never the value

Every finding carries exactly three fields: `file` (or, for a `.jsonl`
file, `"<file>:<line>"`), `path` (the dot-separated in-file path to the
offending key's parent, or `"(root)"`), and `key` (the offending key
itself) — **never the value found there**, matching `osn report`'s
privacy-gate refusal pattern (`src/cli/commands/report.ts`'s docblock): a
real identifier accidentally committed must never be echoed back into a
terminal, a CI log, or a `--json` payload.

### Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Clean — no direct-identifier-shaped key found (beyond the `name` tolerance). |
| `1` | One or more direct-identifier-shaped keys found. |
| `2` | Usage error: an unrecognised flag/argument, `--data-dir` given with no path, or the given directory cannot be read. |

### Example: clean corpus

```text
$ osn privacy-check
osn privacy-check: scanning /path/to/repo/data
OK -- 19 file(s) scanned, 0 direct-identifier-shaped key(s) found.
```

### Example: a planted identifier (illustrative)

```text
$ osn privacy-check --data-dir ./fixture-with-a-mistake
osn privacy-check: scanning ./fixture-with-a-mistake
FAILED -- 1 direct-identifier-shaped key(s) found in 3 file(s) scanned. Values are never shown -- only file, path, and key:

samples/learning-records.sample.jsonl:12:
  - (root): key "email"
```

### CI

`osn privacy-check` runs in CI (`.github/workflows/ci.yml`, the "Privacy
check" step) immediately after `osn validate`, on every push and pull
request, via `bun run privacy-check`.

## Planned commands (not yet implemented)

The following subcommands are named in `docs/architecture/README.md` and
scoped by their own issues, but do not exist yet -- `osn <name>` for any of
them today is simply an unknown command (exit `2`):

| Command | Issue | Purpose |
| --- | --- | --- |
| `osn checklist` | [#25](https://github.com/ahliweb/osn/issues/25) | Generates an operational checklist artefact. |

Each will be added as a new `src/cli/commands/<name>.ts` module registered
in `src/cli/commands/index.ts`, per "Command dispatch and how new commands
are added" above -- no change to the dispatcher itself.
