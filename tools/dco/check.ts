// SPDX-License-Identifier: Apache-2.0
//
// The DCO check (U1 NFR-U1-29 to -32; P-08). Every non-merge commit in a pull
// request carries `Signed-off-by: {author name} <{author email}>`, except a
// commit GitHub reports as authored by dependabot[bot] AND verified (GitHub
// signs Dependabot's commits, so an email cannot be spoofed into the
// exemption). A lookup that fails, or answers without the fields, never
// exempts: the check fails closed. A pure function: git and the API are given.

export interface CommitMeta {
  sha: string;
  name: string;
  email: string;
  subject: string;
  message: string;
}

/** What the exemption needs from GitHub's `GET /repos/{owner}/{repo}/commits/{sha}`. */
export interface CommitApiAnswer {
  authorLogin: string | null;
  verified: boolean | null;
}

export type ReadCommitApi = (sha: string) => Promise<CommitApiAnswer>;

export const DEPENDABOT = 'dependabot[bot]';

/** Maps a commit API response body to the two fields the exemption reads. */
export function answerFromApi(data: unknown): CommitApiAnswer {
  const d = data as {
    author?: { login?: unknown } | null;
    commit?: { verification?: { verified?: unknown } | null } | null;
  } | null;
  const login = d?.author?.login;
  const verified = d?.commit?.verification?.verified;
  return {
    authorLogin: typeof login === 'string' ? login : null,
    verified: typeof verified === 'boolean' ? verified : null,
  };
}

export function expectedSignOff(c: CommitMeta): string {
  return `Signed-off-by: ${c.name} <${c.email}>`;
}

export function isSignedOff(c: CommitMeta): boolean {
  const expected = expectedSignOff(c);
  return c.message.split('\n').some((line) => line.trimEnd() === expected);
}

export interface CheckResult {
  ok: boolean;
  lines: string[];
}

export async function check(
  commits: CommitMeta[],
  readCommitApi: ReadCommitApi,
): Promise<CheckResult> {
  const lines: string[] = [];
  let ok = true;
  if (commits.length === 0) return { ok, lines: ['No non-merge commits to check.'] };
  for (const c of commits) {
    const short = c.sha.slice(0, 8);
    if (isSignedOff(c)) {
      lines.push(`ok    ${short}  ${c.subject}`);
      continue;
    }
    let answer: CommitApiAnswer;
    try {
      answer = await readCommitApi(c.sha);
    } catch (error) {
      ok = false;
      lines.push(
        `fail  ${short}  ${c.subject}  (no sign-off, and the commit lookup failed: ${(error as Error).message}; failing closed)`,
      );
      continue;
    }
    if (answer.authorLogin === null || answer.verified === null) {
      ok = false;
      lines.push(
        `fail  ${short}  ${c.subject}  (no sign-off, and the commit lookup lacked author.login or verification.verified; failing closed)`,
      );
    } else if (answer.authorLogin === DEPENDABOT && answer.verified) {
      lines.push(`skip  ${short}  ${c.subject}  (dependabot[bot], verified by GitHub)`);
    } else {
      ok = false;
      lines.push(`fail  ${short}  ${c.subject}  (missing or mismatched: ${expectedSignOff(c)})`);
    }
  }
  return { ok, lines };
}
