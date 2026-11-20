// SPDX-License-Identifier: Apache-2.0
//
// C-10 for Python (NFR-U4-28; TS-U4-10): the agent-side contract types as
// `TypedDict` modules, from the vendored contract: the envelope and delivery
// schemas, the shared components, S3 (data-gateway) and S4 (event-ingest). No
// S1 or S2 type is generated (NEV-01; I6).
//
// - An open object (additionalProperties not false) is something the SDK
//   receives: every member is optional (`total=False`), unchecked (CDI-04;
//   RCV-08), its containers typed read-only (`Sequence`, `Mapping`).
// - A closed object is something the SDK sends: its required members stay
//   required, the others `NotRequired`.
// - A construct with no exact Python type (a pattern, an if/then, a mixed
//   allOf) is typed as JSON, with the schema's description kept.
//   node python/scripts/generate.ts <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';

type S = Record<string, unknown>;
const CONTRACT = resolve(import.meta.dirname, '..', '..', 'contract');

interface Doc {
  module: string;
  source: string;
  defs: Record<string, S>;
}

function load(): Doc[] {
  const json = (p: string) => JSON.parse(readFileSync(join(CONTRACT, p), 'utf8')) as S;
  const yaml = (p: string) => parse(readFileSync(join(CONTRACT, p), 'utf8')) as S;
  const schemas = (d: S) => ((d.components as S | undefined)?.schemas ?? {}) as Record<string, S>;
  return [
    {
      module: 'envelope',
      source: 'contract/envelope.schema.json, contract/delivery.schema.json',
      defs: {
        ...(json('envelope.schema.json').$defs as Record<string, S>),
        ...(json('delivery.schema.json').$defs as Record<string, S>),
      },
    },
    {
      module: 'components',
      source: 'contract/conventions/components.openapi.yaml',
      defs: schemas(yaml('conventions/components.openapi.yaml')),
    },
    {
      module: 'data_gateway',
      source: 'contract/data-gateway.openapi.yaml',
      defs: schemas(yaml('data-gateway.openapi.yaml')),
    },
    {
      module: 'event_ingest',
      source: 'contract/event-ingest.openapi.yaml',
      defs: schemas(yaml('event-ingest.openapi.yaml')),
    },
  ];
}

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const KEYWORDS = new Set([
  'from',
  'class',
  'def',
  'in',
  'is',
  'not',
  'and',
  'or',
  'global',
  'type',
]);

/** The module a reference points into, and the name it refers to. */
function target(ref: string, here: string): { module: string; name: string } {
  const [file = '', pointer = ''] = ref.split('#');
  const name = pointer.split('/').pop() ?? '';
  if (file === '') return { module: here, name };
  if (file.endsWith('envelope.schema.json') || file.endsWith('delivery.schema.json'))
    return { module: 'envelope', name };
  if (file.endsWith('components.openapi.yaml')) return { module: 'components', name };
  throw new Error(`unknown reference ${ref}`);
}

class Emitter {
  readonly imports = new Set<string>();
  readonly module: string;
  constructor(module: string) {
    this.module = module;
  }

  ref(ref: string): string {
    const t = target(ref, this.module);
    if (t.module === this.module) return t.name;
    this.imports.add(t.module);
    return `_${t.module}.${t.name}`;
  }

  /** A Python type expression for a schema used as a value. */
  type(s: S, received: boolean): string {
    if (typeof s.$ref === 'string') return this.ref(s.$ref);
    const all = s.allOf as S[] | undefined;
    if (all && all.length === 1 && all[0]) return this.type(all[0], received);
    const any = (s.anyOf ?? s.oneOf) as S[] | undefined;
    if (any) return [...new Set(any.map((x) => this.type(x, received)))].join(' | ');
    if (s.const !== undefined || s.enum !== undefined) {
      const values = (s.enum as unknown[] | undefined) ?? [s.const];
      if (values.every((v) => typeof v === 'string')) return 'str';
      if (values.every((v) => typeof v === 'number' && Number.isInteger(v))) return 'int';
      return 'JsonValue';
    }
    const t = s.type;
    if (Array.isArray(t)) return t.map((x) => this.type({ ...s, type: x }, received)).join(' | ');
    switch (t) {
      case 'string':
        return 'str';
      case 'integer':
        return 'int';
      case 'number':
        return 'float';
      case 'boolean':
        return 'bool';
      case 'null':
        return 'None';
      case 'array':
        return `Sequence[${s.items ? this.type(s.items as S, received) : 'JsonValue'}]`;
      case 'object':
        return 'Mapping[str, JsonValue]';
      default:
        return 'JsonValue';
    }
  }
}

