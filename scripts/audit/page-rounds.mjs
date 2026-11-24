#!/usr/bin/env node
/**
 * PAGE READ ROUNDS: a static trace of every page's server-side reads (speed audit, 24 Nov 2026).
 *
 * Read-only: it parses `apps/web/app/**` and the loaders they import, and writes nothing into the app.
 *
 * WHAT A "ROUND" IS. One trip (a Supabase query, an RPC, `auth.getUser()`, a `fetch`) that must finish
 * before the next can start. Two reads inside one `Promise.all` are ONE round. A read awaited after
 * another is TWO.
 *
 * THE MODEL (each point checked against Next 15.5's `create-component-tree.js`):
 *   · A layout's `children` is a `LayoutRouter` (a client element), and the page's RSC renders in its own
 *     seed-data slot, so the layouts and the page of one route render IN PARALLEL. Route rounds = the max
 *     of its segments (layouts · page · generateMetadata).
 *   · An async server component drawn in JSX starts only when its parent has RETURNED, so a child adds
 *     its rounds AFTER the parent's. Siblings run side by side (max). #8278's `preload…` pattern removes
 *     exactly this wait.
 *   · A Supabase builder (`.from()…`, `.rpc()`) is lazy: it starts when awaited, put in `Promise.all`,
 *     `.then`-ed or `Promise.resolve`-d, not when it is built.
 *   · A `for` loop whose body awaits a read is an N+1. It is counted as 3 trips through the body
 *     (`LOOP_N`) and flagged.
 *   · `if`/`else` and `?:` take the slower branch (worst case).
 *   · React `cache()` dedupes across segments of one request. `unstable_cache` / `'use cache'` count as
 *     0 rounds on a warm data cache (flagged "data-cached").
 *
 * TWO NUMBERS PER PAGE:
 *   · `now`:   statement order, every `await` blocks (what the code does today).
 *   · `ideal`: dataflow only. A read starts once the values it uses are ready, and a child component's
 *              reads start once its props are ready (the #8278 preload). It is the floor a fix in
 *              #8278's pattern can reach WITHOUT a new RPC.
 *
 * Limits (said in the doc): dynamic dispatch, class methods and object-of-functions services are not
 * followed (they count 0); a guard's early `redirect()` is not a branch cut.
 *
 * Usage (from the repo root):
 *   node scripts/audit/page-rounds.mjs --json out.json            # every page
 *   node scripts/audit/page-rounds.mjs --route /vendor-dashboard/shop --explain
 * Needs `typescript` (the workspace's own after `pnpm install`, or TS_PATH=/path/to/typescript).
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const WEB = path.join(REPO, 'apps/web');
const APP = path.join(WEB, 'app');
const require = createRequire(import.meta.url);
let ts;
for (const p of [process.env.TS_PATH, path.join(WEB, 'node_modules/typescript'), path.join(REPO, 'node_modules/typescript'), 'typescript']) {
  if (!p) continue;
  try {
    ts = require(p);
    break;
  } catch {
    /* try the next */
  }
}
if (!ts) {
  console.error('typescript not found: run `pnpm install`, or set TS_PATH');
  process.exit(2);
}

const LOOP_N = 3;
const TRACE = process.env.TRACE_AWAITS || '';
const NON_DB_FROM = new Set(['Array', 'Buffer', 'Object', 'Uint8Array', 'Int8Array', 'Uint16Array', 'Float32Array', 'String', 'Set', 'Map', 'Iterator', 'Promise', 'Date', 'Readable', 'ReadableStream', 'Response']);
const BACKGROUND = new Set(['after', 'waitUntil', 'setTimeout', 'setInterval', 'queueMicrotask', 'setImmediate']);
const TERMINAL = new Set(['redirect', 'notFound', 'permanentRedirect', 'forbidden', 'unauthorized']);

// ───────────────────────────── files and symbols ─────────────────────────────
const files = new Map();
const rel = (abs) => path.relative(WEB, abs);

function hasDirective(sf, word) {
  for (const st of sf.statements) {
    if (ts.isExpressionStatement(st) && ts.isStringLiteral(st.expression)) {
      if (st.expression.text === word) return true;
      continue;
    }
    break;
  }
  return false;
}
const hasMod = (n, kind) => Boolean(n.modifiers?.some((m) => m.kind === kind));

function loadFile(abs) {
  if (files.has(abs)) return files.get(abs);
  let text;
  try {
    text = fs.readFileSync(abs, 'utf8');
  } catch {
    files.set(abs, null);
    return null;
  }
  const sf = ts.createSourceFile(abs, text, ts.ScriptTarget.Latest, true, abs.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const f = { abs, sf, isClient: hasDirective(sf, 'use client'), locals: new Map(), imports: new Map(), exports: new Map(), stars: [], config: {} };
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st)) {
      if (st.importClause?.isTypeOnly) continue;
      const from = st.moduleSpecifier.text;
      const ic = st.importClause;
      if (!ic) continue;
      if (ic.name) f.imports.set(ic.name.text, { from, name: 'default' });
      const nb = ic.namedBindings;
      if (nb && ts.isNamespaceImport(nb)) f.imports.set(nb.name.text, { from, ns: true });
      if (nb && ts.isNamedImports(nb)) for (const el of nb.elements) if (!el.isTypeOnly) f.imports.set(el.name.text, { from, name: (el.propertyName ?? el.name).text });
    } else if (ts.isFunctionDeclaration(st)) {
      const name = st.name?.text ?? 'default';
      f.locals.set(name, st);
      if (hasMod(st, ts.SyntaxKind.ExportKeyword)) f.exports.set(hasMod(st, ts.SyntaxKind.DefaultKeyword) ? 'default' : name, { local: name });
    } else if (ts.isVariableStatement(st)) {
      const exported = hasMod(st, ts.SyntaxKind.ExportKeyword);
      for (const d of st.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || !d.initializer) continue;
        f.locals.set(d.name.text, d.initializer);
        if (exported) f.exports.set(d.name.text, { local: d.name.text });
        if (exported && ['dynamic', 'revalidate', 'fetchCache', 'runtime', 'preferredRegion'].includes(d.name.text)) f.config[d.name.text] = d.initializer.getText(sf);
      }
    } else if (ts.isExportAssignment(st)) {
      f.exports.set('default', { expr: st.expression });
    } else if (ts.isExportDeclaration(st)) {
      if (st.isTypeOnly) continue;
      const from = st.moduleSpecifier?.text;
      if (!st.exportClause) {
        if (from) f.stars.push(from);
      } else if (ts.isNamedExports(st.exportClause)) {
        for (const el of st.exportClause.elements) {
          const orig = (el.propertyName ?? el.name).text;
          f.exports.set(el.name.text, from ? { from, name: orig } : { local: orig });
        }
      }
    }
  }
  files.set(abs, f);
  return f;
}

const EXT = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];
function resolveModule(spec, fromAbs) {
  let base;
  if (spec.startsWith('@/')) base = path.join(WEB, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromAbs), spec);
  else return null;
  for (const e of EXT) {
    const p = base + e;
    try {
      if (fs.statSync(p).isFile()) return p;
    } catch {
      /* next */
    }
  }
  return null;
}

/** name in file → { file, node, name } | null */
function resolveName(f, name, depth = 0) {
  if (!f || depth > 12) return null;
  if (f.locals.has(name)) return { file: f, node: f.locals.get(name), name };
  const imp = f.imports.get(name);
  if (imp) {
    const target = resolveModule(imp.from, f.abs);
    if (!target) return null;
    const tf = loadFile(target);
    if (imp.ns) return { file: tf, ns: true, name };
    return resolveExport(tf, imp.name, depth + 1);
  }
  return null;
}
function resolveExport(f, name, depth = 0) {
  if (!f || depth > 12) return null;
  const ex = f.exports.get(name);
  if (ex) {
    if (ex.local) return resolveName(f, ex.local, depth + 1);
    if (ex.from) {
      const t = resolveModule(ex.from, f.abs);
      return t ? resolveExport(loadFile(t), ex.name, depth + 1) : null;
    }
    if (ex.expr) {
      if (ts.isIdentifier(ex.expr)) return resolveName(f, ex.expr.text, depth + 1);
      return { file: f, node: ex.expr, name };
    }
  }
  for (const s of f.stars) {
    const t = resolveModule(s, f.abs);
    const r = t ? resolveExport(loadFile(t), name, depth + 1) : null;
    if (r) return r;
  }
  return null;
}

