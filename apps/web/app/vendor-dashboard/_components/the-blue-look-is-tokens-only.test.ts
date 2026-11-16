/**
 * the-blue-look-is-tokens-only.test.ts — 🔵 THE SUPPLIER BLUE LOOK RE-POINTS TOKENS, AND A SAVED COLOUR SET CANNOT BEAT IT.
 *
 * Owner rules (17 Nov, via the controller — "nothing hard-coded", "no per-component overrides"; audit #7901 items 3–5):
 *   1. `supplier-look.css` holds token declarations ONLY — every declaration in every rule is a `--custom-property`.
 *   2. Every literal colour sits on a token line.
 *   3. The tiles, washes and pills are the drawing's #DCE6F2.
 *   4. ADMIN › COLOURS CANNOT LEAK IN. A saved set (`appColoursToCss`) writes its tokens at `html:not(.dark)` (0,1,1);
 *      the supplier scope is (0,2,1) and declares EVERY key that set writes — read from `appColourTokens` itself, so a
 *      new admin token fails here until the supplier scope holds it. Keys the blue look does not recolour sit at the code
 *      default (or `initial`, for the forward-step tokens the default leaves unset).
 *   5. The ground and the button lift are read through tokens in globals.css (`--sn-ambient`, `--sn-forward-lift`), and
 *      the lift never replaces the button's keyboard focus ring.
 *
 * SABOTAGE (each run once, each went red): a `box-shadow:` rule body → 1; `--fd-wash: #e8f0fa` → 1; drop
 * `--sn-cat-asked` from the scope → 1; set `--color-private: 1 2 3` → 1; drop `:not(:focus-visible)` → 1.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { appColourTokens, appColoursToCss, APP_COLOURS_DEFAULT, type AppColours } from '@/lib/app-colours';

const RAW = readFileSync(join(process.cwd(), 'app/vendor-dashboard/_components/supplier-look.css'), 'utf8');
const CSS = stripComments(RAW);
const GLOBALS = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');

/** Every top-level declaration of a rule block (the custom properties hold multi-line values, so split on `;`). */
function blocks(css: string): { sel: string; body: string }[] {
  const out: { sel: string; body: string }[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(css); m; m = re.exec(css)) out.push({ sel: (m[1] ?? '').trim(), body: m[2] ?? '' });
  return out;
}
const decls = (body: string) =>
  body
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean);
const MAIN = blocks(CSS).find((b) => b.sel === 'html:not(.dark):has([data-supplier-look])');
const valueOf = (name: string) => {
  const d = decls(MAIN?.body ?? '').find((x) => x.startsWith(`${name}:`));
  return d ? d.slice(name.length + 1).trim() : undefined;
};

test('tokens only — no rule body sets a property that is not a custom property', () => {
  const props = blocks(CSS).flatMap((b) => decls(b.body).map((d) => ({ sel: b.sel, d })));
  assert.ok(props.length > 20, 'read too little of the file');
  assert.deepEqual(props.filter(({ d }) => !d.startsWith('--')), [], 'a component rule crept into the blue look');
});

