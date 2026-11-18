// SPDX-License-Identifier: Apache-2.0
//
// The scheduler (P-01, P-02, P-07; NFR-U1-01 to -09, -15, -16). One case at a
// time, a new driver process per case, a timeout per case, a watchdog at twice
// the budget; the run finishes, then fails if it went over budget, naming the
// slowest cases. No retry exists. Modes: full (every case must pass; a skip is
// a failure), reference (the driver's declared cases), and a fault (the
// reference driver with one rule broken; the self-test judges its failed set).
import { randomBytes } from 'node:crypto';
import { join, resolve as resolvePath } from 'node:path';
import { inCI } from '../../../tools/lib/ci.ts';
import { loadCases, type Case } from './cases.ts';
import { DriverProcess } from './driver-host.ts';
import { evaluate, type Evidence, type Observation } from './evaluate.ts';
import { linkFailures, unknownFixtures, unreferencedFixtures } from './links.ts';
import { summarise, type CaseResult, type Report } from './report.ts';
import {
  makeCaseFiles,
  makeCerts,
  makeRunDir,
  removeRunDir,
  SetupError,
  type Certs,
} from './rundir.ts';
import { loadStatements, type Statement } from './spec.ts';
import { resolve } from './template.ts';
import type { Json, JsonObject, StubControl, TemplateContext, Values } from './types.ts';

export const FULL_BUDGET_MS = 5 * 60_000;
export const LOCAL_SKIPPABLE = new Set(['CC-SEC-05']);

export interface RunOptions {
  driver: string[];
  mode: 'full' | 'reference';
  fault?: string | undefined;
  localSkip?: string[];
  foreignUser?: string | undefined;
  budgetMs?: number;
  only?: string[];
  env?: NodeJS.ProcessEnv;
  casesDir?: string;
  specPath?: string;
  /** Check that every agent-side fixture is used (always on in real runs). */
  fixtureCoverage?: boolean;
}

export type StubFactory = (certs: Certs) => Promise<StubControl>;

export interface Describe {
  language?: string;
  values?: Values;
  depthBound?: number;
  coverage?: string[];
  faults?: string[];
}

