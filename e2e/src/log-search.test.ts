// SPDX-License-Identifier: Apache-2.0
//
// The log search (LS-01 to LS-12), against recorded log text and the vendored
// contract: TC-ES-013 (each typed prefix), TC-ES-014 (exact values), TC-ES-015
// (the search's part: clean logs printed only when asked), TC-ES-016
// (unreadable sources, a timed-out read), TC-ES-017 (the prefixes come from the
// contract), and LS-12 (no container, no search).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeFakes, type Fakes } from '../test-fixtures/fakes.ts';
import {
  decide,
  fails,
  K_NOT_SEARCHABLE,
  patternFor,
  prefixesFrom,
  report,
  search,
  SearchSetupError,
  type ServiceLog,
} from './log-search.ts';
import { gatherSources } from './log-sources.ts';
import { CLONE, layout, LIMITS, REPOSITORY_ROOT } from './stack.ts';

const CREDENTIALS = readFileSync(
  join(REPOSITORY_ROOT, 'contract', 'conventions', 'credentials.md'),
  'utf8',
);
const PREFIXES = prefixesFrom(CREDENTIALS);
const TAG = 'contract-v0.1.0+core.2';
const TOKEN = 'eyJhbGciOiJFZDI1NTE5In0.e30.c2ln';

const clean: ServiceLog[] = [
  { service: 'org-gateway', text: '{"level":"info","msg":"listening","port":8441}\n' },
  { service: 'control-gateway', text: '{"level":"info","msg":"grant issued","grant":"g-1"}\n' },
];

/** Every printed line, joined: what a reader of the job's log would see. */
const printed = (lines: string[]): string => lines.join('\n');

describe('TC-ES-017: the prefixes come from the vendored contract', () => {
  it('reads the six typed prefixes and their kinds from credentials.md', () => {
    expect(PREFIXES).toEqual([
      { prefix: 'soorma_ac_', kind: 'Agent credential' },
      { prefix: 'soorma_ec_', kind: 'Human environment credential' },
      { prefix: 'soorma_si_', kind: 'Organization sign-in' },
      { prefix: 'soorma_dc_', kind: 'Delegation credential' },
      { prefix: 'soorma_rs_', kind: 'registration secret' },
      { prefix: 'soorma_em_', kind: 'enrollment material' },
    ]);
  });

  it('fails closed when no prefix is readable', () => {
    const stripped = CREDENTIALS.replace(/`soorma_[a-z0-9]+_`/g, '`(removed)`');
    expect(() => prefixesFrom(stripped)).toThrow(SearchSetupError);
  });

  it('fails closed when a prefix has no readable kind', () => {
    expect(() => prefixesFrom('Some text with `soorma_zz_` and no name.\n')).toThrow(
      'no kind readable for soorma_zz_ in credentials.md',
    );
  });
});

describe('TC-ES-013: each typed prefix followed by token characters is a hit', () => {
  it.each(PREFIXES)('$prefix ($kind)', ({ prefix, kind }) => {
    const value = `${prefix}${TOKEN}`;
    const logs: ServiceLog[] = [
      ...clean,
      {
        service: 'data-gateway',
        text: `{"level":"debug","msg":"request","auth":"Bearer ${value}"}\n`,
      },
    ];
    const outcome = decide([], logs, PREFIXES, []);
    expect(outcome).toEqual({ kind: 'hit', hits: [{ service: 'data-gateway', kind }] });
    expect(fails(outcome)).toBe(true);
    const out = printed(report(outcome, true, TAG));
    expect(out).toBe(
      [
        `core-down: data-gateway's log holds a secret value (kind: ${kind}): a soorma-core logging defect. Not printing any log. Raise it as a soorma-core issue naming data-gateway and ${TAG}, without the value.`,
        K_NOT_SEARCHABLE,
      ].join('\n'),
    );
    // Neither the value nor any log line, not even a clean service's.
    expect(out).not.toContain(TOKEN);
    expect(out).not.toContain('listening');
  });

  it('every token character continues a hit; a bare prefix is not one', () => {
    for (const c of ['A', 'z', '0', '-', '.', '_', '~', '+', '/']) {
      expect(patternFor('soorma_ac_').test(`soorma_ac_${c}`)).toBe(true);
    }
    const bare = [
      { service: 'org-gateway', text: 'credentials use the soorma_si_ prefix; "soorma_ac_" too\n' },
    ];
    expect(search(bare, PREFIXES, [])).toEqual([]);
  });

  it('names each service that holds one, once per kind', () => {
    const logs: ServiceLog[] = [
      { service: 'org-gateway', text: `soorma_si_${TOKEN} soorma_si_${TOKEN}x\n` },
      { service: 'control-gateway', text: `soorma_ec_${TOKEN}\n` },
    ];
    expect(search(logs, PREFIXES, [])).toEqual([
      { service: 'org-gateway', kind: 'Organization sign-in' },
      { service: 'control-gateway', kind: 'Human environment credential' },
    ]);
  });
});

describe('TC-ES-014: exact values are hits too', () => {
  it('finds the exact enrollment material and an exact agent secret, printing neither', () => {
    // Exact values need no prefix to be found.
    const material = 'material-without-prefix-7Q2';
    const secret = 'agent-secret-without-prefix-K9';
    const logs: ServiceLog[] = [
      { service: 'org-gateway', text: `first authentication for ${material}\n` },
      { service: 'data-gateway', text: '', stderr: `bootstrap ${secret}\n` },
    ];
    const outcome = decide([], logs, PREFIXES, [
      { value: material, kind: 'enrollment material (exact value)' },
      { value: secret, kind: 'agent secret (exact value)' },
    ]);
    expect(outcome).toEqual({
      kind: 'hit',
      hits: [
        { service: 'org-gateway', kind: 'enrollment material (exact value)' },
        { service: 'data-gateway', kind: 'agent secret (exact value)' },
      ],
    });
    const out = printed(report(outcome, true, TAG));
    expect(out).not.toContain(material);
    expect(out).not.toContain(secret);
  });
});

