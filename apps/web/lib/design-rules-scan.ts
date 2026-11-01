/**
 * design-rules-scan.ts — read every page on disk for the 2026-10-28 rules: back links that go home, the
 * shared back button, colour tokens, the shared dropdown.
 *
 * A TypeScript port of the audit's `scan.py` (corpus `audits/back_links_design_rules_2026-10-28/`), so the
 * guard (`lib/every-back-goes-home.test.ts`) and the generator (`scripts/gen-design-rules-baseline.ts`) count
 * exactly what the owner was shown. Touches the filesystem: for the guard and the generator only, never for
 * application code (that reads `lib/page-home.ts`).
 *
 * Two deliberate departures from scan.py, both so a guard never accuses correct code:
 *   · comments are stripped first (a comment explaining a colour is not a colour);
 *   · a link is NOT a back link when it is a bar's own row (`*-sidebar.tsx`, `*bottom-nav*.tsx`, `*rail*`),
 *     an exit ✕ (`aria-label="Exit"`), or a forward arrow drawn as a turned-round ArrowLeft (`rotate-180`).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

export const WEB = join(__dirname, '..');
const APP = join(WEB, 'app');

export type PageFile = { route: string; file: string };

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
}

let allFiles: string[] | null = null;
function appFiles(): string[] {
  if (!allFiles) {
    allFiles = [];
    walk(APP, allFiles);
  }
  return allFiles;
}

/** `app/dashboard/(account)/people/page.tsx` → `/dashboard/people`. Null for an intercepting route `(.)x`. */
export function routeOfPage(file: string): string | null {
  const rel = relative(APP, dirname(file));
  const parts = rel.split(sep).filter((x) => x && x !== '.');
  if (parts.some((x) => /^\(\.+\)/.test(x))) return null;
  const kept = parts.filter((x) => !(x.startsWith('(') && x.endsWith(')')) && !x.startsWith('@'));
  return kept.length ? `/${kept.join('/')}` : '/';
}

/** Every page on disk (intercepting routes are a second view of a page, not a page). */
export function listPages(): PageFile[] {
  return appFiles()
    .filter((f) => f.endsWith(`${sep}page.tsx`))
    .flatMap((f) => {
      const route = routeOfPage(f);
      return route ? [{ route, file: relative(WEB, f) }] : [];
    })
    .sort((a, b) => (a.route < b.route ? -1 : a.route > b.route ? 1 : a.file < b.file ? -1 : 1));
}

const sources = new Map<string, string>();
function read(rel: string): string {
  let s = sources.get(rel);
  if (s === undefined) {
    s = stripComments(readFileSync(join(WEB, rel), 'utf8'));
    sources.set(rel, s);
  }
  return s;
}

/** A page that only forwards (`redirect(…)` with nothing else to draw) — never a home. */
export function isRedirectStub(rel: string): boolean {
  const body = read(rel);
  return body.length < 1800 && /^\s*(?:return\s+)?(?:permanentRedirect|redirect)\(/m.test(body);
}

/** The files a page draws from: itself and its own `_components` (scan.py's scope). */
export function pageScope(rel: string): string[] {
  const out = [rel];
  const cd = join(WEB, dirname(rel), '_components');
  if (existsSync(cd)) {
    for (const f of readdirSync(cd).sort()) {
      if (f.endsWith('.tsx') && !f.includes('.test.')) out.push(relative(WEB, join(cd, f)));
    }
  }
  return out;
}

/** A bar's own rows are the way around, not back links. */
const BAR_FILE = /(?:-sidebar|bottom-nav|rail)[^/]*\.tsx$/;

export type BackLink = { kind: 'BackButton' | 'ad-hoc'; href: string; prop: 'href' | 'route'; file: string };

const BACK_BUTTON = /<BackButton\b[^>]*?\b(href|route)=\{?\s*[`'"]([^`'"]+)/g;
const AD_HOC =
  /<Link([^>]*?)href=\{?\s*[`'"]([^`'"]+)[`'"]\s*\}?([^>]*)>((?:(?!<\/Link>)[\s\S]){0,400}?)(?:ArrowLeft|ChevronLeft|‹|&lsaquo;|←|Back to|Back<)/g;

/** Every back link one file draws. */
export function backLinksIn(rel: string): BackLink[] {
  if (BAR_FILE.test(rel)) return [];
  const s = read(rel);
  const out: BackLink[] = [];
  for (const m of s.matchAll(BACK_BUTTON)) {
    out.push({ kind: 'BackButton', prop: m[1] as 'href' | 'route', href: m[2]!, file: rel });
  }
  for (const m of s.matchAll(AD_HOC)) {
    const tag = `${m[1]} ${m[3]}`;
    if (/aria-label="Exit"|data-maker-tool="exit"/.test(tag)) continue;
    // A forward arrow drawn as a turned-round ArrowLeft — the class sits just after the icon's name.
    if (/rotate-180/.test(s.slice(m.index! + m[0].length, m.index! + m[0].length + 120).split('/>')[0]!)) continue;
    out.push({ kind: 'ad-hoc', prop: 'href', href: m[2]!, file: rel });
  }
  return out;
}

const HEX = /(?<![\w&])#[0-9a-fA-F]{6}\b/g;
const PALETTE =
  /\b(?:text|bg|border|ring|from|to|fill|stroke)-(?:red|amber|emerald|green|yellow|blue|gray|slate|zinc|neutral|stone|orange|rose|pink|purple|indigo|sky|teal|lime)-\d{2,3}\b/g;
const SELECT = /<select\b/g;

export type DesignCounts = { hex: number; palette: number; select: number };

/** Raw hex colours, raw Tailwind palette colours and raw `<select>`s in one file. */
export function designCountsIn(rel: string): DesignCounts {
  const s = read(rel);
  return {
    hex: (s.match(HEX) ?? []).length,
    palette: (s.match(PALETTE) ?? []).length,
    select: (s.match(SELECT) ?? []).length,
  };
}

/** Every `.tsx` under app/ that is not a test — the files the colour / dropdown ratchet counts. */
export function appTsxFiles(): string[] {
  return appFiles()
    .filter((f) => f.endsWith('.tsx') && !/\.test\.tsx$/.test(f))
    .map((f) => relative(WEB, f))
    .sort();
}

/** `/dashboard/${eventId}/x?tab=y` and `/dashboard/[eventId]/x?tab=y` → `/dashboard/*\/x?tab=y`. */
export function normaliseHref(h: string): string {
  return h.replace(/\$\{[^}]*\}/g, '*').replace(/\[[^\]]+\]/g, '*');
}

/** Does a back link's href land on the map's home? Its path must match; the home's query too, if it has one. */
export function hrefMatchesHome(href: string, home: string): boolean {
  const split = (x: string) => {
    const n = normaliseHref(x);
    const q = n.search(/[?#]/);
    return q === -1 ? [n, ''] : [n.slice(0, q), n.slice(q)];
  };
  const [hp, hq] = split(href);
  const [ep, eq] = split(home);
  // A `${base}` that names a whole path (`/${slug}`) fills one segment — the scan cannot tell more.
  if (hp !== ep) return false;
  return eq === '' || hq === eq;
}

/** A home pattern's path, without its query or hash. */
export const homePath = (home: string) => home.split(/[?#]/)[0]!;
