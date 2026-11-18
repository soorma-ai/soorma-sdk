// SPDX-License-Identifier: Apache-2.0
//
// A minimal client written against the stub: just enough of spec/behaviour.md
// to pass the reference driver's declared cases, and to break exactly one rule
// when a fault is switched on. Test only; it is not the SDK.
import { readFileSync } from 'node:fs';
import type { Context } from '@opentelemetry/api';
import { rangeAt, spanAt } from '../../runner/src/json-span.ts';
import { openStream, post, retryAfterSeconds, TransportFailure, type Target } from './http.ts';
import { parseTraceparent, recordReceive, startSend } from './tracing.ts';

export type Fault =
  'retain-secret' | 'reorder-forwarded-envelope' | 'retry-publish' | 'skip-boundary' | undefined;
export const RETAINED: string[] = [];

export interface Values {
  H_renew: number;
  R_max: number;
  W_max: number;
  B_init: number;
  B_factor: number;
  B_cap: number;
  L_ends: number;
  W_super: number;
  N_buf: number;
  T_idle: number;
  T_req: number;
}

export class DriverError extends Error {
  readonly data: Record<string, unknown>;
  constructor(data: Record<string, unknown>) {
    super(String(data.type));
    this.data = data;
  }
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const VERSION = '0.1.0';

function problemError(status: number, headers: Record<string, string>, body: string): DriverError {
  let problem: Record<string, unknown> | undefined;
  try {
    const p = JSON.parse(body) as unknown;
    if (p && typeof p === 'object' && !Array.isArray(p)) problem = p as Record<string, unknown>;
  } catch {
    problem = undefined;
  }
  const isProblem =
    problem !== undefined &&
    (problem.code === undefined || typeof problem.code === 'string') &&
    (problem.status === undefined || typeof problem.status === 'number');
  const retryAfter = retryAfterSeconds(headers);
  return new DriverError({
    type: 'ProblemError',
    status,
    code: isProblem ? (problem?.code ?? null) : null,
    title: isProblem ? (problem?.title ?? null) : null,
    detail: isProblem ? (problem?.detail ?? null) : null,
    ...(retryAfter !== undefined ? { retryAfter } : {}),
    ...(isProblem ? { problem } : {}),
  });
}

const transport = (e: TransportFailure): DriverError =>
  new DriverError({ type: 'TransportError', reason: e.reason });

export interface Credential {
  token: string;
  details: Record<string, unknown>;
  expiresAt: number;
}

export type Item = Record<string, unknown>;

export interface ClientOptions {
  s3: Target;
  s4: Target;
  agent: string;
  instance: string;
  provider: () => Promise<string>;
}

export class Client {
  private credential: Credential | undefined;
  private state: 'created' | 'started' | 'revoked' | 'closed' = 'created';
  private renewTimer: NodeJS.Timeout | undefined;
  private listeners: ((c: Credential, lineageChanged: boolean) => void)[] = [];
  providerCalls = 0;
  subscription: Subscription | undefined;
  readonly deliveries = new Map<string, Item>();

  readonly opts: ClientOptions;
  readonly values: Values;
  readonly fault: Fault;
  readonly depthBound: number;

  constructor(opts: ClientOptions, values: Values, fault: Fault, depthBound: number) {
    this.opts = opts;
    this.values = values;
    this.fault = fault;
    this.depthBound = depthBound;
  }

  details(): Record<string, unknown> | null {
    return this.credential ? this.credential.details : null;
  }

  private async withRetry<T>(attempt: () => Promise<T>): Promise<T> {
    const started = Date.now();
    let delay = this.values.B_init;
    for (let n = 1; ; n++) {
      try {
        return await attempt();
      } catch (e) {
        const err = e as DriverError;
        const retryable =
          (err.data?.type === 'ProblemError' && err.data.status === 503) ||
          (err.data?.type === 'TransportError' && err.data.reason !== 'tls');
        if (!retryable || n >= this.values.R_max) throw e;
        const ra = err.data.retryAfter;
        const wait = typeof ra === 'number' ? ra * 1000 : delay;
        if (Date.now() - started + wait > this.values.W_max) throw e;
        await sleep(wait);
        delay = Math.min(delay * this.values.B_factor, this.values.B_cap);
      }
    }
  }

