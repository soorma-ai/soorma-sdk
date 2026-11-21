// SPDX-License-Identifier: Apache-2.0
//
// The contract's renewal rule on soorma-core's real stack (contract-v0.1.0+core.2,
// conventions/credentials.md, Revocation and Lifetimes): "A token issued before a
// renewal stays valid until its own expiresAt unless the credential or its agent
// is revoked, and renewing with it is accepted." This is what a keeper's retry
// does after a renewal whose answer was lost (PRB-09; TH-REN-04, PH-REN-05): it
// presents the earlier token again. Raw calls, not the SDK: bootstrap, renew,
// then renew again with the first token, each answer checked against the
// contract's schema. Runs after core-up, setup and prove-stack, with the
// scenario (`pnpm e2e:scenario-typescript`); never prints a credential.
import { readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { describe, expect, it } from 'vitest';
import { checkResponse } from '../../e2e/src/contract-ops.ts';
import { call, problemCode } from '../../e2e/src/https.ts';
import { layout, LIMITS, REPOSITORY_ROOT } from '../../e2e/src/stack.ts';

interface StackDescription {
  environment: { organization: string; project: string; environment: string };
  s3: string;
  ca: string;
  agents: { agent: string; secretFile: string }[];
}

interface Credential {
  credential: string;
  agent: string;
  instance: string;
  environment: StackDescription['environment'];
  expiresAt: string;
}

const RENEW = '/agent-credentials/current/renewal';
const INSTANCE = 'e2e-renewal-rule';
/** Long enough that a later issue time shows in expiresAt whatever its precision. */
const GAP_MS = 1_100;

describe('the renewal rule on the real stack (contract-v0.1.0+core.2)', () => {
  const stack = JSON.parse(readFileSync(layout(REPOSITORY_ROOT).stack, 'utf8')) as StackDescription;
  const ca = readFileSync(stack.ca, 'utf8');
  const { agent, secretFile } = stack.agents[0] ?? { agent: '', secretFile: '' };

  /** One call; a 200 checked against the contract and this stack, else the Problem's code. */
  async function credentialFrom(
    step: string,
    operationId: string,
    spec: { path: string; credential?: string; body?: unknown },
  ): Promise<Credential> {
    const r = await call({ step, base: stack.s3, ca, limitMs: LIMITS.call, ...spec });
    expect(`${step}: ${r.status} ${problemCode(r.body) ?? ''}`.trim()).toBe(`${step}: 200`);
    expect(checkResponse(operationId, 200, r.body)).toEqual([]);
    const c = r.body as Credential;
    expect([c.agent, c.instance, c.environment]).toEqual([agent, INSTANCE, stack.environment]);
    return c;
  }

  it('a renewal retried with the earlier token is accepted, with a later expiresAt', async () => {
    const first = await credentialFrom('exchangeBootstrap', 'exchangeBootstrap', {
      path: '/agent-credentials',
      body: { agent, secret: readFileSync(secretFile, 'utf8'), instance: INSTANCE },
    });
    await sleep(GAP_MS);
    // The renewal whose answer a client may lose: the platform has renewed.
    const renewed = await credentialFrom('renewAgentCredential', 'renewAgentCredential', {
      path: RENEW,
      credential: first.credential,
    });
    expect(Date.parse(renewed.expiresAt)).toBeGreaterThan(Date.parse(first.expiresAt));
    await sleep(GAP_MS);
    // The retry: the first token again, after a renewal issued a newer one.
    const retried = await credentialFrom('renewAgentCredential (retry)', 'renewAgentCredential', {
      path: RENEW,
      credential: first.credential,
    });
    expect(Date.parse(retried.expiresAt)).toBeGreaterThan(Date.parse(first.expiresAt));
    expect(retried.credential).not.toBe(first.credential);
  });
});
