// SPDX-License-Identifier: Apache-2.0
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { git } from '../lib/git.ts';
import { missingHeader, needsHeader, runSpdx } from './check.ts';

describe('SPDX check', () => {
  it('catches a source file without the header, naming it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'spdx-'));
    try {
      git(['init', '-q'], dir);
      writeFileSync(join(dir, 'good.ts'), '// SPDX-License-Identifier: Apache-2.0\nexport {};\n');
      writeFileSync(join(dir, 'bad.ts'), 'export const x = 1;\n');
      writeFileSync(join(dir, 'data.json'), '{}\n');
      expect(runSpdx(dir)).toEqual([
        'bad.ts: no "SPDX-License-Identifier: Apache-2.0" in its first five lines',
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('exempts the vendored contract and JSON, and covers workflows', () => {
    expect(needsHeader('contract/scripts/validator.ts')).toBe(false);
    expect(needsHeader('package.json')).toBe(false);
    expect(needsHeader('.github/workflows/ci.yml')).toBe(true);
    expect(missingHeader('x.yml', '# SPDX-License-Identifier: Apache-2.0\n')).toBeUndefined();
  });
});
