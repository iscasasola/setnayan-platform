/**
 * 🎨 ELEMENTS: EVERY ONE OF THE FIVE SHOWS ON THE SAMPLE · EACH TYPE SHOWS ITS COLOUR · EACH FONT SHOWS ITS LOOK.
 *
 * Owner, Maker test 2026-10-14 (DECISION_LOG "MAKER TEST: SEVEN ISSUES", item 4), verbatim:
 *   *"on elements: changing colors does not show on preview · return the type name to show color as well · font
 *   needs to show their look on their dropdown preview texts before showing on the preview screen"*
 *
 * (a) WHY A COLOUR "DID NOT SHOW" — measured by rendering the sample with each of the five changed in turn: the
 *     Dominant moved only `--hub-heading`, which nothing on the sample (or the guest's Event Hub) wears, and the
 *     Supporting moved only the cards' paper, and the sample drew no card. Two of the five did nothing on screen.
 *     Now the names wear the Dominant (its job is "Headings · the names", `MAIN_COLOUR_JOB`) — on the guest page and
 *     the sample by ONE rule (`globals.css` `[data-guest-look] [data-hub-names]`) — and the sample's styles row sits
 *     on the page's card. The Dominant is worn ONLY over the paper it was measured on: under a page colour of the
 *     couple's own, a blend, Candlelight, a picture, a scene's own ground or the canvas preview the names keep the
 *     page's measured ink, exactly as before.
 * (b) Elements' type rows (Names · Headings · Text · Labels & buttons) show the colour each type is drawn in — read
 *     off the sample's own words after they draw, so the swatch can never say a colour the page does not wear.
 * (c) The font dropdown sets a line of the event's words under every face, IN that face; the rows stay
 *     `content-visibility: auto`, so a face downloads only when its row scrolls into the open list.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from './strip-comments';
import { buildSitePaletteVars } from './site-palette-vars';
import { lookSampleScope } from './look-sample';
import { sceneLegibilityVars } from './scene-legibility';
import { INVITE_THEMES } from './invite-themes';
import { contrastRatio } from './hub-legibility';
import { cssColourHex } from './look-sample-store';
import { hubFontPickOptions, HUB_FONT_LEAD } from './hub-font-shelves';
import { fontRowClass } from '../app/dashboard/[eventId]/website/editor/_components/pick-menu-place';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module') as { _load: (request: string, ...rest: unknown[]) => unknown };
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const ROOT = join(import.meta.dirname, '..');
const read = (p: string) => stripComments(readFileSync(join(ROOT, p), 'utf8'));
const L = 'app/dashboard/[eventId]/launch/_components';
const E = 'app/dashboard/[eventId]/website/editor/_components';
const G = 'app/[slug]/_components';

const FIVE = ['#5B1A22', '#F7F2EC', '#C9A86A', '#FBFAF7', '#7A8B6F'];
const ROW = { role_palette: { reception: FIVE }, site_bg_color: null, site_button_color: null, site_button_style: null, site_font_key: null, site_art_direction: null, site_roles: null };
const seed = (over: Record<string, unknown> = {}) => ({
  eventId: `E-${Math.random()}`,
  themeId: 'house',
  fontClassName: '',
  row: { ...ROW, ...over },
  main: null,
  coverRef: null,
  sources: { loops: [], photoChoices: [], videoChoice: null, sceneUploads: [], cover: null, themeId: 'house' },
  words: { names: 'Maria & Jose', date: 'Saturday, 12 June 2027', line: 'Tagaytay' },
  musicOn: false,
  musicButton: 'bars',
});
const rootStyle = (html: string) => {
  const m = /<div[^>]*data-look-sample=""[^>]*style="([^"]*)"/.exec(html);
  assert.ok(m, 'anti-vacuity: the sample root was not drawn');
  return Object.fromEntries(m![1]!.split(';').filter(Boolean).map((d) => [d.slice(0, d.indexOf(':')), d.slice(d.indexOf(':') + 1)]));
};

/** What each of the five moves on the sample, and the drawn thing that wears it (a class or an attribute ON the sample). */
const WORN: Array<{ slot: number; name: string; vars: string[]; wornBy: RegExp }> = [
  { slot: 0, name: 'Dominant (the names)', vars: ['--hub-names-ink'], wornBy: /data-look-sample-names="" data-hub-names=""/ },
  { slot: 1, name: 'Supporting (the cards)', vars: ['--color-paper-deep'], wornBy: /data-look-sample-card=""[^>]*class="[^"]*\bbg-paper-deep\b/ },
  { slot: 2, name: 'Accent (buttons · links)', vars: ['--color-mulberry', '--color-terracotta-700'], wornBy: /class="button-primary\b/ },
  { slot: 3, name: 'Neutral (the paper)', vars: ['--color-cream'], wornBy: /data-look-sample=""[^>]*class="[^"]*\bbg-cream\b/ },
  { slot: 4, name: 'Accent 2 (ornaments)', vars: ['--color-gild-text', '--color-gild'], wornBy: /class="[^"]*\btext-gild\b/ },
];

