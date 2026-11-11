// The pure half of `scripts/feature-register-check.mjs` (Build 6 Lane M).
//
// The FEATURE REGISTER lives in the spec corpus (`FEATURE_REGISTER.md`, a
// separate, private repository). It is the one place a feature, its route, its
// price KEY and its ruling can be traced. A register kept by memory goes stale
// the week it is written, so this module compares it to the tree:
//
//   1. every page route the app serves has a row          (route census)
//   2. every catalogue SKU key has a row                    (live catalogue keys)
//   3. every NEXT_PUBLIC_* setting / feature flag has a row (source census)
//   4. every file a row points at still exists              (dead pointers)
//   5. every link on START_HERE.md resolves                 (dead doors)
//
// Everything here is a pure function over strings and injected readers, so the
// rules are unit-tested against fixtures in `scripts/feature-register-check.test.mjs`
// without the corpus, a database or node_modules.

import fs from 'node:fs';
import path from 'node:path';

/* ── 1. the route census ───────────────────────────────────────────────────*/

/**
 * The address a `page.tsx` serves, or null when it is not a page a person can
 * open by address. Route groups `(x)` and parallel slots `@x` add nothing to
 * the address; intercepting routes `(.)x` / `(..)x` draw over another page and
 * have no address of their own; `_x` folders are private (Next ignores them).
 *
 * @param {string} rel path relative to `apps/web/app`, '/'-separated, ending in page.tsx
 */
export function routeForPage(rel) {
  const parts = rel.split('/');
  if (!/^page\.(t|j)sx?$/.test(parts.pop() ?? '')) return null;
  const out = [];
  for (const seg of parts) {
    if (seg.startsWith('_')) return null;
    if (/^\(\.{1,3}\)/.test(seg) || seg.startsWith('(...)')) return null; // intercepting
    if (/^\(.*\)$/.test(seg)) continue; // route group
    if (seg.startsWith('@')) continue; // parallel slot
    out.push(seg);
  }
  return '/' + out.join('/');
}

/** `[eventId]`, `[id]`, `[...slug]`, `[[...slug]]` all become `[*]`. */
export function normaliseRoute(r) {
  let s = r.trim().replace(/[?#].*$/, '');
  s = s.replace(/\[\[?\.{0,3}[^\]/]*\]?\]/g, '[*]');
  if (s.length > 1) s = s.replace(/\/+$/, '');
  return s;
}

/** Pages that are plumbing or labs, not features (the register's own rule). */
export function isExcludedRoute(route) {
  return route === '/dev' || route.startsWith('/dev/') || route.startsWith('/api/');
}

/** Walk `appDir` and return every page address, normalised, sorted, unique. */
export function censusRoutes(appDir) {
  const found = new Set();
  const walk = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(path.join(dir, e.name), r);
      else if (/^page\.(t|j)sx?$/.test(e.name)) {
        const route = routeForPage(r);
        if (route && !isExcludedRoute(route)) found.add(normaliseRoute(route));
      }
    }
  };
  walk(appDir, '');
  return [...found].sort();
}

/* ── 2. reading the register ───────────────────────────────────────────────*/

/** Every `backticked` token in a markdown text. */
export function backticks(md) {
  return [...md.matchAll(/`([^`\n]+)`/g)].map((m) => m[1].trim());
}

/**
 * The routes the register names. A route is a backticked token that starts
 * with `/`; a trailing `/*` covers everything under it. Tokens that merely
 * mention a route inside prose (`/admin/ugat?tab=brain`) still count: the
 * register names the address, so a reader searching for it lands on a row.
 */
export function registerRoutes(md) {
  const exact = new Set();
  const prefixes = new Set();
  for (const raw of backticks(md)) {
    for (const tok of raw.split(/\s*(?:·|,|\s)\s*/)) {
      if (!tok.startsWith('/') || tok.startsWith('//')) continue;
      if (/[<>{}$]/.test(tok)) continue;
      let t = tok.replace(/[.,;:)]+$/, '');
      if (t.endsWith('/*')) {
        prefixes.add(normaliseRoute(t.slice(0, -2)));
        continue;
      }
      if (t.includes('*')) continue;
      exact.add(normaliseRoute(t));
    }
  }
  return { exact, prefixes };
}

