// SPDX-License-Identifier: Apache-2.0
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkPackage, withoutCaches } from './check.ts';

let root = '';
const pkg = {
  name: 'fixture',
  generate: ['node', 'fixture/generate.ts', '{out}'],
  committed: 'fixture/committed',
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'gen-'));
  cpSync(
    join(import.meta.dirname, '..', 'test-fixtures', 'generated-types'),
    join(root, 'fixture'),
    {
      recursive: true,
    },
  );
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('generated-types check (US-12 #2)', () => {
  it('passes when the committed types are what the contract generates', () => {
    expect(checkPackage(root, pkg)).toEqual([]);
  });

  it('catches an edited generated file, naming it', () => {
    writeFileSync(
      join(root, 'fixture', 'committed', 'types.ts'),
      '// SPDX-License-Identifier: Apache-2.0\nexport interface Thing { name: string }\n',
    );
    expect(checkPackage(root, pkg)).toEqual([
      'fixture: types.ts differs from what the contract generates',
    ]);
  });

  it('catches a committed file the contract no longer generates', () => {
    writeFileSync(join(root, 'fixture', 'committed', 'stale.ts'), 'export {};\n');
    expect(checkPackage(root, pkg)).toEqual([
      'fixture: stale.ts is committed but no longer generated',
    ]);
  });
});

describe('interpreter caches (added at U4)', () => {
  it('leaves __pycache__ out of both sides, and nothing else', () => {
    expect(
      withoutCaches({
        'envelope.py': 'a',
        '__pycache__/envelope.cpython-311.pyc': 'b',
        'x/__pycache__/y.pyc': 'c',
        'pycache.py': 'd',
      }),
    ).toEqual({ 'envelope.py': 'a', 'pycache.py': 'd' });
  });
});
