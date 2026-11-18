// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { judgeFault } from '../self-test.ts';

const spec = { fault: 'retry-publish', named: 'CC-PUB-03', expected: ['CC-PUB-03', 'CC-PRB-01'] };

describe("the self-test's declared-set rule", () => {
  it('accepts a failed set equal to the declared set', () => {
    expect(judgeFault(spec, ['CC-PRB-01', 'CC-PUB-03'])).toEqual([]);
  });
  it('fails when the named case did not fail', () => {
    expect(judgeFault(spec, ['CC-PRB-01'])).toEqual([
      'retry-publish: its named case CC-PUB-03 did not fail',
      'retry-publish: declared failures that did not happen: CC-PUB-03',
    ]);
  });
  it('fails on a failure outside the declared set', () => {
    expect(judgeFault(spec, ['CC-PRB-01', 'CC-PUB-03', 'CC-SUB-01'])).toEqual([
      'retry-publish: failures outside the declared set: CC-SUB-01',
    ]);
  });
  it('fails when a faulted run passes', () => {
    expect(judgeFault(spec, [])[0]).toContain('did not fail');
  });
});
