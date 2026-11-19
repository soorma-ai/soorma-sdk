// SPDX-License-Identifier: Apache-2.0
//
// The scheduler: a new driver process per case, a crash fails one case only,
// a case timeout fails that case and the next still runs, the run finishes
// then fails over budget naming the slowest cases, the watchdog, the flag
// guards, and the run directory's life. No retry exists.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { guardFlags, runConformance, summarise, type RunOptions } from '../run.ts';
import { RUN_PREFIX, makeRunDir, removeRunDir } from '../rundir.ts';
import type { StubControl } from '../types.ts';

const FIX = join(import.meta.dirname, '..', '..', 'test-fixtures');
const fakeStub = async (): Promise<StubControl> => ({
  urls: {
    S3: 'https://127.0.0.1:1',
    S4: 'https://127.0.0.1:2',
    UNTRUSTED: 'https://127.0.0.1:3',
    STRAY: 'https://127.0.0.1:4',
  },
  load: () => undefined,
  recording: () => [],
  streams: () => [],
  deliveries: () => [],
  concurrentStreamsMax: () => 0,
  stop: async () => undefined,
});
const base: RunOptions = {
  driver: ['node', join(FIX, 'fake-driver.ts')],
  mode: 'full',
  casesDir: join(FIX, 'cases'),
  specPath: join(FIX, 'spec.md'),
  fixtureCoverage: false,
  env: { ...process.env, CI: '', GITHUB_ACTIONS: '' },
};

describe('the scheduler', () => {
  it('starts a new driver process for every case; a crash fails that case only', async () => {
    const r = await runConformance(base, fakeStub);
    const byId = Object.fromEntries(r.results.map((x) => [x.id, x]));
    expect(byId['CC-AAA-01']?.status).toBe('pass');
    expect(byId['CC-AAA-02']?.status).toBe('fail');
    expect(byId['CC-AAA-02']?.failures.join(' ')).toMatch(/exited during start/);
    expect(byId['CC-AAA-03']?.status).toBe('pass');
    expect(r.failed).toEqual(['CC-AAA-02']);
    expect(r.ok).toBe(false);
  }, 30_000);

  it("passes a case's values to the driver's create exactly, and none when it has none", async () => {
    // Exactly the case's values, not merged with describe's (the fake reports H_renew).
    const r = await runConformance({ ...base, only: ['CC-AAA-06', 'CC-AAA-07'] }, fakeStub);
    const byId = Object.fromEntries(r.results.map((x) => [x.id, x]));
    expect(byId['CC-AAA-06']?.failures).toEqual([]);
    expect(byId['CC-AAA-06']?.status).toBe('pass');
    expect(byId['CC-AAA-07']?.failures).toEqual([]);
    expect(byId['CC-AAA-07']?.status).toBe('pass');
  }, 30_000);

  it('runs only the declared cases in reference mode, the rest not run', async () => {
    const r = await runConformance({ ...base, mode: 'reference' }, fakeStub);
    expect(r.results.filter((x) => x.status !== 'not-run').map((x) => x.id)).toEqual(['CC-AAA-01']);
    expect(r.ok).toBe(true);
  }, 30_000);

  it('finishes, then fails over budget, naming the slowest cases', async () => {
    // About 1.5 s of work against a 1 s budget: over it, under the watchdog (2 s).
    const r = await runConformance(
      { ...base, only: ['CC-AAA-01', 'CC-AAA-04'], budgetMs: 1000 },
      fakeStub,
    );
    expect(r.results.filter((x) => x.status === 'pass')).toHaveLength(2);
    expect(r.overBudget).toBe(true);
    expect(r.ok).toBe(false);
    expect(r.slowest[0]?.id).toBe('CC-AAA-04');
    expect(summarise(r)).toMatch(/OVER BUDGET[\s\S]*CC-AAA-04/);
  }, 30_000);

  it('stops a hung run at the watchdog (twice the budget), failing it', async () => {
    const r = await runConformance(
      { ...base, only: ['CC-AAA-04', 'CC-AAA-05'], budgetMs: 300 },
      fakeStub,
    );
    const byId = Object.fromEntries(r.results.map((x) => [x.id, x]));
    expect(byId['CC-AAA-04']?.status).toBe('fail');
    expect(byId['CC-AAA-05']?.status).toBe('not-run');
    expect(r.problems.join(' ')).toMatch(/watchdog stopped the run/);
    expect(r.ok).toBe(false);
  }, 30_000);

  it('treats any case not run in full mode as a failure', async () => {
    const r = await runConformance({ ...base, only: ['CC-AAA-01'] }, fakeStub);
    expect(r.problems.join(' ')).toMatch(/not run/);
    expect(r.ok).toBe(false);
  }, 30_000);
});

describe('the flag guards', () => {
  it('accepts --local-skip CC-SEC-05 only, and only outside CI', () => {
    expect(guardFlags({ ...base, localSkip: ['CC-SEC-05'] })).toEqual([]);
    expect(guardFlags({ ...base, localSkip: ['CC-SEC-01'] })).toEqual([
      '--local-skip accepts only CC-SEC-05, not CC-SEC-01',
    ]);
    expect(
      guardFlags({ ...base, localSkip: ['CC-SEC-05'], env: { GITHUB_ACTIONS: 'true' } }),
    ).toEqual(['--local-skip is refused in CI: CC-SEC-05 always runs there']);
  });

  it('runs a fault only in reference mode', () => {
    expect(guardFlags({ ...base, fault: 'retry-publish' })).toEqual([
      '--fault runs only in reference mode',
    ]);
  });

  it('offers no retry: the options have no such field', () => {
    const keys: (keyof RunOptions)[] = [
      'driver',
      'mode',
      'fault',
      'localSkip',
      'foreignUser',
      'budgetMs',
      'only',
      'env',
      'casesDir',
      'specPath',
      'fixtureCoverage',
    ];
    expect(keys.some((k) => /retr/i.test(k))).toBe(false);
  });
});

describe('the run directory', () => {
  it('is mode 0700 under the recognised prefix, and removed', () => {
    const dir = makeRunDir();
    expect(dir.startsWith(join(tmpdir(), RUN_PREFIX))).toBe(true);
    expect(statSync(dir).mode & 0o777).toBe(0o700);
    removeRunDir(dir);
    expect(existsSync(dir)).toBe(false);
  });

  it('leaves nothing behind after a run, even when cases fail', async () => {
    const before = readdirSync(tmpdir()).filter((n) => n.startsWith(RUN_PREFIX)).length;
    await runConformance({ ...base, only: ['CC-AAA-02'] }, fakeStub);
    expect(readdirSync(tmpdir()).filter((n) => n.startsWith(RUN_PREFIX)).length).toBe(before);
  }, 30_000);
});
