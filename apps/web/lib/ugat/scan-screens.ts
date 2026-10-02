/**
 * scan-screens.ts — read the app's own route tree and source, and report every
 * screen, every way in to it, and the Ugat node(s) it belongs to.
 *
 * Modelled on `lib/admin-map/scan-admin-routes.ts` and for the same reason:
 * 🔑 THE MAP IS SCANNED, NEVER TYPED. A hand-written list of screens is wrong
 * the day somebody adds a page; a hand-written list of doors is "a list of the
 * doors somebody thought of". So both come from the code, and a guard
 * (`scripts/check-ugat-screens.mjs`) refuses a committed map that has drifted.
 *
 * This module touches the filesystem, so it is for the generator, its tests
 * and its guard only. Application code imports `screens.generated.json` and the
 * pure helpers in `screens.ts`, never this.
 *
 * ── WHAT A SCREEN IS ────────────────────────────────────────────────────────
 * A folder holding `page.tsx` outside `app/admin` (the admin map owns those).
 * Route groups `(x)` and parallel-route slots `@x` drop out of the URL.
 * Intercepting routes `(.)x` are a second VIEW of a screen that already exists
 * (a modal over the launcher), not a place of their own, so they are skipped.
 * Dynamic segments are kept as written: `/dashboard/[eventId]/guests`.
 *
 * ── WHAT A DOOR IS ──────────────────────────────────────────────────────────
 * An address written where it will be FOLLOWED — never any string that merely
 * starts with a slash (a `revalidatePath`, a `startsWith` test and a cookie
 * `path` are not ways in). The anchors:
 *   href=/href:/…Href/url/…Url/link/…Link/destination/redirectTo/returnTo/route/path
 *   redirect( · permanentRedirect( · NextResponse.redirect(
 *   router.push/replace/prefetch( · location.href= · location.assign/replace( · window.open(
 *   routes.…() builders (lib/routes.ts, evaluated, so a builder is as good as a literal)
 *   lib/nav-registry-defaults.ts `route:` slots, with their phone/desktop area
 *   next.config.ts redirects (counted, but only as legacy — see screens.ts)
 * An address is resolved to a route pattern the way Next resolves it: a static
 * segment beats a dynamic one, which beats a catch-all. A `${x}` placeholder
 * fills a dynamic segment first. A leading `${base}` is inlined when the same
 * file declares `const base = '/…'`, treated as the site root when it is
 * plainly an origin (`SITE_URL`, `appUrl`…), and otherwise matched as a
 * SUFFIX — which may connect a screen but can never be reported broken.
 *
 * 🔑 A BROKEN DOOR MUST BE PROVABLY BROKEN. Only an address whose start is
 * known is ever reported, and only after it fails every page, route handler,
 * next.config redirect/rewrite, middleware legacy pattern and public/ file. A
 * guard that accuses correct code teaches people to ignore it.
 *
 * ── WHICH NODE ──────────────────────────────────────────────────────────────
 * The tables a screen's code reads (`.from('t')` in the page and in what it
 * imports, two hops deep), mapped through the SAME table → node binding
 * `concept-coverage` uses: a node's own `table`, then each joint's table and
 * claim tables onto the joint's pair. No table, no node: "unmapped" is
 * reported, never guessed.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { redirectTargetIn, rendersJsx } from '@/lib/admin-map/scan-admin-routes';
import { routes as ROUTE_BUILDERS } from '@/lib/routes';

import { UGAT_JOINTS, UGAT_TYPES } from './graph';
import {
  NON_CONNECTING_DOORS,
  areaForRoute,
  type BrokenDoor,
  type DoorKind,
  type DoorSurface,
  type LegacyRedirect,
  type ScreenDoor,
  type UgatScreen,
  type UgatScreensMap,
} from './screens';

/* ═══════════════════════════ route patterns ═══════════════════════════ */

type Seg =
  | { t: 'static'; v: string }
  | { t: 'dyn' }
  | { t: 'catch' }
  | { t: 'optcatch' };

type RouteKind = 'screen' | 'admin' | 'handler' | 'legacy';

interface RoutePattern {
  route: string;
  segs: Seg[];
  kind: RouteKind;
}

const PAGE_FILES = ['page.tsx', 'page.ts', 'page.jsx', 'page.js'];
const HANDLER_FILES = ['route.ts', 'route.tsx', 'route.js'];
/** Metadata files Next serves at a fixed address beside their folder. */
const METADATA_FILES: Record<string, string> = {
  'sitemap.ts': 'sitemap.xml',
  'robots.ts': 'robots.txt',
  'manifest.ts': 'manifest.webmanifest',
};

function parseSegs(route: string): Seg[] {
  return route
    .split('/')
    .filter(Boolean)
    .map((s): Seg => {
      if (/^\[\[\.\.\..+\]\]$/.test(s)) return { t: 'optcatch' };
      if (/^\[\.\.\..+\]$/.test(s)) return { t: 'catch' };
      if (/^\[.+\]$/.test(s)) return { t: 'dyn' };
      // next.config sources: `:slug` is one segment, `:path*` any number.
      if (/^:[\w]+\*$/.test(s)) return { t: 'optcatch' };
      if (/^:[\w]+\+$/.test(s)) return { t: 'catch' };
      if (/^:[\w]+$/.test(s)) return { t: 'dyn' };
      return { t: 'static', v: s };
    });
}

