// SPDX-License-Identifier: Apache-2.0
//
// Placeholders in case files, resolved at case start:
//   ${S3} ${S4} ${UNTRUSTED} ${STRAY}   listener base URLs
//   ${CA}                               the run CA certificate's path
//   ${SECRET_B64}                       the case's secret as base64 bytes
//   ${FILE:name}                        a file the case set up, by name
//   ${VALUE:H_renew}                    a named value in force (number)
//   ${DEPTH+8}                          the driver's depth bound plus 8 (number)
//   ${TIME:+H_renew+2000}               an ISO time: case start plus terms
//   ${EPOCH:+2000}                      the same, as epoch milliseconds (number)
// The secret's plain value never appears in a template's output except where a
// case writes it into a file (`${SECRET}`), so it never travels on a command line.
import type { Json, NamedValue, TemplateContext } from './types.ts';

const PLACEHOLDER = /\$\{([^}]+)\}/g;

export function sumTerms(expr: string, ctx: Pick<TemplateContext, 'values'>): number {
  return expr
    .split('+')
    .filter((t) => t.length > 0)
    .reduce((acc, term) => {
      if (/^-?\d+$/.test(term)) return acc + Number(term);
      const v = ctx.values[term as NamedValue];
      if (v === undefined) throw new Error(`unknown value in time expression: ${term}`);
      return acc + v;
    }, 0);
}

function resolveOne(name: string, ctx: TemplateContext): string | number {
  if (name === 'S3' || name === 'S4' || name === 'UNTRUSTED' || name === 'STRAY')
    return ctx.urls[name];
  if (name === 'CA') return ctx.caFile;
  if (name === 'SECRET_B64') return ctx.secretBase64;
  if (name === 'SECRET') return ctx.secret;
  if (name.startsWith('FILE:')) {
    const f = ctx.files[name.slice(5)];
    if (f === undefined) throw new Error(`unknown file: ${name.slice(5)}`);
    return f;
  }
  if (name.startsWith('VALUE:')) return sumTerms(name.slice(6), ctx);
  if (name.startsWith('DEPTH')) return ctx.depthBound + sumTerms(name.slice(5), ctx);
  if (name.startsWith('TIME:'))
    return new Date(ctx.start + sumTerms(name.slice(5), ctx)).toISOString();
  if (name.startsWith('EPOCH:')) return ctx.start + sumTerms(name.slice(6), ctx);
  throw new Error(`unknown placeholder: \${${name}}`);
}

export function resolveString(text: string, ctx: TemplateContext): Json {
  const whole = /^\$\{([^}]+)\}$/.exec(text);
  if (whole) return resolveOne(whole[1] ?? '', ctx);
  return text.replace(PLACEHOLDER, (_, name: string) => String(resolveOne(name, ctx)));
}

export function resolve(value: Json, ctx: TemplateContext): Json {
  if (typeof value === 'string') return resolveString(value, ctx);
  if (Array.isArray(value)) return value.map((v) => resolve(v, ctx));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v, ctx)]));
  }
  return value;
}
