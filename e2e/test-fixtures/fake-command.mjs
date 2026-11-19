#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// A fake `docker` or `git` for the end-to-end commands' tests (TS-U2-09). A
// test copies this file into a temporary bin directory as `docker` or `git`,
// first on PATH, beside a scenario `<name>.json`:
//   { "rules": [ { "args": [...], "stdout": "...", "stderr": "...",
//                  "code": 0, "hang": false, "writeFiles": { "path": "text" } } ],
//     "default": { "code": 0 } }
// The first rule whose `args` equal the invocation's arguments answers; with
// `prefix: true`, the rule's args need only start the invocation's. Every
// invocation is appended to `<name>.log` as one JSON line: its arguments, its
// working directory and the names of its environment variables (never their
// values), so a test can assert what was run and that no secret was passed.
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import process from 'node:process';
import { setInterval } from 'node:timers';

const self = process.argv[1] ?? '';
const name = basename(self);
const dir = dirname(self);
const args = process.argv.slice(2);

appendFileSync(
  join(dir, `${name}.log`),
  `${JSON.stringify({ args, cwd: process.cwd(), env: Object.keys(process.env).sort() })}\n`,
);

let scenario = { rules: [], default: { code: 0 } };
try {
  scenario = JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8'));
} catch {
  // No scenario: every invocation succeeds with no output.
}

const matches = (rule) =>
  rule.prefix
    ? rule.args.every((a, i) => args[i] === a)
    : rule.args.length === args.length && rule.args.every((a, i) => args[i] === a);

const rule = (scenario.rules ?? []).find(matches) ?? scenario.default ?? { code: 0 };

for (const [file, text] of Object.entries(rule.writeFiles ?? {})) {
  const target = file.startsWith('/') ? file : join(process.cwd(), file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
}
if (rule.stdout) process.stdout.write(rule.stdout);
if (rule.stderr) process.stderr.write(rule.stderr);
if (rule.hang) {
  if (rule.ignoreTerm) process.on('SIGTERM', () => {});
  setInterval(() => {}, 1000);
} else {
  process.exitCode = rule.code ?? 0;
}