const isGroup = (s: string) => s.startsWith('(') && s.endsWith(')') && !/^\(\.{1,3}\)/.test(s);
const isIntercept = (s: string) => /^\(\.{1,3}\)/.test(s);

/** Folder (relative to app/) → URL. `null` for an intercepting route. */
export function urlForAppDir(relDir: string): string | null {
  const parts = relDir.split(/[\\/]/).filter(Boolean);
  if (parts.some(isIntercept)) return null;
  const segs = parts.filter((s) => !isGroup(s) && !s.startsWith('@'));
  return '/' + segs.join('/');
}

interface AppTree {
  /** page dirs relative to app/, sorted. */
  pageDirs: string[];
  handlers: string[];
}

function walkApp(appRoot: string): AppTree {
  const pageDirs: string[] = [];
  const handlers: string[] = [];
  const walk = (dir: string) => {
    let entries: string[];
    try {
      entries = readdirSync(dir).sort();
    } catch {
      return;
    }
    const rel = relative(appRoot, dir);
    if (entries.some((e) => PAGE_FILES.includes(e))) pageDirs.push(rel);
    if (entries.some((e) => HANDLER_FILES.includes(e))) handlers.push(rel);
    for (const [file, served] of Object.entries(METADATA_FILES)) {
      if (entries.includes(file)) handlers.push(join(rel, served));
    }
    for (const name of entries) {
      // `_x` is a private folder: Next never routes it.
      if (name === 'node_modules' || name.startsWith('.') || name.startsWith('_')) continue;
      const full = join(dir, name);
      try {
        if (statSync(full).isDirectory()) walk(full);
      } catch {
        /* unreadable */
      }
    }
  };
  walk(appRoot);
  return { pageDirs: pageDirs.sort(), handlers: handlers.sort() };
}

/* ═══════════════════════════ the tiny lexer ═══════════════════════════ */

/** A string or template literal found inside a door expression. */
export interface Lit {
  /** The text, every `${…}` replaced by \u0000. */
  value: string;
  /** For a template that STARTS with `${…}`: the expression inside it. */
  lead: string | null;
}

export const PH = '\u0000';

export function readQuoted(src: string, i: number): { end: number; value: string } {
  const q = src[i];
  let k = i + 1;
  let out = '';
  while (k < src.length && src[k] !== q) {
    if (src[k] === '\\') {
      out += src[k + 1] ?? '';
      k += 2;
      continue;
    }
    if (src[k] === '\n') break; // an unterminated quote is not a string
    out += src[k];
    k += 1;
  }
  return { end: k + 1, value: out };
}

/** Skip a balanced `${ … }` body starting just after `${`. Returns the index after `}`. */
function skipInterpolation(src: string, i: number): number {
  let depth = 0;
  let k = i;
  while (k < src.length) {
    const c = src[k];
    if (c === "'" || c === '"') {
      k = readQuoted(src, k).end;
      continue;
    }
    if (c === '`') {
      k = readTemplate(src, k).end;
      continue;
    }
    if (c === '{') depth += 1;
    else if (c === '}') {
      if (depth === 0) return k + 1;
      depth -= 1;
    }
    k += 1;
  }
  return k;
}

export function readTemplate(src: string, i: number): { end: number; lit: Lit } {
  let k = i + 1;
  let value = '';
  let lead: string | null = null;
  while (k < src.length && src[k] !== '`') {
    if (src[k] === '\\') {
      value += src[k + 1] ?? '';
      k += 2;
      continue;
    }
    if (src[k] === '$' && src[k + 1] === '{') {
      const close = skipInterpolation(src, k + 2);
      if (value === '' && lead === null) lead = src.slice(k + 2, close - 1);
      value += PH;
      k = close;
      continue;
    }
    value += src[k];
    k += 1;
  }
  return { end: k + 1, lit: { value, lead } };
}

export type ExprMode = 'paren' | 'brace' | 'value';

/**
 * Collect every literal in one expression starting at `i`. `paren`/`brace`
 * stop at the closer that balances an opener already consumed; `value` stops
 * at a depth-0 `,` `;` closer, or a line break that does not continue the
 * expression (a ternary or concatenation split over lines still continues).
 */
/**
 * Is the literal at `k` being COMPARED rather than followed? `x.startsWith('/a')`
 * and `p === '/a'` inside an href expression are a test about an address, not a
 * way to it — `heroUrl: path.startsWith('/papic/media/') ? … : …` read as a door
 * into /papic/media on the first run.
 */
