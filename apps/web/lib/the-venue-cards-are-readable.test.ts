/**
 * the-venue-cards-are-readable.test.ts — A GUEST CAN READ WHERE THE WEDDING IS.
 *
 * Owner, 2026-09-30, screenshot of `cale-ice`'s Venue scene: *"I cannot see the
 * venues properly."* Measured on the live page at 390 px: the venue NAME painted
 * rgb(243 231 220) on its plate's rgb(240 237 232) — 1.1 : 1. The theme was
 * `velvet` (dark: its plate ink is LIGHT, for its own dark plate); the couple's
 * mood-board palette, spread inline over it, repainted the plate paper LIGHT and
 * named no plate ink, so velvet's light ink landed on light paper.
 *
 * 🔑 A TOKEN CANNOT SEE THE PIXELS. This file never asks "is the token set?" —
 * it resolves the CASCADE the browser resolves (`:root` → the theme's block in
 * `globals.css` → the inline bag `guestLookFrom` hands the scope) and measures
 * the BLENDED pixel of every word on a venue card:
 *
 *   · "Ceremony"/"Reception" `text-ink/80` on the plate  (was `text-gild`: 1.76 : 1
 *                                          measured on cale-ice; the gild is a decor
 *                                          metal, never text — lib/site-palette.ts)
 *   · the name             `text-ink`     on the plate  (alpha 1)
 *   · the address          `text-ink/80`  on the plate  (was /65: 4.13–4.44 : 1
 *                                                         on house · galeriya · regency)
 *   · "Get directions"     `text-ink/80`  on the plate
 *   · the directions chips `text-ink/75`  on `bg-cream`, which the card re-grounds
 *                                          to the plate paper (it was the PAGE ground:
 *                                          1.0 : 1 wherever page and plate differ)
 *   · the withheld line    `text-ink/80`  on the page ground
 *
 * for EVERY theme the Event Hub ships × every colour source a couple can set
 * (none · a mood-board palette · a plain background, light and dark · both · an
 * ombré), each at ≥ 4.5 : 1.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { INVITE_THEMES, INVITE_THEME_IDS, type InviteThemeId } from '@/lib/invite-themes';
import { buildSitePaletteVars } from '@/lib/site-palette';
import { sanitizeRolePalette } from '@/lib/mood-board';
import { ombreLook, parseSiteBackground } from '@/lib/ombre';
import {
  blendOver,
  contrastOf,
  pinPlateInk,
  proSiteVarsFor,
} from '@/app/[slug]/_lib/pro-site-vars';

const WEB = join(__dirname, '..');
const CSS = readFileSync(join(WEB, 'app/globals.css'), 'utf8');
const LOADERS = readFileSync(join(WEB, 'app/[slug]/_lib/loaders.ts'), 'utf8');
const WIDGET = readFileSync(join(WEB, 'app/[slug]/_components/venue-widget.tsx'), 'utf8');
const NAV = readFileSync(join(WEB, 'app/_components/nav-links.tsx'), 'utf8');

/** Every block for `selector` (top level or inside `@layer`), merged in source order (later wins). */
function cssVars(selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  const esc = selector.replace(/[[\]'().*]/g, (c) => `\\${c}`);
  const re = new RegExp(`^[ \\t]*${esc}\\s*\\{([^}]*)\\}`, 'gm');
  for (const m of CSS.matchAll(re)) {
    for (const d of m[1]!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[d[1]!] = d[2]!.trim();
  }
  return out;
}
const ROOT = cssVars(':root');

/** What the page scope resolves, for one theme and one inline bag. */
function cascade(themeId: InviteThemeId, inline: Record<string, string> | null) {
  // House stamps no `data-hub-theme` (loaders.ts: `theme: 'house' ? null`).
  const theme = themeId === 'house' ? {} : cssVars(`[data-hub-theme='${themeId}']`);
  const v = { ...ROOT, ...theme, ...(inline ?? {}) };
  const get = (k: string) => {
    const x = v[k];
    assert.ok(x && /^\d+ \d+ \d+$/.test(x), `${themeId}: ${k} does not resolve to channels (got ${x})`);
    return x!;
  };
  const plate = get('--color-paper-deep');
  const cream = get('--color-cream');
  // `.pahina-plate { --color-ink: var(--color-ink-on-plate, var(--color-ink)) }`
  const plateInk = v['--color-ink-on-plate'] ?? get('--color-ink');
  return { plate, cream, plateInk, pageInk: get('--color-ink') };
}

/** Exactly the layers `guestLookFrom` spreads, in its order (asserted below). */
function look(themeId: InviteThemeId, event: Record<string, unknown>, proActive: boolean) {
  const palette = buildSitePaletteVars(sanitizeRolePalette(event.role_palette));
  const pro = proSiteVarsFor(event, proActive, themeId);
  let vars = pro ? { ...(palette ?? {}), ...pro } : palette;
  const bg = parseSiteBackground(event.site_bg_color);
  if (bg?.kind === 'ombre') vars = { ...(vars ?? {}), ...ombreLook(INVITE_THEMES[themeId], bg.ombre).vars };
  return vars && Object.keys(vars).length > 0 ? pinPlateInk(vars, themeId) : null;
}

/** cale-ice's shape: a dusty-pink / terracotta mood board on a near-white paper. */
const PINK_BOARD = { reception: ['#C97B4B', '#CEA7AE', '#FAF7F2'], ceremony: ['#D3AE93'] };

const SOURCES: Record<string, Record<string, unknown>> = {
  'no colours': {},
  'a mood-board palette (cale-ice)': { role_palette: PINK_BOARD },
  'a light background': { site_bg_color: '#f5efe6' },
  'a dark background': { site_bg_color: '#1a1410' },
  'palette + a dark background': { role_palette: PINK_BOARD, site_bg_color: '#1a1410' },
  'palette + a light background': { role_palette: PINK_BOARD, site_bg_color: '#f5efe6' },
  'a dark ombré': { site_bg_color: 'ombre:diagonal:#1a1410' },
  'palette + a light ombré': { role_palette: PINK_BOARD, site_bg_color: 'ombre:glow:#f3e2d8' },
};

const MIN = 4.5;

test('every venue word reads (≥ 4.5 : 1) on every theme × every colour source', () => {
  const failures: string[] = [];
  let checked = 0;
  for (const themeId of INVITE_THEME_IDS) {
    for (const [source, event] of Object.entries(SOURCES)) {
      for (const proActive of [false, true]) {
        const { plate, cream, plateInk, pageInk } = cascade(themeId, look(themeId, event, proActive));
        // The directions chips sit on the PLATE: the plate re-grounds `--color-cream`
        // to its own paper (venue-widget.tsx `VENUE_CHIP_GROUND`).
        const chip = plate;
        void cream;
        const words: [string, string, string, number][] = [
          ['"Ceremony" / "Reception" label', plateInk, plate, 0.8],
          ['name', plateInk, plate, 1],
          ['address', plateInk, plate, 0.8],
          ['"Get directions"', plateInk, plate, 0.8],
          ['directions button', plateInk, chip, 0.75],
          ['the "opens when you reply" line (page ground)', pageInk, cream, 0.8],
        ];
        for (const [word, ink, ground, alpha] of words) {
          checked++;
          const c = contrastOf(blendOver(ink, ground, alpha), ground);
          if (c < MIN) failures.push(`${themeId} · ${source}${proActive ? ' · Pro' : ''} · ${word}: ${c.toFixed(2)} : 1 (ink ${ink} on ${ground})`);
        }
      }
    }
  }
  assert.ok(checked >= INVITE_THEME_IDS.length * 8 * 2 * 6, `only ${checked} measurements ran`);
  assert.deepEqual(failures, [], `unreadable venue words:\n  ${failures.join('\n  ')}`);
});

test('the measured failure is reproduced without the pin (the guard can see the bug)', () => {
  const raw = buildSitePaletteVars(sanitizeRolePalette(PINK_BOARD))!;
  const { plate, plateInk } = cascade('velvet', raw);
  assert.ok(contrastOf(plateInk, plate) < 2, `velvet + a light palette should reproduce the invisible name (got ${contrastOf(plateInk, plate).toFixed(2)})`);
  const fixed = cascade('velvet', pinPlateInk(raw, 'velvet'));
  assert.ok(contrastOf(blendOver(fixed.plateInk, fixed.plate, 0.65), fixed.plate) >= MIN);
});

test('an event whose plate already reads is served byte-identical vars', () => {
  const raw = buildSitePaletteVars(sanitizeRolePalette(PINK_BOARD))!;
  assert.equal(pinPlateInk(raw, 'house'), raw);
});

test('guestLookFrom spreads palette → the couple’s colours → ombré, and pins the plate ink LAST', () => {
  const start = LOADERS.indexOf('export function guestLookFrom(');
  assert.ok(start > 0, 'guestLookFrom is gone from loaders.ts');
  const body = LOADERS.slice(start, LOADERS.indexOf('\n}\n', start));
  const at = (re: RegExp) => body.search(re);
  const order = [
    at(/buildSitePaletteVars\(sanitizeRolePalette\(event\.role_palette\)\)/),
    at(/proSiteVarsFor\(event, proActive, hub\.theme\)/),
    at(/ombreLook\(INVITE_THEMES\[hub\.theme\]/),
    at(/vars:\s*vars && Object\.keys\(vars\)\.length > 0 \? pinPlateInk\(vars, hub\.theme\) : null/),
  ];
  assert.ok(order.every((i) => i >= 0), `a layer moved out of guestLookFrom (positions ${order.join(', ')}) — this test composes the same layers; keep them in step`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'the layers are spread in a different order than this test measures');
});

test('the venue card and its buttons paint with the tokens measured above', () => {
  // The words: `text-ink` (name) and `text-ink/65` (address) inside `.pahina-plate`.
  assert.match(WIDGET, /className="pahina-plate[^"]*"/);
  assert.match(WIDGET, /text-ink\/80">\{venue\.address\}/);
  assert.match(WIDGET, /tracking-\[0\.28em\] text-ink\/80">\s*\{VENUE_ROLE_LABEL\[venue\.role\]\}/);
  assert.match(WIDGET, /text-ink\/80">\{VENUE_WITHHELD_LINE\}/);
  assert.match(WIDGET, /label="Get directions"/);
  assert.doesNotMatch(NAV, /tracking-\[0\.2em\] text-ink\/55/, 'the "Get directions" label is back to 55% ink');
  assert.match(NAV, /tracking-\[0\.2em\] text-ink\/80/);
  // The chips' ground is the plate, not the page.
  assert.match(WIDGET, /VENUE_CHIP_GROUND[^;]*'--color-cream': 'var\(--color-paper-deep\)'/);
  assert.match(WIDGET, /className="pahina-plate[^"]*" style=\{VENUE_CHIP_GROUND\}/);
  assert.match(WIDGET, /font-pahina text-2xl[^"]*text-ink">\s*\{venue\.name\}/);
  // The directions chips: `bg-cream` + `text-ink/75` (compact).
  assert.match(NAV, /compact\s*\n?\s*\? 'inline-flex[^']*bg-cream[^']*text-ink\/75/);
});
