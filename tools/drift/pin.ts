// SPDX-License-Identifier: Apache-2.0
//
// contract.pin.json: the tag, its peeled commit, the git tree id of contract/
// at that commit, and the SHA-256 of every vendored file. It sits beside
// contract.md, outside contract/, so the copy stays byte-identical to the tag.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export interface Pin {
  repository: string;
  tag: string;
  commit: string;
  tree: string;
  files: Record<string, string>;
}

export const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

/** Every file under `dir`, as a map from its path relative to `root` (forward slashes) to its SHA-256. */
export function hashTree(root: string, dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string): void => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.isFile())
        out[relative(root, p).split(sep).join('/')] = sha256(readFileSync(p));
    }
  };
  walk(dir);
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)));
}
