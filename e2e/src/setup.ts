// SPDX-License-Identifier: Apache-2.0
//
// setup --agents <a,b> [--secrets-dir <dir>] (business-rules ST-01 to ST-12;
// business-logic-model §3). The human set-up as raw calls, on a fresh stack
// only: first authentication with the handover's enrollment material and a new
// K used once, which returns the one sign-in; the environment credential; the
// self-grant; per agent, a registration and a registration secret, written to
// its own 0600 file. Then it ends the environment credential and the sign-in
// and checks each is refused when presented again, on success and after a
// failure (ST-09). No secret or credential is printed, logged, passed to
// another process or written anywhere but an agent's own secret file (GEN-02).
import { randomBytes } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  type Stats,
} from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { validates } from '../../conformance/runner/src/contract.ts';
import { checkResponse } from './contract-ops.ts';
import { call, CallError, CallTimeout, failureLine, type CallResult } from './https.ts';
import { CONTRACT_VERSION, layout, readPin, STACK, type Endpoints, type Limits } from './stack.ts';

export interface SetupOptions {
  repositoryRoot: string;
  root: string;
  agents: string[];
  /** --secrets-dir; the default is .e2e/secrets. */
  secretsDir?: string;
  endpoints: Endpoints;
  /** The stack's CA certificate: the only one trusted. */
  caFile: string;
  /** The first Admin's handover file, holding the enrollment material. */
  handoverFile: string;
  limits: Limits;
  print: (line: string) => void;
}

const COMMAND = 'setup';
const SPONSOR_PERMISSIONS = ['agent:register', 'event:publish', 'event:subscribe'];
const STANDING = ['event:publish', 'event:subscribe'];

/** ST-01: the identifiers, by the contract's own LogicalAgentIdentifier. */
export function checkAgents(agents: string[]): string | undefined {
  if (agents.length === 0) return 'at least one agent is required (--agents a,b)';
  for (const a of agents) {
    if (!validates('LogicalAgentIdentifier', a)) return `"${a}" is not a logical agent identifier`;
  }
  if (new Set(agents).size !== agents.length) return 'the agent identifiers must be distinct';
  return undefined;
}

/**
 * ST-02, given the directory's lstat and the current uid: a real directory
 * (not a symbolic link), owned by this user, mode exactly 0700, holding no
 * secret file for any agent given.
 */
export function checkSecretsDir(
  stat: Pick<Stats, 'isDirectory' | 'isSymbolicLink' | 'uid' | 'mode'>,
  uid: number,
  existing: string[],
): string | undefined {
  if (stat.isSymbolicLink()) return 'is a symbolic link';
  if (!stat.isDirectory()) return 'is not a directory';
  if (stat.uid !== uid) return 'is owned by another user';
  if ((stat.mode & 0o777) !== 0o700)
    return `has mode ${(stat.mode & 0o777).toString(8).padStart(4, '0')}, not 0700`;
  if (existing.length > 0) return `already holds ${existing.join(', ')}`;
  return undefined;
}

class Failed extends Error {
  readonly line: string;
  constructor(line: string) {
    super(line);
    this.line = line;
  }
}

