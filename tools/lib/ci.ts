// SPDX-License-Identifier: Apache-2.0
//
// Detecting CI, to refuse local-only flags there (P-07). These indicators are
// read for detection only: no value from them changes what a check does except
// the refusal.
export function inCI(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.GITHUB_ACTIONS === 'true' || env.CI === 'true' || env.CI === '1';
}