function isComparedAt(src: string, k: number): boolean {
  const before = src.slice(Math.max(0, k - 24), k);
  return /(?:startsWith|endsWith|includes|indexOf|lastIndexOf|test|match)\(\s*$|[!=]==?\s*$/.test(before);
}

export function readExpr(src: string, i: number, mode: ExprMode): { end: number; lits: Lit[] } {
  const lits: Lit[] = [];
  let depth = 0;
  let k = i;
  while (k < src.length) {
    const c = src[k];
    if (c === "'" || c === '"') {
      const r = readQuoted(src, k);
      if (!isComparedAt(src, k)) lits.push({ value: r.value, lead: null });
      k = r.end;
      continue;
    }
    if (c === '`') {
      const r = readTemplate(src, k);
      if (!isComparedAt(src, k)) lits.push(r.lit);
      k = r.end;
      continue;
    }
    if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) return { end: k, lits };
      depth -= 1;
    } else if (mode === 'value' && depth === 0) {
      if (c === ',' || c === ';') return { end: k, lits };
      if (c === '\n') {
        let j = k + 1;
        while (j < src.length && /\s/.test(src[j]!)) j += 1;
        if (j >= src.length || !'?:+|&.'.includes(src[j]!)) return { end: k, lits };
      }
    }
    k += 1;
    if (k - i > 4000) break; // a runaway expression is not a door
  }
  return { end: k, lits };
}

/* ═══════════════════════════ door addresses ═══════════════════════════ */

type DSeg = { t: 'static'; v: string } | { t: 'wild'; re: RegExp | null };

interface DoorPath {
  /** `abs` = the start is known; `suffix` = a leading `${x}` we could not resolve. */
  mode: 'abs' | 'suffix';
  segs: DSeg[];
  /** Display form, placeholders shown as `*`. */
  text: string;
  /** Written with a trailing slash — `'/papic/media/' + key` — so one more segment may follow. */
  openTail: boolean;
  /**
   * The literal part of a last segment that ENDS in a placeholder:
   * `/api/website/qr${liveHref}` → `qr`. The placeholder may be a query, or
   * may be `/<slug>` — so the door is tried as both.
   */
  tailFused: string | null;
}

const ORIGIN_EXPR = /url|origin|host|domain|site/i;
const SETNAYAN_HOST = /^(?:www\.)?setnayan\.(?:com|ph)$/i;
/** A last segment that names a file, not a page — an asset, never a door. */
const ASSET_EXT = /\.(?:png|jpe?g|gif|webp|avif|svg|ico|mp4|webm|mov|mp3|wav|m4a|pdf|json|js|mjs|css|woff2?|ttf|otf|glb|gltf|hdr|ktx2|txt|xml|html|csv|zip|lottie|riv|webmanifest)$/i;

