// SPDX-License-Identifier: Apache-2.0
//
// The public types of the name table's TypeScript column (spec/names.md;
// domain-entities §2), other than the classes.
import type { components } from './generated/event-ingest.ts';

/** Any JSON value. */
export type JsonValue =
  null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };

/** Returns the registration secret; called once per bootstrap attempt (SEC-01). */
export type SecretProvider = () => Promise<string>;

/** What a developer supplies, and nothing inferred (CFG-01, CFG-02). */
export interface AgentClientOptions {
  readonly dataGatewayUrl: string;
  readonly eventIngestUrl: string;
  readonly caFile?: string;
  readonly agent: string;
  readonly instance: string;
  readonly secret: SecretProvider;
}

export interface EnvironmentRef {
  readonly organization: string;
  readonly project: string;
  readonly environment: string;
}

/** The credential's details, read only; never the credential (CRD-03). */
export interface CredentialInfo {
  readonly agent: string;
  readonly instance: string;
  readonly environment: EnvironmentRef;
  readonly expiresAt: string;
}

export interface TraceContext {
  readonly traceparent: string;
  readonly tracestate?: string;
}

/** A publish was accepted: never that it was delivered (PUB-02). */
export interface PublishAccepted {
  readonly traceContext: TraceContext;
}

export interface StreamStarted {
  readonly kind: 'streamStarted';
}

export interface StreamEnded {
  readonly kind: 'streamEnded';
  readonly code: string | null;
  readonly terminal: boolean;
}

export interface DeliveryError {
  readonly kind: 'deliveryError';
  readonly reason: string;
  readonly text: string;
}

type DeepOptional<T> = T extends readonly (infer U)[]
  ? readonly DeepOptional<U>[]
  : T extends object
    ? { readonly [K in keyof T]?: DeepOptional<T[K]> }
    : T;

/**
 * A received envelope, exactly as the platform sent it. **The SDK checks none
 * of its members** (RCV-08; DEC-U1-09), so every member is optional, and
 * unknown members are kept (CDI-04).
 */
export type Envelope = DeepOptional<components['schemas']['Envelope']> & {
  readonly [member: string]: JsonValue | undefined;
};