export function routeIsCovered(route, { exact, prefixes }) {
  if (exact.has(route)) return true;
  for (const p of prefixes) if (route === p || route.startsWith(p + '/')) return true;
  return false;
}

/** Every token in the register a SKU key could be written as. */
export function registerTokens(md) {
  const set = new Set();
  for (const raw of backticks(md)) {
    set.add(raw);
    for (const tok of raw.split(/[\s·,/()]+/)) if (tok) set.add(tok);
  }
  return set;
}

/* ── 3. the NEXT_PUBLIC_* census ───────────────────────────────────────────*/

const TEST_FILE = /(\.test\.|\.spec\.|\/tests?\/|\/__tests__\/|\/e2e\/|\.stories\.)/;

/** Names of NEXT_PUBLIC_* settings read by a source text (fragments dropped). */
export function flagNamesIn(text) {
  const out = new Set();
  for (const m of text.matchAll(/\bNEXT_PUBLIC_[A-Z0-9_]+/g)) {
    const name = m[0];
    if (name.endsWith('_')) continue; // `NEXT_PUBLIC_OAUTH_${p}` — a template prefix
    // `NEXT_PUBLIC_OAUTH_` + `${...}` is caught above; a name directly followed by `${` is also a prefix
    const next = text.slice(m.index + name.length, m.index + name.length + 2);
    if (next === '${') continue;
    out.add(name);
  }
  return out;
}

/** Walk source roots and return { name → [files] } for every NEXT_PUBLIC_* read. */
export function censusFlags(roots, repoRoot) {
  const map = new Map();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.next', '.turbo', 'dist', 'out', 'coverage'].includes(e.name) || e.name.startsWith('.')) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(tsx?|mjs|cjs|js)$/.test(e.name)) {
        const rel = path.relative(repoRoot, p).split(path.sep).join('/');
        if (TEST_FILE.test('/' + rel)) continue;
        if (/\.generated\./.test(rel)) continue;
        for (const name of flagNamesIn(fs.readFileSync(p, 'utf8'))) {
          if (!map.has(name)) map.set(name, []);
          map.get(name).push(rel);
        }
      }
    }
  };
  for (const r of roots) if (fs.existsSync(r)) walk(r);
  return map;
}

/* ── 4. dead pointers ──────────────────────────────────────────────────────*/

const FILE_EXT = /\.(tsx?|mjs|cjs|js|sql|md|html|json|txt|css|docx|ya?ml|sh)$/;
const FILE_ROOTS = /^(app|lib|tests|scripts|supabase|apps|packages|src-tauri|prototypes|plans|registers|build-sessions|docs|changelog\.d|\d{2}_|\d{4}_)/;

/**
 * Backticked tokens that name a file or folder: a path with an extension, or
 * a known root folder (`app/…`, `lib/…`, `prototypes/…`, `NNNN_x/…`). Tokens
 * holding a placeholder (`<x>`), a glob, a home path or a URL are prose.
 */
