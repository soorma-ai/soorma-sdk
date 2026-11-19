// SPDX-License-Identifier: Apache-2.0
//
// The TypeScript conformance driver (TH-DRV; conformance/README.md). It speaks
// the driver protocol and calls only @soorma/sdk's public interface, loaded
// from the built package (`pnpm --dir typescript build` first), except where
// the protocol allows otherwise: `describe`'s values (dist/limits.js), the
// timing hook (dist/internal/test-values.js), `inspect` (U1's heap search and
// the runtime's own resource list), `spans`, `env`, `docs` and `warnings`.
// Run with --expose-gc. Test only; part of no package.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { inspect } from 'node:util';
import { secretRetained } from '../../conformance/reference-driver/src/heap.ts';
import type * as Sdk from '../src/index.ts';
import type * as Hook from '../src/internal/test-values.ts';
import type * as LimitsModule from '../src/limits.ts';
import { exportedNames, settableMembers } from './names.ts';
import { enableTestSdk, finishedSpans, inTenantSpan } from './spans.ts';

const PACKAGE = resolve(import.meta.dirname, '..');
const DIST = join(PACKAGE, 'dist');
const load = async <T>(file: string): Promise<T> =>
  (await import(pathToFileURL(join(DIST, file)).href)) as T;
const sdk = await load<typeof Sdk>('index.js');
const hook = await load<typeof Hook>(join('internal', 'test-values.js'));
const { LIMITS, D_LANG } = await load<typeof LimitsModule>('limits.js');
const VERSION = (
  JSON.parse(readFileSync(join(PACKAGE, 'package.json'), 'utf8')) as { version: string }
).version;

type Args = Record<string, unknown>;
type Item = Sdk.SubscriptionItem;

class DriverError extends Error {
  readonly data: Record<string, unknown>;
  constructor(data: Record<string, unknown>) {
    super(String(data.type));
    this.data = data;
  }
}

let client: Sdk.AgentClient | undefined;
let subscription: Sdk.Subscription | undefined;
let iterator: AsyncIterator<Item, undefined> | undefined;
let pull: Promise<IteratorResult<Item, undefined>> | undefined;
let render = false;
let secretBytes = '';
let providerCalls = 0;
let refs = 0;
const deliveries = new Map<string, Sdk.Delivery>();
const warnings: { code: string }[] = [];

// REN-07's warning, as the protocol names it.
process.on('warning', (w: Error & { code?: string }) => {
  if (w.name === 'SoormaWarning')
    warnings.push({ code: w.code === 'SOORMA_CLOCK_SKEW' ? 'clock-skew' : String(w.code) });
});

const need = (): Sdk.AgentClient => {
  if (!client) throw new DriverError({ type: 'ClientStateError', state: 'none' });
  return client;
};

function asError(e: unknown): Record<string, unknown> {
  if (render) process.stderr.write(`${String(e)}\n${inspect(e)}\n${JSON.stringify(e)}\n`);
  if (e instanceof DriverError) return e.data;
  if (e instanceof sdk.ProblemError) {
    return {
      type: 'ProblemError',
      status: e.status,
      code: e.code,
      title: e.title ?? null,
      detail: e.detail ?? null,
      ...(e.retryAfter === undefined ? {} : { retryAfter: e.retryAfter }),
      ...(e.problem === undefined ? {} : { problem: e.problem }),
    };
  }
  if (e instanceof sdk.TransportError) return { type: 'TransportError', reason: e.reason };
  if (e instanceof sdk.SecretSourceError) {
    return {
      type: 'SecretSourceError',
      reason: e.reason,
      ...(e.path === undefined ? {} : { path: e.path }),
    };
  }
  if (e instanceof sdk.ClientStateError) return { type: 'ClientStateError', state: e.state };
  return { type: (e as Error)?.name ?? 'Error', message: String((e as Error)?.message ?? e) };
}

function provider(s: Args): Sdk.SecretProvider {
  const counted =
    (p: Sdk.SecretProvider): Sdk.SecretProvider =>
    () => {
      providerCalls++;
      return p();
    };
  switch (s.kind) {
    case 'test':
      // A new string from the bytes on each call; only the bytes are kept.
      secretBytes = String(s.bytes);
      return counted(() => Promise.resolve(Buffer.from(secretBytes, 'base64').toString('utf8')));
    case 'file':
      return counted(sdk.fileSecret(String(s.path)));
    case 'literal':
      return counted(() => Promise.resolve(String(s.value)));
    default:
      return counted(() => Promise.reject(new Error('the provider failed')));
  }
}

function item(i: Item): Record<string, unknown> {
  if (i.kind !== 'delivery') return { ...i };
  const ref = String(++refs);
  deliveries.set(ref, i);
  return {
    kind: 'delivery',
    ref,
    envelope: i.envelope,
    envelopeText: i.envelopeText,
    seal: i.seal,
    ...(i.payloadParsed ? { payload: i.payload } : {}),
    payloadText: i.payloadText,
    payloadParsed: i.payloadParsed,
  };
}

/** Waits up to `ms`; a pull still pending stays pending for the next `next`. */
async function next(ms: number): Promise<Record<string, unknown>> {
  if (!iterator) throw new DriverError({ type: 'ClientStateError', state: 'not subscribed' });
  pull ??= iterator.next();
  const current = pull;
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<'timeout'>((r) => (timer = setTimeout(() => r('timeout'), ms)));
  const settled = current.then(
    (v) => ({ v }),
    (e: unknown) => ({ e }),
  );
  const r = await Promise.race([settled, timeout]);
  clearTimeout(timer);
  if (r === 'timeout') return { timeout: true };
  pull = undefined;
  if ('e' in r) throw r.e;
  return r.v.done ? { kind: 'done' } : item(r.v.value);
}

