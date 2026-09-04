# Requirements Register — How It Works

This register is the completeness oracle for the programme: it proves that everything the
source syllabus (`docs/silabus/`) asks for has been identified, is being built by a named
GitHub issue, and can be checked off with a concrete verification method. It exists because a
14-section, 41-reference curriculum document has no other mechanical way to prove nothing was
missed at release time (issue #26).

## Files

| File | Purpose |
| --- | --- |
| `README.md` (this file) | ID scheme, status vocabulary, verification methods, the completeness rule. |
| `register.md` | The full requirements register, grouped by category, one Markdown table per category. |
| `traceability.md` | Two matrices: syllabus section → requirements/issues, and issue → requirements. Proves the register is exhaustive in both directions. |

## ID scheme

Every requirement has a stable, permanent ID of the form `<PREFIX>-<nn>`, where `nn` is a
zero-padded two-digit sequence number starting at `01` within its prefix. IDs are never reused
or renumbered — once assigned, an ID is permanent for the life of the repository (renumbering
would break every cross-reference in `traceability.md`, past PRs and past changelog entries).

| Prefix | Category | Covers |
| --- | --- | --- |
| `FR-nn` | Functional | What the system must do: data model, CLI commands, generators, registers. |
| `TR-nn` | Technical / architectural | Toolchain, schema-first ordering, determinism, validation, CI. |
| `OR-nn` | Operational | Cohort readiness, syllabus check, runbook, coaching cycle, governance bodies. |
| `ER-nn` | Educational / pedagogical | Teaching rules: SOP, hint policy, session template, gates, assessment weights, status codes, KPI, playbooks, the "no rote memorisation" principle, the core-before-extension rule. |
| `GR-nn` | Governance / regulatory | Privacy, minors' data, ISO mapping, security controls, versioning/changelog. |

A requirement's category is chosen by what kind of claim it makes, not by which issue implements
it — a single issue commonly satisfies requirements from more than one category (for example
issue #15 satisfies both an `FR` data-model requirement and a `GR` privacy requirement).

## Status vocabulary

| Status | Meaning |
| --- | --- |
| `planned` | The requirement is identified and traced to a source section and an issue, but the implementing issue's acceptance criteria are not yet met in the codebase. |
| `implemented` | The artefact that satisfies the requirement (code, schema, data, CLI command, or document) exists in the repository and passes its stated verification method locally. This does not by itself imply the change has been merged to `main` — a requirement moves to `implemented` as soon as its own working tree contains the proof, and the merge is tracked by the normal PR process. |
| `verified` | `implemented`, and independently re-confirmed at a later checkpoint — either by a green CI run on `main`, or by the final re-verification pass at release time (issue #26). `verified` is strictly downstream of `implemented`; nothing skips straight to `verified`. |

A requirement is never marked `implemented` or `verified` on the strength of intent, a partial
implementation, or a different requirement's evidence. If a requirement is satisfied by more
than one issue, it stays `planned` until **all** of its listed issues have met this bar.

## How a requirement is verified

Every requirement in `register.md` names exactly one **verification method**, chosen from this
fixed set:

| Method | What it means here |
| --- | --- |
| `schema validation` | A Zod schema (or equivalent) rejects data that violates the requirement, and this is exercised by `osn validate` or by the schema's own parse call. |
| `unit test` | A `bun test` case in `tests/unit/` asserts the behaviour directly, with a hand-verifiable expected value. |
| `integration test` | A `bun test` case in `tests/integration/` exercises the requirement across module boundaries (e.g. CLI output, cross-register referential integrity, the full corpus). |
| `CI check` | The requirement is enforced by a step in `.github/workflows/ci.yml` (or an equivalent automated gate) rather than by a specific test file — for example, the coverage threshold or the requirements register checker itself. |
| `document review` | The requirement is a policy, procedure, or governance statement whose correctness is judged by human review against its source section, not by an executable check. |

No requirement may name a verification method that isn't in this table — that keeps
`scripts/check-requirements.ts` able to assert every row's `Verification` cell is one of a
known, finite set.

## The completeness rule

The register is only trustworthy if it is exhaustive in both directions. Concretely:

1. **No orphan requirement.** Every requirement row cites a non-empty `Source` (a syllabus
   section, or — for a handful of cross-cutting engineering/governance requirements — the
   document's front matter) and a non-empty `Issue(s)` reference into `#1`–`#26`. A requirement
   with no source or no implementing issue is not allowed to exist in `register.md`.
2. **No uncovered section.** Every numbered syllabus section, `§1` through `§14`, plus the
   reference list (`§99`, `docs/silabus/99-referensi.md`), contributes at least one requirement.
   This is asserted per-section in `traceability.md`'s first matrix.
3. **No uncovered issue.** Every issue `#1`–`#26` in the backlog is covered by at least one
   requirement. This is asserted per-issue in `traceability.md`'s second matrix.
4. **No drift between the register and the matrices.** The set of requirement IDs that appear
   anywhere in `traceability.md` is exactly the set of IDs defined in `register.md` — no more, no
   fewer, no typos.

`scripts/check-requirements.ts` (`bun run check:requirements`) parses both Markdown files and
asserts all four rules mechanically, and `tests/integration/requirements.test.ts` runs the same
assertions as part of `bun test` so a broken register fails CI like any other regression.

## Adding or changing a requirement

- Assign the next unused `nn` in the relevant prefix; never reuse a retired ID.
- Cite the syllabus section the requirement is actually derived from — do not invent a
  requirement the syllabus doesn't support, and do not paraphrase so loosely that the statement
  could apply to a different section.
- Write `Statement` as one sentence, testable ("the system shall…" / "every X shall…"), not a
  restatement of the syllabus prose.
- Add or update the corresponding row(s) in both matrices of `traceability.md` in the same change.
- Run `bun run check:requirements` before committing; it is the fastest way to catch a missed
  cross-reference.
