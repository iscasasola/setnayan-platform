/**
 * studio-is-gone-from-the-maker-bar.test.ts — 🧭 STUDIO IS GONE: ONE STAGE PILL, PRINTS IN ⚙, AN EDITOR IS FULL SCREEN.
 *
 * Build 6 Lane F. Owner, 2026-11-10, verbatim: *"Studio technically is gone since the pages there will be inside the
 * different scenes it covers."* Picks settled the same day (DECISION_LOG "ALL YES — BUILD 5 OPEN CALLS SETTLED", Lane F):
 * *"Prints = a row in ⚙ › Your Event Hub, and Studio is removed"*. Approved prototypes: `maker_scenes_tap_to_edit_2026-11-09`
 * frame 8 (pick B) and `event_hub_stages_scenes_2026-11-10` M1 · H4. And 2026-11-09: *"full screen always loses the bottom
 * nav"*.
 *
 *   (1) THE BAR'S SELECTOR IS THE STAGE PILL ALONE — `MakerStageSwitch`, one pill, no Studio half, no "Studio pages"
 *       sheet, no Studio home. Painted: one button on a stage and one inside an editor.
 *   (2) PRINTS IS A ROW IN ⚙ › YOUR EVENT HUB — a link to the shipped Prints page (`printsPageHref`), in Home's Prints
 *       line's own words, never a second carousel; not on the Prints page itself.
 *   (3) AN EDITOR A SCENE OPENED IS FULL SCREEN ON A PHONE — the app's bars step away with the shipped `useChromeAway`,
 *       mounted lazily only while that editor covers the page, never on the Prints page.
 *   (4) NOTHING IS ORPHANED — every Studio page still has a door: Logo · Palette + Dress Code · Love Story · Schedule ·
 *       E-Gifts · Info from their scenes' Edit (`MAKER_EDITOR_DOOR_WORDS`), Look from the ⚙, Prints from the ⚙ and Home.
 *
 * Sabotage (2026-11-10, each seen red, then restored): the Prints row's `href` pointed at `/launch` → (2) · `prints:` handed
 * on the Prints page too → (2) · `<EditorChromeAway />` mounted without `!printsPage` → (3) · `EditorChromeAway` imported
 * straight from `stages-studio-parts` in the shell → (3) · a second `<StudioHalf` in the pill → (1).
 *
 * Run: cd apps/web && node --import tsx --test lib/studio-is-gone-from-the-maker-bar.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import { printsPageHref, PRINTS_HOME_LINE, PRINTS_PAGE_LABEL } from './prints-page-href';
import { STUDIO_TILE_KEYS, STUDIO_TILES } from './studio-tiles';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const SHELL = read(`${L}/maker-shell.tsx`);
const PARTS = read(`${L}/stages-studio-parts.tsx`);
const HUB = read(`${L}/hub-settings.tsx`);
const LAZY = read(`${L}/details-lazy.tsx`);

async function paint(el: React.ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(el);
}

test('(1) the bar’s selector is the stage pill alone — no Studio half, no Studio pages sheet, no Studio home', async () => {
  const { MakerStageSwitch } = await import(`../${L}/stages-studio-parts`);
  const tile = { key: 'logo', label: STUDIO_TILES.logo.label, short: STUDIO_TILES.logo.short, item: STUDIO_TILES.logo.item, immersive: false, done: true, status: '' };
  for (const props of [
    { side: 'stages', stage: 'rsvp', live: true, page: null },
    { side: 'studio', stage: 'rsvp', page: tile },
  ]) {
    const html = await paint(React.createElement(MakerStageSwitch as React.FC<Record<string, unknown>>, { onPick: () => {}, options: [], onStage: () => {}, ...props }));
    assert.equal((html.match(/<button/g) ?? []).length, 1, `${props.side}: the bar draws more than the one pill`);
    assert.doesNotMatch(html, /Studio/, `${props.side}: the pill says “Studio”`);
  }
  assert.equal((PARTS.match(/<StudioHalf\b/g) ?? []).length, 1, 'the pill is two halves again');
  assert.doesNotMatch(PARTS, /label="Studio pages"|Stages or Studio"/, 'the Studio pages sheet (or the two-halves track) is back');
  assert.doesNotMatch(SHELL, /<StudioCover\b|studioHomeOn|StudioSideSwitch/, 'the Studio home or the two-halves switch is drawn again');
  assert.match(LAZY, /export const MakerStageSwitch = dynamic\(\(\) => import\(\s*'\.\/stages-studio-parts'\)/, 'the pill is not lazy');
});

test('(2) Prints is a row in ⚙ › Your Event Hub — the shipped Prints page, in Home’s Prints words; not on the Prints page', () => {
  const group = HUB.slice(HUB.indexOf('data-hub-settings-group="your-event-hub"'), HUB.indexOf('data-hub-settings-group="guests-see"'));
  assert.ok(group.length > 300, 'anti-vacuity: Your Event Hub was not found');
  assert.match(
    group,
    /\{doors\.prints \? \(\s*<FormRows data="hub-prints">\s*<FormRow data="prints" name=\{PRINTS_PAGE_LABEL\} line=\{PRINTS_HOME_LINE\} attrs=\{\{ 'data-hub-settings-row': 'prints' \}\}>\s*<ActionButton tone="neutral" iconOnly icon=\{Printer\} label=\{`Open \$\{PRINTS_PAGE_LABEL\}`\} href=\{doors\.prints\} onClick=\{\(\) => onOpenChange\(false\)\} \/>/,
    'the Prints row is not one link to the Prints page under Your Event Hub',
  );
  assert.equal((HUB.match(/data-hub-settings-row': 'prints'/g) ?? []).length, 1, 'two Prints rows');
  assert.doesNotMatch(HUB, /PrintsCarousel|studio-prints-carousel|StudioPrints/, 'a second copy of the Prints workspace is drawn in the ⚙');
  // The shell hands the page's own address — and none on the Prints page, which is where it goes.
  assert.match(SHELL, /prints: printsPage \? null : printsPageHref\(eventId\),/);
  assert.equal(printsPageHref('S89E-ABC'), '/dashboard/S89E-ABC/prints');
  assert.equal(PRINTS_PAGE_LABEL, 'Prints');
  assert.ok(PRINTS_HOME_LINE.length > 0);
});

test('(3) an editor a scene opened is full screen on a phone — the app’s bars step away, lazily, never on the Prints page', () => {
  assert.match(PARTS, /export function EditorChromeAway\(\) \{\s*useChromeAway\(true\);\s*return null;\s*\}/, 'the editor does not step the bars away with the shipped hook');
  assert.match(PARTS, /import \{ useChromeAway \} from '@\/app\/_components\/nav\/use-chrome-away';/);
  assert.match(LAZY, /export const EditorChromeAway = dynamic\(\(\) => import\(\s*'\.\/stages-studio-parts'\)\.then\(\(m\) => m\.EditorChromeAway\), \{ loading: \(\) => null \}\);/, 'the bars-away piece rides the Maker’s first load');
  assert.match(SHELL, /\{studioFull && phone && !printsPage \? <EditorChromeAway \/> : null\}/, 'the bars step away somewhere other than a full-screen editor on a phone');
  assert.equal((SHELL.match(/<EditorChromeAway\b/g) ?? []).length, 1);
  // The shell's import is the lazy stand-in, never the module itself (first-load budget: `scripts/check-maker-js-budget.mjs`).
  assert.doesNotMatch(SHELL, /from '\.\/stages-studio-parts'/, 'the shell imports the lazy chunk straight');
  assert.doesNotMatch(SHELL, /use-chrome-away/, 'the shell carries the hook in the Maker’s first load');
  // The shell's measured room follows the bars as they slide (`useTheAppsRoom` reads them on `transitionend`).
  assert.match(SHELL, /document\.addEventListener\('transitionend', slid, true\);/);
});

test('(4) nothing is orphaned: every Studio page keeps a door — its scene’s Edit, the ⚙, or Home', async () => {
  const { MAKER_EDITOR_DOOR_WORDS, MAKER_PARTS, makerPartQuietRow } = await import('./maker-parts');
  const doorOf = new Map<string, string>();
  for (const k of Object.keys(MAKER_PARTS) as Array<keyof typeof MAKER_PARTS>) {
    const q = makerPartQuietRow(k);
    if (q && 'studio' in q.to) doorOf.set(q.to.studio, q.words);
  }
  for (const key of STUDIO_TILE_KEYS) {
    if (key === 'look') {
      assert.match(SHELL, /look: openLook,/, 'Look has no door in the ⚙');
      continue;
    }
    assert.equal(doorOf.get(key), MAKER_EDITOR_DOOR_WORDS[key as keyof typeof MAKER_EDITOR_DOOR_WORDS], `${key}: no scene’s Edit opens it`);
  }
  // E-Gifts is ALSO the ⚙'s row (a second door to the one editor, never a copy).
  assert.match(SHELL, /gifts: giftsTile \? \{ line: giftsTile\.status, open: \(\) => openStudio\('gifts'\) \} : null,/);
});
