// SPDX-License-Identifier: Apache-2.0
//
// The end-to-end jobs as ci.yml defines them: TC-ES-008(b) (core-down runs
// always, searches every run, and prints logs exactly when the job failed or
// was cancelled), TC-ES-009 (triggers and settings), TC-ES-010 (the changes
// job's own script, run in a temporary git repository: plan 1.2). The scripts
// are read from ci.yml and run with bash, so the test exercises the text CI
// runs, not a copy of it.
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { REPOSITORY_ROOT } from './stack.ts';

interface Step {
  name?: string;
  id?: string;
  if?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  env?: Record<string, string>;
}
interface Job {
  name?: string;
  if?: string;
  needs?: string | string[];
  'runs-on'?: string;
  'timeout-minutes'?: number;
  outputs?: Record<string, string>;
  permissions?: unknown;
  steps: Step[];
}
interface Workflow {
  on: Record<string, unknown>;
  permissions: unknown;
  jobs: Record<string, Job>;
}

const CI = parse(
  readFileSync(join(REPOSITORY_ROOT, '.github', 'workflows', 'ci.yml'), 'utf8'),
) as Workflow;
const changes = CI.jobs.changes as Job;
const e2e = CI.jobs['e2e-typescript'] as Job;
const step = (job: Job, name: string): Step => {
  const s = job.steps.find((x) => x.name?.startsWith(name));
  if (!s) throw new Error(`no step ${name}`);
  return s;
};

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'soorma-e2e-workflow-'));
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

