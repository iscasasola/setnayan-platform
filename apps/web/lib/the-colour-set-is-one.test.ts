/**
 * the-colour-set-is-one.test.ts — 🎨 ONE COLOUR SET, BY JOB, LIGHT AND DARK; THE OLDER FAMILIES POINT AT IT.
 *
 * Owner, 18 Nov 2026, on the drawing `prototypes/dark_mode_elite_2026-11-18_fable.html` (specs repo): "dark mode.
 * YES :D" · "all picks". Its § "One colour set, by job" is what this file holds:
 *
 *   1. EVERY JOB HAS ONE `--color-*` TOKEN, with a Light value at `:root` and a Dark value under `html.dark`.
 *   2. THE OLDER FAMILIES POINT, THEY DO NOT COPY. `--m-*`, `--sn-*`, `--fd-*` and `--surface*` hold a `var(--color-…)`
 *      for these jobs — in BOTH themes. A literal on one of these lines is a second copy, and a second copy is how the
 *      palette drifted four times in three weeks (`palette-lock.test.ts` header).
 *   3. LIGHT IS WHAT IT WAS: each job's Light value is the value its pointers held as a literal on 18 Nov.
 *   4. DARK IS THE APPROVED SET, AND IT READS: the drawing's values, and every text/surface pair at WCAG AA (4.5:1),
 *      computed from the stylesheet (never from a hand-typed second copy of the colour).
 *   5. THE RETIRED DARK NEUTRALS ARE GONE from the dark token blocks (page #17160F · card #232019 · paper #FBFAF7 as a
 *      literal) — a leftover one would paint a 13 Oct surface inside an 18 Nov screen.
 *
 * SABOTAGE (each run once, each went red): `--m-paper: #FFFFFF` back as a literal → 2 · `--color-page: 20 20 20` in
 * dark → 4 · `--color-ink-3: 110 104 96` in dark (3.4:1 on the wash) → 4 · `--m-paper: #232019` in the dark block → 2 and 5.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rawTokens, tokenHex, type Theme } from './css-colour-tokens';

/** job → its one token → [Light, Dark] as the drawing's table rules them. */
const JOBS: Record<string, { token: string; light: string; dark: string }> = {
  page: { token: '--color-page', light: '#f7f5f4', dark: '#121110' },
  frame: { token: '--color-raised', light: '#ffffff', dark: '#1c1a16' },
  raised: { token: '--color-raised-2', light: '#f4f2ec', dark: '#26231e' },
  wash: { token: '--color-wash', light: '#edeae0', dark: '#302c26' },
  'text 1': { token: '--color-ink', light: '#2c2a29', dark: '#f7f4ee' },
  'text 2': { token: '--color-ink-2', light: '#3a382f', dark: '#d2ccc1' },
  'text 3': { token: '--color-ink-3', light: '#6e6a62', dark: '#a49e93' },
  decision: { token: '--color-mulberry', light: '#c24e25', dark: '#ee8456' },
  'words on decision': { token: '--color-on-accent', light: '#ffffff', dark: '#1a120c' },
  money: { token: '--color-ok', light: '#2b744a', dark: '#6fcf97' },
  private: { token: '--color-private', light: '#0284c7', dark: '#38bdf8' },
  'private tint': { token: '--color-private-tint', light: '#e0f2fe', dark: '#203136' },
  'toggle on': { token: '--color-toggle', light: '#c24e25', dark: '#ee8456' },
  'band from': { token: '--color-band-from', light: '#fae0d1', dark: '#241f1a' },
  'band to': { token: '--color-band-to', light: '#ffffff', dark: '#1c1a16' },
  'tile booked': { token: '--color-cat-booked', light: '#166b4a', dark: '#4fbf8a' },
  'tile schedule': { token: '--color-cat-schedule', light: '#2f6db5', dark: '#7fafe8' },
  'tile asked': { token: '--color-cat-asked', light: '#c9471a', dark: '#f0825a' },
  'tile collect': { token: '--color-cat-collect', light: '#a2457e', dark: '#d98ac0' },
  accent: { token: '--color-terracotta', light: '#a9834b', dark: '#cba766' },
};

