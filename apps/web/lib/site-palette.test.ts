import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { buildSitePaletteVars, ledPaletteFromMoodBoard } from './site-palette';

// Local contrast math (independent of the impl) so the test verifies the real
// output meets WCAG AA, not just that it produced something.
function chanToRgb(s: string): { r: number; g: number; b: number } {
  const [r = 0, g = 0, b = 0] = s.split(' ').map(Number);
  return { r, g, b };
}
function lin(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function lum(c: { r: number; g: number; b: number }): number {
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}
function contrast(a: string, b: string): number {
  const la = lum(chanToRgb(a));
  const lb = lum(chanToRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

test('returns null for absent / empty palettes (→ defaults apply)', () => {
  assert.equal(buildSitePaletteVars(null), null);
  assert.equal(buildSitePaletteVars(undefined), null);
  assert.equal(buildSitePaletteVars({}), null);
  assert.equal(buildSitePaletteVars({ reception: [] }), null);
});

test('emits channel-format values for the 8 site tokens', () => {
  const vars = buildSitePaletteVars({ reception: ['#C97B4B', '#824A2A', '#FAF7F2'] });
  assert.ok(vars);
  for (const key of [
    '--color-cream',
    '--color-ink',
    '--color-terracotta',
    '--color-terracotta-600',
    '--color-terracotta-700',
    '--color-mulberry',
    '--color-mulberry-600',
    '--color-mulberry-700',
  ]) {
    assert.match(vars![key]!, /^\d{1,3} \d{1,3} \d{1,3}$/, `${key} is "R G B"`);
  }
});

// ── Pahina material tokens (design 2026-07-25 §4) ────────────────────────────

test('Pahina: emits gild / paper-deep / veil in channel format', () => {
  const vars = buildSitePaletteVars({ reception: ['#C97B4B', '#824A2A', '#FAF7F2'] });
  assert.ok(vars);
  for (const key of ['--color-gild', '--color-paper-deep', '--color-veil']) {
    assert.match(vars![key]!, /^\d{1,3} \d{1,3} \d{1,3}$/, `${key} is "R G B"`);
  }
});

test('Pahina: gild falls back to Atelier gold on a cool palette', () => {
  // Blues only — no warm mid-luminance swatch → fallback #A9834B = 169 131 75.
  const vars = buildSitePaletteVars({ reception: ['#22406B', '#7FA6D9', '#F5F8FC'] });
  assert.ok(vars);
  assert.equal(vars!['--color-gild'], '169 131 75');
});

test('Pahina: gild warms toward metallic on a warm palette (not the raw swatch)', () => {
  const vars = buildSitePaletteVars({ reception: ['#C97B4B', '#FAF7F2'] });
  assert.ok(vars);
  const { r, g, b } = chanToRgb(vars!['--color-gild']!);
  // 35% blend of #C97B4B toward #B08D57 — must differ from the raw swatch and
  // sit between the two on the red channel.
  assert.notEqual(`${r} ${g} ${b}`, '201 123 75', 'not the raw swatch');
  assert.ok(r <= 201 && r >= 176, 'red channel between swatch and gold target');
});

test('Pahina: the plates are the Supporting colour (slot 2); with none, a hair darker than paper', () => {
  // 🎨 THE 5 MAIN COLOURS, ONE JOB EACH (owner 2026-10-05): Supporting → cards / sections.
  const slotted = buildSitePaletteVars({ reception: ['#C97B4B', '#E3D3C2', '#A9B89E', '#FAF7F2', '#B08D57'] })!;
  assert.deepEqual(chanToRgb(slotted['--color-paper-deep']!), { r: 0xe3, g: 0xd3, b: 0xc2 });
  // A dark Supporting is softened to a tint of itself, toward the paper, until the words read.
  const dark = buildSitePaletteVars({ reception: ['#C97B4B', '#824A2A', '#A9B89E', '#FAF7F2', '#B08D57'] })!;
  const p = chanToRgb(dark['--color-paper-deep']!);
  assert.ok(p.r > 0x82 && p.r <= 0xfa && p.r > p.b, 'the cards are a warm tint of the Supporting colour, lifted toward the paper');
  const vars = buildSitePaletteVars({ reception: ['#FAF7F2'] });
  assert.ok(vars);
  const paper = chanToRgb(vars!['--color-cream']!);
  const deep = chanToRgb(vars!['--color-paper-deep']!);
  assert.ok(lum(deep) < lum(paper), 'paper-deep darker than paper');
  assert.ok(lum(paper) - lum(deep) < 0.12, 'but only slightly');
});

test('accent reads as text on paper, and light text reads on the CTA (AA 4.5)', () => {
  // A deliberately tricky pastel palette (light, low-contrast decor colors).
  const vars = buildSitePaletteVars({
    reception: ['#F0D9DE', '#C98B9A', '#A9B89E'],
    ceremony: ['#F6F1E7'],
  })!;
  assert.ok(vars);
  assert.ok(
    contrast(vars['--color-terracotta']!, vars['--color-cream']!) >= 4.5,
    'accent vs paper >= 4.5',
  );
  assert.ok(
    contrast(vars['--color-mulberry']!, '255 255 255') >= 4.5,
    'white text on CTA >= 4.5',
  );
  // Body text on the page must stay strongly legible.
  assert.ok(contrast(vars['--color-ink']!, vars['--color-cream']!) >= 7, 'ink vs paper >= 7');
});

// ── ledPaletteFromMoodBoard (0005 LED × 0010 Mood Board) ─────────────────────

const HEX = /^#[0-9a-f]{6}$/;
// A representative dark template ([bg, accent1, accent2]). These values came
// from the LED template list, removed 2026-08-11; inlined here because the
// surviving caller is the Dance-Floor Mural and the math is what is under test.
const DARK_TPL = ['#0F0F0F', '#C9A14B', '#3A2A1C'] as const;
const LIGHT_TPL = ['#F4EBD9', '#E3CDA0', '#A6815C'] as const;

test('LED: returns null when the palette is empty or colourless → template fallback', () => {
  assert.equal(ledPaletteFromMoodBoard(null, DARK_TPL), null);
  assert.equal(ledPaletteFromMoodBoard(undefined, DARK_TPL), null);
  assert.equal(ledPaletteFromMoodBoard({}, DARK_TPL), null);
  // An all-grey palette has no hue to contribute → keep the template default.
  assert.equal(ledPaletteFromMoodBoard({ reception: ['#808080', '#444444'] }, DARK_TPL), null);
});

test('LED: maps the boldest Mood-Board swatch onto accent1', () => {
  const out = ledPaletteFromMoodBoard({ reception: ['#C97B4B', '#824A2A', '#D08654'] }, DARK_TPL);
  assert.ok(out);
  const [bg, accent1, accent2] = out!;
  for (const h of [bg, accent1, accent2]) assert.match(h, HEX, `${h} is #rrggbb`);
  // The most colourful swatch is the orange #C97B4B → accent1 (the dominant glow).
  assert.equal(accent1, '#c97b4b');
  // accent2 stays distinct from accent1 so the two radial blooms separate.
  assert.notEqual(accent2, accent1);
});

test('LED: preserves the template tone (dark stays dark, light stays light)', () => {
  const dark = ledPaletteFromMoodBoard({ reception: ['#C97B4B', '#824A2A'] }, DARK_TPL)!;
  const light = ledPaletteFromMoodBoard({ reception: ['#C97B4B', '#824A2A'] }, LIGHT_TPL)!;
  assert.ok(lum(chanFromHex(dark[0])) < 0.3, 'dark template bg stays dark');
  assert.ok(lum(chanFromHex(light[0])) > 0.5, 'light template bg stays light');
});

test('LED: single-hue palette still yields two separable accents', () => {
  const out = ledPaletteFromMoodBoard({ reception: ['#BE185D'] }, DARK_TPL)!;
  assert.ok(out);
  assert.notEqual(out[1], out[2], 'accent2 lifts from accent1 when the palette is single-hued');
});

function chanFromHex(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

test('THE 5 MAIN COLOURS (owner 2026-10-05): each slot does its one job, and attire never dresses the Event Hub', () => {
  // Dominant · Supporting · Accent · Neutral · Accent 2.
  const board = {
    reception: ['#2E4A3F', '#E8DCC8', '#8A3B52', '#F7F2EA', '#B08D57'],
    // The most saturated colour on the board is a bridesmaid's — it must NOT become the button.
    bridesmaids: ['#00E5FF'],
    guest: ['#FF00AA'],
    bride: ['#FF2200'],
  };
  const v = buildSitePaletteVars(board)!;
  assert.deepEqual(chanToRgb(v['--color-cream']!), { r: 0xf7, g: 0xf2, b: 0xea }, 'Neutral is the paper');
  assert.deepEqual(chanToRgb(v['--color-paper-deep']!), { r: 0xe8, g: 0xdc, b: 0xc8 }, 'Supporting is the cards');
  assert.deepEqual(chanToRgb(v['--color-gild']!), { r: 0xb0, g: 0x8d, b: 0x57 }, 'Accent 2 is the ornaments, exactly');
  const button = chanToRgb(v['--color-mulberry']!);
  const link = chanToRgb(v['--color-terracotta']!);
  const near = (c: { r: number; g: number; b: number }, hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return Math.abs(c.r - ((n >> 16) & 255)) + Math.abs(c.g - ((n >> 8) & 255)) + Math.abs(c.b - (n & 255));
  };
  assert.ok(near(button, '#8A3B52') < near(button, '#00E5FF'), 'the button is the Accent, not the bridesmaids’ colour');
  assert.ok(near(link, '#8A3B52') < 60, 'links are the Accent (only darkened for contrast)');
  for (const hex of ['#00E5FF', '#FF00AA', '#FF2200']) {
    for (const [k, val] of Object.entries(v)) {
      if (k.startsWith('--color-')) assert.ok(near(chanToRgb(val), hex) > 40, `${k} took an attire colour ${hex}`);
    }
  }
  // Text is computed: every word reads on what it sits on.
  assert.ok(contrast(v['--color-ink']!, v['--color-cream']!) >= 4.5);
  assert.ok(contrast(v['--color-terracotta']!, v['--color-cream']!) >= 4.5);
  assert.ok(contrast(v['--color-cream']!, v['--color-mulberry']!) >= 4.5, 'the button label (the paper) reads on the button');
  assert.ok(contrast(v['--color-ink-on-plate']!, v['--color-paper-deep']!) >= 4.5, 'card words read on the Supporting colour');
  // A board with ONLY attire colours does not dress the page at all.
  assert.equal(buildSitePaletteVars({ bridesmaids: ['#00E5FF'], guest: ['#FF00AA'] }), null);
});

test('a dark, mid or light Supporting colour: card words (the page ink and the plate ink) always read on the cards', () => {
  for (const supporting of ['#1E2229', '#6B4F3A', '#9CA98B', '#C9A9A6', '#E8DCC8']) {
    const v = buildSitePaletteVars({ reception: ['#2E4A3F', supporting, '#8A3B52', '#F7F2EA', '#B08D57'] })!;
    assert.ok(contrast(v['--color-ink']!, v['--color-paper-deep']!) >= 4.5, `${supporting}: page ink on the cards ${contrast(v['--color-ink']!, v['--color-paper-deep']!).toFixed(2)}`);
    assert.ok(contrast(v['--color-ink-on-plate']!, v['--color-paper-deep']!) >= 4.5, `${supporting}: plate ink on the cards`);
  }
  // A light Supporting is the cards exactly.
  const light = buildSitePaletteVars({ reception: ['#2E4A3F', '#E8DCC8', '#8A3B52', '#F7F2EA', '#B08D57'] })!;
  assert.deepEqual(chanToRgb(light['--color-paper-deep']!), { r: 0xe8, g: 0xdc, b: 0xc8 });
});

test('hover steps move away from the paper — lighter on a dark page', () => {
  const dark = buildSitePaletteVars({ reception: ['#E9D8A6', '#2A2A35', '#C77DFF', '#121218', '#B08D57'] })!;
  assert.ok(lum(chanToRgb(dark['--color-mulberry-600']!)) > lum(chanToRgb(dark['--color-mulberry']!)), 'a hover on a dark page went darker');
  const light = buildSitePaletteVars({ reception: ['#2E4A3F', '#E8DCC8', '#8A3B52', '#F7F2EA', '#B08D57'] })!;
  assert.ok(lum(chanToRgb(light['--color-mulberry-600']!)) < lum(chanToRgb(light['--color-mulberry']!)));
});

test("Accent 2: ornaments keep the raw hue; WORDS set in it read — maria-and-jose's real board", () => {
  // Measured live 2026-10-05: #D8C7B0 on #C9A9A6 = 1.2:1, the "and" all but gone —
  // and pulling the ornament token itself turned every border, ring and seal to ink.
  const maria = { reception: ['#FBFBFA', '#C5A059', '#9CA98B', '#C9A9A6', '#D8C7B0'] };
  const v = buildSitePaletteVars(maria)!;
  assert.equal(v['--color-gild'], '216 199 176', 'the ornaments are Accent 2 exactly — never pulled toward ink');
  assert.ok(contrast(v['--color-gild-text']!, v['--color-cream']!) >= 4.5, `gild words on paper ${contrast(v['--color-gild-text']!, v['--color-cream']!).toFixed(2)}`);
  // On a dark page the words lighten instead.
  const dark = buildSitePaletteVars({ reception: ['#E9D8A6', '#2A2A35', '#C77DFF', '#121218', '#5A4A2A'] })!;
  assert.equal(dark['--color-gild'], '90 74 42');
  assert.ok(contrast(dark['--color-gild-text']!, dark['--color-cream']!) >= 4.5);
  // `text-gild` reads the text token; `bg-`/`border-gild` keep the raw one.
  const tw = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'tailwind.config.ts'), 'utf8');
  assert.match(tw, /textColor: \{\s*gild: 'rgb\(var\(--color-gild-text, var\(--color-gild\)\) \/ <alpha-value>\)',/);
  assert.match(tw, /\n\s+gild: 'rgb\(var\(--color-gild\) \/ <alpha-value>\)',/, 'the decor gild colour is gone');
});

test('THE BAR (controller 2026-10-05): every TEXT role reads on the paper AND on the cards, at the faintest step; decor keeps its raw hue', async () => {
  const { plateInkReads, contrastOf, PLATE_MUTED_ALPHA, PLATE_MIN_CONTRAST } = await import('@/app/[slug]/_lib/pro-site-vars');
  const { PLATE_MUTED_ALPHA_BAR, PLATE_MIN_CONTRAST_BAR } = await import('./site-palette');
  assert.equal(PLATE_MUTED_ALPHA_BAR, PLATE_MUTED_ALPHA, 'the restated bar drifted from pro-site-vars');
  assert.equal(PLATE_MIN_CONTRAST_BAR, PLATE_MIN_CONTRAST);
  const boards: Record<string, string[]> = {
    '(a) deep + wine + gold on ivory': ['#2B2B2B', '#7A1F3D', '#D4AF37', '#FFF8F0', '#EBD9C8'],
    '(b) dusty-blue Supporting': ['#2E4A3F', '#7D93AD', '#8A3B52', '#F7F2EA', '#B08D57'],
    'maria-and-jose (prod)': ['#FBFBFA', '#C5A059', '#9CA98B', '#C9A9A6', '#D8C7B0'],
    'a dark Neutral': ['#E9D8A6', '#2A2A35', '#C77DFF', '#121218', '#5A4A2A'],
  };
  for (const [name, reception] of Object.entries(boards)) {
    const v = buildSitePaletteVars({ reception })!;
    const paper = v['--color-cream']!;
    const plate = v['--color-paper-deep']!;
    const hex = (h: string) => h; // hub-heading is a hex; contrastOf takes either
    for (const [ground, g] of [['paper', paper], ['cards', plate]] as const) {
      assert.ok(plateInkReads(v['--color-ink']!, g), `${name}: page ink /65 on the ${ground}`);
      assert.ok(plateInkReads(v['--color-ink-on-plate']!, plate), `${name}: card ink /65 on the cards`);
      for (const k of ['--color-terracotta', '--color-mulberry', '--color-gild-text'] as const) {
        assert.ok(contrastOf(v[k]!, g) >= 4.5, `${name}: ${k} on the ${ground} ${contrastOf(v[k]!, g).toFixed(2)}`);
      }
      assert.ok(contrastOf(hex(v['--hub-heading']!), g) >= 3, `${name}: heading on the ${ground}`);
    }
    assert.ok(contrastOf(paper, v['--color-mulberry']!) >= 4.5, `${name}: the button label`);
    // Decor keeps the raw Accent 2.
    const raw = reception[4]!;
    const n = parseInt(raw.slice(1), 16);
    assert.equal(v['--color-gild'], `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`, `${name}: the ornaments were pulled`);
  }
});

test('FUZZ (seeded): a few hundred boards, light and dark Neutral — every text role clears the bar AS WRITTEN (rounded channels)', async () => {
  const { plateInkReads, contrastOf } = await import('@/app/[slug]/_lib/pro-site-vars');
  let seed = 0x5e7a1;
  const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32);
  const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
  const any = () => hex(rnd() * 255, rnd() * 255, rnd() * 255);
  let checked = 0;
  for (let i = 0; i < 400; i++) {
    const dark = i % 2 === 1;
    // A light Neutral (≥ #D8 per channel) or a dark one (≤ #30) — mid-grey is best-effort by design.
    const n = dark ? hex(rnd() * 48, rnd() * 48, rnd() * 48) : hex(216 + rnd() * 39, 216 + rnd() * 39, 216 + rnd() * 39);
    const v = buildSitePaletteVars({ reception: [any(), any(), any(), n, any()] })!;
    const paper = v['--color-cream']!;
    const plate = v['--color-paper-deep']!;
    for (const g of [paper, plate]) {
      assert.ok(plateInkReads(v['--color-ink']!, g), `board ${i}: ink /65 ${contrastOf(v['--color-ink']!, g).toFixed(2)}`);
      for (const k of ['--color-terracotta', '--color-mulberry', '--color-gild-text'] as const) {
        assert.ok(contrastOf(v[k]!, g) >= 4.5, `board ${i} (${dark ? 'dark' : 'light'}): ${k} ${contrastOf(v[k]!, g).toFixed(3)}`);
      }
      assert.ok(contrastOf(v['--hub-heading']!, g) >= 3, `board ${i}: heading`);
    }
    assert.ok(plateInkReads(v['--color-ink-on-plate']!, plate), `board ${i}: card ink`);
    assert.ok(contrastOf(paper, v['--color-mulberry']!) >= 4.5, `board ${i}: button label ${contrastOf(paper, v['--color-mulberry']!).toFixed(3)}`);
    checked += 1;
  }
  assert.equal(checked, 400);
});