test('(a) every one of the five changes something the sample DRAWS — at the tap, no render', async () => {
  const { LookSample } = await import(`../${L}/look-sample`);
  const { tellLookSample } = await import('./look-sample-store');
  const s = seed();
  const before = renderToStaticMarkup(React.createElement(LookSample, { seed: s }));
  const was = rootStyle(before);
  const css = read('app/globals.css');
  assert.match(css, /\[data-guest-look\] \[data-hub-names\] \{\s*color: rgb\(var\(--hub-names-ink, var\(--color-ink\)\)\);\s*\}/, 'nothing makes the names wear the Dominant');
  for (const w of WORN) {
    const five = [...FIVE];
    five[w.slot] = w.slot === 3 ? '#20242C' : '#1C6E8C';
    tellLookSample(s.eventId, { five });
    const html = renderToStaticMarkup(React.createElement(LookSample, { seed: s }));
    const now = rootStyle(html);
    assert.ok(
      w.vars.some((v) => now[v] !== undefined && now[v] !== was[v]),
      `${w.name}: changing it moves none of ${w.vars.join(' · ')} on the sample — it does not show`,
    );
    assert.match(html, w.wornBy, `${w.name}: nothing on the sample wears it`);
    tellLookSample(s.eventId, { five: FIVE });
  }
});

