// SPDX-License-Identifier: Apache-2.0
//
// The real case set (US-14 #1, #3; US-13 #2): every case file is valid,
// language-neutral data; every statement and case name each other; every
// agent-side contract fixture is used. Checked with representative SDK values;
// the runner checks again with each driver's own values.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadAll } from '../run.ts';

const values = {
  H_renew: 60000,
  R_max: 5,
  W_max: 30000,
  B_init: 500,
  B_factor: 2,
  B_cap: 10000,
  L_ends: 5,
  W_super: 5000,
  N_buf: 64,
  T_idle: 45000,
  T_req: 10000,
};

describe('conformance/cases', () => {
  const loaded = loadAll({}, values);

  it('holds the 90 cases of the approved catalogue, with no problem', () => {
    expect(loaded.problems).toEqual([]);
    expect(loaded.cases).toHaveLength(90);
  });

  it('is data, not code', () => {
    for (const c of loaded.cases) {
      const text = readFileSync(c.file, 'utf8');
      expect(text).not.toMatch(/\b(function|=>|import |require\(|def |lambda)\b/);
    }
  });

  it("marks the four negative controls' named cases", () => {
    const ids = new Set(loaded.cases.map((c) => c.id));
    for (const id of ['CC-SEC-01', 'CC-FWD-02', 'CC-PUB-03', 'CC-STR-04'])
      expect(ids.has(id)).toBe(true);
  });
});
