// SPDX-License-Identifier: Apache-2.0
//
// core-down [--logs] (business-rules CD-01 to CD-07; business-logic-model §5).
// Acts only on a stack core-up started (the ownership record). Always searches
// soorma-core's logs first, while the containers exist (LS-11, CD-02): a hit or
// an unreadable source fails the command, on a green run too; --logs only
// decides whether clean logs are printed. Then down -v, whatever the search
// found (CD-05), then removes what the run wrote, the ownership record last.
// A teardown that fails or times out keeps the record and the clone, so it can
// be run again and core-up keeps refusing (CD-07).
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { runChild, timedOutLine } from './child.ts';
import { decide, fails, report } from './log-search.ts';
import { gatherSources } from './log-sources.ts';
import { CLONE, layout, readPin, STACK, type Limits } from './stack.ts';

export interface CoreDownOptions {
  repositoryRoot: string;
  root: string;
  /** Print clean logs (CI passes it on a failed or cancelled job). */
  logs: boolean;
  limits: Limits;
  path: string;
  print: (line: string) => void;
}

const COMMAND = 'core-down';

/** The secret files a run wrote: listed in the stack description, or in the default directory. */
function secretFiles(o: CoreDownOptions): string[] {
  const l = layout(o.root);
  const files = new Set<string>();
  try {
    const d = JSON.parse(readFileSync(l.stack, 'utf8')) as { agents?: { secretFile?: unknown }[] };
    for (const a of d.agents ?? []) if (typeof a.secretFile === 'string') files.add(a.secretFile);
  } catch {
    // No description: setup did not finish. The default directory is still removed.
  }
  try {
    for (const n of readdirSync(l.secrets))
      if (n.endsWith('.secret')) files.add(join(l.secrets, n));
  } catch {
    // No default directory.
  }
  return [...files];
}

export async function coreDown(o: CoreDownOptions): Promise<number> {
  const l = layout(o.root);
  // CD-01: only a stack core-up started.
  if (!existsSync(l.owner)) {
    o.print(
      `${COMMAND}: no stack started by core-up is recorded (.e2e/owner.json): nothing removed`,
    );
    return 0;
  }
  const tag = readPin(o.repositoryRoot).tag;

  // CD-02, LS-11: the search, every run, before the stack goes.
  const gathered = await gatherSources({
    repositoryRoot: o.repositoryRoot,
    layout: l,
    limits: o.limits,
    path: o.path,
  });
  const outcome =
    gathered.kind === 'no-container'
      ? gathered
      : decide(gathered.unreadable, gathered.logs, gathered.prefixes, gathered.exact);
  for (const line of report(outcome, o.logs, tag)) o.print(line);
  const failed = fails(outcome);

  // CD-03: down -v, by the clone's Compose file if it is there.
  const compose = join(l.clone, CLONE.compose);
  const args = existsSync(compose)
    ? ['compose', '-p', STACK.composeProject, '-f', compose, 'down', '-v']
    : ['compose', '-p', STACK.composeProject, 'down', '-v'];
  o.print(`${COMMAND}: docker ${args.join(' ')}`);
  const down = await runChild('docker', args, {
    step: 'docker compose down -v',
    limitMs: o.limits.down,
    killGraceMs: o.limits.killGrace,
    path: o.path,
  });
  if (down.timedOut || down.code !== 0) {
    // CD-07: keep the record and the clone; core-down can be run again.
    o.print(
      down.timedOut
        ? timedOutLine(COMMAND, 'docker compose down -v', o.limits.down)
        : `${COMMAND}: docker compose down -v failed (exit ${down.code ?? down.signal ?? 'unknown'}): .e2e/owner.json kept; run core-down again`,
    );
    return 1;
  }

  // CD-04: what the run wrote, the record last.
  try {
    for (const f of secretFiles(o)) rmSync(f, { force: true });
    rmSync(l.stack, { force: true });
    // The default directory only; a --secrets-dir elsewhere keeps its directory.
    rmSync(l.secrets, { recursive: true, force: true });
    rmSync(l.marker, { force: true });
    rmSync(l.clone, { recursive: true, force: true });
    rmSync(l.owner, { force: true });
  } catch (error) {
    o.print(
      `${COMMAND}: removing .e2e/ failed (${(error as NodeJS.ErrnoException).code ?? 'error'}): .e2e/owner.json kept; run core-down again`,
    );
    return 1;
  }
  o.print(`${COMMAND}: ${STACK.composeProject} and its volumes removed; .e2e/ cleared`);
  if (failed) o.print(`${COMMAND}: failed: the log search did not pass (see above)`);
  return failed ? 1 : 0;
}
