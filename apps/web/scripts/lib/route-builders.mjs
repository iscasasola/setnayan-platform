/**
 * route-builders.mjs — A LINK BUILT BY `lib/routes.ts` IS RESOLVED, NEVER SKIPPED (Add 47, 26 Nov 2026).
 *
 * The house rule says every in-app link comes from a `lib/routes.ts` builder (design-and-wiring A3). Three guards
 * (`lint-email-links`, `lint-port-no-lost-controls`, and the page guards that pin a link) used to read links as
 * LITERAL TEXT only — so moving a link onto its builder made the guard report a lost door or an unreadable link,
 * and the rule and the guards could not both hold. The ruling (Main Controller + owner): the builders win, and
 * the guards learn to read them.
 *
 * What this does, for one `routes.<chain>(<args>)` call:
 *   1. Loads the REAL `lib/routes.ts` with Node alone (built-in type stripping; see `loadRoutes`) — never a copy of it.
 *   2. Calls the builder with its own arguments. A value the guard cannot know (a variable, a property, a call)
 *      becomes the dynamic-segment placeholder `[seg]`; string, number and object literals keep their value, so
 *      `routes.vendorDashboard.customers({ door: 'asking' })` resolves to `/vendor-dashboard/customers?door=asking`.
 *   3. `routeExists(url)` asks whether that address is a screen in `lib/ugat/screens.generated.json` — the
 *      generated map of every screen — matching a `[param]` route segment against `[seg]` or any concrete value.
 *
 * A call this cannot evaluate is REPORTED by the caller, never silently passed.
 */
import { readFileSync, readdirSync, statSync, writeFileSync, mkdtempSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { stripTypeScriptTypes } from 'node:module';
import { pathToFileURL } from 'node:url';
import { join, dirname, relative, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SEG = '[seg]';
const SENTINEL = '__SN_SEG__';

let routesModule = null;

/**
 * Load `lib/routes.ts` and the app modules it imports WITH NODE ALONE — no tsx, no node_modules. In CI these guards run
 * in the `guards` job BEFORE dependencies are installed, so a loader that needs a package cannot run there. Node 22's
 * built-in `stripTypeScriptTypes` turns each .ts file into JavaScript; `@/…` and relative imports are rewritten to the
 * converted copies in a temp folder. A package import (anything not `@/` or relative) is refused loudly: the builders
 * must stay plain, dependency-free functions for this guard to read them.
 */
function convertGraph(entryAbs, outDir) {
  const done = new Map();
  const visit = (abs) => {
    if (done.has(abs)) return done.get(abs);
    const out = join(outDir, relative(WEB, abs)).replace(/\.tsx?$/, '.mjs');
    done.set(abs, out);
    let code = stripTypeScriptTypes(readFileSync(abs, 'utf8'), { mode: 'transform' });
    // Only real module statements at the start of a line — `import … from '…'`, `export … from '…'`, `import '…'` —
    // never a word like an object key named `import:` inside the code.
    code = code.replace(/^(\s*(?:import|export)\b[^;'"`]*?\bfrom\s*|\s*import\s+)(['"])([^'"]+)\2/gm, (whole, pre, q, spec) => {
      let target;
      if (spec.startsWith('@/')) target = join(WEB, spec.slice(2));
      else if (spec.startsWith('.')) target = resolvePath(dirname(abs), spec);
      else throw new Error(`route-builders: ${relative(WEB, abs)} imports the package "${spec}"; the route builders must stay dependency-free`);
      const file = ['', '.ts', '.tsx', '/index.ts'].map((e) => target + e).find((f) => existsSync(f) && statSync(f).isFile());
      if (!file) throw new Error(`route-builders: cannot find "${spec}" imported by ${relative(WEB, abs)}`);
      return `${pre}${q}${pathToFileURL(visit(file)).href}${q}`;
    });
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, code);
    return out;
  };
  return visit(entryAbs);
}

/** The app's own `routes` object, loaded once. */
export async function loadRoutes() {
  if (routesModule) return routesModule;
  const outDir = mkdtempSync(join(tmpdir(), 'sn-route-builders-'));
  const entry = convertGraph(join(WEB, 'lib/routes.ts'), outDir);
  routesModule = (await import(pathToFileURL(entry).href)).routes;
  if (!routesModule || typeof routesModule !== 'object') throw new Error('route-builders: lib/routes.ts exported no `routes` object');
  return routesModule;
}

/** A stand-in for any value the guard cannot know: every property, call and string conversion stays the stand-in. */
function unknownValue() {
  const target = function () {};
  const p = new Proxy(target, {
    get(_t, key) {
      if (key === Symbol.unscopables) return undefined;
      if (key === Symbol.toPrimitive || key === 'toString' || key === 'valueOf') return () => SENTINEL;
      if (key === 'length') return 1;
      return p;
    },
    apply() {
      return p;
    },
    has() {
      return true;
    },
  });
  return p;
}

/** Evaluate a call's argument text with every free identifier as an unknown value. */
function evaluateArgs(argText) {
  if (!argText.trim()) return [];
  const scope = new Proxy(
    {},
    {
      has: (_t, key) => typeof key === 'string' && !['undefined', 'null', 'true', 'false', 'NaN', 'Infinity'].includes(key),
      // `with` asks the scope for Symbol.unscopables; answering it would hide every name.
      get: (_t, key) => (key === Symbol.unscopables ? undefined : unknownValue()),
    },
  );
  // Sloppy-mode `with` puts the proxy in scope, so `day.slice(0, 7)` or `eventId` evaluate to the stand-in.
  // eslint-disable-next-line no-new-func
  return new Function('scope', `with (scope) { return [${argText}]; }`)(scope);
}

/** Split `a, b(c, d), { e: f }` at its top-level commas — the end of the call's argument list. */
export function readCallArgs(source, openParen) {
  let depth = 0;
  let quote = null;
  for (let i = openParen; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === '(' || ch === '{' || ch === '[') depth++;
    else if (ch === ')' || ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) return { argText: source.slice(openParen + 1, i), end: i + 1 };
    }
  }
  return null;
}