describe("TC-ES-015 (the search's part): clean logs are printed only when asked", () => {
  it('prints each clean log, service by service, with --logs', () => {
    const lines = report(decide([], clean, PREFIXES, []), true, TAG);
    expect(lines).toEqual([
      '----- org-gateway (searched, clean) -----',
      '{"level":"info","msg":"listening","port":8441}',
      '----- control-gateway (searched, clean) -----',
      '{"level":"info","msg":"grant issued","grant":"g-1"}',
      K_NOT_SEARCHABLE,
    ]);
  });

  it('prints one line per service and no log text without --logs (LS-11)', () => {
    const outcome = decide([], clean, PREFIXES, []);
    expect(fails(outcome)).toBe(false);
    expect(report(outcome, false, TAG)).toEqual([
      'core-down: org-gateway: log searched, clean',
      'core-down: control-gateway: log searched, clean',
      K_NOT_SEARCHABLE,
    ]);
  });
});

describe('the sources (TC-ES-016; LS-12)', () => {
  let fakes: Fakes;
  const ps = ['compose', '-p', 'soorma-local', 'ps', '--all', '--services'];
  const logsOf = (s: string): string[] => [
    'compose',
    '-p',
    'soorma-local',
    'logs',
    '--no-color',
    '--no-log-prefix',
    s,
  ];
  const options = () => ({
    repositoryRoot: REPOSITORY_ROOT,
    layout: layout(fakes.root),
    limits: { ...LIMITS, logs: 300, other: 2_000, killGrace: 200 },
    path: fakes.path,
  });
  const handover = (text: string): void => {
    const dir = join(layout(fakes.root).clone, CLONE.handover);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'first-admin-1.txt'), text);
  };

  beforeEach(() => {
    fakes = makeFakes();
  });
  afterEach(() => fakes.cleanup());

  it('reads every service log, the handover material and the agent secrets', async () => {
    handover('principal: h@example.com\nenrollmentMaterial: soorma_em_abc\n');
    const l = layout(fakes.root);
    mkdirSync(l.secrets, { recursive: true });
    writeFileSync(join(l.secrets, 'agent-a.secret'), 'soorma_rs_xyz\n');
    fakes.scenario('docker', {
      rules: [
        { args: ps, stdout: 'org-gateway\ndata-gateway\n' },
        { args: logsOf('org-gateway'), stdout: 'ok\n' },
        { args: logsOf('data-gateway'), stdout: 'fine\n' },
      ],
    });
    const g = await gatherSources(options());
    expect(g).toEqual({
      kind: 'gathered',
      prefixes: PREFIXES,
      exact: [
        { value: 'soorma_rs_xyz', kind: 'agent secret (exact value)' },
        { value: 'soorma_em_abc', kind: 'enrollment material (exact value)' },
      ],
      logs: [
        { service: 'org-gateway', text: 'ok\n' },
        { service: 'data-gateway', text: 'fine\n' },
      ],
      unreadable: [],
    });
    // No secret reached docker: not as an argument (the fake records every one).
    expect(JSON.stringify(fakes.calls('docker'))).not.toContain('soorma_');
  });

  it('names an unreadable log, a timed-out log and a missing handover directory, and prints no log', async () => {
    fakes.scenario('docker', {
      rules: [
        { args: ps, stdout: 'org-gateway\ncontrol-gateway\ndata-gateway\n' },
        { args: logsOf('org-gateway'), stdout: 'clean text\n' },
        { args: logsOf('control-gateway'), code: 1 },
        { args: logsOf('data-gateway'), hang: true },
      ],
    });
    const g = await gatherSources(options());
    if (g.kind !== 'gathered') throw new Error('expected sources');
    expect(g.unreadable).toEqual([
      `the handover directory ${CLONE.handover}`,
      "control-gateway's log",
      "data-gateway's log (timed out)",
    ]);
    const outcome = decide(g.unreadable, g.logs, g.prefixes, g.exact);
    expect(fails(outcome)).toBe(true);
    const out = printed(report(outcome, true, TAG));
    expect(out).not.toContain('clean text');
    expect(out).toContain(
      "core-down: could not read data-gateway's log (timed out): not printing any log",
    );
  });

  it('fails closed when the container list cannot be read', async () => {
    handover('enrollmentMaterial: soorma_em_abc\n');
    fakes.scenario('docker', { rules: [{ args: ps, code: 1 }] });
    const g = await gatherSources(options());
    if (g.kind !== 'gathered') throw new Error('expected sources');
    expect(g.unreadable).toEqual(['the soorma-local container list']);
  });

  it('LS-12: with no container there is no log, and no value source is read', async () => {
    // No handover directory: it is not read, so it is not unreadable.
    fakes.scenario('docker', { rules: [{ args: ps, stdout: '' }] });
    const g = await gatherSources(options());
    expect(g).toEqual({ kind: 'no-container' });
    expect(report(g as { kind: 'no-container' }, true, TAG)).toEqual([
      'core-down: no container in soorma-local: no log to search (LS-12)',
    ]);
    expect(fails({ kind: 'no-container' })).toBe(false);
  });
});
