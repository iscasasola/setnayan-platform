/**
 * no-door-leads-to-the-removed-studio.test.ts — 🧭 STUDIO IS GONE, AND EVERY OLD DOOR LANDS ON THE NEW PLACE.
 *
 * Owner, 2026-11-10 (DECISION_LOG "EVENT HUB = PURELY STAGES, BUILT FOR SPEED"; Build 6 Lane F; prototype
 * `prototypes/event_hub_stages_scenes_2026-11-10/`), verbatim: *"Studio technically is gone since the pages there will be
 * inside the different scenes it covers."* On 11 Nov he asked why he still saw it. So:
 *
 *   (1) THE BAR — one stage pill (● Invitation ▾). No Studio half, no list of Studio pages, no "n of N ready"; while a
 *       scene's editor is risen the same place reads ✕ · its name. Nothing it paints says "Studio".
 *   (2) NO STUDIO HOME — the shell draws no home of cards and has no way to open one; the component is deleted.
 *   (3) EVERY OLD DOOR LANDS — a link that names a page's item (`?tool=details&item=…`, which `detailsItemHref` writes for
 *       notifications, Home's cards and `/studio/mood-board`) opens that page's editor; any other lands on the stage.
 *       Never a Studio home, from any input.
 *   (4) THE SCENES ARE THE DOORS — a tap on the ring opens the Logo Maker, Dress code opens Palette + Dress Code, Love Story
 *       its chapters (and Schedule, E-Gifts); each part's own door says "Open <page>", never "Studio".
 *   (5) PRINTS IS A ROW OF THE ⚙ — it opens the shipped Prints page.
 *   (6) CARRIED FROM THE RETIRED `studio-pages-have-no-title-row.test.ts`: nothing is drawn over an editor's page (no title
 *       row, no ✓ Done band, no offset), and ↺ · ✓ stay in the bar after the pill.
 *
 * Mutations seen RED before this landed (2026-11-11), each restored: "Studio" written into the pill's label → (1);
 * `makerDoorLanding`'s last line back to `{ side: 'studio', at: 'home' }` → (3); `makerSceneDoorWords` back to
 * "Open in Studio › …" → (4); the rise removed from the page tap → (4); the ⚙'s Prints row dropped from the shell's
 * doors → (5).
 *
 * Run: cd apps/web && node --import tsx --test lib/no-door-leads-to-the-removed-studio.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from './strip-comments';
import { makerDoorLanding } from './maker-resume';
import { STUDIO_TILE_ITEM, STUDIO_TILE_KEYS, studioTileOfItem } from './studio-tile-defs';
import { MAKER_PARTS, makerPartQuietRow, makerPartRisesEditor, makerSceneDoorWords, type MakerPartKey } from './maker-parts';
import { detailsItemHref } from './maker-details-items';

/* tsx compiles the components to the classic runtime: React must be global before they are imported (as in
   `studio-screens-follow-the-prototype.test.ts`). */
(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const read = (f: string) => readFileSync(join(WEB, f), 'utf8');
const SHELL = stripComments(read(`${L}/maker-shell.tsx`));
const PARTS = `${L}/stages-studio-parts.tsx`;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) walk(abs, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(relative(WEB, abs));
  }
  return out;
}

