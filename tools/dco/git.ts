// SPDX-License-Identifier: Apache-2.0
//
// The commits of a pull request, read with git: non-merge commits only
// (`git rev-list --no-merges base..head`), oldest first.
import { execFileSync } from 'node:child_process';
import type { CommitMeta } from './check.ts';

const git = (cwd: string, args: string[]): string =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

export function listCommits(cwd: string, base: string, head: string): CommitMeta[] {
  const shas = git(cwd, ['rev-list', '--no-merges', '--reverse', `${base}..${head}`])
    .split('\n')
    .filter((s) => s.length > 0);
  return shas.map((sha) => {
    const [name = '', email = '', subject = '', message = ''] = git(cwd, [
      'show',
      '-s',
      '--format=%an%x00%ae%x00%s%x00%B',
      sha,
    ]).split('\0');
    return { sha, name, email, subject, message };
  });
}
