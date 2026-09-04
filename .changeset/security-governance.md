---
"osn-informatika-2026": minor
---

Add `SECURITY.md` (supported versions, vulnerability-reporting process
with a clearly-marked placeholder contact, response-time intentions, and
coordinated-disclosure expectations), `docs/governance/security.md` (the
six §13 security controls expanded into implementable statements split
between what this repository implements and what a downstream platform
must implement; a control-mapping table to ISO/IEC 27001/27002/27005/
27017/27018/27701/27034-1; service management (ISO/IEC 20000-1) and
business continuity (ISO 22301) with recommended RPO/RTO targets for
contest/judge/LMS, clearly marked as recommendations; software lifecycle
governance (ISO/IEC/IEEE 12207) mapped onto this repository's actual
issue→branch→PR→CI→review→merge→changeset→release workflow; product
quality (ISO/IEC 25010) and accessibility (ISO/IEC 40500/WCAG 2.2) as
downstream-platform requirements; ISO 21001 educational-management
alignment; and a seven-row risk register covering minors'-data exposure,
contest-integrity/problem leakage, judge availability, curriculum drift,
dependency supply-chain compromise, accessibility exclusion, and
compliance misrepresentation), and `docs/governance/incident-response.md`
(four severity levels with example scenarios drawn from the risk
register, roles, a per-severity response timeline, communication
expectations including the UU 27/2022 personal-data-breach escalation
duty, and a post-incident review procedure). All fourteen §11 standards
are cited by id. Adds `tests/unit/governance-docs.test.ts` asserting
standard-id coverage, control-section coverage, risk-register row
completeness, `SECURITY.md`'s reporting section, the incident-response
severity/timeline structure, and the absence of any invented-looking
email address across the governance documents.
