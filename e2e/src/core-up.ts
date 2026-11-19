// SPDX-License-Identifier: Apache-2.0
//
// core-up (business-rules CU-01 to CU-13; business-logic-model §2): a fresh
// soorma-core at the contract tag, built and started exactly as soorma-core's
// CI does at that tag. It refuses an earlier run's leftovers and a stack it did
// not start; checks its prerequisites before it writes the ownership record;
// writes the record before it creates anything, so every later failure leaves a
// stack core-down can remove; and writes the fresh-stack marker last, only when
// every step succeeded. Every child step runs under its time limit (GEN-07).
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { compare, parseRelease, type Version } from '../../tools/lib/semver.ts';
import { mustRun, runChild, StepFailure, timedOutLine, type ChildOptions } from './child.ts';
import { CLONE, IMAGES, layout, readPin, STACK, type Limits } from './stack.ts';

export interface CoreUpOptions {
  /** This repository's root: contract.pin.json is read from it. */
  repositoryRoot: string;
  /** Where .e2e/ is written. */
  root: string;
  /** The Node executable for soorma-core's own steps (TS-U2-02). */
  coreNode: string;
  limits: Limits;
  /** PATH for child commands. */
  path: string;
  print: (line: string) => void;
}

const COMMAND = 'core-up';
const DOCKER_MIN: Version = [26, 0, 0];
const COMPOSE_MIN: Version = [2, 26, 0];

/** "v2.27.1", "26.1.3+dfsg1", "29.5.3-desktop.1" → the release version. */
export function looseVersion(text: string): Version | undefined {
  return parseRelease(text.trim().replace(/^v/, '').split(/[-+]/)[0] ?? '');
}

/** A refusal for an unavailable prerequisite; a timeout stays a timeout (GEN-07). */
const refuse =
  (line: string) =>
  (error: unknown): never => {
    if (error instanceof StepFailure && error.line.includes(' timed out after ')) throw error;
    throw new StepFailure(line);
  };

export async function coreUp(o: CoreUpOptions): Promise<number> {
  try {
    await run(o);
    return 0;
  } catch (error) {
    if (error instanceof StepFailure) {
      o.print(error.line);
      return 1;
    }
    o.print(`${COMMAND}: failed: ${(error as Error).message}`);
    return 1;
  }
}