const bash = (script: string, env: Record<string, string>, cwd: string): string =>
  execFileSync('bash', ['-e', '-c', script], {
    cwd,
    env: { PATH: process.env.PATH ?? '', HOME: tmp, ...env },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

describe('TC-ES-009: triggers and the jobs’ settings', () => {
  it('runs on pull requests and pushes to dev only; never the end-to-end jobs on a push to main', () => {
    expect(Object.keys(CI.on).sort()).toEqual(['pull_request', 'push']);
    expect(CI.on.push).toEqual({ branches: ['dev'] });
    expect(changes.if).toBe("github.event_name != 'push' || github.ref != 'refs/heads/main'");
    expect(e2e.needs).toBe('changes');
    expect(e2e.if).toBe("needs.changes.outputs.e2e == 'true'");
  });

  it('e2e: ubuntu-24.04, 20 minutes, read-only, no cache, and the four commands in order', () => {
    expect(CI.permissions).toEqual({ contents: 'read' });
    for (const job of [changes, e2e]) {
      expect(job['runs-on']).toBe('ubuntu-24.04');
      expect(job.permissions).toBeUndefined();
    }
    expect(e2e['timeout-minutes']).toBe(20);
    const text = JSON.stringify(e2e);
    expect(text).not.toMatch(/actions\/cache|"cache"|upload-artifact|secrets\./);
    expect(step(e2e, 'core-up').run).toBe('pnpm e2e:core-up --core-node "$CORE_NODE"');
    expect(step(e2e, 'core-up').env).toEqual({ CORE_NODE: '${{ steps.core-node.outputs.path }}' });
    expect(step(e2e, 'setup').run).toBe('pnpm e2e:setup --agents agent-a,agent-b');
    expect(step(e2e, 'prove-stack').run).toBe('pnpm e2e:prove-stack');
    const names = e2e.steps.map((s) => s.name ?? '');
    const at = (n: string) => names.findIndex((x) => x.startsWith(n));
    expect(at('core-up')).toBeLessThan(at('setup'));
    expect(at('setup')).toBeLessThan(at('prove-stack'));
    expect(at('prove-stack')).toBeLessThan(at('core-down'));
    expect(at('core-down')).toBe(names.length - 1);
  });
});

describe('JOB-06: e2e-typescript runs the TypeScript scenario (U3; TH-E2E-05)', () => {
  it('builds the package before core-up, and runs the scenario after prove-stack and before core-down', () => {
    expect(step(e2e, 'Build @soorma/sdk').run).toBe('pnpm --filter @soorma/sdk build');
    expect(step(e2e, 'The TypeScript scenario').run).toBe('pnpm e2e:scenario-typescript');
    expect(step(e2e, 'The TypeScript scenario').if).toBeUndefined();
    const names = e2e.steps.map((s) => s.name ?? '');
    const at = (n: string) => names.findIndex((x) => x.startsWith(n));
    expect(at('Build @soorma/sdk')).toBeLessThan(at('core-up'));
    expect(at('prove-stack')).toBeLessThan(at('The TypeScript scenario'));
    expect(at('The TypeScript scenario')).toBeLessThan(at('core-down'));
    expect(CI.jobs.e2e).toBeUndefined();
  });
});

describe('TC-ES-008(b): core-down always runs, and prints logs exactly when the job failed or was cancelled', () => {
  const down = step(e2e, 'core-down');

  it('has if: always() and the job status from the job context', () => {
    expect(down.if).toBe('always()');
    expect(down.env).toEqual({ JOB_STATUS: '${{ job.status }}' });
  });

  it.each([
    ['success', 'e2e:core-down'],
    ['failure', 'e2e:core-down --logs'],
    ['cancelled', 'e2e:core-down --logs'],
  ])('job status %s runs pnpm %s (the search runs either way: LS-11)', (status, expected) => {
    // A fake pnpm that records its arguments.
    const bin = join(tmp, 'bin');
    mkdirSync(bin);
    writeFileSync(
      join(bin, 'pnpm'),
      '#!/usr/bin/env bash\necho "$*" >> "$(dirname "$0")/pnpm.log"\n',
    );
    chmodSync(join(bin, 'pnpm'), 0o755);
    bash(
      down.run ?? '',
      { JOB_STATUS: status, PATH: `${bin}${delimiter}${process.env.PATH ?? ''}` },
      tmp,
    );
    expect(readFileSync(join(bin, 'pnpm.log'), 'utf8')).toBe(`${expected}\n`);
  });
});

describe('TC-ES-010: the changes job decides on the diff, and fails safe', () => {
  const script = step(changes, 'Decide').run ?? '';
  let repo: string;
  const git = (...args: string[]): string =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], {
      cwd: repo,
      encoding: 'utf8',
    }).trim();
  const commit = (files: Record<string, string>, remove: string[] = []): string => {
    for (const [f, text] of Object.entries(files)) {
      mkdirSync(dirname(join(repo, f)), { recursive: true });
      writeFileSync(join(repo, f), text);
    }
    for (const f of remove) git('rm', '-q', f);
    git('add', '-A');
    git('commit', '-q', '--allow-empty', '-m', 'c');
    return git('rev-parse', 'HEAD');
  };
  const decide = (base: string, head: string, event = 'push'): string => {
    const out = join(tmp, `out-${Math.random()}`);
    writeFileSync(out, '');
    const env = { EVENT: event, PR_BASE: '', PUSH_BEFORE: '', HEAD_SHA: head, GITHUB_OUTPUT: out };
    if (event === 'pull_request') env.PR_BASE = base;
    else env.PUSH_BEFORE = base;
    bash(script, env, repo);
    return readFileSync(out, 'utf8').trim();
  };

  beforeEach(() => {
    repo = join(tmp, 'repo');
    mkdirSync(repo);
    git('init', '-q');
    commit({ 'aidlc-docs/a.md': 'a\n', 'src/x.ts': 'x\n' });
  });

  it('an aidlc-docs/-only change skips the job, on a push and on a pull request', () => {
    const base = git('rev-parse', 'HEAD');
    const head = commit({ 'aidlc-docs/a.md': 'changed\n' });
    expect(decide(base, head)).toBe('e2e=false');
    expect(decide(base, head, 'pull_request')).toBe('e2e=false');
  });

  it('a change to aidlc-docs/ and one other file runs it', () => {
    const base = git('rev-parse', 'HEAD');
    expect(decide(base, commit({ 'aidlc-docs/a.md': 'b\n', 'src/x.ts': 'y\n' }))).toBe('e2e=true');
  });

  it('a rename out of aidlc-docs/ runs it: both sides count', () => {
    const base = git('rev-parse', 'HEAD');
    git('mv', 'aidlc-docs/a.md', 'src/a.md');
    git('commit', '-q', '-m', 'mv');
    expect(decide(base, git('rev-parse', 'HEAD'))).toBe('e2e=true');
  });

  it('a missing base, the zero SHA, or a diff that cannot be computed runs it', () => {
    const head = commit({ 'aidlc-docs/a.md': 'c\n' });
    expect(decide('', head)).toBe('e2e=true');
    expect(decide('0'.repeat(40), head)).toBe('e2e=true');
    expect(decide('deadbeef'.repeat(5), head)).toBe('e2e=true');
  });

  it('an empty diff runs it', () => {
    const head = git('rev-parse', 'HEAD');
    expect(decide(head, head)).toBe('e2e=true');
  });
});