function toDoorPath(lit: Lit, bindings: Map<string, Lit>, depth = 0): DoorPath | null {
  let text = lit.value;
  let mode: DoorPath['mode'] = 'abs';

  const http = text.match(/^https?:\/\/([^/\u0000]+)(\/.*)?$/);
  if (http) {
    if (!SETNAYAN_HOST.test(http[1] ?? '')) return null;
    text = http[2] ?? '/';
  } else if (text.startsWith(PH)) {
    const expr = (lit.lead ?? '').trim();
    const bound = /^[A-Za-z_$][\w$]*$/.test(expr) ? bindings.get(expr) : undefined;
    if (bound && depth < 3) {
      return toDoorPath({ value: bound.value + text.slice(1), lead: bound.lead }, bindings, depth + 1);
    }
    text = text.slice(1);
    if (!ORIGIN_EXPR.test(expr)) mode = 'suffix';
  }

  if (!text.startsWith('/') || text.startsWith('//')) return null;
  const cut = text.search(/[?#]/);
  if (cut >= 0) text = text.slice(0, cut);
  const openTail = text.length > 1 && text.endsWith('/');
  const lastRaw = text.split('/').filter(Boolean).pop() ?? '';
  const tailFused =
    lastRaw.endsWith(PH) && lastRaw.length > 1 && !lastRaw.slice(0, -1).includes(PH)
      ? lastRaw.slice(0, -1)
      : null;
  if (/[\s'"<>{}\\|^]/.test(text) || text.length > 200) return null;
  // `/${x}` with nothing else known says nothing about where it goes.
  if (mode === 'suffix' && text.replace(/[/\u0000]/g, '') === '') return null;

  const raw = text.split('/').filter(Boolean);
  if (raw.length && ASSET_EXT.test(raw[raw.length - 1] ?? '')) return null;

  const segs: DSeg[] = raw.map((s): DSeg => {
    if (s === PH || /^\[.+\]$/.test(s) || /^:\w+$/.test(s)) return { t: 'wild', re: null };
    if (s.includes(PH)) {
      // `.*`, not `.+`: a placeholder fused to a segment's end is usually a
      // query string (`/shop${qs}`) and may be empty.
      const re = new RegExp(
        '^' + s.split(PH).map((p) => p.replace(/[.*+?^$()|[\]\\]/g, '\\$&')).join('.*') + '$',
      );
      return { t: 'wild', re };
    }
    return { t: 'static', v: s };
  });
  const shown = '/' + raw.map((s) => (s.includes(PH) ? s.split(PH).join('*') : s)).join('/');
  return { mode, segs, text: mode === 'suffix' ? `…${shown}` : shown, openTail, tailFused };
}

/**
 * Score a door against a route. Higher is a better (more specific) match, per
 * position, compared left to right — Next's own precedence: static, then
 * dynamic, then catch-all. A placeholder prefers a dynamic segment (it is
 * almost always an id or slug).
 */
function scoreMatch(door: DSeg[], route: Seg[]): number[] | null {
  const out: number[] = [];
  const go = (di: number, ri: number): boolean => {
    if (ri === route.length) return di === door.length;
    const r = route[ri]!;
    if (r.t === 'catch' || r.t === 'optcatch') {
      const remaining = door.length - di;
      if (r.t === 'catch' && remaining < 1) return false;
      for (let n = 0; n < remaining; n += 1) out.push(0);
      return ri === route.length - 1;
    }
    if (di === door.length) return false;
    const d = door[di]!;
    if (d.t === 'static') {
      if (r.t === 'static') {
        if (r.v !== d.v) return false;
        out.push(3);
      } else out.push(2);
    } else if (r.t === 'dyn') out.push(3);
    else {
      if (d.re && !d.re.test(r.v)) return false;
      out.push(1);
    }
    return go(di + 1, ri + 1);
  };
  return go(0, 0) ? out : null;
}

function cmpScore(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const d = (a[i] ?? -1) - (b[i] ?? -1);
    if (d) return d;
  }
  return 0;
}

/** Best-matching routes for a door (ties all returned). */
function resolveDoor(door: DoorPath, patterns: RoutePattern[]): RoutePattern[] {
  let best: number[] | null = null;
  let hits: RoutePattern[] = [];
  for (const p of patterns) {
    let score: number[] | null;
    if (door.mode === 'abs') score = scoreMatch(door.segs, p.segs);
    else {
      // Suffix: the unknown prefix is zero or more segments of the route (zero
      // when it was an origin passed in as a parameter).
      score = null;
      for (let skip = 0; skip < p.segs.length && !score; skip += 1) {
        if (p.segs.slice(0, skip).some((s) => s.t === 'catch' || s.t === 'optcatch')) break;
        score = scoreMatch(door.segs, p.segs.slice(skip));
      }
    }
    if (!score) continue;
    const c = best ? cmpScore(score, best) : 1;
    if (c > 0) {
      best = score;
      hits = [p];
    } else if (c === 0) hits.push(p);
  }
  return hits;
}

/* ═══════════════════════════ sources ═══════════════════════════ */

const SOURCE_ROOTS = ['app', 'lib', 'components'];
const SOURCE_FILES = ['middleware.ts', 'next.config.ts'];

function isSourceFile(rel: string): boolean {
  if (!/\.(ts|tsx)$/.test(rel) || rel.endsWith('.d.ts')) return false;
  if (/\.test\.tsx?$/.test(rel) || rel.includes('__tests__') || rel.includes('.generated.')) return false;
  // The builder definitions are not doors — their CALLS are.
  if (rel === 'lib/routes.ts') return false;
  return true;
}

export function listSources(webRoot: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries: string[];
    try {
      entries = readdirSync(dir).sort();
    } catch {
      return;
    }
    for (const name of entries) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const full = join(dir, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) walk(full);
      else {
        const rel = relative(webRoot, full).split(sep).join('/');
        if (isSourceFile(rel)) out.push(rel);
      }
    }
  };
  for (const r of SOURCE_ROOTS) walk(join(webRoot, r));
  for (const f of SOURCE_FILES) if (existsSync(join(webRoot, f))) out.push(f);
  return out.sort();
}

/** Where a source file sits decides what its doors are worth. */
function sourceKind(rel: string): DoorKind | null {
  if (rel.startsWith('app/admin/')) return 'admin';
  if (/^app\/(dev|prototype|demo-capture)\//.test(rel)) return 'internal';
  if (rel === 'next.config.ts') return 'legacy-redirect';
  if (/(^|\/)(sitemap[^/]*|robots|llms\.txt)(\/|\.ts$)/.test(rel)) return 'sitemap';
  if (rel === 'lib/nav-registry-defaults.ts') return 'nav-registry';
  if (/(^|\/)(emails?|notifications?|notify|push)(\/|[-.])|email|notif/i.test(rel)) return 'email';
  const base = rel.split('/').pop() ?? '';
  if (/nav|menu|sidebar|rail|bottom-?bar|top-?bar|tab-?bar|navigator|launcher/i.test(base)) return 'menu';
  return null;
}

function surfaceOf(text: string): DoorSurface {
  if (/bottom-?nav|bottom-?bar|mobile|phone|carousel/i.test(text)) return 'phone';
  if (/sidebar|desktop|rail|top-?bar|topbar/i.test(text)) return 'desktop';
  return 'both';
}

/* ═══════════════════════════ builders ═══════════════════════════ */

/** `routes.a.b` → the pattern its builder produces (args become `[p]`). */
export function builderPatterns(tree: unknown = ROUTE_BUILDERS): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (node: unknown, path: string) => {
    if (typeof node === 'function') {
      try {
        const args = Array.from({ length: Math.max(node.length, 3) }, (_, i) => `[p${i}]`);
        const v = (node as (...a: string[]) => unknown)(...args);
        if (typeof v === 'string') out.set(path, v);
      } catch {
        /* a builder that needs real input is not resolvable statically */
      }
      return;
    }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) walk(v, `${path}.${k}`);
    }
  };
  walk(tree, 'routes');
  return out;
}

