// SPDX-License-Identifier: Apache-2.0
//
// The agent client (C-11): one per agent instance. Creating it contacts nothing
// (CFG-01); start() builds the trust store and bootstraps (P-06; ACQ); publish
// never retries (PUB-05); a Delivery's publish forwards its context (FWD-01);
// close() releases everything and is idempotent (TH-LIFE-01). It accepts no
// environment, TLS switch, logger or human credential (TH-API-03).
import { inspect } from 'node:util';
import { draftText, publishBody, type Inbound } from './draft.ts';
import { ClientStateError } from './errors.ts';
import { payloadText } from './json.ts';
import { Keeper } from './keeper.ts';
import { captureLimits, type Limits } from './limits.ts';
import { Subscription } from './subscription.ts';
import { startSend } from './tracing.ts';
import {
  asTransportError,
  buildTrustStore,
  post,
  problemFrom,
  TransportFailure,
} from './transport.ts';
import type { AgentClientOptions, CredentialInfo, JsonValue, PublishAccepted } from './types.ts';

const KNOWN = new Set([
  'dataGatewayUrl',
  'eventIngestUrl',
  'caFile',
  'agent',
  'instance',
  'secret',
]);

/** TH-API-02, -03: presence and type only; an unknown member is refused. */
function checkOptions(o: unknown): AgentClientOptions {
  if (o === null || typeof o !== 'object') throw new TypeError('AgentClient needs its options');
  const opts = o as Record<string, unknown>;
  for (const k of Object.keys(opts)) {
    if (!KNOWN.has(k)) throw new TypeError(`AgentClient has no option ${JSON.stringify(k)}`);
  }
  for (const k of ['dataGatewayUrl', 'eventIngestUrl', 'agent', 'instance']) {
    if (typeof opts[k] !== 'string')
      throw new TypeError(`AgentClient option ${k} must be a string`);
  }
  for (const k of ['dataGatewayUrl', 'eventIngestUrl']) {
    let u: URL;
    try {
      u = new URL(opts[k] as string);
    } catch {
      throw new TypeError(`AgentClient option ${k} must be a URL`);
    }
    if (u.protocol !== 'https:') throw new TypeError(`AgentClient option ${k} must be https`);
  }
  if (opts.caFile !== undefined && typeof opts.caFile !== 'string') {
    throw new TypeError('AgentClient option caFile must be a string');
  }
  if (typeof opts.secret !== 'function') {
    throw new TypeError('AgentClient option secret must be a secret provider');
  }
  return opts as unknown as AgentClientOptions;
}

type State = 'created' | 'starting' | 'started' | 'revoked' | 'closed';

export class AgentClient {
  readonly #options: AgentClientOptions;
  readonly #limits: Limits;
  readonly #abort = new AbortController();
  #state: State = 'created';
  #ca: readonly string[] = [];
  readonly #keeper: Keeper;
  #subscription: Subscription | undefined;
  #closing: Promise<void> | undefined;

  constructor(options: AgentClientOptions) {
    this.#options = checkOptions(options);
    this.#limits = captureLimits();
    this.#keeper = new Keeper({
      s3: this.#options.dataGatewayUrl,
      agent: this.#options.agent,
      instance: this.#options.instance,
      secret: this.#options.secret,
      limits: this.#limits,
      ca: () => this.#ca,
      signal: this.#abort.signal,
    });
    this.#keeper.onCredential({
      credential: () => undefined,
      revoked: () => {
        if (this.#state !== 'closed') this.#state = 'revoked';
      },
    });
  }

  /** Bootstraps (ACQ-01 to ACQ-09); after a failure the client may start again (ACQ-06). */
  async start(): Promise<void> {
    if (this.#state !== 'created') throw new ClientStateError(this.#state);
    this.#state = 'starting';
    try {
      this.#ca = await buildTrustStore(this.#options.caFile);
      await this.#keeper.bootstrap();
    } catch (error) {
      if (this.#state === 'starting') this.#state = 'created';
      throw error;
    }
    if (this.#state === 'starting') this.#state = 'started';
    else throw new ClientStateError(this.#state);
  }

  /** The credential's details, read only; never the credential (CRD-03). */
  get credential(): CredentialInfo {
    const details = this.#keeper.details;
    if (this.#state !== 'started' || !details) {
      throw new ClientStateError(this.#state, this.#keeper.revokedBy);
    }
    return details;
  }

  /** Publishes without forwarding (FWD-04). Never retried (PUB-05). */
  publish(payload: JsonValue): Promise<PublishAccepted> {
    return this.#publish(payload, undefined, undefined);
  }

  /** @internal A Delivery's publish: forwards its context (FWD-01). */
  forward(payload: JsonValue, inbound: Inbound, receivedTrace: unknown): Promise<PublishAccepted> {
    return this.#publish(payload, inbound, receivedTrace);
  }

  async #publish(
    payload: JsonValue,
    inbound: Inbound | undefined,
    receivedTrace: unknown,
  ): Promise<PublishAccepted> {
    this.#assertStarted();
    const text = payloadText(payload);
    const token = await this.#keeper.token();
    const span = startSend(inbound !== undefined, receivedTrace);
    let reply;
    try {
      reply = await post({
        base: this.#options.eventIngestUrl,
        path: '/events',
        headers: { authorization: `Bearer ${token}` },
        body: publishBody(draftText(span.traceContext, inbound), text),
        ca: this.#ca,
        timeoutMs: this.#limits.T_req,
        signal: this.#abort.signal,
      });
    } catch (error) {
      if (error instanceof TransportFailure) {
        span.end(error.reason);
        throw asTransportError(error);
      }
      span.end('aborted');
      throw error;
    }
    if (reply.status === 202) {
      span.end();
      return Object.freeze({ traceContext: Object.freeze({ ...span.traceContext }) });
    }
    const problem = problemFrom(reply);
    if (problem.status === 401 && problem.code === 'credential_expired') this.#keeper.noteExpired();
    span.end(problem.code ?? String(problem.status));
    throw problem;
  }

  /**
   * Subscribes (SUB-01): the stream opens as the Subscription is created, and
   * its items are read as tenant code pulls them (SUB-06). One active
   * subscription per client; another is allowed once it is closed or finished
   * (SUB-04).
   */
  subscribe(): Subscription {
    this.#assertStarted();
    if (this.#subscription?.active) throw new ClientStateError('subscribed');
    this.#subscription = new Subscription({
      s4: this.#options.eventIngestUrl,
      keeper: this.#keeper,
      limits: this.#limits,
      ca: () => this.#ca,
      forward: (payload, inbound, receivedTrace) => this.forward(payload, inbound, receivedTrace),
    });
    return this.#subscription;
  }

  #assertStarted(): void {
    if (this.#state !== 'started') {
      throw new ClientStateError(
        this.#state,
        this.#state === 'revoked' ? this.#keeper.revokedBy : undefined,
      );
    }
  }

  /** Releases every stream, request and timer; idempotent (PRB-07; TH-LIFE-01). */
  close(): Promise<void> {
    this.#closing ??= (async () => {
      this.#state = 'closed';
      this.#abort.abort(new ClientStateError('closed'));
      await this.#subscription?.close();
      await this.#keeper.stop();
    })();
    return this.#closing;
  }

  [Symbol.asyncDispose](): Promise<void> {
    return this.close();
  }

  toJSON(): Record<string, unknown> {
    return { agent: this.#options.agent, instance: this.#options.instance, state: this.#state };
  }

  [inspect.custom](): string {
    return `AgentClient { agent: ${JSON.stringify(this.#options.agent)}, state: ${this.#state} }`;
  }
}
