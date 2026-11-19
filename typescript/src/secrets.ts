// SPDX-License-Identifier: Apache-2.0
//
// Secret providers (C-13; SEC-03 to SEC-09; TH-SEC-01 to 03). fileSecret is the
// one provider shipped; there is no provider that reads an environment
// variable (SEC-03). Each call opens the path without blocking, following
// links to the final file, checks the opened handle, and only then reads
// (CDI-03). A refusal names the path and the reason, never the contents.
import { constants, promises as fs } from 'node:fs';
import { SecretSourceError } from './errors.ts';
import type { SecretProvider } from './types.ts';

/** The checks on the opened handle, in the order U1's reference driver makes them. */
export function refusal(
  st: { isFile(): boolean; mode: number; uid: number },
  uid: number,
): string | undefined {
  if (!st.isFile()) return 'not-regular-file';
  if (st.uid !== uid && st.uid !== 0) return 'owned-by-another-user';
  if (st.mode & 0o004) return 'readable-by-others';
  if (st.mode & 0o020) return 'writable-by-group';
  if (st.mode & 0o002) return 'writable-by-others';
  return undefined;
}

/** The one provider shipped: a secret file, checked before it is read (SEC-04, SEC-05). */
export function fileSecret(path: string): SecretProvider {
  return async () => {
    // SEC-09, defined for TypeScript (TH-SEC-02): Windows has no POSIX modes or
    // owners to check, and a file that cannot be checked is never read.
    if (process.platform === 'win32') throw new SecretSourceError('unsupported-platform', path);
    let handle: fs.FileHandle;
    try {
      handle = await fs.open(path, constants.O_RDONLY | constants.O_NONBLOCK);
    } catch {
      throw new SecretSourceError('unreadable', path);
    }
    try {
      const why = refusal(await handle.stat(), process.getuid?.() ?? -1);
      if (why) throw new SecretSourceError(why, path);
      const text = (await handle.readFile()).toString('utf8');
      // SEC-07: one trailing line ending removed.
      return text.endsWith('\r\n')
        ? text.slice(0, -2)
        : text.endsWith('\n')
          ? text.slice(0, -1)
          : text;
    } catch (error) {
      if (error instanceof SecretSourceError) throw error;
      throw new SecretSourceError('unreadable', path);
    } finally {
      await handle.close();
    }
  };
}