/** A symbol node → the function it is: { fn, cached: 'react' | 'data' | null } */
function asFunction(sym, depth = 0) {
  if (!sym || !sym.node || depth > 6) return null;
  let n = sym.node;
  while (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isSatisfiesExpression?.(n)) n = n.expression;
  if (ts.isFunctionDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n)) {
    const body = n.body;
    const dataCached = body && ts.isBlock(body) && body.statements[0] && ts.isExpressionStatement(body.statements[0]) && ts.isStringLiteral(body.statements[0].expression) && body.statements[0].expression.text === 'use cache';
    return { fn: n, file: sym.file, name: sym.name, cached: dataCached ? 'data' : null };
  }
  if (ts.isCallExpression(n)) {
    const callee = n.expression.getText(sym.file.sf);
    const inner = n.arguments[0];
    const kind = /(^|\.)cache$/.test(callee) ? 'react' : /unstable_cache$/.test(callee) ? 'data' : null;
    if (kind && inner) {
      const r = asFunction({ file: sym.file, node: inner, name: sym.name }, depth + 1);
      if (r) return { ...r, name: sym.name, cached: kind };
      if (ts.isIdentifier(inner)) {
        const r2 = asFunction(resolveName(sym.file, inner.text), depth + 1);
        if (r2) return { ...r2, name: sym.name, cached: kind };
      }
    }
    return null;
  }
  if (ts.isIdentifier(n)) return asFunction(resolveName(sym.file, n.text), depth + 1);
  return null;
}

// ───────────────────────────── the evaluator ─────────────────────────────
const V = (fin, idl, path) => ({ k: 'v', fin, idl, path });
const P = (fin, idl, path, extra) => ({ k: 'p', fin, idl, path, ...extra });
const ZERO = V(0, 0, []);
const maxBy = (vals, key) => vals.reduce((a, b) => (b && (!a || b[key] > a[key]) ? b : a), null);

class Scope {
  constructor(parent, file) {
    this.parent = parent;
    this.file = file;
    this.vars = new Map();
  }
  get(name) {
    for (let s = this; s; s = s.parent) if (s.vars.has(name)) return s.vars.get(name);
    return undefined;
  }
  set(name, v) {
    for (let s = this; s; s = s.parent)
      if (s.vars.has(name)) {
        s.vars.set(name, v);
        return;
      }
    this.vars.set(name, v);
  }
}

const memo = new Map();
const inProgress = new Set();
const lineOf = (file, node) => file.sf.getLineAndCharacterOfPosition(node.getStart(file.sf)).line + 1;

function newCtx(file, t = 0, pth = [], resolved = new Set()) {
  // resolved: React-cache()d readers already answered in this request (a second call is free);
  // started: cache()d readers started in this function (a second call gets the SAME promise);
  // cachedAll: every cache()d reader this function started, handed to the children it draws.
  return { file, t, path: pth, maxIdl: 0, returns: [], jsx: [], guards: [], leaves: 0, loops: [], fanouts: 0, tables: new Set(), getUser: [], calls: [], returned: false, suspense: 0, resolved: new Set(resolved), started: new Map(), cachedAll: new Set() };
}
const unionCk = (vals) => {
  const out = new Set();
  for (const v of vals) if (v && v.ck) for (const k of v.ck) out.add(k);
  return out;
};

/** Make a lazy (Supabase builder) or promise value real at the current cursor. */
function consume(v, ctx) {
  if (!v) return V(ctx.t, 0, ctx.path);
  if (v.k === 'lazy') {
    const fin = ctx.t + 1;
    return P(fin, v.idl0 + 1, [...ctx.path, v.label]);
  }
  if (v.k === 'p' || v.k === 'pa') return v;
  if (v.k === 'arr') {
    const items = v.items.map((i) => consume(i, ctx));
    const m = maxBy(items, 'fin');
    return P(Math.max(ctx.t, m?.fin ?? 0), Math.max(0, ...items.map((i) => i.idl)), m && m.fin > ctx.t ? m.path : ctx.path, { items, ck: unionCk(items) });
  }
  return V(v.fin ?? ctx.t, v.idl ?? 0, v.path ?? ctx.path);
}
const idlOf = (v) => (v && typeof v.idl === 'number' ? v.idl : v && v.k === 'lazy' ? v.idl0 : 0);

function bindPattern(name, v, scope, ctx) {
  if (ts.isIdentifier(name)) return scope.vars.set(name.text, v);
  if (ts.isArrayBindingPattern(name)) {
    name.elements.forEach((el, i) => {
      if (ts.isOmittedExpression(el)) return;
      const item = v && (v.k === 'arr' || v.items) && v.items ? v.items[i] : null;
      bindPattern(el.name, item ? (item.k === 'p' ? V(item.fin, item.idl, item.path) : item) : V(v?.fin ?? ctx.t, idlOf(v), v?.path ?? ctx.path), scope, ctx);
    });
    return;
  }
  if (ts.isObjectBindingPattern(name)) {
    for (const el of name.elements) {
      const key = (el.propertyName ?? el.name).getText?.(ctx.file.sf);
      const prop = v && v.k === 'obj' ? v.props.get(key) : null;
      bindPattern(el.name, prop ?? V(v?.fin ?? ctx.t, idlOf(v), v?.path ?? ctx.path), scope, ctx);
    }
  }
}

function hoist(stmts, scope, file) {
  for (const st of stmts) if (ts.isFunctionDeclaration(st) && st.name) scope.vars.set(st.name.text, { k: 'fn', info: { fn: st, file, name: st.name.text, cached: null }, closure: scope });
}

function evalBlock(stmts, scope, ctx) {
  hoist(stmts, scope, ctx.file);
  for (const st of stmts) {
    if (ctx.returned) break;
    evalStmt(st, scope, ctx);
  }
}

function branch(ctx, run) {
  const save = { t: ctx.t, path: ctx.path, returned: ctx.returned };
  run();
  const out = { t: ctx.t, path: ctx.path, returned: ctx.returned };
  ctx.t = save.t;
  ctx.path = save.path;
  ctx.returned = save.returned;
  return out;
}
/** A test on a read's failure (`res.error`, a missing-column retry): the page's normal open takes the other branch. */
const ERROR_TEST = /\berror\b|\.error\b|\berr\b|isMissingColumn|missing.?column|42703|PGRST|SchemaError|columnMissing|isUndefinedColumn/i;
function isErrorTest(cond, ctx) {
  return ERROR_TEST.test(cond.getText(ctx.file.sf));
}
/** An error branch: the cursor takes the FASTER branch (the happy path), and the slow retry is not a round of a normal open. */
function mergeHappy(ctx, outs) {
  const live = outs.filter((o) => !o.returned);
  const pool = live.length ? live : outs;
  const m = pool.reduce((a, b) => (b.t < a.t ? b : a));
  ctx.t = m.t;
  ctx.path = m.path;
  ctx.returned = live.length === 0;
}
/** Runtime tests whose answer on a live page render is known: `insideRender()` (lib/request-once.ts) is true there,
 *  `onTheCachedHub()` (lib/hub-request.ts) is false off the cached Event Hub. Returns true / false / null. */
function knownCondition(cond, ctx) {
  const t = cond.getText(ctx.file.sf).replace(/\s+/g, '');
  if (t === 'insideRender()') return true;
  if (t === '!insideRender()') return false;
  if (t === 'onTheCachedHub()') return CACHED_HUB_ROUTE;
  if (t === '!onTheCachedHub()') return !CACHED_HUB_ROUTE;
  return null;
}
let CACHED_HUB_ROUTE = false;
function merge(ctx, outs) {
  const live = outs.filter((o) => !o.returned);
  const pool = live.length ? live : outs;
  const m = maxBy(pool, 't');
  ctx.t = m.t;
  ctx.path = m.path;
  ctx.returned = live.length === 0;
}

