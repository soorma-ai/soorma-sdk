// SPDX-License-Identifier: Apache-2.0
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadStatements, parseStatements } from './spec.ts';

const SPEC = join(import.meta.dirname, '..', '..', '..', 'spec', 'behaviour.md');

describe('spec/behaviour.md', () => {
  const statements = loadStatements(SPEC);

  it('holds the 103 statements of the approved design, in 16 areas', () => {
    expect(statements).toHaveLength(103);
    expect(new Set(statements.map((s) => s.area)).size).toBe(16);
  });

  it('names cases for every statement but the stated exemptions', () => {
    const exempt = statements.filter((s) => s.cases.length === 0).map((s) => s.id);
    expect(exempt.sort()).toEqual(['NEV-05', 'SEC-09']);
    for (const s of statements.filter((x) => x.cases.length === 0))
      expect(s.exemption).toBeTruthy();
  });

  it('records the US-Q1 decision and the documentation statements U3 and U4 carry', () => {
    const byId = new Map(statements.map((s) => [s.id, s]));
    expect(byId.get('SPN-03')?.text).toContain('children of the received context');
    expect(byId.get('SUB-03')?.text).toContain(
      'a Delivery may be delivered twice around a stream boundary; nothing identifies a duplicate (GAP-INT-001)',
    );
    expect(byId.get('SPN-06')?.text).toContain('one trace follows the event across hops');
  });
});

describe('parseStatements', () => {
  it('reads the id, the cases, and an exemption', () => {
    const md = [
      '| Id | Statement | Source | Cases |',
      '|---|---|---|---|',
      '| ABC-01 | Does a thing | FR-1 | CC-ABC-01, CC-ABC-02 |',
      '| ABC-02 | Checked elsewhere | FR-2 | (U3, U4) |',
    ].join('\n');
    expect(parseStatements(md)).toEqual([
      {
        id: 'ABC-01',
        area: 'ABC',
        text: 'Does a thing',
        sources: 'FR-1',
        cases: ['CC-ABC-01', 'CC-ABC-02'],
      },
      {
        id: 'ABC-02',
        area: 'ABC',
        text: 'Checked elsewhere',
        sources: 'FR-2',
        cases: [],
        exemption: 'U3, U4',
      },
    ]);
  });

  it('refuses a statement defined twice', () => {
    const row = '| ABC-01 | x | y | CC-ABC-01 |';
    expect(() => parseStatements(`${row}\n${row}`)).toThrow('defined twice');
  });
});
