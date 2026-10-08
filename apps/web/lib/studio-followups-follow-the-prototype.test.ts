/**
 * 🗂 STUDIO FOLLOW-UPS FOLLOW THE PROTOTYPE (owner 2026-10-07, verbatim *"1. okay 2. bands? full
 * width … 4. move it elsewhere. yes parents is automatically part of the wedding march, hosts are
 * just access so this can live under the guestlist since there is a access column already."* →
 * *"yes"* on the Event name row; DECISION_LOG "STUDIO REDRAW ANSWERS" and "'EVENT NAME · MARIA &
 * JOSE' IS ONE ROW…"). Prototype `maker_two_dropdowns_owner_wireframe_2026-10-06_fable.html`.
 *
 *   1 · Studio › Schedule is the timeline — one band per moment: START pill – END pill · name · ⋯
 *       (the owner's Timeline row, 2026-10-08; `studio-schedule-wears-the-timeline-row.test.ts`
 *       holds the row's rules; the place and For ▾ — 4c's stored audience — are behind ⋯) — and
 *       + Add a moment; drawn by `ScheduleDay` only in the new Maker's Studio, through the rail's
 *       own writes; it fills the screen.
 *   2 · Studio › Love Story is one band per chapter (the owner's Timeline row, 2026-10-08: when ·
 *       name · picture square · ⋯; `studio-love-story-wears-the-timeline-row.test.ts` holds its
 *       rules) — and an edit made there keeps EVERY field the moment holds (a year changed never
 *       drops its place, photos, title, anchor, hidden or order).
 *   3 · Studio › Info's "Event name · Maria & Jose" is composed as the hero composes it, with its ⓘ; a
 *       one-person event keeps its own. (Since the 2026-10-08 Info redesign the two people it opens are
 *       Form rows, each name a pill — `lib/studio-info-wears-the-form-row.test.ts` holds those.)
 *   4 · Studio › Wedding March has no "Parents & hosts" block (parents walk in the march; hosts are
 *       access) and its tray shrinks to the Not-walking strip — the shipped Maker keeps the block.
 *
 * `globalThis.React` before the dynamic imports: tsx compiles JSX to the classic runtime here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { STUDIO_MARCH_TRAY_PX, STUDIO_PAGE_ITEMS, studioFullScreenCss } from './studio-details';
import { applyMomentIntent } from './love-story-moment-intent';
import { sortMoments, type LoveStoryMoment } from './love-story-moments';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const SCHED = 'app/dashboard/[eventId]/schedule/_components';
const STORY = 'app/dashboard/[eventId]/website/our-story/_components';
const L = 'app/dashboard/[eventId]/launch/_components';

async function html(el: React.ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(el);
}

const DAY = '2026-12-12';
const moment = (id: string, label: string, hhmm: string, place: string | null, audience: string | null = null) => ({
  block_id: id,
  label,
  block_type: 'custom' as const,
  start_at: `${DAY}T${hhmm}:00.000Z`,
  end_at: null,
  location: place,
  notes: null,
  is_public: true,
  parent_block_id: null,
  run_state: 'upcoming' as const,
  staged: false,
  responsible_party: null,
  responsible_vendor_ids: [],
  audience,
});

test('1 · Studio › Schedule: one band per moment — start – end · name · ⋯ — and + Add a moment', async () => {
  const { StudioDay } = await import(`../${SCHED}/studio-day`);
  const { DayActionsContext } = await import(`../${SCHED}/day-ui`);
  const writes: string[] = [];
  const actions = new Proxy({}, { get: (_t, k) => async () => void writes.push(String(k)) });
  const out = await html(
    React.createElement(
      DayActionsContext.Provider,
      { value: actions as never },
      React.createElement(StudioDay, {
        eventId: 'ev-1',
        dateKey: DAY,
        /* Out of order on purpose: the timeline is the day's order. */
        moments: [moment('b', 'Ceremony', '15:00', null), moment('a', 'Entourage photos', '14:00', 'Santuario de San Antonio', 'entourage'), moment('c', 'Cocktails', '17:30', 'Garden')],
        canEdit: true,
        onPatch: () => {},
        onAdd: () => {},
        onMore: () => {},
        notice: null,
      }),
    ),
  );
  const rows = [...out.matchAll(/data-studio-moment="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(rows, ['a', 'b', 'c'], 'the moments are not laid out in the day’s order');
  assert.match(out, /Saturday 12 December 2026/, 'the day’s band does not name the day');
  assert.match(out, /2:00 PM[\s\S]*3:00 PM[\s\S]*5:30 PM/, 'a moment has no time pill');
  assert.match(out, /data-timeline-name=""[^>]*><span[^>]*>Entourage photos</, 'the moment’s name is not on the row');
  /* Who it is for is still carried by the row (4c's stored audience); the control is behind ⋯. */
  assert.match(out, /data-studio-moment-for="entourage"/, 'the row lost 4c’s stored audience');
  assert.equal((out.match(/data-studio-moment-for="everyone"/g) ?? []).length, 2);
  assert.match(out, /data-studio-add-moment=""[^>]*>[\s\S]*?Add a moment/, 'no + Add a moment');
  /* 🧱 Bands, not boxes: a row is a full-width band with a hairline, never a rounded card. */
  const row = /<li[^>]*data-studio-moment="a"[^>]*>/.exec(out)?.[0] ?? '';
  assert.match(row, /class="[^"]*border-t border-ink\/10 bg-cream/, 'a moment is not on a band with a hairline');
  assert.doesNotMatch(row, /class="[^"]*rounded/, 'a moment is drawn as a rounded box (owner: “bands? full width”)');
  assert.deepEqual(writes, [], 'drawing the day wrote something');

  /* Wired: drawn by ScheduleDay in the new Maker's Studio only, through the rail's own writes. */
  const rail = read(`${SCHED}/day-rail.tsx`);
  assert.match(rail, /const studio = useMaker\(\)\?\.stagesStudio === true && live;/, 'the timeline is not keyed to the new Maker’s Studio');
  assert.match(rail, /if \(studio\) \{\s*return \(\s*<DayActionsContext\.Provider value=\{dayActions\}>\s*<StudioDay/, 'ScheduleDay does not draw the Studio timeline');
  assert.match(rail, /onPatch=\{\(id, patch, send\) => \{\s*override\(id, patch\);\s*write\(\[id\], send\);/, 'the timeline’s edits skip the rail’s own refusal handling');
  const day = read(`${SCHED}/studio-day.tsx`);
  assert.deepEqual(day.match(/const \{[^}]*\} = useDayActions\(\);/g), ['const { updateScheduleBlock } = useDayActions();'], 'the timeline writes through something other than the rail’s updateScheduleBlock');
  assert.doesNotMatch(day, /from '\.\.\/actions'|'use server'/, 'the timeline reaches a server action of its own');
  assert.ok(STUDIO_PAGE_ITEMS.includes('schedule'), 'Studio › Schedule does not fill the screen');
});

const held: LoveStoryMoment = {
  id: 'm1',
  date: { y: 2022, m: 6, d: 4 },
  title: 'Siargao',
  line: 'He asked. She said yes before he finished the question.',
  place: 'Cloud 9, Siargao',
  media: ['r2://setnayan-media/events/e1/love/a.jpg', 'r2://setnayan-media/events/e1/love/b.jpg'],
  added_by: 'Maria',
  anchor: 'yes',
  hidden: true,
  order: 1,
  canvas: {},
};

test('2 · Studio › Love Story: an edit made in place keeps every field the moment holds', async () => {
  const { momentEditForm } = await import(`../${STORY}/moment-order-cards`);
  const other: LoveStoryMoment = { id: 'm0', date: { y: 2019 }, line: 'One umbrella.', order: 0, canvas: {} };
  const r = applyMomentIntent([other, held], 'edit', momentEditForm(held, { y: '2023' }));
  assert.ok(r.ok, 'the in-place edit was refused');
  const after = r.ok ? r.after.find((m) => m.id === 'm1')! : null;
  assert.deepEqual(after, { ...held, date: { y: 2023, m: 6, d: 4 } }, 'changing the year dropped or changed another field');
  const t = applyMomentIntent([other, held], 'edit', momentEditForm(held, { title: 'The yes' }));
  assert.ok(t.ok && t.after.find((m) => m.id === 'm1')!.title === 'The yes');
  assert.deepEqual(t.ok ? t.after.find((m) => m.id === 'm1')!.media : null, held.media, 'a title edit dropped the photos');
});

test('2b · Studio › Love Story is the rows — one band per chapter, opened in place — not the scrapbook', async () => {
  const { LoveStoryBook } = await import(`../${STORY}/love-story-book`);
  const story: LoveStoryMoment[] = [
    { id: 'u', date: { y: 2019 }, title: 'One umbrella', line: 'A rainy Tuesday in Katipunan.', order: 0, canvas: {} },
    { id: 's', date: { y: 2022 }, title: 'Siargao', line: 'He asked.', order: 1, canvas: {} },
    { id: 'd', date: { y: 2026 }, title: 'The day', line: 'And now, with you.', order: 2, canvas: {} },
  ];
  const props = {
    eventId: 'ev-1',
    names: 'Maria & Jose',
    partners: ['Maria', 'Jose'],
    eyebrow: 'December 12, 2026',
    moments: story,
    since: 2019,
    daysToTheDay: 60,
    themeName: 'Classic',
    motionLabel: 'Gentle',
    makerHref: '/x',
    guestHref: null,
    ownsPro: false,
    storeShell: false,
    proHref: '/p',
    proPrice: null,
    refused: null,
    sectionHidden: false,
    mediaUrls: {},
    action: async () => {},
    pickSlot: null,
    inMaker: true,
  };
  /* The book draws the cards through a lazy stand-in (the Maker's first-load budget); the cards themselves: */
  const book = await html(React.createElement(LoveStoryBook, { ...props, studio: true }));
  assert.doesNotMatch(book, /id="love-story-title"|On our <i/, 'Studio still draws the scrapbook around the cards');
  assert.match(read(`${STORY}/love-story-book.tsx`), /import \{ MomentOrderCards \} from '\.\/moment-order-cards-lazy';/, 'the cards are back in the Maker’s first load');
  const { MomentOrderCards } = await import(`../${STORY}/moment-order-cards`);
  const studio = await html(
    React.createElement(MomentOrderCards, {
      action: props.action,
      moments: sortMoments(story),
      mediaUrls: {},
      sheet: { action: props.action, moments: story, partners: props.partners, ownsPro: false, storeShell: false, proHref: '/p', proPrice: null, eventId: 'ev-1', mediaUrls: {} },
      add: { can: true },
    }),
  );
  assert.equal((studio.match(/data-moment-card="/g) ?? []).length, 3, 'not one row per chapter');
  assert.match(studio, /2019[\s\S]*One umbrella[\s\S]*data-ticker-pill="photos"[\s\S]*data-studio-story-more="u"/, 'a row is not when · name · picture · ⋯');
  assert.ok(sortMoments(story).map((m) => m.id).join() === 'u,s,d');
  assert.doesNotMatch(studio, /id="love-story-title"|On our <i/, 'Studio still draws the scrapbook around the cards');
  assert.match(studio, /Add a moment/, 'no + Add a moment');
  const card = /<li[^>]*data-moment-card="u"[^>]*>/.exec(studio)?.[0] ?? '';
  assert.match(card, /class="[^"]*border-t border-ink\/10 bg-cream/, 'a moment is not on a band with a hairline');
  assert.doesNotMatch(card, /class="[^"]*rounded/, 'a moment is drawn as a rounded box (owner: “bands? full width”)');
  const shipped = await html(React.createElement(LoveStoryBook, props));
  assert.match(shipped, /id="love-story-title"/, 'the shipped scrapbook changed — flag-off must not change');
  assert.doesNotMatch(shipped, /data-moment-order-cards/);
});

test('3 · Studio › Info: "Event name · Maria & Jose" is composed as the hero composes it, with its ⓘ — only for a two-person event', () => {
  const md = read(`${L}/maker-details.tsx`);
  assert.match(
    md,
    /if \(yeIn\?\.names && !yeIn\.oneName && !yeIn\.names\.wholeForm && editors\.names !== undefined\) \{\s*editors\.names = \(\s*<StudioTool\s+part="event-name"/,
    'Studio › Info does not draw the Event name row — or draws it for a one-person event',
  );
  const body = read(`${L}/studio-event-name.tsx`);
  assert.match(body, /const shown = coupleNameColumns\(names\[0\], names\[1\]\)\.display_name \?\? '';/, 'the row does not compose the name as the hero does');
  assert.match(body, /name="Event name"\s+about=\{\{/, 'Event name has no ⓘ saying where it is read');
  assert.match(body, /<OpensRow\s+data="event-name"[\s\S]*?answer=\{shown\}/, 'the Event name is not ONE row that opens the two people in place');
});

test('4 · Studio › Wedding March: no "Parents & hosts" block; the tray is the Not-walking strip — the shipped Maker keeps it', () => {
  const css = studioFullScreenCss();
  assert.match(css, /\[data-maker-studio-full\] \[data-march-parents\]\{display:none\}/, 'Studio’s march still carries the Parents & hosts block');
  assert.ok(css.includes(`[data-maker-studio-full]:has([data-details-workspace][data-details-item="march"]){--maker-lt-h:${STUDIO_MARCH_TRAY_PX}px!important}`), 'the march’s tray does not shrink to the strip');
  assert.ok(STUDIO_MARCH_TRAY_PX <= 132, 'the tray takes the walks’ screen back');
  /* Parents keep their place: the shipped march still draws its parents (hidden in Studio by CSS only). */
  assert.match(read(`${L}/details-your-event-parts.tsx`), /<section data-march-parents=""/, 'the shipped march lost its parents');
});

test('5 · no Studio editor says "Saved" or asks for a Save on a drafted field — ✓ Apply’s count is the one signal', async () => {
  const { StudioToolRow } = await import(`../${L}/stages-studio-parts`);
  const { STUDIO_TILE_KEYS, STUDIO_TILES } = await import('./studio-tiles');
  const tiles = STUDIO_TILE_KEYS.map((key) => ({ key, label: STUDIO_TILES[key].label, short: STUDIO_TILES[key].short, item: STUDIO_TILES[key].item, immersive: STUDIO_TILES[key].immersive === true, done: true, status: '' }));
  for (const tile of tiles) {
    const row = await html(React.createElement(StudioToolRow, { tile, tiles, onOpen: () => {}, onDone: () => {} }));
    assert.doesNotMatch(row, /Saved|Saving/, `the ${tile.label} row still shows a Saved chip`);
  }
  const mood = read('app/dashboard/[eventId]/studio/mood-board/_components/mood-board-studio.tsx');
  const bar = mood.slice(mood.indexOf('const bar = ('), mood.indexOf('return (', mood.indexOf('const bar = (')));
  assert.match(bar, /data-mood-board-auto/, 'the Mood Board lost ✨ Auto');
  assert.doesNotMatch(bar, /Saved|Saving/, 'the Mood Board still shows a Saved chip');
  assert.match(bar, /save === 'error' \?/, 'a FAILED Mood Board save is no longer said');
  /* What to bring is a drafted column: a typed Form row — kept on leaving the field, ONE draft write, no Save button. */
  const info = read(`${L}/studio-info.tsx`);
  assert.doesNotMatch(info, /type="submit"|<TextPanel|>Save<|>Saved</, 'an Info words row still has a Save button or a Saved chip');
  assert.match(info, /what_to_bring: \{[\s\S]*?value: \(text: string\): string \| null => text \|\| null,/, 'What to bring no longer writes the draft');
  assert.match(info, /return studioDraftKeep\(eventId, `events:\$\{fact\}`, \{ \[fact\]: w\.value\(kept\) \}\);/, 'What to bring no longer writes the draft');
  assert.match(info, /return hubDraftAction\(eventId, fd\);/, 'What to bring writes outside the one draft door');
});

test('6 · a Studio tile never leaves the Maker — every tile opens its editor in place', async () => {
  const { STUDIO_TILE_KEYS, STUDIO_TILES } = await import('./studio-tiles');
  const { isDetailsItemKey } = await import('./maker-details-items');
  for (const k of STUDIO_TILE_KEYS) assert.ok(isDetailsItemKey(STUDIO_TILES[k].item), `${k} opens something that is not a Details item`);
  const home = read(`${L}/studio-home.tsx`);
  assert.doesNotMatch(home, /<a\s|<Link\b|href=|router\.|location\./, 'a Studio tile is a link out');
  const shell = read(`${L}/maker-shell.tsx`);
  const open = shell.slice(shell.indexOf('const openStudio = ('), shell.indexOf('};', shell.indexOf('const openStudio = (')));
  assert.ok(open.length > 0);
  assert.doesNotMatch(open, /router\.|location\.|href|window\.open|redirect/, 'opening a Studio tile routes away');
  /* Logo: its editor is the shipped one, drawn INSIDE Details' body — never a page of its own. */
  const look = read(`${L}/details-look-pages.tsx`);
  assert.match(look, /if \(item === 'logo'\) \{\s*return look\.logo \? \(\s*<div[^>]*data-details-look="logo">\s*\{look\.logo\}/, 'the Logo tile no longer draws the logo editor in place');
});

test('7 · each of the 11 tiles opens its OWN editor — Look never opens the Logo it was last on', async () => {
  const { STUDIO_TILE_KEYS, STUDIO_TILES, studioTileItem } = await import('./studio-tiles');
  const want: Record<string, string> = {
    info: 'names', look: 'background', logo: 'logo', mood: 'mood-board', schedule: 'schedule', story: 'love-story',
    march: 'march', seats: 'seating', gifts: 'gifts', rsvp: 'rsvp', prints: STUDIO_TILES.prints.item,
  };
  assert.equal(STUDIO_TILE_KEYS.length, 11);
  /* Whatever was open before — the worst cases are the other Look-group items. */
  /* ('elements' since the 2026-10-08 restudy — Look's sections are Background · Elements · Music; it was 'colours'.) */
  for (const before of [null, 'logo', 'mood-board', 'hero', 'reveal', 'names', 'elements', 'colours']) {
    for (const k of STUDIO_TILE_KEYS) {
      const got = studioTileItem(k, before);
      if (k === 'look' && before === 'elements') assert.equal(got, 'elements', 'Look forgot the section it was on');
      else assert.equal(got, want[k], `${k} (after ${before}) opened ${got}`);
    }
  }
  const shell = read(`${L}/maker-shell.tsx`);
  const open = shell.slice(shell.indexOf('const openStudio = ('), shell.indexOf('/* 🧭 STAGES ALWAYS SHOWS THE PAGE'));
  assert.match(open, /setDetailsItem\(studioTileItem\('look', detailsItem\)\)/, 'the Look tile does not open through the tile→editor map');
  assert.match(open, /openDetailsItem\(studioTileItem\(key, detailsItem\)\)/, 'a tile opens something other than its own editor');
  assert.doesNotMatch(open, /openSection\('look'\)/, 'Look still keeps whatever Look-group item was open (the Logo)');
  /* ⚖ 507 KB: the shell's first load reads `studio-tile-defs` — the eleven keys and the editor each opens,
     never the tiles' words (those are `STUDIO_TILES`, read on the server). One map: the table's `item` is the map's. */
  assert.doesNotMatch(read('lib/studio-tile-defs.ts'), /\b(?:label|short|sub|reads)\s*:/, 'the tiles’ words are back in the module the Maker’s shell loads first');
  assert.match(shell, /import \{ studioTileItem, type StudioTileKey \} from '@\/lib\/studio-tile-defs';/, 'the shell maps a tile through another module');
  assert.doesNotMatch(shell, /import \{[^}]*\} from '@\/lib\/studio-tiles';/, 'the shell imports a VALUE from lib/studio-tiles (types only)');
  for (const k of STUDIO_TILE_KEYS) assert.equal(STUDIO_TILES[k].item, studioTileItem(k, null), `${k}: the table and the map disagree`);
  /* …and the Studio forms' group headings are DRAWN by the server; the workspace (first load) only places them. */
  assert.doesNotMatch(read(`${L}/details-workspace.tsx`), /data-details-form-group=/, 'the workspace draws the form headings itself again (first-load weight)');
  assert.match(read(`${L}/details-workspace.tsx`), /formHeads\[i\.key\] \? <Fragment key="head">\{formHeads\[i\.key\]\}<\/Fragment> : null/, 'the workspace no longer places the server-drawn heading');
  assert.match(read(`${L}/maker-details.tsx`), /<p key=\{key\} data-details-form-group=\{key\} className="flex items-baseline gap-2 pt-2 text-\[10px\] font-semibold uppercase tracking-\[0\.2em\] text-ink\/55">/, 'the server does not draw the form headings as they were drawn');
});
