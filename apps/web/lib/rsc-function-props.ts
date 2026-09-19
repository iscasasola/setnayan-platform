/**
 * A SERVER COMPONENT MAY NOT HAND A FUNCTION TO THE CLIENT.
 *
 * React Server Components serialise every prop that crosses into a client
 * component (or onto a host element like `<button>`). A function cannot be
 * serialised, so React throws "Event handlers cannot be passed to Client
 * Component props" and the WHOLE route falls to its error boundary. Server
 * actions are the one exception — they serialise as a reference.
 *
 * WHY THIS IS STATIC: the crash is raised by the Flight serialiser at request
 * time, and only on the branch that renders the offending element. On
 * 2026-09-19 a supplier saved their FIRST payment method and /vendor-dashboard/shop
 * went to "Your shop console is temporarily unavailable": the Delete button on
 * a method row carried an inline `onClick={confirm…}`, and no shop in prod had
 * ever had a row to render it. `renderToString` in a unit test would not catch
 * it either (it runs client and server components alike and never serialises).
 * So this walks the SOURCE: every file reachable from a route entry through
 * files that are NOT `'use client'`, and in each one every JSX attribute whose
 * value is a function, and asks where that function is going.
 *
 * FLAGGED when the value is an inline arrow/function expression, or an
 * identifier naming a function declared in the same file whose body does not
 * open with `'use server'`, AND the element is:
 *   · a host element (`<button onClick={…}>`), or
 *   · a component imported from a file that starts with `'use client'`, or
 *   · a component imported from a package listed in CLIENT_PACKAGES.
 *
 * NOT SEEN (stated so green is not over-read): a function reached through a
 * prop spread (`{...rest}`), a function stored in an object or array prop, a
 * function imported from another module (other than a server action), and
 * components from packages not in CLIENT_PACKAGES.
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export const WEB_ROOT = path.resolve(__dirname, '..');

/** Package components that are client components (a function prop to them crashes). */
export const CLIENT_PACKAGES = new Set(['next/link', 'next/image', 'next/script', 'next/form']);

const EXTS = ['.tsx', '.ts', '/index.tsx', '/index.ts'];

export function resolveImport(fromFile: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = path.join(WEB_ROOT, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec);
  else return null;
  if (/\.(tsx?|jsx?)$/.test(base) && fs.existsSync(base)) return base;
  for (const e of EXTS) if (fs.existsSync(base + e)) return base + e;
  return null;
}

function directiveOf(sf: ts.SourceFile): 'client' | 'server' | null {
  for (const st of sf.statements) {
    if (ts.isExpressionStatement(st) && ts.isStringLiteral(st.expression)) {
      if (st.expression.text === 'use client') return 'client';
      if (st.expression.text === 'use server') return 'server';
      continue;
    }
    break;
  }
  return null;
}

const sfCache = new Map<string, ts.SourceFile>();
function parse(file: string, text?: string): ts.SourceFile {
  if (text !== undefined) return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let sf = sfCache.get(file);
  if (!sf) {
    sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    sfCache.set(file, sf);
  }
  return sf;
}

export function isClientFile(file: string): boolean {
  return directiveOf(parse(file)) === 'client';
}

type ImportInfo = { spec: string; resolved: string | null };

function importsOf(sf: ts.SourceFile): Map<string, ImportInfo> {
  const out = new Map<string, ImportInfo>();
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier)) continue;
    if (st.importClause?.isTypeOnly) continue;
    const spec = st.moduleSpecifier.text;
    const info = { spec, resolved: resolveImport(sf.fileName, spec) };
    const clause = st.importClause;
    if (!clause) continue;
    if (clause.name) out.set(clause.name.text, info);
    const nb = clause.namedBindings;
    if (nb && ts.isNamedImports(nb)) for (const el of nb.elements) out.set(el.name.text, info);
    if (nb && ts.isNamespaceImport(nb)) out.set(nb.name.text, info);
  }
  return out;
}