function evalStmt(st, scope, ctx) {
  if (ts.isVariableStatement(st)) {
    for (const d of st.declarationList.declarations) {
      const v = d.initializer ? evalExpr(d.initializer, scope, ctx) : V(ctx.t, 0, ctx.path);
      bindPattern(d.name, v, scope, ctx);
    }
  } else if (ts.isExpressionStatement(st)) evalExpr(st.expression, scope, ctx);
  else if (ts.isReturnStatement(st)) {
    const v = st.expression ? evalExpr(st.expression, scope, ctx) : null;
    ctx.returns.push({ v: v ? consume(v, ctx) : null, t: ctx.t, path: ctx.path });
    ctx.returned = true;
  } else if (ts.isThrowStatement(st)) {
    evalExpr(st.expression, scope, ctx);
    ctx.returned = true;
  } else if (ts.isIfStatement(st) && knownCondition(st.expression, ctx) !== null) {
    const taken = knownCondition(st.expression, ctx) ? st.thenStatement : st.elseStatement;
    if (taken) evalStmt(taken, new Scope(scope, ctx.file), ctx);
  } else if (ts.isIfStatement(st)) {
    evalExpr(st.expression, scope, ctx);
    const a = branch(ctx, () => evalStmt(st.thenStatement, new Scope(scope, ctx.file), ctx));
    const b = branch(ctx, () => st.elseStatement && evalStmt(st.elseStatement, new Scope(scope, ctx.file), ctx));
    const condText = st.expression.getText(ctx.file.sf).replace(/\s+/g, '');
    if (isErrorTest(st.expression, ctx) && a.returned && !st.elseStatement && /^!|===?null|===?undefined/.test(condText)) {
      // `if (!error) return data;` — the rest of the block is the failure path (a retry), not a normal open.
      ctx.t = a.t;
      ctx.path = a.path;
      ctx.returned = true;
    } else if (isErrorTest(st.expression, ctx)) mergeHappy(ctx, [a, b]);
    else merge(ctx, [a, b]);
  } else if (ts.isBlock(st)) evalBlock(st.statements, new Scope(scope, ctx.file), ctx);
  else if (ts.isTryStatement(st)) {
    evalBlock(st.tryBlock.statements, new Scope(scope, ctx.file), ctx);
    const wasReturned = ctx.returned;
    ctx.returned = false;
    if (st.finallyBlock) evalBlock(st.finallyBlock.statements, new Scope(scope, ctx.file), ctx);
    ctx.returned = ctx.returned || wasReturned;
  } else if (ts.isForOfStatement(st) || ts.isForInStatement(st) || ts.isForStatement(st) || ts.isWhileStatement(st) || ts.isDoStatement(st)) {
    const inner = new Scope(scope, ctx.file);
    if (ts.isForOfStatement(st) || ts.isForInStatement(st)) {
      const it = evalExpr(st.expression, scope, ctx);
      const decl = st.initializer;
      if (ts.isVariableDeclarationList(decl)) for (const d of decl.declarations) bindPattern(d.name, V(ctx.t, idlOf(it), ctx.path), inner, ctx);
    } else if (ts.isForStatement(st) && st.initializer) {
      if (ts.isVariableDeclarationList(st.initializer)) for (const d of st.initializer.declarations) bindPattern(d.name, d.initializer ? evalExpr(d.initializer, inner, ctx) : V(ctx.t, 0, ctx.path), inner, ctx);
      else evalExpr(st.initializer, inner, ctx);
    } else if ((ts.isWhileStatement(st) || ts.isDoStatement(st)) && st.expression) evalExpr(st.expression, scope, ctx);
    const t0 = ctx.t;
    const p0 = ctx.path;
    const r0 = ctx.returned;
    const forAwait = ts.isForOfStatement(st) && st.awaitModifier;
    evalStmt(st.statement, inner, ctx);
    ctx.returned = r0;
    const d = ctx.t - t0 + (forAwait ? 1 : 0);
    // A paging loop (`for (;;)` / `while` that breaks on a short page) runs ONCE on a normal open; an item loop runs N times.
    const paged = (ts.isForStatement(st) && !st.condition) || ts.isWhileStatement(st) || ts.isDoStatement(st);
    if (d > 0 && paged) {
      ctx.path = [...p0, ...ctx.path.slice(p0.length)];
    } else if (d > 0) {
      ctx.loops.push({ at: `${rel(ctx.file.abs)}:${lineOf(ctx.file, st)}`, perItem: d });
      ctx.t = t0 + d * LOOP_N;
      ctx.path = [...p0, `N+1 loop ×${d} (${rel(ctx.file.abs)}:${lineOf(ctx.file, st)})`];
    }
  } else if (ts.isSwitchStatement(st)) {
    evalExpr(st.expression, scope, ctx);
    const outs = st.caseBlock.clauses.map((c) => branch(ctx, () => evalBlock(c.statements, new Scope(scope, ctx.file), ctx)));
    if (outs.length) merge(ctx, outs);
    ctx.returned = false;
  } else if (ts.isLabeledStatement(st)) evalStmt(st.statement, scope, ctx);
  else if (ts.isFunctionDeclaration(st)) {
    /* hoisted */
  }
}

/** Evaluate a function body inline (a closure or a callback), starting at the cursor. Returns { fin, idl, path }. */
const inlineStack = new Set();
function runInline(info, closure, args, ctx, argVals = []) {
  const fn = info.fn;
  // A closure that calls itself (a tree walk) is followed once, not forever.
  if (inlineStack.has(fn) || inlineStack.size > 60) return P(ctx.t, Math.max(0, ...args.map(idlOf)), ctx.path);
  inlineStack.add(fn);
  try {
    return runInlineBody(info, closure, args, ctx, argVals);
  } finally {
    inlineStack.delete(fn);
  }
}
function runInlineBody(info, closure, args, ctx, argVals) {
  const fn = info.fn;
  const scope = new Scope(closure, info.file);
  fn.parameters.forEach((p, i) => bindPattern(p.name, argVals[i] ?? V(ctx.t, Math.max(0, ...args.map(idlOf)), ctx.path), scope, ctx));
  const sub = newCtx(info.file, ctx.t, ctx.path, ctx.resolved);
  sub.started = ctx.started;
  sub.guards = ctx.guards;
  sub.maxIdl = Math.max(0, ...args.map(idlOf));
  const base = sub.maxIdl;
  if (!fn.body) return P(ctx.t, base, ctx.path);
  if (ts.isBlock(fn.body)) evalBlock(fn.body.statements, scope, sub);
  else {
    const v = evalExpr(fn.body, scope, sub);
    sub.returns.push({ v: consume(v, sub), t: sub.t, path: sub.path });
  }
  absorb(ctx, sub);
  const ret = maxBy(sub.returns.map((r) => ({ fin: Math.max(r.t, r.v?.fin ?? 0), idl: Math.max(r.v?.idl ?? 0), path: r.v && r.v.fin > r.t ? r.v.path : r.path, v: r.v })), 'fin');
  const fin = Math.max(sub.t, ret?.fin ?? 0);
  const idl = Math.max(sub.maxIdl, ret?.idl ?? 0);
  const pth = ret && ret.fin >= sub.t ? ret.path : sub.path;
  const out = P(fin, idl, pth, { ck: new Set(sub.cachedAll) });
  if (ret?.v?.k === 'obj' || ret?.v?.items) Object.assign(out, ret.v.k === 'obj' ? { k: 'obj', props: ret.v.props } : { items: ret.v.items });
  return out;
}
function absorb(ctx, sub) {
  ctx.leaves += sub.leaves;
  ctx.loops.push(...sub.loops);
  ctx.fanouts += sub.fanouts;
  for (const t of sub.tables) ctx.tables.add(t);
  ctx.getUser.push(...sub.getUser);
  ctx.calls.push(...sub.calls);
  ctx.jsx.push(...sub.jsx);
  for (const k of sub.cachedAll) ctx.cachedAll.add(k);
}

