// SPDX-License-Identifier: Apache-2.0
//
// The DCO tests (NFR-U1-32): a local test git repository holds the commit
// shapes; GitHub's commit API is a stub answering recorded responses. No real
// pull request is involved. The live confirmation is OBL-01.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import run from './action.ts';
import { answerFromApi, check, type CommitApiAnswer, type ReadCommitApi } from './check.ts';
import { listCommits } from './git.ts';

const HUMAN = { name: 'Ada Lovelace', email: 'ada@example.com' };
const OTHER = { name: 'Grace Hopper', email: 'grace@example.com' };
const DEPENDABOT = {
  name: 'dependabot[bot]',
  email: '49699333+dependabot[bot]@users.noreply.github.com',
};
const FAKE_BOT = { name: 'helper[bot]', email: 'helper[bot]@example.com' };

// Recorded response shapes of GET /repos/{owner}/{repo}/commits/{sha}.
const recorded = {
  verifiedDependabot: {
    author: { login: 'dependabot[bot]', type: 'Bot' },
    commit: {
      author: DEPENDABOT,
      verification: { verified: true, reason: 'valid', signature: '-----BEGIN PGP SIGNATURE-----' },
    },
  },
  unverifiedBotEmail: {
    author: null,
    commit: {
      author: FAKE_BOT,
      verification: { verified: false, reason: 'unsigned', signature: null },
    },
  },
  unverifiedDependabotLogin: {
    author: { login: 'dependabot[bot]', type: 'Bot' },
    commit: {
      author: DEPENDABOT,
      verification: { verified: false, reason: 'unsigned', signature: null },
    },
  },
  human: {
    author: { login: 'grace', type: 'User' },
    commit: {
      author: OTHER,
      verification: { verified: false, reason: 'unsigned', signature: null },
    },
  },
  noVerification: {
    author: { login: 'dependabot[bot]', type: 'Bot' },
    commit: { author: DEPENDABOT },
  },
};

let repo = '';
const g = (...args: string[]): string =>
  execFileSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
function commit(who: { name: string; email: string }, subject: string, signOff: boolean): string {
  const msg = signOff ? `${subject}\n\nSigned-off-by: ${who.name} <${who.email}>` : subject;
  g(
    '-c',
    `user.name=${who.name}`,
    '-c',
    `user.email=${who.email}`,
    'commit',
    '--allow-empty',
    '-q',
    '-m',
    msg,
  );
  return g('rev-parse', 'HEAD');
}

const shas: Record<string, string> = {};
const answers = new Map<string, unknown>();
const stub: ReadCommitApi = async (sha) => {
  const data = answers.get(sha);
  if (data instanceof Error) throw data;
  if (data === undefined) throw new Error(`no recorded response for ${sha}`);
  return answerFromApi(data);
};

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), 'dco-'));
  g('init', '-q', '-b', 'main');
  shas.base = commit(HUMAN, 'base', true);
  // A Dependabot pull request into dev: one Dependabot commit.
  g('checkout', '-q', '-b', 'dependabot');
  shas.dependabot = commit(DEPENDABOT, 'Bump vitest from 5.1.0 to 5.1.1', false);
  // A human pushes an unsigned commit into that pull request.
  g('checkout', '-q', '-b', 'dependabot-plus-human');
  shas.humanInDependabot = commit(OTHER, 'tweak the bump', false);
  // Another author's pull request without a sign-off.
  g('checkout', '-q', 'main');
  g('checkout', '-q', '-b', 'other');
  shas.other = commit(OTHER, 'unsigned change', false);
  // A commit whose email contains [bot], not verified as Dependabot's.
  g('checkout', '-q', 'main');
  g('checkout', '-q', '-b', 'fake-bot');
  shas.fakeBot = commit(FAKE_BOT, 'a bot-looking commit', false);
  // dev: the Dependabot pull request merged (a merge commit), then signed work.
  g('checkout', '-q', 'main');
  g('checkout', '-q', '-b', 'dev');
  g(
    '-c',
    `user.name=${HUMAN.name}`,
    '-c',
    `user.email=${HUMAN.email}`,
    'merge',
    '-q',
    '--no-ff',
    '-m',
    'Merge pull request #1 from dependabot',
    'dependabot',
  );
  shas.signed = commit(HUMAN, 'signed work on dev', true);

  answers.set(shas.dependabot, recorded.verifiedDependabot);
  answers.set(shas.humanInDependabot, recorded.human);
  answers.set(shas.other, recorded.human);
  answers.set(shas.fakeBot, recorded.unverifiedBotEmail);
});

