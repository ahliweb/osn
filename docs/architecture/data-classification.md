# Data classification

Field-by-field privacy classification for the two schemas issue #15 adds:
the Learning Record (`src/schema/learning-record.ts`) and the Problem
Taxonomy (`src/schema/problem-taxonomy.ts`). This document is the
cross-link ADR-0004 promises from its "Decision detail: enforcement
mechanism" section.

**This repository stores no learner data.** Both schemas below are
*definitions* -- Zod shapes that a downstream platform's actual learner
data must satisfy -- not data. There is no `data/learning-records.json`
and there never will be one (see the module docblock of
`src/domain/learning-record.ts` and ADR-0004, "No learner personal data in
the repository"). Every classification below describes what a field
*would* mean if a downstream platform populated it, for that platform's
own use in designing its access controls.

## Classification vocabulary

Three levels, from least to most sensitive:

| Classification | Meaning |
| --- | --- |
| `public` | Safe to show without access control; already public curriculum content or equivalent. |
| `internal` | Not a direct identifier, but not for public display either -- learning-process/behavioural data that, combined with other fields, is a documented re-identification risk factor for a small cohort (ADR-0004). Requires the downstream platform's role-based access control. |
| `personal` | A direct or indirect identifier. **No field in `learningRecordSchema` is ever classified `personal`** -- that is the entire point of ADR-0004's design (an opaque `learnerRef` plus the `.strict()`/direct-identifier-guard defences). The classification exists as a category so the framework stays meaningful for any future schema that might need it, and so `isPersonalField()` in `src/domain/learning-record.ts` has a real predicate to check against. |

## Learning Record (`src/schema/learning-record.ts`)

Generated from `LEARNING_RECORD_CLASSIFICATION` in that module.
`tests/unit/learning-record.test.ts` asserts this table and that exported
map agree field-for-field, in both directions, so this table cannot drift
from the schema silently.

| Field | Classification | Notes |
| --- | --- | --- |
| `learnerRef` | internal | Opaque pseudonymous reference (`lr_[a-z0-9]{8,32}`). No derivable link to identity on its own; mapping it back to a person is a downstream platform's responsibility under its own access control (ADR-0004, GR-03) -- never this repository's concern. |
| `problemId` | public | Identifies the problem attempted, not the learner. A problem id is already public curriculum content, defined by `src/schema/problem-taxonomy.ts`. |
| `attemptNo` | internal | This attempt's 1-indexed position among the learner's attempts at this problem. Part of an individual behavioural pattern (ADR-0004 names "problem-attempt pattern" as a re-identification risk factor). |
| `verdict` | internal | The judge verdict (`AC`\|`WA`\|`TLE`\|`RE`\|`CE`\|`MLE`) for this attempt. |
| `durationSeconds` | internal | Wall-clock time spent on this attempt. |
| `hintLevelUsed` | internal | The highest §5.3 hint escalation level used, or null. |
| `usedEditorial` | internal | Whether the terminal §5.3 editorial hint level was used. |
| `errorTaxonomy` | internal | The §13.1 step-4 postmortem error class, or null. |
| `status` | internal | The §6.2 A/B/C/D problem-completion status. |
| `resolveStatus` | internal | The §13.1 step-5 upsolve/re-solve state. |
| `recordedAt` | internal | ISO 8601 UTC timestamp of capture -- timing patterns are also a re-identification risk factor for a small cohort. |

## Problem Taxonomy (`src/schema/problem-taxonomy.ts`)

Every field here is `public`: a problem's tags describe the *problem*, not
any learner, and are ordinary curriculum content of the same kind already
published in `data/topic-families.json` and `data/competition-stages.json`.

| Field | Classification | Notes |
| --- | --- | --- |
| `problemId` | public | The tagged problem's stable id. |
| `officialTopic` | public | One of the ten §2.1 topic-family ids. |
| `prerequisite` | public | Topic-family ids a learner should know beforehand. |
| `difficulty` | public | 1-5 difficulty band (see `data/problem-taxonomy-vocab.json`). |
| `stage` | public | One of the four §2.2 competition-stage ids. |
| `complexity` | public | Expected solution complexity class, in Big-O notation. |
| `commonTraps` | public | Trap categories a learner is likely to fall into. |
| `expectedSolution` | public | Expected solution technique class(es). |

## Retention and minimisation rule

This repository's own retention rule is trivial and absolute: **retain
none.** No `data/*.json` file may ever contain a real learning record or
real problem-taxonomy-adjacent learner data (there is no such thing as
"problem-taxonomy learner data" -- the taxonomy describes problems, not
people). `tests/unit/learning-record.test.ts` enforces this mechanically
by scanning every file under `data/` for keys matching
`DIRECT_IDENTIFIER_DENYLIST` (`src/schema/learning-record.ts`) and failing
if any are found.

For a **downstream platform** that does hold real learning records, this
repository's schemas already encode the minimisation half of the rule:
`learningRecordSchema`'s `.strict()` mode and its recursive
direct-identifier guard mean the *shape* itself cannot carry more than the
§13 Learning Record fields, however the platform's own database is
designed. The retention *schedule* (how long a real platform may keep
each field, and its deletion procedure) is policy for that platform to
set, not a control this repository can enforce at runtime -- it has no
runtime with users. That full policy, including the least-privilege
role matrix (GR-05), belongs in `docs/governance/privacy.md` (planned,
issue #23), cross-referenced from ADR-0004.

## Summary

- This repository defines schemas for learning records and problem
  taxonomy; it never stores real instances of either.
- Every learner identifier in the data model is the opaque, pseudonymous
  `learnerRef` -- never a name, email, school, or birthdate.
- `learningRecordSchema` rejects unknown keys (`.strict()`) and
  recursively scans for direct-identifier-shaped keys at any depth
  (`findDirectIdentifiers`/`assertNoDirectIdentifiers`).
- The full role-based-access, retention-schedule and consent-process
  policy this data model implies for a downstream platform is written in
  `docs/governance/privacy.md` (planned, issue #23), not here.

See also: ADR-0004 (`docs/architecture/adr/0004-no-learner-personal-data.md`),
`docs/silabus/13-tata-kelola.md` (§13), `docs/silabus/10-regulasi-indonesia.md`
(§10).
