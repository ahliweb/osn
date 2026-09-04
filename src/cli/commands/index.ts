/**
 * The command registry: every `osn` subcommand, in one array. This is the
 * seam that lets `plan` (#20), `render` (#21), `report` (#22) and
 * `checklist` (#25) be added later as a one-line addition here -- nothing
 * in `src/cli/run-cli.ts` (the dispatcher) needs to change.
 */

import type { Command } from "../command";
import { planCommand } from "./plan";
import { validateCommand } from "./validate";

/** Every registered `osn` subcommand, in the order they should be listed in `osn --help`. */
export const COMMANDS: readonly Command[] = [validateCommand, planCommand];

/** {@link COMMANDS}, indexed by name for O(1) dispatch lookup. */
export const COMMAND_REGISTRY: ReadonlyMap<string, Command> = new Map(
  COMMANDS.map((command) => [command.name, command]),
);