/* ═══════════════════════════ tables → nodes ═══════════════════════════ */

export function tableNodeIndex(): Map<string, string[]> {
  const idx = new Map<string, Set<string>>();
  const add = (t: string, n: string) => {
    if (!idx.has(t)) idx.set(t, new Set());
    idx.get(t)!.add(n);
  };
  const own = new Set<string>();
  for (const t of UGAT_TYPES) {
    if (t.table) {
      add(t.table, t.id);
      own.add(t.table);
    }
  }
  for (const j of UGAT_JOINTS) {
    const tables = new Set<string>([...(j.joint ? [j.joint] : []), ...j.claims.map((c) => c.table)]);
    for (const tb of tables) {
      // A node's own table stays its own: `guests` named in a claim on the
      // Users↔Guests joint is still a Guests table, not a Users one.
      if (own.has(tb)) continue;
      for (const n of j.pair) add(tb, n);
    }
  }
  return new Map([...idx].map(([k, v]) => [k, [...v].sort()]));
}

const FROM_TABLE = /\.from\(\s*['"`]([a-z_][a-z0-9_]*)['"`]\s*\)/g;
const IMPORT_SPEC = /\b(?:import|export)\s[^;'"`]*?from\s*['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

/* ═══════════════════════════ the scan ═══════════════════════════ */

export interface ScanScreensOptions {
  /** `apps/web` (or a fixture shaped like it). */
  webRoot: string;
  /** Override the builder table (tests). */
  builders?: Map<string, string>;
  /** Override the table → node index (tests). */
  tableNodes?: Map<string, string[]>;
  /**
   * Called for every door that resolved to at least one screen — the Landing
   * check (part 2) reads its #section and its words from here. `at` indexes
   * `src` (comments stripped); `routes` are the screens it lands on.
   */
  onDoor?: (door: { from: string; at: number; src: string; address: string; routes: string[]; kind: DoorKind }) => void;
}

export function scanScreens(opts: ScanScreensOptions): UgatScreensMap {
  const { webRoot } = opts;
  const appRoot = join(webRoot, 'app');
  const builders = opts.builders ?? builderPatterns();
  const tableNodes = opts.tableNodes ?? tableNodeIndex();

  /* ── 1. the route tree ── */
  const tree = walkApp(appRoot);
  const patterns: RoutePattern[] = [];
  const screenDirs: Array<{ dir: string; route: string }> = [];
  for (const dir of tree.pageDirs) {
    const route = urlForAppDir(dir);
    if (route === null) continue;
    const isAdmin = route === '/admin' || route.startsWith('/admin/');
    patterns.push({ route, segs: parseSegs(route), kind: isAdmin ? 'admin' : 'screen' });
    if (!isAdmin) screenDirs.push({ dir, route });
  }
  for (const dir of tree.handlers) {
    const route = urlForAppDir(dir);
    if (route !== null) patterns.push({ route, segs: parseSegs(route), kind: 'handler' });
  }

  /* ── 2. read every source once ── */
  const sources = listSources(webRoot);
  const stripped = new Map<string, string>();
  const read = (rel: string): string | null => {
    if (stripped.has(rel)) return stripped.get(rel)!;
    let s: string | null = null;
    try {
      s = stripComments(readFileSync(join(webRoot, rel), 'utf8'));
    } catch {
      s = null;
    }
    stripped.set(rel, s ?? '');
    return s;
  };

  /* ── 3. legacy addresses: next.config redirects/rewrites + middleware ── */
  const legacyRedirects: LegacyRedirect[] = [];
  const cfg = read('next.config.ts') ?? '';
  for (const m of cfg.matchAll(/source:\s*'([^']+)'\s*,\s*destination:\s*'([^']+)'/g)) {
    const source = m[1]!;
    const destination = m[2]!;
    patterns.push({ route: source, segs: parseSegs(source), kind: 'legacy' });
    // Rewrites serve another file at the same address; only redirects SEND
    // someone holding an old address to a screen.
    const lastSection = Math.max(cfg.lastIndexOf('redirects()', m.index), cfg.lastIndexOf('rewrites()', m.index));
    if (lastSection >= 0 && cfg.startsWith('redirects()', lastSection)) {
      legacyRedirects.push({ source, destination });
    }
  }
  const mw = read('middleware.ts') ?? '';
  const legacyRegexes: RegExp[] = [];
  for (const m of mw.matchAll(/=\s*(\/\^\\\/[^\n]*?)\/([gimsuy]*)\s*;/g)) {
    try {
      legacyRegexes.push(new RegExp(m[1]!.slice(1), m[2]));
    } catch {
      /* not a regex literal after all */
    }
  }
  const legacyPrefixes = [...mw.matchAll(/startsWith\(\s*'(\/[^']*)'\s*\)/g)].map((m) => m[1]!);
  const publicFiles = new Set<string>();
  const walkPublic = (dir: string) => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const full = join(dir, name);
      try {
        if (statSync(full).isDirectory()) walkPublic(full);
        else publicFiles.add('/' + relative(join(webRoot, 'public'), full).split(sep).join('/'));
      } catch {
        /* unreadable */
      }
    }
  };
  walkPublic(join(webRoot, 'public'));

  /* ── 4. which screen owns a file (for self-links) ── */
  const screenByAppDir = new Map(screenDirs.map((s) => [s.dir.split(sep).join('/'), s.route]));
  const ownerScreen = (rel: string): string | null => {
    if (!rel.startsWith('app/')) return null;
    let d = dirname(rel.slice(4));
    for (;;) {
      const r = screenByAppDir.get(d === '.' ? '' : d);
      if (r !== undefined) return r;
      if (d === '.' || d === '') return null;
      d = dirname(d);
    }
  };

  /* ── 5. find the doors ── */
  const doorsByRoute = new Map<string, Map<string, ScreenDoor>>();
  const broken = new Map<string, BrokenDoor>();
  const addDoor = (route: string, door: ScreenDoor) => {
    if (!doorsByRoute.has(route)) doorsByRoute.set(route, new Map());
    const key = `${door.from}\u0000${door.kind}`;
    const prev = doorsByRoute.get(route)!.get(key);
    // One row per (file, kind); if a file has both a phone and a desktop door
    // into the same screen, it is a door on both.
    if (!prev) doorsByRoute.get(route)!.set(key, door);
    else if (prev.surface !== door.surface) prev.surface = 'both';
  };

  const isLegacyAddress = (door: DoorPath): boolean => {
    if (door.mode !== 'abs') return true;
    const sample = '/' + door.segs.map((s) => (s.t === 'static' ? s.v : 'x1')).join('/');
    if (publicFiles.has(sample) || publicFiles.has(`${sample}/index.html`)) return true;
    if (legacyRegexes.some((re) => re.test(sample))) return true;
    if (legacyPrefixes.some((p) => p.length > 1 && (sample + '/').startsWith(p.endsWith('/') ? p : `${p}/`))) return true;
    return false;
  };

  const handleDoor = (
    from: string,
    door: DoorPath | null,
    kind: DoorKind,
    surface: DoorSurface,
    weak = false,
  ) => {
    if (!door) return [] as string[];
    let hits = resolveDoor(door, patterns);
    if (hits.length === 0 && door.openTail) {
      hits = resolveDoor({ ...door, segs: [...door.segs, { t: 'wild', re: null }] }, patterns);
    }
    if (hits.length === 0 && door.tailFused) {
      const head = door.segs.slice(0, -1);
      hits = resolveDoor(
        { ...door, segs: [...head, { t: 'static', v: door.tailFused }, { t: 'wild', re: null }] },
        patterns,
      );
    }
    if (hits.length === 0) {
      // A `return '/x'` may be a door (a URL helper) or may not (any helper
      // returning a slash-string); it can connect a screen, never accuse.
      if (weak || isLegacyAddress(door)) return [] as string[];
      const key = `${from}\u0000${door.text}`;
      if (!broken.has(key)) broken.set(key, { from, to: door.text, kind });
      return [] as string[];
    }
    const owner = ownerScreen(from);
    const landed: string[] = [];
    for (const h of hits) {
      if (h.kind !== 'screen') continue;
      if (h.route === owner) continue; // a screen linking to itself is not a way in
      addDoor(h.route, { from, kind, surface });
      landed.push(h.route);
    }
    return landed;
  };
  const report = (from: string, at: number, src: string, lit: Lit, routes: string[], kind: DoorKind) => {
    if (opts.onDoor && routes.length) opts.onDoor({ from, at, src, address: lit.value.split(PH).join('*'), routes, kind });
  };

  const ANCHORS: Array<{ re: RegExp; kind: DoorKind; mode: ExprMode | 'attr' }> = [
    {
      re: /\b(?:href|[a-z][A-Za-z0-9]*Href|url|[a-z][A-Za-z0-9]*Url|link|[a-z][A-Za-z0-9]*Link|destination|redirectTo|returnTo|route|path)\s*(?:=(?![=>])|:(?!:))\s*/g,
      kind: 'link',
      mode: 'attr',
    },
    { re: /\b(?:redirect|permanentRedirect)\s*\(/g, kind: 'redirect', mode: 'paren' },
    {
      re: /\b(?:router|navigation|nav|r)\.(?:push|replace|prefetch)\s*\(|\blocation\.(?:assign|replace)\s*\(|\bwindow\.open\s*\(/g,
      kind: 'navigate',
      mode: 'paren',
    },
    { re: /\blocation\.href\s*=(?!=)\s*/g, kind: 'navigate', mode: 'value' },
  ];

  for (const rel of sources) {
    const src = read(rel);
    if (!src) continue;
    const fileKind = sourceKind(rel);
    const fileSurface = surfaceOf(rel.split('/').pop() ?? '');

    // Same-file bindings: `const base = \`/dashboard/${id}\`` so `${base}/guests` resolves.
    const bindings = new Map<string, Lit>();
    for (const m of src.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*(?=['"`])/g)) {
      const start = m.index! + m[0].length;
      const lit =
        src[start] === '`' ? readTemplate(src, start).lit : { value: readQuoted(src, start).value, lead: null };
      if (lit.value.startsWith('/') || lit.value.startsWith(PH) || /^https?:/.test(lit.value)) {
        if (!bindings.has(m[1]!)) bindings.set(m[1]!, lit);
      }
    }

    if (fileKind === 'nav-registry') {
      // Each slot: `area: "<where it renders>"` … `route: <address>`.
      for (const m of src.matchAll(/area:\s*"([^"]+)"[^{}]*?\broute:\s*/g)) {
        const { lits } = readExpr(src, m.index! + m[0].length, 'value');
        for (const lit of lits) {
          report(rel, m.index!, src, lit, handleDoor(rel, toDoorPath(lit, bindings), 'nav-registry', surfaceOf(m[1]!)), 'nav-registry');
        }
      }
      continue;
    }

    for (const a of ANCHORS) {
      for (const m of src.matchAll(a.re)) {
        const start = m.index! + m[0].length;
        let lits: Lit[];
        if (a.mode === 'attr') {
          const c = src[start];
          // `href="/x"` is exactly one string; reading on would swallow the
          // rest of the JSX line (`src=`, `alt=`) as if it were the address.
          if (c === '"' || c === "'") lits = [{ value: readQuoted(src, start).value, lead: null }];
          else if (c === '{') lits = readExpr(src, start + 1, 'brace').lits;
          else lits = readExpr(src, start, 'value').lits;
        } else lits = readExpr(src, start, a.mode).lits;
        for (const lit of lits) {
          report(rel, m.index!, src, lit, handleDoor(rel, toDoorPath(lit, bindings), fileKind ?? a.kind, fileSurface), a.kind);
        }
      }
    }

    // Named addresses: `export const YOU_PATH = '/signup/you'` is used as
    // `redirect(YOU_PATH)` in another file, where no literal is left to find.
    // And destination maps — `const NEXT_DESTINATIONS = { pool: '/papic/pool' }`
    // — whose values are followed by a lookup. Both weak: they connect, never accuse.
    for (const [name, lit] of bindings) {
      if (/(path|href|url|route|dest|link)s?$/i.test(name)) {
        handleDoor(rel, toDoorPath(lit, bindings), fileKind ?? 'link', fileSurface, true);
      }
    }
    for (const m of src.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*(?:path|href|url|route|dest|link|destination)s?)\s*(?::[^=\n]+)?=\s*\{/gi)) {
      const { lits } = readExpr(src, m.index! + m[0].length, 'brace');
      for (const lit of lits) {
        handleDoor(rel, toDoorPath(lit, bindings), fileKind ?? 'link', fileSurface, true);
      }
    }

    // URL helpers: `return \`/features/${slug}\`` — the caller's `href={helper()}`
    // names no address, so the helper's return IS the door. Weak: see handleDoor.
    for (const m of src.matchAll(/\breturn\s+(?=[`'"{(])/g)) {
      const { lits } = readExpr(src, m.index! + m[0].length, 'value');
      for (const lit of lits) {
        handleDoor(rel, toDoorPath(lit, bindings), fileKind ?? 'link', fileSurface, true);
      }
    }

    // routes.… builder calls, wherever they appear.
    for (const m of src.matchAll(/(?<![\w$.])routes((?:\.[A-Za-z_$][\w$]*)+)\s*\(/g)) {
      const pattern = builders.get(`routes${m[1]}`);
      if (!pattern) continue;
      handleDoor(rel, toDoorPath({ value: pattern, lead: null }, bindings), fileKind ?? 'builder', fileSurface);
    }
  }

  /* ── 6. tables → nodes, two import hops from each page ── */
  const resolveImport = (fromRel: string, spec: string): string | null => {
    let base: string;
    if (spec.startsWith('@/')) base = spec.slice(2);
    else if (spec.startsWith('.')) base = join(dirname(fromRel), spec).split(sep).join('/');
    else return null;
    for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx', '']) {
      const cand = base + ext;
      if (/\.(ts|tsx)$/.test(cand) && existsSync(join(webRoot, cand))) return cand;
    }
    return null;
  };
  const importsOf = new Map<string, string[]>();
  const importsFor = (rel: string): string[] => {
    if (importsOf.has(rel)) return importsOf.get(rel)!;
    const src = read(rel) ?? '';
    const out = new Set<string>();
    for (const m of src.matchAll(IMPORT_SPEC)) {
      const r = resolveImport(rel, (m[1] ?? m[2])!);
      if (r) out.add(r);
    }
    const list = [...out].sort();
    importsOf.set(rel, list);
    return list;
  };
  const tablesIn = (rel: string): string[] => {
    const src = read(rel) ?? '';
    const out: string[] = [];
    for (const m of src.matchAll(FROM_TABLE)) {
      // `storage.from('bucket')` names a bucket, not a table.
      if (/storage\s*$/.test(src.slice(Math.max(0, m.index! - 12), m.index!))) continue;
      out.push(m[1]!);
    }
    return out;
  };

  /* ── 7. assemble ── */
  const screens: UgatScreen[] = screenDirs.map(({ dir, route }) => {
    const relDir = dir.split(sep).join('/');
    const pageName = PAGE_FILES.find((f) => existsSync(join(appRoot, dir, f))) ?? 'page.tsx';
    const file = `app/${relDir ? `${relDir}/` : ''}${pageName}`;
    const raw = (() => {
      try {
        return readFileSync(join(webRoot, file), 'utf8');
      } catch {
        return '';
      }
    })();
    const isStub = redirectTargetIn(raw) !== null && !rendersJsx(raw);
    const target = isStub ? stubTarget(stripComments(raw)) : null;

    const seen = new Set<string>([file]);
    let frontier = [file];
    for (let hop = 0; hop < 2; hop += 1) {
      const next: string[] = [];
      for (const f of frontier) for (const i of importsFor(f)) if (!seen.has(i)) (seen.add(i), next.push(i));
      frontier = next;
    }
    const tables = [...new Set([...seen].flatMap(tablesIn))].sort();
    const mapped = tables.filter((t) => tableNodes.has(t));
    const nodes = [...new Set(mapped.flatMap((t) => tableNodes.get(t)!))].sort();

    const doors = [...(doorsByRoute.get(route)?.values() ?? [])].sort(
      (a, b) => a.from.localeCompare(b.from) || a.kind.localeCompare(b.kind),
    );
    const connected = doors.some((d) => !NON_CONNECTING_DOORS.has(d.kind));
    return {
      id: route,
      route,
      file,
      area: areaForRoute(route),
      status: isStub ? 'stub' : connected ? 'connected' : 'no-door',
      redirectsTo: isStub ? target : null,
      nodes,
      tables: mapped.sort(),
      doors,
    };
  });

  screens.sort((a, b) => a.route.localeCompare(b.route));
  const brokenDoors = [...broken.values()].sort(
    (a, b) => a.to.localeCompare(b.to) || a.from.localeCompare(b.from),
  );
  legacyRedirects.sort((a, b) => a.source.localeCompare(b.source));
  return { version: 1, screens, brokenDoors, legacyRedirects };
}

/**
 * Where a stub forwards, placeholders shown as `[…]`. The admin parser stops
 * at the first `${`, which turns every `/dashboard/${id}/studio` into
 * `/dashboard`; screens are mostly dynamic, so read the whole template. The
 * LAST non-sign-in redirect wins: a stub guards its door (`redirect('/login')`)
 * before it forwards.
 */
function stubTarget(src: string): string | null {
  let found: string | null = null;
  for (const m of src.matchAll(/\b(?:redirect|permanentRedirect)\s*\(/g)) {
    const { lits } = readExpr(src, m.index! + m[0].length, 'paren');
    const first = lits.find((l) => l.value.startsWith('/') || l.value.startsWith(PH));
    if (!first) continue;
    const shown = first.value.split(PH).join('[…]');
    if (/^\/login\b/.test(shown)) continue;
    found = shown;
  }
  return found;
}

/** One line per no-door screen — the slice-2 ratchet's baseline format. */
export function noDoorBaseline(map: UgatScreensMap): string {
  const lines = map.screens.filter((s) => s.status === 'no-door').map((s) => s.route);
  return lines.join('\n') + '\n';
}

/**
 * The committed form: ONE SCREEN PER LINE.
 *
 * 🔑 THIS FILE CHANGES WHENEVER A DOOR DOES, so two branches touching it is the
 * normal case, not the exception. Pretty-printed JSON spreads one screen over
 * dozens of lines and git conflicts on any two edits near each other; one line
 * per screen means two branches that change DIFFERENT screens merge cleanly,
 * and a real conflict names the one screen both changed.
 */
export function serializeScreensMap(map: UgatScreensMap): string {
  const block = (items: unknown[]) =>
    items.length ? `[\n${items.map((x) => JSON.stringify(x)).join(',\n')}\n]` : '[]';
  return (
    `{\n"version": ${map.version},\n` +
    `"screens": ${block(map.screens)},\n` +
    `"brokenDoors": ${block(map.brokenDoors)},\n` +
    `"legacyRedirects": ${block(map.legacyRedirects)}\n}\n`
  );
}
