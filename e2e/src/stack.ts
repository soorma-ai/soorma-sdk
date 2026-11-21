// SPDX-License-Identifier: Apache-2.0
//
// soorma-core's local stack, as soorma-core defines it at contract-v0.1.0+core.2
// (deploy/local/compose.yaml, config/tenancy.yaml). These are the values of
// soorma-core's local stack, not a tenant's (I9), and they live here only. They
// hold because core-up refuses any other commit (CU-05; GEN-05). Also the
// layout of .e2e/ (domain-entities §1) and the time limits (TS-U2-11).
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const CONTRACT_VERSION = '0.1.0';

/** soorma-core's local stack at the tag (GEN-05). */
export const STACK = {
  organization: 'o1',
  project: 'p1',
  environment: 'e',
  principal: 'h@example.com',
  composeProject: 'soorma-local',
  /** S1, and environment e's S2, S3 and S4 (e2's are 8443, 8445, 8447: never used). */
  ports: { s1: 8441, s2: 8442, s3: 8444, s4: 8446 },
} as const;

/** Paths inside the clone. */
export const CLONE = {
  compose: 'deploy/local/compose.yaml',
  ca: 'deploy/local/.secrets/stack-ca.pem',
  handover: 'deploy/local/.secrets/handover',
  nodeVersion: '.node-version',
  workspace: 'pnpm-workspace.yaml',
  packageJson: 'package.json',
} as const;

/** The four images, built as soorma-core's CI builds them at the tag (CU-07). */
export const IMAGES = ['org-gateway', 'control-gateway', 'data-gateway', 'event-ingest'] as const;

export interface Endpoints {
  s1: string;
  s2: string;
  s3: string;
  s4: string;
}

export const ENDPOINTS: Endpoints = {
  s1: `https://localhost:${STACK.ports.s1}`,
  s2: `https://localhost:${STACK.ports.s2}`,
  s3: `https://localhost:${STACK.ports.s3}`,
  s4: `https://localhost:${STACK.ports.s4}`,
};

/** Every time limit, in milliseconds (TS-U2-11; GEN-07). */
export interface Limits {
  /** One raw call, connecting through the whole response. */
  call: number;
  clone: number;
  install: number;
  /** Per image. */
  build: number;
  stackInit: number;
  stackUp: number;
  /** Per service. */
  logs: number;
  down: number;
  /** Every other child command. */
  other: number;
  /** From SIGTERM to SIGKILL. */
  killGrace: number;
}

const S = 1000;
const MIN = 60 * S;

export const LIMITS: Limits = {
  call: 30 * S,
  clone: 3 * MIN,
  install: 6 * MIN,
  build: 5 * MIN,
  stackInit: 2 * MIN,
  stackUp: 5 * MIN,
  logs: 1 * MIN,
  down: 3 * MIN,
  other: 30 * S,
  killGrace: 10 * S,
};

/** How a limit is named in a timed-out line: "30 s", "3 min", "250 ms". */
export function formatLimit(ms: number): string {
  if (ms >= MIN && ms % MIN === 0) return `${ms / MIN} min`;
  if (ms >= S && ms % S === 0) return `${ms / S} s`;
  return `${ms} ms`;
}

/** The files a run writes, all under .e2e/ at the working root (git-ignored). */
export interface Layout {
  root: string;
  dir: string;
  clone: string;
  owner: string;
  marker: string;
  secrets: string;
  stack: string;
}

export function layout(root: string): Layout {
  const dir = join(resolve(root), '.e2e');
  return {
    root: resolve(root),
    dir,
    clone: join(dir, 'soorma-core'),
    owner: join(dir, 'owner.json'),
    marker: join(dir, 'fresh-stack'),
    secrets: join(dir, 'secrets'),
    stack: join(dir, 'stack.json'),
  };
}

export interface Pin {
  repository: string;
  tag: string;
  commit: string;
}

/** contract.pin.json: the one source of the tag and commit (CU-05). */
export function readPin(repositoryRoot: string): Pin {
  const pin = JSON.parse(
    readFileSync(join(repositoryRoot, 'contract.pin.json'), 'utf8'),
  ) as Partial<Pin>;
  if (
    typeof pin.repository !== 'string' ||
    typeof pin.tag !== 'string' ||
    typeof pin.commit !== 'string' ||
    !/^[0-9a-f]{40}$/.test(pin.commit)
  ) {
    throw new Error('contract.pin.json: repository, tag and a 40-character commit are required');
  }
  return { repository: pin.repository, tag: pin.tag, commit: pin.commit };
}

/** This repository's root (e2e/src/ is two levels down). */
export const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..');
