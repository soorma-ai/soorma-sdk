// SPDX-License-Identifier: Apache-2.0
//
// The subscription supervisor (C-17; SUB-01 to SUB-07, STR-01 to STR-09; P-04).
// A state machine over at most two streams, the current one and a replacement,
// feeding one bounded queue of at most N_buf items:
//
//   opening ──opened──▶ open ──new credential──▶ (replacement opening) ──opened──▶ replacing
//      ▲                 │                                                         │
//      │           non-terminal end                          old ends, or W_super, or a lineage change
//      │                 ▼                                                         │
//      └──backoff── backingOff                               open ◀── promote ─────┘
//
//   any state ──terminal end, L_ends, revoked, failure, close()──▶ done
//
// Backpressure (SUB-06): a stream is parsed only while the queue has room; a
// full queue pauses its socket, so the SDK reads only as tenant code pulls.
// T_idle and W_super count only while a socket is being read (STR-02, STR-05);
// a resume restarts T_idle. A replacement's socket stays paused from its
// opening until the old stream has ended, so its Deliveries wait upstream, not
// in the queue, and its *stream started* follows the old *stream ended*
// (STR-05). Every open goes through keeper.token(), which bootstraps only when
// keeper.isUsable() says the credential is not usable (CDI-06).
import type { IncomingMessage } from 'node:http';
import { clearTimer, monoNow, setTimer, sleep, type Timer } from './clock.ts';
import type { Delivery, Forwarder } from './delivery.ts';
import { draftText } from './draft.ts';
import { ProblemError } from './errors.ts';
import type { Keeper } from './keeper.ts';
import type { Limits } from './limits.ts';
import { readDelivery } from './reader.ts';
import { retry } from './retry.ts';
import { recordReceive, subscribeTraceContext } from './tracing.ts';
import {
  asTransportError,
  flatten,
  openStream,
  problemFrom,
  readReply,
  retryAfterSeconds,
  TransportFailure,
} from './transport.ts';
import type { DeliveryError, StreamEnded, StreamStarted } from './types.ts';

export type SubscriptionItem = Delivery | DeliveryError | StreamStarted | StreamEnded;

/** @internal What a subscription needs from its client. */
export interface SubscriptionOptions {
  s4: string;
  keeper: Keeper;
  limits: Limits;
  ca: () => readonly string[];
  forward: Forwarder;
}

/** An error the iterator raises in its turn (SUB-05). */
class Raise {
  readonly error: unknown;
  constructor(error: unknown) {
    this.error = error;
  }
}

/** A failure that is not the subscribe request's own: never retried here. */
class NotRetried extends Error {
  readonly error: unknown;
  constructor(error: unknown) {
    super('not retried');
    this.error = error;
  }
}

/** One stream: its socket, its unparsed text, and its reading state. */
class Stream {
  readonly res: IncomingMessage;
  /** The credential epoch the stream was opened with. */
  readonly epoch: number;
  pending = '';
  carry = '';
  /** The SDK consumes this stream (it is current, not a held replacement). */
  active = false;
  /** Its socket is resumed. */
  flowing = false;
  upstreamDone = false;
  finished = false;
  idle: Timer | undefined;

  constructor(res: IncomingMessage, epoch: number) {
    this.res = res;
    this.epoch = epoch;
  }
}

type State = 'opening' | 'open' | 'backingOff' | 'done';

const STARTED: StreamStarted = Object.freeze({ kind: 'streamStarted' });
const ended = (code: string | null, terminal: boolean): StreamEnded =>
  Object.freeze({ kind: 'streamEnded', code, terminal });
const DONE: IteratorReturnResult<undefined> = Object.freeze({ done: true, value: undefined });

export class Subscription implements AsyncIterable<SubscriptionItem> {
  readonly #o: SubscriptionOptions;
  readonly #abort = new AbortController();
  readonly #queue: (SubscriptionItem | Raise)[] = [];
  #wake: (() => void)[] = [];
  #state: State = 'opening';
  #current: Stream | undefined;
  /** A replacement in progress: opening (no stream yet) or open and held. */
  #next: { stream?: Stream } | undefined;
  #wsuper: { remaining: number; since: number; timer: Timer | undefined } | undefined;
  /** Credential events seen, and the last one that changed the lineage. */
  #epoch = 0;
  #lineageEpoch = 0;
  #ends = 0;
  #delay: number;
  #finished = false;
  #returned = false;
  #closing: Promise<void> | undefined;
  readonly #work = new Set<Promise<void>>();
  readonly #offCredential: () => void;

