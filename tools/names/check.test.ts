// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compareNames, namesFromTable } from './check.ts';

const md = readFileSync(
  join(import.meta.dirname, '..', 'test-fixtures', 'names', 'names.md'),
  'utf8',
);

describe('names check (US-13 #3)', () => {
  it('reads one language column, identifiers only (no package, no string values)', () => {
    expect([...namesFromTable(md, 'TypeScript')].sort()).toEqual(
      ['AgentClient', 'expiresAt', 'fileSecret', 'kind', 'organization', 'project', 'start'].sort(),
    );
    expect([...namesFromTable(md, 'Python')].sort()).toEqual(
      ['AgentClient', 'expires_at', 'file_secret', 'organization', 'project', 'start'].sort(),
    );
  });

  const ts = ['AgentClient', 'fileSecret', 'start', 'organization', 'project', 'kind', 'expiresAt'];

  it('passes when the exports equal the column, idioms aside', () => {
    expect(
      compareNames(namesFromTable(md, 'TypeScript'), [...ts, 'Symbol.asyncIterator'], 'TypeScript'),
    ).toEqual([]);
  });

  it("accepts TypeScript's toJSON as an idiom, not a table row", () => {
    expect(compareNames(namesFromTable(md, 'TypeScript'), [...ts, 'toJSON'], 'TypeScript')).toEqual(
      [],
    );
  });

  it('catches an export that is not in the table, naming it', () => {
    expect(
      compareNames(namesFromTable(md, 'TypeScript'), [...ts, 'setEnvironment'], 'TypeScript'),
    ).toEqual(['TypeScript: setEnvironment is exported but not in the name table']);
  });

  it('catches a table name that is not exported, naming it', () => {
    expect(
      compareNames(
        namesFromTable(md, 'TypeScript'),
        ts.filter((n) => n !== 'start'),
        'TypeScript',
      ),
    ).toEqual(['TypeScript: start is in the name table but not exported']);
  });
});
