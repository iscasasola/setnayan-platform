/**
 * guests-top-row-and-full-screen.test.ts — ONE TOP ROW ON EVERY VIEW, AND THE MAPS THAT AUTO-PIN FULL SCREEN
 * (R4 slice 2, owner 2026-10-29; amended 2026-10-30).
 *
 * ⚖ Owner, 2026-10-29 ~18:35: *"Guests ▾ List·Map · Seats ▾ List·2D·3D · March"* · *"we need that so the 3d map can have
 * more space and 3d map, 2d map and guest map are all auto pinned full screen."* · ~18:42 *"remember to animate them
 * properly"* · ~18:15 *"look at 2d seat, did not maximize width"*.
 * ⚖ Owner, 2026-10-30, on the iPhone app (screenshots: Seats › 2D wore the slim `[Seats · 2D ▾] · ⋯ · ⚙`, Seats › List
 * the old segmented `[Guests | Seats ▾ | March] · ⋯ · ⚙` with four big tiles under it): *"The menu does not work
 * properly"*; and *"Seat ls should be pinned on top row and on map and 3d"* → *"Like this one"* (Guests › List's pinned
 * `[Guests · List ▾] · ✓ 80 ✗ 0 ? 152 · ⚙`).
 *
 * Properties held:
 *   (1) the ▾ groups the four addresses — every old address still names its view and mode;
 *   (2) Map, Seats › 2D and Seats › 3D are full screen; Guests › List, Seats › List and March are not — and the screen says
 *       so on its root; the ONE row is pinned from the start on every view (no second face, no "pin once");
 *   (3) the Map's count carousel folds in the full-screen glide (0.3 s on the prototype curve); reduced motion has none;
 *   (4) 2D edge to edge: in Guests the floor (press area + grid) fills the cell around the room-aspect box — the box, and
 *       so every percent → pixel step, is untouched — and Fit fills the floor;
 *   (5) EVERY view — Guests › List · Map, Seats › List · 2D · 3D, March — draws the SAME one row: exactly one first row,
 *       one ▾ (`data-guests-pin-menu`) whose words name the view, no segmented `Guests | Seats | March` anywhere; the
 *       ▾ lists every view (Guests: List · Map · Seats: List · 2D · 3D · March); Guests' views carry ✓ ✕ ? in the row;
 *   (6) Seats' counts ride that row (seated · unseated · tables, the ONE count door, from the plan's own numbers) on every
 *       mode, each opening where its old tile did; the four-tile row is gone from Guests; ✨ Auto arrange is in the ⋯.
 *
 * 🛡 Sabotaged (2026-10-29): `isFullScreenView` without 3D → red on (2); the Guests canvas given `overflow-hidden` back →
 * red on (4). (2026-10-30): the segmented `<nav data-guests-segmented>` put back in the row → red on (5); Seats' counts
 * portal removed → red on (6); the Auto arrange `MenuRow` dropped from the ⋯ → red on (6).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import {
  GUESTS_VIEWS,
  guestsViewHref,
  isFullScreenView,
  parseGuestsView,
  parseSeatView,
  pinnedMenuWords,
  seatModeOf,
  seatOfMode,
  SEAT_MODES,
  topOfView,
} from './guests-views';

const read = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));

test('(1) three tops over the four addresses — and every old address still lands on its view and mode', () => {
  assert.deepEqual(GUESTS_VIEWS.map(topOfView), ['guests', 'guests', 'seats', 'march']);
  for (const m of SEAT_MODES) assert.equal(seatModeOf(seatOfMode(m)), m, `Seats › ${m} does not survive its own address`);
  assert.equal(guestsViewHref('E', 'seats', { seat: seatOfMode('2d') }), '/dashboard/E/guests?gview=seats');
  assert.equal(guestsViewHref('E', 'seats', { seat: seatOfMode('3d') }), '/dashboard/E/guests?gview=seats&seat=3d');
  assert.equal(guestsViewHref('E', 'seats', { seat: seatOfMode('list') }), '/dashboard/E/guests?gview=seats&seat=list');
  // The old doors: ?gview=map, ?gview=walk (→ March), seat=map (the guests' map to their table — the 2D family).
  assert.equal(parseGuestsView('map'), 'map');
  assert.equal(parseGuestsView('walk'), 'march');
  assert.equal(seatModeOf(parseSeatView('map')), '2d');
  assert.equal(seatModeOf(parseSeatView('nonsense')), '2d');
  assert.equal(pinnedMenuWords('list', '2d'), 'Guests · List');
  assert.equal(pinnedMenuWords('map', '2d'), 'Guests · Map');
  assert.equal(pinnedMenuWords('seats', '3d'), 'Seats · 3D');
  assert.equal(pinnedMenuWords('march', '2d'), 'March');
});

test('(2) Map, Seats › 2D and Seats › 3D are full screen; the lists are not — and the root says which', async () => {
  assert.equal(isFullScreenView('map', '2d'), true);
  assert.equal(isFullScreenView('seats', '2d'), true);
  assert.equal(isFullScreenView('seats', '3d'), true, 'the 3D room is not full screen');
  assert.equal(isFullScreenView('seats', 'list'), false);
  assert.equal(isFullScreenView('list', '3d'), false);
  assert.equal(isFullScreenView('march', '2d'), false);
  const { renderGuestsScreen, guestRow } = await import('../app/dashboard/[eventId]/guests/_components/render-guests-screen');
  const guests = [guestRow(), guestRow({ rsvp_status: 'attending' } as never)];
  const root = (html: string) => html.slice(html.indexOf('data-guests-screen='), html.indexOf('>', html.indexOf('data-guests-screen=')));
  assert.match(root(await renderGuestsScreen({ guests, views: GUESTS_VIEWS, gview: 'map' })), /data-guests-full=""/, 'the Map is not full screen');
  assert.doesNotMatch(root(await renderGuestsScreen({ guests, views: GUESTS_VIEWS })), /data-guests-full/, 'the List is drawn full screen');
  const seats = (seat: '3d' | 'list' | null) => renderGuestsScreen({ guests, views: GUESTS_VIEWS, gview: 'seats', seat, bodies: { seats: null } });
  assert.match(root(await seats(null)), /data-guests-full=""/, 'Seats › 2D is not full screen');
  assert.match(root(await seats('3d')), /data-guests-full=""/, 'Seats › 3D is not full screen');
  assert.doesNotMatch(root(await seats('list')), /data-guests-full/, 'Seats › List is drawn full screen');
  // ONE face, pinned from the start on every view — nothing waits for a scroll, nothing swaps.
  const screen = read('app/dashboard/[eventId]/guests/_components/guests-screen.tsx');
  assert.match(screen, /if \(!st \|\| !hold\) return;\s*st\.setAttribute\('data-pinned', ''\);/, 'the one row is not pinned from the start');
  assert.doesNotMatch(screen, /data-collapsed/, 'a second (collapsed) face of the row is back');
  // Entering a full view glides the page back to its top (or jumps under reduced motion).
  assert.match(screen, /window\.scrollTo\(\{ top: 0, behavior: still \? 'auto' : 'smooth' \}\)/, 'entering a full view jumps (or ignores reduced motion)');
});

test('(3) the Map\'s carousel folds in the full-screen glide — 0.3 s on the prototype curve; none under reduced motion', () => {
  const css = readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/guests/_components/guests-screen.module.css'), 'utf8');
  assert.match(css, /--gs-glide: cubic-bezier\(0\.2, 0\.8, 0\.2, 1\);/);
  const rule = (sel: string) => {
    const at = css.indexOf(`${sel} {`);
    assert.ok(at > -1, `${sel} is gone`);
    return css.slice(at, css.indexOf('}', at));
  };
  assert.match(rule('.stick.pinned[data-pinned]'), /position: fixed;[^]*top: var\(--gs-top, 0px\);/, 'the one row is not pinned under the bar');
  assert.doesNotMatch(css, /faceAlt|\[data-collapsed\]/, 'the two-face swap is back in the CSS');
  const fold = rule(".screen[data-guests-full] [data-view-count-row],\n.screen[data-guests-full][data-guests-screen='map'] .summary");
  assert.match(fold, /max-height: 0;[^]*opacity: 0;[^]*transform: translateY\(-12px\);/, 'the count row does not fold away in full screen');
  assert.match(rule(".screen [data-view-count-row],\n.screen[data-guests-screen='map'] .summary"), /max-height 300ms var\(--gs-glide\)/);
  const still = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)', css.indexOf('.screen[data-guests-full] [data-view-count-row],\n  .screen[data-guests-full]')));
  assert.match(still, /\.screen \[data-view-count-row\][^{]*\.screen\[data-guests-full\] \[data-view-count-row\][^{]*\{\s*transform: none;\s*transition: none;/, 'reduced motion still glides');
});

test('(4) 2D edge to edge in Guests: the floor fills the cell around the untouched room box; Fit fills the floor', () => {
  const ed = read('app/dashboard/[eventId]/seating/_components/seating-editor.tsx');
  const at = ed.indexOf('ref={canvasRef}');
  const tag = ed.slice(at, ed.indexOf('style={{', at));
  const m = tag.match(/inGuests\s*\?\s*"([^"]*)"\s*:\s*'([^']*)'/);
  const [, guestsCls] = m ?? [];
  assert.ok(guestsCls !== undefined, 'the canvas no longer names its Guests look — this guard is blind');
  assert.doesNotMatch(guestsCls, /\boverflow-hidden\b/, 'the Guests room box clips the plan again — the floor stops at the letterbox');
  assert.match(guestsCls, /before:-inset-\[200vmax\]/, 'the floor (press area) does not reach the cell’s edges');
  assert.match(guestsCls, /before:pointer-events-auto/, 'the side strips take no drag');
  // The room box keeps its size — the percent math reads it (never changed).
  assert.match(ed, /\.\.\.\(scaledBox\s*\? \{ width: `\$\{scaledBox\.w\}px`, height: `\$\{scaledBox\.h\}px` \}/);
  // Fit fills the floor (the cell) in Guests.
  assert.match(ed, /const cell = inGuests \? regionRef\.current\?\.getBoundingClientRect\(\) : null;/);
  // Fit measures the FLOOR (fitW / fitH), the property pinned here; #7060 may cap it at the old opening zoom.
  assert.match(ed, /const z1 = (?:Math\.min\(PLAN_ZOOM_MAX_FLOOR, )?clampZoom\(Math\.min\(fitW \/ bw, fitH \/ bh\) \* 0\.86\)\)?;/);
});

const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;

test('(5) every view wears the SAME one row — one ▾ naming the view, no segmented Guests | Seats | March, ✓ ✕ ? on Guests', async () => {
  const { renderGuestsScreen, guestRow } = await import('../app/dashboard/[eventId]/guests/_components/render-guests-screen');
  const guests = [guestRow(), guestRow({ rsvp_status: 'attending' } as never), guestRow({ rsvp_status: 'declined' } as never)];
  const views: { name: string; gview: 'list' | 'map' | 'seats' | 'march'; seat: '3d' | 'list' | null; words: string; replies: boolean }[] = [
    { name: 'Guests › List', gview: 'list', seat: null, words: 'Guests · List', replies: true },
    { name: 'Guests › Map', gview: 'map', seat: null, words: 'Guests · Map', replies: true },
    { name: 'Seats › List', gview: 'seats', seat: 'list', words: 'Seats · List', replies: false },
    { name: 'Seats › 2D', gview: 'seats', seat: null, words: 'Seats · 2D', replies: false },
    { name: 'Seats › 3D', gview: 'seats', seat: '3d', words: 'Seats · 3D', replies: false },
    { name: 'March', gview: 'march', seat: null, words: 'March', replies: false },
  ];
  for (const v of views) {
    const html = await renderGuestsScreen({ guests, views: GUESTS_VIEWS, gview: v.gview, seat: v.seat, bodies: { seats: null, march: null }, setup: 'rows' });
    assert.equal(count(html, /data-first-row=""/g), 1, `${v.name}: not exactly one first row`);
    assert.doesNotMatch(html, /data-guests-segmented|data-guests-seg=|aria-label="Guest list views"/, `${v.name}: the old segmented Guests | Seats | March row is drawn`);
    const at = html.indexOf('data-first-row=""');
    const row = html.slice(at, html.indexOf('data-guests-view-rounds', at));
    assert.equal(count(row, /data-guests-pin-menu=""/g), 1, `${v.name}: the row has no ▾ (or two)`);
    assert.match(row, new RegExp(`>${v.words.replace('·', '·')}</span>`), `${v.name}: the ▾ does not say "${v.words}"`);
    assert.equal(pinnedMenuWords(v.gview, seatModeOf(v.seat)), v.words);
    assert.match(row, /data-guests-view-counts=""/, `${v.name}: the row has no seat for its counts`);
    const replies = count(row, /data-reply-filter="(attending|declined|none)"/g);
    assert.equal(replies, v.replies ? 3 : 0, `${v.name}: ✓ ✕ ? ${v.replies ? 'missing from' : 'drawn in'} the row`);
    const after = html.slice(html.indexOf('data-guests-view-rounds', at));
    assert.ok(after.indexOf('data-menu-settings') > -1, `${v.name}: the ⚙ does not end the row`);
  }
  // The ▾ lists every view — Guests: List · Map, Seats: List · 2D · 3D, March — and a pick goes there from any view.
  const screen = read('app/dashboard/[eventId]/guests/_components/guests-screen.tsx');
  assert.match(screen, /const pinMenuOptions: PickOption\[\] = \[\s*\.\.\.guestModes\.map[^]*?seatModes\.map[^]*?key: 'march'/, 'the ▾ does not list every view');
  assert.match(screen, /if \(k === 'march'\) pickView\('march'\);\s*else if \(k\.startsWith\('seats:'\)\) chooseSeat\(k\.slice\(6\) as SeatMode\);\s*else pickView\(k\.slice\(7\) as GuestsView\);/, 'a ▾ pick does not switch view');
  assert.deepEqual([...SEAT_MODES], ['list', '2d', '3d']);
});

test('(6) Seats\' counts ride the one row on every mode, each a door where its tile was; Auto arrange is in the ⋯', () => {
  const ed = read('app/dashboard/[eventId]/seating/_components/seating-editor.tsx');
  assert.doesNotMatch(ed, /<ViewCountRow\b/, 'the four big Seats tiles are back');
  const at = ed.indexOf('const seatCounts =');
  assert.ok(at > -1, 'Seats draws no counts into the row');
  const body = ed.slice(at, ed.indexOf('lens.countsSlot,', at) + 20);
  assert.match(body, /inGuests && lens\?\.countsSlot\s*\?\s*createPortal\(/, 'the counts are not drawn into the row’s count seat');
  assert.equal(count(body, /<PinCountDoor\b/g), 3, 'not three count doors (seated · unseated · tables)');
  assert.match(body, /value=\{seatedComing\}[^]*?onPress=\{\(\) => onSelectView\('list'\)\}/, 'seated is not the shipped count, or opens nothing');
  assert.match(body, /value=\{unseatedComing\}[^]*?onSelectView\('list'\);\s*openUnseated\(\);/, 'unseated does not open who is left');
  assert.match(body, /value=\{displayUnits\.length\}[^]*?onPress=\{\(\) => onSelectView\('2d'\)\}/, 'tables does not open the plan');
  // It is drawn whatever the mode (the portal is mounted with the editor, never gated on the 2D/3D/List view).
  assert.match(ed, /\{seatToolRounds\}\s*\{seatCounts\}/);
  // ✨ Auto arrange — the same run, the same refusals — first in the ⋯.
  const more = ed.slice(ed.indexOf('const phoneMore = ('), ed.indexOf('const phoneTrailing = ('));
  assert.match(more, /inGuests \? \([\s\S]*?<MenuRow\s+icon=\{Sparkles\}[\s\S]*?onClick=\{runAutoArrange\}\s*disabled=\{!canEdit \|\| tables\.length === 0 \|\| isPending\}/, 'Auto arrange is not in the ⋯');
  // ONE count door for every view — the List's ✓ ✕ ? are the same component.
  const screen = read('app/dashboard/[eventId]/guests/_components/guests-screen.tsx');
  assert.match(screen, /const pinDoor = [^]*?<PinCountDoor\b/, 'the List draws its own count door again');
});
