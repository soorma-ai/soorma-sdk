// SPDX-License-Identifier: Apache-2.0
//
// The subscription (C-17; SUB, STR; P-04). Implemented in G5.
import type { Delivery } from './delivery.ts';
import { ClientStateError } from './errors.ts';
import type { DeliveryError, StreamEnded, StreamStarted } from './types.ts';

export type SubscriptionItem = Delivery | DeliveryError | StreamStarted | StreamEnded;

export class Subscription implements AsyncIterable<SubscriptionItem> {
  /** @internal Subscriptions are made by AgentClient.subscribe(). */
  constructor() {}

  close(): Promise<void> {
    return Promise.resolve();
  }

  [Symbol.asyncIterator](): AsyncIterator<SubscriptionItem> {
    return {
      next: () => Promise.reject(new ClientStateError('not-implemented')),
      return: async () => {
        await this.close();
        return { done: true, value: undefined };
      },
    };
  }

  [Symbol.asyncDispose](): Promise<void> {
    return this.close();
  }
}