/** The memoised summary of a top-level function: rounds relative to its own start, params ready at 0. */
const nodeIds = new WeakMap();
let nextNodeId = 1;
function summarize(info, resolved = new Set()) {
  if (!nodeIds.has(info.fn)) nodeIds.set(info.fn, nextNodeId++);
  const key = `${nodeIds.get(info.fn)}|${[...resolved].sort().join(',')}`;
  if (memo.has(key)) return memo.get(key);
  if (inProgress.has(info.fn)) return { cp: 0, ideal: 0, path: [], base: null, render: { cp: 0, ideal: 0, path: [], kids: [] }, leaves: 0, loops: [], fanouts: 0, tables: new Set(), getUser: [], calls: [], cachedAll: new Set(), cycle: true };
  inProgress.add(info.fn);
  const file = info.file;
  const fn = info.fn;
  const scope = new Scope(null, file);
  const ctx = newCtx(file, 0, [], resolved);
  fn.parameters.forEach((p) => bindPattern(p.name, V(0, 0, []), scope, ctx));
  if (fn.body) {
    if (ts.isBlock(fn.body)) evalBlock(fn.body.statements, scope, ctx);
    else {
      const v = evalExpr(fn.body, scope, ctx);
      ctx.returns.push({ v: consume(v, ctx), t: ctx.t, path: ctx.path });
    }
  }
  let cp = ctx.t;
  let ideal = ctx.maxIdl;
  let pth = ctx.path;
  for (const r of ctx.returns) {
    const f = Math.max(r.t, r.v?.fin ?? 0);
    if (f > cp) {
      cp = f;
      pth = r.v && r.v.fin > r.t ? r.v.path : r.path;
    }
    ideal = Math.max(ideal, r.v?.idl ?? 0);
  }
  if (info.cached === 'data') {
    cp = 0;
    ideal = 0;
    pth = [];
  }
  // Rendering: async server children start when this component has returned.
  const parts = [];
  const atReturn = new Set([...ctx.resolved, ...ctx.cachedAll]);
  for (const j of ctx.jsx) {
    const s = summarize(j.info, atReturn);
    const rc = renderCost(s, j.props ?? new Set());
    if (rc.cp === 0 && j.propsFin <= cp) continue;
    parts.push({
      fin: Math.max(cp + rc.cp, j.propsFin),
      idl: j.propsIdl + rc.ideal,
      unless: j.unless ?? [],
      kid: { label: j.label, file: rel(j.info.file.abs), at: j.at, cp: rc.cp, ideal: rc.ideal, suspense: j.suspense },
      entry: { call: `<${j.label}>`, file: rel(j.info.file.abs), at: j.at, r: rc.cp, sub: rc.path, suspense: j.suspense },
    });
  }
  const base = { cp, ideal: Math.min(ideal, cp), path: pth, parts };
  const { cp: rcp, ideal: rideal, path: rpath, kids } = renderCost({ base }, new Set());
  const out = {
    cp,
    ideal: Math.min(ideal, cp),
    path: pth,
    base,
    render: { cp: rcp, ideal: Math.min(rideal, rcp), path: rpath, kids },
    leaves: ctx.leaves,
    loops: ctx.loops,
    fanouts: ctx.fanouts,
    tables: ctx.tables,
    getUser: ctx.getUser,
    calls: ctx.calls,
    cached: info.cached,
    cachedAll: ctx.cachedAll,
  };
  inProgress.delete(info.fn);
  memo.set(key, out);
  return out;
}

/** A component's full render cost, given the props its parent passed (a `prop ?? <Default/>` child drops out). */
function renderCost(s, props) {
  const b = s.base;
  if (!b) return s.render ?? { cp: 0, ideal: 0, path: [], kids: [] };
  let cp = b.cp;
  let ideal = b.ideal;
  let path = b.path;
  const kids = [];
  for (const part of b.parts) {
    if (part.unless.some((u) => props.has(u))) continue;
    kids.push(part.kid);
    if (part.fin > cp) {
      cp = part.fin;
      path = [...b.path, part.entry];
    }
    ideal = Math.max(ideal, part.idl);
  }
  return { cp, ideal: Math.min(ideal, cp), path, kids };
}

function fnLabel(info) {
  return `${rel(info.file.abs)}:${info.name ?? 'anonymous'}`;
}

/** Resolve a callee expression to a function value. */
function calleeFn(expr, scope, ctx) {
  if (ts.isIdentifier(expr)) {
    const v = scope.get(expr.text);
    if (v && v.k === 'fn') return v;
    if (v) return null;
    const sym = resolveName(ctx.file, expr.text);
    const info = asFunction(sym);
    return info ? { k: 'fn', info } : null;
  }
  if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression)) {
    const sym = resolveName(ctx.file, expr.expression.text);
    if (sym?.ns) {
      const info = asFunction(resolveExport(sym.file, expr.name.text));
      return info ? { k: 'fn', info } : null;
    }
  }
  return null;
}

function callFn(fv, args, ctx, node, argVals) {
  const info = fv.info;
  if (info.file.isClient) return V(ctx.t, Math.max(0, ...args.map(idlOf)), ctx.path);
  const argIdl = Math.max(0, ...args.map(idlOf));
  const promiseArgs = args.filter((a) => a && (a.k === 'p' || a.k === 'pa' || a.k === 'lazy')).map((a) => consume(a, ctx));
  const argFin = Math.max(0, ...promiseArgs.map((a) => a.fin));
  if (fv.closure) {
    const r = runInline(info, fv.closure, args, ctx, argVals);
    const fin = Math.max(r.fin, argFin);
    const delta = r.fin - ctx.t;
    const out = { ...r, fin, idl: Math.max(r.idl, ...promiseArgs.map((a) => a.idl)), path: delta > 0 ? [...ctx.path, { call: info.name ?? 'closure', at: `${rel(info.file.abs)}:${lineOf(info.file, info.fn)}`, r: delta, sub: r.path.slice(ctx.path.length) }] : r.path };
    return out;
  }
  const ckey = info.cached === 'react' ? fnLabel(info) : null;
  if (ckey && ctx.resolved.has(ckey)) return V(ctx.t, argIdl, ctx.path);
  if (ckey && ctx.started.has(ckey)) return ctx.started.get(ckey);
  const s = summarize(info, ctx.resolved);
  for (const k of s.cachedAll) ctx.cachedAll.add(k);
  if (ckey) ctx.cachedAll.add(ckey);
  ctx.leaves += s.leaves;
  ctx.loops.push(...s.loops);
  ctx.fanouts += s.fanouts;
  for (const t of s.tables) ctx.tables.add(t);
  ctx.getUser.push(...s.getUser);
  ctx.calls.push({ label: fnLabel(info), cached: info.cached, reads: s.leaves, cp: s.cp, deduped: [...s.cachedAll].some((k) => k.startsWith('askedOnce:')) });
  const fin = Math.max(ctx.t + s.cp, argFin);
  const idl = Math.max(argIdl + s.ideal, ...promiseArgs.map((a) => a.idl));
  const pth = s.cp > 0 && ctx.t + s.cp >= argFin ? [...ctx.path, { call: fnLabel(info), at: `${rel(ctx.file.abs)}:${lineOf(ctx.file, node)}`, r: s.cp, sub: s.path }] : promiseArgs.length && argFin > ctx.t ? maxBy(promiseArgs, 'fin').path : ctx.path;
  const ck = new Set(s.cachedAll);
  if (ckey) ck.add(ckey);
  if (s.cp === 0 && !promiseArgs.length) {
    if (ckey) ctx.resolved.add(ckey);
    return V(ctx.t, argIdl, ctx.path);
  }
  const out = P(fin, idl, pth, { ck });
  if (ckey) ctx.started.set(ckey, out);
  return out;
}

function leafLabel(call, ctx) {
  const e = call.expression;
  const name = ts.isPropertyAccessExpression(e) ? e.name.text : e.getText(ctx.file.sf);
  const a0 = call.arguments[0];
  const lit = a0 && (ts.isStringLiteral(a0) || ts.isNoSubstitutionTemplateLiteral(a0)) ? a0.text : a0 ? '…' : '';
  return `${name}(${lit})`;
}

function receiverRoot(e) {
  while (ts.isPropertyAccessExpression(e) || ts.isCallExpression(e) || ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e) || ts.isAwaitExpression(e) || ts.isElementAccessExpression(e)) e = e.expression;
  return e;
}

