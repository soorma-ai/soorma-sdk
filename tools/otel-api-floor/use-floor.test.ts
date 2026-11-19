// SPDX-License-Identifier: Apache-2.0
//
// The floor swap on a fake pnpm layout: the package's API and its tests'
// OpenTelemetry SDK's API become one copy at 1.9.0; anything that is not a
// store copy of the API is refused untouched; a second copy left behind fails.
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CONSUMERS, FLOOR, apiCopies, useFloor } from './use-floor.ts';

const roots: string[] = [];
afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

const pkg = (dir: string, version: string, extra?: string): void => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x', version }));
  if (extra) writeFileSync(join(dir, extra), '');
};
const link = (to: string, at: string): void => {
  mkdirSync(dirname(at), { recursive: true });
  symlinkSync(to, at, 'dir');
};

/** A pnpm-shaped install: the floor alias, the locked API, two consumers. */
function layout(opts: { floor?: string; realApiInPackage?: boolean; strayCopy?: boolean } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'otel-floor-')));
  roots.push(root);
  pkg(root, '0.0.0');
  pkg(join(root, 'typescript'), '0.1.0');
  const store = join(root, 'node_modules', '.pnpm');
  const floor = join(store, '@opentelemetry+api@1.9.0', 'node_modules', '@opentelemetry', 'api');
  const api = join(store, '@opentelemetry+api@1.10.0', 'node_modules', '@opentelemetry', 'api');
  const stray = join(store, '@opentelemetry+api@1.8.0', 'node_modules', '@opentelemetry', 'api');
  pkg(floor, opts.floor ?? FLOOR, 'floor.js');
  pkg(api, '1.10.0', 'newer.js');
  pkg(stray, '1.8.0');
  link(floor, join(root, 'tools', 'node_modules', 'opentelemetry-api-floor'));
  const pkgApi = join(root, 'typescript', 'node_modules', '@opentelemetry', 'api');
  if (opts.realApiInPackage) pkg(pkgApi, '1.10.0');
  else link(api, pkgApi);
  CONSUMERS.forEach((c, i) => {
    const base = join(store, `consumer-${i}`, 'node_modules');
    pkg(join(base, c), '2.12.0');
    link(opts.strayCopy && i === 0 ? stray : api, join(base, '@opentelemetry', 'api'));
    link(join(base, c), join(root, 'typescript', 'node_modules', c));
  });
  return { root, floor, api };
}

describe('the @opentelemetry/api floor swap (NFR-U3-16)', () => {
  it('leaves one copy, at 1.9.0, seen by the package and by every consumer', () => {
    const { root, floor, api } = layout();
    expect(new Set(apiCopies(root).map((c) => c.version))).toEqual(new Set(['1.10.0']));
    expect(useFloor(root)).toEqual({ replaced: api, was: '1.10.0' });
    const copies = apiCopies(root);
    expect(copies).toHaveLength(CONSUMERS.length + 1);
    for (const c of copies) expect(c).toMatchObject({ dir: api, version: FLOOR });
    expect(existsSync(join(api, 'floor.js'))).toBe(true);
    expect(existsSync(join(api, 'newer.js'))).toBe(false);
    expect(existsSync(join(floor, 'floor.js'))).toBe(true); // the floor itself untouched
  });

  it('refuses a floor alias at any other version, changing nothing', () => {
    const { root, api } = layout({ floor: '1.9.1' });
    expect(() => useFloor(root)).toThrow(/is 1\.9\.1, expected 1\.9\.0/);
    expect(existsSync(join(api, 'newer.js'))).toBe(true);
  });

  it('refuses to replace anything that is not a store copy of the API', () => {
    const { root } = layout({ realApiInPackage: true });
    expect(() => useFloor(root)).toThrow(/refusing to replace/);
    expect(existsSync(join(root, 'typescript', 'node_modules', '@opentelemetry', 'api'))).toBe(
      true,
    );
  });

  it('fails when a consumer keeps a copy of its own', () => {
    const { root } = layout({ strayCopy: true });
    expect(() => useFloor(root)).toThrow(/after the swap/);
  });
});
