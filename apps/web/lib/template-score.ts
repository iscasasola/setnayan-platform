/**
 * template-score.ts — how far each page breaks the approved design template sheet.
 *
 * ── WHERE THE NUMBER COMES FROM ─────────────────────────────────────────────
 * The 14 Nov 2026 design-template audit (spec corpus
 * `prototypes/design_template_audit_2026-11-14.md`, checked against
 * `design_template_sheet_2026-11-14_fable.html`, owner-approved). The patterns
 * below are copied from the scan that produced that audit, unchanged, with ONE
 * deliberate difference: comments are removed with `stripComments` — the repo's
 * one string-aware stripper — instead of the audit's regex, which blanks real
 * code after `accept="image/*"` (see the docblock of `strip-comments.ts`).
 *
 *     score = long paragraphs×2 + cards + hand-made buttons×2 + raw hex
 *           + typewriter (mono) captions + empty cards×2 + raw <select>×2
 *
 * A page is its `page.tsx` + the other `.tsx` files in its folder (not tests,
 * layouts or loading files) + the `.tsx` files in its `_components`.
 *
 * ── THE RATCHET ─────────────────────────────────────────────────────────────
 * `template-score.baseline.json` holds today's score for every page that scores
 * above 0. `template-score-ratchet.test.ts` fails when a page's score RISES, or
 * when a page NOT in the baseline scores above 0 (new pages start clean). The
 * baseline may only be LOWERED — `scripts/gen-template-score-baseline.ts --write`
 * never raises an entry and never adds one.
 *
 * Exempt pages (TEMPLATE_EXEMPT) are not scored: each has its own approved look
 * or is not a dashboard screen at all.
 */
import fs from 'node:fs';
import path from 'node:path';

import { stripComments } from './strip-comments';

export const APP_DIR = path.resolve(__dirname, '..', 'app');
export const TEMPLATE_BASELINE_PATH = path.resolve(__dirname, 'template-score.baseline.json');

export type TemplateArea = 'supplier' | 'couple' | 'admin' | 'public';

export type TemplateCounts = {
  longP: number;
  cards: number;
  handBtn: number;
  hex: number;
  mono: number;
  emptyCard: number;
  select: number;
};

export type TemplatePageScore = {
  /** page folder relative to `app/`, e.g. `dashboard/[eventId]/vendors` ('' = the root page) */
  page: string;
  area: TemplateArea;
  counts: TemplateCounts;
  score: number;
};

/**
 * Pages that are deliberately NOT held to the dashboard template.
 * A prefix ending in `/` covers every page under it; anything else is one page.
 * Every entry carries the one-line reason. Adding an entry is a design decision —
 * it needs the owner's word, the same as a new look does.
 */
export const TEMPLATE_EXEMPT: ReadonlyArray<{ match: string; reason: string }> = [
  { match: '', reason: 'the front door — its own owner-approved design, not a dashboard screen' },
  { match: '(shell)/privacy', reason: 'legal text' },
  { match: '(shell)/privacy/', reason: 'legal text' },
  { match: '(shell)/terms', reason: 'legal text' },
  { match: '(shell)/cookies', reason: 'legal text' },
  { match: '(shell)/acceptable-use', reason: 'legal text' },
  { match: '(shell)/refunds', reason: 'legal text' },
  { match: '[slug]', reason: "Event Hub — the couple's own designed page, exempt from the dashboard template" },
  { match: '[slug]/', reason: "Event Hub — the couple's own designed page, exempt from the dashboard template" },
  { match: 'tour', reason: 'demo — copies dashboard screens and follows them when they change' },
  { match: 'tour/', reason: 'demo — copies dashboard screens and follows them when they change' },
  { match: 'sample', reason: 'demo — a sample Event Hub' },
  { match: 'sample/', reason: 'demo — a sample Event Hub' },
  { match: 'demo-capture/', reason: 'demo — renders still/video captures for marketing' },
  { match: 'dev/', reason: 'developer lab pages' },
  { match: 'dashboard/[eventId]/seating/lab', reason: 'developer lab page for the seat planner' },
];

export function exemptReason(page: string): string | null {
  for (const e of TEMPLATE_EXEMPT) {
    if (e.match.endsWith('/') ? page.startsWith(e.match) : page === e.match) return e.reason;
  }
  return null;
}

export function areaOf(page: string): TemplateArea {
  if (page === 'admin' || page.startsWith('admin/')) return 'admin';
  if (page === 'vendor-dashboard' || page.startsWith('vendor-dashboard/')) return 'supplier';
  if (page === 'dashboard' || page.startsWith('dashboard/')) return 'couple';
  return 'public';
}

function listPages(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules') continue;
      listPages(p, out);
    } else if (e.name === 'page.tsx') out.push(p);
  }
  return out;
}

