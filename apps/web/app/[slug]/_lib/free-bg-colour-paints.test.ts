/**
 * A FREE COUPLE'S BACKGROUND COLOUR REACHES THE GUEST (owner 2026-09-25 "fix
 * it" — Event Hub Pro feature list: "Free: … bg colour").
 *
 * `events.site_bg_color` saved, but `proSiteVarsFor` painted it only when the
 * event owned ACTIVE Website Pro (`proWatermarkHidden`) — a free couple's
 * choice was stored and never shown. This measures the PROPERTY on
 * `proSiteVarsFor` itself (moved to `./pro-site-vars` so it is a small, pure
 * module a test can import directly, without `loaders.ts`'s own heavy
 * request-scoped import graph — the admin Supabase client, `next/server`,
 * …): a background colour paints for a non-Pro event, button colour and font
 * still do not, and the text ink adapts to whichever background actually
 * painted (`lib/hub-legibility.ts`, ruled free for everyone the same day).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { proSiteVarsFor } from './pro-site-vars';
import { contrastRatio } from '@/lib/hub-legibility';

const DARK_BG = '#101010';
const LIGHT_BG = '#f5f0e6';

test('a free (non-Pro) event still paints its saved background colour', () => {
  const vars = proSiteVarsFor({ site_bg_color: LIGHT_BG, site_button_color: null, site_font_key: null }, false);
  assert.ok(vars, 'a free event with a saved bg colour got no vars at all — the colour never reaches the guest');
  assert.equal(vars!['--color-cream'], '245 240 230', 'the free bg colour is not the one the couple saved');
});

test('button colour and the couple’s font stay Pro-only on the free path', () => {
  const vars = proSiteVarsFor(
    { site_bg_color: LIGHT_BG, site_button_color: '#ab1122', site_font_key: 'playfair' },
    false,
  );
  assert.ok(vars, 'expected the free bg colour to still paint');
  assert.equal(vars!['--color-mulberry'], undefined, 'a free event painted the Pro-only button colour');
  assert.equal(vars!['--pahina-face'], undefined, 'a free event painted the Pro-only font');
});

test('an unset background and no Pro colours paint nothing — byte-identical to today', () => {
  const vars = proSiteVarsFor({ site_bg_color: null, site_button_color: null, site_font_key: null }, false);
  assert.equal(vars, null, 'an event with nothing set now paints something — the inert contract broke');
});

test('a Pro event still gets its button colour and font on top of the free background', () => {
  const vars = proSiteVarsFor(
    { site_bg_color: LIGHT_BG, site_button_color: '#ab1122', site_font_key: null },
    true,
  );
  assert.ok(vars, 'expected vars for a Pro event');
  assert.equal(vars!['--color-cream'], '245 240 230', 'Pro lost the free background colour');
  assert.ok(vars!['--color-mulberry'], 'Pro lost its own button colour');
});

test('text ink adapts to the couple’s own background — dark bg gets light ink, light bg gets dark ink', () => {
  const onDark = proSiteVarsFor({ site_bg_color: DARK_BG, site_button_color: null, site_font_key: null }, false);
  const onLight = proSiteVarsFor({ site_bg_color: LIGHT_BG, site_button_color: null, site_font_key: null }, false);
  assert.ok(onDark && onLight, 'expected vars for both backgrounds');

  const channelsToHex = (ch: string) => {
    const [r, g, b] = ch.split(' ').map((n) => Number(n));
    return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
  };
  const darkBgInk = channelsToHex(onDark!['--color-ink']!);
  const lightBgInk = channelsToHex(onLight!['--color-ink']!);

  assert.ok(
    contrastRatio(darkBgInk, DARK_BG) >= 4.5,
    `ink over a dark background must clear AA body text, got ${contrastRatio(darkBgInk, DARK_BG).toFixed(2)}:1`,
  );
  assert.ok(
    contrastRatio(lightBgInk, LIGHT_BG) >= 4.5,
    `ink over a light background must clear AA body text, got ${contrastRatio(lightBgInk, LIGHT_BG).toFixed(2)}:1`,
  );
  assert.notEqual(darkBgInk.toLowerCase(), lightBgInk.toLowerCase(), 'the same ink was used over opposite backgrounds');
});

test('no background set → no ink override either (nothing to adapt to)', () => {
  const vars = proSiteVarsFor({ site_bg_color: null, site_button_color: '#ab1122', site_font_key: null }, true);
  assert.ok(vars, 'expected the Pro button colour to still paint');
  assert.equal(vars!['--color-ink'], undefined, 'an ink override appeared with no couple-chosen background to adapt to');
});

test('a plate keeps its own (dark, house) ink, decoupled from the adapted PAGE ink', () => {
  // `.pahina-plate` (the "When/Where" box, the reply card, …) never darkens
  // its own paper — `--color-paper-deep` stays light regardless of the page
  // background. Its CSS falls back from `--color-ink-on-plate` to
  // `--color-ink`, so once a dark page background flips `--color-ink` light,
  // an unset `--color-ink-on-plate` would make every plate's value light text
  // on the plate's OWN still-light paper — invisible. Screenshotted while
  // building this fix, before `--color-ink-on-plate` was pinned below.
  const vars = proSiteVarsFor({ site_bg_color: DARK_BG, site_button_color: null, site_font_key: null }, false);
  assert.ok(vars, 'expected vars for a dark background');
  assert.ok(vars!['--color-ink-on-plate'], 'no plate ink was pinned at all');
  assert.notEqual(
    vars!['--color-ink-on-plate'],
    vars!['--color-ink'],
    'the plate ink is the SAME as the (light, for this dark bg) page ink — it will go blank on the plate\'s own light paper',
  );
  const channelsToHex = (ch: string) => {
    const [r, g, b] = ch.split(' ').map((n) => Number(n));
    return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
  };
  const plateInkHex = channelsToHex(vars!['--color-ink-on-plate']!);
  const PLATE_PAPER = '#f1f1f0'; // --color-paper-deep's root default (globals.css) — unset here, no mood board
  assert.ok(
    contrastRatio(plateInkHex, PLATE_PAPER) >= 4.5,
    `the plate ink must clear AA on the plate's own light paper, got ${contrastRatio(plateInkHex, PLATE_PAPER).toFixed(2)}:1`,
  );
});
