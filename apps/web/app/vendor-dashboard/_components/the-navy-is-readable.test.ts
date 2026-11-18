/**
 * the-navy-is-readable.test.ts — 🌙 THE SUPPLIER DASHBOARD'S DARK IS THE APPROVED NAVY, TOKENS ONLY, AND IT READS.
 *
 * Owner: 16 Nov 2026 "SUPPLIER DASHBOARD = THE OWNER'S BLUE LOOK, LIGHT AND DARK" (page #0D1626 · cards #172338 · tiles
 * #1F2F4A · titles #EEF2F8 · links #7DB1FF · the main button #2272E6 with white labels · amber as the small accent);
 * 18 Nov 2026 "all picks" (pick 1: supplier navy kept) and "do supplier navy dark next".
 *
 *   1. The dark scope is `html.dark:has([data-supplier-look])` in `supplier-look.css`, and it holds the ruled values.
 *   2. Every text / surface pair reads at WCAG AA (4.5:1), computed from the stylesheets with the scope layered over
 *      the app's dark tokens the way the cascade layers it — never from a second hand-typed copy of a colour.
 *   3. THE ACCENT AS A WORD. The main button's blue (#2272E6) cannot also be a word on the navy (3.46:1), so the text
 *      utilities read `--color-mulberry-word` / `--sn-accent-word` — set here, unset everywhere else.
 *   4. The area is on the ready-list, and the Light scope still pins the three `--m-*` tokens that became pointers.
 *
 * (The file-wide "tokens only" rule is held by `the-blue-look-is-tokens-only.test.ts`, which reads every rule.)
 *
 * SABOTAGE (each run once, each went red): `--color-ink-3: 110 120 140` → 2 · delete `--color-mulberry-word` → 3 ·
 * `--color-on-accent: 13 22 38` (navy words on the deep blue, 4.05) → 2 · drop '/vendor-dashboard' from DARK_READY → 4.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { rawTokens, substitute, toHex, type TokenMap } from '@/lib/css-colour-tokens';
import { DARK_READY } from '@/lib/appearance';

const CSS = stripComments(readFileSync(join(process.cwd(), 'app/vendor-dashboard/_components/supplier-look.css'), 'utf8'));

/** The declarations of the one rule whose selector is exactly `selector`. */
function block(selector: string): TokenMap {
  const out: TokenMap = {};
  for (const m of CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if ((m[1] ?? '').replace(/\s+/g, ' ').trim() !== selector) continue;
    for (const d of (m[2] ?? '').split(';')) {
      const i = d.indexOf(':');
      if (i > 0 && d.slice(0, i).trim().startsWith('--')) out[d.slice(0, i).trim()] = d.slice(i + 1).trim().replace(/\s+/g, ' ');
    }
  }
  return out;
}
const NAVY = block('html.dark:has([data-supplier-look])');
/** What a supplier page paints in dark: the app's dark tokens with the navy scope over them (both land on <html>). */
const TABLE: TokenMap = { ...rawTokens('dark'), ...NAVY };
const hex = (token: string): string => {
  const raw = TABLE[token];
  assert.ok(raw !== undefined, `${token} is not set on a dark supplier page`);
  const h = toHex(substitute(raw, TABLE) ?? '');
  assert.ok(h, `${token} (“${raw}”) does not resolve to one opaque colour`);
  return h;
};
const lum = (h: string) => {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
const over = (fg: string, bg: string, a: number) =>
  '#' + [1, 3, 5].map((i) => Math.round(parseInt(fg.slice(i, i + 2), 16) * a + parseInt(bg.slice(i, i + 2), 16) * (1 - a)).toString(16).padStart(2, '0')).join('');

test('1 · the dark scope holds the approved navy', () => {
  assert.ok(Object.keys(NAVY).length >= 40, `anti-vacuity: only ${Object.keys(NAVY).length} declarations were read from the navy scope`);
  const RULED: Record<string, string> = {
    '--color-page': '#0d1626',
    '--color-raised': '#172338',
    '--color-raised-2': '#1f2f4a',
    '--color-ink': '#eef2f8',
    '--color-link': '#7db1ff',
    '--color-mulberry': '#2272e6',
    '--color-on-accent': '#ffffff',
    '--color-terracotta': '#f2a93b',
  };
  for (const [token, want] of Object.entries(RULED)) assert.equal(hex(token), want, `${token} is not the ruled navy value`);
  // …and the families that POINT at the one colour set follow it without being named in the scope.
  assert.equal(hex('--m-paper'), '#172338', '--m-paper did not follow the navy card');
  assert.equal(hex('--sn-page-bg'), '#0d1626', '--sn-page-bg did not follow the navy page');
  assert.equal(hex('--m-ink'), '#eef2f8', '--m-ink did not follow the navy ink');
  assert.equal(hex('--sn-accent'), '#2272e6', 'the toggle is not the decision blue (pick 4)');
  assert.equal(hex('--sn-dock-pill'), hex('--color-wash'), 'the active tab is not the grey-blue wash pill (pick 3)');
});

test('2 · every text and surface pair reads at AA on the navy', () => {
  const SURFACES = ['--color-page', '--color-raised', '--color-raised-2', '--color-wash'];
  const pairs: Array<[string, string]> = [];
  for (const s of SURFACES) for (const w of ['--color-ink', '--color-ink-2', '--color-ink-3']) pairs.push([w, s]);
  for (const s of ['--color-raised', '--color-raised-2', '--color-wash']) pairs.push(['--color-link', s], ['--color-mulberry-word', s], ['--sn-accent-word', s], ['--color-mulberry-700', s]);
  pairs.push(
    ['--color-on-accent', '--color-mulberry'],
    ['--color-on-accent', '--color-mulberry-600'],
    ['--color-on-accent', '--sn-accent'],
    ['--color-terracotta-700', '--color-raised'],
    ['--m-orange-2', '--color-raised'],
    ['--m-orange-deep', '--m-orange-4'],
    ['--m-slate-3', '--color-raised'],
    ['--color-ink', '--color-private-tint'],
    ['--color-private-text', '--color-private-tint'],
    ['--color-ink', '--color-band-from'],
    ['--color-ink', '--color-band-to'],
  );
  for (const [fg, bg] of pairs) {
    const r = ratio(hex(fg), hex(bg));
    assert.ok(r >= 4.5, `${fg} (${hex(fg)}) on ${bg} (${hex(bg)}) reads ${r.toFixed(2)}:1 — under WCAG AA`);
  }
  assert.ok(pairs.length >= 30, 'anti-vacuity: too few pairs');
  // status and category colours: as a word on the card, and on their own 16 % tint (how a chip is drawn in dark)
  const card = hex('--color-raised');
  for (const t of ['--color-ok', '--color-warn', '--color-danger', '--color-info', '--color-cat-booked', '--color-cat-schedule', '--color-cat-asked', '--color-cat-collect']) {
    const c = hex(t);
    assert.ok(ratio(c, card) >= 4.5, `${t} as a word on the navy card reads ${ratio(c, card).toFixed(2)}:1`);
    assert.ok(ratio(c, over(c, card, 0.16)) >= 4.5, `${t} on its own tint reads ${ratio(c, over(c, card, 0.16)).toFixed(2)}:1`);
  }
  // the hero's brightest glow: the decision blue at 40 % over the band's base
  const glow = over(hex('--color-mulberry'), hex('--color-band-from'), 0.4);
  assert.ok(ratio(hex('--color-ink'), glow) >= 4.5 && ratio(hex('--color-ink-2'), glow) >= 4.5, `the hero's words do not read on its brightest glow (${glow})`);
  // the shell's action: the page's navy as the label on the light blue
  const FD = block('html.dark:has([data-supplier-look]) .fd');
  assert.ok(ratio(toHex(FD['--fd-gold'] ?? '') ?? '#000000', hex('--color-page')) >= 4.5, 'the shell’s action label does not read on its fill');
});

test('3 · the accent as a WORD is its own token here — and nowhere else', () => {
  assert.ok(ratio(hex('--color-mulberry'), hex('--color-raised')) < 4.5, 'the deep blue now reads as a word on the card — the word tokens may go');
  assert.equal(hex('--color-mulberry-word'), hex('--color-link'));
  assert.equal(hex('--sn-accent-word'), hex('--color-link'));
  const tw = readFileSync(join(process.cwd(), 'tailwind.config.ts'), 'utf8');
  assert.match(tw, /mulberry: \{ DEFAULT: 'rgb\(var\(--color-mulberry-word, var\(--color-mulberry\)\) \/ <alpha-value>\)' \}/, 'text-mulberry does not read the word token with the accent as its fallback');
  assert.match(tw, /sn: \{ accent: 'rgb\(var\(--sn-accent-word, var\(--sn-accent\)\) \/ <alpha-value>\)' \}/, 'text-sn-accent does not read the word token with the accent as its fallback');
  // Unset in the app's own tokens and in the Light scope: Light, and the couple's dark, fall back to the accent itself.
  for (const theme of ['light', 'dark'] as const) {
    assert.equal(rawTokens(theme)['--color-mulberry-word'], undefined, `--color-mulberry-word is set app-wide (${theme})`);
    assert.equal(rawTokens(theme)['--sn-accent-word'], undefined, `--sn-accent-word is set app-wide (${theme})`);
  }
  const LIGHT = block('html:not(.dark):has([data-supplier-look])');
  assert.equal(LIGHT['--color-mulberry-word'], undefined);
  assert.equal(LIGHT['--sn-accent-word'], undefined);
});

test('4 · the supplier area is on the ready-list, and Light keeps the three tokens that became pointers', () => {
  assert.ok(DARK_READY.includes('/vendor-dashboard'), '/vendor-dashboard is not on DARK_READY (lib/appearance.ts)');
  const LIGHT = block('html:not(.dark):has([data-supplier-look])');
  assert.equal(LIGHT['--m-ink'], '#2c2a29', 'Light: --m-ink would follow the navy ink through its pointer');
  assert.equal(LIGHT['--m-mulberry'], '#c24e25', 'Light: --m-mulberry would follow the blue through its pointer');
  assert.equal(LIGHT['--m-mulberry-2'], '#b04722');
});
