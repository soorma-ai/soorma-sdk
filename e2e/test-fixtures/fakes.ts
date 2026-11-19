// SPDX-License-Identifier: Apache-2.0
//
// Test helpers: a temporary working root, and fake `docker` and `git` first on
// PATH (TS-U2-09), each answering from its scenario and recording every
// invocation (fake-command.mjs).
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

export interface Rule {
  args: string[];
  prefix?: boolean;
  stdout?: string;
  stderr?: string;
  code?: number;
  hang?: boolean;
  ignoreTerm?: boolean;
  writeFiles?: Record<string, string>;
}

export interface Scenario {
  rules: Rule[];
  default?: Omit<Rule, 'args'>;
}

export interface Invocation {
  args: string[];
  cwd: string;
  env: string[];
}

/** The commands a test may fake: docker, git, pnpm, and a Node for --core-node. */
export type FakeName = 'docker' | 'git' | 'pnpm' | 'core-node';

export interface Fakes {
  root: string;
  bin: string;
  /** PATH for the commands under test: the fakes first. */
  path: string;
  /** The fake Node's path, for --core-node. */
  coreNode: string;
  scenario(command: FakeName, scenario: Scenario): void;
  calls(command: FakeName): Invocation[];
  /** Forgets every recorded invocation. */
  clearCalls(): void;
  cleanup(): void;
}

const FAKE = join(import.meta.dirname, 'fake-command.mjs');

export function makeFakes(): Fakes {
  const root = mkdtempSync(join(tmpdir(), 'soorma-e2e-test-'));
  const bin = join(root, 'bin');
  // The fake Node lives apart from bin/: only --core-node names it.
  const coreBin = join(root, 'core-bin');
  mkdirSync(bin);
  mkdirSync(coreBin);
  const where = (name: FakeName): string => (name === 'core-node' ? coreBin : bin);
  for (const name of ['docker', 'git', 'pnpm', 'core-node'] as const) {
    copyFileSync(FAKE, join(where(name), name));
    chmodSync(join(where(name), name), 0o755);
  }
  return {
    root,
    bin,
    path: `${bin}${delimiter}${process.env.PATH ?? ''}`,
    coreNode: join(coreBin, 'core-node'),
    scenario: (command, scenario) =>
      writeFileSync(join(where(command), `${command}.json`), JSON.stringify(scenario)),
    calls: (command) => {
      const log = join(where(command), `${command}.log`);
      if (!existsSync(log)) return [];
      return readFileSync(log, 'utf8')
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l) as Invocation);
    },
    clearCalls: () => {
      for (const name of ['docker', 'git', 'pnpm', 'core-node'] as const) {
        rmSync(join(where(name), `${name}.log`), { force: true });
      }
    },
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}
