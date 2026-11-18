// SPDX-License-Identifier: Apache-2.0
//
// The request matchers judge what a driver sent against the vendored
// contract, with the contract's own strict validator (contract/scripts/
// validator.ts, Ajv 2020-12), never a second copy of the schemas. Each request
// case also proves its matcher discriminates: the contract's invalid fixtures
// for that shape are rejected and the valid ones accepted (business-logic-model
// §2.3), so a lax matcher cannot pass a wrong SDK.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { createValidator, type ContractSchema } from '../../../contract/scripts/validator.ts';

export const FIXTURES = resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'contract',
  'fixtures',
  '0.1.0',
);

let cached: ReturnType<typeof createValidator> | undefined;
const validator = (): ReturnType<typeof createValidator> => (cached ??= createValidator());

export function validates(schema: ContractSchema, value: unknown): boolean {
  return validator().validate(schema, value);
}

export function schemaErrors(schema: ContractSchema, value: unknown): string {
  const fn = validator().validator(schema);
  fn(value);
  return (fn.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message ?? ''}`).join('; ');
}

/** The contract schema a fixture is a sample of, from its directory. */
export function schemaForFixture(path: string): ContractSchema {
  const parts = path.split('/');
  const top = parts[0] ?? '';
  if (top === 'data-gateway' || top === 'event-ingest') return `${top}#${parts[1] ?? ''}`;
  const plain: Record<string, ContractSchema> = {
    draft: 'Draft',
    envelope: 'Envelope',
    delivery: 'Delivery',
    inbound: 'Inbound',
    problem: 'Problem',
  };
  const s = plain[top];
  if (!s) throw new Error(`no schema for fixture ${path}`);
  return s;
}

export const isAgentSide = (path: string): boolean =>
  !/^(org-gateway|control-gateway)\//.test(path);

/** Every fixture path under contract/fixtures/0.1.0, relative, forward slashes. */
export function allFixtures(root = FIXTURES): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.json')) out.push(relative(root, p).split(sep).join('/'));
    }
  };
  walk(root);
  return out.sort();
}

/** Expands a fixture reference: a path, or a directory ending in `/*`. */
export function expandFixtures(refs: string[], all = allFixtures()): string[] {
  return [
    ...new Set(
      refs.flatMap((r) =>
        r.endsWith('/*')
          ? all.filter((f) => f.startsWith(r.slice(0, -1)) && !f.slice(r.length - 1).includes('/'))
          : [r],
      ),
    ),
  ];
}

export function readFixture(path: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, path), 'utf8')) as unknown;
}
export function readFixtureText(path: string): string {
  return readFileSync(join(FIXTURES, path), 'utf8');
}

/**
 * Proves a matcher discriminates: each negative fixture must be rejected by
 * its schema, each positive accepted. Returns the failures.
 */
export function proveMatcher(positives: string[], negatives: string[]): string[] {
  const failures: string[] = [];
  for (const f of positives) {
    if (!validates(schemaForFixture(f), readFixture(f))) {
      failures.push(
        `matcher rejects the valid fixture ${f}: ${schemaErrors(schemaForFixture(f), readFixture(f))}`,
      );
    }
  }
  for (const f of negatives) {
    if (validates(schemaForFixture(f), readFixture(f)))
      failures.push(`matcher accepts the invalid fixture ${f}`);
  }
  return failures;
}
