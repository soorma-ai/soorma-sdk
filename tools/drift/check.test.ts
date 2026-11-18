// SPDX-License-Identifier: Apache-2.0
//
// The drift check catches what it looks for (US-12 #1): a modified, an added
// and a removed file; a wrong peeled commit; a wrong tree id; an unreachable
// remote (fail closed); --offline refused in CI. The remote is a local git
// repository standing in for soorma-core, reached by file:// with no token.
import { cpSync, mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { git } from '../lib/git.ts';
import { checkRemote, compareLocal, offlineRefusal, runDrift } from './check.ts';
import { hashTree, type Pin } from './pin.ts';

let remote = '';
let work = '';
let pin: Pin;

beforeAll(() => {
  remote = mkdtempSync(join(tmpdir(), 'drift-remote-'));
  mkdirSync(join(remote, 'contract', 'conventions'), { recursive: true });
  writeFileSync(join(remote, 'contract', 'envelope.schema.json'), '{"type":"object"}\n');
  writeFileSync(join(remote, 'contract', 'conventions', 'errors.md'), '# Errors\n');
  git(['init', '-q', '-b', 'main'], remote);
  git(['config', 'uploadpack.allowAnySHA1InWant', 'true'], remote);
  git(['add', '.'], remote);
  git(
    ['-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'contract'],
    remote,
  );
  git(
    [
      '-c',
      'user.name=t',
      '-c',
      'user.email=t@example.com',
      'tag',
      '-a',
      'contract-v0.1.0',
      '-m',
      'v0.1.0',
    ],
    remote,
  );
  const commit = git(['rev-parse', 'HEAD'], remote);
  const tree = git(['rev-parse', 'HEAD:contract'], remote);

  work = mkdtempSync(join(tmpdir(), 'drift-work-'));
  cpSync(join(remote, 'contract'), join(work, 'contract'), { recursive: true });
  pin = {
    repository: `file://${remote}`,
    tag: 'contract-v0.1.0',
    commit,
    tree,
    files: hashTree(work, join(work, 'contract')),
  };
  writeFileSync(join(work, 'contract.pin.json'), JSON.stringify(pin));
});

afterAll(() => {
  rmSync(remote, { recursive: true, force: true });
  rmSync(work, { recursive: true, force: true });
});

const local = (): string[] => compareLocal(pin.files, hashTree(work, join(work, 'contract')));

describe('drift check, local half', () => {
  it('passes on the pinned copy', () => expect(local()).toEqual([]));

  it('catches a modified file, naming it', () => {
    const f = join(work, 'contract', 'envelope.schema.json');
    writeFileSync(f, '{"type":"array"}\n');
    expect(local()).toEqual([
      'differs: contract/envelope.schema.json (its SHA-256 is not the pinned one)',
    ]);
    writeFileSync(f, '{"type":"object"}\n');
  });

  it('catches an added file, naming it', () => {
    const f = join(work, 'contract', 'extra.md');
    writeFileSync(f, 'x\n');
    expect(local()).toEqual(['extra: contract/extra.md (present, not pinned)']);
    unlinkSync(f);
  });

  it('catches a removed file, naming it', () => {
    const f = join(work, 'contract', 'conventions', 'errors.md');
    unlinkSync(f);
    expect(local()).toEqual(['missing: contract/conventions/errors.md (pinned, not present)']);
    writeFileSync(f, '# Errors\n');
  });
});

describe('drift check, remote half (git only)', () => {
  it('passes when the tag peels to the pinned commit and the tree matches', () => {
    expect(checkRemote(pin, pin.repository)).toEqual([]);
  });

  it('catches a wrong peeled commit', () => {
    const wrong = { ...pin, commit: '0'.repeat(40) };
    expect(checkRemote(wrong, pin.repository)[0]).toContain(
      `peels to ${pin.commit}, but the pin records 0000`,
    );
  });

  it('catches a wrong tree id', () => {
    const wrong = { ...pin, tree: 'f'.repeat(40) };
    expect(checkRemote(wrong, pin.repository)[0]).toContain(
      `is tree ${pin.tree}, but the pin records ffff`,
    );
  });

  it('fails closed when the remote cannot be reached', () => {
    const failures = checkRemote(pin, `file://${join(tmpdir(), 'no-such-remote-for-drift')}`);
    expect(failures[0]).toMatch(/^remote unreachable: .*failing closed$/);
  });
});

describe('--offline', () => {
  it('runs the local half only and says so, outside CI', () => {
    const r = runDrift(work, { offline: true, env: {} });
    expect(r.ok).toBe(true);
    expect(r.lines).toContain('remote half not run (--offline)');
  });

  it('is refused in CI', () => {
    expect(offlineRefusal(true, { GITHUB_ACTIONS: 'true' })).toContain('refused in CI');
    const r = runDrift(work, { offline: true, env: { CI: 'true' } });
    expect(r.ok).toBe(false);
  });

  it('the full check passes online against the stand-in remote', () => {
    expect(runDrift(work, { offline: false, env: {} }).ok).toBe(true);
  });
});
