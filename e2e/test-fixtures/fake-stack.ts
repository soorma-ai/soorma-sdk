// SPDX-License-Identifier: Apache-2.0
//
// A fake S1, S2 and S3 for setup's and prove-stack's tests (TS-U2-09;
// TC-ES-020, TC-ES-022). One node:https server, with a per-test CA from U1's CA
// maker, answers the operations setup and prove-stack call, following the
// contract's end semantics: an ended sign-in or environment credential is
// refused with 401 from then on. It records every call (the operation and the
// kind of credential presented, never a value), and checks every request body
// it receives and **every response it sends** against the vendored contract's
// schema for that operation and status (NFR-U2-20), so it cannot drift from
// the contract. A test may make one operation fail with a status, or never
// answer.
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:https';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  makeCerts,
  makeRunDir,
  removeRunDir,
  type Certs,
} from '../../conformance/runner/src/rundir.ts';
import { validates, schemaErrors } from '../../conformance/runner/src/contract.ts';
import type { ContractSchema } from '../../contract/scripts/validator.ts';
import { checkResponse } from '../src/contract-ops.ts';

export interface Call {
  operation: string;
  /** The kind of credential presented, by its prefix: never the value. */
  credential: 'sign-in' | 'environment credential' | 'other' | 'none';
  /** The agent the call is about, when there is one. */
  agent?: string;
  status: number | 'no answer';
}

export interface Fault {
  operation: string;
  agent?: string;
  /** Answer with this status and a Problem. */
  status?: number;
  code?: string;
  /** Accept the request and never answer. */
  hang?: boolean;
  /** Answer `status` with this body instead (to prove the fake's own check). */
  body?: unknown;
}

export interface FakeStack {
  base: string;
  caFile: string;
  /** A CA that did not sign the fake's certificate. */
  otherCaFile: string;
  enrollmentMaterial: string;
  calls: Call[];
  /** Every contract mismatch, in what the fake received or sent. Must stay empty. */
  contractErrors: string[];
  /** How many sign-ins and environment credentials are still live. */
  live(): { signIns: number; environmentCredentials: number };
  /** Every secret value the fake issued or received: none may appear in output or files. */
  secrets(): string[];
  fault(f: Fault | undefined): void;
  close(): Promise<void>;
}

const ROUTES: Record<string, { operation: string; request?: ContractSchema }> = {
  '/first-authentication': {
    operation: 'firstAuthenticate',
    request: 'org-gateway#FirstAuthenticateRequest',
  },
  '/sign-ins': { operation: 'authenticate', request: 'org-gateway#AuthenticateRequest' },
  '/sign-ins/current/end': { operation: 'endSignIn' },
  '/environment-credentials': { operation: 'issueEnvironmentCredential' },
  '/environment-credentials/current/end': { operation: 'endEnvironmentCredential' },
  '/grants': { operation: 'grantToHuman', request: 'control-gateway#GrantRequest' },
  '/registrations': { operation: 'registerAgent', request: 'control-gateway#RegistrationRequest' },
  '/registration-secrets': {
    operation: 'issueRegistrationSecret',
    request: 'control-gateway#RegistrationSecretRequest',
  },
  '/agent-credentials': {
    operation: 'exchangeBootstrap',
    request: 'data-gateway#BootstrapRequest',
  },
};

const ENV = { organization: 'o1', project: 'p1', environment: 'e' };
const HUMAN = { organization: 'o1', principal: 'h@example.com' };
const token = (prefix: string): string => `${prefix}${randomBytes(18).toString('base64url')}`;
const later = (): string =>
  new Date(Date.now() + 15 * 60_000).toISOString().replace(/\.\d+Z$/, 'Z');
const now = (): string => new Date().toISOString().replace(/\.\d+Z$/, 'Z');

