// SPDX-License-Identifier: Apache-2.0
//
// The shapes shared by the runner, the stub and the reference driver.

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
export type JsonObject = { [k: string]: Json };

/** The named values of the specification (§0), in milliseconds or items. */
export const NAMED_VALUES = [
  'H_renew',
  'R_max',
  'W_max',
  'B_init',
  'B_factor',
  'B_cap',
  'L_ends',
  'W_super',
  'N_buf',
  'T_idle',
  'T_req',
] as const;
export type NamedValue = (typeof NAMED_VALUES)[number];
export type Values = Partial<Record<NamedValue, number>>;

export type Listener = 'S3' | 'S4' | 'UNTRUSTED' | 'STRAY';

export interface RequestMatch {
  listener?: Listener;
  method?: string;
  path?: string;
  /** 1-based occurrence among the requests matching the rest. */
  nth?: number;
  label?: string;
}

export interface RecordedRequest {
  seq: number;
  listener: Listener;
  method: string;
  path: string;
  headers: Record<string, string>;
  body: Buffer;
  at: number;
  connection: number;
  /** The exchange label it was matched to, if any. */
  label?: string;
  /** false when the stub reset the connection without answering. */
  answered: boolean;
  /** Set when the request matched no exchange (answered 500; fails the case). */
  unmatched?: boolean;
}

export interface StreamRecord {
  label: string;
  openedAt: number;
  closedBy?: 'client' | 'stub';
  closedAt?: number;
}

export interface DeliverySent {
  label: string;
  /** The exact text of the Delivery line written to the stream. */
  line: string;
  /** The exact envelope text inside it. */
  envelopeText: string;
  seal: string;
}

/** What the runner needs from the stub (conformance/stub implements it). */
export interface StubControl {
  urls: Record<Listener, string>;
  load(script: CaseScript, ctx: TemplateContext): void;
  recording(): RecordedRequest[];
  streams(): StreamRecord[];
  deliveries(): DeliverySent[];
  concurrentStreamsMax(): number;
  stop(): Promise<void>;
}

export interface CaseScript {
  listeners?: Partial<Record<Listener, { refuse?: number }>>;
  exchanges: JsonObject[];
}

export interface TemplateContext {
  urls: Record<Listener, string>;
  caFile: string;
  secretBase64: string;
  secret: string;
  files: Record<string, string>;
  values: Values;
  depthBound: number;
  start: number;
}