afterAll(() => rmSync(repo, { recursive: true, force: true }));

const verdict = async (base: string, head: string, read: ReadCommitApi = stub) =>
  check(listCommits(repo, base, head), read);

describe('DCO check: each of these fails', () => {
  it("another author's commit without a sign-off", async () => {
    const r = await verdict(shas.base!, 'other');
    expect(r.ok).toBe(false);
    expect(r.lines.join('\n')).toContain(`Signed-off-by: ${OTHER.name} <${OTHER.email}>`);
  });

  it("a commit whose author email contains [bot] but that isn't verified as Dependabot's", async () => {
    expect((await verdict(shas.base!, 'fake-bot')).ok).toBe(false);
    const asDependabotUnverified: ReadCommitApi = async () =>
      answerFromApi(recorded.unverifiedDependabotLogin);
    expect((await verdict(shas.base!, 'fake-bot', asDependabotUnverified)).ok).toBe(false);
  });

  it('a human commit without a sign-off pushed into a Dependabot PR', async () => {
    const r = await verdict(shas.base!, 'dependabot-plus-human');
    expect(r.ok).toBe(false);
    expect(r.lines[0]).toMatch(/^skip/);
    expect(r.lines[1]).toMatch(/^fail/);
  });

  it('an API lookup that errors, or answers without the fields (fail closed)', async () => {
    const erroring: ReadCommitApi = async () => {
      throw new Error('HTTP 502');
    };
    const r = await verdict(shas.base!, 'dependabot', erroring);
    expect(r.ok).toBe(false);
    expect(r.lines[0]).toContain('failing closed');
    const missing: ReadCommitApi = async () => answerFromApi(recorded.noVerification);
    expect((await verdict(shas.base!, 'dependabot', missing)).ok).toBe(false);
  });
});

describe('DCO check: each of these passes', () => {
  it('a verified Dependabot commit, on its own PR', async () => {
    const r = await verdict(shas.base!, 'dependabot');
    expect(r).toEqual({ ok: true, lines: [expect.stringMatching(/^skip .*verified by GitHub/)] });
  });

  it('the same commit already merged into dev, on the dev -> main PR', async () => {
    const r = await verdict(shas.base!, 'dev');
    expect(r.ok).toBe(true);
    // The merge commit is skipped by --no-merges; the human commit is signed off.
    expect(r.lines).toHaveLength(2);
    expect(r.lines[0]).toMatch(/^skip/);
    expect(r.lines[1]).toMatch(/^ok/);
  });
});

describe('answerFromApi', () => {
  it('reads author.login and commit.verification.verified, and nothing else', () => {
    expect(answerFromApi(recorded.verifiedDependabot)).toEqual<CommitApiAnswer>({
      authorLogin: 'dependabot[bot]',
      verified: true,
    });
    expect(answerFromApi(recorded.unverifiedBotEmail)).toEqual({
      authorLogin: null,
      verified: false,
    });
    expect(answerFromApi(null)).toEqual({ authorLogin: null, verified: null });
  });
});

describe('the action wrapper', () => {
  const fakeCore = () => {
    const calls: { info: string[]; error: string[]; failed: string[] } = {
      info: [],
      error: [],
      failed: [],
    };
    return {
      calls,
      core: {
        info: (m: string) => calls.info.push(m),
        error: (m: string) => calls.error.push(m),
        setFailed: (m: string) => calls.failed.push(m),
      },
    };
  };
  const github = {
    rest: {
      repos: {
        getCommit: async ({ ref }: { owner: string; repo: string; ref: string }) => {
          const data = answers.get(ref);
          if (data === undefined) throw new Error('404');
          return { data };
        },
      },
    },
  };
  const context = (head: string) => ({
    repo: { owner: 'soorma-ai', repo: 'soorma-sdk' },
    payload: { pull_request: { base: { sha: shas.base! }, head: { sha: g('rev-parse', head) } } },
  });

  it('passes the dev -> main range through the GitHub client', async () => {
    const { calls, core } = fakeCore();
    expect(await run({ github, context: context('dev'), core, cwd: repo })).toBe(true);
    expect(calls.failed).toEqual([]);
  });

  it('fails the run, naming the commit, for an unsigned human commit', async () => {
    const { calls, core } = fakeCore();
    expect(await run({ github, context: context('other'), core, cwd: repo })).toBe(false);
    expect(calls.error[0]).toContain(shas.other!.slice(0, 8));
    expect(calls.failed).toHaveLength(1);
  });
});
