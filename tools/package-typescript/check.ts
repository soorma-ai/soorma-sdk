// SPDX-License-Identifier: Apache-2.0
//
// package-typescript (NFR-U3-21, -22; TC-TH-058, 065; plan 1.1): @soorma/sdk
// as a tenant receives it. Packs the built package; runs the packaging guard
// over the tarball's file list (no test-only path, no dist/internal: the values
// hook never ships); installs the tarball into a fresh project outside the
// workspace, offline (nothing is fetched: the peer @opentelemetry/api is the
// workspace's locked copy, NFR-U1-24); then, in that project, an ESM file
// imports and a CommonJS file require()s the package, each constructing an
// AgentClient (which contacts nothing); a deep import of the hook fails; and
// the example's agent files are copied in, type-checked and imported.
// Build first: `pnpm --filter @soorma/sdk build`.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { findPackage } from '../otel-api-floor/use-floor.ts';

const FORBIDDEN_PATH = /(^|\/)(conformance|tools|e2e|reference-driver|test-fixtures)(\/|$)/;
export const REQUIRED = [
  'package.json',
  'README.md',
  'LICENSE',
  'NOTICE',
  'dist/index.js',
  'dist/index.d.ts',
];

/** The guard over a packed tarball's file list (paths as `tar -t` prints them). */
export function tarballFailures(entries: string[]): string[] {
  const files = entries.filter((e) => !e.endsWith('/')).map((e) => e.replace(/^package\//, ''));
  const failures: string[] = [];
  for (const f of files) {
    if (FORBIDDEN_PATH.test(f)) failures.push(`the tarball holds test-only ${f}`);
    if (/^dist\/internal(\/|$)/.test(f) || /test-values/.test(f))
      failures.push(`the tarball holds the values hook: ${f}`);
    if (/\.test\.(js|ts|d\.ts)$/.test(f)) failures.push(`the tarball holds a test: ${f}`);
  }
  for (const r of REQUIRED) if (!files.includes(r)) failures.push(`the tarball lacks ${r}`);
  return failures;
}

const ESM = `import { AgentClient, fileSecret, newInstanceId } from '@soorma/sdk';
const c = new AgentClient({
  dataGatewayUrl: 'https://s3.invalid',
  eventIngestUrl: 'https://s4.invalid',
  agent: 'agent-a',
  instance: newInstanceId(),
  secret: fileSecret('/nonexistent'),
});
await c.close();
let deep = 'imported';
try {
  await import('@soorma/sdk/dist/internal/test-values.js');
} catch (e) {
  deep = e.code;
}
if (deep !== 'ERR_PACKAGE_PATH_NOT_EXPORTED') throw new Error('a deep import gave ' + deep);
console.log('esm: import, AgentClient constructed; deep import refused (' + deep + ')');
`;

const CJS = `const { AgentClient, fileSecret, newInstanceId } = require('@soorma/sdk');
const c = new AgentClient({
  dataGatewayUrl: 'https://s3.invalid',
  eventIngestUrl: 'https://s4.invalid',
  agent: 'agent-a',
  instance: newInstanceId(),
  secret: fileSecret('/nonexistent'),
});
c.close().then(() => console.log('cjs: require(), AgentClient constructed'));
`;

const AGENTS = `const a = await import('./agent-a.ts');
const b = await import('./agent-b.ts');
for (const [m, agent] of [[a, 'agent-a'], [b, 'agent-b']]) {
  if (typeof m.run !== 'function' || m.config.agent !== agent) throw new Error(agent + ': no run(config)');
}
console.log('agents: imported; each exports run and its configuration');
`;

export function checkPackage(root: string): void {
  const work = mkdtempSync(join(tmpdir(), 'soorma-package-'));
  const run = (cmd: string, args: string[], cwd: string): string =>
    execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  try {
    // Pack, and guard the tarball.
    const packDir = join(work, 'pack');
    mkdirSync(packDir);
    run('pnpm', ['pack', '--pack-destination', packDir], join(root, 'typescript'));
    const tgz = readdirSync(packDir).find((f) => f.endsWith('.tgz'));
    if (!tgz) throw new Error('pnpm pack wrote no tarball');
    const tarball = join(packDir, tgz);
    const failures = tarballFailures(run('tar', ['-tzf', tarball], work).split('\n'));
    if (failures.length > 0) throw new Error(failures.join('\n'));
    console.log(`tarball: ${tgz}: the guard passes`);

    // A fresh project outside the workspace; the tarball installed offline.
    const fresh = join(work, 'fresh');
    mkdirSync(fresh);
    writeFileSync(
      join(fresh, 'package.json'),
      `${JSON.stringify({ name: 'fresh', private: true, version: '0.0.0', type: 'module' }, null, 2)}\n`,
    );
    run(
      'npm',
      [
        'install',
        '--offline',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--legacy-peer-deps',
        '--save-exact',
        tarball,
      ],
      fresh,
    );
    // The peer, as the tenant's own copy: the workspace's locked one.
    const api = findPackage(join(root, 'typescript'), join('@opentelemetry', 'api'));
    if (!api) throw new Error('@opentelemetry/api is not installed in the workspace');
    cpSync(api, join(fresh, 'node_modules', '@opentelemetry', 'api'), {
      recursive: true,
      dereference: true,
    });

    writeFileSync(join(fresh, 'esm.mjs'), ESM);
    writeFileSync(join(fresh, 'cjs.cjs'), CJS);
    process.stdout.write(run(process.execPath, ['esm.mjs'], fresh));
    process.stdout.write(run(process.execPath, ['cjs.cjs'], fresh));

    // The example's agent files, copied in, type-checked and imported.
    for (const f of ['agent-a.ts', 'agent-b.ts'])
      cpSync(join(root, 'typescript', 'examples', 'two-agents', f), join(fresh, f));
    writeFileSync(
      join(fresh, 'tsconfig.json'),
      `${JSON.stringify(
        {
          compilerOptions: {
            target: 'es2024',
            module: 'nodenext',
            moduleResolution: 'nodenext',
            strict: true,
            noEmit: true,
            allowImportingTsExtensions: true,
            skipLibCheck: false,
            types: ['node'],
            typeRoots: [join(root, 'node_modules', '@types')],
          },
          include: ['agent-a.ts', 'agent-b.ts'],
        },
        null,
        2,
      )}\n`,
    );
    run(
      process.execPath,
      [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', '.'],
      fresh,
    );
    console.log('agents: type-checked against the installed package');
    writeFileSync(join(fresh, 'agents.mjs'), AGENTS);
    process.stdout.write(run(process.execPath, ['agents.mjs'], fresh));
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  try {
    checkPackage(resolve(import.meta.dirname, '..', '..'));
    console.log('package-typescript: pass');
  } catch (error) {
    console.error(`package-typescript: FAIL ${(error as Error).message}`);
    process.exitCode = 1;
  }
}
