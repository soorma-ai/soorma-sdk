// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { ruleViolations, type Case } from '../cases.ts';
import { expandFixtures, proveMatcher, schemaForFixture } from '../contract.ts';
import { evaluate, matches, type Evidence } from '../evaluate.ts';
import { compactViolations, memberNames, rangeAt, spanAt } from '../json-span.ts';
import { linkFailures } from '../links.ts';
import { summarise } from '../report.ts';
import { resolve } from '../template.ts';
import type { Json, RecordedRequest, TemplateContext } from '../types.ts';

const ctx: TemplateContext = {
  urls: { S3: 'https://s3', S4: 'https://s4', UNTRUSTED: 'https://u', STRAY: 'https://x' },
  caFile: '/run/ca.pem',
  secretBase64: 'c2VjcmV0',
  secret: 'secret',
  files: { a: '/run/a' },
  values: { H_renew: 1000 },
  depthBound: 64,
  start: Date.parse('2026-11-18T00:00:00Z'),
};

describe('templates', () => {
  it('resolves URLs, files, values, depth and times', () => {
    expect(
      resolve(
        {
          u: '${S3}/x',
          f: '${FILE:a}',
          v: '${VALUE:H_renew+500}',
          d: '${DEPTH+8}',
          t: '${TIME:+H_renew+2000}',
          e: '${EPOCH:+1}',
        } as Json,
        ctx,
      ),
    ).toEqual({
      u: 'https://s3/x',
      f: '/run/a',
      v: 1500,
      d: 72,
      t: '2026-11-18T00:00:03.000Z',
      e: ctx.start + 1,
    });
    expect(() => resolve('${NOPE}', ctx)).toThrow('unknown placeholder');
  });
});

describe('the raw JSON scanner', () => {
  const text =
    '{"draft":{"inbound":{"envelope":{ "b" : 1.0,"a":2 },"seal":"s"}},"payload":[1,{"x":"y"}]}';
  it('returns the exact source text at a pointer', () => {
    expect(spanAt(text, '/draft/inbound/envelope')).toBe('{ "b" : 1.0,"a":2 }');
    expect(spanAt(text, '/payload/1/x')).toBe('"y"');
    expect(memberNames('{"b":1,"a":2,"b":3}')).toEqual(['b', 'a', 'b']);
  });
  it('judges compactness, exempting the forwarded envelope span', () => {
    expect(compactViolations(text, rangeAt(text, '/draft/inbound/envelope'))).toEqual([]);
    expect(compactViolations('{"a": 1}')).toEqual(['whitespace at 5']);
    expect(compactViolations('{"a":"\\u00e9"}')[0]).toMatch(/unnecessary escape/);
    expect(compactViolations('{"a":1,"a":2}')).toContain('duplicate member /a');
  });
});

const caseOf = (over: Partial<Case>): Case => ({
  id: 'CC-AAA-01',
  title: 't',
  statements: ['AAA-01'],
  timeoutMs: 10000,
  script: { exchanges: [] },
  commands: [],
  expect: [{ kind: 'absence', noRequests: true }],
  file: '/x/CC-AAA-01.json',
  ...over,
});

describe('the loader rules', () => {
  it('rejects a timing window narrower than twice its value', () => {
    const c = caseOf({
      expect: [
        {
          kind: 'request-timing',
          request: {},
          value: 'H_renew',
          notBefore: '${TIME:+1000}',
          notAfter: '${TIME:+2500}',
        },
      ],
    });
    expect(ruleViolations(c, { H_renew: 1000 })).toEqual([
      'CC-AAA-01: timing window 1500 ms is narrower than twice H_renew (2000 ms)',
    ]);
    const wide = caseOf({
      expect: [
        {
          kind: 'request-timing',
          request: {},
          value: 'H_renew',
          notBefore: '${TIME:+1000}',
          notAfter: '${TIME:+3000}',
        },
      ],
    });
    expect(ruleViolations(wide, { H_renew: 1000 })).toEqual([]);
  });
  it('rejects a timeout that does not cover the latest scripted time', () => {
    const c = caseOf({ timeoutMs: 3000, commands: [{ op: 'wait', args: { ms: 2500 } }] });
    expect(ruleViolations(c, {})[0]).toMatch(/does not cover/);
  });
  it('rejects a file whose name differs from its id', () => {
    expect(ruleViolations(caseOf({ file: '/x/CC-AAA-09.json' }), {})[0]).toMatch(
      /file name differs/,
    );
  });
});