  /** @internal Subscriptions are made by AgentClient.subscribe(). */
  constructor(options: SubscriptionOptions) {
    this.#o = options;
    this.#delay = options.limits.B_init;
    this.#offCredential = options.keeper.onCredential({
      credential: (lineageChanged) => {
        this.#epoch++;
        if (lineageChanged) this.#lineageEpoch = this.#epoch;
        this.#checkCredential();
      },
      revoked: (problem) => {
        // A refusal while a stream is open ends it (REN-05, STR-07). Before a
        // stream opens, the subscribe's own failure is raised instead (SUB-05).
        if (this.#state !== 'opening') this.#terminal(problem.code);
      },
    });
    this.#run(this.#open());
  }

  /** @internal Active until finished or closed (SUB-04). */
  get active(): boolean {
    return !this.#finished;
  }

  // ---- the iterator (SUB-01, SUB-06, SUB-07; TH-LIFE-02) ----

  async #pull(): Promise<IteratorResult<SubscriptionItem, undefined>> {
    for (;;) {
      if (this.#returned) return DONE;
      const entry = this.#queue.shift();
      if (entry !== undefined) {
        this.#drained();
        if (entry instanceof Raise) {
          this.#returned = true;
          throw entry.error;
        }
        if (entry.kind === 'delivery') {
          recordReceive((entry.envelope as { traceContext?: unknown }).traceContext);
        }
        return { done: false, value: entry };
      }
      if (this.#finished) return DONE;
      await new Promise<void>((resolve) => this.#wake.push(resolve));
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<SubscriptionItem, undefined> {
    return {
      next: () => this.#pull(),
      return: async () => {
        this.#returned = true;
        await this.close();
        return DONE;
      },
    };
  }

  /** Closes the stream; the iterator yields a terminal *stream ended* and finishes (SUB-07). */
  close(): Promise<void> {
    this.#closing ??= (async () => {
      this.#terminal(null);
      await Promise.allSettled([...this.#work]);
    })();
    return this.#closing;
  }

  [Symbol.asyncDispose](): Promise<void> {
    return this.close();
  }

  // ---- the queue ----

  #push(entry: SubscriptionItem | Raise): void {
    this.#queue.push(entry);
    const wake = this.#wake;
    this.#wake = [];
    for (const w of wake) w();
  }

  #full(): boolean {
    return this.#queue.length >= this.#o.limits.N_buf;
  }

  /** Tenant code pulled an item: the current stream may read again. */
  #drained(): void {
    const s = this.#current;
    if (s?.active && !this.#full()) this.#pump(s);
  }

  // ---- opening ----

  #run(p: Promise<void>): void {
    const tracked = p.catch((error: unknown) => this.#fail(error));
    this.#work.add(tracked);
    void tracked.finally(() => this.#work.delete(tracked));
  }

  /** Opens the first stream, or the next one after a non-terminal end. */
  async #open(): Promise<void> {
    this.#state = 'opening';
    const s = await this.#connect();
    if (this.#finished) {
      s.res.destroy();
      return;
    }
    this.#state = 'open';
    this.#makeCurrent(s);
  }

  /** POST /subscriptions with retries (SUB-01, SUB-05; PRB-05, PRB-08, PRB-09). */
  async #connect(): Promise<Stream> {
    let rebootstrapped = false;
    for (;;) {
      try {
        return await retry('subscribe', () => this.#attempt(), {
          limits: this.#o.limits,
          signal: this.#abort.signal,
        });
      } catch (error) {
        if (error instanceof NotRetried) throw error.error;
        if (error instanceof TransportFailure) throw asTransportError(error);
        if (error instanceof ProblemError && error.status === 401) {
          if (error.code === 'credential_expired' && !rebootstrapped) {
            // REN-06: bootstrap and subscribe again, once.
            rebootstrapped = true;
            this.#o.keeper.noteExpired();
            continue;
          }
          if (error.code === 'credential_refused') this.#o.keeper.revoke(error);
        }
        throw error;
      }
    }
  }

  async #attempt(): Promise<Stream> {
    let token: string;
    try {
      token = await this.#o.keeper.token();
    } catch (error) {
      throw new NotRetried(error);
    }
    const epoch = this.#epoch;
    const res = await openStream({
      base: this.#o.s4,
      path: '/subscriptions',
      headers: { authorization: `Bearer ${token}`, accept: 'text/event-stream' },
      body: `{"draft":${draftText(subscribeTraceContext())}}`,
      ca: this.#o.ca(),
      timeoutMs: this.#o.limits.T_req,
      signal: this.#abort.signal,
    });
    if (res.statusCode === 200) return new Stream(res, epoch);
    throw problemFrom(await readReply(res, this.#abort.signal));
  }

  #makeCurrent(s: Stream): void {
    this.#current = s;
    this.#attach(s);
    this.#push(STARTED);
    s.active = true;
    this.#pump(s);
    this.#checkCredential();
  }

  /** A failure with no stream to end: the iterator raises it (SUB-05). */
  #fail(error: unknown): void {
    if (this.#finished) return;
    this.#push(new Raise(error));
    this.#finish();
  }

  // ---- replacement (STR-04, STR-05, STR-09) ----

  /** A new credential since the current stream opened: open its replacement. */
  #checkCredential(): void {
    const cur = this.#current;
    if (this.#state !== 'open' || !cur || this.#next || this.#epoch <= cur.epoch) return;
    this.#next = {};
    this.#run(this.#replace());
  }

  async #replace(): Promise<void> {
    let s: Stream;
    try {
      s = await this.#connect();
    } catch (error) {
      if (this.#finished) return;
      this.#next = undefined;
      // The old stream, if it is still open, runs until it ends on its own.
      if (this.#current) return;
      throw error;
    }
    const next = this.#next;
    if (this.#finished || !next) {
      s.res.destroy();
      return;
    }
    next.stream = s;
    this.#attach(s); // paused until promoted
    const old = this.#current;
    if (!old) this.#promote();
    else if (this.#lineageEpoch > old.epoch)
      this.#forceSwitch(); // no superseded will come
    else this.#startWsuper();
  }

  /** The replacement becomes current: *stream started*, then its Deliveries. */
  #promote(): void {
    const s = this.#next?.stream;
    if (!s) return;
    this.#next = undefined;
    this.#clearWsuper();
    this.#state = 'open';
    this.#current = s;
    this.#push(STARTED);
    s.active = true;
    this.#pump(s);
    this.#checkCredential();
  }

  /** The SDK closes the old stream itself: *stream ended* with no code (STR-05). */
  #forceSwitch(): void {
    const old = this.#current;
    if (old) {
      this.#release(old);
      this.#current = undefined;
      this.#push(ended(null, false));
    }
    this.#promote();
  }

  /** W_super counts only while the old stream is being read (STR-05). */
  #startWsuper(): void {
    this.#wsuper = { remaining: this.#o.limits.W_super, since: 0, timer: undefined };
    if (this.#current?.flowing) this.#runWsuper();
  }

  #runWsuper(): void {
    const w = this.#wsuper;
    if (!w || w.timer !== undefined) return;
    w.since = monoNow();
    w.timer = setTimer(() => this.#forceSwitch(), w.remaining);
  }

  #suspendWsuper(): void {
    const w = this.#wsuper;
    if (!w || w.timer === undefined) return;
    clearTimer(w.timer);
    w.timer = undefined;
    w.remaining = Math.max(0, w.remaining - (monoNow() - w.since));
  }

  #clearWsuper(): void {
    clearTimer(this.#wsuper?.timer);
    this.#wsuper = undefined;
  }

  // ---- reading a stream (SUB-02, SUB-06; STR-01, STR-02) ----

  #attach(s: Stream): void {
    s.res.pause(); // before a data listener, so the socket stays paused
    s.res.setEncoding('utf8');
    s.res.on('data', (chunk: string) => this.#onData(s, chunk));
    const done = (): void => this.#onUpstreamDone(s);
    s.res.on('end', done);
    s.res.on('close', done);
    s.res.on('error', done);
  }

  #onData(s: Stream, chunk: string): void {
    let text = s.carry + chunk;
    s.carry = '';
    if (text.endsWith('\r')) {
      s.carry = '\r';
      text = text.slice(0, -1);
    }
    s.pending += text.replace(/\r\n?/g, '\n');
    if (s.flowing) this.#restartIdle(s);
    this.#pump(s);
  }

  #onUpstreamDone(s: Stream): void {
    if (s.upstreamDone) return;
    s.upstreamDone = true;
    s.flowing = false;
    clearTimer(s.idle);
    if (this.#current === s) this.#suspendWsuper();
    this.#pump(s);
  }

  /** Parses whole events while the queue has room; pauses the socket when it has none. */
  #pump(s: Stream): void {
    if (!s.active || s.finished || this.#finished) return;
    for (;;) {
      if (this.#full()) {
        this.#pauseRead(s);
        return;
      }
      const at = s.pending.indexOf('\n\n');
      if (at < 0) break;
      const block = s.pending.slice(0, at);
      s.pending = s.pending.slice(at + 2);
      this.#dispatch(s, block);
      if (s.finished || this.#finished) return;
    }
    if (s.upstreamDone) this.#streamEnded(s, null);
    else this.#resumeRead(s);
  }

  #pauseRead(s: Stream): void {
    if (!s.flowing) return;
    s.flowing = false;
    s.res.pause();
    clearTimer(s.idle);
    if (this.#current === s) this.#suspendWsuper();
  }

  #resumeRead(s: Stream): void {
    if (s.flowing || s.upstreamDone) return;
    s.flowing = true;
    this.#restartIdle(s); // a resume restarts T_idle (STR-02)
    if (this.#current === s) this.#runWsuper();
    s.res.resume();
  }

  #restartIdle(s: Stream): void {
    clearTimer(s.idle);
    s.idle = setTimer(() => this.#streamEnded(s, null), this.#o.limits.T_idle);
  }

  /** One event: a Delivery, an end, or nothing (heartbeats are comments). */
  #dispatch(s: Stream, block: string): void {
    let event = 'message';
    const data: string[] = [];
    for (const line of block.split('\n')) {
      if (line === '' || line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon < 0 ? line : line.slice(0, colon);
      let value = colon < 0 ? '' : line.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'event') event = value;
      else if (field === 'data') data.push(value);
    }
    if (event === 'end') {
      this.#streamEnded(s, endCode(data.join('\n')));
    } else if (event === 'delivery' && data.length > 0) {
      const item = readDelivery(data.join('\n'), this.#o.forward);
      if (item.kind === 'delivery') this.#ends = 0;
      this.#push(item);
    }
  }

  // ---- ends (STR-02, STR-03, STR-05 to STR-07) ----

  #streamEnded(s: Stream, code: string | null): void {
    if (s.finished) return;
    this.#release(s);
    if (this.#finished || s !== this.#current) return;
    this.#current = undefined;
    this.#clearWsuper();
    if (this.#next) {
      // The old stream ended while its replacement opens or waits: switch (STR-05).
      this.#push(ended(code, false));
      this.#promote();
      return;
    }
    if (code === 'credential_refused') {
      // STR-07: terminal; the client is revoked (REN-05).
      this.#terminal(code);
      this.#o.keeper.revoke(new ProblemError({ status: 401, code }));
      return;
    }
    this.#ends++;
    if (this.#ends >= this.#o.limits.L_ends) {
      this.#terminal(code);
      return;
    }
    this.#push(ended(code, false));
    this.#state = 'backingOff';
    const retryAfter = retryAfterSeconds(flatten(s.res.headers));
    const wait = retryAfter === undefined ? this.#delay : retryAfter * 1000;
    this.#delay = Math.min(this.#delay * this.#o.limits.B_factor, this.#o.limits.B_cap);
    this.#run(this.#resubscribe(wait));
  }

  async #resubscribe(wait: number): Promise<void> {
    try {
      await sleep(wait, this.#abort.signal);
    } catch {
      return; // closed while waiting
    }
    if (!this.#finished) await this.#open();
  }

  /** A terminal *stream ended*, then nothing more (STR-06, STR-07, SUB-07). */
  #terminal(code: string | null): void {
    if (this.#finished) return;
    this.#push(ended(code, true));
    this.#finish();
  }

  /** Releases every stream, timer and request (PRB-07; TH-LIFE-01). */
  #finish(): void {
    this.#finished = true;
    this.#state = 'done';
    this.#offCredential();
    this.#clearWsuper();
    if (this.#current) this.#release(this.#current);
    if (this.#next?.stream) this.#release(this.#next.stream);
    this.#current = undefined;
    this.#next = undefined;
    this.#abort.abort();
    const wake = this.#wake;
    this.#wake = [];
    for (const w of wake) w();
  }

  #release(s: Stream): void {
    s.finished = true;
    s.flowing = false;
    s.active = false;
    clearTimer(s.idle);
    s.res.destroy();
  }
}

/** The `end` event's code, or null when its data carries no string `code` (STR-02). */
function endCode(data: string): string | null {
  try {
    const o = JSON.parse(data) as unknown;
    if (o !== null && typeof o === 'object' && typeof (o as { code?: unknown }).code === 'string') {
      return (o as { code: string }).code;
    }
  } catch {
    // not JSON: no code
  }
  return null;
}
