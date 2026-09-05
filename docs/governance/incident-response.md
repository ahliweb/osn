# Incident response procedure

Status: internal control document. Issue [#24](https://github.com/ahliweb/osn/issues/24).
Implements the "incident procedure" control of §13
(`docs/silabus/13-tata-kelola.md`, "Privacy & Security" row) and is the
detailed procedure `docs/governance/security.md` ("6. Incident
procedure") points to rather than duplicates.

**This is not a legal opinion.** Where this document mentions a statutory
notification obligation (UU No. 27 Tahun 2022), it states what the
obligation is commonly understood to require so a platform can plan
around it; the precise, current statutory figure must be confirmed by
that platform's own legal counsel before or during an actual incident —
mirroring the same discipline `docs/governance/privacy.md` applies
throughout.

**This repository operates no live system.** It cannot itself have a
production security incident — there is no deployed service, database,
or authenticated user to compromise (`SECURITY.md`, "Scope"). This
procedure is written so a **downstream platform** (LMS, contest judge,
mentor dashboard) implementing the OSN Informatika 2026 programme has a
concrete incident-response procedure to adopt, rather than inventing one
under the pressure of an actual incident. It also governs how this
repository's own maintainers handle a vulnerability report received
through `SECURITY.md`.

## Severity levels

Four levels, each with a definition and an example scenario drawn from
`docs/governance/security.md`'s risk register (cited by `RISK-nn` id).

| Severity | Definition | Example scenario |
| --- | --- | --- |
| **SEV-1 — Critical** | Confirmed or highly likely exposure of `personal`-class data for one or more learners (a minor), OR a total loss of judge/contest availability during an active contest window, OR any incident a reasonable person would expect regulators, parents, or the press to ask about. | A learner's real name, contact details, or consent record is confirmed exposed to an unauthorised party (`RISK-01`); the contest judge is down for the entire duration of a live, timed contest (`RISK-03`). |
| **SEV-2 — High** | Confirmed unauthorised access to `internal`-class (behavioural/learning-record) data without `personal`-class exposure, OR a contest problem or its solution leaks before scheduled use, OR a partial/degraded judge outage during a contest window that a reasonable contestant would notice. | A mentor account with `read cohort` access is compromised and used to read learning records outside its assigned cohort; an unreleased problem statement appears somewhere outside the intended access boundary (`RISK-02`); judge submissions during a live contest are delayed by several minutes but not fully lost (`RISK-03`). |
| **SEV-3 — Medium** | A vulnerability or control gap is found with plausible but not yet confirmed impact, OR an availability issue outside an active contest window, OR a confirmed dependency/supply-chain finding with no evidence of exploitation. | A reported vulnerability in `SECURITY.md`'s reporting channel that has not yet been triaged for actual exploitability; a dependency flagged as vulnerable with no evidence it was exploited (`RISK-05`); the LMS is degraded outside a contest window. |
| **SEV-4 — Low** | A finding with no plausible path to learner-data exposure or contest disruption — a hardening opportunity, a process gap (e.g. a missing automated dependency scan, `RISK-05`), or a documentation/compliance-representation concern (`RISK-07`). | A missing Dependabot configuration is identified as a gap (as `docs/governance/security.md`'s risk register already names) with no evidence of an actual compromised dependency; a public reference to this project incorrectly implies ISO certification. |

An incident's severity may be **re-assessed** as more information becomes
available (a SEV-3 that turns out to involve confirmed `personal`-data
exposure is re-classified SEV-1 immediately) — severity is a live
assessment, not a one-time label.

## Roles

Named as **roles**, never individuals — a specific downstream platform
assigns real people to these roles as part of adopting this procedure.

| Role | Responsibility during an incident |
| --- | --- |
| **Incident Commander** | Owns the incident end-to-end: declares severity (and re-declares it if it changes), coordinates the other roles, is the single point of decision-making authority for the duration of the incident, and calls the "resolved" state. |
| **Security/Privacy Lead** (a downstream platform's Data Protection Officer or equivalent) | Assesses whether `personal`-class data (per `docs/governance/privacy.md`) was involved, determines whether the UU 27/2022 notification duty (below) is triggered, and owns the data-subject/authority notification if so. |
| **Technical Lead** | Owns containment and remediation — stopping ongoing harm (revoking a compromised credential, isolating a system, rolling back a change) and fixing the underlying cause. For a judge-availability incident specifically, this may be a separate **Judge/Infrastructure Operations** role per `docs/governance/security.md`'s risk register. |
| **Communications Lead** | Owns all external and internal communication during the incident — status updates to affected users/parents/guardians, to the reporter (if the incident originated from a `SECURITY.md` report), and to any other stakeholder — so technical responders are not also drafting public messaging under pressure. |
| **Curriculum Board liaison** | Engaged specifically for a contest-integrity incident (a leaked problem, `RISK-02`) — assesses whether a contest stage's validity is affected and whether a rescore, extra time, or stage rerun is warranted. |
| **Maintainer** (this repository) | For a vulnerability reported through `SECURITY.md` against this repository itself: triages the report, coordinates a fix, and (per `SECURITY.md`'s coordinated-disclosure section) manages the reporter relationship. This role does not exist on a downstream platform's own incident response — it is specific to this repository. |

One person may hold more than one role for a small team; the point of
naming them separately is that each responsibility is explicitly owned
by *someone*, not that a large team is required.

## Response timeline per severity

Targets from **detection** (or report receipt) to each stage. These are
**intentions the responding team commits to**, the same status
`SECURITY.md`'s "Expected timeframes" section already gives its own
commitments — not a contractual SLA.

| Severity | Acknowledge / triage | Containment (stop ongoing harm) | Resolution or remediation plan | Stakeholder communication |
| --- | --- | --- | --- | --- |
| **SEV-1 — Critical** | Within 1 hour | Within 4 hours | Within 24 hours, or a documented remediation plan with interim mitigations if full resolution takes longer | Initial notice to affected stakeholders within 24 hours of confirmation (see "Communication expectations" below for the personal-data-breach case specifically) |
| **SEV-2 — High** | Within 4 hours | Within 24 hours | Within 5 business days | Initial notice within 3 business days of confirmation |
| **SEV-3 — Medium** | Within 1 business day | Within 5 business days | Within 15 business days | As appropriate; not always required for a Medium-severity finding with no learner-facing impact |
| **SEV-4 — Low** | Within 5 business days | N/A (no active harm to contain) | Tracked to resolution at normal priority, no fixed deadline | Not typically required externally; tracked internally |

These targets compose with, but do not replace, `SECURITY.md`'s own
acknowledgement/triage targets for a vulnerability report against this
repository specifically — that document's timeline applies to *receiving
and triaging* a report; this table applies once an incident (confirmed
or in progress) is being actively worked.

## Communication expectations

- **Internal, during the incident**: the Incident Commander maintains a
  single source of truth (a timeline/log) for what is known, what is
  being done, and by whom — updated as the incident progresses, not
  reconstructed afterward from memory.
- **To the reporter** (if the incident originated from a `SECURITY.md`
  report): per `SECURITY.md`'s coordinated-disclosure section — kept
  informed at a reasonable cadence, credited if they wish once resolved.
- **To affected learners/parents/guardians**: in plain language (per
  `docs/governance/privacy.md`'s "Plain-language summary" standard),
  stating what happened, what data was involved, what is being done, and
  what the affected person can do (e.g. exercise a data-subject right
  per `docs/governance/privacy.md`, "Data-subject rights").
- **Never disclose more than necessary while an incident is still being
  contained** — a premature public statement can itself create risk (for
  example, revealing exactly how a vulnerability works before it is
  fixed) — but "contained" is not an excuse to delay notification of
  those legally or ethically owed it (below).

### Personal-data breach escalation under UU No. 27 Tahun 2022

Where an incident is confirmed or reasonably suspected to involve
`personal`-class data (per `docs/governance/privacy.md`'s data
classification) — a real learner's name, contact detail, school,
birthdate, or consent record — it must be escalated as a **personal-data
breach** under UU No. 27 Tahun 2022 (Pelindungan Data Pribadi), not
handled as a purely technical incident:

1. **Immediate escalation to the Security/Privacy Lead role**, regardless
   of the incident's initial severity classification — a personal-data
   breach involving minors is treated as at least SEV-2 by default,
   SEV-1 if the exposure is confirmed (not merely suspected) or if it
   involves a broad set of learners rather than a narrow, contained one.
2. **Statutory notification duty**: UU No. 27 Tahun 2022 requires a
   personal-data controller to notify affected data subjects (and, in
   Indonesia's data-protection framework, the relevant supervisory
   authority) of a failure to protect personal data, within a time
   window commonly cited as **3 × 24 hours (72 hours)** from when the
   failure is known. **This document states that figure as commonly
   understood, not as its own confirmed legal conclusion** — the
   platform's legal counsel must confirm the current, applicable
   statutory window and any procedural requirement (form, authority
   contact, content of the notice) at the time of the actual incident,
   since this document cannot track changes to the law after it is
   written (the same caveat `docs/governance/privacy.md` applies
   throughout).
3. **This repository is not the notifying party.** Per ADR-0004 and
   `docs/governance/privacy.md` ("Scope"), this repository holds no
   personal data and is not a data controller — the notification duty
   above falls on the **downstream platform** that actually processed
   the affected learner's data. This document exists so that platform
   has a procedure ready, not so this repository can discharge the duty
   on its behalf.
4. **Notify the data subject's parent/guardian**, not only (or instead
   of) the minor learner directly, consistent with "Subjects are minors"
   in `docs/governance/privacy.md`.

## Post-incident review

For every SEV-1 or SEV-2 incident (and any lower-severity incident where
the Incident Commander judges it valuable), conducted **within 10
business days of resolution**:

1. **Reconstruct the timeline**: detection, escalation, containment,
   resolution, and communication — from the Incident Commander's log
   above, not from memory.
2. **Blameless root-cause analysis**: what allowed the incident to
   happen, and what allowed it to be detected (or delayed detection) —
   focused on the process and system gap, not on assigning fault to an
   individual.
3. **Action items**, each with an owning **role** (never a named
   individual in the review document itself) and a target date — for
   example, "add the missing dependency-vulnerability scan named as a
   gap in `docs/governance/security.md`'s `RISK-05` row: owner
   Maintainer role."
4. **Update the risk register** (`docs/governance/security.md`) if the
   incident revealed a risk not already listed, or changed the assessed
   likelihood/impact/residual-risk of an existing row.
5. **Update this procedure** if the incident revealed a gap in the
   severity definitions, roles, timeline, or communication expectations
   above — this document is itself subject to the same continuous-
   improvement expectation ISO 21001 asks of the curriculum
   (`docs/governance/security.md`, "Educational management alignment").
6. **Close the loop** with anyone notified during the incident (reporter,
   affected learners/parents, regulator if notified) with a brief summary
   of the outcome and remediation, once the review is complete.

## Placeholders

> **Contact placeholders — need real values before this procedure is
> relied upon operationally.** This repository operates no platform and
> cannot name real people, phone numbers, or escalation contacts. A
> platform adopting this procedure must replace every placeholder below
> before an actual incident, not during one.

- **Emergency/escalation contact for a SEV-1 incident**:
  `[INCIDENT-ESCALATION-CONTACT-NOT-YET-CONFIGURED]`
- **Security/Privacy Lead (Data Protection Officer or equivalent)
  contact**: `[DPO-CONTACT-NOT-YET-CONFIGURED]` (same placeholder role
  `docs/governance/privacy.md`'s "Data-subject rights" section already
  names — this document does not duplicate that section, only points to
  the same unresolved contact).
- **Relevant Indonesian data-protection supervisory authority contact**,
  for the UU 27/2022 notification above: `[SUPERVISORY-AUTHORITY-
  CONTACT-NOT-YET-CONFIGURED]` — this document does not name a specific
  authority or address, since that detail is outside this repository's
  scope and subject to change; confirm the current authority and process
  with legal counsel at the time of an actual incident.
- **This repository's own vulnerability-report intake**: see
  `SECURITY.md`'s placeholder, `[SECURITY-CONTACT-NOT-YET-CONFIGURED]`
  (not repeated here to avoid two independently-maintained copies of the
  same unresolved contact).

## Related documents

- [`SECURITY.md`](../../SECURITY.md) — how a vulnerability against this
  repository itself is reported, and this repository's own
  acknowledgement/response timeframes.
- [`docs/governance/security.md`](security.md) — the ISO/IEC control
  mapping and risk register this procedure's severity examples and role
  set are drawn from.
- [`docs/governance/privacy.md`](privacy.md) — the privacy policy for
  minors' data, including data classification, retention, and
  data-subject rights this procedure cross-references rather than
  duplicates.
