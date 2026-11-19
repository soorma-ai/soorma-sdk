// SPDX-License-Identifier: Apache-2.0
//
// The command-line entries' options (plan 1.1). Every value the commands take
// as an option is fixed here: this repository's root, soorma-core's local stack
// (GEN-05), TS-U2-11's limits and the inherited PATH. No argument, environment
// variable or CI setting changes them (GEN-01): the arguments are only the ones
// each command documents. A test pins these values.
import { isAbsolute, resolve } from 'node:path';
import type { CoreDownOptions } from '../core-down.ts';
import type { CoreUpOptions } from '../core-up.ts';
import { LIMITS, REPOSITORY_ROOT } from '../stack.ts';

export class UsageError extends Error {}

export const print = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

const fixed = (env: NodeJS.ProcessEnv) => ({
  repositoryRoot: REPOSITORY_ROOT,
  root: REPOSITORY_ROOT,
  limits: LIMITS,
  path: env.PATH ?? '',
  print,
});

/** core-up --core-node <path> */
export function coreUpOptions(argv: readonly string[], env: NodeJS.ProcessEnv): CoreUpOptions {
  if (argv.length !== 2 || argv[0] !== '--core-node' || !argv[1]) {
    throw new UsageError('usage: pnpm e2e:core-up --core-node <path to Node 26.13.0>');
  }
  const coreNode = isAbsolute(argv[1]) ? argv[1] : resolve(argv[1]);
  return { ...fixed(env), coreNode };
}

/** core-down [--logs] */
export function coreDownOptions(argv: readonly string[], env: NodeJS.ProcessEnv): CoreDownOptions {
  if (argv.length > 1 || (argv.length === 1 && argv[0] !== '--logs')) {
    throw new UsageError('usage: pnpm e2e:core-down [--logs]');
  }
  return { ...fixed(env), logs: argv[0] === '--logs' };
}

/** Runs a command's entry: usage errors exit 2, the command's own status otherwise. */
export async function main<T>(
  build: (argv: readonly string[], env: NodeJS.ProcessEnv) => T,
  run: (options: T) => Promise<number>,
): Promise<void> {
  let options: T;
  try {
    options = build(process.argv.slice(2), process.env);
  } catch (error) {
    if (error instanceof UsageError) {
      print(error.message);
      process.exitCode = 2;
      return;
    }
    throw error;
  }
  process.exitCode = await run(options);
}
