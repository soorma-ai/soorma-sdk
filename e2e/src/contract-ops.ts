// SPDX-License-Identifier: Apache-2.0
//
// An operation's response schema, read from the vendored contract's OpenAPI
// documents (TS-U2-04): the operation by its operationId, the response by its
// status, followed through a components/responses reference, to the schema of
// its application/json or application/problem+json body, or to no body. The
// value is then checked with U1's validator (the contract's own, strict
// Ajv 2020-12), never a second copy of the schemas. Used by prove-stack's
// response check (PS-02) and by the fake stack, which checks every response it
// sends (NFR-U2-20).
import { loadContract, type ContractDocument } from '../../contract/scripts/checks/model.ts';
import type { ContractSchema } from '../../contract/scripts/validator.ts';
import { schemaErrors, validates } from '../../conformance/runner/src/contract.ts';

type Json = Record<string, unknown>;
const isJson = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

const CONVENTIONS = 'conventions/components.openapi.yaml';
const SURFACE_DOCS = [
  'org-gateway.openapi.yaml',
  'control-gateway.openapi.yaml',
  'data-gateway.openapi.yaml',
  'event-ingest.openapi.yaml',
];

let documents: ContractDocument[] | undefined;
const docs = (): ContractDocument[] => (documents ??= loadContract().documents);

function doc(path: string): Json {
  const d = docs().find((x) => x.path === path);
  if (!d || !isJson(d.data)) throw new Error(`contract: no document ${path}`);
  return d.data;
}

/** Where an operation is: its document and its operation object. */
function findOperation(operationId: string): { path: string; operation: Json } {
  for (const path of SURFACE_DOCS) {
    const paths = doc(path).paths;
    if (!isJson(paths)) continue;
    for (const item of Object.values(paths)) {
      if (!isJson(item)) continue;
      for (const operation of Object.values(item)) {
        if (isJson(operation) && operation.operationId === operationId) return { path, operation };
      }
    }
  }
  throw new Error(`contract: no operation ${operationId}`);
}

function deref(ref: string, from: string): { path: string; value: unknown } {
  const [file, pointer] = ref.split('#') as [string, string | undefined];
  const path = file === '' ? from : file;
  let value: unknown = doc(path);
  for (const part of (pointer ?? '').split('/').filter(Boolean)) {
    value = isJson(value) ? value[part.replace(/~1/g, '/').replace(/~0/g, '~')] : undefined;
  }
  if (value === undefined) throw new Error(`contract: unresolved ${ref} in ${from}`);
  return { path, value };
}

function schemaName(ref: string, from: string): ContractSchema {
  const m = /^(.*)#\/components\/schemas\/([A-Za-z0-9]+)$/.exec(ref);
  if (!m) throw new Error(`contract: unsupported schema reference ${ref} in ${from}`);
  const path = m[1] === '' ? from : (m[1] ?? from);
  const name = m[2] ?? '';
  if (path === CONVENTIONS) return name as ContractSchema;
  const surface = path.replace(/\.openapi\.yaml$/, '');
  return `${surface}#${name}` as ContractSchema;
}

/**
 * The schema of `operationId`'s response body for `status`, or null when the
 * response has no body. Throws for an operation or status the contract does not
 * declare: the caller asked for a response the contract does not have.
 */
export function responseSchema(operationId: string, status: number): ContractSchema | null {
  const { path, operation } = findOperation(operationId);
  const responses = isJson(operation.responses) ? operation.responses : {};
  let response = responses[String(status)];
  let at = path;
  if (response === undefined) {
    throw new Error(`contract: ${operationId} declares no ${status} response`);
  }
  if (isJson(response) && typeof response.$ref === 'string') {
    const r = deref(response.$ref, at);
    response = r.value;
    at = r.path;
  }
  if (!isJson(response)) throw new Error(`contract: ${operationId} ${status} is not a response`);
  const content = response.content;
  if (content === undefined) return null;
  if (!isJson(content)) throw new Error(`contract: ${operationId} ${status} content unreadable`);
  const media = content['application/json'] ?? content['application/problem+json'];
  if (!isJson(media) || !isJson(media.schema) || typeof media.schema.$ref !== 'string') {
    throw new Error(`contract: ${operationId} ${status} has no referenced JSON schema`);
  }
  return schemaName(media.schema.$ref, at);
}

/**
 * Checks a response against the contract: [] when it matches, otherwise what is
 * wrong. A body where none is declared, or none where one is, is wrong too.
 */
export function checkResponse(operationId: string, status: number, body: unknown): string[] {
  let schema: ContractSchema | null;
  try {
    schema = responseSchema(operationId, status);
  } catch (error) {
    return [(error as Error).message];
  }
  if (schema === null) {
    return body === undefined ? [] : [`${operationId} ${status}: the contract declares no body`];
  }
  if (body === undefined) return [`${operationId} ${status}: body missing (${schema})`];
  if (validates(schema, body)) return [];
  return [`${operationId} ${status}: not a valid ${schema}: ${schemaErrors(schema, body)}`];
}
