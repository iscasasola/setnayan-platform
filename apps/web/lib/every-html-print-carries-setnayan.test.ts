/**
 * 🏷 EVERY BROWSER-PRINT PAGE CARRIES SETNAYAN — owner 2026-10-22, "Yes to all" to the controller's recommendation after
 * #6766 (`lib/every-print-carries-setnayan.test.ts` holds the PDFs): the print-dialog HTML pages of the seating pack and
 * the caterer counts — and the tea-ceremony serving order, the one other guest-list page printed from the browser — close
 * EACH SECTION with ONE quiet line, "Made with Setnayan · setnayan.com" (lib/print-html-brand.ts).
 *
 * MEASURED ON THE DRAWN PAGES, not the source: the seating pack and the caterer counts are drawn by their own builders from
 * a fixture, and the tea-ceremony page is the real page component, rendered with its reads stubbed. Then, per page:
 *   1 · each section (`section.sheet`; the tea page's one `<section>`) ENDS with the brand line — its last element;
 *   2 · there is EXACTLY one per section and none anywhere else;
 *   3 · never inside a table, a table row, a list item, a place card or a caterer table block;
 *   4 · it says the owner's words, in the free PDF line's type: 6 pt, upper case, the neutral grey (≥ 4.5 : 1 on its paper);
 *   5 · print does not hide it;
 *   6 · every browser-print page in the seating and guest areas is one of the pages above — a new one without the line fails.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { seatingPackHtml, type SeatingPackHtmlInput } from '@/app/dashboard/[eventId]/seating/print/pack-html';
import { catererCountsHtml, type CatererCountsHtmlInput } from '@/app/dashboard/[eventId]/seating/caterer/counts-html';
import { PRINT_HTML_BRAND_CLASS, PRINT_HTML_BRAND_CSS, PRINT_HTML_BRAND_STYLE } from '@/lib/print-html-brand';
import { PRINT_BRAND_GREY, PRINT_BRAND_WORDS, PRINT_MIN_BODY_PT } from '@/lib/print-layout';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = process.cwd();

// ─── A small HTML tree (the pages are our own markup) ───────────────────────

type El = { tag: string; attrs: string; cls: string[]; kids: Node[]; parent: El | null };
type Node = El | { text: string };
const VOID = new Set(['meta', 'img', 'br', 'hr', 'input', 'link', 'source', 'col', 'area', 'base', 'wbr']);

function parse(html: string): { root: El; css: string } {
  const root: El = { tag: '#root', attrs: '', cls: [], kids: [], parent: null };
  let at = root;
  let css = '';
  const re = /<!--[\s\S]*?-->|<![^>]*>|<(style|script)\b[^>]*>([\s\S]*?)<\/\1>|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>|[^<]+/g;
  for (const m of html.matchAll(re)) {
    if (m[1]) {
      if (m[1] === 'style') css += m[2];
      continue;
    }
    if (m[3]) {
      const tag = m[3].toLowerCase();
      let e: El | null = at;
      while (e && e.tag !== tag) e = e.parent;
      assert.ok(e && e.parent, `a stray </${tag}> in the page`);
      at = e.parent!;
      continue;
    }
    if (m[4]) {
      const tag = m[4].toLowerCase();
      const attrs = m[5] ?? '';
      const cls = (/\bclass(?:Name)?="([^"]*)"/.exec(attrs)?.[1] ?? '').split(/\s+/).filter(Boolean);
      const el: El = { tag, attrs, cls, kids: [], parent: at };
      at.kids.push(el);
      if (!VOID.has(tag) && !/\/\s*$/.test(attrs)) at = el;
      continue;
    }
    if (m[0].startsWith('<')) continue;
    at.kids.push({ text: m[0] });
  }
  return { root, css };
}
const isEl = (n: Node): n is El => 'tag' in n;
function all(e: El, pred: (x: El) => boolean, out: El[] = []): El[] {
  for (const k of e.kids) if (isEl(k)) {
    if (pred(k)) out.push(k);
    all(k, pred, out);
  }
  return out;
}
const textOf = (e: El): string => e.kids.map((k) => (isEl(k) ? textOf(k) : k.text)).join('');
const lastElement = (e: El): El | undefined => [...e.kids].reverse().find(isEl);
const isBrand = (e: El) => e.cls.includes(PRINT_HTML_BRAND_CLASS);

/** Inside any of these, the line would sit in a row, a cut line, a card or a table's own block. */
const NEVER_INSIDE = (e: El) =>
  ['table', 'thead', 'tbody', 'tr', 'td', 'th', 'li', 'ul', 'ol'].includes(e.tag) || e.cls.some((c) => ['card', 'cards', 'unit', 'sign-inner'].includes(c));