/** older name → the `--color-*` token it must point at (root scope; `fd:` = the shell's `.fd` scope). */
const POINTERS: Record<string, string> = {
  '--sn-page-bg': '--color-page',
  '--sn-frame-bg': '--color-raised',
  '--m-paper': '--color-raised',
  '--surface': '--color-raised',
  '--m-paper-2': '--color-raised-2',
  '--surface-soft': '--color-raised-2',
  '--m-ivory': '--color-wash',
  '--m-ink': '--color-ink',
  '--sn-on-band': '--color-ink',
  '--sn-btn-secondary-fg': '--color-ink',
  '--m-slate': '--color-ink-2',
  '--m-slate-2': '--color-ink-3',
  '--m-mulberry': '--color-mulberry',
  '--m-mulberry-2': '--color-mulberry-600',
  '--sn-on-accent': '--color-on-accent',
  '--sn-accent': '--color-toggle',
  '--sn-band-from': '--color-band-from',
  '--sn-band-to': '--color-band-to',
  '--sn-cat-booked': '--color-cat-booked',
  '--sn-cat-schedule': '--color-cat-schedule',
  '--sn-cat-asked': '--color-cat-asked',
  '--sn-cat-collect': '--color-cat-collect',
  '--m-orange': '--color-terracotta',
  'fd:--fd-ink': '--color-ink',
  'fd:--fd-hi': '--color-terracotta',
  'fd:--fd-m1': '--color-ink-3',
  'fd:--fd-link': '--color-link',
};

const THEMES: readonly Theme[] = ['light', 'dark'];
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
const hex = (token: string, theme: Theme): string => {
  const h = tokenHex(token, theme);
  assert.ok(h, `${token} does not resolve to one opaque colour in ${theme}`);
  return h;
};

test('1 + 3 + 4 · every job has one --color-* token, with the ruled Light and Dark value', () => {
  assert.ok(Object.keys(rawTokens('light')).length > 300, 'anti-vacuity: the stylesheet was not read');
  for (const [job, { token, light, dark }] of Object.entries(JOBS)) {
    assert.ok(token.startsWith('--color-'), `${job}: its token ${token} is not in the --color-* family`);
    assert.equal(hex(token, 'light'), light, `${job}: Light ${token} moved — Light must move no pixel`);
    assert.equal(hex(token, 'dark'), dark, `${job}: Dark ${token} is not the approved value`);
  }
});

test('2 · the older families point at the one token — in both themes, never a second copy', () => {
  for (const [key, target] of Object.entries(POINTERS)) {
    const scope = key.startsWith('fd:') ? 'fd' : 'root';
    const name = key.replace(/^fd:/, '');
    for (const theme of THEMES) {
      const raw = rawTokens(theme, scope)[name];
      assert.ok(raw, `${name} is not declared (${theme})`);
      assert.match(
        raw,
        new RegExp(`^(?:rgb\\()?var\\(${target}\\)\\)?$`),
        `${name} is "${raw}" in ${theme} — it must POINT at ${target} (var(${target}) or rgb(var(${target}))), not hold its own copy`,
      );
      assert.equal(tokenHex(name, theme, scope), tokenHex(target, theme), `${name} does not paint what ${target} paints in ${theme}`);
    }
  }
});

