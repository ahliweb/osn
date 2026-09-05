# Contributing

Thanks for contributing to `osn-informatika-2026`. This document covers
branch naming, commit style, the PR process, and how to propose a
curriculum change. For AI agent-specific instructions (repository layout,
command table, workflow ordering), see `AGENTS.md`.

## Branch naming

`<type>/<short-slug>`, where `<type>` is one of:

| Type | Use for |
| --- | --- |
| `feat/` | New functionality (schema, CLI, data, docs sections). |
| `fix/` | Bug fixes. |
| `docs/` | Documentation-only changes. |
| `chore/` | Tooling, CI, dependency, or release-process changes. |

Example: `feat/m1-engineering-foundation`, `docs/agent-instructions`.

## Commit convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <short summary>
```

Common types: `feat`, `fix`, `docs`, `chore`, `test`, `refactor`. Reference
the issue the commit addresses where relevant (e.g. `feat: add topic-family
schema (#9)`).

## Pull requests

Every PR uses the existing template
(`.github/pull_request_template.md`), which checks:

- Linked to an issue (`Closes #...`).
- Scope is atomic — one issue, no unrelated changes bundled in.
- Tests added/updated.
- All local checks pass: `bun run format:check`, `bun run lint`, `bun run
  typecheck`, `bun run test:coverage`, `bun run build`, `bun run validate`,
  `bun run privacy-check`.
- Docs updated (`docs/`) if behavior, setup, or process changed.
- Changeset added if the change is user-visible (see
  `docs/development/releasing.md`).
- Acceptance criteria from the linked issue are met.
- Syllabus check done (per §14.2 rule 8) if curriculum data changed.
- No secrets, credentials, or personal data committed.

### Review expectations

- One issue per PR — reviewers may ask for a PR to be split if it exceeds
  its linked issue's scope.
- CI (`.github/workflows/ci.yml`) must pass before merge.
- A reviewer checks the PR template's checklist against the actual diff,
  not just that the boxes are ticked.
- For curriculum content changes, the reviewer verifies the syllabus check
  (official source, date checked, changelog impact) is actually recorded,
  not just present as an empty checkbox.

## Proposing a curriculum change

Curriculum content (syllabus data, problem taxonomy, calendar, rubrics,
etc.) is never edited casually. To propose or record a change:

1. Open a **Curriculum change** issue using the
   `.github/ISSUE_TEMPLATE/curriculum-change.yml` form.
2. Fill in the official source checked (OSN: `osn.toki.id/silabus` and its
   OSN-K/OSN-P pages; IOI: `ioinformatics.org/page/syllabus/12`), the date
   checked, what changed, and the expected changelog/version impact.
3. Only after the syllabus check is recorded should the corresponding
   schema/data/domain change be implemented, following the ordering rule
   in `AGENTS.md` (schema first, then data, then domain, then tests).
4. Include a changeset with the PR (see `docs/development/releasing.md`).

## Local verification

Before opening a PR, run:

```sh
bun install --frozen-lockfile
bun run format:check
bun run lint
bun run typecheck
bun run test:coverage
bun run build
bun run validate
bun run privacy-check
```

These are the exact steps CI runs, in the same order (see
`docs/development/ci-cd.md`).