test('every literal colour is a token definition', () => {
  const typed = CSS.split('\n')
    .map((l) => l.trim())
    .filter((l) => /#[0-9a-f]{3,8}\b|rgba?\(\s*\d/i.test(l) && !/^--[\w-]+\s*:/.test(l) && !/^(radial|linear)-gradient|^0 /.test(l));
  assert.deepEqual(typed, [], 'a colour is typed outside a token');
});

test('the tiles, washes and pills are the drawing\'s #DCE6F2', () => {
  assert.equal(valueOf('--accent-soft'), '#dce6f2');
  assert.equal(valueOf('--surface-soft'), '#dce6f2');
  const fd = blocks(CSS).find((b) => b.sel === 'html:not(.dark):has([data-supplier-look]) .fd')?.body ?? '';
  assert.match(fd, /--fd-wash:\s*#dce6f2/);
  assert.match(fd, /--fd-chip:\s*#dce6f2/);
});

test('a saved Admin › Colours set cannot show through on a supplier page', () => {
  assert.ok(MAIN, 'no supplier scope');
  // A deliberately loud saved set: every colour it writes is far from both the default and the blue.
  const loud: AppColours = {
    ...APP_COLOURS_DEFAULT,
    page: '#FFEEDD',
    toggle: '#AA0055',
    decision: '#550000',
    money: '#004400',
    private: '#663399',
    tiles: { booked: '#111111', schedule: '#222222', asked: '#333333', collect: '#444444' },
  } as AppColours;
  const saved = appColoursToCss(loud);
  assert.match(saved, /^html:not\(\.dark\)\{/, 'the saved set no longer writes at html:not(.dark) — re-check the ranking');
  // (0,2,1) beats (0,1,1): ours has the extra `:has([data-supplier-look])` attribute.
  const written = Object.keys(appColourTokens(loud));
  const missing = written.filter((k) => valueOf(k) === undefined);
  assert.deepEqual(missing, [], 'a token a saved set writes is not held by the supplier scope');
  // The keys the blue look does not recolour sit at the code default (or `initial` where the default is unset).
  const BLUE = new Set(['--sn-page-bg', '--sn-band-from', '--sn-band-to', '--sn-band-angle', '--sn-on-band', '--sn-frame-bg', '--sn-frame-radius', '--sn-frame-shadow', '--sn-accent', '--sn-on-accent']);
  const UNSET = new Set(['--sn-decision', '--sn-decision-600', '--sn-decision-word', '--sn-on-decision']);
  const def = appColourTokens(APP_COLOURS_DEFAULT);
  for (const k of written) {
    if (BLUE.has(k)) continue;
    assert.equal(valueOf(k), UNSET.has(k) ? 'initial' : def[k], `${k} drifted from its default`);
  }
  assert.equal(valueOf('--sn-accent'), '34 114 230', 'the toggle is not the blue');
  assert.equal(valueOf('--sn-on-band'), '255 255 255', 'the blue band’s words are not white (ink on the blue is ~3.2:1)');
});

test('the clean warm look’s new tokens (#7888) are re-pointed to the drawing — the supplier side never goes warm', () => {
  // The secondary button is the drawing's blue ghost with ink words, no outline (`.btn`: --ghost #E8F0FA).
  assert.equal(valueOf('--sn-btn-secondary-bg'), 'var(--m-paper-2)');
  assert.equal(valueOf('--m-paper-2'), '#e8f0fa');
  assert.equal(valueOf('--sn-btn-secondary-bg-hover'), 'var(--surface-soft)');
  assert.equal(valueOf('--sn-btn-secondary-border'), 'transparent');
  assert.equal(valueOf('--sn-btn-secondary-fg'), 'var(--color-ink)');
  // The floating bar's lift is the drawing's cool one — a blue-grey shadow, never the warm rgba(30, 26, 18, …).
  const lift = valueOf('--sn-dock-lift') ?? '';
  assert.match(lift, /rgba\(30, 60, 110, 0\.16\)/);
  assert.doesNotMatch(lift, /30, 26, 18/);
});

test('the ground and the lift are tokens in globals.css, and the lift spares the focus ring', () => {
  assert.match(GLOBALS, /\.sn-ambient \{\s*(?:\/\*[\s\S]*?\*\/\s*)?background: var\(--sn-ambient, /);
  assert.match(GLOBALS, /:where\(\.button-primary:not\(:focus-visible\), :is\(button, a\)\.ab\.ab-brand\) \{\s*box-shadow: var\(--sn-forward-lift, none\);/);
  assert.ok(valueOf('--sn-ambient')?.includes('rgb(var(--sn-page-bg))'), 'the glow lost its ground');
  assert.ok(valueOf('--sn-forward-lift'), 'no lift');
});
