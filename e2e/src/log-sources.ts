// SPDX-License-Identifier: Apache-2.0
//
// What the log search reads (LS-01, LS-04, LS-06, LS-10, LS-12): the vendored
// credentials.md, the agent secrets, the enrollment material in the clone's
// handover files, and each service's log, read separately. Anything that cannot
// be read, or whose read runs out of its limit, is named as unreadable, and the
// search then prints no log (LS-10). With no container in the project there is
// no log, and no value source is read (LS-12).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runChild } from './child.ts';
import {
  prefixesFrom,
  SearchSetupError,
  type ExactValue,
  type Prefix,
  type ServiceLog,
} from './log-search.ts';
import { CLONE, STACK, type Layout, type Limits } from './stack.ts';

export interface SourceOptions {
  /** This repository's root: where the vendored contract is. */
  repositoryRoot: string;
  layout: Layout;
  limits: Limits;
  path: string;
}

export type Gathered =
  | { kind: 'no-container' }
  | {
      kind: 'gathered';
      prefixes: Prefix[];
      exact: ExactValue[];
      logs: ServiceLog[];
      unreadable: string[];
    };

const AGENT_SECRET = 'agent secret (exact value)';
const ENROLLMENT = 'enrollment material (exact value)';

function docker(args: string[], step: string, limitMs: number, o: SourceOptions) {
  return runChild('docker', args, { step, limitMs, killGraceMs: o.limits.killGrace, path: o.path });
}

/** The services of soorma-local that have a container, stopped ones included. */
async function services(o: SourceOptions): Promise<string[] | undefined> {
  const r = await docker(
    ['compose', '-p', STACK.composeProject, 'ps', '--all', '--services'],
    'docker compose ps',
    o.limits.other,
    o,
  );
  if (r.timedOut || r.code !== 0) return undefined;
  return r.stdout
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(s));
}

function readSecretFile(file: string, unreadable: string[], exact: ExactValue[]): void {
  try {
    const value = readFileSync(file, 'utf8').trim();
    if (value) exact.push({ value, kind: AGENT_SECRET });
  } catch {
    unreadable.push(`the agent secret file ${file}`);
  }
}

/** Agent secrets: the files the stack description lists, and any in the default directory. */
function agentSecrets(o: SourceOptions, unreadable: string[], exact: ExactValue[]): void {
  const listed = new Set<string>();
  if (existsSync(o.layout.stack)) {
    try {
      const description = JSON.parse(readFileSync(o.layout.stack, 'utf8')) as {
        agents?: { secretFile?: unknown }[];
      };
      for (const a of description.agents ?? []) {
        if (typeof a.secretFile === 'string') listed.add(a.secretFile);
      }
    } catch {
      unreadable.push('the stack description .e2e/stack.json');
    }
  }
  // setup writes the stack description last: after a failed setup, the secrets
  // it wrote are found in the default directory.
  if (existsSync(o.layout.secrets)) {
    try {
      for (const name of readdirSync(o.layout.secrets)) {
        if (name.endsWith('.secret')) listed.add(join(o.layout.secrets, name));
      }
    } catch {
      unreadable.push('the secrets directory .e2e/secrets');
    }
  }
  for (const file of listed) readSecretFile(file, unreadable, exact);
}

/** Every enrollmentMaterial value in the clone's handover files. */
function enrollmentMaterial(o: SourceOptions, unreadable: string[], exact: ExactValue[]): void {
  const dir = join(o.layout.clone, CLONE.handover);
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    unreadable.push(`the handover directory ${CLONE.handover}`);
    return;
  }
  for (const name of names) {
    try {
      const text = readFileSync(join(dir, name), 'utf8');
      for (const m of text.matchAll(/^enrollmentMaterial:\s*(\S+)\s*$/gm)) {
        if (m[1]) exact.push({ value: m[1], kind: ENROLLMENT });
      }
    } catch {
      unreadable.push(`the handover file ${CLONE.handover}/${name}`);
    }
  }
}

export async function gatherSources(o: SourceOptions): Promise<Gathered> {
  const list = await services(o);
  if (list !== undefined && list.length === 0) return { kind: 'no-container' };
  const unreadable: string[] = [];
  if (list === undefined) unreadable.push(`the ${STACK.composeProject} container list`);

  let prefixes: Prefix[] = [];
  try {
    prefixes = prefixesFrom(
      readFileSync(join(o.repositoryRoot, 'contract', 'conventions', 'credentials.md'), 'utf8'),
    );
  } catch (error) {
    unreadable.push(
      error instanceof SearchSetupError
        ? `the typed prefixes in contract/conventions/credentials.md (${error.message})`
        : 'contract/conventions/credentials.md',
    );
  }

  const exact: ExactValue[] = [];
  agentSecrets(o, unreadable, exact);
  enrollmentMaterial(o, unreadable, exact);

  const logs: ServiceLog[] = [];
  for (const service of list ?? []) {
    const r = await docker(
      ['compose', '-p', STACK.composeProject, 'logs', '--no-color', '--no-log-prefix', service],
      `docker compose logs ${service}`,
      o.limits.logs,
      o,
    );
    if (r.timedOut) unreadable.push(`${service}'s log (timed out)`);
    else if (r.code !== 0) unreadable.push(`${service}'s log`);
    // Searched: stdout (the log) and stderr; printed, if clean: stdout only.
    else logs.push({ service, text: r.stdout, ...(r.stderr ? { stderr: r.stderr } : {}) });
  }
  return { kind: 'gathered', prefixes, exact, logs, unreadable };
}
