# Security Policy

Status: internal control document, implementing issue
[#24](https://github.com/ahliweb/osn/issues/24) (§13 "Privacy & Security" —
`docs/silabus/13-tata-kelola.md` — "incident procedure" control, and the
vulnerability-disclosure expectation of §11's ISO/IEC mapping,
`docs/silabus/11-pemetaan-iso.md`).

**This repository is not certified to any ISO/IEC standard.** The detailed
control mapping lives in [`docs/governance/security.md`](docs/governance/security.md);
this file is the entry point a security researcher or downstream integrator
reads first.

## Scope

This repository (`osn-informatika-2026`) is curriculum-as-code: a typed,
validated, version-controlled representation of the OSN Informatika 2026
operational syllabus, plus its governance documentation (see `README.md`,
"What this repository is not"). It is **not** a judge, not an LMS, and
**stores no learner personal data of any kind** — see
[`docs/governance/privacy.md`](docs/governance/privacy.md) and
[ADR-0004](docs/architecture/adr/0004-no-learner-personal-data.md).

**This repository contains no production secrets, credentials, API keys,
or learner data.** It is a public, MIT-licensed software project (see
`README.md`, "Licence") with no deployed service, no database, and no
runtime that authenticates anyone. If you nonetheless believe you have
found a secret, credential, learner-data leak, or any other sensitive
material committed to this repository (in the working tree or in git
history), **please report it anyway** using the process below — a false
assumption on our part ("this repo can't hold secrets") is exactly the
kind of finding this policy exists to catch.

## Supported versions

This project has not yet published a `v1.0.0` release — `package.json`
`version` is `0.0.0` and the package is `private` (never published to a
registry; see `docs/development/releasing.md`). The roadmap
(`README.md`) targets `v1.0.0` under **M6: Governance & Release**.

| Version | Supported |
| --- | --- |
| `main` (latest commit) | ✅ |
| Any tagged release prior to `v1.0.0` | N/A — none exist yet |

Until the first tagged release, **only the latest commit on `main` is
supported** for security purposes: a report against an older commit will
be triaged against whether the issue still reproduces on `main`. Once
this project begins cutting tagged releases per
`docs/development/releasing.md`, this table will be updated to list the
specific release lines (e.g. the latest major version) that receive
security fixes, following the project's SemVer policy
(`docs/development/releasing.md`, "Version-bump policy").

## Reporting a vulnerability

> **Contact placeholder — needs a real address before publication.** This
> repository does not yet have a designated security-reporting address.
> Do not treat the placeholder below as a working contact; a maintainer
> must replace it with a real, monitored channel (a dedicated security
> mailbox, a private GitHub Security Advisory, or equivalent) before this
> policy is relied upon operationally. **We do not invent a contact
> address here.**

Please report a suspected vulnerability to:

> **`[SECURITY-CONTACT-NOT-YET-CONFIGURED]`**

privately — **do not open a public GitHub issue** for a suspected
vulnerability, since this repository's issue tracker is public and a
vulnerability report there would itself be a disclosure. If a private
channel is not yet configured when you find this document, contact the
repository owner named in `.github/CODEOWNERS` (`@ahliweb`) through
GitHub directly, and ask them to establish a private channel before
sharing further detail.

When reporting, please include (as much as you can of):

- A description of the vulnerability and its potential impact.
- Steps to reproduce, or a proof of concept.
- The commit hash or version you tested against.
- Whether you believe the finding involves a secret, credential, or
  learner-data exposure specifically (see "Scope" above) — this changes
  our triage path, since such a finding would also trigger
  `docs/governance/incident-response.md`.

Please do **not** include any real learner data in a report, even if you
believe you found some — per ADR-0004 this repository should hold none;
if you found what looks like real learner data, describe *where* you
found it and its shape, not its actual values, mirroring the same
never-log-the-value discipline `docs/governance/privacy.md` ("Access
logging") requires of this project's own tooling.

### Expected timeframes (intentions, not guarantees)

This project has no dedicated security team or paid on-call rotation — it
is maintained on a best-effort basis. The following are **stated
intentions**, not contractual service-level commitments:

| Stage | Target |
| --- | --- |
| Acknowledgement of receipt | Within 5 business days |
| Initial triage / severity assessment | Within 10 business days of acknowledgement |
| Remediation plan or fix, for a confirmed finding | Communicated to the reporter once triage completes; timeline depends on severity (see `docs/governance/incident-response.md`'s severity levels and per-severity response timelines) |

If you have not heard back within the acknowledgement window above,
please follow up — a missed acknowledgement is itself something we want
to know about.

### Coordinated disclosure

We ask reporters to:

- Give us a reasonable opportunity to investigate and address a
  confirmed vulnerability before any public disclosure.
- Avoid accessing, modifying, or exfiltrating data beyond what is
  strictly necessary to demonstrate the vulnerability.
- Not exploit a finding beyond what is needed to prove it exists (no
  destructive testing, no attempts to pivot into other systems).

In turn, we intend to:

- Keep the reporter informed of progress at a reasonable cadence.
- Credit the reporter (if they wish to be credited) once a fix ships or
  the finding is otherwise resolved, unless doing so would itself create
  a risk.
- Not pursue legal action against a reporter who follows this
  coordinated-disclosure process in good faith.

A specific disclosure-timeline commitment (e.g. "90 days") is not fixed
by this document — with no released version and no production
deployment yet (see "Scope"), a fixed public-disclosure deadline is
premature; this section will be revisited once this project has an
actual deployed downstream consumer whose users a delayed disclosure
could affect.

## Related documents

- [`docs/governance/security.md`](docs/governance/security.md) — the full
  control mapping (ISO/IEC 27001/27002/27005/27017/27018/27701/27034-1,
  20000-1, 22301, 25010, 40500, 21001, 12207), the six §13 controls
  expanded into implementable statements, and the risk register.
- [`docs/governance/incident-response.md`](docs/governance/incident-response.md) —
  severity levels, roles, response timeline, and communication
  expectations for a confirmed incident, including a personal-data
  breach.
- [`docs/governance/privacy.md`](docs/governance/privacy.md) — the
  privacy policy for minors' data (issue #23).
