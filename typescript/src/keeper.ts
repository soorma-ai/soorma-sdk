// SPDX-License-Identifier: Apache-2.0
//
// The credential keeper (C-14): the one security-critical module (SECURITY-11).
// It alone touches the secret and the credential. It bootstraps (ACQ), renews
// on a schedule (REN-01 to REN-07; P-03), holds the credential in memory only,
// opaque (CRD-01), and decides validity in one place, isUsable() (P-02;
// CDI-06): nowhere else compares expiresAt with the clock.
import { clearTimer, monoNow, setTimer, wallNow, type Timer } from './clock.ts';
import { ClientStateError, ProblemError, SecretSourceError, TransportError } from './errors.ts';
import type { Limits } from './limits.ts';
import { retry } from './retry.ts';
import {
  asTransportError,
  CONTRACT_VERSION,
  post,
  problemFrom,
  TransportFailure,
  type Reply,
} from './transport.ts';
import type { CredentialInfo, SecretProvider } from './types.ts';

export interface KeeperOptions {
  s3: string;
  agent: string;
  instance: string;
  secret: SecretProvider;
  limits: Limits;
  /** The trust store, fixed at start() (P-06). */
  ca: () => readonly string[];
  signal: AbortSignal;
}

export interface KeeperListener {
  /** A new credential: the same lineage (a renewal) or a new one (a bootstrap). */
  credential(lineageChanged: boolean): void;
  /** credential_refused: terminal (REN-05). */
  revoked(problem: ProblemError): void;
}

interface Held {
  token: string;
  details: CredentialInfo;
  expiresAt: number;
}

export const CLOCK_SKEW_CODE = 'SOORMA_CLOCK_SKEW';

/** A 200 that is a usable AgentCredential, or TransportError('unusable-response') (ACQ-08). */
export function parseCredential(body: string): Held {
  try {
    const c = JSON.parse(body) as Record<string, unknown>;
    const env = c.environment as Record<string, unknown> | undefined;
    const exp = typeof c.expiresAt === 'string' ? Date.parse(c.expiresAt) : Number.NaN;
    if (
      typeof c.credential !== 'string' ||
      typeof c.agent !== 'string' ||
      typeof c.instance !== 'string' ||
      typeof c.expiresAt !== 'string' ||
      Number.isNaN(exp) ||
      typeof env?.organization !== 'string' ||
      typeof env.project !== 'string' ||
      typeof env.environment !== 'string'
    ) {
      throw new Error('unusable');
    }
    return {
      token: c.credential,
      expiresAt: exp,
      details: Object.freeze({
        agent: c.agent,
        instance: c.instance,
        // As sent, unknown members kept (CDI-04); the three it needs are checked above.
        environment: Object.freeze({
          ...env,
          organization: env.organization,
          project: env.project,
          environment: env.environment,
        }),
        expiresAt: c.expiresAt,
      }),
    };
  } catch {
    throw new TransportError('unusable-response');
  }
}

export class Keeper {
  readonly #o: KeeperOptions;
  #held: Held | undefined;
  #receivedAt = 0;
  /** REN-07: this lineage's clock-skew warning has fired; S3 now judges its expiry. */
  #warned = false;
  /** S3 answered credential_expired for this lineage. */
  #expiredByS3 = false;
  #revoked: ProblemError | undefined;
  #stopped = false;
  #timer: Timer | undefined;
  #renewing: Promise<void> | undefined;
  readonly #listeners: KeeperListener[] = [];

  constructor(options: KeeperOptions) {
    this.#o = options;
  }

  onCredential(listener: KeeperListener): () => void {
    this.#listeners.push(listener);
    return () => {
      const i = this.#listeners.indexOf(listener);
      if (i >= 0) this.#listeners.splice(i, 1);
    };
  }

  get details(): CredentialInfo | undefined {
    return this.#held?.details;
  }

  get revokedBy(): ProblemError | undefined {
    return this.#revoked;
  }

