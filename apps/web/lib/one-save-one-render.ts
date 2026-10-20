/**
 * one-save-one-render.ts — reads the source tree and answers, for every `router.refresh()` in the app: what server
 * action (if any) it follows, and whether that action already revalidates. Used by
 * `a-save-renders-once.test.ts` (the guard). Test-only: nothing in the app imports it.
 *
 * ── Why a refresh after a revalidating action renders the page twice ──────────────────────────────────────────
 * Next 15 (`next/dist/server/web/spec-extension/revalidate.js`): ANY `revalidatePath` / `revalidateTag` inside a
 * server action sets `workStore.pathWasRevalidated = true` ("TODO: only revalidate if the path matches"), and the
 * action handler then renders the CURRENT page and sends its RSC payload back with the action's answer
 * (`skipFlight: !workStore.pathWasRevalidated`). The client router applies that tree
 * (`server-action-reducer.js`). A `router.refresh()` after it asks the server to render the whole page AGAIN —
 * on Guests that is every read the page makes, a second time, for nothing.
 *
 * ── What it can see, and what it cannot ────────────────────────────────────────────────────────────────────────
 *   · A server action is a function exported from a module whose first statement is `'use server'`. It is found
 *     through the client file's imports (`@/…` and relative), following `export { x } from` re-exports.
 *   · "Revalidates" = its body, or a function it calls (same file or imported, followed transitively), calls
 *     `revalidatePath` / `revalidateTag` — EXCEPT inside `after(…)`, which runs after the answer has gone and so
 *     re-renders nothing. It does not decide WHICH branch revalidates: an action that revalidates only on success
 *     counts as revalidating, which is right for a refresh that runs only on success.
 *   · A refresh "follows" an action when the action is called earlier in the same function, or in a function that
 *     encloses it (up to the component). An action handed in as a PROP is not resolved — it is reported as `prop`.
 */
import ts from 'typescript';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

/**
 * Why a refresh is KEPT — one of these, on the line above it: `// one-render: keep (<reason>) — <why>`.
 *   fetch          · it follows a `fetch()` to an API route — no server action answered with a render.
 *   client-write   · it follows a write the BROWSER made (a cookie, the browser's Supabase client, a native store).
 *   auth           · the session changed (signed in / out) — the server components must be read with it.
 *   realtime       · nothing was pressed here: a live event, a pulse, a poll, the tab coming back.
 *   retry          · a person's Try again / Reload — the page's read failed, and this asks for it once more.
 *   batched        · the ONE render after writes that deliberately revalidate nothing (the guest add queue's
 *                    `{ refresh: false }`, the Maker's draft saves through `lib/maker-refresh.ts`).
 *   after-failure  · a write that was refused or never answered revalidated nothing; this re-read shows what was kept.
 *   no-revalidate  · the write before it (named in the why) revalidates nothing, on purpose — this IS its one render.
 *   navigation     · after a `router.push`, with no write: the router cache (`staleTimes.dynamic`) could serve a stale page.
 *   other-frame    · the write happened in ANOTHER document (the Maker frame) — this document's server render is not in it.
 *   unsure         · not proven either way; kept exactly as it was. Counted, and the count may only fall.
 */
export const KEEP_REASONS = ['fetch', 'client-write', 'auth', 'realtime', 'retry', 'batched', 'after-failure', 'no-revalidate', 'navigation', 'other-frame', 'unsure'] as const;
export type KeepReason = (typeof KEEP_REASONS)[number];
/** `// one-render: keep (<reason>) — <why>` on the line(s) right above the refresh. */
export const MARKER_RE = /one-render:\s*keep\s*\(([a-z-]+)\)\s*[—–-]\s*\S/;

/** `via`: `import` = resolved through this file's imports; `name` = an action handed in by a hook or a prop, matched by the
 *  exported name of a server action (every server module that exports that name is listed in `module`). */
export type ActionCall = { name: string; module: string; revalidates: boolean; via: 'import' | 'name' };
export type RefreshSite = {
  file: string; // relative to the web root
  line: number;
  actions: ActionCall[]; // server actions called before the refresh in an enclosing function
  propCalls: string[]; // awaited calls of identifiers that are not imports (props / locals)
  fetches: boolean; // a fetch( precedes it
  marker: string | null; // the keep reason, when marked
  markerText: string | null;
  /** The refresh only runs when a write failed: inside a `catch`, or a branch taken on a refusal. */
  onFailure: boolean;
  /** The refresh is handed to the one-render batcher (`makerSave` / `makerRedrawSave` / the add queue's `setRefresher`). */
  batched: boolean;
};

