# CI/CD pipeline

§13 ("Quality Review") of the operational syllabus requires an audit gate
before an artefact is used. Mechanically, that means every push and every
pull request runs the full local quality suite in CI, and nothing merges
without it passing.

## What runs, and in what order

The workflow is defined in `.github/workflows/ci.yml`. It has a single job,
`quality`, that runs the following steps in sequence on `ubuntu-latest`:

1. **Checkout** — `actions/checkout@v4`.
2. **Set up Bun** — `oven-sh/setup-bun@v2`, pinned to an exact Bun version
   (see "Action and tool pinning policy" below).
3. **Install dependencies** — `bun install --frozen-lockfile`. The frozen
   lockfile means CI fails if `bun.lock` is out of sync with `package.json`,
   rather than silently resolving different versions than local development.
4. **Check formatting** — `bun run format:check` (Biome, check-only — does
   not rewrite files).
5. **Lint** — `bun run lint` (Biome).
6. **Typecheck** — `bun run typecheck` (`tsc --noEmit`).
7. **Test with coverage** — `bun run test:coverage` (`bun test --coverage`).
   This also enforces the coverage gate configured in `bunfig.toml` — see
   `docs/development/testing.md`.
8. **Build** — `bun run build` (`bun build ./src/index.ts --outdir dist
   --target bun`).
9. **Validate curriculum data** — `bun run validate`. Until the curriculum
   validation CLI lands (issue #19), this script is a no-op placeholder that
   prints a TODO and exits `0`; it is wired into CI now so that landing the
   real implementation requires no workflow changes.

Steps run in this order deliberately: cheaper, faster checks (formatting,
lint, typecheck) fail fast before the more expensive test and build steps
run. Each step is a separate, individually named step (not one shell script)
so that a failure is attributable to a specific check from the GitHub
checks list, without needing to open the log.

## Triggers

The workflow runs on:

- `push` to `main`.
- `pull_request`, for any branch (targeting any base).

This means every PR gets a CI run against its proposed changes, and every
merge to `main` is re-verified on the resulting commit.

## Least-privilege permissions

The workflow sets a top-level `permissions: { contents: read }` block. This
is the minimum needed to check out the repository and run the quality
suite — nothing in this pipeline writes back to the repository, publishes a
release, or touches any other GitHub API surface, so no broader permission
(such as `contents: write`, `pull-requests: write`, or `packages: write`) is
granted anywhere in the workflow. If a future job needs to write (for
example, publishing a release), that permission should be scoped to that
specific job, not added to the top-level block.

## Action and tool pinning policy

- **GitHub Actions are pinned to a major version tag** (e.g. `@v4`,
  `@v2`), not to a full commit SHA and not to a floating `@main` or
  unpinned tag. This tracks the publisher's own compatibility promise for
  that major version (bug fixes and minor features land automatically,
  breaking changes do not) while still being an explicit, auditable
  reference rather than "whatever is newest today."
- **Bun is pinned to an exact version** via `bun-version` on
  `oven-sh/setup-bun@v2` — not a floating range like `latest` or `1.x`.
  Unlike an action's major-version tag, the Bun runtime itself directly
  affects test and build output (coverage engine, bundler, `bun:test`
  behavior all vary by version), so CI must use the same concrete version
  as local development rather than "whatever is newest at run time." The
  version pinned in `.github/workflows/ci.yml` should be kept in sync with
  whatever Bun version the project's contributors are expected to run
  locally; bump it deliberately, not as a side effect of an unrelated
  change.

## Concurrency behavior

The workflow sets:

```yaml
concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

Every push to the same ref (a branch or a PR head) shares one concurrency
group. When a new run starts for a group that already has a run in
progress, the older run is cancelled. In practice this means pushing two
commits to the same PR in quick succession does not run CI twice to
completion — only the latest push's result matters, so the superseded run
is cancelled rather than wasting runner time.

## Reproducing CI locally

Run the same steps CI runs, in the same order, with one command each:

```sh
bun install --frozen-lockfile && \
bun run format:check && \
bun run lint && \
bun run typecheck && \
bun run test:coverage && \
bun run build && \
bun run validate
```

Any step that fails locally will fail identically in CI, since CI runs
these exact `package.json` scripts with the same pinned Bun version — there
is no CI-only configuration or hidden step.
