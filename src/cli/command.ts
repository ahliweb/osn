/**
 * The `Command` interface every `osn` subcommand implements, plus the
 * per-invocation context passed to it.
 *
 * This is the seam issue #19 is required to design without implementing
 * `plan`/`render`/`report`/`checklist` (issues #20-#22, #25): a future
 * command is a new module exporting a `Command`, added to the array in
 * `src/cli/commands/index.ts` -- nothing in `src/cli/run-cli.ts` (the
 * dispatcher) needs to change to add one.
 */

/**
 * Per-invocation context a command's `run` receives. `stdout`/`stderr` are
 * injected (rather than the command calling `console.log`/`process.exit`
 * itself) so the whole CLI is testable in-process: a test can call
 * `runCli`/a command's `run` directly, capture what it writes, and assert
 * on the returned exit code without spawning a subprocess or actually
 * exiting the test process. See `src/cli/run-cli.ts`'s docblock.
 */
export interface CommandContext {
  /** Whether the global `--json` flag was passed. */
  readonly json: boolean;
  /** The working directory to resolve any relative paths against. */
  readonly cwd: string;
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

/** One `osn` subcommand. */
export interface Command {
  /** The subcommand's name as typed on the command line, e.g. `"validate"`. */
  readonly name: string;
  /** A one-line summary, shown in the global `osn --help` command list. */
  readonly summary: string;
  /** This command's own `osn <name> --help` text. Called by the dispatcher, not by the command itself -- see `run-cli.ts`. */
  readonly help: () => string;
  /**
   * Runs the command. `args` is `argv` with the subcommand name and the
   * global `--json`/`--help`/`-h` flags already stripped out by the
   * dispatcher (the dispatcher handles `--help` itself by calling
   * {@link Command.help} instead of `run`; see `run-cli.ts`).
   *
   * Returns the process exit code: `0` success, `1` validation failure,
   * `2` usage error. Must never throw for an ordinary bad-input case --
   * report the problem via `ctx.stderr` and return the right code instead;
   * an uncaught exception here is treated as an internal error by the
   * dispatcher (formatted, not surfaced as a raw stack trace) and reported
   * as exit `1`.
   */
  readonly run: (args: readonly string[], ctx: CommandContext) => Promise<number> | number;
}

/** The three exit codes every `osn` command uses, applied consistently. */
export const EXIT_SUCCESS = 0;
export const EXIT_VALIDATION_FAILURE = 1;
export const EXIT_USAGE_ERROR = 2;