describe('the link check', () => {
  const st = [{ id: 'AAA-01', area: 'AAA', text: '', sources: '', cases: ['CC-AAA-01'] }];
  it('requires both directions', () => {
    expect(linkFailures(st, [caseOf({})])).toEqual([]);
    expect(linkFailures(st, [caseOf({ statements: ['AAA-02'] })])).toEqual([
      'AAA-01 names CC-AAA-01, but CC-AAA-01 does not name AAA-01',
      'CC-AAA-01 names AAA-02, which is not a statement',
    ]);
    expect(linkFailures([{ ...st[0]!, cases: [] }], [])).toEqual([
      'AAA-01 names no case and states no exemption',
    ]);
  });
});

describe('the contract matchers', () => {
  it('maps fixtures to schemas and proves negatives rejected', () => {
    expect(schemaForFixture('data-gateway/BootstrapRequest/valid/sample.json')).toBe(
      'data-gateway#BootstrapRequest',
    );
    expect(schemaForFixture('draft/invalid/sets-scope.json')).toBe('Draft');
    const negatives = expandFixtures(['data-gateway/BootstrapRequest/invalid/*']);
    expect(negatives.length).toBeGreaterThan(3);
    expect(proveMatcher(['data-gateway/BootstrapRequest/valid/sample.json'], negatives)).toEqual(
      [],
    );
    expect(proveMatcher(['data-gateway/BootstrapRequest/invalid/extra-field.json'], [])[0]).toMatch(
      /rejects the valid fixture/,
    );
  });
});

const req = (over: Partial<RecordedRequest>): RecordedRequest => ({
  seq: 1,
  listener: 'S3',
  method: 'POST',
  path: '/agent-credentials',
  headers: {},
  body: Buffer.from(''),
  at: 0,
  connection: 1,
  answered: true,
  ...over,
});
const evidence = (over: Partial<Evidence>): Evidence => ({
  observations: [],
  items: [],
  recording: [],
  streams: [],
  deliveries: [],
  concurrentStreamsMax: 0,
  stderr: '',
  secrets: ['Zq9-unique-test-value'],
  ...over,
});

