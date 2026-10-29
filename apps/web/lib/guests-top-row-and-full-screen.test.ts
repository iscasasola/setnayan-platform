/**
 * guests-top-row-and-full-screen.test.ts — GUESTS ▾ · SEATS ▾ · MARCH, AND THE MAPS THAT AUTO-PIN FULL SCREEN
 * (R4 slice 2, owner 2026-10-29).
 *
 * ⚖ Owner, ~18:35: *"Guests ▾ List·Map · Seats ▾ List·2D·3D · March"* · *"we need that so the 3d map can have more space
 * and 3d map, 2d map and guest map are all auto pinned full screen."* · ~18:42 *"remember to animate them properly"* ·
 * ~18:15 *"look at 2d seat, did not maximize width"*. Prototype v14 (one menu for page + mode; pinned = LEFT the menu,
 * RIGHT the rounds) and v16 (the glide: full row rises + fades −12 px · 0.98, slim row rises in from +12 px, 0.3 s,
 * cubic-bezier(.2,.8,.2,1), reduced motion respected).
 *
 * Properties held:
 *   (1) the row is three tops grouping the four addresses — every old address still names its view and mode;
 *   (2) Map, Seats › 2D and Seats › 3D are full screen; Guests › List, Seats › List and March are not — and the screen says
 *       so on its root, so the count row folds and the row is the slim one;
 *   (3) the glide: the faces cross in 0.3 s on the prototype's curve, with the prototype's travel; the count row folds in
 *       the same glide; reduced motion has neither;
 *   (4) 2D edge to edge: in Guests the floor (press area + grid) fills the cell around the room-aspect box — the box, and
 *       so every percent → pixel step, is untouched — and Fit fills the floor.
 *
 * 🛡 Sabotaged (2026-10-29): `isFullScreenView` without 3D → red on (2); the collapsed pill's `scale(0.98)` dropped → red
 * on (3); the Guests canvas given `overflow-hidden` back → red on (4).
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
  // A full-screen view shows the slim row from the start (no scroll needed) and the page glides back to its top.
  const screen = read('app/dashboard/[eventId]/guests/_components/guests-screen.tsx');
  assert.match(screen, /if \(fullView\) \{\s*st\.removeAttribute\('data-pinned'\);\s*st\.setAttribute\('data-collapsed', ''\);\s*return;\s*\}/);
  assert.match(screen, /window\.scrollTo\(\{ top: 0, behavior: still \? 'auto' : 'smooth' \}\)/, 'entering a full view jumps (or ignores reduced motion)');
});

test('(3) the glide — 0.3 s on the prototype curve, the prototype travel, the count row folding with it; none under reduced motion', () => {
  const css = readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/guests/_components/guests-screen.module.css'), 'utf8');
  assert.match(css, /--gs-glide: cubic-bezier\(0\.2, 0\.8, 0\.2, 1\);/);
  const rule = (sel: string) => {
    const at = css.indexOf(`${sel} {`);
    assert.ok(at > -1, `${sel} is gone`);
    return css.slice(at, css.indexOf('}', at));
  };
  const out = rule(".stick.pinned[data-collapsed] [data-first-row] > [data-guests-segmented]");
  assert.match(out, /opacity: 0;/);
  assert.match(out, /transform: translateY\(-12px\) scale\(0\.98\);/, 'the full row does not rise and shrink away');
  assert.match(out, /300ms var\(--gs-glide\)/);
  assert.match(rule('.faceAlt'), /transform: translateY\(12px\);[^]*300ms var\(--gs-glide\)/, 'the slim row does not rise in from +12 px');
  assert.match(rule('.stick[data-collapsed] .faceAlt'), /opacity: 1;\s*transform: none;/);
  // The count row folds in the same glide (Seats' fixed row; the Map's carousel).
  const fold = rule(".screen[data-guests-full] [data-view-count-row],\n.screen[data-guests-full][data-guests-screen='map'] .summary");
  assert.match(fold, /max-height: 0;[^]*opacity: 0;[^]*transform: translateY\(-12px\);/, 'the count row does not fold away in full screen');
  // Reduced motion: no travel, no fade-in-motion — for the faces and the fold.
  const still = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)', css.indexOf('.screen[data-guests-full] [data-view-count-row],\n  .screen[data-guests-full]')));
  assert.match(still, /\.faceAlt,[^{]*\.screen\[data-guests-full\] \[data-view-count-row\][^{]*\{\s*transform: none;\s*transition: none;/, 'reduced motion still glides');
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

/*
 * (5) 📌 THE COUNTS RIDE THE PINNED ROW ON EVERY GUESTS AND SEATS VIEW (owner 30 Oct, with phone shots of Guests · Map,
 * Seats · 2D and Seats · 3D: *"Seat ls should be pinned on top row and on map and 3d"* → *"Like this one"* — the List's
 * ✓ ✕ ?). One face, one door shape: Guests (List · Map) the reply doors; Seats (List · 2D · 3D) the plan's OWN seat counts
 * (seated · unseated · tables — the Seats count row's, reported up the lens, never counted by the screen); March none.
 * 🛡 Sabotaged (2026-10-30): the Map dropped from `pinDoors` → red; the counts left out of `registerSeats` → red.
 */