function evalCall(n, scope, ctx) {
  const callee = n.expression;
  // Promise.* combinators
  if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && callee.expression.text === 'Promise') {
    const m = callee.name.text;
    if (m === 'all' || m === 'allSettled' || m === 'race' || m === 'any') {
      const a0 = n.arguments[0];
      let items;
      if (a0 && ts.isArrayLiteralExpression(a0)) {
        const vals = a0.elements.map((el) => (ts.isSpreadElement(el) ? evalExpr(el.expression, scope, ctx) : evalExpr(el, scope, ctx)));
        items = vals.map((v) => consume(v, ctx));
      } else items = a0 ? [consume(evalExpr(a0, scope, ctx), ctx)] : [];
      if (a0 && !ts.isArrayLiteralExpression(a0) && items[0]?.items) items = items[0].items;
      const mm = maxBy(items, 'fin');
      const fin = Math.max(ctx.t, mm?.fin ?? 0);
      return P(fin, Math.max(0, ...items.map((i) => i.idl ?? 0)), mm && mm.fin > ctx.t ? mm.path : ctx.path, { items: items.map((i) => V(i.fin, i.idl, i.path)), ck: unionCk(items) });
    }
    if (m === 'resolve' || m === 'reject') {
      const v = n.arguments[0] ? evalExpr(n.arguments[0], scope, ctx) : null;
      return v ? consume(v, ctx) : V(ctx.t, 0, ctx.path);
    }
  }
  if (ts.isIdentifier(callee) && TERMINAL.has(callee.text)) {
    // redirect() / notFound() throw: the branch that reaches one is not a normal open of THIS page.
    n.arguments.forEach((a) => evalExpr(a, scope, ctx));
    ctx.returned = true;
    ctx.terminal = true;
    return V(ctx.t, 0, ctx.path);
  }
  if (ts.isIdentifier(callee) && BACKGROUND.has(callee.text)) return V(ctx.t, 0, ctx.path);
  if (ts.isIdentifier(callee) && callee.text === 'fetch') {
    const args = n.arguments.map((a) => evalExpr(a, scope, ctx));
    ctx.leaves++;
    const label = `fetch(${(n.arguments[0]?.getText(ctx.file.sf) ?? '').slice(0, 40)})`;
    return P(ctx.t + 1, Math.max(0, ...args.map(idlOf)) + 1, [...ctx.path, label]);
  }
  if (ts.isPropertyAccessExpression(callee)) {
    const m = callee.name.text;
    // .then / .catch / .finally
    if (m === 'then' || m === 'catch' || m === 'finally') {
      const recv = consume(evalExpr(callee.expression, scope, ctx), ctx);
      if (m !== 'then') {
        n.arguments.forEach((a) => !isFnLike(a) && evalExpr(a, scope, ctx));
        return recv;
      }
      const cb = n.arguments[0];
      if (!cb) return recv;
      const save = { t: ctx.t, path: ctx.path };
      ctx.t = recv.fin;
      ctx.path = recv.path;
      let r;
      const cbv = isFnLike(cb) ? { k: 'fn', info: { fn: unwrap(cb), file: ctx.file, name: 'then-callback', cached: null }, closure: scope } : evalExpr(cb, scope, ctx);
      if (cbv && cbv.k === 'fn') {
        const argVal = recv.items ? { ...V(recv.fin, recv.idl, recv.path), k: 'arr', items: recv.items } : V(recv.fin, recv.idl, recv.path);
        r = cbv.closure ? runInline(cbv.info, cbv.closure, [argVal], ctx, [argVal]) : callFn(cbv, [argVal], ctx, n, [argVal]);
        r = consume(r, ctx);
      } else r = recv;
      ctx.t = save.t;
      ctx.path = save.path;
      return P(Math.max(recv.fin, r.fin), Math.max(recv.idl, r.idl), r.fin >= recv.fin ? r.path : recv.path, { ck: unionCk([recv, r]), ...(r.items ? { items: r.items } : r.k === 'obj' ? { k: 'obj', props: r.props } : {}) });
    }
    // array fan-out: xs.map(cb) where cb starts reads
    if ((m === 'map' || m === 'flatMap' || m === 'forEach') && n.arguments[0] && isFnLike(n.arguments[0])) {
      const recv = evalExpr(callee.expression, scope, ctx);
      const cbInfo = { fn: unwrap(n.arguments[0]), file: ctx.file, name: `${m}-callback`, cached: null };
      const save = { t: ctx.t, path: ctx.path };
      const r = runInline(cbInfo, scope, [recv], ctx, [V(ctx.t, idlOf(recv), ctx.path)]);
      ctx.t = save.t;
      ctx.path = save.path;
      if (m === 'forEach' || r.fin <= ctx.t) return V(ctx.t, Math.max(idlOf(recv), r.idl), ctx.path);
      ctx.fanouts++;
      return { k: 'pa', fin: r.fin, idl: Math.max(r.idl, idlOf(recv)), path: [...ctx.path, { call: `fan-out .${m}()`, at: `${rel(ctx.file.abs)}:${lineOf(ctx.file, n)}`, r: r.fin - ctx.t, sub: r.path.slice(ctx.path.length) }] };
    }
    // Supabase leaves
    const root = receiverRoot(callee.expression);
    const rootName = ts.isIdentifier(root) ? root.text : '';
    if (m === 'from' && n.arguments.length >= 1 && !NON_DB_FROM.has(rootName) && !(ts.isIdentifier(callee.expression) && NON_DB_FROM.has(callee.expression.text))) {
      const recv = evalExpr(callee.expression, scope, ctx);
      const args = n.arguments.map((a) => evalExpr(a, scope, ctx));
      const isStorage = ts.isPropertyAccessExpression(callee.expression) && callee.expression.name.text === 'storage';
      ctx.leaves++;
      const label = `${isStorage ? 'storage' : 'from'}(${n.arguments[0] && ts.isStringLiteral(n.arguments[0]) ? n.arguments[0].text : '…'})`;
      if (!isStorage) ctx.tables.add(label.slice(5, -1));
      return { k: 'lazy', idl0: Math.max(idlOf(recv), ...args.map(idlOf)), label };
    }
    if (m === 'rpc' && n.arguments.length >= 1) {
      const recv = evalExpr(callee.expression, scope, ctx);
      const args = n.arguments.map((a) => evalExpr(a, scope, ctx));
      ctx.leaves++;
      const label = leafLabel(n, ctx);
      ctx.tables.add(label);
      return { k: 'lazy', idl0: Math.max(idlOf(recv), ...args.map(idlOf)), label };
    }
    if (ts.isPropertyAccessExpression(callee.expression) && callee.expression.name.text === 'auth' && (m === 'getUser' || m === 'refreshSession')) {
      evalExpr(callee.expression, scope, ctx);
      ctx.leaves++;
      ctx.getUser.push(`${rel(ctx.file.abs)}:${lineOf(ctx.file, n)}`);
      return P(ctx.t + 1, 1, [...ctx.path, `auth.${m}`]);
    }
    if (ts.isPropertyAccessExpression(callee.expression) && ts.isPropertyAccessExpression(callee.expression.expression) && callee.expression.expression.name.text === 'auth' && callee.expression.name.text === 'admin') {
      ctx.leaves++;
      n.arguments.forEach((a) => evalExpr(a, scope, ctx));
      return P(ctx.t + 1, 1, [...ctx.path, `auth.admin.${m}`]);
    }
    if (m === 'send' && n.arguments[0] && ts.isNewExpression(n.arguments[0]) && /Command$/.test(n.arguments[0].expression.getText(ctx.file.sf))) {
      ctx.leaves++;
      return P(ctx.t + 1, 1, [...ctx.path, `r2.${n.arguments[0].expression.getText(ctx.file.sf)}`]);
    }
    if (m === 'invoke' && ts.isPropertyAccessExpression(callee.expression) && callee.expression.name.text === 'functions') {
      ctx.leaves++;
      return P(ctx.t + 1, 1, [...ctx.path, 'functions.invoke']);
    }
    // method on a lazy builder keeps it lazy
    const fv = calleeFn(callee, scope, ctx);
    if (!fv) {
      const recv = evalExpr(callee.expression, scope, ctx);
      const args = n.arguments.map((a) => (isFnLike(a) ? null : evalExpr(a, scope, ctx)));
      if (recv && recv.k === 'lazy') return { k: 'lazy', idl0: Math.max(recv.idl0, ...args.map(idlOf)), label: recv.label };
      return unknownCall(n, [recv, ...args], scope, ctx);
    }
    const args = n.arguments.map((a) => (isFnLike(a) ? { k: 'fn', info: { fn: unwrap(a), file: ctx.file, name: 'callback', cached: null }, closure: scope } : evalExpr(a, scope, ctx)));
    return callFn(fv, args.filter((a) => a && a.k !== 'fn'), ctx, n, args);
  }
  // askedOnce(client, 'question', [key…], fn) — lib/request-once.ts: ONE answer per render per question and key.
  if (ts.isIdentifier(callee) && callee.text === 'askedOnce' && n.arguments.length >= 4 && isFnLike(n.arguments[3])) {
    const q = n.arguments[1];
    const ckey = `askedOnce:${q && ts.isStringLiteral(q) ? q.text : q?.getText(ctx.file.sf)}:${n.arguments[2].getText(ctx.file.sf)}`;
    if (ctx.resolved.has(ckey)) return V(ctx.t, 0, ctx.path);
    if (ctx.started.has(ckey)) return ctx.started.get(ckey);
    const r = runInline({ fn: unwrap(n.arguments[3]), file: ctx.file, name: 'askedOnce', cached: 'react' }, scope, [], ctx);
    ctx.cachedAll.add(ckey);
    const out = { ...r, ck: new Set([...(r.ck ?? []), ckey]) };
    ctx.started.set(ckey, out);
    return out;
  }
  // cache(fn) / unstable_cache(fn) inline: a function value
  if (ts.isIdentifier(callee) && (callee.text === 'cache' || callee.text === 'unstable_cache') && n.arguments[0] && isFnLike(n.arguments[0])) {
    return { k: 'fn', info: { fn: unwrap(n.arguments[0]), file: ctx.file, name: callee.text, cached: callee.text === 'cache' ? 'react' : 'data' }, closure: callee.text === 'cache' ? scope : null };
  }
  // IIFE
  if (isFnLike(callee)) {
    const info = { fn: unwrap(callee), file: ctx.file, name: 'iife', cached: null };
    return runInline(info, scope, [], ctx);
  }
  const fv = calleeFn(callee, scope, ctx);
  if (fv) {
    if (fv.info.cached === 'data' && fv.closure === null) {
      n.arguments.forEach((a) => evalExpr(a, scope, ctx));
      return V(ctx.t, 0, ctx.path);
    }
    const argVals = n.arguments.map((a) => (isFnLike(a) ? { k: 'fn', info: { fn: unwrap(a), file: ctx.file, name: 'callback', cached: null }, closure: scope } : evalExpr(a, scope, ctx)));
    const r = callFn(fv, argVals.filter((a) => a && a.k !== 'fn'), ctx, n, argVals);
    // a callback handed to a resolved helper: assume the helper runs it now
    const cbs = argVals.filter((a) => a && a.k === 'fn');
    if (cbs.length) {
      const runs = cbs.map((cb) => consume(runInline(cb.info, cb.closure, [], ctx), ctx));
      const m = maxBy([r.k === 'p' ? r : null, ...runs].filter(Boolean), 'fin');
      if (m && m.fin > ctx.t) return P(m.fin, Math.max(idlOf(r), ...runs.map((x) => x.idl)), m.path);
    }
    return r;
  }
  const calleeVal = evalExpr(callee, scope, ctx);
  const args = n.arguments.map((a) => (isFnLike(a) ? null : evalExpr(a, scope, ctx)));
  return unknownCall(n, [calleeVal, ...args], scope, ctx);
}