/**
 * Resolve one builder call. `chain` is `.vendorDashboard.customers`; `argText` its arguments.
 * Returns the address with every unknown value written as `[seg]`, or null when the chain names no builder.
 */
export function resolveBuilder(routes, chain, argText) {
  let fn = routes;
  for (const key of chain.split('.').filter(Boolean)) fn = fn?.[key];
  if (typeof fn !== 'function') return null;
  const out = String(fn(...evaluateArgs(argText)));
  return out.split(encodeURIComponent(SENTINEL)).join(SEG).split(SENTINEL).join(SEG);
}

/** Every `routes.<chain>(…)` call in a source text, resolved: `{ chain, url, index }` (url null = unresolved). */
export function resolveAllBuilderCalls(routes, source) {
  const out = [];
  const re = /\broutes((?:\.[A-Za-z_$][\w$]*)+)\s*\(/g;
  for (const m of source.matchAll(re)) {
    const open = m.index + m[0].length - 1;
    const call = readCallArgs(source, open);
    if (!call) {
      out.push({ chain: m[1], url: null, index: m.index, end: open + 1 });
      continue;
    }
    let url = null;
    try {
      url = resolveBuilder(routes, m[1], call.argText);
    } catch {
      url = null;
    }
    out.push({ chain: m[1], url, index: m.index, end: call.end });
  }
  return out;
}

let screenRoutes = null;
/** The screens the generated map knows, as route patterns (`/dashboard/[eventId]/budget`). */
export function loadScreenRoutes() {
  if (screenRoutes) return screenRoutes;
  const map = JSON.parse(readFileSync(join(WEB, 'lib/ugat/screens.generated.json'), 'utf8'));
  screenRoutes = (map.screens ?? []).map((s) => s.route).filter((r) => typeof r === 'string');
  if (screenRoutes.length < 100) throw new Error(`route-builders: screens.generated.json lists only ${screenRoutes.length} screens`);
  return screenRoutes;
}

let apiRoutes = null;
/** An `/api/…` address is a route HANDLER, not a screen: the screens map does not list them, `app/**\/route.ts` does. */
function loadApiRoutes() {
  if (apiRoutes) return apiRoutes;
  apiRoutes = [];
  const walk = (dir, rel) => {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name);
      if (statSync(abs).isDirectory()) walk(abs, name.startsWith('(') ? rel : `${rel}/${name}`);
      else if (name === 'route.ts') apiRoutes.push(rel);
    }
  };
  walk(join(WEB, 'app', 'api'), '/api');
  return apiRoutes;
}

/**
 * Does this address (query and hash ignored) name a real place? A screen in screens.generated.json — or, for an
 * `/api/…` address, a route handler.
 */
export function routeExists(url) {
  const path = url.split('#')[0].split('?')[0].replace(/\/+$/, '') || '/';
  const segs = path.split('/');
  for (const route of path.startsWith('/api/') ? loadApiRoutes() : loadScreenRoutes()) {
    const r = route.split('/');
    if (r.length !== segs.length) continue;
    let ok = true;
    for (let i = 0; i < r.length; i++) {
      if (r[i] === segs[i]) continue;
      if (r[i].startsWith('[') && r[i].endsWith(']') && segs[i] !== '') continue;
      ok = false;
      break;
    }
    if (ok) return true;
  }
  return false;
}

/**
 * Rewrite every `routes.<chain>(…)` call in `src` to the address it builds: inside a template (`${routes…(…)}`) as
 * plain text, on its own as a template literal. A call that does not resolve is left as it is. `onBuilder(url, file)`
 * hears each address. Used by the port lint and the email-link lint, so both read a builder the same way.
 */
export function inlineBuilderCalls(src, routes, onBuilder, file) {
  const calls = resolveAllBuilderCalls(routes, src);
  if (calls.length === 0) return src;
  let out = '';
  let at = 0;
  for (const c of calls) {
    if (c.index < at || !c.url || !c.url.startsWith('/')) continue;
    onBuilder?.(c.url, file);
    const inTemplate = src.slice(Math.max(0, c.index - 2), c.index) === '${' && src[c.end] === '}';
    if (inTemplate) {
      out += src.slice(at, c.index - 2) + c.url;
      at = c.end + 1;
    } else {
      out += src.slice(at, c.index) + '`' + c.url + '`';
      at = c.end;
    }
  }
  return out + src.slice(at);
}