test('(a) the names’ Dominant reads on the paper and the cards, and is worn ONLY over the paper it was measured on', () => {
  for (const reception of [FIVE, ['#C9A86A', '#F2E6D8', '#5B1A22', '#FFFFFF', '#8E7DBE'], ['#F4E1C1', '#2B2B2B', '#B04A5A', '#121212', '#D4AF37']]) {
    const v = buildSitePaletteVars({ reception })!;
    const hex = (ch: string) => `#${ch.split(' ').map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
    const names = hex(v['--hub-names-ink']!);
    assert.equal(names, v['--hub-heading'], 'the names’ colour is not the Dominant the page measured');
    for (const ground of ['--color-cream', '--color-paper-deep']) {
      assert.ok(contrastRatio(names, hex(v[ground]!)) >= 3 - 1e-9, `${reception.join(',')}: the names read ${contrastRatio(names, hex(v[ground]!)).toFixed(2)}:1 on ${ground}`);
    }
  }
  // A page colour of their own, a blend, Candlelight: the paper moved — the names keep the measured ink.
  for (const over of [{ site_bg_color: '#1e2229' }, { site_bg_color: 'ombre:diagonal:#f6f1e7' }, { site_art_direction: 'candlelight' }]) {
    const scope = lookSampleScope({ ...ROW, ...over } as never, 'house');
    assert.equal(scope.vars?.['--hub-names-ink'], undefined, `${JSON.stringify(over)}: the names keep a Dominant measured on another paper`);
  }
  assert.ok(lookSampleScope(ROW as never, 'house').vars?.['--hub-names-ink'], 'anti-vacuity: the plain board does not carry the names’ colour');
  // The guest page says the same, word for word (its own copy of the rule — `guestLookFrom`).
  const block = /if \(vars && '--hub-names-ink' in vars && \(background \|\| event\.site_art_direction === 'candlelight'\)\) \{/;
  assert.match(read('app/[slug]/_lib/loaders.ts'), block, 'the guest page keeps the Dominant over a paper it was not measured on');
  assert.match(read('lib/look-sample.ts'), block);
  // A picture, a scene's own ground, the canvas preview of a picture, Candlelight: taken off.
  assert.match(read(`${G}/main-ground.tsx`), /`\[data-guest-look\]\{\$\{declarations\}--hub-names-ink:initial !important;\}`/, 'a picture ground leaves the names in the Dominant');
  assert.equal(sceneLegibilityVars(INVITE_THEMES.house, '#101418', 'color')['--hub-names-ink'], 'initial', 'a scene’s own ground leaves the names in the page’s Dominant');
  assert.match(read(`${G}/main-ground-preview.ts`), /const names = l\.still \? '--hub-names-ink:initial !important;' : '';/);
  assert.match(read('app/globals.css'), /\[data-guest-look\]\[data-art='candlelight'\] \{\s*--hub-names-ink: initial !important;\s*\}/);
  assert.match(read(`${L}/look-sample.tsx`), /\.\.\.\(picture \? \{ \.\.\.ground\.vars, '--hub-names-ink': 'initial' \} : \{\}\)/, 'the sample keeps the Dominant over a picture');
});

test('(b) each type row shows the colour that type is drawn in — read off the sample, never guessed', async () => {
  assert.equal(cssColourHex('rgb(91, 26, 34)'), '#5b1a22');
  assert.equal(cssColourHex('rgba(28, 110, 140, 0.9)'), '#1c6e8c');
  assert.equal(cssColourHex('#ABCDEF'), '#abcdef');
  assert.equal(cssColourHex('transparent'), null);
  const sample = read(`${L}/look-sample.tsx`);
  assert.match(sample, /useLayoutEffect\(\(\) => \{[\s\S]{0,900}tellLookSampleInks\(seed\.eventId, \{ names, heading, body, highlight \}\);\s*\}\);/, 'the sample no longer says what colour each type wears');
  assert.match(sample, /ref=\{box\}\s*data-look-sample=""/);
  const rows = read(`${E}/fonts-look-rows.tsx`);
  assert.match(rows, /const inks = useSyncExternalStore\(subscribeLookSampleInks, \(\) => readLookSampleInks\(eventId\), \(\) => null\);/);
  assert.match(rows, /<BgRow key=\{row\} label=\{FONT_ROW_LABEL\[row\]\} data=\{`font-\$\{row\}`\} mark=\{<TypeColour row=\{row\} inks=\{inks\} \/>\}>/, 'a type row does not show its colour');
  assert.match(read(`${E}/background-cards.tsx`), /\{mark\}/, 'BgRow drops the mark');
  const { TypeColour } = await import(`../${E}/fonts-look-rows`);
  const inks = { names: '#5b1a22', heading: '#1e2229', body: '#1e2229', highlight: '#7b6741' };
  for (const row of ['names', 'heading', 'body', 'highlight'] as const) {
    const html = renderToStaticMarkup(React.createElement(TypeColour, { row, inks }));
    assert.match(html, new RegExp(`data-font-row-colour="${row}"[^>]*style="background-color:${inks[row]}"`), `${row}: its swatch is not its colour`);
  }
  assert.equal(renderToStaticMarkup(React.createElement(TypeColour, { row: 'names', inks: null })), '', 'a swatch is drawn before the sample has said the colour');
});

test('(c) every face in the dropdown carries a line of the event’s words IN that face — and still loads only when seen', () => {
  const opts = hubFontPickOptions({ lead: 'Event Hub font', sample: 'Maria & Jose' });
  const faces = opts.filter((o) => o.key !== HUB_FONT_LEAD);
  assert.ok(faces.length > 30, 'anti-vacuity: the catalogue is not offered');
  for (const o of faces) {
    assert.equal(o.hint, 'Maria & Jose', `${o.key}: no preview line`);
    assert.ok(o.fontFamily && /^var\(--font-/.test(o.fontFamily), `${o.key}: not drawn in its own face`);
    assert.match(fontRowClass(o.fontFamily) ?? '', /\[content-visibility:auto\]/, `${o.key}: its face downloads before its row is seen`);
  }
  assert.equal(hubFontPickOptions({}).some((o) => 'hint' in o), false, 'a dropdown with no sample grew a line');
  // The line is drawn IN the face — the hint wears the option's face, as its name does.
  const menu = read(`${E}/pick-menu.tsx`);
  assert.match(menu, /const face = o\.fontFamily \? \{ fontFamily: o\.fontFamily \} : undefined;/);
  assert.match(menu, /<span className="block text-\[12px\] font-medium leading-snug opacity-75" style=\{face\}>\{o\.hint\}<\/span>/, 'the preview line is not set in its face');
  // Every font row passes its own line; the pairings are drawn in their face.
  const rows = read(`${E}/fonts-look-rows.tsx`);
  assert.match(rows, /sample=\{sampleOf\(row\)\}/);
  assert.match(rows, /\.\.\.pairings\.map\(\(p\) => \(\{ key: p\.id, label: p\.name, hint: p\.faces, \.\.\.\(p\.face \? \{ fontFamily: p\.face \} : \{\}\) \}\)\)/);
  assert.match(read(`${E}/font-pick.tsx`), /hubFontPickOptions\(\{ recent, inUse: maker\?\.lookPages\?\.fontsInUse \?\? \[\], lead, sample \}\)/);
});