test('(5) the pinned row carries the counts on every Guests and Seats view — reply doors on Guests, seat counts on Seats', async () => {
  const { renderGuestsScreen, guestRow } = await import('../app/dashboard/[eventId]/guests/_components/render-guests-screen');
  const guests = [guestRow(), guestRow({ rsvp_status: 'attending' } as never)];
  const face = (html: string) => {
    const at = html.indexOf('data-guests-pin-face="summary"');
    return html.slice(at, html.indexOf('data-guests-segmented', at) > 0 ? html.indexOf('data-guests-segmented', at) : at + 4000);
  };
  for (const gview of ['list', 'map'] as const) {
    const doors = [...face(await renderGuestsScreen({ guests, views: GUESTS_VIEWS, gview })).matchAll(/data-reply-filter="(\w+)"/g)].map((m) => m[1]);
    assert.deepEqual(doors, ['attending', 'declined', 'none'], `Guests › ${gview}: the pinned row lost its ✓ ✕ ?`);
  }
  const march = face(await renderGuestsScreen({ guests, views: GUESTS_VIEWS, gview: 'march', bodies: { march: null } }));
  assert.doesNotMatch(march, /data-reply-filter|data-seat-count/, 'March carries counts it was not asked for');
  // Seats: the screen draws exactly the counts the plan reports — the plan counts them where its count row does.
  const screen = read('app/dashboard/[eventId]/guests/_components/guests-screen.tsx');
  assert.match(screen, /measured && \(gview === 'list' \|\| gview === 'map'\)/, 'the Map has no reply doors on its pinned row');
  assert.match(screen, /gview === 'seats' && seatCounts\s*\? \[\s*pinSeatDoor\('seated', seatCounts\.seated,[\s\S]*?pinSeatDoor\('unseated', seatCounts\.unseated,[\s\S]*?pinSeatDoor\('tables', seatCounts\.tables,/);
  assert.match(screen, /setSeatCounts\(api\.counts \?\? null\);/);
  assert.match(screen, /<PinnedSummary\s+menu=\{pinMenu\}\s+doors=\{pinDoors\}/, 'the pinned face does not draw the counts');
  const ed = read('app/dashboard/[eventId]/seating/_components/seating-editor.tsx');
  assert.match(ed, /counts: \{ seated: seatedComing, unseated: unseatedComing, tables: tableCount \}/, 'the plan does not report its seat counts');
  assert.match(ed, /\{ key: 'seated', word: 'seated', value: seatedComing,/, 'the pinned seated count is not the count row’s');
  assert.match(ed, /\}, \[registerSeats, studioView, show3D, seatedComing, unseatedComing, tableCount\]\);/, 'a count change never reaches the pinned row');
  // One line at 390: the counts give way inside the face (min-width: 0), never wrap.
  const css = readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/guests/_components/guests-screen.module.css'), 'utf8');
  assert.match(css, /\.pinCounts \{[^}]*min-width: 0;/);
  assert.match(css, /button\.pinCount \{[^}]*white-space: nowrap;/);
});
