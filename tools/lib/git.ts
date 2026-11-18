// SPDX-License-Identifier: Apache-2.0
import { execFileSync } from 'node:child_process';

export type Git = (args: string[], cwd?: string) => string;

export const git: Git = (args, cwd) =>
  execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
  }).trim();
