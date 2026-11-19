// SPDX-License-Identifier: Apache-2.0
//
// The errors (C-20; FR-13). No message, string, JSON or inspect form holds a
// secret, a credential or payload content (CRD-04; NFR-06; P-08). A Problem's
// members are kept as the platform sent them; the message names only the status
// and the code.
import { inspect } from 'node:util';
import type { JsonValue } from './types.ts';

export class SoormaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }

  /** The fields a caller may log; never a secret or a credential. */
  protected fields(): Record<string, unknown> {
    return {};
  }

  toJSON(): Record<string, unknown> {
    return { name: this.name, message: this.message, ...this.fields() };
  }

  [inspect.custom](): string {
    return `${this.name}: ${this.message}`;
  }
}

export interface ProblemFields {
  status: number;
  code: string | null;
  title?: string;
  detail?: string;
  retryAfter?: number;
  problem?: Readonly<Record<string, JsonValue>>;
}

/** A non-success response: the platform's Problem, every member kept (PRB-01, PRB-02). */
export class ProblemError extends SoormaError {
  readonly status: number;
  readonly code: string | null;
  readonly title?: string;
  readonly detail?: string;
  readonly retryAfter?: number;
  readonly problem?: Readonly<Record<string, JsonValue>>;

  constructor(f: ProblemFields) {
    super(`${f.status} ${f.code ?? '(no code)'}`);
    this.status = f.status;
    this.code = f.code;
    if (f.title !== undefined) this.title = f.title;
    if (f.detail !== undefined) this.detail = f.detail;
    if (f.retryAfter !== undefined) this.retryAfter = f.retryAfter;
    if (f.problem !== undefined) this.problem = f.problem;
  }

  protected override fields(): Record<string, unknown> {
    return {
      status: this.status,
      code: this.code,
      ...(this.retryAfter === undefined ? {} : { retryAfter: this.retryAfter }),
    };
  }
}

/** A connection, TLS or response failure; no response body (CFG-04; ACQ-08). */
export class TransportError extends SoormaError {
  readonly reason: string;

  constructor(reason: string) {
    super(`transport: ${reason}`);
    this.reason = reason;
  }

  protected override fields(): Record<string, unknown> {
    return { reason: this.reason };
  }
}

/** A secret provider's refusal or failure: the path and reason, never the value (SEC-08). */
export class SecretSourceError extends SoormaError {
  readonly reason: string;
  readonly path?: string;

  constructor(reason: string, path?: string) {
    super(path === undefined ? `secret source: ${reason}` : `secret source: ${reason}: ${path}`);
    this.reason = reason;
    if (path !== undefined) this.path = path;
  }

  protected override fields(): Record<string, unknown> {
    return { reason: this.reason, ...(this.path === undefined ? {} : { path: this.path }) };
  }
}

/** An operation the client's state does not allow (ACQ-07, REN-05, SUB-04). */
export class ClientStateError extends SoormaError {
  readonly state: string;
  readonly problem?: ProblemError;

  constructor(state: string, problem?: ProblemError) {
    super(`client is ${state}`);
    this.state = state;
    if (problem !== undefined) this.problem = problem;
  }

  protected override fields(): Record<string, unknown> {
    return { state: this.state, ...(this.problem ? { problem: this.problem.toJSON() } : {}) };
  }
}
