// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkWorkflow } from './check.ts';

const SHA = '3d3c42e5aac5ba805825da76410c181273ba90b1';
const good = `name: x
on: [pull_request]
permissions:
  contents: read
jobs:
  a:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@${SHA} # v7.0.1
      - uses: ./local-action
      - run: echo hi
`;

describe('workflow check', () => {
  it('passes a pinned, read-only workflow on ubuntu-24.04', () => {
    expect(checkWorkflow('w.yml', good)).toEqual([]);
  });

  it('catches an action pinned to a tag', () => {
    const f = checkWorkflow('w.yml', good.replace(`@${SHA} # v7.0.1`, '@v7'));
    expect(f).toEqual(['w.yml:9: actions/checkout@v7 is not pinned to a commit SHA']);
  });

  it('catches a SHA without a tag comment', () => {
    const f = checkWorkflow('w.yml', good.replace(' # v7.0.1', ''));
    expect(f).toEqual([`w.yml:9: actions/checkout@${SHA} has no tag comment (# vX.Y.Z)`]);
  });

  it('catches ubuntu-latest', () => {
    const f = checkWorkflow('w.yml', good.replace('ubuntu-24.04', 'ubuntu-latest'));
    expect(f).toEqual(['w.yml: job a runs on "ubuntu-latest", not ubuntu-24.04']);
  });

  it('catches permissions wider than contents: read, at either level', () => {
    expect(checkWorkflow('w.yml', good.replace('  contents: read', '  contents: write'))).toEqual([
      'w.yml: workflow permissions must be exactly contents: read',
    ]);
    const jobWide = good.replace(
      '    runs-on: ubuntu-24.04',
      '    runs-on: ubuntu-24.04\n    permissions: write-all',
    );
    expect(checkWorkflow('w.yml', jobWide)).toEqual([
      'w.yml: job a widens permissions beyond contents: read',
    ]);
  });

  it('catches an upload step naming the run directory', () => {
    const upload = `${good}      - uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2
        with:
          path: \${{ runner.temp }}/soorma-conformance-run-abc
`;
    expect(checkWorkflow('w.yml', upload)).toEqual([
      'w.yml: job a uploads ${{ runner.temp }}/soorma-conformance-run-abc: the conformance run directory never leaves the run',
    ]);
  });

  // U2 (NFR-U2-13): .e2e/ never leaves the run; the end-to-end jobs hold no secret.
  it('catches an upload step naming .e2e/', () => {
    const upload = `${good}      - uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2
        with:
          path: .e2e/stack.json
`;
    expect(checkWorkflow('w.yml', upload)).toEqual([
      "w.yml: job a uploads .e2e/stack.json: .e2e/ (the stack's clone and secrets) never leaves the run",
    ]);
  });

  it('catches a repository secret referenced in an end-to-end job, and only there', () => {
    const withSecret = (job: string): string =>
      good
        .replace('  a:\n', `  ${job}:\n`)
        .replace(
          '      - run: echo hi',
          '      - run: echo "$T"\n        env:\n          T: ${{ secrets.TOKEN }}',
        );
    expect(checkWorkflow('w.yml', withSecret('e2e'))).toEqual([
      'w.yml: end-to-end job e2e references a repository secret',
    ]);
    expect(checkWorkflow('w.yml', withSecret('e2e-typescript'))).toEqual([
      'w.yml: end-to-end job e2e-typescript references a repository secret',
    ]);
    expect(checkWorkflow('w.yml', withSecret('changes'))).toEqual([
      'w.yml: end-to-end job changes references a repository secret',
    ]);
    expect(checkWorkflow('w.yml', withSecret('release'))).toEqual([]);
  });
});

describe('OBL-03: the DCO workflow never runs the pull request it judges', () => {
  const dco = `name: DCO
on:
  pull_request_target:
    types: [opened, synchronize, reopened]
permissions:
  contents: read
jobs:
  dco:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@${SHA} # v7.0.1
        with:
          ref: \${{ github.event.pull_request.base.sha }}
          fetch-depth: 0
          persist-credentials: false
      - env:
          PR_NUMBER: \${{ github.event.pull_request.number }}
        run: git fetch --no-tags origin "+refs/pull/\${PR_NUMBER}/head:refs/remotes/pull/head"
      - uses: actions/github-script@${SHA} # v9.0.0
        with:
          script: |
            const { default: run } = await import('\${{ github.workspace }}/tools/dco/action.ts');
            await run({ github, context, core });
`;
  const file = '.github/workflows/dco.yml';

  it('passes the base-only form', () => {
    expect(checkWorkflow(file, dco)).toEqual([]);
  });

  it("passes the repository's own dco.yml", () => {
    const text = readFileSync(resolve(import.meta.dirname, '..', '..', file), 'utf8');
    expect(checkWorkflow(file, text)).toEqual([]);
  });

  it('fails on checking out the pull request head', () => {
    const f = checkWorkflow(
      file,
      dco.replace('pull_request.base.sha }}', 'pull_request.head.sha }}'),
    );
    expect(f).toEqual([
      `${file}: job dco checks out "\${{ github.event.pull_request.head.sha }}": only \${{ github.event.pull_request.base.sha }} may be checked out`,
    ]);
  });

  it('fails on a checkout with the default ref or another repository', () => {
    const noRef = dco.replace(/\n {10}ref: [^\n]+/, '');
    expect(checkWorkflow(file, noRef)).toEqual([
      `${file}: job dco checks out "(the default ref)": only \${{ github.event.pull_request.base.sha }} may be checked out`,
    ]);
    const fork = dco.replace(
      'fetch-depth: 0',
      'fetch-depth: 0\n          repository: ${{ github.event.pull_request.head.repo.full_name }}',
    );
    expect(checkWorkflow(file, fork)).toHaveLength(1);
  });

  it('fails on the pull_request trigger, where the pull request supplies the workflow', () => {
    const f = checkWorkflow(file, dco.replace('pull_request_target:', 'pull_request:'));
    expect(f).toEqual([
      `${file}: triggers on ["pull_request"]: the DCO workflow runs on pull_request_target only (under pull_request the pull request supplies this file)`,
    ]);
  });

  it("fails on putting the pull request's commits in the working tree, or installing", () => {
    const checkout = dco.replace(
      'refs/remotes/pull/head"',
      'refs/remotes/pull/head" && git checkout pull/head',
    );
    expect(checkWorkflow(file, checkout)).toEqual([
      `${file}: job dco runs a git command that puts the pull request's commits in the working tree`,
    ]);
    const install = dco.replace(
      'refs/remotes/pull/head"',
      'refs/remotes/pull/head" && pnpm install',
    );
    expect(checkWorkflow(file, install)).toEqual([
      `${file}: job dco installs or runs packages: nothing from the pull request runs`,
    ]);
  });

  it("fails on loading code from anywhere but the base checkout's tools/", () => {
    const f = checkWorkflow(
      file,
      dco
        .replace('/tools/dco/action.ts', '/../pr/tools/dco/action.ts')
        .replace("import('${{ github.workspace }}/../pr", "import('/tmp/pr"),
    );
    expect(f).toHaveLength(1);
    expect(f[0]).toMatch(/loads ".*": only the base checkout's tools\/ may run$/);
  });

  it('applies to any workflow on pull_request_target, not only dco.yml', () => {
    const other = dco.replace('pull_request.base.sha }}', 'pull_request.head.sha }}');
    expect(checkWorkflow('.github/workflows/other.yml', other)).toHaveLength(1);
  });
});
