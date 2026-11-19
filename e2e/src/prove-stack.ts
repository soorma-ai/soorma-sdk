// SPDX-License-Identifier: Apache-2.0
//
// prove-stack (business-rules PS-01 to PS-06; business-logic-model §4). Reads
// only what an SDK would: the stack description and each agent's secret file.
// Per agent, one raw exchangeBootstrap at E's S3, expecting the contract's 200
// with a body valid against its schema, for the agent and environment the
// stack description names. Prints the agent, the status and pass or fail;
// never the credential or the secret, which is dropped once checked. The
// bootstrap uses nothing up (PS-04) and leaves no attempt behind (PS-05). No
// retry; non-zero if any agent's proof failed (PS-06).
import { readFileSync } from 'node:fs';
import { checkResponse } from './contract-ops.ts';
import { call, CallError, CallTimeout, problemCode } from './https.ts';
import { layout, type Limits } from './stack.ts';

export interface ProveOptions {
  root: string;
  limits: Limits;
  print: (line: string) => void;
}

interface Description {
  environment: { organization: string; project: string; environment: string };
  s3: string;
  ca: string;
  agents: { agent: string; secretFile: string }[];
}

const COMMAND = 'prove-stack';

/** I1: the credential is for the environment the agents were registered in. */
function sameEnvironment(got: unknown, want: Description['environment']): boolean {
  const g = got as Partial<Description['environment']> | undefined;
  return (
    g?.organization === want.organization &&
    g.project === want.project &&
    g.environment === want.environment
  );
}
export const INSTANCE = 'e2e-proof';

export async function proveStack(o: ProveOptions): Promise<number> {
  let d: Description;
  let ca: string;
  try {
    d = JSON.parse(readFileSync(layout(o.root).stack, 'utf8')) as Description;
    ca = readFileSync(d.ca, 'utf8');
  } catch {
    o.print(`${COMMAND}: failed: no readable stack description (.e2e/stack.json): run setup first`);
    return 1;
  }
  let failures = 0;
  for (const { agent, secretFile } of d.agents) {
    const step = `exchangeBootstrap ${agent}`;
    let verdict = 'fail';
    let status = '-';
    try {
      const secret = readFileSync(secretFile, 'utf8');
      const r = await call({
        step,
        base: d.s3,
        path: '/agent-credentials',
        ca,
        body: { agent, secret, instance: INSTANCE },
        limitMs: o.limits.call,
      });
      status = String(r.status);
      const body = r.body as
        { agent?: unknown; environment?: unknown; instance?: unknown } | undefined;
      if (
        r.status === 200 &&
        checkResponse('exchangeBootstrap', 200, r.body).length === 0 &&
        body?.agent === agent &&
        body.instance === INSTANCE &&
        sameEnvironment(body.environment, d.environment)
      ) {
        verdict = 'pass';
      } else if (r.status !== 200) {
        status = `${r.status} ${problemCode(r.body) ?? '-'}`;
      } else {
        status = '200 (response does not match the contract or this stack)';
      }
    } catch (error) {
      if (error instanceof CallTimeout || error instanceof CallError)
        o.print(`${COMMAND}: ${error.message}`);
      else o.print(`${COMMAND}: ${agent}: the secret file cannot be read`);
    }
    // The credential, if any, is dropped here: never kept, renewed or written.
    o.print(`${COMMAND}: ${agent}: ${status} ${verdict}`);
    if (verdict !== 'pass') failures++;
  }
  return failures === 0 ? 0 : 1;
}