async function run(o: CoreUpOptions): Promise<void> {
  const l = layout(o.root);
  const pin = readPin(o.repositoryRoot);
  const child = (
    step: string,
    limitMs: number,
    extra: Partial<ChildOptions> = {},
  ): ChildOptions => ({
    step,
    limitMs,
    killGraceMs: o.limits.killGrace,
    path: o.path,
    ...extra,
  });
  /** A short child command whose output is read: its stdout, or a failure. */
  const read = async (file: string, args: string[], step: string): Promise<string> => {
    const r = await runChild(file, args, child(step, o.limits.other));
    if (r.timedOut) throw new StepFailure(timedOutLine(COMMAND, step, o.limits.other));
    if (r.code !== 0)
      throw new StepFailure(`${COMMAND}: ${step} failed (exit ${r.code ?? r.signal ?? 'unknown'})`);
    return r.stdout.trim();
  };

  // CU-01: an earlier run's record.
  if (existsSync(l.owner)) {
    throw new StepFailure(
      `${COMMAND}: refused: .e2e/owner.json exists, so an earlier run was not torn down. Run core-down first`,
    );
  }

  // CU-11: prerequisites, before anything is written.
  o.print(`${COMMAND}: checking prerequisites`);
  const engine = looseVersion(
    await read('docker', ['version', '--format', '{{.Server.Version}}'], 'docker version').catch(
      refuse(`${COMMAND}: refused: Docker Engine is not available (docker version failed)`),
    ),
  );
  if (!engine || compare(engine, DOCKER_MIN) < 0) {
    throw new StepFailure(
      `${COMMAND}: refused: Docker Engine 26 or later is required (found ${engine?.join('.') ?? 'unreadable'})`,
    );
  }
  const compose = looseVersion(
    await read('docker', ['compose', 'version', '--short'], 'docker compose version').catch(
      refuse(
        `${COMMAND}: refused: Docker Compose is not available (docker compose version failed)`,
      ),
    ),
  );
  if (!compose || compare(compose, COMPOSE_MIN) < 0) {
    throw new StepFailure(
      `${COMMAND}: refused: Docker Compose 2.26.0 or later is required (found ${compose?.join('.') ?? 'unreadable'})`,
    );
  }
  await read('git', ['--version'], 'git --version').catch(
    refuse(`${COMMAND}: refused: git is not available`),
  );
  const coreNodeVersion = await read(o.coreNode, ['--version'], '--core-node --version').catch(
    refuse(`${COMMAND}: refused: --core-node ${o.coreNode} is not a runnable Node`),
  );

  // CU-02: never a stack this command did not start.
  const projects = JSON.parse(
    (await read('docker', ['compose', 'ls', '--all', '--format', 'json'], 'docker compose ls')) ||
      '[]',
  ) as { Name?: string }[];
  if (projects.some((p) => p.Name === STACK.composeProject)) {
    throw new StepFailure(
      `${COMMAND}: refused: a ${STACK.composeProject} Compose project exists that core-up did not start. Stop it yourself (it may be your own stack)`,
    );
  }
  const volumes = await read(
    'docker',
    [
      'volume',
      'ls',
      '--quiet',
      '--filter',
      `label=com.docker.compose.project=${STACK.composeProject}`,
    ],
    'docker volume ls',
  );
  if (volumes !== '') {
    throw new StepFailure(
      `${COMMAND}: refused: ${STACK.composeProject} volumes exist that core-up did not create. Remove them yourself (they may hold your own data)`,
    );
  }

  // CU-03: the ownership record, before anything is created.
  mkdirSync(l.dir, { recursive: true, mode: 0o700 });
  writeFileSync(
    l.owner,
    `${JSON.stringify({ startedAt: new Date().toISOString(), tag: pin.tag, commit: pin.commit }, null, 2)}\n`,
    { mode: 0o600, flag: 'wx' },
  );

  // CU-04, CU-05: the clone, at the pinned commit.
  rmSync(l.clone, { recursive: true, force: true });
  o.print(`${COMMAND}: cloning ${pin.repository} at ${pin.tag}`);
  await mustRun(
    COMMAND,
    'git',
    [
      '-c',
      'advice.detachedHead=false',
      'clone',
      '--depth',
      '1',
      '--branch',
      pin.tag,
      pin.repository,
      l.clone,
    ],
    { ...child('git clone', o.limits.clone), showOutput: true },
  );
  const head = await read('git', ['-C', l.clone, 'rev-parse', 'HEAD'], 'git rev-parse');
  if (head !== pin.commit) {
    throw new StepFailure(
      `${COMMAND}: the clone's HEAD is ${head}, not the pinned commit ${pin.commit} (contract.pin.json): refused`,
    );
  }

  // CU-12: no dependency install scripts may run.
  const workspace = parseYaml(readFileSync(join(l.clone, CLONE.workspace), 'utf8')) as Record<
    string,
    unknown
  > | null;
  const allow = workspace?.allowBuilds;
  if (
    workspace?.strictDepBuilds !== true ||
    typeof allow !== 'object' ||
    allow === null ||
    Array.isArray(allow) ||
    Object.keys(allow).length !== 0
  ) {
    throw new StepFailure(
      `${COMMAND}: refused: the clone's ${CLONE.workspace} must set strictDepBuilds: true and allowBuilds: {} (no dependency install scripts)`,
    );
  }

  // CU-13: soorma-core's toolchain, exactly.
  const wantNode = readFileSync(join(l.clone, CLONE.nodeVersion), 'utf8').trim().replace(/^v/, '');
  if (coreNodeVersion.replace(/^v/, '') !== wantNode) {
    throw new StepFailure(
      `${COMMAND}: refused: --core-node is Node ${coreNodeVersion}, soorma-core at ${pin.tag} needs ${wantNode} (${CLONE.nodeVersion})`,
    );
  }
  const manager = (
    JSON.parse(readFileSync(join(l.clone, CLONE.packageJson), 'utf8')) as {
      packageManager?: string;
    }
  ).packageManager;
  const wantPnpm = /^pnpm@(\d+\.\d+\.\d+)/.exec(manager ?? '')?.[1];
  const pnpm = await read('pnpm', ['--version'], 'pnpm --version');
  if (!wantPnpm || pnpm !== wantPnpm) {
    throw new StepFailure(
      `${COMMAND}: refused: pnpm is ${pnpm}, soorma-core at ${pin.tag} needs ${wantPnpm ?? 'an exact pnpm in packageManager'}`,
    );
  }

  // CU-06 to CU-08: soorma-core's own steps, with its Node first on PATH.
  const core = { cwd: l.clone, prependPath: dirname(o.coreNode) };
  o.print(`${COMMAND}: installing soorma-core's workspace (frozen lockfile)`);
  await mustRun(COMMAND, 'pnpm', ['install', '--frozen-lockfile'], {
    ...child('pnpm install', o.limits.install, core),
    showOutput: true,
  });
  for (const image of IMAGES) {
    o.print(`${COMMAND}: building soorma/${image}:local`);
    await mustRun(
      COMMAND,
      'docker',
      ['build', '-f', `services/${image}/Dockerfile`, '-t', `soorma/${image}:local`, '.'],
      { ...child(`docker build ${image}`, o.limits.build, { cwd: l.clone }), showOutput: true },
    );
  }
  // From here the clone holds the stack's secrets: no output is ever printed.
  o.print(`${COMMAND}: pnpm stack:init`);
  await mustRun(
    COMMAND,
    'pnpm',
    ['stack:init'],
    child('pnpm stack:init', o.limits.stackInit, core),
  );
  o.print(`${COMMAND}: pnpm stack:up`);
  await mustRun(COMMAND, 'pnpm', ['stack:up'], child('pnpm stack:up', o.limits.stackUp, core));

  // CU-09: the marker, last.
  writeFileSync(l.marker, `${new Date().toISOString()}\n`, { mode: 0o600, flag: 'wx' });
  o.print(
    `${COMMAND}: soorma-core ${pin.tag} (${pin.commit}) is up as ${STACK.composeProject}; fresh-stack marker written`,
  );
}
