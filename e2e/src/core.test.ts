// SPDX-License-Identifier: Apache-2.0
//
// core-up and core-down with fake docker, git, pnpm and Node first on PATH:
// TC-ES-002 (the commit check), TC-ES-003 (refusals), TC-ES-008's unit part
// (the order of a run and its teardown), TC-ES-015's core-down part (the search
// on every run), TC-ES-018 (no record; a record and no container), TC-ES-021
// (prerequisites, install scripts, toolchain), TC-ES-023 (steps that never
// end), and the command-line entries' fixed values (plan 1.1).
import { existsSync, mkdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeFakes, type Fakes, type Rule } from '../test-fixtures/fakes.ts';
import { coreDownOptions, coreUpOptions, print, UsageError } from './cli/options.ts';
import { coreDown } from './core-down.ts';
import { coreUp } from './core-up.ts';
import { K_NOT_SEARCHABLE } from './log-search.ts';
import { CLONE, layout, LIMITS, readPin, REPOSITORY_ROOT } from './stack.ts';

const PIN = readPin(REPOSITORY_ROOT);
const LABEL = 'label=com.docker.compose.project=soorma-local';
const PS = ['compose', '-p', 'soorma-local', 'ps', '--all', '--services'];
const logsOf = (s: string): string[] => [
  'compose',
  '-p',
  'soorma-local',
  'logs',
  '--no-color',
  '--no-log-prefix',
  s,
];

/** Each fake command is a Node start (about 0.1 s); a run makes about twenty. */
const SLOW = { timeout: 30_000 };

let fakes: Fakes;
let lines: string[];
const limits = { ...LIMITS, other: 5_000, build: 300, down: 300, logs: 300, killGrace: 200 };
const l = () => layout(fakes.root);

const up = (coreNode = fakes.coreNode) =>
  coreUp({
    repositoryRoot: REPOSITORY_ROOT,
    root: fakes.root,
    coreNode,
    limits,
    path: fakes.path,
    print: (line) => lines.push(line),
  });
const down = (logs = false) =>
  coreDown({
    repositoryRoot: REPOSITORY_ROOT,
    root: fakes.root,
    logs,
    limits,
    path: fakes.path,
    print: (line) => lines.push(line),
  });

/** A clone as soorma-core's tag has it, as far as core-up reads it. */
function cloneFiles(over: Record<string, string> = {}): Record<string, string> {
  const c = l().clone;
  return {
    [join(c, CLONE.workspace)]: 'strictDepBuilds: true\nallowBuilds: {}\n',
    [join(c, CLONE.nodeVersion)]: '26.13.0\n',
    [join(c, CLONE.packageJson)]: '{ "packageManager": "pnpm@12.18.0" }\n',
    [join(c, CLONE.compose)]: 'name: soorma-local\n',
    ...over,
  };
}

interface Setup {
  engine?: Rule;
  compose?: Rule;
  projects?: string;
  volumes?: string;
  head?: string;
  files?: Record<string, string>;
  coreNodeVersion?: string;
  pnpmVersion?: string;
  build?: Partial<Rule>;
}

/** Every fake answers as a working machine and a correct clone would, unless overridden. */
function scenario(s: Setup = {}): void {
  fakes.scenario('docker', {
    rules: [
      s.engine ?? { args: ['version', '--format', '{{.Server.Version}}'], stdout: '29.5.3\n' },
      s.compose ?? { args: ['compose', 'version', '--short'], stdout: '2.30.1\n' },
      { args: ['compose', 'ls', '--all', '--format', 'json'], stdout: s.projects ?? '[]\n' },
      { args: ['volume', 'ls', '--quiet', '--filter', LABEL], stdout: s.volumes ?? '' },
      { args: ['build'], prefix: true, ...s.build },
    ],
  });
  fakes.scenario('git', {
    rules: [
      { args: ['--version'], stdout: 'git version 2.43.0\n' },
      {
        args: ['-c', 'advice.detachedHead=false', 'clone'],
        prefix: true,
        writeFiles: s.files ?? cloneFiles(),
      },
      { args: ['-C', l().clone, 'rev-parse', 'HEAD'], stdout: `${s.head ?? PIN.commit}\n` },
    ],
  });
  fakes.scenario('core-node', {
    rules: [{ args: ['--version'], stdout: `${s.coreNodeVersion ?? 'v26.13.0'}\n` }],
  });
  fakes.scenario('pnpm', {
    rules: [
      { args: ['--version'], stdout: `${s.pnpmVersion ?? '12.18.0'}\n` },
      {
        args: ['stack:init'],
        writeFiles: {
          [join(l().clone, CLONE.handover, 'first-admin-1.txt')]:
            'principal: h@example.com\nenrollmentMaterial: soorma_em_fixture\n',
        },
      },
    ],
  });
}

