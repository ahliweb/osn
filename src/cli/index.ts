#!/usr/bin/env bun
/**
 * The `osn` command-line entrypoint (issue #19).
 *
 * Deliberately a thin shell: all dispatch logic lives in
 * `src/cli/run-cli.ts`'s `runCli`, which is pure enough to unit-test
 * in-process (see its docblock). This file's only job is to hand it the
 * real `process.argv`/`process.stdout`/`process.stderr`/`process.cwd()`
 * and translate its returned exit code into an actual `process.exit` call
 * -- the one thing that cannot itself be meaningfully unit-tested, so it
 * is kept to as few lines as possible per the coverage-gate guidance in
 * `docs/development/testing.md`.
 */

import { runCli } from "./run-cli";

if (import.meta.main) {
  const exitCode = await runCli(process.argv.slice(2), {
    stdout: (text) => {
      process.stdout.write(text);
    },
    stderr: (text) => {
      process.stderr.write(text);
    },
    cwd: process.cwd(),
  });
  process.exit(exitCode);
}