/** The runtime's own list of what keeps the process alive (CC-PRB-07). */
function openResources(): { sockets: number; streams: number; timers: number } {
  const info = process.getActiveResourcesInfo();
  const count = (types: string[]): number => info.filter((t) => types.includes(t)).length;
  return {
    sockets: count(['TCPSocketWrap', 'TCPWRAP', 'TLSWrap', 'TLSWRAP']),
    streams: count(['FileHandle', 'FSReqCallback', 'FSReqPromise']),
    timers: count(['Timeout', 'Immediate']),
  };
}

function docs(topic: string): string {
  const heading = topic === 'spans' ? '## Spans' : '## Delivery';
  const text = readFileSync(join(PACKAGE, 'README.md'), 'utf8');
  const start = text.indexOf(`\n${heading}\n`);
  if (start < 0) return '';
  const end = text.indexOf('\n## ', start + heading.length + 2);
  return text.slice(start + 1, end < 0 ? undefined : end).replace(/\s+/g, ' ');
}

async function closeClient(): Promise<void> {
  const c = client;
  client = undefined;
  subscription = undefined;
  iterator = undefined;
  pull = undefined;
  await c?.close();
}

async function handle(op: string, args: Args): Promise<Record<string, unknown>> {
  switch (op) {
    case 'describe':
      return {
        language: 'typescript',
        runtime: process.version,
        sdkVersion: VERSION,
        values: { ...LIMITS },
        depthBound: D_LANG,
        faults: [],
      };
    case 'create': {
      await closeClient();
      if (args.otel === true) enableTestSdk();
      render = args.render === true;
      providerCalls = 0;
      warnings.length = 0;
      // The driver's own arguments; every other member goes to the client as given.
      const options = { ...args };
      const { values, secret } = args;
      for (const k of ['values', 'secret', 'otel', 'logLevel', 'render']) delete options[k];
      hook.setTestValues(values as Record<string, number> | undefined);
      try {
        client = new sdk.AgentClient({
          ...(options as unknown as Sdk.AgentClientOptions),
          secret: provider((secret ?? {}) as Args),
        });
      } finally {
        hook.setTestValues(undefined); // captured when the client is constructed
      }
      if (render)
        process.stderr.write(`${String(client)}\n${inspect(client)}\n${JSON.stringify(client)}\n`);
      return {};
    }
    case 'start':
      await need().start();
      return { credential: need().credential };
    case 'credential': {
      try {
        return { credential: need().credential };
      } catch {
        return { credential: null };
      }
    }
    case 'publish':
    case 'forward': {
      const inSpan = (args.inSpan as { name?: unknown } | undefined)?.name;
      let send: () => Promise<Sdk.PublishAccepted>;
      if (op === 'forward') {
        const d = deliveries.get(String(args.ref));
        if (!d) throw new DriverError({ type: 'ClientStateError', state: 'no such delivery' });
        send = () => d.publish(args.payload as Sdk.JsonValue);
      } else {
        const c = need();
        send = () => c.publish(args.payload as Sdk.JsonValue);
      }
      const { value, tenantSpan } = await inTenantSpan(
        inSpan === undefined ? undefined : String(inSpan),
        send,
      );
      return { traceContext: value.traceContext, ...(tenantSpan ? { tenantSpan } : {}) };
    }
    case 'subscribe':
      subscription = need().subscribe();
      iterator = subscription[Symbol.asyncIterator]();
      pull = undefined;
      return {};
    case 'next':
      return next(Number(args.timeoutMs ?? 3000));
    case 'closeSubscription':
      await subscription?.close();
      return {};
    case 'close':
      await client?.close();
      return {};
    case 'fileSecret': {
      const value = await sdk.fileSecret(String(args.path))();
      return { length: value.length };
    }
    case 'newInstanceId':
      return { value: sdk.newInstanceId() };
    case 'warnings':
      return { warnings: [...warnings] };
    case 'inspect': {
      const checks = (args.checks as string[] | undefined) ?? [];
      const out: Record<string, unknown> = {};
      if (checks.includes('providerCalls')) out.providerCalls = providerCalls;
      if (checks.includes('secretRetained'))
        out.secretRetained = await secretRetained(Buffer.from(secretBytes, 'base64'));
      if (checks.includes('openResources')) out.openResources = openResources();
      return out;
    }
    case 'spans':
      return finishedSpans();
    case 'names':
      return { names: exportedNames(join(DIST, 'index.d.ts')) };
    case 'surface':
      return { members: settableMembers(join(DIST, 'index.d.ts')) };
    case 'env':
      for (const [k, v] of Object.entries((args.set ?? {}) as Record<string, unknown>))
        process.env[k] = String(v);
      return {};
    case 'docs':
      return { text: docs(String(args.topic)) };
    default:
      throw new DriverError({ type: 'UnsupportedOperation', op });
  }
}

const send = (o: object): void => {
  process.stdout.write(`${JSON.stringify(o)}\n`);
};

const rl = createInterface({ input: process.stdin });
rl.on('line', (line) => {
  const { id, op, args = {} } = JSON.parse(line) as { id: number; op: string; args?: Args };
  handle(op, args).then(
    (result) => send({ id, ok: true, result }),
    (e: unknown) => send({ id, ok: false, error: asError(e) }),
  );
});
rl.on('close', () => {
  void closeClient().finally(() => process.exit(0));
});
