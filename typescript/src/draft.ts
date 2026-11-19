// SPDX-License-Identifier: Apache-2.0
//
// The only maker of drafts (C-16; DRF-01 to DRF-03): exactly
// clientContractVersion and traceContext, and inbound only when forwarding,
// with the received envelope text spliced byte for byte (FWD-02) and the seal
// as received (FWD-03). No platform-stamped field can be set (NEV-02).
import { CONTRACT_VERSION } from './transport.ts';
import type { TraceContext } from './types.ts';

export interface Inbound {
  envelopeText: string;
  seal: string;
}

export function draftText(trace: TraceContext, inbound?: Inbound): string {
  const tc =
    trace.tracestate === undefined
      ? { traceparent: trace.traceparent }
      : { traceparent: trace.traceparent, tracestate: trace.tracestate };
  const fwd =
    inbound === undefined
      ? ''
      : `,"inbound":{"envelope":${inbound.envelopeText},"seal":${JSON.stringify(inbound.seal)}}`;
  return `{"clientContractVersion":"${CONTRACT_VERSION}","traceContext":${JSON.stringify(tc)}${fwd}}`;
}

/** The publish body: the draft and the payload's checked text (PUB-01, PUB-03). */
export function publishBody(draft: string, payload: string): string {
  return `{"draft":${draft},"payload":${payload}}`;
}
