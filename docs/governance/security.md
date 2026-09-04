# Security policy and ISO/IEC control mapping

Status: internal control document. Issue [#24](https://github.com/ahliweb/osn/issues/24).

**This repository is not certified to any ISO/IEC standard named below, and
nothing in this document is a claim of compliance or certification.** §11
of the operational syllabus (`docs/silabus/11-pemetaan-iso.md`) states
plainly that its fourteen standards "relevan untuk tata kelola organisasi
dan platform pembinaan, bukan materi ujian OSN" — they govern the
**organisation and platform**, never the OSN exam material itself. This
document *maps* the controls those standards describe onto (a) what this
repository itself already does, and (b) what a downstream platform (an
LMS, a contest judge, a mentor dashboard) implementing the OSN Informatika
2026 programme must establish. Mapping a control onto a standard is not
the same thing as being certified against that standard, and this
document does not claim the latter anywhere.

See also: [`SECURITY.md`](../../SECURITY.md) (vulnerability reporting),
[`docs/governance/privacy.md`](privacy.md) (the privacy policy for
minors' data, issue #23 — this document cross-links it rather than
duplicating it), and
[ADR-0004](../architecture/adr/0004-no-learner-personal-data.md).

## Plain-language summary

This repository is a curriculum specification with no production
deployment, no database, and no authenticated users. It cannot itself
suffer a data breach because it holds no data to breach (see
`docs/governance/privacy.md`, "Scope"). What it *can* do — and what this
document does — is (1) apply the security practices that are actually
within its own control (least-privilege CI, no secrets, an automated
privacy scan) and document that it does so, and (2) write down, in
concrete and checkable terms, what any platform built on top of this
curriculum must do to keep the ISO/IEC controls §11 names, and the six
§13 "Privacy & Security" controls, from being empty adjectives.

---

## The six §13 controls, expanded

§13 (`docs/silabus/13-tata-kelola.md`, "Privacy & Security" row) states
six controls in one cell: "Least privilege, data minimization, secure
auth, logging, backup, incident procedure." Each is expanded below into
**implementable statements** — what must actually be built or configured,
not a restatement of the adjective. Each statement is labelled:

- **[This repository]** — a control this repository itself implements
  today, with the file that implements it.
- **[Downstream platform]** — a requirement on whatever platform
  processes real learner/contest/judge data; this repository cannot
  implement or verify these on the platform's behalf.

### 1. Least privilege

- **[This repository]** The CI workflow (`.github/workflows/ci.yml`) sets
  a top-level `permissions: { contents: read }` block and grants no
  broader permission (`contents: write`, `pull-requests: write`,
  `packages: write`) anywhere in the workflow — see
  `docs/development/ci-cd.md`, "Least-privilege permissions". A future
  job that genuinely needs to write (e.g. publishing a release) must
  scope that permission to that specific job, not the whole workflow.
- **[This repository]** `.github/CODEOWNERS` designates `@ahliweb` as the
  owner of the entire tree. Combined with this repository's GitHub
  branch-protection configuration (a repository setting, not a file this
  repository's tracked source controls), this lets merges to `main`
  require an owning reviewer's approval rather than any contributor's.
- **[Downstream platform]** Implement the four-role, least-privilege
  access matrix `docs/governance/privacy.md` ("Role-based access")
  already defines in full — Learner / Mentor / Curriculum board /
  Administrator, each scoped to `read all` / `read own` / `read cohort` /
  `read aggregate` / `none` per data class. This document does not
  restate that table; it is the authoritative source.
- **[Downstream platform]** No role should hold standing, unscoped
  access to `internal` or `personal` data (per the same table); any
  broader access (e.g. an administrator investigating an incident) must
  be a narrow, individually-justified, logged exception — never a
  standing grant.
- **[Downstream platform]** Service accounts, API keys, and CI/CD
  credentials used by the platform's own infrastructure must each be
  scoped to the minimum set of operations they need (e.g. a judge
  worker's credential should not also have access to the learner-account
  database), mirroring the same principle this repository applies to its
  own CI token above.

### 2. Data minimisation

- **[This repository]** The learning-record schema
  (`src/schema/learning-record.ts`) is `.strict()` and rejects any field
  shaped like a direct personal identifier (`DIRECT_IDENTIFIER_DENYLIST`)
  — see ADR-0004, "Decision detail: enforcement mechanism".
- **[This repository]** `osn privacy-check` (`src/cli/commands/privacy-
  check.ts`, run in CI immediately after `osn validate` per
  `.github/workflows/ci.yml`) recursively scans every file under `data/`
  (including `data/samples/*.jsonl`) for the same denylisted keys and
  fails the build if any are found. See `docs/governance/privacy.md`,
  "The automated check: `osn privacy-check`".
- **[This repository]** This repository holds **no real learner data at
  all** (ADR-0004) — the strongest form of data minimisation available to
  it is holding none.
- **[Downstream platform]** Store no more than the minimum viable
  learning-record field set `docs/governance/privacy.md` ("Data
  minimisation") defines, and apply its must-not-collect list to every
  data store the platform operates, not only to files shaped like this
  repository's `data/` directory.
- **[Downstream platform]** Never merge `internal` (behavioural) data
  with `personal` (identifying) data into one queryable record — keep the
  join, if one is ever operationally necessary, behind its own logged,
  narrowly-scoped access path (per "Least privilege" above).

### 3. Secure authentication

- **[This repository]** This repository has no runtime and authenticates
  no one; there is no login surface to secure. The applicable control at
  this repository's own level is over the humans who can push to it:
  maintainers with write access to this repository's GitHub organisation
  should enable two-factor authentication on their GitHub account — a
  GitHub account/organisation setting, not something this repository's
  tracked files can enforce or verify.
- **[Downstream platform]** Implement the account-security requirement
  `docs/governance/privacy.md` ("Account security") already states at
  policy level, made concrete here:
  - Store no password in plaintext or in a reversibly-encrypted form;
    use a vetted, purpose-built password-hashing algorithm (e.g. Argon2
    or bcrypt with an appropriate work factor).
  - Enforce multi-factor authentication for the Mentor, Curriculum board,
    and Administrator roles at minimum (per `docs/governance/privacy.md`,
    "Account security" — these roles' compromise exposes more than one
    learner's data at once); MFA for the Learner role is recommended but,
    given the learner population is minors who may share devices with a
    parent/guardian, the specific mechanism should be chosen with that
    context in mind.
  - Expire sessions after a defined inactivity window, and invalidate all
    active sessions on a password/credential change.
  - Rate-limit and monitor authentication attempts; lock out or alert on
    repeated failures against a single account.
  - Never transmit a credential or session token over an unencrypted
    channel (TLS everywhere the platform accepts a login or session
    cookie).

### 4. Logging

- **[This repository]** Where this repository's own tooling reports a
  finding about sensitive-shaped data, it names the file, path, and key —
  **never the value** — per `osn report`'s privacy-gate refusal
  (`src/cli/commands/report.ts`) and `osn privacy-check`'s findings
  format (`src/cli/format-privacy-check.ts`); see
  `docs/governance/privacy.md`, "Access logging" for the discipline this
  generalises from.
- **[This repository]** CI build logs (`.github/workflows/ci.yml` runs)
  contain no secrets, because none are configured for this workflow — no
  step in `ci.yml` reads a repository secret, so there is nothing
  sensitive in this repository's own logs to leak.
- **[Downstream platform]** Implement the access-logging requirement
  `docs/governance/privacy.md` ("Access logging") already defines in
  full: log timestamp, actor role/identifier, action, and scope for
  every access to `internal`/`personal` data — never the accessed value
  itself. This document does not restate that section.
- **[Downstream platform]** Additionally, log **security events**
  distinct from learner-data access (authentication failures, privilege-
  escalation attempts, anomalous submission patterns to the judge) — a
  separate concern from the learner-data access log above, governed by
  ordinary information-security logging practice.
- **[Downstream platform]** Ship logs to storage the logging pipeline
  itself cannot retroactively modify or delete (write-once storage, or a
  centralised log aggregator with access separate from the systems being
  logged), so a compromised component cannot cover its own tracks.
  Retain per `docs/governance/privacy.md`'s recommended 12-month rolling
  window for learner-data access logs; a platform's own security-log
  retention may reasonably differ and should be set by its own risk
  assessment.

### 5. Backup

- **[This repository]** This repository's own "backup" is git itself:
  every commit is preserved in a distributed version-control history,
  mirrored on GitHub (`ahliweb/osn`) and in every contributor's local
  clone. There is no database or generated artefact in this repository
  that is not reproducible from source-controlled files (`dist/` is a
  build output of `bun run build`, not a store of anything unique).
- **[Downstream platform]** Maintain automated, regularly scheduled
  backups of every data store the platform operates — learner accounts,
  learning records, submission/judge data, consent records — covering the
  RPO/RTO targets recommended in "Business continuity" below.
- **[Downstream platform]** Test restoration, not only backup creation: a
  backup that has never been restored is unverified. Recommend a
  periodic restore drill (see "Business continuity" below for a
  recommended cadence).
- **[Downstream platform]** Apply the same retention and deletion
  discipline to backups that `docs/governance/privacy.md` ("Deletion
  procedure") requires of primary storage — a backup is not an exemption
  from a data-subject deletion request, even though execution against a
  backup is necessarily delayed until that backup's own rotation.

### 6. Incident procedure

- **[This repository]** `SECURITY.md` gives this repository's own
  vulnerability-reporting process. This document's "Risk register"
  below, and `docs/governance/incident-response.md`, are this
  repository's contribution to the *downstream* platform's incident
  procedure — a template it can adopt rather than invent from scratch.
- **[Downstream platform]** Adopt an incident-response procedure at least
  as detailed as `docs/governance/incident-response.md` — severity
  levels, named roles, a per-severity response timeline, communication
  expectations (including the UU 27/2022 personal-data-breach escalation
  duty), and a post-incident review step. This document does not restate
  that procedure; see the linked document for the full detail.

---

## Control mapping table

Each §13 control, mapped to the ISO/IEC standard(s) whose clause area it
draws on, using the ids and citations from `data/standards.json`
(`R23`–`R29`). This table maps controls onto standards; it does not
assert this repository or any platform is certified against any of them.

| §13 control | Standard(s) | `data/standards.json` id | Citation | Why this standard applies |
| --- | --- | --- | --- | --- |
| Least privilege | ISO/IEC 27002:2022 (Security controls) | `iso-27002-2022` | `R24` | 27002's access-control clause area is the direct source for a least-privilege access model. |
| Least privilege | ISO/IEC 27001:2022 (ISMS) | `iso-27001-2022` | `R23` | 27001 requires a risk-based ISMS that access control operates inside of — least privilege is a control the ISMS's risk treatment plan selects. |
| Least privilege | ISO/IEC 27017:2026 (Cloud security) | `iso-27017-2026` | `R26` | Extends the access-control baseline to a shared-responsibility cloud deployment (LMS/judge hosting). |
| Data minimisation | ISO/IEC 27018:2025 (PII in public cloud) | `iso-27018-2025` | `R27` | 27018 specifically governs minimising and protecting PII processed in a public-cloud service. |
| Data minimisation | ISO/IEC 27701:2025 (Privacy information management) | `iso-27701-2025` | `R28` | 27701's PIMS extends an ISMS with privacy-specific controls, of which data minimisation is a core principle. |
| Data minimisation | ISO/IEC 27005:2022 (Security risk management) | `iso-27005-2022` | `R25` | The risk register below (informed by 27005's risk-management process) is what justifies which fields are minimised and why. |
| Secure authentication | ISO/IEC 27002:2022 (Security controls) | `iso-27002-2022` | `R24` | 27002's access-control clause area covers authentication mechanisms directly. |
| Secure authentication | ISO/IEC 27034-1:2011 (Application security) | `iso-27034-1-2011` | `R29` | 27034-1's secure-application-lifecycle model is where authentication design gets built in from the start, not bolted on. |
| Logging | ISO/IEC 27002:2022 (Security controls) | `iso-27002-2022` | `R24` | 27002's logging/monitoring clause area is the direct source. |
| Logging | ISO/IEC 27001:2022 (ISMS) | `iso-27001-2022` | `R23` | Logging feeds the ISMS's monitoring and continual-improvement cycle. |
| Backup | ISO/IEC 27002:2022 (Security controls) | `iso-27002-2022` | `R24` | 27002's operations-security clause area covers backup as a security control. |
| Backup | ISO 22301:2019 (Business continuity) | — (see "Business continuity" below) | `R31` | Backup/restore is also a business-continuity concern, detailed in its own section below rather than duplicated here. |
| Incident procedure | ISO/IEC 27001:2022 (ISMS) | `iso-27001-2022` | `R23` | Incident management is a mandatory ISMS process. |
| Incident procedure | ISO/IEC 27002:2022 (Security controls) | `iso-27002-2022` | `R24` | 27002's incident-management clause area gives the concrete control detail. |
| Incident procedure | ISO/IEC 27005:2022 (Security risk management) | `iso-27005-2022` | `R25` | The risk register below is the input that determines which scenarios the incident procedure must be ready for. |

---

## Service management (ISO/IEC 20000-1) and business continuity (ISO 22301)

### Service management — ISO/IEC 20000-1:2018 (`R30`)

This repository operates no live service, so ISO/IEC 20000-1's IT
service-management scope applies entirely to the **downstream platform**
(support, incident, request, change, service quality — per
`data/standards.json`'s application text for `iso-20000-1-2018`).
Implementable statements for that platform:

- **Change management**: every production change goes through a defined
  process with a review gate before deployment — this repository's own
  PR/CI workflow (below, "Software lifecycle governance") is offered as
  a concrete pattern the platform's change-management process can mirror
  for its own codebase, even though 20000-1 governs the *service*, not
  only the code behind it.
- **Incident and request management**: distinct queues and SLAs for "the
  service is broken" (incident) versus "I need something the service
  doesn't currently do for me" (request) — e.g. a judge outage is an
  incident; a mentor asking for an additional cohort report is a
  request.
- **Service quality objectives**: defined, monitored service-level
  objectives (e.g. judge submission turnaround time, LMS page-load
  latency, uptime during a contest window) that are reviewed
  periodically, not set once and forgotten.

### Business continuity — ISO 22301:2019 (`R31`)

This repository's own continuity need is minimal — it is a git
repository mirrored on GitHub and in every clone; there is no single
point of failure this document needs to plan around at the repository
level. The requirement below is entirely for the **downstream platform**
operating the contest, judge, and LMS systems.

**RPO/RTO recommendations.** The source syllabus (§11, §13) requires
"Continuity untuk contest/judge/LMS dan backup/restore" but specifies no
numeric target. The figures below are **recommendations this document
makes**, not values fixed by any cited standard or regulation; a
platform's own capacity and risk analysis should confirm or adjust every
figure before relying on it operationally.

| System | Recommended RTO (time to restore) | Recommended RPO (max acceptable data loss) | Justification |
| --- | --- | --- | --- |
| Contest judge, during an active timed contest window | ≤ 15 minutes | ≤ 1 minute (near-zero submission loss) | OSN-K/OSN-P contests are time-boxed (typically a few hours); a 15-minute outage is already a meaningful fraction of contest time and could force a rescore or extra-time decision. Submission loss during a live contest is not recoverable by re-attempting — a contestant cannot redo a lost submission under the same time pressure — so RPO is held far tighter than RTO. **Recommendation, not a fixed target.** |
| Contest judge, outside a contest window (practice/upsolve) | ≤ 4 hours | ≤ 1 hour | Practice submissions are valuable but not time-critical the way a live contest is; a shorter window than the LMS below reflects that judge submissions are still comparatively expensive for a learner to redo (rewriting and resubmitting code). **Recommendation, not a fixed target.** |
| LMS / learning-record store (day-to-day) | ≤ 4 hours | ≤ 24 hours | Asynchronous learning content and behavioural data; losing up to a day's attempts is undesirable but recoverable (a learner can redo recent exercises), unlike a live contest submission. **Recommendation, not a fixed target.** |
| Curriculum/content store | ≤ 24 hours | ≤ 24 hours | Least time-critical: content is largely static and, for this repository specifically, already duplicated across every git clone and GitHub's own infrastructure — a downstream mirror can be rebuilt from source. **Recommendation, not a fixed target.** |

**Backup/restore practice** (recommendations, expanding "Backup" above):

- Automated backups on a schedule at least as frequent as the tightest
  RPO above for any system the backup covers.
- **Restore drills**: a recommended quarterly test restore of a recent
  backup into an isolated environment, verifying both that the restore
  succeeds and that the restored data is queryable/consistent — a backup
  that has never been restored is unverified.
- Backups stored with access controls at least as strict as the primary
  data they contain (a backup of `personal` data is itself `personal`
  data, not an exception to "Least privilege" above).
- A documented, rehearsed **failover/continuity plan** specifically for
  a contest-day outage, given the recommended 15-minute RTO above is far
  tighter than a routine incident response might otherwise target — this
  implies pre-provisioned standby capacity or a documented manual
  fallback (e.g. extending the contest window), decided and rehearsed
  before contest day, not improvised during an active incident.

---

## Software lifecycle governance — ISO/IEC/IEEE 12207:2026 (`R34`)

12207's application area, per `data/standards.json`, is "Governance
siklus pengembangan platform" (governance of the platform's development
lifecycle). This repository's **actual, current workflow** — not an
aspirational one — already implements a recognisable instance of that
governance, end to end:

1. **Issue** — work starts from a GitHub issue with acceptance criteria
   (`AGENTS.md`, "Atomic-issue workflow", step 1; this document itself
   implements issue [#24](https://github.com/ahliweb/osn/issues/24)).
2. **Branch** — a branch named `<type>/<short-slug>` per
   `CONTRIBUTING.md`, "Branch naming" (`feat/`, `fix/`, `docs/`,
   `chore/`).
3. **Atomic commit(s)** — Conventional Commits
   (`CONTRIBUTING.md`, "Commit convention"), each referencing the issue
   it addresses.
4. **Pull request** — opened against the existing template
   (`.github/pull_request_template.md`), scoped to one issue
   (`CONTRIBUTING.md`, "Pull requests": "Scope is atomic — one issue, no
   unrelated changes bundled in").
5. **CI gates** — `.github/workflows/ci.yml`'s `quality` job runs, in
   order, on every push and pull request:
   - `bun run format:check` (Biome formatting)
   - `bun run lint` (Biome lint)
   - `bun run typecheck` (`tsc --noEmit`)
   - `bun run test:coverage` (`bun test --coverage`, enforcing the 85%
     lines/functions gate in `bunfig.toml`)
   - `bun run build` (`bun build ./src/index.ts --outdir dist --target
     bun`)
   - `bun run validate` (`osn validate` — schema, structural invariant,
     and referential-integrity checks over the curriculum corpus)
   - `bun run privacy-check` (`osn privacy-check` — the data-minimisation
     control described above)

   See `docs/development/ci-cd.md` for the full description of why this
   order and why these gates.
6. **Review** — a reviewer checks the PR template's checklist against the
   actual diff (`CONTRIBUTING.md`, "Review expectations"), verifying (for
   curriculum content) that the required syllabus check was actually
   performed, not merely ticked.
7. **Merge** — only after CI passes and review is satisfied
   (`CONTRIBUTING.md`: "CI ... must pass before merge").
8. **Changeset** — a user-visible change carries a changeset
   (`docs/development/releasing.md`, "When a changeset is required"),
   written under `.changeset/` and consumed later by `bun run version`.
9. **Release** — `docs/development/releasing.md`'s release procedure:
   `bun run version` consumes accumulated changesets into
   `CHANGELOG.md` and bumps `package.json` `version`, followed by a
   verification pass, an annotated git tag, and a push — all described
   in that document, not restated here.

This is the concrete, file-referenced instance of 12207's lifecycle
governance requirement for **this repository's own development**. A
downstream platform's software lifecycle is a separate scope (its own
codebase, its own CI, its own release cadence) but can adopt the same
shape: issue-driven work, atomic commits, gated CI, reviewed merges,
changelog discipline.

---

## Product quality (ISO/IEC 25010) and accessibility (ISO/IEC 40500 / WCAG 2.2)

**Both standards in this section are requirements on any downstream
learning platform's user interface (LMS, judge UI, mentor dashboard) —
not on this repository, which has no user interface at all.** Stating
this plainly matters because it would be easy to misread a "quality" or
"accessibility" section in a repository's own governance docs as a claim
about the repository's own (nonexistent) UI.

### ISO/IEC 25010:2023 — Software product quality (`R33`)

`data/standards.json`'s application text: "Quality model untuk
usability, reliability, security, performance." A downstream platform
should evaluate its own product against 25010's quality-characteristic
model, including at minimum:

- **Functional suitability** — does the LMS/judge/dashboard actually do
  what the syllabus's pedagogical model (§5–§7, §13.1) requires?
- **Performance efficiency** — judge turnaround time under contest-day
  load, LMS responsiveness.
- **Compatibility** — the platform's own integration points (if any)
  with school systems, identity providers, or existing LMS
  infrastructure.
- **Usability** — appropriate for the actual user population (school-age
  minors, and the mentors/administrators who support them).
- **Reliability** — see "Business continuity" above for the
  availability/continuity dimension specifically.
- **Security** — see the control mapping above.
- **Maintainability** and **portability** — engineering-quality
  concerns for the platform's own codebase, distinct from this
  repository's.

### ISO/IEC 40500:2025 / WCAG 2.2 — Accessibility (`R35`)

`data/standards.json`'s application text: "Aksesibilitas platform
pembelajaran" (accessibility of the learning platform). A downstream
platform's learner-facing and mentor-facing interfaces should conform to
WCAG 2.2 at, at minimum, level AA — covering the four WCAG principles
(perceivable, operable, understandable, robust) — since the learner
population includes school-age minors of varying ability, and an
inaccessible platform is a direct barrier to the "inclusion" element
ISO 21001 (below) and this project's own broader educational-equity
intent require. This document does not audit any platform's actual
conformance (there is no platform to audit) — it states the requirement.

---

## Educational management alignment — ISO 21001:2025 (`R22`)

`data/standards.json`'s application text: "Learner-centered quality,
feedback, inclusion, continuous improvement." This is an
**organisation-level** standard (an educational organization management
system) — it applies to the organisation running the OSN Informatika
training programme (a school, AhliKoding.com/AhliWeb.com as curriculum
author, or whichever body operates the downstream platform), not to this
repository's software artefacts directly. This repository's contribution
to that alignment is structural, via §13's own governance components
(`docs/silabus/13-tata-kelola.md`):

- The **Curriculum Board** component (mentor CP/algoritma, pedagogy
  reviewer, official-syllabus validator) is the organisational body ISO
  21001 expects to own continuous curriculum improvement.
- The **Quality Review** and **Mentor Calibration** components
  (`docs/silabus/13-tata-kelola.md`) are the feedback and continuous-
  improvement mechanisms ISO 21001 asks an educational organisation to
  run.
- The **dual-versioning** and **syllabus-check** discipline
  (`docs/development/releasing.md`; §14.2 rule 8) is this repository's
  mechanism for keeping the curriculum a learner-centred, continuously
  reviewed artefact rather than a static one.

Full ISO 21001 alignment (e.g. a documented educational-organization
management system, learner/parent feedback channels, a formal continual-
improvement cycle at the organisational level) is the operating
organisation's responsibility, not something a curriculum-as-code
repository can implement on its own.

---

## Risk register

A risk register for this domain, informed by ISO/IEC 27005:2022's
(`R25`) risk-management process. Each row: id, description, likelihood,
impact, owner (a **role**, never a named individual), existing
mitigations (naming the real ones this repository or its process already
has), and residual risk after those mitigations.

| ID | Description | Likelihood | Impact | Owner (role) | Existing mitigations | Residual risk |
| --- | --- | --- | --- | --- | --- | --- |
| RISK-01 | Minors' personal data (name, contact, school, learning history) is exposed, whether through this repository or a downstream platform built on it. | Low (this repository holds none by design); Medium for a downstream platform once real data exists. | High — the affected population is entirely school-age minors. | Data Protection Officer / Platform administrator (downstream role; this repository has no equivalent runtime role) | ADR-0004 (no learner personal data held here); `osn privacy-check` CI gate; `DIRECT_IDENTIFIER_DENYLIST` schema guard; `docs/governance/privacy.md`'s role-based access, minimisation, and retention design. | This repository cannot verify a downstream platform actually implements the documented design at runtime — residual risk is the gap between documented policy and a specific platform's real implementation. |
| RISK-02 | A contest problem, expected solution, or test data leaks before its scheduled use, compromising contest integrity. | Medium — any problem-bank system with pre-release content is a target. | High — a leaked problem can invalidate a contest stage entirely. | Curriculum Board / Contest Operations Lead (role) | This repository's `data/` holds only problem-taxonomy **vocabulary** and curriculum structure (`data/problem-taxonomy-vocab.json`, `data/assessment-bank.json`), never live, unreleased contest problems or their solutions — there is nothing problem-specific here to leak. Role-based access design (`docs/governance/privacy.md`) restricts `internal`-class data to relevant roles. | A downstream platform's actual problem bank (which this repository does not define or hold) needs its own embargo/access-control mechanism for problems pending use; this repository has not defined one, since it is out of this repository's scope. |
| RISK-03 | The contest judge becomes unavailable during an active, timed contest window. | Medium — any single-instance or under-provisioned judge system is exposed to load spikes or infrastructure failure at exactly the worst time. | High — see the RTO/RPO justification above: lost contest time is not recoverable by re-attempting. | Judge/Infrastructure Operations (role) | The RPO/RTO recommendations and continuity-plan guidance in "Business continuity" above; the severity/response-timeline structure in `docs/governance/incident-response.md`. | This repository does not operate judge infrastructure; residual risk is entirely a function of the downstream platform's actual infrastructure choices, which this document can recommend targets for but not enforce. |
| RISK-04 | The curriculum drifts from the official OSN/IOI syllabus sources it claims to transcribe faithfully. | Medium — any manually-maintained transcription can drift from a source that itself changes over time. | Medium — reduces the curriculum's accuracy and trustworthiness, though it does not expose anyone's data or halt a live contest. | Curriculum Board (role) | The `curriculum-change` issue-template workflow requiring a recorded syllabus check (`.github/ISSUE_TEMPLATE/curriculum-change.yml`); the PR template's "Syllabus check" gate (§14.2 rule 8); dual versioning (`syllabusVersion`/`syllabusDate`) and changeset/CHANGELOG discipline (`docs/development/releasing.md`); `AGENTS.md`'s "Curriculum content fidelity" rule. | A syllabus check is reviewer-verified, not automated (`docs/development/releasing.md`: "CI does not currently enforce this automatically — it is a reviewer responsibility") — residual risk is a reviewer accepting an incomplete or unverified syllabus check. |
| RISK-05 | A compromised dependency (direct or transitive) or a compromised CI/tooling supply-chain component introduces malicious code or exfiltrates data. | Low–Medium — this repository has a minimal dependency footprint, but supply-chain compromise is a well-documented, industry-wide risk class. | High — a compromised build or CI step could affect every consumer of this repository. | Maintainer / Release Manager (role) | `bun install --frozen-lockfile` in CI (fails if `bun.lock` drifts from `package.json`); GitHub Actions pinned to major-version tags rather than floating refs (`docs/development/ci-cd.md`, "Action and tool pinning policy"); Bun pinned to an exact version; a minimal runtime dependency set (`zod` only; see `package.json`); least-privilege CI permissions (above) limiting the blast radius of a compromised action; automated weekly dependency and GitHub Actions update surveillance via `.github/dependabot.yml`. | Dependabot surfaces known-vulnerable and outdated dependencies, but it cannot detect a *novel* compromise of an otherwise-current package, and it opens pull requests rather than merging them — the residual risk is the review latency between an advisory being published and a maintainer merging the update. |
| RISK-06 | A downstream platform's user interface is inaccessible to learners with disabilities, excluding them from the programme. | Medium — accessibility is commonly deprioritised under delivery pressure. | Medium — direct exclusion of a subset of the learner population, though distinct from a security/data incident. | Platform Product Owner (role) | The explicit WCAG 2.2 / ISO 40500 requirement stated above. | This repository cannot audit any platform's actual UI for conformance — residual risk is entirely the downstream platform's implementation. |
| RISK-07 | This document, `docs/governance/privacy.md`, or `SECURITY.md` is cited or relied upon as a claim that this project (or a downstream platform) is *certified* to one of the standards it maps, when no certification exists. | Medium — a mapping document is easy to misquote as a compliance claim. | Medium — reputational and, if relied upon in a procurement or legal context, potentially material. | Maintainer (role) | The explicit "not certified" disclaimer repeated in this document, `docs/governance/privacy.md`, and `SECURITY.md`. | This repository cannot control how a third party chooses to cite or misrepresent these documents once published. |

---

## Every §11 standard, and its role in this document

All fourteen standards from `data/standards.json` (§11) appear above;
this table is a single-glance index of where.

| Standard | id | Citation | Where it appears above |
| --- | --- | --- | --- |
| ISO 21001:2025 | `iso-21001-2025` | `R22` | "Educational management alignment" |
| ISO/IEC 27001:2022 | `iso-27001-2022` | `R23` | Control mapping table (least privilege, logging, incident procedure) |
| ISO/IEC 27002:2022 | `iso-27002-2022` | `R24` | Control mapping table (all six controls draw on it) |
| ISO/IEC 27005:2022 | `iso-27005-2022` | `R25` | Control mapping table (data minimisation, incident procedure); "Risk register" header |
| ISO/IEC 27017:2026 | `iso-27017-2026` | `R26` | Control mapping table (least privilege — cloud) |
| ISO/IEC 27018:2025 | `iso-27018-2025` | `R27` | Control mapping table (data minimisation — PII in cloud) |
| ISO/IEC 27701:2025 | `iso-27701-2025` | `R28` | Control mapping table (data minimisation — privacy management) |
| ISO/IEC 27034-1:2011 | `iso-27034-1-2011` | `R29` | Control mapping table (secure authentication — secure application lifecycle) |
| ISO/IEC 20000-1:2018 | `iso-20000-1-2018` | `R30` | "Service management" |
| ISO 22301:2019 | `iso-22301-2019` | `R31` | "Business continuity" (RPO/RTO recommendations) |
| ISO/IEC 15408 series:2026 | `iso-15408-series-2026` | `R32` | Named here: relevant only if a specific downstream component (e.g. a judge sandbox) needs formal security-assurance evaluation under Common Criteria — `data/standards.json`'s own application text scopes this to "bila membutuhkan" (if needed), so no control above assumes it applies universally; no such formal assurance need has been identified for this repository or documented for any downstream platform as of this writing. |
| ISO/IEC 25010:2023 | `iso-25010-2023` | `R33` | "Product quality" |
| ISO/IEC/IEEE 12207:2026 | `iso-iec-ieee-12207-2026` | `R34` | "Software lifecycle governance" |
| ISO/IEC 40500:2025 | `iso-40500-2025` | `R35` | "Accessibility" |