test('(1) the bar is one stage pill — no Studio half, no Studio pages, nothing it paints says "Studio"', async () => {
  const { StageSwitch } = (await import(`../${PARTS}`)) as typeof import('../app/dashboard/[eventId]/launch/_components/stages-studio-parts');
  const parts = (await import(`../${PARTS}`)) as Record<string, unknown>;
  for (const gone of ['StudioSideSwitch', 'StudioCover', 'StudioToolMenu', 'studioChooserOptions', 'STUDIO_MENU_SETTINGS_LINE', 'StudioBackToPart']) {
    assert.equal(parts[gone], undefined, `${gone} is exported again`);
  }
  for (const stage of ['save_the_date', 'rsvp', 'event', 'editorial']) {
    const html = renderToStaticMarkup(React.createElement(StageSwitch, { side: 'stages', stage, options: [], onStage: () => {} }));
    assert.equal((html.match(/data-stage-pill=""/g) ?? []).length, 1, `${stage}: not ONE stage pill`);
    assert.match(html, /aria-label="Stage: [^"]+ — choose a stage"/, `${stage}: the pill does not say what a tap does`);
    assert.doesNotMatch(html, /Studio|data-studio-half|ready</, `${stage}: the bar still offers Studio`);
  }
  const head = renderToStaticMarkup(
    React.createElement(StageSwitch, { side: 'studio', stage: 'rsvp', editor: { key: 'mood', label: 'Dress code', full: true }, onClose: () => {} }),
  );
  assert.match(head, /aria-label="Close Dress code"[^>]*data-stage-editor-close=""/, 'a risen editor has no ✕ that names it');
  assert.match(head, /data-stage-editor-title=""[^>]*>Dress code<\/h1>/);
  assert.doesNotMatch(head, /Studio|data-stage-pill=""/, 'a risen editor’s bar says Studio, or keeps the pill');
  // The pill is drawn first in the bar, by the shell, on every width (the Prints page names itself instead).
  assert.equal((SHELL.match(/<StageSwitch\b/g) ?? []).length, 1);
  assert.doesNotMatch(SHELL, /StudioSideSwitch|onPick=\{pickSide\}/, 'the shell still hands the pill a side to pick');
});

test('(2) there is no Studio home — no component, no cover, no way for the shell to open one', () => {
  assert.equal(existsSync(join(WEB, `${L}/studio-home.tsx`)), false, 'the Studio home is back');
  const files = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))];
  assert.ok(files.length > 1000, `anti-vacuity: only ${files.length} files read`);
  const importers = files.filter((f) => /from ['"][^'"]*\/studio-home['"]/.test(read(f)));
  assert.deepEqual(importers, [], 'something imports the Studio home');
  assert.doesNotMatch(SHELL, /StudioCover|StudioHome|studioHomeOn|studioMenu\b/, 'the shell can draw a Studio home');
  assert.doesNotMatch(SHELL, /setStudioAt\('home'\)/, 'the shell can still go to a Studio home');
  assert.doesNotMatch(SHELL, /next === 'studio'/, 'pickSide still has a Studio side of its own');
});

test('(3) every old door lands on the new place — the editor its item names, or the stage; never a Studio home', () => {
  const tiles = [...STUDIO_TILE_KEYS];
  const backs = [null, { side: 'stages', at: 'home' }, { side: 'studio', at: 'home' }, { side: 'studio', at: 'prints' }, ...tiles.map((t) => ({ side: 'studio', at: t }))] as const;
  const opens = [null, 'prints', '__proto__', ...tiles];
  let cases = 0;
  for (const back of backs) {
    for (const opened of opens) {
      const land = makerDoorLanding(back as never, tiles, opened);
      cases += 1;
      assert.ok(!(land.side === 'studio' && land.at === 'home'), `a door lands on a Studio home: ${JSON.stringify({ back, opened })}`);
      if (land.side === 'studio') assert.ok(tiles.includes(land.at as never), `a door lands on an editor this event has not: ${land.at}`);
    }
  }
  assert.ok(cases > 50, 'anti-vacuity');
  // Each page's own old address — the link `detailsItemHref` writes — names an item that maps back to that page.
  for (const k of STUDIO_TILE_KEYS) {
    const item = STUDIO_TILE_ITEM[k];
    assert.equal(studioTileOfItem(item), k, `${k}: its old link (${item}) lands on another page`);
    assert.equal(makerDoorLanding(null, tiles, studioTileOfItem(item)).at, k, `${k}: a cold link does not open its editor`);
    assert.match(detailsItemHref('E', item), new RegExp(`\\?tool=details&item=${item}$`));
  }
  // `/studio/mood-board` forwards to that link, so it lands on Palette + Dress Code.
  assert.match(read('app/dashboard/[eventId]/studio/mood-board/page.tsx'), /redirect\(detailsItemHref\(eventId, 'mood-board'\)\)/);
  assert.equal(studioTileOfItem('mood-board'), 'mood');
  // The shell lands through the one rule, with the address's item on a cold door.
  assert.match(SHELL, /const land = makerDoorLanding\(back, studio\?\.tiles\.map\(\(t\) => t\.key\) \?\? \[\], back \? null : studioTileOfItem\(detailsItem\)\);/);
});

