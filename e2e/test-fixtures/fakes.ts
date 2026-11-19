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

export interface Fakes {
  root: string;
  bin: string;
  /** PATH for the commands under test: the fakes first. */
  path: string;
  scenario(command: 'docker' | 'git', scenario: Scenario): void;
  calls(command: 'docker' | 'git'): Invocation[];
  cleanup(): void;
}

const FAKE = join(import.meta.dirname, 'fake-command.mjs');

export function makeFakes(): Fakes {
  const root = mkdtempSync(join(tmpdir(), 'soorma-e2e-test-'));
  const bin = join(root, 'bin');
  mkdirSync(bin);
  for (const name of ['docker', 'git']) {
    copyFileSync(FAKE, join(bin, name));
    chmodSync(join(bin, name), 0o755);
  }
  return {
    root,
    bin,
    path: `${bin}${delimiter}${process.env.PATH ?? ''}`,
    scenario: (command, scenario) =>
      writeFileSync(join(bin, `${command}.json`), JSON.stringify(scenario)),
    calls: (command) => {
      const log = join(bin, `${command}.log`);
      if (!existsSync(log)) return [];
      return readFileSync(log, 'utf8')
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l) as Invocation);
    },
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}
