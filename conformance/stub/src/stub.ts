// SPDX-License-Identifier: Apache-2.0
//
// The scripted platform stub (business-logic-model §2.1; P-05). Four TLS
// listeners on loopback only: S3 and S4 (the run CA), UNTRUSTED (a certificate
// from a CA no driver is given) and STRAY (records anything that reaches it).
// Each case loads a script: exchanges matched in order, answered as scripted
// (a body, a Problem, a stream of SSE actions, or a reset after reading the
// whole request); a request matching nothing is answered 500 and fails the
// case. Every request is recorded byte for byte. Connection faults: `refuse N`
// drops the next N connections before the TLS handshake (nothing is sent);
// `reset` reads the whole request and destroys the socket (sent, no answer).
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:https';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import type {
  CaseScript,
  DeliverySent,
  JsonObject,
  Listener,
  RecordedRequest,
  StreamRecord,
  StubControl,
} from '../../runner/src/types.ts';
import type { Certs } from '../../runner/src/rundir.ts';
import {
  buildDelivery,
  generateSpec,
  generatedBody,
  generatedEvent,
  valueText,
} from './delivery.ts';

type J = null | boolean | number | string | J[] | { [k: string]: J };

interface Exchange {
  label?: string;
  match: JsonObject;
  remaining: number;
  delayMs: number;
  respond: JsonObject;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const LISTENERS: Listener[] = ['S3', 'S4', 'UNTRUSTED', 'STRAY'];

export async function startStub(certs: Certs): Promise<StubControl> {
  const trusted = { key: readFileSync(certs.serverKey), cert: readFileSync(certs.serverCert) };
  const untrusted = {
    key: readFileSync(certs.untrustedKey),
    cert: readFileSync(certs.untrustedCert),
  };
  let exchanges: Exchange[] = [];
  let recording: RecordedRequest[] = [];
  let streams: StreamRecord[] = [];
  let deliveries: DeliverySent[] = [];
  let refuse: Partial<Record<Listener, number>> = {};
  let open = new Set<ServerResponse>();
  let concurrentMax = 0;
  let seq = 0;
  let connectionSeq = 0;
  let generation = 0;
  const connectionIds = new WeakMap<Socket, number>();

  const matches = (ex: Exchange, r: RecordedRequest): boolean => {
    const m = ex.match;
    return (
      (m.listener === undefined || m.listener === r.listener) &&
      (m.method === undefined || m.method === r.method) &&
      (m.path === undefined || m.path === r.path)
    );
  };

  async function stream(
    res: ServerResponse,
    actions: JsonObject[],
    label: string,
    gen: number,
  ): Promise<void> {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' });
    // A stream announces itself at once, even before its first event.
    res.flushHeaders();
    const rec: StreamRecord = { label, openedAt: Date.now() };
    streams.push(rec);
    open.add(res);
    concurrentMax = Math.max(concurrentMax, open.size);
    let closed = false;
    res.on('close', () => {
      closed = true;
      open.delete(res);
      if (rec.closedAt === undefined) {
        rec.closedAt = Date.now();
        rec.closedBy = rec.closedBy ?? 'client';
      }
    });
    for (const a of actions) {
      if (closed || gen !== generation) return;
      if (a.delivery) {
        const spec = a.delivery as Record<string, J>;
        const built = buildDelivery(spec);
        deliveries.push({ label: String(spec.label ?? `d${deliveries.length + 1}`), ...built });
        res.write(`event: delivery\ndata: ${built.line}\n\n`);
      } else if (a.generate) {
        // Added at U4 (RCV-09): an event generated at send time.
        res.write(generatedEvent(generateSpec(a.generate as J)));
      } else if (a.heartbeat) res.write(': heartbeat\n\n');
      else if (typeof a.end === 'string')
        res.write(`event: end\ndata: ${JSON.stringify({ code: a.end })}\n\n`);
      else if (typeof a.endData === 'string') res.write(`event: end\ndata: ${a.endData}\n\n`);
      else if (a.drop) {
        rec.closedBy = 'stub';
        rec.closedAt = Date.now();
        res.socket?.destroy();
        return;
      } else if (typeof a.silence === 'number') await sleep(a.silence);
      else if (a.waitFor) {
        const w = a.waitFor as JsonObject;
        const want = Number(w.count ?? 1);
        const until = Date.now() + Number(w.timeoutMs ?? 30_000);
        const m = (w.match ?? {}) as JsonObject;
        while (Date.now() < until && !closed && gen === generation) {
          const n = recording.filter(
            (r) =>
              (m.listener === undefined || r.listener === m.listener) &&
              (m.method === undefined || r.method === m.method) &&
              (m.path === undefined || r.path === m.path),
          ).length;
          if (n >= want) break;
          await sleep(20);
        }
      } else if (a.hold) {
        return; // stays open until the client closes it, or the next case
      }
    }
    if (!closed && gen === generation) {
      rec.closedBy = 'stub';
      rec.closedAt = Date.now();
      res.end();
    }
  }

  function handler(listener: Listener) {
    return (req: IncomingMessage, res: ServerResponse): void => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(req.headers))
          headers[k] = Array.isArray(v) ? v.join(', ') : String(v ?? '');
        const r: RecordedRequest = {
          seq: ++seq,
          listener,
          method: req.method ?? '',
          path: (req.url ?? '').split('?')[0] ?? '',
          headers,
          body: Buffer.concat(chunks),
          at: Date.now(),
          connection: connectionIds.get(req.socket) ?? 0,
          answered: true,
        };
        recording.push(r);
        const ex = exchanges.find((e) => e.remaining > 0 && matches(e, r));
        if (!ex) {
          r.unmatched = true;
          res
            .writeHead(500, { 'content-type': 'application/json' })
            .end('{"stub":"unscripted request"}');
          return;
        }
        ex.remaining--;
        if (ex.label) r.label = ex.label;
        const gen = generation;
        void (async () => {
          if (ex.delayMs > 0) await sleep(ex.delayMs);
          if (gen !== generation) return;
          const s = ex.respond;
          if (s.reset) {
            r.answered = false;
            req.socket.destroy();
            return;
          }
          if (Array.isArray(s.stream)) {
            await stream(
              res,
              s.stream as JsonObject[],
              ex.label ?? `stream-${streams.length + 1}`,
              gen,
            );
            return;
          }
          const status = Number(s.status ?? 200);
          const hdrs = { ...((s.headers ?? {}) as Record<string, string>) };
          let body = '';
          if (s.generate)
            // Added at U4 (RCV-09): a body generated at send time.
            body = generatedBody((s.json ?? null) as J, generateSpec(s.generate as J));
          else if ('json' in s || typeof s.text === 'string' || typeof s.fixture === 'string')
            body = valueText(s as Record<string, J>);
          if (body && !Object.keys(hdrs).some((h) => h.toLowerCase() === 'content-type')) {
            hdrs['content-type'] =
              status >= 400 && s.problem !== false
                ? 'application/problem+json'
                : 'application/json';
          }
          res.writeHead(status, hdrs).end(body);
        })();
      });
    };
  }

  const servers = new Map<Listener, Server>();
  const urls = {} as Record<Listener, string>;
  for (const l of LISTENERS) {
    const server = createServer(l === 'UNTRUSTED' ? untrusted : trusted, handler(l));
    server.on('connection', (socket: Socket) => {
      connectionIds.set(socket, ++connectionSeq);
      const n = refuse[l] ?? 0;
      if (n > 0) {
        refuse[l] = n - 1;
        socket.destroy();
      }
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    servers.set(l, server);
    urls[l] = `https://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  return {
    urls,
    load(script: CaseScript): void {
      generation++;
      for (const res of open) res.socket?.destroy();
      open = new Set();
      recording = [];
      streams = [];
      deliveries = [];
      concurrentMax = 0;
      refuse = Object.fromEntries(
        Object.entries(script.listeners ?? {}).map(([k, v]) => [k, v?.refuse ?? 0]),
      );
      exchanges = script.exchanges.map((e) => ({
        ...(typeof e.label === 'string' ? { label: e.label } : {}),
        match: (e.match ?? {}) as JsonObject,
        remaining: Number(e.times ?? 1),
        delayMs: Number(e.delayMs ?? 0),
        respond: (e.respond ?? {}) as JsonObject,
      }));
    },
    recording: () => recording,
    streams: () => streams,
    deliveries: () => deliveries,
    concurrentStreamsMax: () => concurrentMax,
    async stop(): Promise<void> {
      generation++;
      for (const res of open) res.socket?.destroy();
      for (const s of servers.values()) {
        s.closeAllConnections();
        await new Promise<void>((done) => s.close(() => done()));
      }
    },
  };
}
