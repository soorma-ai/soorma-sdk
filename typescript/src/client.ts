// SPDX-License-Identifier: Apache-2.0
//
// The agent client (C-11): one per agent instance; creating it contacts
// nothing (CFG-01). Filled in G3 to G5.
import { ClientStateError } from './errors.ts';
import { captureLimits, type Limits } from './limits.ts';
import { Subscription } from './subscription.ts';
import type { AgentClientOptions, CredentialInfo, JsonValue, PublishAccepted } from './types.ts';

export class AgentClient {
  readonly #options: AgentClientOptions;
  readonly #limits: Limits;

  constructor(options: AgentClientOptions) {
    this.#options = options;
    this.#limits = captureLimits();
  }

  start(): Promise<void> {
    return Promise.reject(new ClientStateError('not-implemented'));
  }

  get credential(): CredentialInfo {
    throw new ClientStateError('created');
  }

  publish(payload: JsonValue): Promise<PublishAccepted> {
    void payload;
    return Promise.reject(new ClientStateError('not-implemented'));
  }

  subscribe(): Subscription {
    throw new ClientStateError('not-implemented');
  }

  close(): Promise<void> {
    void this.#options;
    void this.#limits;
    return Promise.resolve();
  }

  [Symbol.asyncDispose](): Promise<void> {
    return this.close();
  }
}