function bodyIsServerAction(fn: ts.FunctionLikeDeclaration): boolean {
  const body = fn.body;
  if (!body || !ts.isBlock(body)) return false;
  const first = body.statements[0];
  return !!first && ts.isExpressionStatement(first) && ts.isStringLiteral(first.expression) && first.expression.text === 'use server';
}

/** Local (same-file) functions by name → is it an inline server action? */
function localFunctions(sf: ts.SourceFile): Map<string, boolean> {
  const out = new Map<string, boolean>();
  const visit = (n: ts.Node) => {
    if (ts.isFunctionDeclaration(n) && n.name) out.set(n.name.text, bodyIsServerAction(n));
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      const init = n.initializer;
      if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) out.set(n.name.text, bodyIsServerAction(init));
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

export type Finding = { file: string; line: number; tag: string; prop: string; why: string };

function unwrap(e: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isSatisfiesExpression(e)) e = e.expression;
  return e;
}

/**
 * Findings in ONE server file. `isClient(resolvedPath)` decides whether an
 * imported component is a client component (injectable for fixtures).
 */
export function scanServerSource(
  file: string,
  text: string | undefined,
  isClient: (resolved: string) => boolean = isClientFile,
): Finding[] {
  const sf = parse(file, text);
  const imports = importsOf(sf);
  const locals = localFunctions(sf);
  const rel = path.relative(WEB_ROOT, file);
  const out: Finding[] = [];

  const targetKind = (tagName: ts.JsxTagNameExpression): { client: boolean; why: string } | null => {
    const text = tagName.getText(sf);
    if (/^[a-z]/.test(text) && !text.includes('.')) return { client: true, why: `host element <${text}>` };
    const head = text.split('.')[0]!;
    const imp = imports.get(head);
    if (!imp) return null; // declared in this file → a server component
    if (imp.resolved) return isClient(imp.resolved) ? { client: true, why: `'use client' component from ${imp.spec}` } : null;
    if (CLIENT_PACKAGES.has(imp.spec)) return { client: true, why: `client component from package ${imp.spec}` };
    return null;
  };

  const visit = (n: ts.Node) => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const target = targetKind(n.tagName);
      if (target) {
        for (const attr of n.attributes.properties) {
          if (!ts.isJsxAttribute(attr) || !attr.initializer || !ts.isJsxExpression(attr.initializer)) continue;
          const expr = attr.initializer.expression && unwrap(attr.initializer.expression);
          if (!expr) continue;
          let fnWhy: string | null = null;
          if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) {
            if (!bodyIsServerAction(expr)) fnWhy = 'an inline function';
          } else if (ts.isIdentifier(expr) && locals.has(expr.text) && !locals.get(expr.text)) {
            fnWhy = `the local function \`${expr.text}\``;
          }
          if (fnWhy) {
            out.push({
              file: rel,
              line: sf.getLineAndCharacterOfPosition(attr.getStart(sf)).line + 1,
              tag: n.tagName.getText(sf),
              prop: attr.name.getText(sf),
              why: `${fnWhy} passed to ${target.why}`,
            });
          }
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

/** Every file reachable from `entries` without crossing a `'use client'` boundary. */
export function serverTree(entries: string[]): string[] {
  const seen = new Set<string>();
  const stack = [...entries];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    const sf = parse(f);
    const dir = directiveOf(sf);
    if (dir === 'client') continue;
    seen.add(f);
    if (dir === 'server') continue; // an actions module renders nothing
    for (const { resolved } of importsOf(sf).values()) {
      if (resolved && /\.tsx?$/.test(resolved) && !seen.has(resolved)) stack.push(resolved);
    }
  }
  return [...seen].filter((f) => directiveOf(parse(f)) !== 'server');
}

const ENTRY = /^(page|layout|loading|template|not-found|default)\.tsx$/;

export function routeEntries(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (ENTRY.test(e.name)) out.push(p);
    }
  };
  walk(dir);
  return out;
}
