// SPDX-License-Identifier: Apache-2.0
//
// One driver process, spoken to in JSON lines (business-logic-model §3). A new
// process per case (P-01): nothing a case leaves behind can reach the next.
// The driver writes only protocol lines to stdout; stderr is kept for the
// absence checks and the report (never printed when it may hold a secret).
import { spawn, type ChildProcess } from 'node:child_process';
import type { JsonObject } from './types.ts';

export interface Reply {
  id: number;
  ok: boolean;
  result?: JsonObject;
  error?: JsonObject;
}

export class DriverProcess {
  private readonly child: ChildProcess;
  private readonly waiting = new Map<number, (r: Reply) => void>();
  private buffer = '';
  private next = 1;
  private exited = false;
  stderr = '';
  protocolError: string | undefined;

  constructor(command: string[], env: NodeJS.ProcessEnv = process.env) {
    const [cmd = '', ...args] = command;
    this.child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'], env });
    this.child.stdout?.setEncoding('utf8');
    this.child.stderr?.setEncoding('utf8');
    this.child.stdout?.on('data', (chunk: string) => this.onData(chunk));
    this.child.stderr?.on('data', (chunk: string) => (this.stderr += chunk));
    this.child.on('exit', () => {
      this.exited = true;
      for (const [id, resolve] of this.waiting)
        resolve({ id, ok: false, error: { type: 'DriverExited' } });
      this.waiting.clear();
    });
    this.child.on(
      'error',
      (e) => (this.protocolError = `could not start the driver: ${e.message}`),
    );
  }

  get pid(): number | undefined {
    return this.child.pid;
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    let at: number;
    while ((at = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, at);
      this.buffer = this.buffer.slice(at + 1);
      if (line.trim() === '') continue;
      let reply: Reply;
      try {
        reply = JSON.parse(line) as Reply;
      } catch {
        this.protocolError = 'the driver wrote a line that is not JSON';
        continue;
      }
      const resolve = this.waiting.get(reply.id);
      if (resolve) {
        this.waiting.delete(reply.id);
        resolve(reply);
      }
    }
  }

  send(op: string, args: JsonObject = {}, timeoutMs = 30_000): Promise<Reply> {
    if (this.exited) return Promise.resolve({ id: 0, ok: false, error: { type: 'DriverExited' } });
    const id = this.next++;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.waiting.delete(id);
        resolve({ id, ok: false, error: { type: 'Timeout', op } });
      }, timeoutMs);
      this.waiting.set(id, (r) => {
        clearTimeout(timer);
        resolve(r);
      });
      this.child.stdin?.write(`${JSON.stringify({ id, op, args })}\n`);
    });
  }

  async stop(graceMs = 2000): Promise<void> {
    if (this.exited) return;
    this.child.stdin?.end();
    await new Promise<void>((done) => {
      const t = setTimeout(() => {
        this.child.kill('SIGKILL');
        done();
      }, graceMs);
      this.child.once('exit', () => {
        clearTimeout(t);
        done();
      });
    });
  }
}