describe('the evaluator, one assertion kind at a time', () => {
  const c = caseOf({ negativeFixtures: ['data-gateway/BootstrapRequest/invalid/*'] });
  const boot = req({
    headers: { 'soorma-contract-version': '0.1.0', 'content-type': 'application/json' },
    body: Buffer.from('{"agent":"a","secret":"soorma_rs_x","instance":"i"}'),
    at: 100,
  });
  it('request-shape, with schema and negative fixtures', () => {
    const a = {
      kind: 'request-shape',
      request: { path: '/agent-credentials' },
      headers: { absent: ['authorization'], equals: { 'Soorma-Contract-Version': '0.1.0' } },
      members: { exactly: ['agent', 'secret', 'instance'] },
      schema: 'data-gateway#BootstrapRequest',
      negativesFrom: 'data-gateway/BootstrapRequest/',
    };
    expect(evaluate(c, [a], evidence({ recording: [boot] }))).toEqual([]);
    const withAuth = req({ ...boot, headers: { ...boot.headers, authorization: 'Bearer x' } });
    expect(evaluate(c, [a], evidence({ recording: [withAuth] }))).toEqual([
      'request-shape: header authorization is present',
    ]);
  });
  it('request-exact and request-count', () => {
    const fwd = req({
      path: '/events',
      body: Buffer.from('{"draft":{"inbound":{"envelope":{"b":1.0},"seal":"s"}},"payload":1}'),
    });
    const ev = evidence({
      recording: [fwd, fwd],
      deliveries: [{ label: 'd1', line: '', envelopeText: '{"b":1.0}', seal: 's' }],
    });
    expect(
      evaluate(
        c,
        [
          {
            kind: 'request-exact',
            request: { path: '/events' },
            at: '/draft/inbound/envelope',
            equalsEnvelopeOf: 'd1',
            compact: true,
          },
        ],
        ev,
      ),
    ).toEqual([]);
    expect(
      evaluate(
        c,
        [
          {
            kind: 'request-exact',
            request: { path: '/events' },
            at: '/draft/inbound/envelope',
            equalsText: '{"b":1}',
          },
        ],
        ev,
      )[0],
    ).toMatch(/differ/);
    expect(
      evaluate(c, [{ kind: 'request-count', match: { path: '/events' }, count: 1 }], ev),
    ).toEqual(['request-count: 2 requests, expected 1']);
  });
  it('request-timing', () => {
    expect(
      evaluate(
        c,
        [{ kind: 'request-timing', request: { path: '/agent-credentials' }, notAfter: 50 }],
        evidence({ recording: [boot] }),
      )[0],
    ).toMatch(/after its window closed/);
  });
  it('observation, item-sequence, runtime-check, surface and absence', () => {
    const ev = evidence({
      observations: [
        {
          op: 'start',
          label: 's',
          ok: false,
          error: { type: 'ProblemError', code: 'authentication_failed', status: 403 },
          at: 0,
        },
        {
          op: 'inspect',
          label: 'i',
          ok: true,
          result: { secretRetained: { found: true, count: 2 } },
          at: 0,
        },
        {
          op: 'names',
          label: 'n',
          ok: true,
          result: { names: ['AgentClient', 'setEnvironment'] },
          at: 0,
        },
      ],
      items: [
        { kind: 'streamStarted' },
        { kind: 'streamEnded', code: 'superseded', terminal: false },
      ],
      stderr: 'leaked Zq9-unique-test-value here',
    });
    expect(
      evaluate(
        c,
        [
          {
            kind: 'observation',
            command: 's',
            ok: false,
            error: { code: 'authentication_failed', status: 403 },
          },
        ],
        ev,
      ),
    ).toEqual([]);
    expect(
      evaluate(
        c,
        [
          {
            kind: 'item-sequence',
            items: [{ kind: 'streamStarted' }, { kind: 'streamEnded', code: 'superseded' }],
          },
        ],
        ev,
      ),
    ).toEqual([]);
    expect(
      evaluate(c, [{ kind: 'item-sequence', items: [{ kind: 'streamStarted' }] }], ev)[0],
    ).toMatch(/saw 2 items/);
    expect(
      evaluate(
        c,
        [{ kind: 'runtime-check', command: 'i', expect: { '/secretRetained/found': false } }],
        ev,
      ),
    ).toEqual(['runtime-check: /secretRetained/found is true (2 matches)']);
    expect(
      evaluate(c, [{ kind: 'surface', command: 'n', excludesMatching: 'environment' }], ev)[0],
    ).toMatch(/setEnvironment is exposed/);
    const absent = evaluate(c, [{ kind: 'absence', noSecretAnywhere: true }], ev);
    expect(absent).toEqual(['absence: the secret appears in the driver output']);
    expect(absent.join(' ')).not.toContain('Zq9-unique-test-value');
  });
  it('span parenting and links', () => {
    const d = {
      label: 'd1',
      line: '',
      envelopeText:
        '{"traceContext":{"traceparent":"00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"}}',
      seal: 's',
    };
    const span = {
      kind: 'producer',
      name: 'send',
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      spanId: '1111111111111111',
      parentSpanId: '00f067aa0ba902b7',
      links: [],
    };
    const ev = evidence({
      deliveries: [d],
      observations: [{ op: 'spans', label: 'sp', ok: true, result: { spans: [span] }, at: 0 }],
    });
    expect(
      evaluate(
        c,
        [
          {
            kind: 'span',
            command: 'sp',
            spans: [{ kind: 'producer', parent: { receivedOf: 'd1' }, links: 'none' }],
          },
        ],
        ev,
      ),
    ).toEqual([]);
    expect(
      evaluate(
        c,
        [{ kind: 'span', command: 'sp', spans: [{ kind: 'producer', parent: 'root' }] }],
        ev,
      )[0],
    ).toMatch(/has a parent/);
  });
  it('fails a case on any unscripted request', () => {
    expect(evaluate(c, [], evidence({ recording: [req({ unmatched: true })] }))).toEqual([
      'unscripted request: POST /agent-credentials on S3 (answered 500)',
    ]);
  });
  it('matchers', () => {
    expect(matches('abc', { matches: '^a' })).toBe(true);
    expect(matches(3, { atLeast: 2 })).toBe(true);
    expect(matches(null, { exists: false })).toBe(true);
  });
});

describe('the report', () => {
  it('never carries a secret: only lengths and counts', () => {
    const text = summarise({
      mode: 'full',
      ok: false,
      problems: [],
      results: [
        {
          id: 'CC-SEC-01',
          statements: ['SEC-02'],
          status: 'fail',
          failures: ['runtime-check: /secretRetained/found is true (1 matches)'],
          durationMs: 5,
        },
      ],
      failed: ['CC-SEC-01'],
      durationMs: 5,
      budgetMs: 10,
      overBudget: false,
      slowest: [],
    });
    expect(text).toContain('FAIL CC-SEC-01 [SEC-02]');
    expect(text).toContain('(1 matches)');
  });
});