test('4 · every text and surface pair reads at AA, light and dark — computed from the stylesheet', () => {
  const SURFACES = ['--color-page', '--color-raised', '--color-raised-2', '--color-wash'];
  const WORDS = ['--color-ink', '--color-ink-2', '--color-ink-3'];
  const pairs: Array<[string, string]> = [];
  for (const s of SURFACES) for (const w of WORDS) pairs.push([w, s]);
  pairs.push(
    ['--color-on-accent', '--color-mulberry'], // the decision's words on its fill
    ['--color-on-accent', '--color-mulberry-600'], // …and on its hover
    ['--color-on-accent', '--color-toggle'], // a picked pill's words
    ['--color-ink', '--color-band-from'], // the hero's words on its base
    ['--color-ink', '--color-band-to'],
    ['--color-ink', '--color-private-tint'], // words inside the private strip
    ['--color-private-text', '--color-private-tint'],
    ['--color-private-text', '--color-raised'],
  );
  let measured = 0;
  for (const theme of THEMES) {
    for (const [fg, bg] of pairs) {
      // LIGHT IS NOT MOVED BY THIS CHANGE, so its one pre-existing near-miss is named, not hidden: the quiet line
      // (#6E6A62) on the wash (#EDEAE0) measures 4.47:1 and has since before 18 Nov. Dark holds the pair at 5.21.
      if (theme === 'light' && fg === '--color-ink-3' && bg === '--color-wash') {
        assert.ok(ratio(hex(fg, theme), hex(bg, theme)) < 4.5, 'the light quiet-line-on-wash pair now passes — delete this exception');
        continue;
      }
      const r = ratio(hex(fg, theme), hex(bg, theme));
      measured += 1;
      assert.ok(r >= 4.5, `${theme}: ${fg} on ${bg} reads ${r.toFixed(2)}:1 — under WCAG AA (4.5:1)`);
    }
  }
  assert.ok(measured >= 38, 'anti-vacuity: too few pairs were measured');
  // Dark only: the decision and the money colour, written as WORDS on a frame, and the category colours on their own tint
  // (the colour at 16 % over the frame — how a chip and a category tile are drawn in dark).
  const over = (fg: string, bg: string, a: number) =>
    '#' + [1, 3, 5].map((i) => Math.round(parseInt(fg.slice(i, i + 2), 16) * a + parseInt(bg.slice(i, i + 2), 16) * (1 - a)).toString(16).padStart(2, '0')).join('');
  const frame = hex('--color-raised', 'dark');
  for (const t of ['--color-mulberry', '--color-ok', '--color-warn', '--color-danger', '--color-info', '--color-cat-booked', '--color-cat-schedule', '--color-cat-asked', '--color-cat-collect']) {
    const c = hex(t, 'dark');
    assert.ok(ratio(c, frame) >= 4.5, `dark: ${t} as a word on the frame reads ${ratio(c, frame).toFixed(2)}:1`);
    const tint = over(c, frame, 0.16);
    assert.ok(ratio(c, tint) >= 4.5, `dark: ${t} on its own 16 % tint reads ${ratio(c, tint).toFixed(2)}:1`);
  }
  // The hero's glow at its brightest: the decision at 40 % over the band's base. The hero's words are the ink.
  const glow = over(hex('--color-mulberry', 'dark'), hex('--color-band-from', 'dark'), 0.4);
  assert.ok(ratio(hex('--color-ink', 'dark'), glow) >= 4.5, `dark: the ink on the hero's brightest glow (${glow}) reads ${ratio(hex('--color-ink', 'dark'), glow).toFixed(2)}:1`);
  assert.ok(ratio(hex('--color-ink-2', 'dark'), glow) >= 4.5, `dark: the hero's second line on the glow reads under AA`);
});

test('5 · the retired dark neutrals are gone from the dark token blocks', () => {
  /** A token that is the SAME colour in both themes on purpose keeps its old literal — named, with its reason. */
  const KEPT: Record<string, string> = {
    '--sn-ink-black': 'ink on a light-gold fill that stays light-gold in dark — the same in both themes on purpose',
    '--fd-logo-ground': 'a shop logo is drawn for a light ground and keeps one in dark',
    '--sn-spot-shade': 'the tour scrim — a black, not a surface',
  };
  const RETIRED = /#17160f\b|#232019\b|#1e1c15\b|#2b2821\b|#332f27\b|#fbfaf7\b|#e5794e\b|\b35[ ,]+32[ ,]+25\b|\b23[ ,]+22[ ,]+15\b|\b251[ ,]+250[ ,]+247\b|\b229[ ,]+121[ ,]+78\b/i;
  const hits: string[] = [];
  let read = 0;
  for (const scope of ['root', 'fd'] as const) {
    const light = rawTokens('light', scope);
    const dark = rawTokens('dark', scope);
    for (const [name, value] of Object.entries(dark)) {
      if (light[name] === value) continue; // not a dark declaration
      read += 1;
      if (RETIRED.test(value) && !(name in KEPT)) hits.push(`${name}: ${value}`);
    }
  }
  assert.ok(read > 120, `anti-vacuity: only ${read} dark declarations were read`);
  assert.deepEqual(hits, [], 'a dark token still holds a retired 13 Oct neutral — point it at the one colour set');
  // …and the reader can see one: a stand-in declaration is caught.
  assert.ok(RETIRED.test('#232019') && RETIRED.test('rgba(251,250,247,.16)') && !RETIRED.test('rgb(var(--color-ink) / .16)'));
});