function filesFor(pageFile: string): string[] {
  const dir = path.dirname(pageFile);
  const files = [pageFile];
  for (const f of fs.readdirSync(dir).sort()) {
    if (/\.tsx$/.test(f) && f !== 'page.tsx' && !/test/.test(f) && f !== 'layout.tsx' && f !== 'loading.tsx') {
      files.push(path.join(dir, f));
    }
  }
  const c = path.join(dir, '_components');
  if (fs.existsSync(c) && fs.statSync(c).isDirectory()) {
    for (const f of fs.readdirSync(c).sort()) if (/\.tsx$/.test(f) && !/test/.test(f)) files.push(path.join(c, f));
  }
  return files;
}

/** Count the template breaks in a blob of (comment-stripped) source. Exported for the test's self-check. */
export function countSource(src: string): TemplateCounts {
  const flat = src.replace(/\s+/g, ' ');
  const c = (re: RegExp) => (flat.match(re) || []).length;
  let longP = 0;
  for (const m of flat.matchAll(/<p\b[^>]*>(.*?)<\/p>/g)) {
    const t = m[1]
      .replace(/\{[^{}]*\}/g, ' x ')
      .replace(/<[^>]+>/g, '')
      .replace(/&[a-z]+;/g, "'")
      .trim();
    if (t.length >= 110) longP++;
  }
  const cards = c(/\bsn-tile\b|\bsn-card\b|rounded-(?:xl|2xl|3xl) border\b|rounded-(?:xl|2xl|3xl) (?:bg-\S+ )?border /g);
  const handBtn =
    c(/<button\b[^>]*className="[^"]*(?:bg-mulberry|bg-terracotta|bg-ink|button-primary|btn-primary|rounded-full[^"]*bg-)/g) +
    c(/<Link\b[^>]*className="[^"]*(?:bg-mulberry|bg-terracotta|button-primary|rounded-md px-3 py-1\.5)/g);
  const hex = c(/(?:style=\{\{[^}]*#[0-9A-Fa-f]{6}|\[#[0-9A-Fa-f]{6}\]|var\(--[a-z-]+, ?#[0-9A-Fa-f]{6}\))/g);
  const mono = c(/font-mono[^"']*uppercase|uppercase[^"']*font-mono/g);
  const emptyCard = c(/sn-tile[^>]*>(?:(?!<\/(?:div|p)>).){0,400}?(?:No (?:\w+ ){0,4}(?:yet|right now|has)|Nobody|Nothing (?:waiting|here|yet))/g);
  const select = c(/<select\b/g);
  return { longP, cards, handBtn, hex, mono, emptyCard, select };
}

export function scoreOf(k: TemplateCounts): number {
  return k.longP * 2 + k.cards + k.handBtn * 2 + k.hex + k.mono + k.emptyCard * 2 + k.select * 2;
}

/** Score every non-exempt page under `app/`, sorted by path. */
export function scoreAllPages(appDir: string = APP_DIR): TemplatePageScore[] {
  const rows: TemplatePageScore[] = [];
  for (const file of listPages(appDir)) {
    const page = path.relative(appDir, path.dirname(file)).split(path.sep).join('/');
    if (exemptReason(page) !== null) continue;
    const src = filesFor(file)
      .map((f) => stripComments(fs.readFileSync(f, 'utf8')))
      .join('\n');
    const counts = countSource(src);
    rows.push({ page, area: areaOf(page), counts, score: scoreOf(counts) });
  }
  return rows.sort((a, b) => (a.page < b.page ? -1 : a.page > b.page ? 1 : 0));
}

export function readTemplateBaseline(): Record<string, number> {
  return JSON.parse(fs.readFileSync(TEMPLATE_BASELINE_PATH, 'utf8')) as Record<string, number>;
}

export function areaTotals(rows: TemplatePageScore[]): Record<TemplateArea, { pages: number; breaking: number; score: number }> {
  const t = {
    supplier: { pages: 0, breaking: 0, score: 0 },
    couple: { pages: 0, breaking: 0, score: 0 },
    admin: { pages: 0, breaking: 0, score: 0 },
    public: { pages: 0, breaking: 0, score: 0 },
  };
  for (const r of rows) {
    t[r.area].pages++;
    if (r.score > 0) t[r.area].breaking++;
    t[r.area].score += r.score;
  }
  return t;
}

/**
 * The lower-only merge: an existing entry becomes min(old, now); an entry whose page
 * is gone or now scores 0 is dropped; a page missing from the old baseline is NEVER added.
 */
export function lowerBaseline(old: Record<string, number>, rows: TemplatePageScore[]): Record<string, number> {
  const now = new Map(rows.map((r) => [r.page, r.score]));
  const out: Record<string, number> = {};
  for (const page of Object.keys(old).sort()) {
    const cur = now.get(page);
    if (cur === undefined || cur === 0) continue;
    out[page] = Math.min(old[page], cur);
  }
  return out;
}