/** The docker answers core-down needs, over a running stack. */
function stackDocker(logs: Record<string, Rule | string>, extra: Rule[] = []): void {
  fakes.scenario('docker', {
    rules: [
      ...extra,
      { args: PS, stdout: `${Object.keys(logs).join('\n')}\n` },
      ...Object.entries(logs).map(([service, r]) =>
        typeof r === 'string'
          ? { args: logsOf(service), stdout: r }
          : { ...r, args: logsOf(service) },
      ),
    ],
  });
}

const commands = (name: 'docker' | 'git' | 'pnpm') =>
  fakes.calls(name).map((c) => c.args.join(' '));

/** A second run in the same test starts from nothing: no .e2e/, no recorded calls, no output. */
function reset(): void {
  rmSync(l().dir, { recursive: true, force: true });
  fakes.clearCalls();
  lines = [];
}

beforeEach(() => {
  fakes = makeFakes();
  lines = [];
});
afterEach(() => fakes.cleanup());

describe('core-up', SLOW, () => {
  it('TC-ES-008 (unit): runs soorma-core’s steps in order and writes the marker last', async () => {
    scenario();
    expect(await up()).toBe(0);
    expect(commands('docker')).toEqual([
      'version --format {{.Server.Version}}',
      'compose version --short',
      'compose ls --all --format json',
      `volume ls --quiet --filter ${LABEL}`,
      'build -f services/org-gateway/Dockerfile -t soorma/org-gateway:local .',
      'build -f services/control-gateway/Dockerfile -t soorma/control-gateway:local .',
      'build -f services/data-gateway/Dockerfile -t soorma/data-gateway:local .',
      'build -f services/event-ingest/Dockerfile -t soorma/event-ingest:local .',
    ]);
    expect(commands('pnpm')).toEqual([
      '--version',
      'install --frozen-lockfile',
      'stack:init',
      'stack:up',
    ]);
    for (const c of fakes.calls('pnpm').slice(1)) expect(c.cwd).toBe(realpathSync(l().clone));
    expect(commands('git')).toEqual([
      '--version',
      `-c advice.detachedHead=false clone --depth 1 --branch ${PIN.tag} ${PIN.repository} ${l().clone}`,
      `-C ${l().clone} rev-parse HEAD`,
    ]);
    expect(statSync(l().owner).mode & 0o777).toBe(0o600);
    expect(statSync(l().marker).mode & 0o777).toBe(0o600);
    expect(lines.at(-1)).toBe(
      `core-up: soorma-core ${PIN.tag} (${PIN.commit}) is up as soorma-local; fresh-stack marker written`,
    );
  });

  it('TC-ES-002: refuses a clone whose HEAD is not the pinned commit', async () => {
    scenario({ head: 'a'.repeat(40) });
    expect(await up()).toBe(1);
    expect(lines.at(-1)).toBe(
      `core-up: the clone's HEAD is ${'a'.repeat(40)}, not the pinned commit ${PIN.commit} (contract.pin.json): refused`,
    );
    expect(commands('pnpm')).toEqual([]);
    expect(existsSync(l().owner)).toBe(true); // CU-10: core-down removes what exists
    expect(existsSync(l().marker)).toBe(false);
  });

  describe('TC-ES-003: refuses what it did not start, creating nothing', () => {
    it('an earlier run’s ownership record', async () => {
      scenario();
      mkdirSync(l().dir, { recursive: true });
      writeFileSync(l().owner, '{}');
      expect(await up()).toBe(1);
      expect(lines.at(-1)).toBe(
        'core-up: refused: .e2e/owner.json exists, so an earlier run was not torn down. Run core-down first',
      );
      expect(commands('docker')).toEqual([]);
    });

    it('a soorma-local project', async () => {
      scenario({ projects: '[{"Name":"other"},{"Name":"soorma-local","Status":"running(9)"}]\n' });
      expect(await up()).toBe(1);
      expect(lines.at(-1)).toContain(
        'refused: a soorma-local Compose project exists that core-up did not start',
      );
      expect(existsSync(l().owner)).toBe(false);
      expect(commands('git')).toEqual(['--version']);
    });

    it('soorma-local volumes', async () => {
      scenario({ volumes: 'soorma-local_s1-data\n' });
      expect(await up()).toBe(1);
      expect(lines.at(-1)).toContain(
        'refused: soorma-local volumes exist that core-up did not create',
      );
      expect(existsSync(l().owner)).toBe(false);
    });
  });

  describe('TC-ES-021: prerequisites, install scripts and toolchain', () => {
    const refusedBeforeRecord = async (s: Setup, line: string, coreNode?: string) => {
      scenario(s);
      expect(await up(coreNode)).toBe(1);
      expect(lines.at(-1)).toBe(line);
      expect(existsSync(l().owner)).toBe(false);
      expect(existsSync(l().dir)).toBe(false);
    };

    it('refuses a missing or old Docker Engine, before the record', async () => {
      await refusedBeforeRecord(
        { engine: { args: ['version', '--format', '{{.Server.Version}}'], code: 1 } },
        'core-up: refused: Docker Engine is not available (docker version failed)',
      );
      reset();
      await refusedBeforeRecord(
        { engine: { args: ['version', '--format', '{{.Server.Version}}'], stdout: '25.0.5\n' } },
        'core-up: refused: Docker Engine 26 or later is required (found 25.0.5)',
      );
    });

    it('refuses an old Docker Compose, before the record', async () => {
      await refusedBeforeRecord(
        { compose: { args: ['compose', 'version', '--short'], stdout: 'v2.25.0\n' } },
        'core-up: refused: Docker Compose 2.26.0 or later is required (found 2.25.0)',
      );
    });

    it('refuses a missing git, or a --core-node that does not run, before the record', async () => {
      scenario();
      fakes.scenario('git', { rules: [{ args: ['--version'], code: 127 }] });
      expect(await up()).toBe(1);
      expect(lines.at(-1)).toBe('core-up: refused: git is not available');
      expect(existsSync(l().owner)).toBe(false);
      reset();
      await refusedBeforeRecord(
        {},
        `core-up: refused: --core-node ${join(fakes.root, 'missing')} is not a runnable Node`,
        join(fakes.root, 'missing'),
      );
    });

    const refusedBeforeInstall = async (s: Setup, line: string) => {
      scenario(s);
      expect(await up()).toBe(1);
      expect(lines.at(-1)).toBe(line);
      expect(commands('pnpm').filter((c) => c !== '--version')).toEqual([]);
      expect(commands('docker').some((c) => c.startsWith('build'))).toBe(false);
    };
    const scripts =
      "core-up: refused: the clone's pnpm-workspace.yaml must set strictDepBuilds: true and allowBuilds: {} (no dependency install scripts)";

    it('refuses a clone that would run install scripts', async () => {
      await refusedBeforeInstall(
        { files: cloneFiles({ [join(l().clone, CLONE.workspace)]: 'allowBuilds: {}\n' }) },
        scripts,
      );
      reset();
      await refusedBeforeInstall(
        {
          files: cloneFiles({
            [join(l().clone, CLONE.workspace)]:
              'strictDepBuilds: true\nallowBuilds:\n  esbuild: true\n',
          }),
        },
        scripts,
      );
    });

    it('refuses a --core-node or a pnpm that is not soorma-core’s', async () => {
      await refusedBeforeInstall(
        { coreNodeVersion: 'v26.12.0' },
        `core-up: refused: --core-node is Node v26.12.0, soorma-core at ${PIN.tag} needs 26.13.0 (.node-version)`,
      );
      reset();
      await refusedBeforeInstall(
        { pnpmVersion: '12.17.0' },
        `core-up: refused: pnpm is 12.17.0, soorma-core at ${PIN.tag} needs 12.18.0`,
      );
    });
  });

  it('TC-ES-023: a docker build that never ends times out, naming it; the record stays, no marker', async () => {
    scenario({ build: { hang: true } });
    expect(await up()).toBe(1);
    expect(lines.at(-1)).toBe('core-up: docker build org-gateway timed out after 300 ms');
    expect(existsSync(l().owner)).toBe(true);
    expect(existsSync(l().marker)).toBe(false);
  });
});

