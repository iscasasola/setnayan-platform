/**
 * 🗂 STUDIO FOLLOW-UPS FOLLOW THE PROTOTYPE (owner 2026-10-07, verbatim *"1. okay 2. bands? full
 * width … 4. move it elsewhere. yes parents is automatically part of the wedding march, hosts are
 * just access so this can live under the guestlist since there is a access column already."* →
 * *"yes"* on the Event name row; DECISION_LOG "STUDIO REDRAW ANSWERS" and "'EVENT NAME · MARIA &
 * JOSE' IS ONE ROW…"). Prototype `maker_two_dropdowns_owner_wireframe_2026-10-06_fable.html`.
 *
 *   1 · Studio › Schedule is the prototype's timeline — one band per moment: time pill · moment ·
 *       place · For ▾ (4c's stored audience) — and + Add a moment; drawn by `ScheduleDay` only in
 *       the new Maker's Studio, through the rail's own writes; it fills the screen.
 *   2 · Studio › Love Story is one band per moment (photo · year · title · first line · grip), opened
 *       in place — and an edit made there keeps EVERY field the moment holds (a year changed never
 *       drops its place, photos, title, anchor, hidden or order).
 *   3 · Studio › Info's names are ONE row "Event name · Maria & Jose", composed as the hero composes
 *       them, opening the shipped NamesEditor + Name style ▾ in place; a one-person event keeps its own.
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

test('1 · Studio › Schedule: one band per moment — time pill · moment · place · For ▾ — and + Add a moment', async () => {
  const { StudioDay, studioForWords } = await import(`../${SCHED}/studio-day`);
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
  assert.match(out, /value="Entourage photos"[\s\S]*value="Santuario de San Antonio"/, 'the moment and its place are not fields on the row');
  assert.match(out, /placeholder="Place \(optional\)"/);
  assert.equal(studioForWords('everyone'), 'For · Everyone');
  assert.equal(studioForWords('entourage'), 'Only for · Entourage');
  assert.match(out, /data-studio-moment-for="entourage"[\s\S]*?Only for · Entourage/, 'For ▾ does not show 4c’s stored audience');
  assert.equal((out.match(/>For · Everyone</g) ?? []).length, 2);
  assert.match(out, /data-studio-add-moment=""[^>]*>[\s\S]*?Add a moment/, 'no + Add a moment');
  /* 🧱 Bands, not boxes: a row is a full-width band with a hairline, never a rounded card. */
  const row = /<li data-studio-moment="a"[^>]*>/.exec(out)?.[0] ?? '';
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

test('2b · Studio › Love Story is the cards — one band per moment, opened in place — not the scrapbook', async () => {
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
  assert.equal((studio.match(/data-studio-story-head="/g) ?? []).length, 3, 'not one card per moment');
  assert.match(studio, /2019[\s\S]*One umbrella[\s\S]*A rainy Tuesday in Katipunan\.[\s\S]*data-moment-grip="u"/, 'a card is not photo · year · title · first line · grip');
  assert.ok(sortMoments(story).map((m) => m.id).join() === 'u,s,d');
  assert.doesNotMatch(studio, /id="love-story-title"|On our <i/, 'Studio still draws the scrapbook around the cards');
  assert.match(studio, /Add a moment/, 'no + Add a moment');
  const card = /<li data-moment-card="u"[^>]*>/.exec(studio)?.[0] ?? '';
  assert.match(card, /class="[^"]*border-t border-ink\/10 bg-cream/, 'a moment is not on a band with a hairline');
  assert.doesNotMatch(card, /class="[^"]*rounded/, 'a moment is drawn as a rounded box (owner: “bands? full width”)');
  const shipped = await html(React.createElement(LoveStoryBook, props));
  assert.match(shipped, /id="love-story-title"/, 'the shipped scrapbook changed — flag-off must not change');
  assert.doesNotMatch(shipped, /data-moment-order-cards/);
});

test('3 · Studio › Info: ONE "Event name · Maria & Jose" row that opens the two people + Name style in place', async () => {
  const { StudioEventName } = await import(`../${L}/studio-event-name`);
  const out = await html(
    React.createElement(StudioEventName, {
      eventId: 'ev-1',
      people: ['Bride', 'Groom'],
      initial: [{ first: 'Maria', last: 'Santos' }, { first: 'Jose', last: 'Dela Cruz' }],
      nameStyle: 'full',
    }),
  );
  assert.match(out, /Event name[\s\S]*?<span[^>]*>Maria &amp; Jose<\/span>/, 'the row does not read “Event name · Maria & Jose” (first names, as the hero composes them)');
  assert.match(out, /About Event name/, 'Event name has no ⓘ saying where it is read');
  assert.match(out, /aria-expanded="false"/);
  assert.match(out, /<div id="[^"]+" hidden="" class="hidden /, 'the names are not folded under the row until it is tapped');
  const md = read(`${L}/maker-details.tsx`);
  assert.match(
    md,
    /if \(yeIn\?\.names && !yeIn\.oneName && !yeIn\.names\.wholeForm && editors\.names !== undefined\) \{\s*editors\.names = \(\s*<StudioTool\s+part="event-name"/,
    'Studio › Info does not draw the Event name row — or draws it for a one-person event',
  );
  const body = read(`${L}/studio-event-name.tsx`);
  assert.match(body, /<NamesEditor eventId=\{eventId\} people=\{people\} initial=\{initial\} onNames=\{onNames\} \/>\s*<NameStylePicker eventId=\{eventId\} saved=\{nameStyle\} \/>/, 'the row does not open the SHIPPED editors');
  assert.match(body, /coupleNameColumns\(a, b\)\.display_name/, 'the row does not compose the name as the hero does');
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
  /* What to bring is a drafted column: typed → drafted after a pause, no Save button. */
  const tools = read(`${L}/studio-tools.tsx`);
  const bring = tools.slice(tools.indexOf('function StudioWhatToBring'), tools.indexOf('export type StudioToolProps'));
  assert.doesNotMatch(bring, /type="submit"|<TextPanel|>Save</, 'What to bring still has a Save button');
  assert.match(bring, /JSON\.stringify\(\{ events: \{ what_to_bring:/, 'What to bring no longer writes the draft');
  assert.match(bring, /hubDraftAction\(eventId, fd\)/, 'What to bring writes outside the one draft door');
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