export async function startFakeStack(): Promise<FakeStack> {
  const dir = makeRunDir();
  const certs: Certs = makeCerts(dir);
  const enrollmentMaterial = token('soorma_em_');
  const signIns = new Map<string, boolean>();
  const envCreds = new Map<string, boolean>();
  const regSecrets = new Map<string, string>();
  const issued: string[] = [enrollmentMaterial];
  const received: string[] = [];
  const calls: Call[] = [];
  const contractErrors: string[] = [];
  let fault: Fault | undefined;
  const hanging = new Set<ServerResponse>();

  const send = (res: ServerResponse, call: Call, status: number, body?: unknown): void => {
    const errors = checkResponse(call.operation, status, body);
    for (const e of errors) contractErrors.push(`sent: ${e}`);
    call.status = status;
    const id = randomBytes(6).toString('hex');
    const headers: Record<string, string> = {
      'soorma-contract-version': '0.1.0',
      'soorma-request-id': id,
    };
    if (body === undefined) {
      res.writeHead(status, headers).end();
      return;
    }
    headers['content-type'] = status >= 400 ? 'application/problem+json' : 'application/json';
    res.writeHead(status, headers).end(JSON.stringify(body));
  };
  const problem = (status: number, code: string) => ({
    type: `urn:soorma:problem:${code}`,
    title: 'Request refused',
    status,
    code,
    instance: `urn:soorma:request:${randomBytes(4).toString('hex')}`,
  });

  const handle = (req: IncomingMessage, res: ServerResponse, raw: string): void => {
    const route = ROUTES[new URL(req.url ?? '/', 'https://x').pathname];
    const auth = req.headers.authorization ?? '';
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : undefined;
    const credential: Call['credential'] =
      bearer === undefined
        ? 'none'
        : bearer.startsWith('soorma_si_')
          ? 'sign-in'
          : bearer.startsWith('soorma_ec_')
            ? 'environment credential'
            : 'other';
    if (bearer) received.push(bearer);
    if (!route) {
      res.writeHead(404).end();
      return;
    }
    let body: Record<string, unknown> = {};
    if (raw.length > 0) {
      try {
        body = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        contractErrors.push(`received: ${route.operation}: body is not JSON`);
      }
    }
    if (route.request && !validates(route.request, body)) {
      contractErrors.push(`received: ${route.operation}: ${schemaErrors(route.request, body)}`);
    }
    if (req.headers['soorma-contract-version'] !== '0.1.0') {
      contractErrors.push(`received: ${route.operation}: no Soorma-Contract-Version 0.1.0`);
    }
    const agent =
      typeof body.agent === 'string'
        ? body.agent
        : typeof body.registration === 'string'
          ? body.registration
          : undefined;
    for (const v of ['newSecret', 'secret', 'enrollmentMaterial']) {
      if (typeof body[v] === 'string') received.push(body[v]);
    }
    const call: Call = {
      operation: route.operation,
      credential,
      status: 'no answer',
      ...(agent ? { agent } : {}),
    };
    calls.push(call);

    if (fault && fault.operation === route.operation && (!fault.agent || fault.agent === agent)) {
      if (fault.hang) {
        hanging.add(res);
        return;
      }
      if (fault.status) {
        send(
          res,
          call,
          fault.status,
          'body' in fault ? fault.body : problem(fault.status, fault.code ?? 'unavailable'),
        );
        return;
      }
    }

    const signInLive = bearer !== undefined && signIns.get(bearer) === true;
    const envLive = bearer !== undefined && envCreds.get(bearer) === true;
    const refused = (): void => send(res, call, 401, problem(401, 'credential_refused'));

    switch (route.operation) {
      case 'firstAuthenticate': {
        if (body.enrollmentMaterial !== enrollmentMaterial) {
          send(res, call, 403, problem(403, 'authentication_failed'));
          return;
        }
        const signIn = token('soorma_si_');
        signIns.set(signIn, true);
        issued.push(signIn);
        send(res, call, 200, {
          principal: HUMAN,
          state: 'active',
          signIn: {
            token: signIn,
            expiresAt: later(),
            subject: HUMAN,
            authenticatedAt: now(),
            classes: ['K'],
          },
        });
        return;
      }
      case 'authenticate':
        // setup never signs in again (ST-06): the call is recorded and refused.
        send(res, call, 403, problem(403, 'authentication_failed'));
        return;
      case 'issueEnvironmentCredential': {
        if (!signInLive) return refused();
        const credentialValue = token('soorma_ec_');
        envCreds.set(credentialValue, true);
        issued.push(credentialValue);
        send(res, call, 200, { credential: credentialValue, expiresAt: later() });
        return;
      }
      case 'grantToHuman':
        if (!envLive) return refused();
        send(res, call, 200, {
          id: randomBytes(9).toString('base64url'),
          target: body.target,
          permissions: body.permissions,
          grantedAt: now(),
          selfGrant: true,
        });
        return;
      case 'registerAgent':
        if (!envLive) return refused();
        send(res, call, 200, {
          agent: body.agent,
          environment: ENV,
          sponsor: HUMAN,
          ceilingSnapshot: ['agent:register', 'event:publish', 'event:subscribe'],
          standingPermissions: body.standingPermissions,
          reBroadeningDeclaration: body.reBroadeningDeclaration ?? [],
          autonomyDeclared: body.autonomyDeclared === true,
          registeredAt: now(),
          state: 'registered',
        });
        return;
      case 'issueRegistrationSecret': {
        if (!envLive) return refused();
        const secret = token('soorma_rs_');
        regSecrets.set(String(body.registration), secret);
        issued.push(secret);
        send(res, call, 200, {
          id: randomBytes(16).toString('base64url'),
          registration: body.registration,
          secret,
          issuedAt: now(),
        });
        return;
      }
      case 'endEnvironmentCredential':
        if (!envLive) return refused();
        envCreds.set(bearer as string, false);
        send(res, call, 204);
        return;
      case 'endSignIn':
        if (!signInLive) return refused();
        signIns.set(bearer as string, false);
        send(res, call, 204);
        return;
      case 'exchangeBootstrap': {
        if (regSecrets.get(String(body.agent)) !== body.secret) {
          send(res, call, 403, problem(403, 'authentication_failed'));
          return;
        }
        const credentialValue = token('soorma_ac_');
        issued.push(credentialValue);
        send(res, call, 200, {
          credential: credentialValue,
          agent: body.agent,
          environment: ENV,
          instance: body.instance,
          expiresAt: later(),
        });
        return;
      }
    }
  };

  const server: Server = createServer(
    { key: readFileSync(certs.serverKey), cert: readFileSync(certs.serverCert) },
    (req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (b: Buffer) => chunks.push(b));
      req.on('end', () => handle(req, res, Buffer.concat(chunks).toString('utf8')));
    },
  );
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;

  const count = (m: Map<string, boolean>): number => [...m.values()].filter(Boolean).length;
  return {
    base: `https://localhost:${port}`,
    caFile: certs.caFile,
    otherCaFile: certs.untrustedCaFile,
    enrollmentMaterial,
    calls,
    contractErrors,
    live: () => ({ signIns: count(signIns), environmentCredentials: count(envCreds) }),
    secrets: () => [...issued, ...received],
    fault: (f) => {
      fault = f;
    },
    close: async () => {
      for (const res of hanging) res.destroy();
      server.closeAllConnections();
      await new Promise<void>((r) => server.close(() => r()));
      removeRunDir(dir);
    },
  };
}