export function pointerTokens(md) {
  const out = new Set();
  for (const raw of backticks(md)) {
    for (let tok of raw.split(/\s+(?:·|\+|or|and)?\s*/)) {
      tok = tok.replace(/[.,;:)]+$/, '').replace(/^\(/, '');
      if (!tok || tok.startsWith('/') || tok.startsWith('~') || tok.includes('://')) continue;
      if (/[<>{}$*?=|"']/.test(tok) || tok.includes('..')) continue;
      if (/\s/.test(tok)) continue;
      const looksFile = FILE_EXT.test(tok) && (tok.includes('/') || /^[A-Za-z0-9][\w.-]*\.(md|html|sql|docx|mjs)$/.test(tok));
      const looksDir = FILE_ROOTS.test(tok) && tok.includes('/');
      if (looksFile || looksDir) out.add(tok);
    }
  }
  return [...out].sort();
}

/** Relative markdown links `[x](path)` — external links and anchors skipped. */
export function markdownLinks(md) {
  const out = new Set();
  for (const m of md.matchAll(/\]\(([^)\s]+)\)/g)) {
    const href = m[1];
    if (/^(https?:|mailto:|#)/.test(href)) continue;
    out.add(href.replace(/#.*$/, ''));
  }
  return [...out].filter(Boolean).sort();
}

/**
 * Does a pointer resolve? It is tried against each base folder in turn (the
 * repo root, `apps/web`, `supabase/migrations`, the corpus), because the
 * register writes app paths relative to `apps/web` and corpus paths relative
 * to the corpus root. A pointer that resolves nowhere is dead.
 */
export function pointerExists(tok, bases, exists) {
  const clean = tok.replace(/\/$/, '');
  return bases.some((b) => exists(path.join(b, clean)));
}

/* ── 4b. no typed price ────────────────────────────────────────────────────*/

/**
 * Lines of the register that type a peso figure (`₱` followed by a digit).
 * CLAUDE.md: never derive a price from a file — the register carries SKU KEYS
 * and `scripts/print-prices.mjs` prints the numbers from the live catalogue.
 * A ruling title that contains a price is cited by the words before it.
 */
export function typedPrices(md) {
  return md.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /₱\s?\d/.test(l)).map(([n, l]) => `line ${n}: ${l.trim().slice(0, 100)}`);
}

/* ── 5. the verdict ────────────────────────────────────────────────────────*/

/**
 * @param {object} a
 * @param {string} a.register         FEATURE_REGISTER.md text
 * @param {string} [a.startHere]      START_HERE.md text
 * @param {string[]} a.routes         census of page routes (normalised)
 * @param {Map<string,string[]>} a.flags  NEXT_PUBLIC_* name → files reading it
 * @param {string[]|null} a.skus      live catalogue keys, or null when not read
 * @param {(tok:string)=>boolean} a.pointerOk
 * @param {(href:string)=>boolean} [a.linkOk]
 */
export function checkRegister(a) {
  const covered = registerRoutes(a.register);
  const tokens = registerTokens(a.register);
  const missingRoutes = a.routes.filter((r) => !routeIsCovered(r, covered));
  const missingFlags = [...a.flags.keys()].filter((f) => !tokens.has(f)).sort();
  const missingSkus = a.skus == null ? null : a.skus.filter((k) => !tokens.has(k)).sort();
  const deadPointers = pointerTokens(a.register).filter((t) => !a.pointerOk(t));
  let deadDoors = [];
  if (a.startHere != null) {
    const links = markdownLinks(a.startHere);
    const ptrs = pointerTokens(a.startHere);
    deadDoors = [
      ...links.filter((h) => !(a.linkOk ?? a.pointerOk)(h)),
      ...ptrs.filter((t) => !a.pointerOk(t)),
    ];
    deadDoors = [...new Set(deadDoors)].sort();
  }
  const rows = [
    { check: 'routes have a row', total: a.routes.length, misses: missingRoutes },
    { check: 'catalogue SKU keys have a row', total: a.skus?.length ?? 0, misses: missingSkus },
    { check: 'NEXT_PUBLIC_* settings have a row', total: a.flags.size, misses: missingFlags },
    { check: 'no price typed in the register', total: a.register.split('\n').length, misses: typedPrices(a.register) },
    { check: 'register pointers exist', total: pointerTokens(a.register).length, misses: deadPointers },
    { check: 'START_HERE links resolve', total: a.startHere == null ? 0 : markdownLinks(a.startHere).length + pointerTokens(a.startHere).length, misses: a.startHere == null ? null : deadDoors },
  ];
  const failed = rows.some((r) => Array.isArray(r.misses) && r.misses.length > 0);
  return { rows, failed };
}

/** One table, the misses under it. A skipped half says SKIPPED, never PASS. */
export function formatReport({ rows, failed }, { maxList = 40 } = {}) {
  const lines = [];
  const w = Math.max(...rows.map((r) => r.check.length));
  lines.push(`${'check'.padEnd(w)}  result`);
  lines.push(`${'-'.repeat(w)}  ------`);
  for (const r of rows) {
    const res = r.misses == null ? 'SKIPPED (not read — not a pass)' : r.misses.length ? `FAIL ${r.misses.length} of ${r.total}` : `ok (${r.total})`;
    lines.push(`${r.check.padEnd(w)}  ${res}`);
  }
  for (const r of rows) {
    if (!r.misses?.length) continue;
    lines.push('', `✗ ${r.check} — ${r.misses.length} missing:`);
    for (const m of r.misses.slice(0, maxList)) lines.push(`    ${m}`);
    if (r.misses.length > maxList) lines.push(`    … and ${r.misses.length - maxList} more (--all prints every one)`);
  }
  lines.push('', failed ? 'FEATURE REGISTER: OUT OF DATE — add the rows above to FEATURE_REGISTER.md (corpus) or fix the pointers.' : 'FEATURE REGISTER: every census item has a row.');
  return lines.join('\n');
}

/* ── 6. where the corpus is ────────────────────────────────────────────────*/

/**
 * The spec corpus folder (it holds FEATURE_REGISTER.md and START_HERE.md), or
 * null. Tried in order: `--corpus`, $SETNAYAN_SPECS_DIR, a sibling clone of
 * this repo (`../setnayan-specs`, `../Setnayan-specs`), and the owner's Mac
 * path `~/Documents/Claude/Projects/Setnayan`.
 */
export function findCorpus({ flag, env = process.env, repoRoot, home = env.HOME ?? '', exists = fs.existsSync } = {}) {
  const candidates = [
    flag,
    env.SETNAYAN_SPECS_DIR,
    repoRoot && path.resolve(repoRoot, '..', 'setnayan-specs'),
    repoRoot && path.resolve(repoRoot, '..', 'Setnayan-specs'),
    home && path.join(home, 'Documents', 'Claude', 'Projects', 'Setnayan'),
  ].filter(Boolean);
  return candidates.find((c) => exists(path.join(c, 'FEATURE_REGISTER.md'))) ?? null;
}

/**
 * The register's Prices section (section 7) as key → the first table row that
 * names it: { feature, whoPays }. Used by print-prices to say WHAT each key
 * unlocks next to its live number, so the printout can be traced.
 */
export function pricesIndex(md) {
  const start = md.search(/^## 7\. PRICES/m);
  if (start < 0) return new Map();
  const rest = md.slice(start);
  const end = rest.slice(3).search(/^## /m);
  const section = end < 0 ? rest : rest.slice(0, end + 3);
  const map = new Map();
  let header = null;
  for (const line of section.split('\n')) {
    if (!line.startsWith('|')) { header = null; continue; }
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.every((c) => /^-+$/.test(c))) continue;
    if (!header) { header = cells.map((c) => c.toLowerCase()); continue; }
    const keys = backticks(cells[0]).flatMap((t) => t.split(/[\s·,/]+/)).filter(Boolean);
    const fi = header.findIndex((h) => /unlocks|^what|feature/.test(h));
    const wi = header.findIndex((h) => /who pays/.test(h));
    for (const k of keys) {
      if (!map.has(k)) map.set(k, { feature: cells[fi >= 0 ? fi : 1] ?? '', whoPays: wi >= 0 ? cells[wi] : '' });
    }
  }
  return map;
}
