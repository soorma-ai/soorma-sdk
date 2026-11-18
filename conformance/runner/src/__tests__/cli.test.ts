// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { parseArgs } from '../cli.ts';

describe('the command line', () => {
  it('parses a run', () => {
    expect(
      parseArgs([
        'run',
        '--driver',
        'node d.ts --x',
        '--mode',
        'reference',
        '--fault',
        'retry-publish',
      ]),
    ).toEqual({
      opts: { driver: ['node', 'd.ts', '--x'], mode: 'reference', fault: 'retry-publish' },
    });
  });
  it('refuses any unknown option, --retry included (no retry exists)', () => {
    expect(parseArgs(['run', '--driver', 'd', '--retry', '1'])).toEqual({
      error: 'unknown option --retry',
    });
  });
});
