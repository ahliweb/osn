# Privacy policy

Status: internal control document. Issue [#23](https://github.com/ahliweb/osn/issues/23).

**This is not a legal opinion, and it does not substitute for one.** It
states, as concretely as this repository can, what a downstream platform
implementing the OSN Informatika 2026 training programme must establish
before it processes any learner's data, and maps each obligation to the
regulation that motivates it. Before this policy is published or relied
upon operationally, it must be reviewed by qualified legal counsel
against Indonesian law as it stands at the time of publication — nothing
below should be read as a legal conclusion that a given design is
compliant.

## Plain-language summary

This repository is a curriculum specification, not a system that holds
learner data. It never stores a real learner's name, contact details, or
any other personal information — see "Scope" below. This document exists
so that whoever *does* build a platform around this curriculum (a school,
an LMS vendor, a competition-training organiser) has a concrete starting
point for protecting the school-age minors who will use it: what data to
collect (as little as possible), who gets to see it (strictly by role),
how long to keep it (not forever), what to log (actions, never values),
and what rights a learner or their parent/guardian has over their own
data. This paragraph is this document's attempt at satisfying the §10
"kebijakan privasi yang mudah dipahami" (an understandable privacy
policy) safeguard directly; the rest of the document is the detailed,
citable version of the same commitments.

## Scope

**This repository stores no learner data, of any kind, anywhere.** It
defines:

- **Schemas** (`src/schema/learning-record.ts`, `src/schema/problem-
  taxonomy.ts`) — the shape a downstream platform's learning-record and
  problem-tagging data must satisfy.
- **Policy** (this document, and `docs/architecture/data-classification.md`)
  — what that data means privacy-wise and how it must be handled once a
  platform actually holds it.
- **A CI-checkable control** (`osn privacy-check`, below) — an automated
  scan that fails the build if this repository's own `data/` directory
  ever grows a field shaped like a direct personal identifier.

It does **not** run a learning platform, does not authenticate anyone,
does not hold a database of real learners, and does not itself comply
with — or need to comply with — UU No. 27 Tahun 2022 as a data
*controller*, because it never controls any personal data (see ADR-0004,
"Why option 2 (anonymised real cohort data) was rejected"). Every
obligation described below is an obligation for the **downstream
platform** that does hold real learner data — this document specifies
what that platform must establish; it does not, and cannot, verify that
any particular platform has done so. **Legal review is a separate,
required step this document does not substitute for** (see the notice at
the top of this file).

See also: `docs/architecture/data-classification.md` (the field-by-field
classification this policy's minimisation and access rules are built
from) and `docs/architecture/adr/0004-no-learner-personal-data.md` (the
binding decision this whole document assumes).

## Subjects are minors

**Every participant in this programme is, by definition, a school-age
minor.** Nothing in this document, or in any downstream platform's design,
may treat that as incidental. §10 of the syllabus corpus
(`docs/silabus/10-regulasi-indonesia.md`) states this plainly in its
"Data peserta di bawah umur" callout, and every rule in this document — 
lawful basis, minimisation, access control, retention, logging, rights
handling — is written with that fact as its starting premise, not as an
afterthought bolted onto a generic adult-user privacy policy. Where a
choice in this document would be looser for an adult population (a
longer retention window, a broader default access grant, a lighter
consent process), it is not extended to this programme's learners.

## Lawful basis and consent/authorisation

UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (`R19`) is the
governing law for how a downstream platform processes a learner's
personal data (§10, `docs/silabus/10-regulasi-indonesia.md`;
`data/regulations.json`'s `uu-27-2022` entry). This document does not
attempt to state which specific lawful basis under that law a given
platform relies on — that determination depends on the platform's actual
processing purposes and must be made by that platform (with its own legal
review), not assumed here. What this document does specify is what a
compliant platform must be able to **demonstrate**, given that its data
subjects are minors:

- **Parental/guardian authorisation appropriate to the minor's age and
  the processing's context**, obtained before any personal data is
  collected — not merely a generic terms-of-service checkbox at signup.
  The specific mechanism (a signed form via the school, a verified
  digital consent flow, authorisation bundled into the school's own
  enrolment process) is a design decision for the platform, informed by
  its own legal review; this document does not prescribe one mechanism as
  universally sufficient.
- **The school's role as an intermediary**, where the programme is
  delivered through a school: a school enrolling a student in this
  programme is not, by itself, equivalent to that student's parent/
  guardian having authorised this specific platform's data processing.
  A platform relying on school-mediated enrolment must still establish
  its own basis for processing the student's data, appropriate to how
  directly the school is acting as (or is authorised to act on behalf of)
  the parent/guardian for this purpose — again, a determination for the
  platform's own legal review, not a conclusion this document reaches on
  its behalf.
- **A record of authorisation** that can be produced on request (by the
  learner's parent/guardian, or a regulator) — see "Retention schedule"
  below for how long such a record should be kept, and "Data-subject
  rights" for how a withdrawal of authorisation must be handled.
- **A withdrawal path**: authorisation given for a minor must be
  revocable by the parent/guardian at any time, with a defined effect
  (see "Data-subject rights" below) — a platform that cannot honour a
  withdrawal has not actually implemented a consent/authorisation
  process, only its appearance.

None of the above is a legal conclusion that any specific authorisation
design satisfies UU 27/2022 — it describes what a platform must be able
to show, for its own counsel to evaluate.

## Data minimisation

### The minimum viable learning-record field set

The learning-record shape this repository defines
(`src/schema/learning-record.ts`'s `learningRecordSchema`) is already the
minimisation target: a downstream platform's real learning-record storage
should carry **no more fields than this**, for the same reason the schema
is `.strict()` (ADR-0004) — every additional field is additional exposure
for no additional pedagogical value the syllabus (§13) actually asks for.

| Field | Classification | Purpose |
| --- | --- | --- |
| `learnerRef` | internal | Opaque pseudonymous reference to the learner (`lr_[a-z0-9]{8,32}`) — never a name or other direct identifier. |
| `problemId` | public | Which problem this attempt was made against. |
| `attemptNo` | internal | This attempt's 1-indexed position among the learner's attempts at this problem. |
| `verdict` | internal | The judge verdict (`AC`\|`WA`\|`TLE`\|`RE`\|`CE`\|`MLE`). |
| `durationSeconds` | internal | Wall-clock time spent on this attempt. |
| `hintLevelUsed` | internal | Highest §5.3 hint escalation level used, or `null`. |
| `usedEditorial` | internal | Whether the terminal editorial hint level was used. |
| `errorTaxonomy` | internal | The §13.1 postmortem error class, or `null`. |
| `status` | internal | The §6.2 A/B/C/D problem-completion status. |
| `resolveStatus` | internal | The §13.1 re-solve state. |
| `recordedAt` | internal | ISO 8601 UTC capture timestamp. |

(Classifications reproduced from `LEARNING_RECORD_CLASSIFICATION` in
`src/schema/learning-record.ts`, kept in sync with
`docs/architecture/data-classification.md` by
`tests/unit/learning-record.test.ts`.)

A downstream platform will necessarily hold additional data this schema
does not model at all — an account record, a parental-authorisation
record, a school affiliation used for cohort assignment. That data is
**personal** by this document's classification and is governed by the
"Role-based access" and "Retention schedule" sections below; it must
never be merged into, or derivable from, the learning-record data above.

### Must-not-collect list (zero tolerance, mirrors `DIRECT_IDENTIFIER_DENYLIST`)

No field shaped like any of the following may ever appear in a learning
record, a problem-taxonomy entry, or any file under this repository's
`data/` directory. This list is generated to stay in lockstep with
`DIRECT_IDENTIFIER_DENYLIST` in `src/schema/learning-record.ts` —
`tests/unit/privacy-policy-doc.test.ts` asserts the two sets are
identical, in both directions, so this document cannot silently drift
from the code that enforces it:

- `name`
- `nama`
- `email`
- `phone`
- `telepon`
- `nik`
- `nisn`
- `school`
- `sekolah`
- `address`
- `alamat`
- `birthdate`
- `tanggallahir`
- `dob`
- `photo`
- `foto`
- `ip`
- `ipaddress`

**One documented tolerance, and only one:** the key `name` is permitted
in this repository's own `data/*.json` curriculum files (e.g. `{ "id":
"osn-k", "name": "OSN-K" }` in `data/competition-stages.json`) because it
labels a *curriculum entity* (a competition stage, a topic family), never
a person. This tolerance is scoped precisely to that pre-existing
curriculum corpus and is applied identically by
`tests/unit/learning-record.test.ts` (the original scan) and `osn
privacy-check` (below, the promoted CI control) — see
`TOLERATED_KEY`/`TOLERATED_KEYS` in `src/domain/privacy-scan.ts`. It does
**not** extend to a learning record: `learningRecordSchema`'s guard
rejects `name` there like every other denylisted key, because there it
would be a person's name. It also does not extend to a downstream
platform's own real learner-facing data at all — the tolerance exists
only for this repository's own curriculum-entity fixtures.

## Role-based access

A least-privilege matrix over the four roles a downstream platform
implements and the three data classes `docs/architecture/data-
classification.md` defines. Permission levels, defined precisely (no
adjective is used without this legend):

| Permission | Meaning |
| --- | --- |
| `read all` | Unrestricted read access — appropriate only for data with no learner-specific sensitivity at all. |
| `read own` | Read access scoped to records where the requester *is* the data subject (a learner reading their own learning history), or *is* the specific individual the personal record concerns. |
| `read cohort` | Read access scoped to the records of learners the requester has a defined pedagogical or operational relationship with (a mentor's assigned learners), never the whole platform's population. |
| `read aggregate` | Read access to statistics/aggregates only (counts, rates, distributions) — never a query path back to any single learner's individual record. |
| `none` | No access. |

| Role | `public` (curriculum content) | `internal` (learning-process / behavioural data) | `personal` (direct identifiers, consent records — held only by the platform, never by this repository) |
| --- | --- | --- | --- |
| **Learner** | `read all` | `read own` — their own learning records only. | `read own` — their own account/consent record, for the data-subject rights in the next section; via parent/guardian for a minor who cannot exercise this directly. |
| **Mentor** | `read all` | `read cohort` — only the learners they are assigned to mentor. | `none` — a mentor needs a learner's `learnerRef` and pedagogical history, never their real name, contact details, or consent record, to do their job. |
| **Curriculum board** | `read all` | `read aggregate` — cohort-level and programme-level statistics for curriculum revision, never an individual learner's record. | `none`. |
| **Administrator** | `read all` | `read cohort` — operational necessity (support, incident response), every access logged (see "Access logging" below). | `none` by default; a narrowly-scoped exception (verifying a parental-consent record, executing a data-subject request) is permitted only as its own logged, individually-justified action — never standing access to the whole personal-data store. |

Two properties this table is designed to make visible at a glance:

1. **No role has standing `read all`/blanket access to `internal` or
   `personal` data.** Even the administrator role's broadest grant
   (`read cohort` for `internal`) is scoped and logged, not unconditional.
2. **`personal` data access is the narrowest column for every role**,
   including the administrator — consistent with "Subjects are minors"
   above: the fewer roles that can see a real name or contact detail, the
   smaller the exposure if any one account is compromised.

## Retention schedule

Every duration below is a **recommendation this document makes**, not a
number fixed by UU 27/2022, UU 1/2024, or PP 71/2019 by name — those
regulations require that retention be proportionate and no longer than
necessary for the stated processing purpose (data minimisation /
purpose limitation), but do not specify a fixed number of months or years
for a training-programme's learning records. A platform's own legal
review should confirm or adjust every figure below against its actual
processing purpose before relying on it.

| Data class | Recommended retention | Rationale |
| --- | --- | --- |
| `public` (curriculum content, problem taxonomy) | Indefinite. | Not learner data — it describes problems and curriculum, not people; there is no privacy reason to delete it. |
| `internal` (learning records, behavioural/KPI data, keyed by `learnerRef`) | Active enrolment, plus 12 months after the learner exits the programme (graduation, withdrawal, or programme end) — then delete or irreversibly aggregate (strip `learnerRef`, retain only cohort-level statistics). | The 12-month tail supports appeals, re-evaluation, and longitudinal cohort analysis the syllabus's own KPI/postmortem machinery (§6.3, §13.1) is built for, without keeping identifiable behavioural data indefinitely. **Recommendation, not a statutory figure.** |
| `personal` — account/enrolment identifiers (real name, parent/guardian contact, school, birthdate) | Only as long as needed for account administration; recommended deletion within 90 days after the learner exits the programme, **except** the minimal subset needed for the consent record below. | Minimisation: once a learner has exited, day-to-day account administration no longer needs their direct identifiers. **Recommendation, not a statutory figure.** |
| `personal` — parental/guardian consent-authorisation record (that authorisation was given, by whom, when, for what) | Recommended 5 years after the learner exits the programme. | A consent record's value is evidentiary (being able to show authorisation existed) rather than operational; a longer, clearly-bounded window supports that without retaining the full identifier set above. **Recommendation, not a statutory figure** — a platform should align this with its own general records-retention/limitation-period practice. |
| Access logs (see below) | Recommended 12 months, rolling, then deleted or archived under the platform's own security policy. | Long enough to support a security investigation into a plausible incident, short enough not to become a second, growing store of sensitive access patterns. **Recommendation, not a statutory figure.** |

### Deletion procedure

1. **Trigger**: a retention-schedule expiry (above), a data-subject
   deletion request (see "Data-subject rights"), or programme
   discontinuation.
2. **Identify scope**: every storage location holding the data class in
   question for the affected learner(s) — primary database, search
   indexes, analytics stores, and backups (a backup is not exempt; it
   must be covered by the same schedule, even if execution against a
   backup is necessarily delayed until its own rotation).
3. **Execute**: hard-delete personal data; for internal/behavioural data
   past its 12-month tail, either hard-delete or irreversibly strip
   `learnerRef` so no later process can rejoin it to a real identity.
4. **Verify**: confirm the data no longer resolves in the primary store
   and is scheduled for removal from backups per the platform's own
   backup-rotation policy.
5. **Log the deletion event itself** — see "Access logging" below: log
   that a deletion occurred, its data class and scope, and its trigger,
   but never log the deleted values.
6. **Confirm**, when the deletion was triggered by a data-subject
   request, to the requester (or their parent/guardian) that it is
   complete.

## Access logging

**What must be logged**, for every access to `internal` or `personal`
data: a timestamp, the acting account's role and identifier, the action
taken (read / export / report-generation / deletion), and the scope of
what was accessed (which `learnerRef`(s) or cohort, and the data class) —
enough to reconstruct *who did what, to which scope, when*, without ever
needing to reproduce *what the data actually said*.

**What must never be logged: identifier values.** This repository already
establishes the pattern to follow, in `osn report`'s privacy-gate refusal
(`src/cli/commands/report.ts`): when it refuses a file containing a
personal-identifier-shaped field, it names the field's **path** and the
**record index** it was found in, but never the value at that path — "so
a real identifier accidentally present in a mentor's export is never
echoed back into a terminal, a CI log, or a redirected `--out` file"
(that module's own docblock). A downstream platform's access log must
apply the identical discipline: log *that* field X of record Y was
accessed, never log field X's actual contents. This applies to every
class of value this document calls personal or internal — a name, a
contact detail, a raw learning-record field — and, in the access-log
system itself, to any technical metadata that is itself identifying
(e.g. a requester's IP address, which is on this document's own
must-not-collect list for learning-record-shaped data). A platform's
operational security logging (e.g. a web server's access log, governed
by ordinary information-security practice, not by
`learningRecordSchema`) is a distinct system from the learner-data access
log this section describes; where the two overlap, the stricter rule
here — no identifying value, ever — governs any log a mentor,
curriculum-board member, or administrator can read as part of exercising
the roles in the previous section.

## Data-subject rights

A learner (or, given they are minors, their parent/guardian acting on
their behalf) has, at minimum, the rights UU 27/2022 grants a data
subject: to be informed of what is collected and why; to access their own
data; to request correction of inaccurate data; to request deletion or
restriction of processing; to object to a specific processing purpose;
and to withdraw a previously given authorisation at any time, with the
effect that new processing under that authorisation stops (existing data
is then handled per "Retention schedule"/"Deletion procedure" above,
unless another lawful basis independently justifies continued retention
of a specific, narrow subset — e.g. a consent record proving the
withdrawn authorisation existed).

**Handling process** (what a platform must implement, not what this
document can implement on its behalf):

1. A clearly signposted way to submit a request (a form, an email
   address, a designated contact) — a downstream platform's actual
   contact point is a **placeholder in this document**, since this
   repository operates no such platform:

   > **[PLACEHOLDER — fill in before publication: the downstream
   > platform's designated contact for data-subject rights requests
   > (e.g. a Data Protection Officer / person-in-charge name, email, and/
   > or phone number). This repository does not operate a platform and
   > cannot name a real contact; do not publish this document with this
   > placeholder still in place.]**

2. **Identity verification** appropriate to a minor's request being made
   by their parent/guardian, before acting on it.
3. **A defined response time** the platform commits to (this document
   does not fix one — it is a platform-specific operational commitment,
   informed by legal review, not a number this repository can set on the
   platform's behalf).
4. **An escalation path** when a request cannot be resolved at first
   contact: to the platform's own designated Data Protection Officer /
   person-in-charge (same placeholder as above), and, if still unresolved,
   to the relevant Indonesian data-protection supervisory authority under
   UU 27/2022 — this document does not name that authority's current
   contact details, since they are outside this repository's scope and
   subject to change; a platform's legal review should confirm the
   current authority and process at the time of publication.

## Mapping table

Every requirement above, mapped to the regulation that motivates it
(citation ids from `data/regulations.json`, matching
`docs/silabus/10-regulasi-indonesia.md`'s §10 table):

| Requirement | Regulation | Citation |
| --- | --- | --- |
| This repository is not a data controller (no learner data held) | UU No. 27 Tahun 2022 — Pelindungan Data Pribadi | `R19` |
| Lawful basis and parental/guardian authorisation for minors | UU No. 27 Tahun 2022 — Pelindungan Data Pribadi | `R19` |
| Data minimisation (field set, must-not-collect list) | UU No. 27 Tahun 2022 — Pelindungan Data Pribadi | `R19` |
| Role-based, least-privilege access | UU No. 27 Tahun 2022 — Pelindungan Data Pribadi | `R19` |
| Role-based access as part of electronic-system governance | PP No. 71 Tahun 2019 — PSTE | `R21` |
| Retention schedule and deletion procedure | UU No. 27 Tahun 2022 — Pelindungan Data Pribadi | `R19` |
| Access logging (what is logged, what is never logged) | UU No. 27 Tahun 2022 — Pelindungan Data Pribadi | `R19` |
| Access logging as part of electronic-system/transaction governance | PP No. 71 Tahun 2019 — PSTE | `R21` |
| Account security (see note below) | UU No. 1 Tahun 2024 — perubahan kedua UU ITE | `R20` |
| Account security as part of electronic-system governance | PP No. 71 Tahun 2019 — PSTE | `R21` |
| Data-subject rights and escalation | UU No. 27 Tahun 2022 — Pelindungan Data Pribadi | `R19` |
| An understandable privacy policy (this document, incl. "Plain-language summary") | UU No. 27 Tahun 2022 — Pelindungan Data Pribadi | `R19` |

## Account security

§10's callout also names "keamanan akun" (account security) as a
required safeguard for minors' data — named here so this document covers
all seven §10 safeguards, and stated at the level a privacy policy can
own: a platform must protect the accounts through which every role in
"Role-based access" above authenticates (strong authentication, a
enforced password/credential policy or equivalent, session expiry,
and multi-factor authentication at minimum for the mentor, curriculum
board, and administrator roles, since those roles' compromise exposes
`internal`/`personal` data belonging to more than one learner at once).
The full technical control detail (secure authentication design, backup,
incident procedure) belongs to the security policy planned under issue
[#24](https://github.com/ahliweb/osn/issues/24)
(`docs/governance/security.md`, not yet created) — this section states
the requirement so this document's coverage of the §10 callout is
complete, without duplicating that forthcoming document's detail.

## The automated check: `osn privacy-check`

The "no direct identifier in `data/`" rule above is not just stated here
— it is enforced mechanically, twice:

1. `tests/unit/learning-record.test.ts` scans every top-level
   `data/*.json` file (a unit test, run by `bun test`).
2. **`osn privacy-check`** (`src/cli/commands/privacy-check.ts`) promotes
   that scan to a first-class, CLI-invocable, CI-enforced governance
   control: it walks `data/` **recursively** (reaching `data/samples/`)
   and reads **`.jsonl` files too** (reaching
   `data/samples/learning-records.sample.jsonl`), applying the identical
   `"name"`-tolerance rule described in "Must-not-collect list" above.

```sh
bun run privacy-check
# equivalently:
osn privacy-check [--data-dir <path>] [--json]
```

It exits `0` clean, `1` if any finding is present, `2` on a usage error.
Every finding names the file (or, for a `.jsonl` file, `<file>:<line>`),
the in-file path to the offending key, and the key itself — **never the
value**. See `docs/cli/README.md`'s "osn privacy-check" section for full
usage, and the CI workflow (`.github/workflows/ci.yml`) for where it runs
(after `osn validate`, on every push and pull request).