  private async bootstrap(): Promise<Credential> {
    return this.withRetry(async () => {
      this.providerCalls++;
      const secret = await this.opts.provider();
      if (this.fault === 'retain-secret') RETAINED.push(secret);
      const body = `{"agent":${JSON.stringify(this.opts.agent)},"secret":${JSON.stringify(secret)},"instance":${JSON.stringify(this.opts.instance)}}`;
      let r;
      try {
        r = await post(
          this.opts.s3,
          '/agent-credentials',
          { 'content-type': 'application/json', 'soorma-contract-version': VERSION },
          body,
          this.values.T_req,
        );
      } catch (e) {
        throw e instanceof TransportFailure ? transport(e) : e;
      }
      if (r.status !== 200) throw problemError(r.status, r.headers, r.body);
      return this.usable(r.body);
    });
  }

  private usable(body: string): Credential {
    try {
      const c = JSON.parse(body) as Record<string, unknown>;
      const exp = Date.parse(String(c.expiresAt));
      if (
        typeof c.credential !== 'string' ||
        typeof c.instance !== 'string' ||
        typeof c.agent !== 'string' ||
        Number.isNaN(exp) ||
        !c.environment
      )
        throw new Error('unusable');
      return {
        token: c.credential,
        expiresAt: exp,
        details: {
          agent: c.agent,
          instance: c.instance,
          environment: c.environment,
          expiresAt: c.expiresAt,
        },
      };
    } catch {
      throw new DriverError({ type: 'TransportError', reason: 'unusable-response' });
    }
  }

  async start(): Promise<void> {
    if (this.state !== 'created')
      throw new DriverError({ type: 'ClientStateError', state: this.state });
    this.adopt(await this.bootstrap(), true);
    this.state = 'started';
  }

  private adopt(c: Credential, lineageChanged: boolean): void {
    this.credential = c;
    for (const l of this.listeners) l(c, lineageChanged);
    clearTimeout(this.renewTimer);
    const at = c.expiresAt - this.values.H_renew - Date.now();
    this.renewTimer = setTimeout(() => void this.renew(), Math.max(0, at));
  }

  private async renew(): Promise<void> {
    const current = this.credential;
    if (!current || this.state !== 'started') return;
    try {
      const r = await this.withRetry(async () => {
        let reply;
        try {
          reply = await post(
            this.opts.s3,
            '/agent-credentials/current/renewal',
            { authorization: `Bearer ${current.token}`, 'soorma-contract-version': VERSION },
            undefined,
            this.values.T_req,
          );
        } catch (e) {
          throw e instanceof TransportFailure ? transport(e) : e;
        }
        if (reply.status !== 200) throw problemError(reply.status, reply.headers, reply.body);
        return reply;
      });
      const next = this.usable(r.body);
      this.adopt(next, next.expiresAt <= current.expiresAt);
    } catch (e) {
      const d = (e as DriverError).data ?? {};
      if (d.code === 'credential_refused') {
        this.state = 'revoked';
        this.subscription?.terminate('credential_refused');
      } else if (d.code === 'credential_expired') {
        this.adopt(await this.bootstrap(), true);
      }
    }
  }

  onCredential(l: (c: Credential, lineageChanged: boolean) => void): void {
    this.listeners.push(l);
  }

  token(): string {
    if (this.state !== 'started' || !this.credential)
      throw new DriverError({ type: 'ClientStateError', state: this.state });
    return this.credential.token;
  }

