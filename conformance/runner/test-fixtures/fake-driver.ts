// SPDX-License-Identifier: Apache-2.0
//
// A fake driver for the runner's own tests: answers the protocol, reports its
// process id, and can crash, hang or echo on request.
import { createInterface } from 'node:readline';

const rl = createInterface({ input: process.stdin });
const reply = (o: object): void => {
  process.stdout.write(`${JSON.stringify(o)}\n`);
};
rl.on('line', (line) => {
  const {
    id,
    op,
    args = {},
  } = JSON.parse(line) as { id: number; op: string; args?: Record<string, unknown> };
  if (op === 'describe') {
    reply({
      id,
      ok: true,
      result: {
        language: 'fake',
        values: { H_renew: 100 },
        depthBound: 10,
        coverage: ['CC-AAA-01'],
      },
    });
  } else if (op === 'start' && args.crash) {
    process.exit(3);
  } else if (op === 'start' && typeof args.hangMs === 'number') {
    setTimeout(() => reply({ id, ok: true, result: {} }), args.hangMs);
  } else if (op === 'newInstanceId') {
    reply({ id, ok: true, result: { value: String(process.pid) } });
  } else if (op === 'create') {
    // Echoes what create received, so the runner's tests can see it.
    reply({ id, ok: true, result: { hasValues: 'values' in args, values: args.values ?? null } });
  } else if (op === 'credential') {
    process.stderr.write(`log line with ${String(args.leak ?? '')}\n`);
    reply({ id, ok: true, result: { agent: 'a' } });
  } else {
    reply({ id, ok: true, result: {} });
  }
});
