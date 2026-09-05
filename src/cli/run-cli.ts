/**
 * The `osn` CLI's dispatcher core: argv parsing, global flags
 * (`--help`/`-h`, `--version`/`-V`, `--json`), subcommand lookup, and exit
 * codes. Pure enough to unit-test directly: `runCli` takes its argv and
 * I/O (stdout/stderr writers, cwd) as explicit arguments instead of
 * reading `process.argv`/writing `process.stdout`/calling `process.exit`
 * itself, so a test can call it in-process, capture what it writes, and
 * assert on the returned exit code without spawning a subprocess or
 * exiting the test runner.
 *
 * `src/cli/index.ts` is the only place that touches real `process.*` --
 * it is a few lines that call `runCli` and then `process.exit` with the
 * result. Keeping that shell that thin is what keeps the "hard to unit
 * test, exit-code-driving" surface small enough for the 85% coverage gate
 * (see `docs/development/testing.md`) without asserting nothing.
 */

import packageJson from "../../package.json";
import type { CommandContext } from "./command";
import { EXIT_SUCCESS, EXIT_USAGE_ERROR, EXIT_VALIDATION_FAILURE } from "./command";
import { COMMAND_REGISTRY, COMMANDS } from "./commands";

/** The I/O `runCli` needs, injected by the caller. See this module's docblock for why. */
export interface RunCliIo {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
  readonly cwd: string;
}

function commandListLines(): string {
  const nameWidth = Math.max(...COMMANDS.map((command) => command.name.length));
  return COMMANDS.map((command) => `  ${command.name.padEnd(nameWidth)}   ${command.summary}`).join(
    "\n",
  );
}

/** The global `osn --help` / `osn` (no subcommand) usage text, built from {@link COMMANDS} so it can never drift from the actual registry. */
export function buildGlobalUsage(): string {
  return [
    "osn -- OSN Informatika 2026 curriculum CLI",
    "",
    "Usage: osn <command> [options]",
    "",
    "Commands:",
    commandListLines(),
    "",
    "Global flags:",
    "  -h, --help       Show this help, or a command's help with `osn <command> --help`.",
    "  -V, --version    Print the CLI version and exit.",
    "  --json           Emit machine-readable JSON output (where the command supports it).",
    "",
    "Exit codes:",
    "  0   success.",
    "  1   validation failure.",
    "  2   usage error (unknown command, bad flag, missing required argument).",
  ].join("\n");
}

/**
 * Runs the CLI for one invocation of `argv` (already stripped of the
 * `bun`/script-path leading entries -- i.e. exactly what a user typed
 * after `osn`). Writes output via `io.stdout`/`io.stderr` and returns the
 * process exit code; never calls `process.exit` itself.
 *
 * Dispatch order:
 *  1. `--version`/`-V` anywhere in `argv` -> print the version, exit 0.
 *     Highest precedence: even `osn --version bogus-command` prints the
 *     version rather than failing on the unknown command.
 *  2. No subcommand token (every arg starts with `-`, or `argv` is empty):
 *     `--help`/`-h` present -> global usage, exit 0; otherwise -> global
 *     usage on stderr, exit 2 (a subcommand is required).
 *  3. An unknown subcommand -> an error naming the valid commands, exit 2.
 *  4. A known subcommand with `--help`/`-h` among its remaining args ->
 *     that command's own help, exit 0 (handled here, once, so no command
 *     has to implement `--help` itself).
 *  5. Otherwise -> the command's `run`, with the subcommand token and
 *     `--json` stripped from its args. An exception thrown by `run` is
 *     caught here and reported without a raw stack trace (exit 1) -- see
 *     `Command.run`'s docblock.
 */
export async function runCli(argv: readonly string[], io: RunCliIo): Promise<number> {
  if (argv.includes("--version") || argv.includes("-V")) {
    io.stdout(`${packageJson.version}\n`);
    return EXIT_SUCCESS;
  }

  const commandName = argv.find((arg) => !arg.startsWith("-"));

  if (commandName === undefined) {
    if (argv.includes("--help") || argv.includes("-h")) {
      io.stdout(`${buildGlobalUsage()}\n`);
      return EXIT_SUCCESS;
    }
    io.stderr(`${buildGlobalUsage()}\n`);
    return EXIT_USAGE_ERROR;
  }

  const command = COMMAND_REGISTRY.get(commandName);
  if (command === undefined) {
    const validNames = COMMANDS.map((entry) => entry.name).join(", ");
    io.stderr(
      `osn: unknown command "${commandName}". Valid commands: ${validNames}. Run "osn --help" for usage.\n`,
    );
    return EXIT_USAGE_ERROR;
  }

  const commandIndex = argv.indexOf(commandName);
  const commandArgs = [...argv.slice(0, commandIndex), ...argv.slice(commandIndex + 1)];

  if (commandArgs.includes("--help") || commandArgs.includes("-h")) {
    io.stdout(`${command.help()}\n`);
    return EXIT_SUCCESS;
  }

  const json = commandArgs.includes("--json");
  const runArgs = commandArgs.filter((arg) => arg !== "--json");

  const ctx: CommandContext = { json, cwd: io.cwd, stdout: io.stdout, stderr: io.stderr };

  try {
    return await command.run(runArgs, ctx);
  } catch (cause) {
    io.stderr(`osn ${command.name}: unexpected error: ${(cause as Error).message}\n`);
    return EXIT_VALIDATION_FAILURE;
  }
}
