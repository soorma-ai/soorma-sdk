// SPDX-License-Identifier: Apache-2.0
//
// fileSecret as the specification states it (SEC-04 to SEC-08): open without
// blocking, following links; check the opened handle; only then read.
import { constants, promises as fs } from 'node:fs';

export class SecretRefusal extends Error {
  readonly path: string;
  readonly reason: string;
  constructor(path: string, reason: string) {
    super(`${path}: ${reason}`);
    this.path = path;
    this.reason = reason;
  }
}

export async function readFileSecret(path: string): Promise<string> {
  let handle: fs.FileHandle;
  try {
    handle = await fs.open(path, constants.O_RDONLY | constants.O_NONBLOCK);
  } catch {
    throw new SecretRefusal(path, 'unreadable');
  }
  try {
    const st = await handle.stat();
    if (!st.isFile()) throw new SecretRefusal(path, 'not-regular-file');
    const uid = process.getuid?.() ?? -1;
    if (st.uid !== uid && st.uid !== 0) throw new SecretRefusal(path, 'owned-by-another-user');
    if (st.mode & 0o004) throw new SecretRefusal(path, 'readable-by-others');
    if (st.mode & 0o020) throw new SecretRefusal(path, 'writable-by-group');
    if (st.mode & 0o002) throw new SecretRefusal(path, 'writable-by-others');
    const text = (await handle.readFile()).toString('utf8');
    return text.endsWith('\r\n')
      ? text.slice(0, -2)
      : text.endsWith('\n')
        ? text.slice(0, -1)
        : text;
  } finally {
    await handle.close();
  }
}
