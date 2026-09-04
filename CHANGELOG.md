# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Version numbers here (`vX.Y.Z`) track the software in this repository —
schema, domain model, CLI, and tooling. They are independent of the
curriculum corpus's own `syllabusVersion` (see
`docs/development/releasing.md` for how the two relate).

## [Unreleased]

### Added

- Project scaffolding: Bun + TypeScript + Biome, with strict compiler
  options and a shared lint/format configuration.
- Zod as the schema/validation dependency for curriculum data.
- Test harness on `bun:test`, with `bunfig.toml` coverage collection and an
  enforced 85% line/function coverage gate (`docs/development/testing.md`).
- Continuous integration workflow (`.github/workflows/ci.yml`) running
  format check, lint, typecheck, test with coverage, build, and curriculum
  validation on every push and pull request (`docs/development/ci-cd.md`).
- Release engineering: `@changesets/cli`, `CHANGELOG.md`, and
  `docs/development/releasing.md` documenting the changeset workflow and
  the curriculum-to-SemVer version-bump policy.

<!-- Compare links: keep the newest release at the top, immediately above
     this comment, as `[vX.Y.Z]: <compare-url>`. There is no tagged release
     yet, so [Unreleased] compares from the initial commit to the tip of
     `main`; once `v0.0.1` (or whatever the first tag turns out to be) is
     cut, add a `[vX.Y.Z]` entry above and repoint [unreleased] to compare
     from that tag. -->

[unreleased]: https://github.com/ahliweb/osn/compare/132c295...main
