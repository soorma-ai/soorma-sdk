// SPDX-License-Identifier: Apache-2.0
//
// Child commands (TS-U2-07; GEN-02; GEN-07). No shell: the command and its
// arguments are an array. The environment is built here, never inherited
// wholesale, and no secret is ever an argument or an environment value. Every
// child has a time limit: on expiry its whole process group is sent SIGTERM,
// then SIGKILL after the grace period, and the step fails with one line naming
// it. Output is captured, never streamed: what a caller prints is its decision.
import { spawn } from 'node:child_process';
import { delimiter } from 'node:path';
import { formatLimit } from './stack.ts';

export interface ChildOptions {
  /** The step's name, as the failure line shows it. */
  step: string;
  limitMs: number;
  killGraceMs: number;
  cwd?: string;
  /** PATH for the child; `prependPath` is put first. */
  path: string;
  prependPath?: string;
}

export interface ChildResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

/** A step that failed, carrying the one line to print (GEN-06). */
export class StepFailure extends Error {
  readonly line: string;
  constructor(line: string) {
    super(line);
    this.line = line;
  }
}

/** The only environment variables a child receives. */
const PASSED = [
  'HOME',
  'USER',
  'LOGNAME',
  'TMPDIR',
  'LANG',
  'LC_ALL',
  'PNPM_HOME',
  'DOCKER_HOST',
  'DOCKER_CONFIG',
  'DOCKER_CONTEXT',
];

export function childEnv(options: Pick<ChildOptions, 'path' | 'prependPath'>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const name of PASSED) {
    const value = process.env[name];
    if (value !== undefined) env[name] = value;
  }
  env.PATH = options.prependPath
    ? `${options.prependPath}${delimiter}${options.path}`
    : options.path;
  // CI marks a CI run for soorma-core's own scripts, as on its runner.
  if (process.env.CI !== undefined) env.CI = process.env.CI;
  return env;
}

const live = new Set<number>();
let exitHookInstalled = false;

function killGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal);
  } catch {
    // Already gone.
  }
}

function installExitHook(): void {
  if (exitHookInstalled) return;
  exitHookInstalled = true;
  process.once('exit', () => {
    for (const pid of live) killGroup(pid, 'SIGKILL');
  });
}

/** Runs one child command under its limit. Never throws for a non-zero exit. */
export function runChild(
  command: string,
  args: readonly string[],
  options: ChildOptions,
): Promise<ChildResult> {
  installExitHook();
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: childEnv(options),
      shell: false,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on('data', (b: Buffer) => out.push(b));
    child.stderr.on('data', (b: Buffer) => err.push(b));
    let timedOut = false;
    let killTimer: NodeJS.Timeout | undefined;
    const limitTimer = setTimeout(() => {
      timedOut = true;
      if (child.pid !== undefined) {
        const pid = child.pid;
        killGroup(pid, 'SIGTERM');
        killTimer = setTimeout(() => killGroup(pid, 'SIGKILL'), options.killGraceMs);
      }
    }, options.limitMs);
    if (child.pid !== undefined) live.add(child.pid);
    child.on('error', (error) => {
      clearTimeout(limitTimer);
      if (killTimer) clearTimeout(killTimer);
      if (child.pid !== undefined) live.delete(child.pid);
      reject(
        new StepFailure(
          `${options.step} could not start: ${(error as NodeJS.ErrnoException).code ?? error.message}`,
        ),
      );
    });
    child.on('close', (code, signal) => {
      clearTimeout(limitTimer);
      if (killTimer) clearTimeout(killTimer);
      if (child.pid !== undefined) {
        // The group may still hold grandchildren: none may outlive the step.
        if (timedOut) killGroup(child.pid, 'SIGKILL');
        live.delete(child.pid);
      }
      resolvePromise({
        code,
        signal,
        stdout: Buffer.concat(out).toString('utf8'),
        stderr: Buffer.concat(err).toString('utf8'),
        timedOut,
      });
    });
  });
}

/** The line for a step that ran out of its limit (GEN-07). */
export function timedOutLine(command: string, step: string, limitMs: number): string {
  return `${command}: ${step} timed out after ${formatLimit(limitMs)}`;
}

/**
 * Runs a step that must succeed: a timeout or a non-zero exit throws a
 * StepFailure with one line. `showOutput` adds the output's last lines to a
 * failure; it is set only for steps that run before any stack secret exists.
 */
export async function mustRun(
  command: string,
  file: string,
  args: readonly string[],
  options: ChildOptions & { showOutput?: boolean },
): Promise<ChildResult> {
  const result = await runChild(file, args, options);
  if (result.timedOut) throw new StepFailure(timedOutLine(command, options.step, options.limitMs));
  if (result.code !== 0) {
    let line = `${command}: ${options.step} failed (exit ${result.code ?? result.signal ?? 'unknown'})`;
    if (options.showOutput) {
      const tail = `${result.stdout}\n${result.stderr}`.trim().split('\n').slice(-40).join('\n');
      if (tail) line += `\n${tail}`;
    }
    throw new StepFailure(line);
  }
  return result;
}