/** A call we cannot follow (an npm function, a method on an object). It waits for any promise handed to it, and runs any callback handed to it now. */
function unknownCall(n, vals, scope, ctx) {
  const live = vals.filter(Boolean);
  const promises = live.filter((v) => v.k === 'p' || v.k === 'pa' || v.k === 'lazy').map((v) => consume(v, ctx));
  const runs = n.arguments.filter(isFnLike).map((a) => consume(runInline({ fn: unwrap(a), file: ctx.file, name: 'callback', cached: null }, scope, [], ctx), ctx));
  const all = [...promises, ...runs].filter((r) => r.fin > ctx.t || r.k === 'p');
  const idl = Math.max(0, ...live.map(idlOf), ...runs.map((r) => r.idl));
  if (!all.length) return V(ctx.t, idl, ctx.path);
  const m = maxBy(all, 'fin');
  return P(Math.max(ctx.t, m.fin), idl, m.fin > ctx.t ? m.path : ctx.path);
}

const unwrap = (n) => {
  while (ts.isParenthesizedExpression(n)) n = n.expression;
  return n;
};
const isFnLike = (n) => {
  n = unwrap(n);
  return ts.isArrowFunction(n) || ts.isFunctionExpression(n);
};

function evalJsx(n, scope, ctx, suspense) {
  const opening = ts.isJsxElement(n) ? n.openingElement : ts.isJsxSelfClosingElement(n) ? n : null;
  let inSuspense = suspense;
  if (opening) {
    const tag = opening.tagName;
    const tagText = tag.getText(ctx.file.sf);
    if (tagText === 'Suspense' || tagText === 'React.Suspense') inSuspense = true;
    const attrVals = [];
    const propNames = new Set();
    for (const a of opening.attributes.properties) {
      if (ts.isJsxAttribute(a)) propNames.add(a.name.getText(ctx.file.sf));
      if (ts.isJsxAttribute(a) && a.initializer) {
        if (ts.isJsxExpression(a.initializer) && a.initializer.expression) {
          const ex = a.initializer.expression;
          attrVals.push(isFnLike(ex) ? null : evalExpr(ex, scope, ctx));
        }
      } else if (ts.isJsxSpreadAttribute(a)) attrVals.push(evalExpr(a.expression, scope, ctx));
    }
    if (/^[A-Z]/.test(tagText) || tagText.includes('.')) {
      const fv = calleeFn(tag, scope, ctx);
      if (fv && !fv.info.file.isClient && fv.info.fn) {
        const live = attrVals.filter(Boolean);
        const promised = live.filter((v) => v.k === 'p' || v.k === 'pa' || v.k === 'lazy').map((v) => consume(v, ctx));
        ctx.jsx.push({ info: fv.info, label: tagText, at: `${rel(ctx.file.abs)}:${lineOf(ctx.file, n)}`, propsIdl: Math.max(0, ...live.map(idlOf)), propsFin: Math.max(0, ...promised.map((p) => p.fin)), suspense: inSuspense, props: propNames, unless: [...ctx.guards] });
      }
    }
  }
  const kids = ts.isJsxElement(n) || ts.isJsxFragment(n) ? n.children : [];
  for (const c of kids) {
    if (ts.isJsxExpression(c) && c.expression) evalExprJsx(c.expression, scope, ctx, inSuspense);
    else if (ts.isJsxElement(c) || ts.isJsxSelfClosingElement(c) || ts.isJsxFragment(c)) evalJsx(c, scope, ctx, inSuspense);
  }
  return V(ctx.t, 0, ctx.path);
}
function evalExprJsx(e, scope, ctx, suspense) {
  const before = ctx.jsx.length;
  const v = evalExpr(e, scope, ctx);
  if (suspense) for (let i = before; i < ctx.jsx.length; i++) ctx.jsx[i].suspense = true;
  return v;
}