test('(4) the scenes are the doors — the ring, Dress code and Love Story rise their editors; no door says Studio', () => {
  assert.equal(makerPartRisesEditor('logo'), 'logo', 'the ring does not open the Logo Maker');
  assert.equal(makerPartRisesEditor('dress'), 'mood', 'Dress code does not open Palette + Dress Code');
  assert.equal(makerPartRisesEditor('story'), 'story', 'Love Story does not open its chapters');
  assert.equal(makerPartRisesEditor('schedule'), 'schedule');
  assert.equal(makerPartRisesEditor('gifts'), 'gifts');
  // The rest of the cover is selected (its own tools) — never risen.
  for (const k of ['coverscene', 'ename', 'names', 'date', 'place'] as MakerPartKey[]) assert.equal(makerPartRisesEditor(k), null, `${k} rises an editor`);
  let doors = 0;
  for (const k of Object.keys(MAKER_PARTS) as MakerPartKey[]) {
    const q = makerPartQuietRow(k);
    if (!q) continue;
    doors += 1;
    assert.doesNotMatch(q.words, /Studio/, `${k}: its door still says Studio — “${q.words}”`);
  }
  assert.ok(doors > 10, 'anti-vacuity: no doors read');
  assert.equal(makerSceneDoorWords('Logo'), 'Open Logo');
  // The canvas tap rises the editor (not only the door row): wired in the page-tap branch, before any other tool is asked.
  const tools = stripComments(read(`${L}/stage-tools.tsx`));
  const tap = tools.slice(tools.indexOf("if (d.t === 'edit' && typeof d.key === 'string') {"), tools.indexOf("} else if (d.t === 'type' && d.phase === 'start') {"));
  assert.ok(tap.length > 500, 'anti-vacuity: the page tap was not found');
  assert.match(tap, /const rises = rsvpOpenRef\.current \? null : makerPartRisesEditor\(k\);\s*if \(rises\) \{\s*setSlotAsk\(null\);\s*riseRef\.current\(k, rises\);\s*return;\s*\}/);
  assert.ok(tap.indexOf('riseRef.current(k, rises)') < tap.indexOf('askTool(toolFor(k), k)'), 'the tool is asked before the editor rises');
});

test('(5) Prints is a row of the Hub’s ⚙ — it opens the shipped Prints page', () => {
  const hub = stripComments(read(`${L}/hub-settings.tsx`));
  assert.match(hub, /\{doors\.prints \? \(\s*<FormRows data="hub-prints">\s*<FormRow data="prints" name=\{PRINTS_PAGE_LABEL\} line=\{HUB_SETTINGS_PRINTS_LINE\}/);
  assert.match(hub, /<ActionButton tone="neutral" iconOnly icon=\{Printer\} label=\{`Open \$\{PRINTS_PAGE_LABEL\}`\} href=\{doors\.prints\.href\} \/>/);
  // Under Your Event Hub (the prototype's frame H4), before What guests see.
  assert.ok(hub.indexOf('data="hub-prints"') > hub.indexOf('data-hub-settings-group="your-event-hub"'));
  assert.ok(hub.indexOf('data="hub-prints"') < hub.indexOf('data-hub-settings-group="guests-see"'));
  assert.match(SHELL, /prints: \{ href: printsPageHref\(eventId\) \},/, 'the ⚙ is not handed the Prints page');
});

test('(6) nothing is drawn over an editor’s page, and ↺ · ✓ stay after the pill', () => {
  assert.doesNotMatch(SHELL, /StudioToolRow|StudioDoneBar|studioImmersive|top-\[52px\]/, 'a row or a Done band is drawn over a page again');
  assert.match(SHELL, /<div className="absolute inset-0 z-30 flex bg-cream" data-maker-details-layer="">/, 'the page layer is pushed down');
  const top = SHELL.slice(SHELL.indexOf('data-maker-toolbar=""'), SHELL.indexOf('</header>'));
  assert.ok(top.indexOf('{applySlot}') > top.indexOf('<StageSwitch'), 'anti-vacuity: the draft controls were not found after the pill');
});
