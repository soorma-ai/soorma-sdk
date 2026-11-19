// SPDX-License-Identifier: Apache-2.0
//
// The reference driver (business-logic-model §5): speaks the driver protocol,
// passes its declared cases, and with `--fault X` breaks exactly one rule.
// Run with --expose-gc (CDI-02's heap check). Test only; part of no package.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { namesFromTable } from '../../../tools/names/check.ts';
import {
  Client,
  DriverError,
  type Fault,
  fileProvider,
  type Item,
  readCa,
  testProvider,
  type Values,
  WARNINGS,
} from './client.ts';
import { secretRetained } from './heap.ts';
import { readFileSecret, SecretRefusal } from './secret.ts';
import { enableTestSdk, finishedSpans, tenantContext } from './tracing.ts';

export const COVERAGE = [
  'CC-CFG-01',
  'CC-SEC-01',
  'CC-SEC-03',
  'CC-ACQ-01',
  'CC-REN-01',
  'CC-CRD-01',
  'CC-DRF-01',
  'CC-TRC-01',
  'CC-FWD-01',
  'CC-FWD-02',
  'CC-PUB-01',
  'CC-PUB-03',
  'CC-SUB-01',
  'CC-STR-01',
  'CC-STR-04',
  'CC-STR-05',
  'CC-RCV-02',
  'CC-RCV-06',
  'CC-PRB-01',
  'CC-PRB-04',
  'CC-SPN-01',
  'CC-NEV-01',
  'CC-NAM-01',
  // Added at U3 (REN-07, SEC-01 reworded). CC-STR-13 is not declared: the
  // skip-boundary fault drops a superseded stream's end, so declaring it would
  // change that fault's declared set.
  'CC-REN-06',
  'CC-REN-07',
  'CC-ACQ-08',
  'CC-STR-12',
];
export const FAULTS = [
  'retain-secret',
  'reorder-forwarded-envelope',
  'retry-publish',
  'skip-boundary',
];

const DEFAULTS: Values = {
  H_renew: 2000,
  R_max: 3,
  W_max: 5000,
  B_init: 100,
  B_factor: 2,
  B_cap: 1000,
  L_ends: 6,
  W_super: 1000,
  N_buf: 64,
  T_idle: 20000,
  T_req: 5000,
  R_min: 1000,
};
const DEPTH = 64;
const faultArg = process.argv.indexOf('--fault');
const fault = (faultArg !== -1 ? process.argv[faultArg + 1] : undefined) as Fault;
if (fault && !FAULTS.includes(fault)) throw new Error(`unknown fault ${fault}`);

let client: Client | undefined;
let secretBytes: string | undefined;

const send = (o: object): void => {
  process.stdout.write(`${JSON.stringify(o)}\n`);
};

function asError(e: unknown): Record<string, unknown> {
  if (e instanceof DriverError) return e.data;
  if (e instanceof SecretRefusal)
    return { type: 'SecretSourceError', path: e.path, reason: e.reason };
  return { type: 'Error', message: (e as Error).message };
}

const need = (): Client => {
  if (!client) throw new DriverError({ type: 'ClientStateError', state: 'none' });
  return client;
};

async function handle(op: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  switch (op) {
    case 'describe':
      return {
        language: 'reference',
        runtime: process.version,
        sdkVersion: 'reference',
        values: DEFAULTS,
        depthBound: DEPTH,
        coverage: COVERAGE,
        faults: FAULTS,
      };
    case 'create': {
      client?.close();
      const values = { ...DEFAULTS, ...((args.values as Partial<Values>) ?? {}) };
      if (args.otel === true) enableTestSdk();
      const s = (args.secret ?? {}) as Record<string, unknown>;
      let provider: () => Promise<string>;
      if (s.kind === 'test') {
        secretBytes = String(s.bytes);
        provider = testProvider(secretBytes);
      } else if (s.kind === 'file') provider = fileProvider(String(s.path), readFileSecret);
      else if (s.kind === 'literal') provider = () => Promise.resolve(String(s.value));
      else
        provider = () =>
          Promise.reject(new DriverError({ type: 'SecretSourceError', reason: 'provider-failed' }));
      const ca = readCa(args.caFile);
      client = new Client(
        {
          s3: { base: String(args.dataGatewayUrl), ca },
          s4: { base: String(args.eventIngestUrl), ca },
          agent: String(args.agent),
          instance: String(args.instance),
          provider,
        },
        values,
        fault,
        DEPTH,
      );
      return {};
    }
    case 'start':
      await need().start();
      return { credential: need().details() };
    case 'credential':
      return { credential: client?.details() ?? null };
    case 'publish':
    case 'forward': {
      const tenant = args.inSpan
        ? tenantContext(String((args.inSpan as { name?: unknown }).name ?? 'tenant'))
        : undefined;
      const inbound: Item | undefined =
        op === 'forward' ? need().deliveries.get(String(args.ref)) : undefined;
      if (op === 'forward' && !inbound)
        throw new DriverError({ type: 'ClientStateError', state: 'no such delivery' });
      try {
        const traceparent = await need().publish(args.payload, tenant?.ctx, inbound);
        return { traceContext: { traceparent }, ...(tenant ? { tenantSpan: tenant.ids } : {}) };
      } finally {
        tenant?.end();
      }
    }
    case 'subscribe':
      need().subscribe();
      return {};
    case 'next': {
      const sub = need().subscription;
      if (!sub) throw new DriverError({ type: 'ClientStateError', state: 'not subscribed' });
      const item = await sub.next(Number(args.timeoutMs ?? 3000));
      if (item.kind === 'error') throw new DriverError(item.error as Record<string, unknown>);
      return item;
    }
    case 'closeSubscription':
      need().subscription?.close();
      return {};
    case 'close':
      client?.close();
      return {};
    case 'fileSecret': {
      const value = await readFileSecret(String(args.path));
      return { length: value.length };
    }
    case 'newInstanceId':
      return { value: crypto.randomUUID() };
    case 'warnings':
      return { warnings: WARNINGS };
    case 'inspect': {
      const checks = (args.checks as string[] | undefined) ?? [];
      const out: Record<string, unknown> = {};
      if (checks.includes('providerCalls')) out.providerCalls = client?.providerCalls ?? 0;
      if (checks.includes('secretRetained')) {
        out.secretRetained = await secretRetained(Buffer.from(secretBytes ?? '', 'base64'));
      }
      return out;
    }
    case 'spans':
      return finishedSpans();
    case 'names':
    case 'surface': {
      const md = readFileSync(
        resolve(import.meta.dirname, '..', '..', '..', 'spec', 'names.md'),
        'utf8',
      );
      if (op === 'names') return { names: [...namesFromTable(md, 'TypeScript')] };
      return {
        members: ['dataGatewayUrl', 'eventIngestUrl', 'caFile', 'agent', 'instance', 'secret'],
      };
    }
    case 'env':
      return {};
    case 'docs':
      return { text: '' };
    default:
      throw new Error(`unsupported op ${op}`);
  }
}

const rl = createInterface({ input: process.stdin });
rl.on('line', (line) => {
  const {
    id,
    op,
    args = {},
  } = JSON.parse(line) as { id: number; op: string; args?: Record<string, unknown> };
  handle(op, args).then(
    (result) => send({ id, ok: true, result }),
    (e: unknown) => send({ id, ok: false, error: asError(e) }),
  );
});
rl.on('close', () => {
  client?.close();
  setTimeout(() => process.exit(0), 50).unref();
});