function evalExpr(n, scope, ctx) {
  if (!n) return V(ctx.t, 0, ctx.path);
  if (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isNonNullExpression(n) || ts.isTypeAssertionExpression?.(n) || (ts.isSatisfiesExpression && ts.isSatisfiesExpression(n))) return evalExpr(n.expression, scope, ctx);
  if (ts.isAwaitExpression(n)) {
    const v = consume(evalExpr(n.expression, scope, ctx), ctx);
    if (TRACE && v.fin > ctx.t && rel(ctx.file.abs).includes(TRACE)) console.error(`await +${v.fin - ctx.t} @${rel(ctx.file.abs)}:${lineOf(ctx.file, n)} (t ${ctx.t}→${v.fin})`);
    if (v.fin > ctx.t) {
      ctx.t = v.fin;
      ctx.path = v.path;
    }
    ctx.maxIdl = Math.max(ctx.maxIdl, v.idl ?? 0);
    if (v.ck) for (const k of v.ck) ctx.resolved.add(k);
    const out = V(ctx.t, v.idl ?? 0, ctx.path);
    if (v.items) {
      out.k = 'arr';
      out.items = v.items;
    }
    if (v.k === 'obj') {
      out.k = 'obj';
      out.props = v.props;
    }
    return out;
  }
  if (ts.isCallExpression(n)) return evalCall(n, scope, ctx);
  if (ts.isIdentifier(n)) {
    const v = scope.get(n.text);
    if (v) return v;
    const info = asFunction(resolveName(ctx.file, n.text));
    if (info) return { k: 'fn', info };
    return V(0, 0, []);
  }
  if (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) return { k: 'fn', info: { fn: n, file: ctx.file, name: 'closure', cached: null }, closure: scope };
  if (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) {
    if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression)) {
      const sym = !scope.get(n.expression.text) && resolveName(ctx.file, n.expression.text);
      if (sym?.ns) {
        const info = asFunction(resolveExport(sym.file, n.name.text));
        if (info) return { k: 'fn', info };
      }
    }
    const recv = evalExpr(n.expression, scope, ctx);
    if (ts.isElementAccessExpression(n)) evalExpr(n.argumentExpression, scope, ctx);
    if (recv && recv.k === 'obj' && ts.isPropertyAccessExpression(n) && recv.props.has(n.name.text)) return recv.props.get(n.name.text);
    if (recv && recv.k === 'lazy') return recv;
    if (recv && (recv.k === 'p' || recv.k === 'pa')) return recv; // `.then` on it is handled at the call
    return V(recv?.fin ?? ctx.t, idlOf(recv), recv?.path ?? ctx.path);
  }
  if (ts.isNewExpression(n)) {
    const name = n.expression.getText(ctx.file.sf);
    if (name === 'Promise' && n.arguments?.[0] && isFnLike(n.arguments[0])) return runInline({ fn: unwrap(n.arguments[0]), file: ctx.file, name: 'new Promise', cached: null }, scope, [], ctx);
    const args = (n.arguments ?? []).map((a) => evalExpr(a, scope, ctx));
    return V(ctx.t, Math.max(0, ...args.map(idlOf)), ctx.path);
  }
  if (ts.isConditionalExpression(n) && knownCondition(n.condition, ctx) !== null) {
    return evalExpr(knownCondition(n.condition, ctx) ? n.whenTrue : n.whenFalse, scope, ctx);
  }
  if (ts.isConditionalExpression(n)) {
    evalExpr(n.condition, scope, ctx);
    let va;
    let vb;
    const a = branch(ctx, () => (va = evalExpr(n.whenTrue, scope, ctx)));
    const b = branch(ctx, () => (vb = evalExpr(n.whenFalse, scope, ctx)));
    if (isErrorTest(n.condition, ctx)) {
      mergeHappy(ctx, [a, b]);
      ctx.returned = false;
      return a.t <= b.t ? va : vb;
    }
    merge(ctx, [a, b]);
    ctx.returned = false;
    return pickVal(va, vb, ctx);
  }
  if (ts.isBinaryExpression(n)) {
    const op = n.operatorToken.kind;
    if (op === ts.SyntaxKind.EqualsToken || op === ts.SyntaxKind.QuestionQuestionEqualsToken || op === ts.SyntaxKind.BarBarEqualsToken) {
      const v = evalExpr(n.right, scope, ctx);
      if (ts.isIdentifier(n.left)) scope.set(n.left.text, v);
      return v;
    }
    const l = evalExpr(n.left, scope, ctx);
    if (op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) {
      let vr;
      // `prop ?? <Default/>`: the default is drawn only when the parent did NOT pass `prop`.
      const guard = op !== ts.SyntaxKind.AmpersandAmpersandToken && ts.isIdentifier(n.left) ? n.left.text : null;
      if (guard) ctx.guards.push(guard);
      const o = branch(ctx, () => (vr = evalExpr(n.right, scope, ctx)));
      if (guard) ctx.guards.pop();
      if (o.t > ctx.t) {
        ctx.t = o.t;
        ctx.path = o.path;
      }
      return pickVal(l, vr, ctx);
    }
    const r = evalExpr(n.right, scope, ctx);
    return V(ctx.t, Math.max(idlOf(l), idlOf(r)), ctx.path);
  }
  if (ts.isArrayLiteralExpression(n)) {
    const items = n.elements.map((el) => evalExpr(ts.isSpreadElement(el) ? el.expression : el, scope, ctx));
    return { k: 'arr', items, fin: ctx.t, idl: Math.max(0, ...items.map(idlOf)), path: ctx.path };
  }
  if (ts.isObjectLiteralExpression(n)) {
    const props = new Map();
    let idl = 0;
    for (const p of n.properties) {
      if (ts.isPropertyAssignment(p)) {
        const v = isFnLike(p.initializer) ? { k: 'fn', info: { fn: unwrap(p.initializer), file: ctx.file, name: p.name.getText(ctx.file.sf), cached: null }, closure: scope } : evalExpr(p.initializer, scope, ctx);
        props.set(p.name.getText(ctx.file.sf), v);
        idl = Math.max(idl, idlOf(v));
      } else if (ts.isShorthandPropertyAssignment(p)) {
        const v = evalExpr(p.name, scope, ctx);
        props.set(p.name.text, v);
        idl = Math.max(idl, idlOf(v));
      } else if (ts.isSpreadAssignment(p)) {
        const v = evalExpr(p.expression, scope, ctx);
        if (v && v.k === 'obj') for (const [k, x] of v.props) props.set(k, x);
        idl = Math.max(idl, idlOf(v));
      }
    }
    return { k: 'obj', props, fin: ctx.t, idl, path: ctx.path };
  }
  if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) return evalJsx(n, scope, ctx, false);
  if (ts.isTemplateExpression(n)) {
    let idl = 0;
    for (const s of n.templateSpans) idl = Math.max(idl, idlOf(evalExpr(s.expression, scope, ctx)));
    return V(ctx.t, idl, ctx.path);
  }
  if (ts.isTaggedTemplateExpression(n)) return V(ctx.t, 0, ctx.path);
  if (ts.isVoidExpression(n)) {
    const v = evalExpr(n.expression, scope, ctx);
    if (v && v.k === 'lazy') consume(v, ctx);
    return V(ctx.t, 0, ctx.path);
  }
  if (ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n) || ts.isTypeOfExpression(n) || ts.isDeleteExpression(n) || ts.isSpreadElement(n)) {
    const v = evalExpr(n.operand ?? n.expression, scope, ctx);
    return V(ctx.t, idlOf(v), ctx.path);
  }
  if (ts.isClassExpression?.(n)) return V(ctx.t, 0, ctx.path);
  let idl = 0;
  ts.forEachChild(n, (c) => {
    if (ts.isExpression?.(c) || ts.isJsxElement(c)) idl = Math.max(idl, idlOf(evalExpr(c, scope, ctx)));
  });
  return V(ctx.t, idl, ctx.path);
}
function pickVal(a, b, ctx) {
  const fa = a ? (a.k === 'lazy' ? -1 : (a.fin ?? 0)) : -2;
  const fb = b ? (b.k === 'lazy' ? -1 : (b.fin ?? 0)) : -2;
  if (a && a.k === 'lazy') return a;
  if (b && b.k === 'lazy') return b;
  if (a && (a.k === 'p' || a.k === 'pa') && !(b && (b.k === 'p' || b.k === 'pa') && fb > fa)) return a;
  if (b && (b.k === 'p' || b.k === 'pa')) return b;
  return V(ctx.t, Math.max(idlOf(a), idlOf(b)), ctx.path);
}

// ───────────────────────────── routes ─────────────────────────────
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (p === path.join(APP, 'dev') || e.name === 'node_modules' || e.name.startsWith('_')) continue;
      walk(p, out);
    } else if (/^page\.(tsx|ts)$/.test(e.name)) out.push(p);
  }
  return out;
}

function routeOf(pageAbs) {
  const segs = path.relative(APP, path.dirname(pageAbs)).split(path.sep).filter(Boolean);
  const url = segs.filter((s) => !/^\(.*\)$/.test(s) && !s.startsWith('@')).map((s) => s.replace(/^\((\.{1,3})\)/, '')).join('/');
  const slot = segs.find((s) => s.startsWith('@'));
  const intercept = segs.some((s) => /^\(\.{1,3}\)/.test(s));
  return { url: '/' + url, slot, intercept };
}