const BATCHERS = new Set(['makerSave', 'makerRedrawSave', 'setRefresher']);
/** A condition that is true when a write did NOT land: `!res.ok`, `!r?.ok`, `res === null`, `!ok`, `failed`, `error`. */
const FAILURE_TEST = /^!\s*\(?\s*[\w.?]*\bok\b|\.ok\s*===\s*false|===\s*null|^!\s*(ok|res|result|saved|landed)$|\b(failed|error|err|why)\b/;

function onFailureBranch(n: ts.Node): boolean {
  let child: ts.Node = n;
  for (let p: ts.Node | undefined = n.parent; p; child = p, p = p.parent) {
    if (ts.isCatchClause(p)) return true;
    if (ts.isIfStatement(p)) {
      const test = p.expression.getText().trim();
      if (child === p.thenStatement && FAILURE_TEST.test(test)) return true;
      if (child === p.elseStatement && /\.ok\b/.test(test) && !test.startsWith('!')) return true;
    }
    if (isFunctionLike(p) && isComponentBoundary(p)) break;
  }
  return false;
}

function inBatcher(n: ts.Node): boolean {
  for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
    if (ts.isCallExpression(p)) {
      const callee = p.expression;
      const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : '';
      if (BATCHERS.has(name)) return true;
    }
    if (isFunctionLike(p) && isComponentBoundary(p)) break;
  }
  return false;
}

const SKIP_DIRS = new Set(['node_modules', '.next', 'e2e', 'tests', 'public', 'build-sessions']);

function walk(dir: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || name.startsWith('.')) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name) && !name.endsWith('.d.ts')) out.push(p);
  }
}

const sfCache = new Map<string, ts.SourceFile>();
function parse(file: string): ts.SourceFile {
  let sf = sfCache.get(file);
  if (!sf) {
    sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    sfCache.set(file, sf);
  }
  return sf;
}

function resolveSpec(web: string, from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = join(web, spec.slice(2));
  else if (spec.startsWith('.')) base = join(dirname(from), spec);
  else return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

export function isUseServerModule(sf: ts.SourceFile): boolean {
  const first = sf.statements[0];
  return !!first && ts.isExpressionStatement(first) && ts.isStringLiteral(first.expression) && first.expression.text === 'use server';
}

type Imports = Map<string, { file: string; name: string }>; // local name -> (resolved file, exported name)
const importCache = new Map<string, Imports>();
function importsOf(web: string, sf: ts.SourceFile): Imports {
  let m = importCache.get(sf.fileName);
  if (m) return m;
  m = new Map();
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier)) continue;
    const file = resolveSpec(web, sf.fileName, st.moduleSpecifier.text);
    if (!file || !st.importClause) continue;
    const nb = st.importClause.namedBindings;
    if (st.importClause.name) m.set(st.importClause.name.text, { file, name: 'default' });
    if (nb && ts.isNamedImports(nb)) for (const el of nb.elements) m.set(el.name.text, { file, name: (el.propertyName ?? el.name).text });
    if (nb && ts.isNamespaceImport(nb)) m.set(nb.name.text, { file, name: '*' });
  }
  importCache.set(sf.fileName, m);
  return m;
}

/** The function node a module defines under `name` (declared, `const x = async () =>`, or re-exported). */
function findFunction(web: string, file: string, name: string, depth = 0): { sf: ts.SourceFile; node: ts.Node } | null {
  if (depth > 6) return null;
  const sf = parse(file);
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name?.text === name && st.body) return { sf, node: st };
    if (name === 'default' && ts.isFunctionDeclaration(st) && st.modifiers?.some((x) => x.kind === ts.SyntaxKind.DefaultKeyword)) return { sf, node: st };
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.name.text === name && d.initializer) return { sf, node: d.initializer };
      }
    }
    if (ts.isExportDeclaration(st) && st.exportClause && ts.isNamedExports(st.exportClause)) {
      for (const el of st.exportClause.elements) {
        if (el.name.text !== name) continue;
        const orig = (el.propertyName ?? el.name).text;
        if (st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier)) {
          const f = resolveSpec(web, file, st.moduleSpecifier.text);
          return f ? findFunction(web, f, orig, depth + 1) : null;
        }
        if (orig !== name) return findFunction(web, file, orig, depth + 1);
      }
    }
    if (ts.isExportDeclaration(st) && !st.exportClause && st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier)) {
      const f = resolveSpec(web, file, st.moduleSpecifier.text);
      const hit = f ? findFunction(web, f, name, depth + 1) : null;
      if (hit) return hit;
    }
  }
  // An imported name re-exported under the same name (`import { x } from …; export { x }`).
  const imp = importsOf(web, sf).get(name);
  if (imp) return findFunction(web, imp.file, imp.name, depth + 1);
  return null;
}

/** The module that DEFINES `name` as exported from `file` (following re-exports). */
function definingModule(web: string, file: string, name: string): string | null {
  const hit = findFunction(web, file, name);
  return hit ? hit.sf.fileName : null;
}