  async publish(
    payload: unknown,
    tenant: Context | undefined,
    inbound: Item | undefined,
  ): Promise<string> {
    const token = this.token();
    const received = inbound
      ? parseTraceparent(
          (inbound.envelope as { traceContext?: { traceparent?: unknown } } | undefined)
            ?.traceContext?.traceparent,
        )
      : undefined;
    const span = startSend({
      ...(tenant ? { tenant } : {}),
      received,
      forwarding: inbound !== undefined,
    });
    let draft = `{"clientContractVersion":"${VERSION}","traceContext":{"traceparent":"${span.traceparent}"}`;
    if (inbound) {
      let env = String(inbound.envelopeText);
      if (this.fault === 'reorder-forwarded-envelope')
        env = JSON.stringify(sortKeys(JSON.parse(env)));
      draft += `,"inbound":{"envelope":${env},"seal":${JSON.stringify(inbound.seal)}}`;
    }
    const body = `{"draft":${draft}},"payload":${JSON.stringify(payload ?? null)}}`;
    const send = async (): Promise<void> => {
      let r;
      try {
        r = await post(
          this.opts.s4,
          '/events',
          { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body,
          this.values.T_req,
        );
      } catch (e) {
        throw e instanceof TransportFailure ? transport(e) : e;
      }
      if (r.status !== 202) throw problemError(r.status, r.headers, r.body);
    };
    try {
      try {
        await send();
      } catch (e) {
        if (this.fault === 'retry-publish' && (e as DriverError).data?.status === 503) await send();
        else throw e;
      }
      span.end();
      return span.traceparent;
    } catch (e) {
      span.end(String((e as DriverError).data?.code ?? (e as DriverError).data?.reason ?? 'error'));
      throw e;
    }
  }

  subscribe(): Subscription {
    if (this.subscription && !this.subscription.finished)
      throw new DriverError({ type: 'ClientStateError', state: 'subscribed' });
    this.token();
    this.subscription = new Subscription(this);
    this.subscription.begin();
    return this.subscription;
  }

  close(): void {
    clearTimeout(this.renewTimer);
    this.subscription?.close();
    this.state = 'closed';
  }

  parseDelivery(line: string): Item {
    try {
      const envelopeText = spanAt(line, '/envelope');
      const sealText = spanAt(line, '/seal');
      const payloadRange = rangeAt(line, '/payload');
      const payloadText = line.slice(payloadRange.start, payloadRange.end);
      const envelope = JSON.parse(envelopeText) as unknown;
      const seal = JSON.parse(sealText) as unknown;
      if (
        !envelope ||
        typeof envelope !== 'object' ||
        Array.isArray(envelope) ||
        typeof seal !== 'string'
      )
        throw new Error('shape');
      const deep = depthOf(payloadText) > this.depthBound;
      return {
        kind: 'delivery',
        envelope,
        envelopeText,
        seal,
        payloadText,
        payloadParsed: !deep,
        ...(deep ? {} : { payload: JSON.parse(payloadText) as unknown }),
      };
    } catch (e) {
      return { kind: 'deliveryError', reason: (e as Error).message, text: line };
    }
  }
}

function depthOf(text: string): number {
  let depth = 0;
  let max = 0;
  let inStr = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{' || c === '[') max = Math.max(max, ++depth);
    else if (c === '}' || c === ']') depth--;
  }
  return max;
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object')
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]),
    );
  return v;
}

interface Stream {
  destroy: () => void;
  ended: boolean;
}

