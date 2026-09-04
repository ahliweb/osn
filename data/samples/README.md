# `data/samples/` -- synthetic sample data only

**Everything under this directory is synthetic.** It represents no real
learner, no real school, and no real cohort. It exists solely so that
`osn report` (issue #22) has committed input to document and test against,
without this repository ever holding real learner data.

This is not a special exemption from this repository's privacy rules --
it is the same rule applied to fixture data instead of production data.
See:

- **ADR-0004** (`docs/architecture/adr/0004-no-learner-personal-data.md`):
  "No learner personal data in the repository." This repository stores no
  learner personal data anywhere, including here. A learner is identified
  only by an opaque pseudonymous `learnerRef`
  (`src/schema/learning-record.ts`'s `lr_[a-z0-9]{8,32}` pattern), never a
  name or other direct identifier.
- **`docs/architecture/data-classification.md`**: the field-by-field
  privacy classification for the Learning Record schema. Every field in
  every file here is, at most, `internal` (see that document's
  classification vocabulary) -- never `personal`.

## What's here

| File | Contents |
| --- | --- |
| `learning-records.sample.jsonl` | ~58 synthetic learning records (one JSON object per line), across 10 fake learners (`lr_demo0001`-`lr_demo0010`) and 15 fake problems (`demo-problem-001`-`demo-problem-015`), covering every verdict, every §6.2 A/B/C/D status, every re-solve state, every hint level (including no hint), and every §13.1 step-4 error-taxonomy class at least once -- enough variety to exercise all seven §6.3 KPI metrics computed by `osn report` (issue #22) meaningfully, not just avoid a crash. |

Every record in `learning-records.sample.jsonl` passes
`parseLearningRecord`/`parseLearningRecords`
(`src/domain/learning-record.ts`) and contains zero keys matching
`DIRECT_IDENTIFIER_DENYLIST` (`src/schema/learning-record.ts`) -- both
facts are asserted by `tests/unit/report.test.ts` and
`tests/integration/cli-report.test.ts`, alongside the same whole-`data/`-
directory denylist scan `tests/unit/learning-record.test.ts` already runs.

## Rules for this directory

- **Never replace this file with real cohort data.** If a downstream
  platform or a mentor ever wants to run `osn report` against real
  learners' data, that data lives in that platform's own storage, under
  its own access control -- it is never committed to this repository, in
  `data/samples/` or anywhere else. This directory's purpose is
  documentation and tests, permanently, not a staging area for real data
  "just this once."
- **Every `learnerRef` here must stay an obviously synthetic pseudonym**
  (the `lr_demoNNNN` style already used), and every problem id an
  obviously synthetic slug (`demo-problem-NNN`). Do not rename these to
  anything that could be mistaken for a real identifier.
- Adding more synthetic sample data here is fine (e.g. a `.json`-array
  variant, or a larger dataset for a specific test) as long as it follows
  the same rules and is validated the same way before being committed.

## Why this doesn't confuse `osn validate`

`osn validate` (issue #19) scans `data/*.json` (the top-level curriculum
corpus files only -- see `src/cli/corpus-loader.ts`'s `loadCorpusFromDirectory`,
which reads only files directly under `data/`, non-recursively) against a
fixed file-name -> schema registry (`DATA_FILE_REGISTRY` in
`src/domain/corpus-audit.ts`). Files under this subdirectory are outside
that scan for two independent reasons, either of which alone would be
enough: they live one level down (`data/samples/`, not `data/`), and
`learning-records.sample.jsonl` does not even have a `.json` extension.
`osn validate` therefore never flags anything in this directory as an
unregistered data file, and nothing here needed to be (or should be)
added to `DATA_FILE_REGISTRY`.
