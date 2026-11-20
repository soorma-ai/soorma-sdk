// SPDX-License-Identifier: Apache-2.0
//
// package-python (TS-U4-04; PH-API-06; TC-PH-058, 065): soorma as a tenant
// receives it. Builds the wheel and the sdist; runs the guard over both file
// lists (no test-only path, no soorma/_internal: the values hook never ships);
// for each Python asked for, makes a fresh virtual environment outside the
// project and installs, offline and hash-checked, the runtime dependencies from
// uv.lock, then the wheel; in it, importing soorma constructs an AgentClient
// (which contacts nothing), the metadata states Apache-2.0, and importing the
// values hook fails. The example's agent files are copied into a fresh
// directory, type-checked with mypy --strict against the installed package,
// and imported. Run from the repository root after `uv sync --locked` in
// python/ (for mypy and a warm uv cache):
//   node tools/package-python/check.ts --python 3.11.18 --python 3.15.2
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const FORBIDDEN_PATH =
  /(^|\/)(_internal|tests|conformance_driver|e2e|examples|scripts|__pycache__)(\/|$)/;

export const REQUIRED = {
  wheel: ['soorma/__init__.py', 'soorma/py.typed'],
  sdist: ['pyproject.toml', 'README.md', 'LICENSE', 'NOTICE', 'src/soorma/__init__.py'],
};

/** The guard over a built distribution's file list (wheel: `unzip -Z1`; sdist: `tar -tzf`). */
export function distributionFailures(kind: 'wheel' | 'sdist', entries: string[]): string[] {
  const files = entries
    .map((e) => e.trim())
    .filter((e) => e !== '' && !e.endsWith('/'))
    .map((e) => (kind === 'sdist' ? e.replace(/^soorma-[^/]+\//, '') : e))
    .filter((e) => !/^soorma-[^/]+$/.test(e));
  const failures: string[] = [];
  for (const f of files) {
    if (FORBIDDEN_PATH.test(f)) failures.push(`the ${kind} holds test-only ${f}`);
    if (/test_values/.test(f)) failures.push(`the ${kind} holds the values hook: ${f}`);
  }
  for (const r of REQUIRED[kind]) if (!files.includes(r)) failures.push(`the ${kind} lacks ${r}`);
  if (kind === 'wheel') {
    for (const l of ['LICENSE', 'NOTICE'])
      if (!files.some((f) => /\.dist-info\/licenses\//.test(f) && f.endsWith(`/${l}`)))
        failures.push(`the wheel lacks ${l}`);
  }
  return failures;
}

const IMPORT = `import importlib
import importlib.metadata
from soorma import AgentClient, AgentClientOptions, file_secret, new_instance_id
AgentClient(AgentClientOptions(
    data_gateway_url="https://s3.invalid",
    event_ingest_url="https://s4.invalid",
    agent="agent-a",
    instance=new_instance_id(),
    secret=file_secret("/nonexistent"),
))
licence = importlib.metadata.metadata("soorma")["License-Expression"]
assert licence == "Apache-2.0", licence
try:
    importlib.import_module("soorma._internal.test_values")
except ModuleNotFoundError:
    pass
else:
    raise SystemExit("the values hook is importable")
print("import: AgentClient constructed; Apache-2.0; the values hook absent")
`;

const AGENTS = `import sys
sys.path.insert(0, ".")
import agent_a, agent_b
for m, agent in ((agent_a, "agent-a"), (agent_b, "agent-b")):
    assert callable(m.run) and m.config.agent == agent, agent
print("agents: imported; each has run(config) and its configuration block")
`;

export function checkPackage(root: string, pythons: string[]): void {
  const work = mkdtempSync(join(tmpdir(), 'soorma-package-python-'));
  const project = join(root, 'python');
  const run = (cmd: string, args: string[], cwd: string): string =>
    execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  try {
    // Build, and guard both distributions.
    const dist = join(work, 'dist');
    run('uv', ['build', '--project', project, '--out-dir', dist], root);
    const files = readdirSync(dist);
    const wheel = files.find((f) => f.endsWith('.whl'));
    const sdist = files.find((f) => f.endsWith('.tar.gz'));
    if (!wheel || !sdist) throw new Error('uv build wrote no wheel or no sdist');
    const failures = [
      ...distributionFailures('wheel', run('unzip', ['-Z1', join(dist, wheel)], work).split('\n')),
      ...distributionFailures('sdist', run('tar', ['-tzf', join(dist, sdist)], work).split('\n')),
    ];
    if (failures.length > 0) throw new Error(failures.join('\n'));
    console.log(`distributions: ${wheel}, ${sdist}: the guard passes`);

    let first: string | undefined;
    for (const version of pythons) {
      // A fresh environment outside the project, holding exactly the lock's runtime
      // dependencies: uv sync reads the lock's URLs from the cache, offline, and checks
      // the lock's hashes. (uv pip install -r would resolve against the index, whose
      // metadata a cache filled by uv sync does not hold.)
      const venv = join(work, `venv-${version}`);
      const py = join(venv, 'bin', 'python');
      execFileSync(
        'uv',
        [
          'sync',
          '--project',
          project,
          '--locked',
          '--offline',
          '--no-default-groups',
          '--no-install-project',
          '--python',
          version,
        ],
        {
          cwd: root,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'inherit'],
          env: { ...process.env, UV_PROJECT_ENVIRONMENT: venv },
        },
      );
      const install = ['pip', 'install', '--python', py, '--offline'];
      run('uv', [...install, '--no-deps', join(dist, wheel)], work);
      const fresh = join(work, `fresh-${version}`);
      mkdirSync(fresh);
      process.stdout.write(`${version}: ${run(py, ['-I', '-c', IMPORT], fresh)}`);
      first ??= fresh;

      // The example's agent files, copied in and imported.
      for (const f of ['agent_a.py', 'agent_b.py'])
        cpSync(join(project, 'examples', 'two_agents', f), join(fresh, f));
      writeFileSync(join(fresh, 'agents.py'), AGENTS);
      process.stdout.write(`${version}: ${run(py, ['-I', 'agents.py'], fresh)}`);
      if (version === pythons[0]) {
        // Type-checked once, with the project's mypy, against the installed package.
        run(
          join(project, '.venv', 'bin', 'mypy'),
          ['--strict', '--python-executable', py, 'agent_a.py', 'agent_b.py'],
          fresh,
        );
        console.log(`${version}: agents: type-checked (mypy --strict) against the installed wheel`);
      }
    }
    if (!first) throw new Error('no Python asked for');
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** `--python X` once or more; the project's own Python when none is given. */
export function pythonsFrom(argv: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--python' && argv[i + 1]) out.push(argv[++i] as string);
  }
  return out.length > 0 ? out : ['3.11'];
}

if (import.meta.main) {
  try {
    checkPackage(resolve(import.meta.dirname, '..', '..'), pythonsFrom(process.argv.slice(2)));
    console.log('package-python: pass');
  } catch (error) {
    console.error(`package-python: FAIL ${(error as Error).message}`);
    process.exitCode = 1;
  }
}