function roleOf(url, pageSum) {
  if (url.startsWith('/admin')) return 'admin';
  if (url.startsWith('/vendor-dashboard') || url.startsWith('/open-shop') || url.startsWith('/site-editor')) return 'supplier';
  if (url.startsWith('/dashboard')) return 'host';
  if (url.startsWith('/[slug]') || url.startsWith('/join') || url.startsWith('/wall') || url.startsWith('/live') || url.startsWith('/panood') || url.startsWith('/i/')) return 'guest';
  if (url.startsWith('/papic')) return 'guest/host';
  if (url.startsWith('/receipts') || url.startsWith('/pay') || url.startsWith('/proposals') || url.startsWith('/claim') || url.startsWith('/host')) return 'signed-in';
  return pageSum?.getUser?.length ? 'public (session-aware)' : 'public';
}

function segmentChain(pageAbs) {
  const out = [];
  let d = path.dirname(pageAbs);
  const chain = [];
  while (d.startsWith(APP)) {
    chain.unshift(d);
    if (d === APP) break;
    d = path.dirname(d);
  }
  for (const dir of chain) {
    for (const n of ['layout.tsx', 'layout.ts']) {
      const p = path.join(dir, n);
      if (fs.existsSync(p)) out.push({ kind: 'layout', abs: p });
    }
  }
  const loading = chain.some((dir) => fs.existsSync(path.join(dir, 'loading.tsx')));
  return { layouts: out, loading };
}

function analyseFile(abs, exportName) {
  const f = loadFile(abs);
  if (!f) return null;
  const sym = resolveExport(f, exportName);
  const info = asFunction(sym);
  if (!info) return null;
  info.name = exportName === 'default' ? path.basename(abs) : exportName;
  return { info, s: summarize(info), file: f };
}

function flattenPath(pth, depth = 0, out = []) {
  for (const st of pth) {
    if (typeof st === 'string') out.push({ d: depth, label: st, r: 1 });
    else {
      out.push({ d: depth, label: st.call, file: st.file, at: st.at, r: st.r, suspense: st.suspense });
      if (st.sub && depth < 6) flattenPath(st.sub, depth + 1, out);
    }
  }
  return out;
}

function analyseRoute(pageAbs) {
  const r = routeOf(pageAbs);
  const { layouts, loading } = segmentChain(pageAbs);
  const segs = [];
  const page = analyseFile(pageAbs, 'default');
  if (page) segs.push({ kind: 'page', abs: pageAbs, ...page });
  const meta = analyseFile(pageAbs, 'generateMetadata');
  if (meta) segs.push({ kind: 'page:generateMetadata', abs: pageAbs, ...meta });
  for (const l of layouts) {
    const a = analyseFile(l.abs, 'default');
    if (a) segs.push({ kind: 'layout', abs: l.abs, ...a });
    const lm = analyseFile(l.abs, 'generateMetadata');
    if (lm) segs.push({ kind: 'layout:generateMetadata', abs: l.abs, ...lm });
  }
  const worst = maxBy(segs.map((s) => ({ ...s, rcp: s.s.render.cp })), 'rcp');
  const now = Math.max(0, ...segs.map((s) => s.s.render.cp));
  const ideal = Math.max(0, ...segs.map((s) => s.s.render.ideal));
  // duplicate reads: the same uncached loader called from two segments (or twice in one)
  const seen = new Map();
  for (const s of segs) {
    if (s.kind.endsWith('generateMetadata')) continue;
    for (const c of s.s.calls) {
      // A duplicate worth fixing: a loader that costs rounds, not cache()d, not deduped inside (askedOnce).
      if (!c.reads || c.cached || !(c.cp > 0) || c.deduped) continue;
      const k = c.label;
      if (!seen.has(k)) seen.set(k, new Set());
      seen.get(k).add(rel(s.abs));
    }
  }
  const metaDupes = [];
  const pageCalls = new Set((page?.s.calls ?? []).filter((c) => c.reads && !c.cached && c.cp > 0 && !c.deduped).map((c) => c.label));
  for (const c of meta?.s.calls ?? []) if (c.reads && !c.cached && c.cp > 0 && !c.deduped && pageCalls.has(c.label)) metaDupes.push(c.label);
  const dupes = [...seen].filter(([, set]) => set.size > 1).map(([k]) => k);
  const pageFile = page?.file;
  return {
    route: r.url,
    file: rel(pageAbs),
    slot: r.slot ?? null,
    intercept: r.intercept,
    role: roleOf(r.url, page?.s),
    now,
    ideal: now > 0 ? Math.max(1, ideal) : 0,
    worstSegment: worst ? `${worst.kind} ${rel(worst.abs)}` : null,
    chain: worst ? flattenPath(worst.s.render.path) : [],
    segments: segs.map((s) => ({ kind: s.kind, file: rel(s.abs), now: s.s.render.cp, body: s.s.cp, ideal: s.s.render.ideal, reads: s.s.leaves, kids: s.s.render.kids?.filter((k) => k.cp > 0).map((k) => ({ label: k.label, file: k.file, at: k.at, cp: k.cp, ideal: k.ideal, suspense: k.suspense })), chain: flattenPath(s.s.render.path).filter((c) => c.d <= 2) })),
    reads: segs.reduce((a, s) => a + s.s.leaves, 0),
    loops: [...new Map(segs.flatMap((s) => s.s.loops).map((l) => [l.at, l])).values()],
    getUser: [...new Set(segs.flatMap((s) => s.s.getUser))].filter((g) => !g.startsWith('lib/auth.ts')),
    dupes,
    metaDupes,
    loading,
    config: pageFile?.config ?? {},
    isClientPage: Boolean(pageFile?.isClient),
  };
}

// ───────────────────────────── main ─────────────────────────────
const argv = process.argv.slice(2);
const opt = (k) => {
  const i = argv.indexOf(k);
  return i >= 0 ? argv[i + 1] : undefined;
};
const only = opt('--route');
const pages = walk(APP).sort();
const results = [];
for (const p of pages) {
  const r = routeOf(p);
  if (only && r.url !== only && rel(p) !== only) continue;
  CACHED_HUB_ROUTE = /\/cached(\/|$)/.test(r.url);
  memo.clear();
  try {
    results.push(analyseRoute(p));
  } catch (err) {
    results.push({ route: r.url, file: rel(p), error: String(err?.stack ?? err).split('\n').slice(0, 3).join(' | ') });
  }
}
if (argv.includes('--explain')) {
  for (const r of results) {
    console.log(`\n${r.route}  (${r.file})  role=${r.role}  now=${r.now}  ideal=${r.ideal}  reads=${r.reads}`);
    if (r.error) console.log('  ERROR', r.error);
    for (const s of r.segments ?? []) {
      console.log(`  · ${s.kind} ${s.file}: now ${s.now} (body ${s.body}) ideal ${s.ideal} reads ${s.reads}`);
      for (const k of s.kids ?? []) console.log(`      child <${k.label}> ${k.at}: ${k.cp} (ideal ${k.ideal})${k.suspense ? ' [Suspense]' : ''}`);
    }
    console.log('  critical path:');
    for (const c of r.chain ?? []) console.log(`  ${'  '.repeat(c.d + 1)}${c.label}${c.at ? ` @${c.at}` : ''} [${c.r}]${c.suspense ? ' [Suspense]' : ''}`);
    if (r.loops?.length) console.log('  loops:', r.loops.map((l) => `${l.at} ×${l.perItem}`).join(', '));
    if (r.getUser?.length) console.log('  direct auth.getUser:', r.getUser.join(', '));
    if (r.dupes?.length) console.log('  uncached loader in 2+ segments:', r.dupes.join(', '));
    if (r.metaDupes?.length) console.log('  generateMetadata repeats the page read (uncached):', r.metaDupes.join(', '));
  }
}
const jsonOut = opt('--json');
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ generatedAt: new Date().toISOString(), loopN: LOOP_N, pages: results }, null, 1));
if (!argv.includes('--explain')) {
  const errs = results.filter((r) => r.error).length;
  console.log(`${results.length} pages · ${errs} errors · over 3 rounds: ${results.filter((r) => r.now > 3).length}`);
}
