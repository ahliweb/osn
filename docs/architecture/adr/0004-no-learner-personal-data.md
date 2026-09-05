# ADR-0004: No learner personal data in the repository

## Status

Accepted, 2026-09-05.

## Context

§13 requires this repository to define a Learning Record ("Attempt,
verdict, waktu, hint/editorial status, error taxonomy, re-solve status")
and a Problem Taxonomy. Both are, by their nature, records *about*
individual learners' attempts at problems. §10 ("Regulasi Indonesia yang
Relevan") is explicit that the programme's participants are minors and
cites **UU No. 27 Tahun 2022** (Pelindungan Data Pribadi) as the legal
basis for how their data must be handled, alongside UU No. 1 Tahun 2024
(ITE) and PP No. 71 Tahun 2019 (PSTE). §10's "Data peserta di bawah umur"
callout is specific: apply data minimisation, role-based access, access
logging, limited retention, account security, and a context-appropriate
consent/authorisation process.

This creates a direct tension: the syllabus requires the *shape* of a
learning record to be defined (§13; FR-16), but the syllabus also requires
minors' actual data to be tightly protected (§10; GR-01 through GR-05).
This ADR resolves that tension for what belongs in *this* repository
specifically — as distinct from whatever downstream platform eventually
stores real learner data (ADR-0001, "what a consumer must build
themselves").

## Options considered

1. **Define the learning-record and problem-taxonomy schemas, but never
   store real learner data in this repository.** Learner identifiers in
   any schema or fixture are opaque, pseudonymous references
   (`learnerRef`) — never a name, email, phone number, NIK, school, or
   birthdate. Any sample data committed for tests or documentation is
   synthetic and clearly labelled as such.
2. **Commit anonymised real cohort data** as realistic fixtures, so tests
   and examples exercise the schema against representative data.
3. **Omit the learning-record and problem-taxonomy schemas from this
   repository entirely**, leaving them to be defined independently by
   whatever downstream LMS/dashboard platform eventually needs them.

## Decision

Option 1: this repository defines the **schemas** for learning records
and problem taxonomy (issue #15 — `src/schema/learning-record.ts`,
`src/schema/problem-taxonomy.ts`) but stores **no real learner personal
data**, anywhere, ever. Every learner identifier in the data model is an
opaque pseudonymous `learnerRef`. Any fixture or sample data used in tests
or documentation must be obviously synthetic (per `AGENTS.md`'s Privacy
section: "clearly fake names, no real school, no real identifiers").

### Why option 2 (anonymised real cohort data) was rejected

"Anonymised" real cohort data carries a **re-identification risk** that is
well documented as a general property of anonymisation techniques applied
to small, structured, attribute-rich datasets — a handful of quasi-
identifying fields (school, cohort timing, problem-attempt pattern) can be
enough to re-identify a specific minor even with names stripped,
especially in a small, targeted programme like a national olympiad squad.
Beyond the technical risk, there is **no lawful basis** for this
repository specifically to hold that data under UU No. 27 Tahun 2022 — the
repository is a public, version-controlled, MIT-licensed software project
(`README.md`, "Licence"), not a system operating under any of the
consent/authorisation or legitimate-interest bases that would let it
process minors' data at all, real or "anonymised." The synthetic-fixture
approach (option 1) gets the same test coverage — a fixture exercising
every `errorTaxonomy` class, every `status` code, every field — with none
of that risk, because no fixture describes a real person.

### Why option 3 (omit the schemas entirely) was rejected

Omitting the schemas would satisfy the privacy goal trivially, but at the
cost of the §13 requirement this ADR is also trying to satisfy: §13
explicitly lists "Learning Record" and "Problem Taxonomy" as governance
components of the implementation, and FR-15/FR-16 in
`docs/requirements/register.md` require exactly this. If this repository
does not define them, every downstream platform that eventually
implements the OSN Informatika training programme would have to invent
its own shape for attempt records, error taxonomy, and hint-level
tracking — with no guarantee of consistency across platforms, and no
single place where "what does a learning record contain" is answered
authoritatively per the syllabus. The whole point of curriculum-as-code
(ADR-0001) is that this repository is the reference implementation of what
the syllabus specifies; leaving out the one schema most directly tied to
§13's governance mandate would defeat that purpose for the sake of a
privacy goal that option 1 already satisfies without the tradeoff.

## Decision detail: enforcement mechanism

Stating the rule in this ADR is not sufficient on its own — per the §13
Quality Review principle this repository applies to itself (ADR-0001),
the rule is enforced mechanically at two points:

1. **Schema-level rejection of direct identifiers.** The learning-record
   schema (issue #15) includes a guard that rejects any record
   containing fields that look like direct personal identifiers (name,
   email, phone, NIK, school, birthdate) — GR-02 in
   `docs/requirements/register.md`, with a corresponding rejecting-fixture
   test. The identifier field itself is typed as an opaque `learnerRef`
   (GR-03), never a name or other direct identifier.
2. **A CI-checkable scan over `data/`.** Issue #23 (privacy
   policy) adds `osn privacy-check`, an automated assertion that scans every file under
   `data/` for fields named like direct identifiers and fails the build if
   any are found (GR-04) — a second, corpus-wide check independent of any
   single schema, so a future data file cannot bypass the schema-level
   guard by mistake.

The full role-based-access, retention-schedule, and consent-process detail
required by §10 is a **policy for a downstream platform**, not a control
this repository enforces at runtime (it has no runtime with users) — that
policy is written in `docs/governance/privacy.md` (issue #23), and
cross-referenced from `docs/architecture/data-classification.md`
(issue #15; see `docs/architecture/repository-map.md`).

## Consequences

- **Easier:** the learning-record and problem-taxonomy shape §13 requires
  is defined once, authoritatively, without this repository ever becoming
  a system that must comply with UU 27/2022 as a data controller —
  because it holds no personal data to control.
- **Easier:** every test fixture involving a "learner" can be written
  freely (obviously synthetic names, invented pseudonymous refs) without
  any privacy review, because nothing real is ever at risk of being
  committed.
- **Harder:** this repository cannot, by itself, demonstrate the schema
  against a realistic-feeling cohort dataset — anyone wanting to see "what
  does a real term of learning records look like" has to synthesise or
  simulate one themselves, which this repository does not provide.
- **Risk and mitigation:** the risk of a contributor (human or agent)
  accidentally committing real learner data anyway is mitigated by the
  two mechanical checks above (schema guard + CI scan) plus the
  contributor-facing rule in `AGENTS.md` ("Never commit real learner
  data") and the verification checklist item ("No real learner data,
  secrets, or credentials committed") run before any issue is claimed
  done.
