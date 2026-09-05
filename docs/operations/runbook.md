# Operational runbook

Status: internal operating procedure. Issue
[#25](https://github.com/ahliweb/osn/issues/25). Describes how a mentor
team actually runs a cohort against the tooling this repository provides
-- it does not introduce any new rule of its own; every step below points
back to the syllabus section and the `osn` command that implements it.

**This repository operates no live platform.** It ships the curriculum
corpus, the CLI, and the render pipeline a downstream platform (LMS,
contest judge, mentor dashboard) uses to run a cohort. This runbook is
written for the people who actually run a cohort with those tools --
"Mentor lead" and "Mentor" below name **roles**, not individuals, exactly
as `docs/governance/incident-response.md` names its own roles.

## 1. Cohort start procedure

Run once, before Week 1 of a new cohort, in this order:

1. **Confirm the corpus is valid and clean.**

   ```sh
   osn validate
   osn privacy-check
   ```

   Both must exit `0` before anything else proceeds -- `osn validate`
   confirms the corpus itself (every `data/*.json` file, including
   `data/readiness-checklist.json`, `data/operational-rules.json`, and
   `data/syllabus-check-log.json`) is schema-valid and structurally sound
   (§19's whole-corpus audit); `osn privacy-check` confirms no
   direct-identifier-shaped key has crept into `data/` (ADR-0004, GR-04).

2. **Run the syllabus check** (§14.2 rule 8), if it has not already been
   run for this cycle -- see `docs/operations/syllabus-check.md` for the
   full procedure. `osn checklist`'s "Syllabus-check status" line reports
   how many days it has been since the last recorded check; a check
   materially overdue for the upcoming cycle should be re-run before
   continuing.

3. **Render and work through the §14.1 cohort-readiness checklist:**

   ```sh
   osn checklist
   ```

   Confirms, for each of the eight §14.1 items, its verification method
   and the evidence a mentor lead should record once it is done (syllabus
   verified, calendar set, diagnostics run, students grouped by gap,
   problem bank curated, judge/dashboard/template/error-taxonomy in
   place, rubric/hint/upsolve/checkpoint policy set, data protection
   controls in place). Do not start Week 1 with any item unresolved.

4. **Generate the dated 28-week calendar** against the school calendar and
   any known selection dates:

   ```sh
   osn plan --start <cohort-start-date> --exclude <holiday-and-exam-dates> \
     --target-stage <osn-k|osn-p|osn-nasional|toki-ioi-extension>
   ```

   This is readiness item 2 ("Tetapkan kalender 28 minggu terhadap jadwal
   sekolah dan seleksi") made concrete -- review the generated calendar
   (and any schedule-slip warning) against the real school and selection
   dates before treating that item as done.

5. **Confirm the §14.2 operational rules and mentor quick-pointer are
   understood by every mentor** -- `osn checklist`'s "Operational rules"
   and "Mentor quick pointer" sections are the canonical, machine-checked
   copy of §14.2; a mentor onboarding to a new cohort should read them
   from `osn checklist`, not from a possibly-stale printed handout.

Only once every §14.1 item is confirmed does the cohort's Week 1 begin.

## 2. The weekly cycle

Every week of the 28-week programme (§4), for each of the two §5.1
mentor sessions:

1. **Render that week's plan** before the session:

   ```sh
   osn render weekly --week <1-28>
   ```

   Gives the mentor the week's focus, content, learning outcome, the
   curated problem-load target, both §5.1 120-minute session templates,
   the exit-ticket instruction, the §5.2 seven-step SOP reminder, the §5.3
   hint policy ladder, and -- on a gate week -- the §4.1 gate evidence
   required to proceed.

2. **Run the session** following the SOP reminder and hint ladder exactly
   as rendered -- per §13's Mentor Calibration control, every mentor uses
   the same rubric and hint policy, so the rendered plan (not a mentor's
   own variation) is the source of truth for the session.

3. **On a checkpoint week** (one of the seven §4.1 gate weeks), also
   render the checkpoint sheet:

   ```sh
   osn render checkpoint --number <1-7>
   ```

   Confirms the gate evidence required to proceed, the §6.1 rubric
   weights, the §6.2 A/B/C/D recording grid, and the §6.3 KPI snapshot
   fields -- a learner does not advance past the gate without the stated
   evidence, per §4.1.

4. **Record learning records** for the week's attempts (§15 shape) as
   they happen, ready for the next KPI report.

## 3. The contest -> postmortem -> upsolve loop (§13.1 steps 3-5)

Every contest (a mini-contest inside a week, or a full OSN-K/OSN-P/OSN
Nasional simulation), run this three-step loop before moving on:

1. **Contest** (§13.1 step 3): capture score, attempt process, and time
   allocation for every learner -- this is what a learning record's
   `attempt`/`verdict`/timing fields exist to hold.

2. **Postmortem** (§13.1 step 4): every contest is **mandatory**
   postmortem and upsolve, per §14.2 rule 6 ("Setiap contest wajib
   postmortem dan upsolve") -- classify every wrong/incomplete attempt
   into the conceptual/modeling/complexity/implementation/debugging error
   taxonomy. Once learning records for the contest are recorded:

   ```sh
   osn report --records <path-to-learning-records>
   ```

   Produces the §13.1 step-4 postmortem error-taxonomy breakdown (counts
   and shares of all five error classes) alongside the seven §6.3 KPI
   metrics -- read this before deciding what each learner needs to
   upsolve, not just whether they passed.

3. **Upsolve** (§13.1 step 5): every status-B/C attempt gets a scheduled,
   hint-free re-solve. `osn report`'s output also lists every such
   scheduled re-solve, with its §6.2 3-7 day window -- work through this
   list before the window closes, not only when a learner happens to ask.

Per §14.2 rule 7 ("Jumlah soal bukan satu-satunya KPI; mastery dan
transfer lebih penting"), read `osn report`'s KPI section as a mastery/
transfer signal, not a raw solved-count leaderboard -- the §6.3 caveat
line every report prints is a standing reminder of this, not
boilerplate.

## 4. Monthly review (§13.1 step 6)

Once a month (or at another cadence a specific cohort's calendar
requires), the Mentor Calibration and Quality Review roles (below) jointly:

1. **Re-run `osn report`** over the month's accumulated learning records
   and review the KPI trend, not just the latest week's snapshot.
2. **Revise the learning plan and readiness** per learner or per group,
   per §13.1 step 6 ("Monthly review -> revisi learning plan dan
   readiness") -- re-run the gap-based grouping (readiness item 4) if a
   learner's profile has materially changed.
3. **Sample-review mentor sessions** against the same rubric and hint
   policy every mentor is expected to use (§13's Mentor Calibration row:
   "lakukan sample review berkala") -- confirm the SOP and hint ladder
   were actually followed as rendered, not only that a session happened.
4. **Audit a sample of the problem bank** actually used that month against
   §13's Quality Review row ("Audit problem statement, solution,
   generator/test data, dan pedagogical fit sebelum digunakan") -- this is
   the standing caveat every `buildBlueprint` output already carries (a
   blueprint specifies the shape of a bank, not a substitute for this
   audit).
5. **Re-check whether a syllabus check is due** for the next cycle -- see
   `docs/operations/syllabus-check.md`.

## §13 governance roles

§13's "Tata Kelola Implementasi AhliKoding.com" table names these bodies.
Named as **roles**, exactly as `docs/governance/incident-response.md`
names its own roles -- a specific downstream platform assigns real people
to them; this repository does not.

| Role | §13 responsibility | Where it shows up in this runbook |
| --- | --- | --- |
| **Curriculum Board** | "Minimal mentor CP/algoritma, reviewer pedagogi, dan validator syllabus resmi." Owns the syllabus corpus itself: approves any change the syllabus check (§14.2 rule 8) surfaces, and is the validator a `curriculum-change` issue is routed to. | §1 step 2 (syllabus check), and every `curriculum-change` issue `docs/operations/syllabus-check.md` describes. |
| **Quality Review** | "Audit problem statement, solution, generator/test data, dan pedagogical fit sebelum digunakan." Owns the problem-bank audit -- the standing caveat on every `buildBlueprint` output, and §4's monthly-review problem-bank audit. | §1 step 3 (readiness item 5, problem bank), §4 step 4 (monthly problem-bank audit). |
| **Mentor Calibration** | "Semua mentor menggunakan rubrik dan hint policy yang sama; lakukan sample review berkala." Owns keeping every mentor's rubric and hint policy identical (readiness item 7), and the periodic sample review of mentor sessions. | §1 step 5 (readiness item 7), §4 step 3 (monthly sample review). |

These three roles are distinct from -- and, for a specific incident,
complement -- the incident-response roles in
`docs/governance/incident-response.md` (e.g. that document's "Curriculum
Board liaison", engaged specifically for a contest-integrity incident).

## Related documents

- [`docs/operations/syllabus-check.md`](syllabus-check.md) -- the full
  §14.2 rule 8 syllabus-check procedure this runbook's cohort-start step 2
  and monthly-review step 5 point to.
- [`docs/development/releasing.md`](../development/releasing.md) -- how a
  syllabus check that detects a change flows into a `curriculum-change`
  issue, a changeset, and a `CHANGELOG.md` entry.
- [`docs/cli/README.md`](../cli/README.md) -- full reference for every
  `osn` subcommand this runbook uses (`checklist`, `plan`, `render`,
  `report`, `validate`, `privacy-check`).
- [`docs/governance/incident-response.md`](../governance/incident-response.md)
  -- the incident-response roles and procedure, for anything this runbook
  does not cover (a security or privacy incident, rather than routine
  cohort operation).
