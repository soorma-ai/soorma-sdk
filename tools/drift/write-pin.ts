// SPDX-License-Identifier: Apache-2.0
//
// Writes contract.pin.json from the vendored contract/ and the tag. Used only
// when the contract is re-vendored at a new tag (a recorded change); never to
// make the drift check pass.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { git } from '../lib/git.ts';
import { hashTree, type Pin } from './pin.ts';

const [repository, tag, commit, tree] = process.argv.slice(2);
if (!repository || !tag || !commit || !tree) {
  console.error('usage: write-pin.ts <repository-url> <tag> <commit> <contract-tree-id>');
  process.exit(2);
}
const peeled = git(['ls-remote', repository, `refs/tags/${tag}^{}`]).split(/\s+/)[0];
if (peeled !== commit) {
  console.error(`${tag} peels to ${peeled}, not ${commit}`);
  process.exit(1);
}
const root = resolve(import.meta.dirname, '..', '..');
const pin: Pin = {
  repository,
  tag,
  commit,
  tree,
  files: hashTree(root, resolve(root, 'contract')),
};
writeFileSync(resolve(root, 'contract.pin.json'), `${JSON.stringify(pin, null, 2)}\n`);
console.log(`contract.pin.json: ${Object.keys(pin.files).length} files`);