const doc = (text: unknown, indent: string): string => {
  if (typeof text !== 'string' || text.trim() === '') return '';
  const clean = text.trim().replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"');
  const lines = clean.split('\n').map((l) => l.trimEnd());
  return `${indent}"""${lines.join(`\n${indent}`)}"""\n`;
};

function emitModule(d: Doc): string {
  const e = new Emitter(d.module);
  const body: string[] = [];
  const names = Object.keys(d.defs).sort();
  for (const name of names) {
    const s = d.defs[name] as S;
    const props = s.properties as Record<string, S> | undefined;
    if (s.type === 'object' && props) {
      const open = s.additionalProperties !== false;
      const required = new Set((s.required as string[] | undefined) ?? []);
      // A member whose schema is `false` is forbidden by name (a platform-stamped field in a
      // draft): it gets no type, so no draft can be typed with it.
      const forbidden = Object.keys(props).filter((k) => (props[k] as unknown) === false);
      const members = Object.keys(props)
        .filter((k) => !forbidden.includes(k))
        .map((k) => {
          const t = e.type(props[k] as S, open);
          return { k, t: open || required.has(k) ? t : `NotRequired[${t}]` };
        });
      const total = open ? ', total=False' : '';
      const classSyntax = members.every((m) => IDENT.test(m.k) && !KEYWORDS.has(m.k));
      const note =
        (open
          ? '    # Received: every member optional and unchecked; unknown members kept (CDI-04).\n'
          : '') +
        (forbidden.length
          ? `    # Forbidden by name, so not typed: ${forbidden.join(', ')}.\n`
          : '');
      if (classSyntax) {
        body.push(
          `class ${name}(TypedDict${total}):\n${doc(s.description, '    ')}${note}` +
            (members.length ? members.map((m) => `    ${m.k}: ${m.t}\n`).join('') : '    pass\n'),
        );
      } else {
        // The functional form evaluates its types at import: quoted, they are forward references.
        const fields = members
          .map((m) => `        ${JSON.stringify(m.k)}: ${JSON.stringify(m.t)},\n`)
          .join('');
        body.push(`${name} = TypedDict(\n    "${name}",\n    {\n${fields}    }${total},\n)\n`);
      }
    } else {
      body.push(`${name}: TypeAlias = "${e.type(s, true)}"\n${doc(s.description, '')}`);
    }
  }
  const imports = [...e.imports].sort().map((m) => `from . import ${m} as _${m}\n`);
  return (
    `# SPDX-License-Identifier: Apache-2.0\n#\n` +
    `# Generated by python/scripts/generate.ts from ${d.source}; do not edit.\n` +
    `# The agent side only (C-10; NFR-U4-28).\n` +
    `from __future__ import annotations\n\n` +
    `from collections.abc import Mapping, Sequence\n` +
    `from typing import NotRequired, TypeAlias, TypedDict\n\n` +
    imports.join('') +
    `from ._json import JsonValue\n\n` +
    `__all__ = [${names.map((n) => JSON.stringify(n)).join(', ')}]\n\n\n` +
    body.join('\n\n') +
    '\n'
  ).replace(/\n{4,}/g, '\n\n\n');
}

const JSON_MODULE =
  `# SPDX-License-Identifier: Apache-2.0\n#\n` +
  `# Generated by python/scripts/generate.ts; do not edit.\n` +
  `# A JSON value as received: read-only containers (RCV-02).\n` +
  `from __future__ import annotations\n\n` +
  `from collections.abc import Mapping, Sequence\n` +
  `from typing import TypeAlias\n\n` +
  `JsonValue: TypeAlias = "bool | int | float | str | Sequence[JsonValue] | Mapping[str, JsonValue] | None"\n`;

const INIT =
  `# SPDX-License-Identifier: Apache-2.0\n#\n` +
  `# Generated by python/scripts/generate.ts; do not edit.\n` +
  `"""The agent-side contract types (C-10), generated from the vendored contract."""\n`;

export function generateAll(): Record<string, string> {
  const out: Record<string, string> = { '__init__.py': INIT, '_json.py': JSON_MODULE };
  for (const d of load()) out[`${d.module}.py`] = emitModule(d);
  return out;
}

if (import.meta.main) {
  const outDir = resolve(
    process.argv[2] ?? join(import.meta.dirname, '..', 'src', 'soorma', '_generated'),
  );
  mkdirSync(outDir, { recursive: true });
  for (const [file, text] of Object.entries(generateAll())) writeFileSync(join(outDir, file), text);
}
