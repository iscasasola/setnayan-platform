/**
 * section-labels-are-sentence-case.test.ts — 🏷 A SUPPLIER SECTION LABEL IS A BOLD SENTENCE-CASE TITLE, ITS COUNT IN A
 * PALE PILL RIGHT AFTER IT.
 *
 * Owner 17 Nov, on the #7901 preview, against the clean look (`prototypes/dashboards_clean_look_2026-11-16_fable.html`,
 * Proposed): "NEEDS YOU TODAY · 9 · ⚙" becomes **Needs you today** (9). The drawing's `.new .sec b` is 1.06em · 700 ·
 * ink · no tracking; its `.sec .n` count is the ghost wash · ink · 600, right after the title (`margin-left:0`). Its
 * "Removes" list names the uppercase labels: NEXT EVENTS, NEEDS YOU TODAY, COMING UP, SHOP, YOUR SERVICES. Small TAGS
 * (EXAMPLE, ACCOUNT) stay uppercase.
 *
 * HOW: tokens only (owner 17 Nov, "no per-component overrides"). The house labels `.home-k2` / `.hc-k2` in globals.css
 * READ `--sn-label-*`, each defaulting to the old uppercase grey, so the couple side is unchanged; `supplier-look.css`
 * re-points them on supplier pages.
 *
 * ── THE PROPERTIES ──────────────────────────────────────────────────────────
 *   1. The supplier look sets the label tokens to the drawing (case none · 700 · no tracking · ink) and the count pill
 *      (no push · the ghost · ink · 600).
 *   2. `.home-k2` / `.hc-k2` read every one of those tokens, and their fallbacks are the old uppercase look.
 *   3. The pinned "Needs you today" row: the house label, its count an `<em>`, no ⚙, no band (it paints the page's own
 *      fixed ground, so it is invisible), no bottom line.
 *   4. The drawing's listed labels draw through the house label, never a typed `uppercase` class.
 *
 * SABOTAGE (each run once, each went red): `--sn-label-case: uppercase` in the supplier look → 1; `.hc-k2` back to a
 * typed `text-transform: uppercase` → 2; `sn-pin-hair` back on the Needs row → 3; the services head back to
 * `uppercase tracking-[0.1em]` → 4.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = process.cwd();
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const cssNoComments = (s: string) => stripComments(s);

const rule = (css: string, sel: string) => {
  const m = css.match(new RegExp(`(?:^|\\n)\\s*${sel.replace(/\./g, '\\.')}\\s*\\{([^}]*)\\}`));
  assert.ok(m, `anti-vacuity: no ${sel} rule`);
  return m[1]!;
};

test('1 · the supplier look sets the label and count tokens to the drawing', () => {
  const css = cssNoComments(read('app/vendor-dashboard/_components/supplier-look.css'));
  const want: Record<string, RegExp> = {
    '--sn-label-case': /^none$/,
    '--sn-label-weight': /^700$/,
    '--sn-label-track': /^0$/,
    '--sn-label-ink': /^rgb\(var\(--color-ink\)\)$/,
    '--sn-label-count-push': /^0$/,
    '--sn-label-count-bg': /^rgb\(16 27 48 \/ 0\.05\)$/,
    '--sn-label-count-ink': /^rgb\(var\(--color-ink\)\)$/,
    '--sn-label-count-weight': /^600$/,
  };
  for (const [k, v] of Object.entries(want)) {
    const m = css.match(new RegExp(`${k}:\\s*([^;]+);`));
    assert.ok(m, `the supplier look does not set ${k}`);
    assert.match(m[1]!.trim(), v, `${k} is ${m[1]}, not the drawing`);
  }
});

test('2 · .home-k2 / .hc-k2 read the tokens, falling back to the old uppercase look', () => {
  const css = cssNoComments(read('app/globals.css'));
  for (const sel of ['.home-k2', '.hc-k2']) {
    const body = rule(css, sel);
    assert.match(body, /text-transform:\s*var\(--sn-label-case,\s*uppercase\)/, `${sel}: case is typed, not the token`);
    assert.match(body, /font-weight:\s*var\(--sn-label-weight,\s*400\)/, `${sel}: weight is typed`);
    assert.match(body, /letter-spacing:\s*var\(--sn-label-track,\s*0\.12em\)/, `${sel}: tracking is typed`);
    assert.match(body, /color:\s*var\(--sn-label-ink,/, `${sel}: ink is typed`);
    assert.match(body, /font-size:\s*var\(--sn-label-size,\s*11px\)/, `${sel}: size is typed`);
  }
  const em = rule(css, '.hc-k2 em');
  for (const t of ['--sn-label-count-push', '--sn-label-count-bg', '--sn-label-count-ink', '--sn-label-count-weight']) {
    assert.match(em, new RegExp(`var\\(${t},`), `.hc-k2 em does not read ${t}`);
  }
});

test('3 · the pinned Needs-you row: the house label, its count, no ⚙, no band, no line', () => {
  const src = stripComments(read('app/vendor-dashboard/_components/supplier-today-first-screen.tsx'));
  const at = src.indexOf('data-today-needs-pin');
  assert.ok(at > 0, 'anti-vacuity: the pinned Needs-you row is gone');
  const row = src.slice(src.lastIndexOf('<', at), src.indexOf('</p>', at) + 4);
  assert.match(row, /\bhc-k2\b/, 'the row is not the house label');
  assert.match(row, /<span>Needs you today<\/span>/, 'the title is not sentence case');
  assert.match(row, /<em data-today-needs-count/, 'the count is not the label’s pill');
  assert.doesNotMatch(row, /\bsn-pin-hair\b|border-b\b|boxShadow/, 'the row draws a bottom line');
  assert.doesNotMatch(row, /data-today-needs-gear|TodaySettings/, 'a ⚙ is back on the row');
  assert.match(row, /background:\s*'var\(--sn-ambient, rgb\(var\(--sn-page-bg\)\)\)'/, 'the row paints a band, not the page’s own ground');
  assert.match(row, /backgroundAttachment:\s*'fixed'/, 'the row’s ground is not fixed like the page’s, so it shows as a band');
  assert.doesNotMatch(row, /\buppercase\b/, 'the row types uppercase');
});

test('4 · the drawing’s listed labels draw through the house label, never a typed uppercase', () => {
  const seats: Array<[string, RegExp]> = [
    ['app/vendor-dashboard/_components/today-next-events.tsx', /<p className="hc-k2[^"]*">\s*<span>Next events<\/span>/],
    ['app/vendor-dashboard/_components/supplier-today-first-screen.tsx', /<TodayEyebrow[^>]*>Coming up<\/TodayEyebrow>/],
    ['app/vendor-dashboard/_components/supplier-today-first-screen.tsx', /<TodayEyebrow[^>]*>Shop<\/TodayEyebrow>/],
    ['app/vendor-dashboard/_components/supplier-today-first-screen.tsx', /export function TodayEyebrow[\s\S]*?<p className="home-k2[^"]*">/],
    ['app/vendor-dashboard/shop/_components/shop-services-head.tsx', /<h2 id="shop-services-h" className="home-k2[^"]*"[^>]*>\s*Your bundles and services/],
  ];
  for (const [f, re] of seats) {
    const src = stripComments(read(f));
    const m = src.match(re);
    assert.ok(m, `${f}: the label is not the house label (${re})`);
    assert.doesNotMatch(m[0], /\buppercase\b/, `${f}: the label types uppercase`);
  }
});

test('5 · round 3 (owner 17 Nov): no supplier section heading types the old uppercase label; no beige band', async () => {
  const { readdirSync, statSync } = await import('node:fs');
  const OLD = 'text-xs font-bold uppercase tracking-[0.1em] text-[color:var(--m-slate-2)]';
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx$/.test(name) && stripComments(readFileSync(p, 'utf8')).includes(OLD)) offenders.push(p.slice(WEB.length + 1));
    }
  };
  walk(join(WEB, 'app/vendor-dashboard'));
  assert.deepEqual(offenders, [], `a supplier heading still types the old uppercase label — use .home-k2:\n${offenders.join('\n')}`);
  const client = stripComments(read('app/vendor-dashboard/clients/[eventId]/page.tsx'));
  assert.doesNotMatch(client, /font-mono text-\[10px\] uppercase/, 'the client page keeps a mono uppercase section label');
  const look = cssNoComments(read('app/vendor-dashboard/_components/supplier-look.css'));
  assert.match(look, /--sn-canvas:\s*#eef2f8;/i, 'the warm canvas (#F7F5F0) still shows as a beige band on supplier pages');
});