export async function setup(o: SetupOptions): Promise<number> {
  const l = layout(o.root);
  const refuse = (why: string): number => {
    o.print(`${COMMAND}: refused: ${why}`);
    return 1;
  };

  // ST-01, ST-02: before the marker, so a corrected setup may run.
  const bad = checkAgents(o.agents);
  if (bad) return refuse(bad);
  const dir =
    o.secretsDir === undefined
      ? l.secrets
      : isAbsolute(o.secretsDir)
        ? o.secretsDir
        : resolve(o.secretsDir);
  if (!existsSync(dir)) {
    try {
      mkdirSync(dir, { recursive: dir === l.secrets, mode: 0o700 });
      chmodSync(dir, 0o700);
    } catch (error) {
      return refuse(
        `the secrets directory ${dir} cannot be created (${(error as NodeJS.ErrnoException).code})`,
      );
    }
  }
  const existing = o.agents.map((a) => `${a}.secret`).filter((f) => existsSync(join(dir, f)));
  const dirProblem = checkSecretsDir(lstatSync(dir), process.getuid?.() ?? -1, existing);
  if (dirProblem) return refuse(`the secrets directory ${dir} ${dirProblem}`);

  // ST-03: one attempt per stack.
  if (!existsSync(l.marker)) return refuse('no fresh stack: run core-down, then core-up');
  rmSync(l.marker);

  let signIn: string | undefined;
  let envCredential: string | undefined;
  let failed = false;
  const secretFiles: { agent: string; secretFile: string }[] = [];
  let ca = '';

  const raw = async (
    step: string,
    operation: string,
    base: string,
    path: string,
    expect: number,
    extra: { credential?: string; body?: unknown },
  ): Promise<CallResult> => {
    let r: CallResult;
    try {
      r = await call({ step, base, path, ca, limitMs: o.limits.call, ...extra });
    } catch (error) {
      if (error instanceof CallTimeout || error instanceof CallError)
        throw new Failed(`${COMMAND}: ${error.message}`);
      throw error;
    }
    if (r.status !== expect) throw new Failed(failureLine(COMMAND, step, r));
    if (checkResponse(operation, r.status, r.body).length > 0) {
      throw new Failed(
        `${COMMAND}: ${step} failed: the ${r.status} response does not match the contract`,
      );
    }
    o.print(`${COMMAND}: ${step}: ${r.status}`);
    return r;
  };

  try {
    ca = readFileSync(o.caFile, 'utf8');
    const handover = readFileSync(o.handoverFile, 'utf8');
    const material = /^enrollmentMaterial:\s*(\S+)\s*$/m.exec(handover)?.[1];
    if (!material) throw new Failed(`${COMMAND}: no enrollmentMaterial in the handover file`);

    // Calls 1 to 5 (ST-04 to ST-08). K is used once, here, and kept nowhere.
    const first = await raw(
      'firstAuthenticate',
      'firstAuthenticate',
      o.endpoints.s1,
      '/first-authentication',
      200,
      {
        body: {
          principal: { organization: STACK.organization, principal: STACK.principal },
          enrollmentMaterial: material,
          newSecret: randomBytes(32).toString('base64url'),
        },
      },
    );
    const token = (first.body as { signIn?: { token?: unknown } }).signIn?.token;
    if (typeof token !== 'string') {
      throw new Failed(
        `${COMMAND}: firstAuthenticate failed: no sign-in returned (a second factor was asked for; the stack has none)`,
      );
    }
    signIn = token;

    const env = await raw(
      'issueEnvironmentCredential',
      'issueEnvironmentCredential',
      o.endpoints.s2,
      '/environment-credentials',
      200,
      { credential: signIn },
    );
    envCredential = (env.body as { credential: string }).credential;

    await raw('grantToHuman', 'grantToHuman', o.endpoints.s2, '/grants', 200, {
      credential: envCredential,
      body: {
        target: { organization: STACK.organization, principal: STACK.principal },
        permissions: SPONSOR_PERMISSIONS,
      },
    });

    for (const agent of o.agents) {
      await raw(`registerAgent ${agent}`, 'registerAgent', o.endpoints.s2, '/registrations', 200, {
        credential: envCredential,
        body: {
          agent,
          standingPermissions: STANDING,
          reBroadeningDeclaration: [],
          autonomyDeclared: true,
        },
      });
      const issued = await raw(
        `issueRegistrationSecret ${agent}`,
        'issueRegistrationSecret',
        o.endpoints.s2,
        '/registration-secrets',
        200,
        { credential: envCredential, body: { registration: agent } },
      );
      const secretFile = join(dir, `${agent}.secret`);
      writeFileSync(secretFile, (issued.body as { secret: string }).secret, {
        mode: 0o600,
        flag: 'wx',
      });
      secretFiles.push({ agent, secretFile });
    }
  } catch (error) {
    failed = true;
    o.print(
      error instanceof Failed
        ? error.line
        : `${COMMAND}: failed: ${(error as NodeJS.ErrnoException).code ?? 'unexpected error'}`,
    );
  }

  // Calls 6 to 9 (ST-09): end what was opened, and check each is refused.
  const endAndCheck = async (
    what: string,
    operation: string,
    base: string,
    path: string,
    credential: string,
  ): Promise<void> => {
    for (const [step, expect] of [
      [operation, 204],
      [`${operation} again (refusal check)`, 401],
    ] as const) {
      try {
        await raw(step, operation, base, path, expect, { credential });
      } catch (error) {
        failed = true;
        o.print(error instanceof Failed ? error.line : `${COMMAND}: ${step} failed`);
        if (expect === 401) o.print(`${COMMAND}: the ${what} was not refused after its end`);
      }
    }
  };
  if (envCredential !== undefined) {
    await endAndCheck(
      'environment credential',
      'endEnvironmentCredential',
      o.endpoints.s2,
      '/environment-credentials/current/end',
      envCredential,
    );
  }
  if (signIn !== undefined) {
    await endAndCheck('sign-in', 'endSignIn', o.endpoints.s1, '/sign-ins/current/end', signIn);
  }
  // Both are ended and refused; neither is kept past this point.

  if (failed) {
    o.print(`${COMMAND}: failed: no retry; run core-down, then core-up`);
    return 1;
  }

  // ST-10, ST-11: the stack description, last; secret files by path only.
  const pin = readPin(o.repositoryRoot);
  const description = {
    contractVersion: CONTRACT_VERSION,
    soormaCore: { tag: pin.tag, commit: pin.commit },
    environment: {
      organization: STACK.organization,
      project: STACK.project,
      environment: STACK.environment,
    },
    s3: o.endpoints.s3,
    s4: o.endpoints.s4,
    ca: resolve(o.caFile),
    agents: secretFiles,
  };
  writeFileSync(l.stack, `${JSON.stringify(description, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  o.print(`${COMMAND}: environment ${STACK.organization}/${STACK.project}/${STACK.environment}`);
  o.print(`${COMMAND}: s3 ${o.endpoints.s3}`);
  o.print(`${COMMAND}: s4 ${o.endpoints.s4}`);
  o.print(`${COMMAND}: ca ${description.ca}`);
  for (const a of secretFiles) o.print(`${COMMAND}: agent ${a.agent} ${a.secretFile}`);
  o.print(`${COMMAND}: stack description ${l.stack}`);
  return 0;
}
