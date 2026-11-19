// SPDX-License-Identifier: Apache-2.0
//
// @soorma/sdk: exactly the name table's TypeScript column (spec/names.md;
// NAM-01). Nothing else is exported.
export { AgentClient } from './client.ts';
export { Delivery } from './delivery.ts';
export {
  ClientStateError,
  ProblemError,
  SecretSourceError,
  SoormaError,
  TransportError,
} from './errors.ts';
export { newInstanceId } from './options.ts';
export { fileSecret } from './secrets.ts';
export { Subscription, type SubscriptionItem } from './subscription.ts';
export type {
  AgentClientOptions,
  CredentialInfo,
  DeliveryError,
  Envelope,
  EnvironmentRef,
  JsonValue,
  PublishAccepted,
  SecretProvider,
  StreamEnded,
  StreamStarted,
  TraceContext,
} from './types.ts';
