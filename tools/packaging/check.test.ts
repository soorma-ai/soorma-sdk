// SPDX-License-Identifier: Apache-2.0
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkPackage } from './check.ts';

let dir = '';
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pkg-'));
  cpSync(join(import.meta.dirname, '..', 'test-fixtures', 'packaging', 'good'), dir, {
    recursive: true,
  });
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const manifest = (m: object): void => writeFileSync(join(dir, 'package.json'), JSON.stringify(m));

describe('packaging guard (NFR-U1-23)', () => {
  it('passes a package holding only its own sources', () => {
    expect(checkPackage(dir)).toEqual([]);
  });

  it('catches test-only code in the published file list', () => {
    mkdirSync(join(dir, 'src', 'conformance'), { recursive: true });
    writeFileSync(join(dir, 'src', 'conformance', 'driver.ts'), 'export {};\n');
    expect(checkPackage(dir)).toEqual([
      '@soorma/sdk-fixture: would publish src/conformance/driver.ts',
    ]);
  });

  it('catches a files entry reaching outside or into test-only code', () => {
    manifest({ name: 'p', files: ['src', '../conformance/reference-driver'] });
    expect(checkPackage(dir)).toEqual(['p: files lists ../conformance/reference-driver']);
  });

  it('catches a dependency on the tooling or the conformance machinery', () => {
    manifest({
      name: 'p',
      files: ['src'],
      devDependencies: { '@soorma-sdk/tools': 'workspace:*' },
    });
    expect(checkPackage(dir)).toEqual([
      'p: devDependencies names test-only @soorma-sdk/tools@workspace:*',
    ]);
  });

  // U2 (GEN-03): the end-to-end stack's raw calls stay outside both packages.
  it('catches an e2e/ file in the published files', () => {
    mkdirSync(join(dir, 'src', 'e2e'), { recursive: true });
    writeFileSync(join(dir, 'src', 'e2e', 'setup.ts'), 'export {};\n');
    expect(checkPackage(dir)).toEqual(['@soorma/sdk-fixture: would publish src/e2e/setup.ts']);
  });

  it('catches a files entry or a dependency reaching the end-to-end stack', () => {
    manifest({ name: 'p', files: ['src', '../e2e/src'] });
    expect(checkPackage(dir)).toEqual(['p: files lists ../e2e/src']);
    manifest({ name: 'p', files: ['src'], dependencies: { '@soorma-sdk/e2e': 'workspace:*' } });
    expect(checkPackage(dir)).toEqual([
      'p: dependencies names test-only @soorma-sdk/e2e@workspace:*',
    ]);
  });

  // Added at U4: a Python package (pyproject.toml, src/ layout).
  it('checks a Python package: its dependencies and what it would publish', () => {
    const py = mkdtempSync(join(tmpdir(), 'pypkg-'));
    try {
      mkdirSync(join(py, 'src', 'soorma', '_internal'), { recursive: true });
      writeFileSync(join(py, 'src', 'soorma', '__init__.py'), '');
      writeFileSync(join(py, 'src', 'soorma', '_internal', 'test_values.py'), '');
      const pyproject = (deps: string) =>
        writeFileSync(
          join(py, 'pyproject.toml'),
          `[project]\nname = "soorma"\ndependencies = [${deps}]\n\n[tool.uv.build-backend]\nsource-exclude = ["src/soorma/_internal"]\n`,
        );
      pyproject('"opentelemetry-api>=1.14.0,<2"');
      expect(checkPackage(py)).toEqual([]);
      pyproject('"soorma-sdk-conformance==0.1.0"');
      expect(checkPackage(py)).toEqual([
        'soorma: dependencies names test-only soorma-sdk-conformance==0.1.0',
      ]);
      pyproject('"opentelemetry-api"');
      mkdirSync(join(py, 'src', 'soorma', 'e2e'));
      writeFileSync(join(py, 'src', 'soorma', 'e2e', 'scenario.py'), '');
      expect(checkPackage(py)).toEqual(['soorma: would publish src/soorma/e2e/scenario.py']);
    } finally {
      rmSync(py, { recursive: true, force: true });
    }
  });
});