export class Subscription {
  private readonly items: Item[] = [];
  private waiters: ((i: Item) => void)[] = [];
  private current: Stream | undefined;
  private replacement: { stream: Stream; held: Item[]; timer: NodeJS.Timeout } | undefined;
  private consecutiveEnds = 0;
  private delay: number;
  finished = false;
  private closing = false;
  private refs = 0;

  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;
    this.delay = client.values.B_init;
    client.onCredential((_c, lineageChanged) => {
      if (!this.finished && !this.closing) void this.replace(lineageChanged);
    });
  }

  private push(i: Item): void {
    if (i.kind === 'delivery') {
      this.refs++;
      i.ref = String(this.refs);
      this.client.deliveries.set(String(this.refs), i);
      recordReceive(
        parseTraceparent(
          (i.envelope as { traceContext?: { traceparent?: unknown } }).traceContext?.traceparent,
        ),
      );
    }
    const w = this.waiters.shift();
    if (w) w(i);
    else this.items.push(i);
  }

  next(timeoutMs: number): Promise<Item> {
    const i = this.items.shift();
    if (i) return Promise.resolve(i);
    if (this.finished) return Promise.resolve({ kind: 'done' });
    return new Promise((done) => {
      const t = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== resolve);
        done({ timeout: true });
      }, timeoutMs);
      const resolve = (x: Item): void => {
        clearTimeout(t);
        done(x);
      };
      this.waiters.push(resolve);
    });
  }

  begin(): void {
    void this.open(false);
  }

  private async connect(): Promise<{
    res: import('node:http').IncomingMessage;
    destroy: () => void;
  }> {
    const body = `{"draft":{"clientContractVersion":"${VERSION}","traceContext":{"traceparent":"${startSend({ forwarding: false }).traceparent}"}}}`;
    return openStream(
      this.client.opts.s4,
      '/subscriptions',
      { 'content-type': 'application/json', authorization: `Bearer ${this.client.token()}` },
      body,
      this.client.values.T_req,
    );
  }

  /** Opens a stream; as a replacement, its items are held until the old one ends. */
  private async open(asReplacement: boolean): Promise<void> {
    let conn;
    for (let n = 1; ; n++) {
      try {
        conn = await this.connect();
      } catch (e) {
        if (e instanceof TransportFailure && e.reason !== 'tls' && n < this.client.values.R_max) {
          await sleep(this.delay);
          continue;
        }
        return this.fail(e instanceof TransportFailure ? transport(e).data : { type: 'Error' });
      }
      if (conn.res.statusCode === 200) break;
      const text = await new Promise<string>((done) => {
        let t = '';
        conn!.res.on('data', (c: Buffer) => (t += c.toString()));
        conn!.res.on('end', () => done(t));
      });
      const err = problemError(
        conn.res.statusCode ?? 0,
        conn.res.headers as Record<string, string>,
        text,
      );
      if (err.data.status === 503 && n < this.client.values.R_max) {
        const ra = err.data.retryAfter;
        await sleep(typeof ra === 'number' ? ra * 1000 : this.delay);
        continue;
      }
      return this.fail(err.data);
    }
    const stream: Stream = { destroy: conn.destroy, ended: false };
    if (asReplacement) {
      this.replacement = {
        stream,
        held: [],
        timer: setTimeout(() => this.forceSwitch(), this.client.values.W_super),
      };
    } else {
      this.current = stream;
      this.push({ kind: 'streamStarted' });
    }
    this.read(conn.res, stream);
  }

  private fail(error: Record<string, unknown>): void {
    this.finished = true;
    const w = this.waiters.shift();
    const item = { kind: 'error', error };
    if (w) w(item);
    else this.items.push(item);
  }

  private read(res: import('node:http').IncomingMessage, stream: Stream): void {
    let buffer = '';
    let endCode: string | null | undefined;
    res.setEncoding('utf8');
    res.on('data', (chunk: string) => {
      buffer += chunk;
      let at: number;
      while ((at = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, at);
        buffer = buffer.slice(at + 2);
        let event = '';
        let data = '';
        for (const line of block.split('\n')) {
          if (line.startsWith(':')) continue;
          if (line.startsWith('event: ')) event = line.slice(7);
          else if (line.startsWith('data: ')) data += line.slice(6);
        }
        if (event === 'delivery') this.deliver(stream, this.client.parseDelivery(data));
        else if (event === 'end') {
          try {
            const o = JSON.parse(data) as { code?: unknown };
            endCode = typeof o.code === 'string' ? o.code : null;
          } catch {
            endCode = null;
          }
        }
      }
    });
    res.on('close', () => void this.streamClosed(stream, endCode ?? null));
  }

  private deliver(stream: Stream, item: Item): void {
    if (this.replacement && stream === this.replacement.stream) this.replacement.held.push(item);
    else if (stream === this.current) {
      if (item.kind === 'delivery') this.consecutiveEnds = 0;
      this.push(item);
    }
  }

  private async replace(lineageChanged: boolean): Promise<void> {
    await this.open(true);
    if (lineageChanged) this.forceSwitch();
  }

  private forceSwitch(): void {
    if (!this.replacement) return;
    const old = this.current;
    if (old && !old.ended) {
      old.ended = true;
      old.destroy();
      this.push({ kind: 'streamEnded', code: null, terminal: false });
    }
    this.promote();
  }

  private promote(): void {
    const r = this.replacement;
    if (!r) return;
    clearTimeout(r.timer);
    this.replacement = undefined;
    this.current = r.stream;
    this.push({ kind: 'streamStarted' });
    for (const i of r.held) this.push(i);
  }

  private async streamClosed(stream: Stream, code: string | null): Promise<void> {
    if (this.replacement && stream === this.replacement.stream) return;
    if (stream !== this.current || stream.ended) return;
    stream.ended = true;
    if (this.closing) return;
    if (this.replacement) {
      if (!(this.client.fault === 'skip-boundary' && code === 'superseded'))
        this.push({ kind: 'streamEnded', code, terminal: false });
      this.promote();
      return;
    }
    if (code === 'credential_refused') return this.terminate(code);
    this.consecutiveEnds++;
    if (this.consecutiveEnds >= this.client.values.L_ends) return this.terminate(code);
    this.push({ kind: 'streamEnded', code, terminal: false });
    await sleep(this.delay);
    this.delay = Math.min(this.delay * this.client.values.B_factor, this.client.values.B_cap);
    await this.open(false);
  }

  terminate(code: string | null): void {
    if (this.finished) return;
    this.push({ kind: 'streamEnded', code, terminal: true });
    this.finished = true;
    this.current?.destroy();
    this.replacement?.stream.destroy();
  }

  close(): void {
    if (this.finished) return;
    this.closing = true;
    this.terminate(null);
  }
}

export function testProvider(bytesBase64: string): () => Promise<string> {
  const bytes = Buffer.from(bytesBase64, 'base64');
  return () => Promise.resolve(bytes.toString('utf8'));
}

export function fileProvider(
  path: string,
  read: (p: string) => Promise<string>,
): () => Promise<string> {
  return () => read(path);
}

export const readCa = (path: unknown): Buffer | undefined =>
  typeof path === 'string' ? readFileSync(path) : undefined;