/** Every rule the five properties ask of one drawn page. */
function brandFaults(name: string, html: string, sectionOf: (root: El) => El[]): string[] {
  const out: string[] = [];
  const { root, css } = parse(html);
  const sections = sectionOf(root);
  const brands = all(root, isBrand);
  if (sections.length === 0) out.push(`${name}: no section was drawn`);
  if (brands.length !== sections.length) out.push(`${name}: ${brands.length} brand lines for ${sections.length} sections`);
  for (const [i, s] of sections.entries()) {
    const own = all(s, isBrand);
    if (own.length !== 1) out.push(`${name} § ${i + 1} (${s.cls.join('.') || s.tag}): ${own.length} brand lines`);
    const last = lastElement(s);
    if (!last || !isBrand(last)) out.push(`${name} § ${i + 1} (${s.cls.join('.') || s.tag}): does not END with the brand line (ends with <${last?.tag}.${last?.cls.join('.')}>)`);
  }
  for (const b of brands) {
    if (textOf(b).trim() !== PRINT_BRAND_WORDS) out.push(`${name}: the line says "${textOf(b).trim()}"`);
    for (let p = b.parent; p; p = p.parent) if (NEVER_INSIDE(p)) out.push(`${name}: a brand line sits inside <${p.tag}.${p.cls.join('.')}>`);
    if (!sections.some((s) => s === b.parent)) out.push(`${name}: a brand line is not a direct child of its section`);
  }
  // 5 · print does not hide it: no rule (screen or print) that names the line sets display:none / visibility:hidden.
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (rule[1]!.includes(PRINT_HTML_BRAND_CLASS) && /display\s*:\s*none|visibility\s*:\s*hidden/.test(rule[2]!)) {
      out.push(`${name}: a rule hides the brand line (${rule[1]!.trim()})`);
    }
  }
  return out;
}

// ─── The type: the free PDF line's, in CSS ──────────────────────────────────

function lum(hex: string): number {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0]! + 0.7152 * v[1]! + 0.0722 * v[2]!;
}
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};

test('4 · the HTML line is the free PDF line: its words, 6 pt, upper case, the neutral grey, legible on its paper', () => {
  assert.equal(PRINT_HTML_BRAND_STYLE.fontSize, `${PRINT_MIN_BODY_PT}pt`, 'the HTML line is not the PDF line’s size');
  assert.equal(PRINT_HTML_BRAND_STYLE.color, PRINT_BRAND_GREY, 'the HTML line is not the PDF line’s grey');
  assert.equal(PRINT_HTML_BRAND_STYLE.textTransform, 'uppercase', 'the HTML line is not in small caps (upper case)');
  for (const paper of ['#ffffff', '#FBFBFA']) {
    const c = contrast(PRINT_HTML_BRAND_STYLE.color, paper);
    assert.ok(c >= 4.5, `the line reads ${c.toFixed(2)} : 1 on ${paper} — below 4.5 : 1`);
  }
  // The string pages' rule says the same values.
  const rule = /\.print-brand\s*\{([^}]*)\}/.exec(PRINT_HTML_BRAND_CSS)?.[1] ?? '';
  assert.match(rule, new RegExp(`font-size:\\s*${PRINT_MIN_BODY_PT}pt`));
  assert.match(rule, new RegExp(`color:\\s*${PRINT_BRAND_GREY}`, 'i'));
  assert.match(rule, /text-transform:\s*uppercase/);
});

