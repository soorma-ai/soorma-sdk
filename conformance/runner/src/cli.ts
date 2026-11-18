// SPDX-License-Identifier: Apache-2.0
//
// conformance run --driver "<command>" [--mode full|reference] [--fault NAME]
//                 [--local-skip CC-SEC-05] [--foreign-user NAME] [--budget-ms N]
//                 [--only CC-X,CC-Y] [--report PATH]
// Exit 0 only when the run passes. There is no retry option: any unknown
// option, --retry included, is refused (NFR-U1-05).
import { writeFileSync } from 'node:fs';
import { startStub } from '../../stub/src/stub.ts';
import { runConformance, summarise, type RunOptions } from './run.ts';

const VALUE_FLAGS = new Set([
  '--driver',
  '--mode',
  '--fault',
  '--local-skip',
  '--foreign-user',
  '--budget-ms',
  '--only',
  '--report',
]);

export function parseArgs(
  argv: string[],
): { opts: RunOptions; report?: string } | { error: string } {
  if (argv[0] !== 'run') return { error: 'usage: conformance run --driver "<command>" [options]' };
  const v: Record<string, string> = {};
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i] ?? '';
    if (!VALUE_FLAGS.has(a)) return { error: `unknown option ${a}` };
    const val = argv[++i];
    if (val === undefined) return { error: `${a} needs a value` };
    v[a] = val;
  }
  const driverText = v['--driver'];
  if (!driverText) return { error: '--driver is required' };
  const driver = driverText.startsWith('[')
    ? (JSON.parse(driverText) as string[])
    : driverText.split(/\s+/).filter(Boolean);
  const mode = v['--mode'] ?? 'full';
  if (mode !== 'full' && mode !== 'reference')
    return { error: `--mode is full or reference, not ${mode}` };
  const opts: RunOptions = { driver, mode };
  if (v['--fault']) opts.fault = v['--fault'];
  if (v['--local-skip']) opts.localSkip = v['--local-skip'].split(',');
  if (v['--foreign-user']) opts.foreignUser = v['--foreign-user'];
  if (v['--budget-ms']) opts.budgetMs = Number(v['--budget-ms']);
  if (v['--only']) opts.only = v['--only'].split(',');
  return v['--report'] ? { opts, report: v['--report'] } : { opts };
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  if ('error' in parsed) {
    console.error(parsed.error);
    process.exitCode = 2;
    return;
  }
  const report = await runConformance(parsed.opts, startStub);
  console.log(summarise(report));
  if (parsed.report) writeFileSync(parsed.report, `${JSON.stringify(report, null, 2)}\n`);
  if (!report.ok) process.exitCode = 1;
}

if (import.meta.main) await main();
