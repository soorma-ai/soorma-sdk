// SPDX-License-Identifier: Apache-2.0
//
// The TypeScript driver's `names` and `surface` (conformance/README.md; the
// names check, FR-17), read from the built package's declarations, never from
// a hand-kept list. `names`: every exported name, and every public member of
// every exported class and interface, except members tagged `@internal`,
// private or protected members, members Error itself declares, and
// symbol-keyed members (protocol idioms). Type aliases are not expanded: their
// members are wire data (`Envelope`) or other exports' members. `surface`: the
// settable members, which are the client options' fields.
import { join, resolve } from 'node:path';
import ts from 'typescript';

const ROOT = resolve(import.meta.dirname, '..', '..');
const IDENT = /^[A-Za-z_$][\w$]*$/;

function load(dts: string): { checker: ts.TypeChecker; exports: ts.Symbol[]; program: ts.Program } {
  const program = ts.createProgram([dts], {
    target: ts.ScriptTarget.ES2024,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true,
    noEmit: true,
    typeRoots: [join(ROOT, 'node_modules', '@types')],
    types: ['node'],
  });
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(dts);
  const module = source ? checker.getSymbolAtLocation(source) : undefined;
  if (!module) throw new Error(`cannot read ${dts}`);
  return { checker, exports: checker.getExportsOfModule(module), program };
}

const resolveAlias = (checker: ts.TypeChecker, s: ts.Symbol): ts.Symbol =>
  s.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s;

function publicMembers(checker: ts.TypeChecker, program: ts.Program, s: ts.Symbol): string[] {
  const out: string[] = [];
  const type = checker.getDeclaredTypeOfSymbol(s);
  for (const p of checker.getPropertiesOfType(type)) {
    if (!IDENT.test(p.name)) continue; // symbol-keyed: idioms
    const decls = p.declarations ?? [];
    if (decls.length === 0) continue;
    if (decls.every((d) => program.isSourceFileDefaultLibrary(d.getSourceFile()))) continue;
    const hidden = decls.some(
      (d) =>
        (ts.getCombinedModifierFlags(d) &
          (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) !==
          0 || ts.getJSDocTags(d).some((t) => t.tagName.text === 'internal'),
    );
    if (!hidden) out.push(p.name);
  }
  return out;
}

export function exportedNames(dts: string): string[] {
  const { checker, exports, program } = load(dts);
  const out = new Set<string>();
  for (const e of exports) {
    out.add(e.name);
    const s = resolveAlias(checker, e);
    if (s.flags & (ts.SymbolFlags.Class | ts.SymbolFlags.Interface)) {
      for (const m of publicMembers(checker, program, s)) out.add(m);
    }
  }
  return [...out].sort();
}

export function settableMembers(dts: string): string[] {
  const { checker, exports, program } = load(dts);
  const options = exports.find((e) => e.name === 'AgentClientOptions');
  if (!options) throw new Error('AgentClientOptions is not exported');
  return publicMembers(checker, program, resolveAlias(checker, options)).sort();
}
