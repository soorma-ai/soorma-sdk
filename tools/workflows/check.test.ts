// SPDX-License-Identifier: Apache-2.0
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
});