// ─── The seating pack ───────────────────────────────────────────────────────

const QR = 'data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E';
const PACK: SeatingPackHtmlInput = {
  eventId: '00000000-0000-4000-8000-000000000001',
  coupleName: 'Ana & Ben',
  dateStr: 'December 12, 2026',
  signSub: 'Scan to visit our wedding',
  units: [
    { key: 't1', label: 'Table 1', joined: 1, signQr: QR, guests: [{ name: 'Ana Reyes', qr: QR }, { name: 'Carla Dizon', qr: QR }, { name: 'Rosa <Lim>', qr: QR }] },
    { key: 'g2', label: 'Family', joined: 2, signQr: QR, guests: [{ name: 'Lola Inday', qr: QR }] },
    { key: 't3', label: 'Table 3', joined: 1, signQr: QR, guests: [] },
  ],
};
const sheets = (root: El) => all(root, (e) => e.tag === 'section' && e.cls.includes('sheet'));

test('1–5 · the seating pack: the cover, every sign and the place-card sheet each END with one brand line', () => {
  const html = seatingPackHtml(PACK);
  const { root } = parse(html);
  const s = sheets(root);
  assert.equal(s.length, 1 + PACK.units.length + 1, 'the pack did not draw a cover, a sign per table and a card sheet');
  assert.equal(all(root, (e) => e.cls.includes('card')).length, 4, 'the fixture’s place cards were not drawn');
  assert.deepEqual(brandFaults('seating pack', html, sheets), []);
  // The cover's line sits under the directory, the cards' under the grid — the table and the grid stay whole.
  const [cover, , , , cards] = s;
  assert.ok(cover!.kids.filter(isEl).some((k) => k.tag === 'table'), 'the cover lost its directory table');
  assert.ok(cards!.kids.filter(isEl).some((k) => k.cls.includes('cards')), 'the card sheet lost its grid');
});

test('1–5 · an empty seating pack (no tables, no cards) still closes its one section with the line', () => {
  const html = seatingPackHtml({ ...PACK, units: [] });
  assert.equal(sheets(parse(html).root).length, 1);
  assert.deepEqual(brandFaults('empty seating pack', html, sheets), []);
});

// ─── The caterer counts ─────────────────────────────────────────────────────

const COUNTS: CatererCountsHtmlInput = {
  eventId: '00000000-0000-4000-8000-000000000001',
  eventName: 'Ana & Ben',
  dateStr: 'December 12, 2026',
  confirmed: 4,
  tentative: 2,
  totals: [['Chicken', 2], ['Fish', 1], ['Vegetarian', 1]],
  units: [
    { label: 'Table 1', guests: 3, meals: [['Chicken', 2], ['Fish', 1]], diets: [{ name: 'Ana Reyes', restriction: 'No nuts' }] },
    { label: 'Not seated yet', guests: 1, meals: [['Vegetarian', 1]], diets: [] },
  ],
  allDiets: [{ name: 'Ana Reyes', table: 'Table 1', restriction: 'No nuts' }],
};

test('1–5 · the caterer counts: the report’s one sheet ENDS with one brand line, under its last list', () => {
  for (const [name, input] of [
    ['caterer counts', COUNTS],
    ['empty caterer counts', { ...COUNTS, confirmed: 0, tentative: 0, totals: [], units: [], allDiets: [] }],
  ] as const) {
    const html = catererCountsHtml(input);
    assert.equal(sheets(parse(html).root).length, 1);
    assert.deepEqual(brandFaults(name, html, sheets), []);
  }
});