export function guardFlags(opts: RunOptions): string[] {
  const env = opts.env ?? process.env;
  const out: string[] = [];
  for (const id of opts.localSkip ?? []) {
    if (!LOCAL_SKIPPABLE.has(id)) out.push(`--local-skip accepts only CC-SEC-05, not ${id}`);
    else if (inCI(env)) out.push('--local-skip is refused in CI: CC-SEC-05 always runs there');
  }
  if (opts.fault && opts.mode !== 'reference') out.push('--fault runs only in reference mode');
  return out;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function driverCommand(opts: RunOptions): string[] {
  return opts.fault ? [...opts.driver, '--fault', opts.fault] : opts.driver;
}

async function describeDriver(opts: RunOptions): Promise<Describe> {
  const d = new DriverProcess(driverCommand(opts), opts.env);
  try {
    const r = await d.send('describe', {}, 15_000);
    if (!r.ok) throw new Error(`describe failed: ${JSON.stringify(r.error ?? {})}`);
    return (r.result ?? {}) as Describe;
  } finally {
    await d.stop();
  }
}

async function runCase(
  c: Case,
  opts: RunOptions,
  info: Describe,
  stub: StubControl,
  certs: Certs,
  runDir: string,
  hardDeadline: number,
): Promise<CaseResult> {
  const started = Date.now();
  const result = (
    status: CaseResult['status'],
    failures: string[] = [],
    reason?: string,
  ): CaseResult => ({
    id: c.id,
    statements: c.statements,
    status,
    failures,
    durationMs: Date.now() - started,
    ...(reason ? { reason } : {}),
  });
  if (opts.localSkip?.includes(c.id)) {
    return result(
      'not-run',
      [],
      'skipped locally with --local-skip (it requires a second local user; CI always runs it)',
    );
  }
  const secret = randomBytes(36).toString('base64url');
  const caseDir = join(runDir, `case-${c.id}`);
  const ctx: TemplateContext = {
    urls: stub.urls,
    caFile: certs.caFile,
    secretBase64: Buffer.from(secret, 'utf8').toString('base64'),
    secret,
    files: {},
    values: { ...(info.values ?? {}), ...(c.values ?? {}) },
    depthBound: info.depthBound ?? 0,
    start: Date.now(),
  };
  try {
    const files = (c.setup?.files ?? []).map((f) => resolve(f, ctx) as JsonObject);
    ctx.files = makeCaseFiles(caseDir, files, { foreignUser: opts.foreignUser });
  } catch (error) {
    return result('fail', [
      error instanceof SetupError ? error.message : `set-up failed: ${(error as Error).message}`,
    ]);
  } finally {
    // the run directory itself is removed at the end of the run
  }
  ctx.start = Date.now();
  stub.load(
    {
      ...(c.script.listeners ? { listeners: c.script.listeners } : {}),
      exchanges: resolve(c.script.exchanges as Json, ctx) as JsonObject[],
    },
    ctx,
  );
  const driver = new DriverProcess(driverCommand(opts), opts.env);
  const observations: Observation[] = [];
  const items: JsonObject[] = [];
  const deadline = Math.min(ctx.start + c.timeoutMs, hardDeadline);
  let timedOut: string | undefined;
  try {
    for (const cmd of c.commands) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        timedOut = `the case timed out before ${cmd.op}${cmd.label ? ` (${cmd.label})` : ''}`;
        break;
      }
      const args = resolve((cmd.args ?? {}) as Json, ctx) as JsonObject;
      if (cmd.op === 'wait') {
        await sleep(Math.min(Number(args.ms ?? 0), remaining));
        continue;
      }
      if (cmd.op === 'waitForRequest') {
        const until = Math.min(Date.now() + Number(args.timeoutMs ?? remaining), deadline);
        const m = (args.match ?? {}) as JsonObject;
        const want = Number(args.count ?? 1);
        while (Date.now() < until) {
          const n = stub
            .recording()
            .filter(
              (r) =>
                (m.listener === undefined || r.listener === m.listener) &&
                (m.method === undefined || r.method === m.method) &&
                (m.path === undefined || r.path === m.path) &&
                (m.label === undefined || r.label === m.label),
            ).length;
          if (n >= want) break;
          await sleep(25);
        }
        continue;
      }
      if (
        cmd.op === 'create' &&
        args.secret &&
        typeof args.secret === 'object' &&
        !Array.isArray(args.secret)
      ) {
        const s = args.secret as JsonObject;
        if (s.kind === 'test') args.secret = { kind: 'test', bytes: ctx.secretBase64 };
      }
      const r = await driver.send(
        cmd.op,
        args,
        Math.min(Number(args.timeoutMs ?? remaining) + 1000, remaining),
      );
      if (r.error?.type === 'Timeout') {
        timedOut = `the driver did not answer ${cmd.op}${cmd.label ? ` (${cmd.label})` : ''} in time`;
        break;
      }
      if (r.error?.type === 'DriverExited') {
        timedOut = `the driver exited during ${cmd.op}${cmd.label ? ` (${cmd.label})` : ''}`;
        break;
      }
      const o: Observation = {
        op: cmd.op,
        ok: r.ok,
        at: Date.now(),
        ...(cmd.label ? { label: cmd.label } : {}),
      };
      if (r.result) o.result = r.result;
      if (r.error) o.error = r.error;
      observations.push(o);
      if (cmd.op === 'next' && r.ok && r.result && r.result.timeout !== true) items.push(r.result);
    }
  } finally {
    await driver.stop();
  }
  const ev: Evidence = {
    observations,
    items,
    recording: stub.recording(),
    streams: stub.streams(),
    deliveries: stub.deliveries(),
    concurrentStreamsMax: stub.concurrentStreamsMax(),
    stderr: driver.stderr,
    secrets: [secret],
  };
  const failures: string[] = [];
  if (timedOut) failures.push(timedOut);
  if (driver.protocolError) failures.push(driver.protocolError);
  failures.push(
    ...evaluate(c, resolve(c.expect as Json, ctx) as (JsonObject & { kind: string })[], ev),
  );
  return result(failures.length === 0 ? 'pass' : 'fail', failures);
}

