// SPDX-License-Identifier: Apache-2.0
//
// The names check (FR-17; US-13 #3). Each language's exported names and
// settable members (from its conformance driver's `names` and `surface`
// commands) must equal that language's column of the name table
// (spec/names.md): an export not in the table, or a table name not exported,
// fails, naming it. Protocol idioms (iteration, disposal, JSON form) are accepted.
// Inert until a driver is listed in drivers.json (U3, U4).
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const IDIOMS = new Set([
  'Symbol.asyncIterator',
  'Symbol.asyncDispose',
  '__aiter__',
  '__anext__',
  '__aenter__',
  '__aexit__',
  // JSON.stringify's hook for an object's JSON form (every TypeScript error has one).
  'toJSON',
]);

const IDENT = /^[A-Za-z_$][\w$]*$/;

/** The names in one language's column of every table in the name table. */
export function namesFromTable(markdown: string, language: string): Set<string> {
  const names = new Set<string>();
  let column = -1;
  for (const line of markdown.split('\n')) {
    if (!line.startsWith('|')) {
      column = -1;
      continue;
    }
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    if (column === -1) {
      column = cells.indexOf(language);
      continue;
    }
    if (cells.every((c) => /^-+$/.test(c))) continue;
    // The package row names a distribution, not an export.
    if (cells[0] === 'package') continue;
    for (const m of (cells[column] ?? '').matchAll(/`([^`]+)`/g)) {
      const token = m[1] ?? '';
      if (IDENT.test(token)) names.add(token);
    }
  }
  return names;
}

export function compareNames(
  expected: Set<string>,
  exported: string[],
  language: string,
): string[] {
  const got = new Set(exported.filter((n) => !IDIOMS.has(n)));
  const failures: string[] = [];
  for (const n of got)
    if (!expected.has(n)) failures.push(`${language}: ${n} is exported but not in the name table`);
  for (const n of expected)
    if (!got.has(n)) failures.push(`${language}: ${n} is in the name table but not exported`);
  return failures;
}

export interface NamedDriver {
  language: string;
  command: string[];
}

/** Asks a driver for its exported names and settable members over the protocol. */
export function readDriverNames(command: string[], timeoutMs = 30_000): Promise<string[]> {
  return new Promise((done, fail) => {
    const [cmd = '', ...args] = command;
    const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'inherit'] });
    const timer = setTimeout(() => {
      child.kill();
      fail(new Error('driver timed out'));
    }, timeoutMs);
    let buffer = '';
    const results: Record<number, unknown> = {};
    child.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      let at: number;
      while ((at = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, at);
        buffer = buffer.slice(at + 1);
        const o = JSON.parse(line) as { id: number; ok: boolean; result?: unknown };
        results[o.id] = o.result;
        if (1 in results && 2 in results) {
          clearTimeout(timer);
          child.stdin.end();
          const names = (results[1] as { names?: string[] }).names ?? [];
          const members = (results[2] as { members?: string[] }).members ?? [];
          done([...names, ...members]);
        }
      }
    });
    child.on('error', fail);
    child.stdin.write(`${JSON.stringify({ id: 1, op: 'names', args: {} })}\n`);
    child.stdin.write(`${JSON.stringify({ id: 2, op: 'surface', args: {} })}\n`);
  });
}

export async function runNames(root: string): Promise<{ failures: string[]; checked: number }> {
  const drivers = JSON.parse(
    readFileSync(resolve(import.meta.dirname, 'drivers.json'), 'utf8'),
  ) as NamedDriver[];
  const table = resolve(root, 'spec', 'names.md');
  if (drivers.length === 0) return { failures: [], checked: 0 };
  if (!existsSync(table)) return { failures: ['spec/names.md does not exist'], checked: 0 };
  const md = readFileSync(table, 'utf8');
  const failures: string[] = [];
  for (const d of drivers) {
    try {
      failures.push(
        ...compareNames(
          namesFromTable(md, d.language),
          await readDriverNames(d.command),
          d.language,
        ),
      );
    } catch (error) {
      failures.push(
        `${d.language}: could not read the driver's names (${(error as Error).message})`,
      );
    }
  }
  return { failures, checked: drivers.length };
}

if (import.meta.main) {
  const { failures, checked } = await runNames(resolve(import.meta.dirname, '..', '..'));
  for (const f of failures) console.error(`FAIL ${f}`);
  if (failures.length > 0) process.exitCode = 1;
  else
    console.log(
      checked === 0
        ? 'names: no driver yet (inert until U3)'
        : `names: ${checked} language(s) match the name table`,
    );
}