  /**
   * The one validity check (P-02; CDI-06). On a lineage with the clock-skew
   * warning, valid until S3 says credential_expired; otherwise the wall clock.
   */
  isUsable(): boolean {
    if (!this.#held || this.#revoked || this.#stopped) return false;
    if (this.#warned) return !this.#expiredByS3;
    return !this.#expiredByS3 && wallNow() < this.#held.expiresAt;
  }

  /** The credential for an operation; bootstraps first when it is not usable (REN-06). */
  async token(): Promise<string> {
    if (this.#revoked) throw new ClientStateError('revoked', this.#revoked);
    if (this.#stopped) throw new ClientStateError('closed');
    if (!this.isUsable()) await this.bootstrap();
    const held = this.#held;
    if (!held) throw new ClientStateError('created');
    return held.token;
  }

  /** A credential S3 or S4 answered credential_expired for: no longer usable. */
  noteExpired(): void {
    this.#expiredByS3 = true;
  }

  /** Bootstrap: a new lineage (ACQ-01 to ACQ-09; SEC-01, SEC-02; P-08). */
  async bootstrap(): Promise<void> {
    let held: Held;
    try {
      held = await retry('bootstrap', () => this.#bootstrapAttempt(), {
        limits: this.#o.limits,
        signal: this.#o.signal,
      });
    } catch (error) {
      if (error instanceof TransportFailure) throw asTransportError(error);
      throw error;
    }
    this.#adopt(held, true);
  }

  /** One attempt: one provider call (SEC-01, as reworded at U3); the secret dropped once sent. */
  async #bootstrapAttempt(): Promise<Held> {
    const reply = await this.#sendBootstrap(await this.#provide());
    if (reply.status !== 200) throw problemFrom(reply);
    return parseCredential(reply.body);
  }

  /** The provider's value, or SecretSourceError and nothing sent (SEC-08). */
  async #provide(): Promise<string> {
    let secret: unknown;
    try {
      secret = await this.#o.secret();
    } catch (error) {
      throw error instanceof SecretSourceError ? error : new SecretSourceError('provider-failed');
    }
    if (typeof secret !== 'string') throw new SecretSourceError('provider-failed');
    return secret;
  }

  /**
   * The secret lives only as this frame's argument and in the request body;
   * once the request is written nothing in the SDK refers to either (SEC-02).
   */
  #sendBootstrap(secret: string): Promise<Reply> {
    return post({
      base: this.#o.s3,
      path: '/agent-credentials',
      headers: { 'soorma-contract-version': CONTRACT_VERSION },
      body:
        `{"agent":${JSON.stringify(this.#o.agent)},"secret":${JSON.stringify(secret)},` +
        `"instance":${JSON.stringify(this.#o.instance)}}`,
      ca: this.#o.ca(),
      timeoutMs: this.#o.limits.T_req,
      signal: this.#o.signal,
    });
  }

  #adopt(held: Held, newLineage: boolean): void {
    if (this.#stopped) return;
    this.#held = held;
    this.#receivedAt = monoNow();
    if (newLineage) {
      this.#warned = false;
      this.#expiredByS3 = false;
    }
    this.#schedule();
    for (const l of [...this.#listeners]) l.credential(newLineage);
  }

  /** REN-01 with REN-07 (P-03): the wall-clock target, never sooner than R_min. */
  #schedule(): void {
    const held = this.#held;
    if (!held) return;
    clearTimer(this.#timer);
    const target = held.expiresAt - this.#o.limits.H_renew - wallNow();
    if (target <= 0 && !this.#warned) {
      this.#warned = true;
      process.emitWarning(
        'The client clock appears to be ahead of the platform clock: a credential arrived already due for renewal. ' +
          'Renewals are held at least R_min apart, and the credential is used until the platform reports it expired. Correct the clock.',
        { type: 'SoormaWarning', code: CLOCK_SKEW_CODE },
      );
    }
    const floor = this.#receivedAt + this.#o.limits.R_min - monoNow();
    this.#timer = setTimer(
      () => {
        this.#renewing = this.#renew().finally(() => (this.#renewing = undefined));
      },
      Math.max(floor, target),
      { unref: true },
    );
  }

  async #renew(): Promise<void> {
    const current = this.#held;
    if (!current || this.#revoked || this.#stopped) return;
    try {
      const held = await retry('renewal', () => this.#renewAttempt(current.token), {
        limits: this.#o.limits,
        signal: this.#o.signal,
        usable: () => this.isUsable(),
      });
      // REN-03: no later expiry means the lineage cannot extend: a new lineage now.
      if (held.expiresAt <= current.expiresAt) await this.bootstrap();
      else this.#adopt(held, false);
    } catch (error) {
      if (this.#stopped) return;
      if (error instanceof ProblemError && error.code === 'credential_refused') {
        // REN-05; also on a retried renewal (GAP-CAC-001, soorma-ai/soorma-core#34): terminal.
        this.revoke(error);
      } else if (error instanceof ProblemError && error.code === 'credential_expired') {
        // REN-04: bootstrap again (one provider call per attempt).
        this.#expiredByS3 = true;
        await this.bootstrap().catch(() => undefined);
      }
      // Any other failure: the next operation bootstraps if the credential is not usable (REN-06).
    }
  }

  async #renewAttempt(token: string): Promise<Held> {
    const reply: Reply = await post({
      base: this.#o.s3,
      path: '/agent-credentials/current/renewal',
      headers: { authorization: `Bearer ${token}`, 'soorma-contract-version': CONTRACT_VERSION },
      ca: this.#o.ca(),
      timeoutMs: this.#o.limits.T_req,
      signal: this.#o.signal,
    });
    if (reply.status !== 200) throw problemFrom(reply);
    return parseCredential(reply.body);
  }

  /** credential_refused: terminal (REN-05, STR-07). */
  revoke(problem: ProblemError): void {
    if (this.#revoked) return;
    this.#revoked = problem;
    clearTimer(this.#timer);
    this.#held = undefined;
    for (const l of [...this.#listeners]) l.revoked(problem);
  }

  /** Stops renewing and drops the credential (TH-LIFE-01). */
  async stop(): Promise<void> {
    this.#stopped = true;
    clearTimer(this.#timer);
    this.#held = undefined;
    await this.#renewing?.catch(() => undefined);
  }
}