const REVALIDATORS = new Set(['revalidatePath', 'revalidateTag']);
const revCache = new Map<ts.Node, boolean>();

/** Does running this function (transitively) call revalidatePath / revalidateTag before it answers? */
function revalidates(web: string, sf: ts.SourceFile, fn: ts.Node, stack: Set<ts.Node> = new Set()): boolean {
  const cached = revCache.get(fn);
  if (cached !== undefined) return cached;
  if (stack.has(fn) || stack.size > 25) return false;
  stack.add(fn);
  const imports = importsOf(web, sf);
  let found = false;
  const visit = (n: ts.Node): void => {
    if (found) return;
    if (ts.isCallExpression(n)) {
      const callee = n.expression;
      // `after(() => revalidatePath(…))` runs once the answer has gone: it re-renders nothing for this request.
      if (ts.isIdentifier(callee) && callee.text === 'after') return;
      if (ts.isIdentifier(callee)) {
        if (REVALIDATORS.has(callee.text)) { found = true; return; }
        const imp = imports.get(callee.text);
        const target = imp ? findFunction(web, imp.file, imp.name) : findFunction(web, sf.fileName, callee.text);
        if (target && target.node !== fn && revalidates(web, target.sf, target.node, stack)) { found = true; return; }
      }
    }
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(fn, visit);
  stack.delete(fn);
  revCache.set(fn, found);
  return found;
}

function isFunctionLike(n: ts.Node): n is ts.FunctionLikeDeclaration {
  return ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n);
}

/** A React component (or custom hook) — the furthest a refresh's "enclosing handler" reaches. */
function isComponentBoundary(n: ts.Node): boolean {
  let name: string | undefined;
  if (ts.isFunctionDeclaration(n)) name = n.name?.text;
  else if ((ts.isArrowFunction(n) || ts.isFunctionExpression(n)) && ts.isVariableDeclaration(n.parent) && ts.isIdentifier(n.parent.name)) name = n.parent.name.text;
  return !!name && (/^[A-Z]/.test(name) || /^use[A-Z]/.test(name));
}

function isRefreshCall(n: ts.Node): n is ts.CallExpression {
  return (
    ts.isCallExpression(n) &&
    n.arguments.length === 0 &&
    ts.isPropertyAccessExpression(n.expression) &&
    n.expression.name.text === 'refresh' &&
    /router/i.test(n.expression.expression.getText())
  );
}

function markerFor(sf: ts.SourceFile, call: ts.CallExpression): { reason: string | null; text: string | null } {
  // The comment lines directly above the statement holding the refresh (or inline after it).
  const lines = sf.text.split('\n');
  const line = sf.getLineAndCharacterOfPosition(call.getStart()).line;
  const same = lines[line] ?? '';
  const m0 = same.match(MARKER_RE);
  if (m0) return { reason: m0[1], text: same.trim() };
  for (let i = line - 1; i >= 0 && i >= line - 4; i--) {
    const t = (lines[i] ?? '').trim();
    if (!(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('{/*'))) break;
    const m = t.match(MARKER_RE);
    if (m) return { reason: m[1], text: t };
  }
  return { reason: null, text: null };
}

/** Every function this file declares by name, at any depth (`function f`, `const f = () =>`, `useCallback(…)`). */
function localFunctions(sf: ts.SourceFile): Map<string, ts.Node> {
  const m = new Map<string, ts.Node>();
  const visit = (n: ts.Node): void => {
    if (ts.isFunctionDeclaration(n) && n.name && n.body) m.set(n.name.text, n);
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      let init: ts.Expression = n.initializer;
      if (ts.isCallExpression(init) && ts.isIdentifier(init.expression) && /^use(Callback|Memo)$/.test(init.expression.text) && init.arguments[0]) init = init.arguments[0];
      if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) m.set(n.name.text, init);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return m;
}

/** Every app source file under the web root (no tests, no node_modules, no build output). */
export function appFiles(web: string): string[] {
  const files: string[] = [];
  for (const top of readdirSync(web)) {
    const p = join(web, top);
    if (SKIP_DIRS.has(top) || top.startsWith('.') || !statSync(p).isDirectory()) continue;
    walk(p, files);
  }
  return files;
}

