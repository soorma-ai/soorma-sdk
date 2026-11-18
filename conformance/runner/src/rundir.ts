// SPDX-License-Identifier: Apache-2.0
//
// The run directory (P-04): one per run, mode 0700, under the system temporary
// directory with the prefix the workflow check recognises; the CAs and the
// cases' secret files live there and nowhere else; it is removed at the end of
// the run, on success or failure. Heap snapshots, if a driver ever writes one,
// go only inside a case's directory, deleted at the end of the case.
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { JsonObject } from './types.ts';

export const RUN_PREFIX = 'soorma-conformance-run-';

export interface Certs {
  caFile: string;
  serverKey: string;
  serverCert: string;
  untrustedCaFile: string;
  untrustedKey: string;
  untrustedCert: string;
}

export function makeRunDir(): string {
  const dir = mkdtempSync(join(tmpdir(), RUN_PREFIX));
  chmodSync(dir, 0o700);
  return dir;
}

export function removeRunDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

const openssl = (args: string[], cwd: string): void => {
  execFileSync('openssl', args, { cwd, stdio: ['ignore', 'ignore', 'pipe'] });
};

function makeCa(dir: string, name: string): { key: string; cert: string } {
  const key = join(dir, `${name}.key`);
  const cert = join(dir, `${name}.pem`);
  openssl(['ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', key], dir);
  openssl(
    [
      'req',
      '-x509',
      '-new',
      '-key',
      key,
      '-subj',
      `/CN=${name}`,
      '-days',
      '2',
      '-out',
      cert,
      '-addext',
      'basicConstraints=critical,CA:TRUE',
      '-addext',
      'keyUsage=critical,keyCertSign,cRLSign',
    ],
    dir,
  );
  return { key, cert };
}

function makeServer(
  dir: string,
  name: string,
  ca: { key: string; cert: string },
): { key: string; cert: string } {
  const key = join(dir, `${name}.key`);
  const csr = join(dir, `${name}.csr`);
  const cert = join(dir, `${name}.pem`);
  const ext = join(dir, `${name}.ext`);
  writeFileSync(
    ext,
    'subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1\nextendedKeyUsage=serverAuth\nbasicConstraints=critical,CA:FALSE\n',
  );
  openssl(['ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', key], dir);
  openssl(['req', '-new', '-key', key, '-subj', '/CN=localhost', '-out', csr], dir);
  openssl(
    [
      'x509',
      '-req',
      '-in',
      csr,
      '-CA',
      ca.cert,
      '-CAkey',
      ca.key,
      '-set_serial',
      String(Date.now()),
      '-days',
      '2',
      '-extfile',
      ext,
      '-out',
      cert,
    ],
    dir,
  );
  return { key, cert };
}

/** Two CAs: the run CA (trusted by drivers through caFile) and an untrusted one. */
export function makeCerts(runDir: string): Certs {
  const dir = join(runDir, 'tls');
  mkdirSync(dir, { mode: 0o700 });
  const ca = makeCa(dir, 'run-ca');
  const server = makeServer(dir, 'server', ca);
  const other = makeCa(dir, 'untrusted-ca');
  const untrusted = makeServer(dir, 'untrusted-server', other);
  return {
    caFile: ca.cert,
    serverKey: server.key,
    serverCert: server.cert,
    untrustedCaFile: other.cert,
    untrustedKey: untrusted.key,
    untrustedCert: untrusted.cert,
  };
}

export class SetupError extends Error {}

/**
 * Creates a case's files in its own directory. `content` is already resolved.
 * A foreign-owned file needs the CI user helper (`foreignUser`); without it the
 * case fails (never skips), unless the runner was told --local-skip.
 */
export function makeCaseFiles(
  caseDir: string,
  files: JsonObject[],
  opts: { foreignUser?: string | undefined },
): Record<string, string> {
  mkdirSync(caseDir, { mode: 0o700, recursive: true });
  const out: Record<string, string> = {};
  for (const f of files) {
    const name = String(f.name);
    const path = join(caseDir, name);
    const mode = f.mode ? parseInt(String(f.mode), 8) : 0o600;
    switch (f.type) {
      case 'file': {
        writeFileSync(path, String(f.content ?? ''), { mode });
        chmodSync(path, mode);
        if (f.owner === 'foreign') {
          if (!opts.foreignUser)
            throw new SetupError(
              `cannot create the foreign-owned file ${name}: no second user (CI creates one; locally use --local-skip CC-SEC-05)`,
            );
          // Owned by the second user, group the runner's, so the case can read it
          // and SEC-05's owner check (not a permission error) is what refuses it.
          execFileSync(
            'sudo',
            ['-n', 'chown', `${opts.foreignUser}:${process.getgid?.() ?? 0}`, path],
            {
              stdio: 'ignore',
            },
          );
        }
        out[name] = path;
        break;
      }
      case 'fifo':
        execFileSync('mkfifo', ['-m', '600', path]);
        out[name] = path;
        break;
      case 'device':
        out[name] = '/dev/zero';
        break;
      case 'symlink': {
        // A Kubernetes-like chain: name -> ..data/name, ..data -> ..<stamp>/
        const target = out[String(f.target)];
        if (!target) throw new SetupError(`symlink ${name}: unknown target ${String(f.target)}`);
        const stamp = join(caseDir, `..stamp-${name}`);
        mkdirSync(stamp, { mode: 0o755 });
        execFileSync('cp', ['-p', target, join(stamp, name)]);
        symlinkSync(`..stamp-${name}`, join(caseDir, `..data-${name}`));
        let link = join(`..data-${name}`, name);
        for (let k = 1; k < Number(f.chain ?? 2); k++) {
          const hop = join(caseDir, `..hop${k}-${name}`);
          symlinkSync(link, hop);
          link = `..hop${k}-${name}`;
        }
        symlinkSync(link, path);
        out[name] = path;
        break;
      }
      default:
        throw new SetupError(`unknown file type ${String(f.type)}`);
    }
  }
  return out;
}