describe('core-down', SLOW, () => {
  /** A stack brought up by core-up (the fakes), with an agent secret written by setup. */
  async function upStack(): Promise<void> {
    scenario();
    expect(await up()).toBe(0);
    mkdirSync(l().secrets, { recursive: true, mode: 0o700 });
    writeFileSync(join(l().secrets, 'agent-a.secret'), 'soorma_rs_fixture\n', { mode: 0o600 });
    fakes.clearCalls();
    lines = [];
  }

  it('TC-ES-018: without a record it removes nothing and exits 0', async () => {
    fakes.scenario('docker', { rules: [{ args: PS, stdout: 'org-gateway\n' }] });
    for (const logs of [false, true]) {
      expect(await down(logs)).toBe(0);
    }
    expect(lines).toEqual([
      'core-down: no stack started by core-up is recorded (.e2e/owner.json): nothing removed',
      'core-down: no stack started by core-up is recorded (.e2e/owner.json): nothing removed',
    ]);
    expect(commands('docker')).toEqual([]);
  });

  it('TC-ES-018 (LS-12): with a record and no container, it searches nothing and takes the project down', async () => {
    mkdirSync(l().dir, { recursive: true });
    writeFileSync(l().owner, '{}');
    fakes.scenario('docker', { rules: [{ args: PS, stdout: '' }] });
    expect(await down()).toBe(0);
    expect(commands('docker')).toEqual([PS.join(' '), 'compose -p soorma-local down -v']);
    expect(lines[0]).toBe('core-down: no container in soorma-local: no log to search (LS-12)');
    expect(existsSync(l().owner)).toBe(false);
  });

  it('TC-ES-008 and TC-ES-015: searches on every run; without --logs prints no log; removes everything, the record last', async () => {
    await upStack();
    stackDocker({ 'org-gateway': 'listening on 8441\n', 'data-gateway': 'ready\n' });
    expect(await down(false)).toBe(0);
    expect(commands('docker')).toEqual([
      PS.join(' '),
      logsOf('org-gateway').join(' '),
      logsOf('data-gateway').join(' '),
      `compose -p soorma-local -f ${join(l().clone, CLONE.compose)} down -v`,
    ]);
    expect(lines).toEqual([
      'core-down: org-gateway: log searched, clean',
      'core-down: data-gateway: log searched, clean',
      K_NOT_SEARCHABLE,
      `core-down: docker compose -p soorma-local -f ${join(l().clone, CLONE.compose)} down -v`,
      'core-down: soorma-local and its volumes removed; .e2e/ cleared',
    ]);
    for (const p of [l().owner, l().marker, l().clone, l().secrets, l().stack])
      expect(existsSync(p)).toBe(false);
  });

  it('TC-ES-015: with --logs, clean logs are printed', async () => {
    await upStack();
    stackDocker({ 'org-gateway': 'listening on 8441\n' });
    expect(await down(true)).toBe(0);
    expect(lines.slice(0, 2)).toEqual([
      '----- org-gateway (searched, clean) -----',
      'listening on 8441',
    ]);
  });

  it('TC-ES-015: a hit fails core-down without --logs too, prints no log, and still tears down', async () => {
    await upStack();
    stackDocker({
      'org-gateway': 'listening\n',
      'data-gateway': 'agent secret soorma_rs_fixture seen\n',
    });
    expect(await down(false)).toBe(1);
    const out = lines.join('\n');
    expect(out).not.toContain('soorma_rs_fixture');
    expect(out).not.toContain('listening');
    expect(lines).toContain(
      `core-down: data-gateway's log holds a secret value (kind: registration secret): a soorma-core logging defect. Not printing any log. Raise it as a soorma-core issue naming data-gateway and ${PIN.tag}, without the value.`,
    );
    expect(commands('docker').at(-1)).toContain('down -v');
    expect(existsSync(l().owner)).toBe(false);
    expect(lines.at(-1)).toBe('core-down: failed: the log search did not pass (see above)');
  });

  it('TC-ES-023 (CD-07): a down -v that never ends keeps the record and the clone', async () => {
    await upStack();
    stackDocker({ 'org-gateway': 'ok\n' }, [
      { args: ['compose', '-p', 'soorma-local', '-f'], prefix: true, hang: true },
    ]);
    expect(await down(false)).toBe(1);
    expect(lines.at(-1)).toBe('core-down: docker compose down -v timed out after 300 ms');
    expect(existsSync(l().owner)).toBe(true);
    expect(existsSync(l().clone)).toBe(true);
  });

  it('TC-ES-023 (LS-10): a log read that never ends is unreadable: no log printed, still torn down', async () => {
    await upStack();
    stackDocker({ 'org-gateway': 'visible text\n', 'data-gateway': { args: [], hang: true } });
    expect(await down(true)).toBe(1);
    expect(lines.join('\n')).not.toContain('visible text');
    expect(lines).toContain(
      "core-down: could not read data-gateway's log (timed out): not printing any log (the search fails closed)",
    );
    expect(existsSync(l().owner)).toBe(false);
  });
});

describe('the command-line entries (plan 1.1)', () => {
  it('fix every value to this repository, the stack’s limits and the inherited PATH', () => {
    expect(coreUpOptions(['--core-node', '/opt/node26/bin/node'], { PATH: '/usr/bin' })).toEqual({
      repositoryRoot: REPOSITORY_ROOT,
      root: REPOSITORY_ROOT,
      limits: LIMITS,
      path: '/usr/bin',
      print,
      coreNode: '/opt/node26/bin/node',
    });
    expect(coreDownOptions(['--logs'], { PATH: '/usr/bin' })).toEqual({
      repositoryRoot: REPOSITORY_ROOT,
      root: REPOSITORY_ROOT,
      limits: LIMITS,
      path: '/usr/bin',
      print,
      logs: true,
    });
    expect(coreDownOptions([], {}).logs).toBe(false);
  });

  it('take no other argument', () => {
    expect(() => coreUpOptions([], {})).toThrow(UsageError);
    expect(() => coreUpOptions(['--core-node', '/n', '--limits', '0'], {})).toThrow(UsageError);
    expect(() => coreDownOptions(['--root', '/tmp'], {})).toThrow(UsageError);
  });
});
