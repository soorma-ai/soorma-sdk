// SPDX-License-Identifier: Apache-2.0
//
// A received Delivery (C-18; RCV-01 to RCV-08). Its publish forwards its
// context (FWD-01). Filled in G4 and G5.
import { ClientStateError } from './errors.ts';
import type { Envelope, JsonValue, PublishAccepted } from './types.ts';

/** @internal How a Delivery forwards: the client's internal publish. */
export type Forwarder = (
  payload: JsonValue,
  inbound: { envelopeText: string; seal: string },
  receivedTrace: unknown,
) => Promise<PublishAccepted>;

export class Delivery {
  readonly kind = 'delivery' as const;
  readonly envelope: Envelope;
  readonly envelopeText: string;
  readonly seal: string;
  readonly payload?: JsonValue;
  readonly payloadText: string;
  readonly payloadParsed: boolean;
  readonly #forward: Forwarder | undefined;

  /** @internal Deliveries are made by the SDK only. */
  constructor(
    parts: {
      envelope: Envelope;
      envelopeText: string;
      seal: string;
      payload?: JsonValue;
      payloadText: string;
      payloadParsed: boolean;
    },
    forward?: Forwarder,
  ) {
    this.envelope = parts.envelope;
    this.envelopeText = parts.envelopeText;
    this.seal = parts.seal;
    if (parts.payload !== undefined) this.payload = parts.payload;
    this.payloadText = parts.payloadText;
    this.payloadParsed = parts.payloadParsed;
    this.#forward = forward;
  }

  /** Publishes, forwarding this Delivery's context: the default path (FWD-01, FWD-06). */
  publish(payload: JsonValue): Promise<PublishAccepted> {
    if (!this.#forward) return Promise.reject(new ClientStateError('closed'));
    return this.#forward(
      payload,
      { envelopeText: this.envelopeText, seal: this.seal },
      (this.envelope as { traceContext?: unknown }).traceContext,
    );
  }
}
