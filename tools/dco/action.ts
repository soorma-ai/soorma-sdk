// SPDX-License-Identifier: Apache-2.0
//
// The DCO check as run by actions/github-script in .github/workflows/dco.yml.
// The GitHub client is the action's own, authenticated by its default
// `github-token` input: no token is ever placed in an environment variable.
import { answerFromApi, check, type ReadCommitApi } from './check.ts';
import { listCommits } from './git.ts';

interface Octokit {
  rest: {
    repos: {
      getCommit(params: { owner: string; repo: string; ref: string }): Promise<{ data: unknown }>;
    };
  };
}

interface Context {
  repo: { owner: string; repo: string };
  payload: { pull_request?: { base: { sha: string }; head: { sha: string } } };
}

interface Core {
  info(message: string): void;
  error(message: string): void;
  setFailed(message: string): void;
}

export default async function run(args: {
  github: Octokit;
  context: Context;
  core: Core;
  cwd?: string;
}): Promise<boolean> {
  const { github, context, core } = args;
  const pr = context.payload.pull_request;
  if (!pr) {
    core.setFailed('The DCO check runs on pull requests only.');
    return false;
  }
  const commits = listCommits(args.cwd ?? process.cwd(), pr.base.sha, pr.head.sha);
  const readCommitApi: ReadCommitApi = async (sha) => {
    const { owner, repo } = context.repo;
    const { data } = await github.rest.repos.getCommit({ owner, repo, ref: sha });
    return answerFromApi(data);
  };
  const result = await check(commits, readCommitApi);
  for (const line of result.lines) {
    if (line.startsWith('fail')) core.error(line);
    else core.info(line);
  }
  if (!result.ok) {
    core.setFailed(
      [
        'Every commit must carry a Signed-off-by line matching its author.',
        'Fix the whole branch with:',
        `  git rebase --signoff ${pr.base.sha}`,
        '  git push --force-with-lease',
      ].join('\n'),
    );
  }
  return result.ok;
}