/** Every server action in the app, by its exported name → the modules exporting it and whether each revalidates. */
export function serverActionIndex(web: string, files: string[] = appFiles(web)): Map<string, { module: string; revalidates: boolean }[]> {
  const byName = new Map<string, { module: string; revalidates: boolean }[]>();
  for (const file of files) {
    if (!/^\s*['"]use server['"]/.test(readFileSync(file, 'utf8'))) continue;
    const sf = parse(file);
    if (!isUseServerModule(sf)) continue;
    for (const st of sf.statements) {
      const exported = ts.canHaveModifiers(st) && ts.getModifiers(st)?.some((x) => x.kind === ts.SyntaxKind.ExportKeyword);
      if (!exported) continue;
      const names: string[] = [];
      if (ts.isFunctionDeclaration(st) && st.name) names.push(st.name.text);
      if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) names.push(d.name.text);
      for (const name of names) {
        const hit = findFunction(web, file, name);
        if (!hit) continue;
        const list = byName.get(name) ?? [];
        list.push({ module: relative(web, file), revalidates: revalidates(web, hit.sf, hit.node) });
        byName.set(name, list);
      }
    }
  }
  return byName;
}

export function auditRefreshes(web: string): RefreshSite[] {
  const files = appFiles(web);
  const byName = serverActionIndex(web, files);
  const byNameCall = (name: string): ActionCall => {
    const list = byName.get(name)!;
    return { name, module: list.map((x) => x.module).join(' | '), revalidates: list.every((x) => x.revalidates), via: 'name' };
  };
  const sites: RefreshSite[] = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    if (!/\.refresh\(\)/.test(text)) continue;
    const sf = parse(file);
    const imports = importsOf(web, sf);
    const locals = localFunctions(sf);
    const visit = (n: ts.Node): void => {
      if (isRefreshCall(n)) {
        const pos = n.getStart();
        const actions: ActionCall[] = [];
        const propCalls: string[] = [];
        let fetches = false;
        // Every enclosing function up to (and including) the component: the calls made before this refresh.
        const scopes: ts.Node[] = [];
        let component: ts.Node | null = null;
        for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
          if (isFunctionLike(p)) {
            if (isComponentBoundary(p)) { component = p; break; }
            scopes.push(p);
          }
        }
        // `useActionState(serverAction, …)` in the same component: a refresh in its effect follows that action's answer.
        if (component) {
          const seenState = new Set<string>();
          const findState = (c: ts.Node): void => {
            if (ts.isCallExpression(c) && ts.isIdentifier(c.expression) && c.expression.text === 'useActionState') {
              const a0 = c.arguments[0];
              const id = a0 && ts.isIdentifier(a0) ? a0.text : null;
              const imp = id ? imports.get(id) : undefined;
              if (id && imp && !seenState.has(id)) {
                const def = definingModule(web, imp.file, imp.name) ?? imp.file;
                if (isUseServerModule(parse(def))) {
                  seenState.add(id);
                  const hit = findFunction(web, imp.file, imp.name);
                  actions.push({ name: id, module: relative(web, def), revalidates: !!hit && revalidates(web, hit.sf, hit.node), via: 'import' });
                }
              }
            }
            ts.forEachChild(c, findState);
          };
          ts.forEachChild(component, findState);
        }
        const outer = scopes[scopes.length - 1];
        if (outer) {
          const seen = new Set<string>();
          const scan = (c: ts.Node, anyPos = false): void => {
            if (!anyPos && c.getStart() >= pos) return;
            if (ts.isCallExpression(c)) {
              const callee = c.expression;
              const id = ts.isIdentifier(callee) ? callee.text : null;
              if (id === 'fetch') fetches = true;
              if (id && !seen.has(id)) {
                const imp = imports.get(id);
                if (imp) {
                  const def = definingModule(web, imp.file, imp.name) ?? imp.file;
                  if (isUseServerModule(parse(def))) {
                    seen.add(id);
                    const hit = findFunction(web, imp.file, imp.name);
                    actions.push({ name: id, module: relative(web, def), revalidates: !!hit && revalidates(web, hit.sf, hit.node), via: 'import' });
                  }
                } else if (locals.has(id)) {
                  // A wrapper declared in this file (`const send = async () => { await saveX(…) }`): its body counts.
                  seen.add(id);
                  ts.forEachChild(locals.get(id)!, (k) => scan(k, true));
                } else if (byName.has(id)) {
                  seen.add(id);
                  actions.push(byNameCall(id));
                } else if (ts.isAwaitExpression(c.parent) || ts.isReturnStatement(c.parent)) {
                  seen.add(id);
                  propCalls.push(id);
                }
              }
              // `actions.quickAddGuest(…)` — an action read off a context or a props object.
              if (ts.isPropertyAccessExpression(callee) && byName.has(callee.name.text) && !seen.has(callee.name.text)) {
                seen.add(callee.name.text);
                actions.push(byNameCall(callee.name.text));
              }
            }
            ts.forEachChild(c, (k) => scan(k, anyPos));
          };
          ts.forEachChild(outer, scan);
        }
        const mk = markerFor(sf, n);
        sites.push({
          file: relative(web, file),
          line: sf.getLineAndCharacterOfPosition(pos).line + 1,
          actions,
          propCalls,
          fetches,
          marker: mk.reason,
          markerText: mk.text,
          onFailure: onFailureBranch(n),
          batched: inBatcher(n),
        });
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return sites;
}