export interface Loaded {
  statements: Statement[];
  cases: Case[];
  problems: string[];
}

export function loadAll(
  opts: Pick<RunOptions, 'casesDir' | 'specPath' | 'fixtureCoverage'>,
  defaults: Values = {},
): Loaded {
  const spec =
    opts.specPath ?? resolvePath(import.meta.dirname, '..', '..', '..', 'spec', 'behaviour.md');
  const statements = loadStatements(spec);
  const { cases, errors } = loadCases(opts.casesDir, defaults);
  const problems = [
    ...errors,
    ...linkFailures(statements, cases),
    ...unknownFixtures(cases),
    ...(opts.fixtureCoverage === false
      ? []
      : unreferencedFixtures(cases).map((f) => `fixture ${f} is used by no case`)),
  ];
  return { statements, cases, problems };
}

export async function runConformance(opts: RunOptions, makeStub: StubFactory): Promise<Report> {
  const started = Date.now();
  const budgetMs = opts.budgetMs ?? FULL_BUDGET_MS;
  const base: Report = {
    mode: opts.mode,
    ...(opts.fault ? { fault: opts.fault } : {}),
    ok: false,
    problems: guardFlags(opts),
    results: [],
    failed: [],
    durationMs: 0,
    budgetMs,
    overBudget: false,
    slowest: [],
  };
  if (base.problems.length > 0) return base;
  const info = await describeDriver(opts);
  if (info.language) base.language = info.language;
  const loaded = loadAll(opts, info.values ?? {});
  base.problems.push(...loaded.problems);
  if (base.problems.length > 0) return { ...base, durationMs: Date.now() - started };

  let selected = loaded.cases;
  if (opts.mode === 'reference') {
    const coverage = new Set(info.coverage ?? []);
    selected = loaded.cases.filter((c) => coverage.has(c.id));
  }
  if (opts.only) selected = selected.filter((c) => opts.only?.includes(c.id));
  const notRun = loaded.cases.filter((c) => !selected.includes(c));

  const runDir = makeRunDir();
  let stub: StubControl | undefined;
  const hardDeadline = started + 2 * budgetMs;
  let watchdogFired = false;
  const watchdog = setTimeout(() => (watchdogFired = true), 2 * budgetMs);
  try {
    const certs = makeCerts(runDir);
    stub = await makeStub(certs);
    for (const c of selected) {
      if (watchdogFired) {
        base.results.push({
          id: c.id,
          statements: c.statements,
          status: 'not-run',
          failures: [],
          durationMs: 0,
          reason: 'the watchdog stopped the run',
        });
        continue;
      }
      base.results.push(await runCase(c, opts, info, stub, certs, runDir, hardDeadline));
    }
  } finally {
    clearTimeout(watchdog);
    await stub?.stop();
    removeRunDir(runDir);
  }
  for (const c of notRun)
    base.results.push({
      id: c.id,
      statements: c.statements,
      status: 'not-run',
      failures: [],
      durationMs: 0,
    });
  base.durationMs = Date.now() - started;
  base.failed = base.results.filter((r) => r.status === 'fail').map((r) => r.id);
  base.overBudget = base.durationMs > budgetMs;
  base.slowest = [...base.results]
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 5)
    .map((r) => ({ id: r.id, durationMs: r.durationMs }));
  if (watchdogFired)
    base.problems.push(`the watchdog stopped the run at ${Math.round((2 * budgetMs) / 1000)} s`);
  const skipped = base.results.filter((r) => r.status === 'not-run');
  const skipsFail = opts.mode === 'full' && skipped.some((r) => !opts.localSkip?.includes(r.id));
  base.ok =
    base.failed.length === 0 &&
    !base.overBudget &&
    !watchdogFired &&
    !skipsFail &&
    base.problems.length === 0;
  if (skipsFail) base.problems.push(`full mode: ${skipped.length} case(s) not run`);
  return base;
}

export { summarise };
