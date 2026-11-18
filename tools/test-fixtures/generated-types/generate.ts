// SPDX-License-Identifier: Apache-2.0
//
// A fixture generator: writes types.ts from schema.json, deterministically.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const schema = JSON.parse(readFileSync(join(import.meta.dirname, 'schema.json'), 'utf8')) as {
  title: string;
  properties: Record<string, { type: string }>;
};
const ts = (t: string): string => (t === 'integer' ? 'number' : t);
const body = Object.entries(schema.properties)
  .map(([k, v]) => `  ${k}: ${ts(v.type)};`)
  .join('\n');
writeFileSync(
  join(process.argv[2] ?? '.', 'types.ts'),
  `// SPDX-License-Identifier: Apache-2.0\nexport interface ${schema.title} {\n${body}\n}\n`,
);