// ─── The tea-ceremony serving order — the real page, its reads stubbed ──────

const EVENT_ID = '00000000-0000-4000-8000-000000000002';
const guest = (id: string, first: string, side: string, rank: number | null) => ({
  guest_id: id, public_id: `S89G-${id}`, event_id: EVENT_ID, first_name: first, last_name: 'Tan', display_name: null,
  name_prefix: null, middle_name: null, name_suffix: null, side, role: 'guest', extra_roles: [], seniority_rank: rank,
  relation: 'Uncle', plus_one_of_guest_id: null,
});
const TEA_GUESTS = [guest('a1', 'Wei', 'groom', 1), guest('a2', 'Li', 'groom', 2), guest('b1', 'Mei', 'bride', 1), guest('c1', 'Ho', 'both', null)];

{
  const Mod = require('node:module') as { _load: (request: string, ...rest: unknown[]) => unknown };
  const load = Mod._load;
  const fake = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { event_id: EVENT_ID, display_name: 'Wei & Mei', ceremony_type: 'chinese', secondary_ceremony_type: null }, error: null }) }) }) }),
  };
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    if (request === '@/lib/auth') return { getCurrentUser: async () => ({ id: 'u1' }) };
    if (request === '@/lib/supabase/server') return { createClient: async () => fake };
    if (request === '@/lib/role-names.server') return { loadRoleNames: async () => ({}) };
    if (request === '@/lib/guests') {
      const real = load.call(this, request, ...rest) as Record<string, unknown>;
      return { ...real, fetchGuestsByEvent: async () => TEA_GUESTS };
    }
    return load.call(this, request, ...rest);
  };
}

test('1–5 · the tea-ceremony serving order ends with one brand line, on the paper only', async () => {
  const { default: TeaCeremonyPage } = (await import('@/app/dashboard/[eventId]/guests/tea-ceremony/page')) as {
    default: (p: { params: Promise<{ eventId: string }> }) => Promise<React.ReactElement>;
  };
  const html = renderToStaticMarkup(await TeaCeremonyPage({ params: Promise.resolve({ eventId: EVENT_ID }) }));
  assert.match(html, /Wei Tan/, 'the fixture’s elders were not drawn');
  const topSection = (root: El) => root.kids.filter(isEl).filter((e) => e.tag === 'section');
  assert.equal(topSection(parse(html).root).length, 1, 'the page is not one section');
  assert.deepEqual(brandFaults('tea ceremony', html, topSection), []);
  // On the paper only: hidden on screen (the app already says Setnayan), shown in print.
  const [line] = all(parse(html).root, isBrand);
  assert.ok(line!.cls.includes('hidden') && line!.cls.includes('print:block'), 'the tea-ceremony line is not print-only — or not printed');
});

// ─── 6 · every browser-print page in these areas is held above ──────────────

const COVERED = [
  'app/dashboard/[eventId]/seating/print/pack-html.ts',
  'app/dashboard/[eventId]/seating/caterer/counts-html.ts',
  'app/dashboard/[eventId]/guests/tea-ceremony/page.tsx',
];
const AREAS = ['app/dashboard/[eventId]/seating', 'app/dashboard/[eventId]/guests'];

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(f) && !/\.test\.|\.harness\./.test(f)) out.push(p);
  }
  return out;
}

test('6 · every browser-print page in the seating and guest areas carries the line', () => {
  const printers = AREAS.flatMap((a) => walk(join(WEB, a)))
    .filter((p) => /window\.print\(\)|<PrintButton\b|@media print/.test(stripComments(readFileSync(p, 'utf8'))))
    .map((p) => relative(WEB, p))
    .sort();
  assert.ok(printers.length >= COVERED.length, `the sweep found ${printers.length} print pages — the walk is broken`);
  assert.deepEqual(printers, [...COVERED].sort(), 'a browser-print page in the seating/guest areas is not held by this guard (give it the line, then list it)');
});
