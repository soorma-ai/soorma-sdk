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

/** U1's approved catalogue: the 90 case ids, fixed here, never read from the directory. */
const U1_CASES = [
  'CC-ACQ-01',
  'CC-ACQ-02',
  'CC-ACQ-03',
  'CC-ACQ-04',
  'CC-ACQ-05',
  'CC-ACQ-06',
  'CC-ACQ-07',
  'CC-CFG-01',
  'CC-CFG-02',
  'CC-CFG-03',
  'CC-CFG-04',
  'CC-CFG-05',
  'CC-CFG-06',
  'CC-CFG-07',
  'CC-CRD-01',
  'CC-CRD-02',
  'CC-CRD-03',
  'CC-DRF-01',
  'CC-FWD-01',
  'CC-FWD-02',
  'CC-FWD-03',
  'CC-FWD-04',
  'CC-FWD-05',
  'CC-FWD-06',
  'CC-FWD-07',
  'CC-NAM-01',
  'CC-NEV-01',
  'CC-NEV-02',
  'CC-NEV-03',
  'CC-PRB-01',
  'CC-PRB-02',
  'CC-PRB-03',
  'CC-PRB-04',
  'CC-PRB-05',
  'CC-PRB-06',
  'CC-PRB-07',
  'CC-PRB-08',
  'CC-PUB-01',
  'CC-PUB-02',
  'CC-PUB-03',
  'CC-PUB-04',
  'CC-RCV-01',
  'CC-RCV-02',
  'CC-RCV-03',
  'CC-RCV-04',
  'CC-RCV-05',
  'CC-RCV-06',
  'CC-RCV-07',
  'CC-RCV-08',
  'CC-REN-01',
  'CC-REN-02',
  'CC-REN-03',
  'CC-REN-04',
  'CC-REN-05',
  'CC-SEC-01',
  'CC-SEC-02',
  'CC-SEC-03',
  'CC-SEC-04',
  'CC-SEC-05',
  'CC-SEC-06',
  'CC-SEC-07',
  'CC-SEC-08',
  'CC-SPN-01',
  'CC-SPN-02',
  'CC-SPN-03',
  'CC-SPN-04',
  'CC-SPN-05',
  'CC-SPN-06',
  'CC-SPN-07',
  'CC-SPN-08',
  'CC-STR-01',
  'CC-STR-02',
  'CC-STR-03',
  'CC-STR-04',
  'CC-STR-05',
  'CC-STR-06',
  'CC-STR-07',
  'CC-STR-08',
  'CC-STR-09',
  'CC-STR-10',
  'CC-STR-11',
  'CC-SUB-01',
  'CC-SUB-02',
  'CC-SUB-03',
  'CC-SUB-04',
  'CC-SUB-05',
  'CC-SUB-06',
  'CC-SUB-07',
  'CC-TRC-01',
  'CC-TRC-02',
];

/** Added at U3 (REN-07, SEC-01 reworded, the STR-02 and STR-05 sentences). */
const U3_CASES = ['CC-ACQ-08', 'CC-REN-06', 'CC-REN-07', 'CC-STR-12', 'CC-STR-13'];

describe('conformance/cases', () => {
  const loaded = loadAll({}, values);

  // Changed at U3 (class 3, approved by the user 2026-11-19T07:09:13Z): it read
  // 'holds the 90 cases of the approved catalogue, with no problem' and checked
  // only the count. A count alone would pass if one case were deleted and
  // another added, so every original id is checked too.
  it("holds U1's 90 cases and the 5 added at U3, with no problem", () => {
    expect(loaded.problems).toEqual([]);
    expect(loaded.cases).toHaveLength(95);
    const ids = new Set(loaded.cases.map((c) => c.id));
    expect(U1_CASES).toHaveLength(90);
    for (const id of U1_CASES) expect(ids.has(id), id).toBe(true);
    for (const id of U3_CASES) expect(ids.has(id), id).toBe(true);
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
