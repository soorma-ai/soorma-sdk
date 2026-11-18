// SPDX-License-Identifier: Apache-2.0
//
// The small part of semver the repository checks need: release versions
// (x.y.z) and ranges made of space-separated comparators (<, <=, >, >=, =).
// Pre-releases never satisfy a range and are never treated as fixes.

export type Version = readonly [number, number, number];

export function parseRelease(text: string): Version | undefined {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(text.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : undefined;
}

export function compare(a: Version, b: Version): number {
  for (let i = 0; i < 3; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** True when `version` (a release) satisfies every comparator in `range`. */
export function satisfies(version: string, range: string): boolean {
  const v = parseRelease(version);
  if (!v) return false;
  const parts = range.trim().split(/\s+/);
  if (parts.length === 0 || parts[0] === '') throw new Error(`empty range`);
  return parts.every((part) => {
    const m = /^(<=|>=|<|>|=)?(\d+\.\d+\.\d+)$/.exec(part);
    const bound = m ? parseRelease(m[2] ?? '') : undefined;
    if (!m || !bound) throw new Error(`unsupported range: ${range}`);
    const c = compare(v, bound);
    switch (m[1] ?? '=') {
      case '<':
        return c < 0;
      case '<=':
        return c <= 0;
      case '>':
        return c > 0;
      case '>=':
        return c >= 0;
      default:
        return c === 0;
    }
  });
}
