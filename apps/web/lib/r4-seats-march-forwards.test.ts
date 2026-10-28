/**
 * r4-seats-march-forwards.test.ts — R4 · SEATS AND MARCH JOIN GUESTS, AND EVERY OLD DOOR LANDS THERE.
 *
 * Owner, 2026-10-27/28 (DECISION_LOG "GUESTS = LIST · MAP · SEATS · MARCH; RSVP SETTINGS LIVE IN THE GUESTS ⚙", "STUDIO
 * IS LOOK AND WORDS ONLY", the 2026-10-28 answers *"3D plan: yes, inside Seats"* and *"all mapping will be kept"*):
 * *"On guests we have things to move there: March, Seat, Rsvp"*. Seats is the shipped seat-plan maker rendered whole
 * (its 2D plan, its 3D room, the guests' map to their table); March is the shipped Wedding March maker. Nothing is
 * redrawn. A guard per move:
 *
 *   1 · STUDIO — no Wedding March or Seat plan tile: not a key, not an editor a tile opens, not a card on the Studio
 *       home; "n of N ready" counts the tiles that are there.
 *   2 · THE OLD MAKER ADDRESS — `/launch?tool=details&item=seating|march` (carrying `seat`) lands on the Guests view,
 *       before anything is read; inside the Maker either item is only the door to it (`GuestsViewDoor`).
 *   3 · THE OLD PAGES — `/seating` (any `?view=list`), `/plan3d` (the 3D room), `/studio/indoor-blueprint` (the guests'
 *       map) and the Guest list's own `?gview=walk` each forward to their Guests view, by the address alone.
 *   4 · THE GUIDED FLOW (Home's count, What's left) — the march and the seat plan are LINKS to their Guests view,
 *       counted as before from the same facts, so Home never says "Missing" about a march or a plan that is done.
 *   5 · THE PARTS' DOORS — the Hub's march, a guest's role and their seat open Guests › March / Seats, never Studio.
 *   6 · GUESTS DRAWS THEM — the view row is List · Map · Seats · March (the shipped pill selector, extended), each a link
 *       to its address; Seats / March draw the maker the page hands in, with no list and no thumb row under it; Map is
 *       still the guest tree.
 *
 * Sabotage (2026-10-28, each seen red, then restored): 'march' put back in `STUDIO_TILE_KEYS` → 1 red · the launch
 * page's `if (movedView) redirect(movedView);` removed → 2 red · `/seating`'s forward removed → 3 red · the guided
 * march's `view: 'march'` removed → 4 red · the `seats` part's source back to a Studio tile → 5 red · Guests'
 * `{makerView ? (` body switched off → 6 red · the 2D face's `tapFace` removed → 7 red · Not walking counted over an unread
 * tray → 7 red · Preview enabled before it ships → 8 red · an unread tile drawn as 0 → 8 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { stripComments } from './strip-comments';
import { STUDIO_TILE_ITEM, STUDIO_TILE_KEYS } from './studio-tile-defs';
import { STUDIO_TILES } from './studio-tiles';
import {
  GUESTS_MAKER_VIEWS,
  GUESTS_VIEWS,
  MAKER_ITEMS_MOVED_TO_GUESTS_VIEWS,
  SEAT_PAGES_MOVED_TO_SEATS,
  guestsViewHref,
  makerItemMovedToViewHref,
  parseGuestsView,
} from './guests-views';
import { MAKER_PARTS, makerPartQuietRow, makerPartStudioDoor, type MakerGuestsView, type MakerPartKey } from './maker-parts';
import { GUIDED_STEPS, buildGuidedPlan, guidedLinkHref, type GuidedGuestsView, type GuidedItem } from './details-guided-flow';
import { setupProgress } from './stage-setup';
import { pageHome } from './page-home';

(globalThis as unknown as { React: unknown }).React = React;
{
  /* The pages this runs import modules that import `server-only` (a build-time marker) — nothing here is a client. */
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const EID = 'S89E-ABCDEFGHIJ';
const GUESTS = `/dashboard/${EID}/guests`;
/** The views a guided link or a part's door may name — each must be one of R4's two (the types restate them). */
const GUIDED_VIEWS: readonly GuidedGuestsView[] = ['march', 'seats'];
const PART_VIEWS: readonly MakerGuestsView[] = ['march', 'seats'];

/** Read a function body from the export to the next top-level export (comments stripped). */
function bodyOf(src: string, anchor: string): string {
  const at = src.indexOf(anchor);
  assert.ok(at >= 0, `anti-vacuity: "${anchor}" not found`);
  return src.slice(at);
}

/** The address a forward lands on, by RUNNING it: Next's `redirect()` throws with the target in its digest. */
async function landsOn(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (e) {
    const digest = (e as { digest?: string }).digest ?? '';
    const m = /^NEXT_REDIRECT;[a-z]+;([^;]+);/.exec(digest);
    if (m) return m[1]!;
    throw e;
  }
  assert.fail('the page drew instead of forwarding');
}

test('1 · Studio has no Wedding March or Seat plan tile — not a key, not an editor, not a card', async () => {
  for (const gone of ['march', 'seats']) {
    assert.ok(!(STUDIO_TILE_KEYS as readonly string[]).includes(gone), `the ${gone} tile is back in Studio`);
    assert.ok(!(gone in STUDIO_TILES), `the ${gone} tile's words are back`);
  }
  for (const item of ['march', 'seating']) {
    assert.ok(!Object.values(STUDIO_TILE_ITEM).includes(item as never), `a Studio tile still opens the Maker’s ${item} item`);
  }
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { StudioHome } = await import('../app/dashboard/[eventId]/launch/_components/studio-home');
  const tiles = STUDIO_TILE_KEYS.map((key) => ({ key, label: STUDIO_TILES[key].label, short: STUDIO_TILES[key].short, item: STUDIO_TILES[key].item, immersive: false, done: true, status: '' }));
  const html = renderToStaticMarkup(React.createElement(StudioHome, { tiles, onOpen: () => {} }));
  const drawn = [...html.matchAll(/data-studio-tile="([a-z]+)"/g)].map((m) => m[1]);
  assert.equal(drawn.length, STUDIO_TILE_KEYS.length, 'anti-vacuity: the Studio home drew no cards');
  assert.ok(!drawn.includes('march') && !drawn.includes('seats'), 'the Studio home draws a march or a seat card');
  assert.match(html, new RegExp(`>\\d+ of ${STUDIO_TILE_KEYS.length} ready<`), 'Studio’s "n of N ready" does not count the tiles that are there');
  // The Maker's own count: no tile reads the seat plan or the march any more.
  for (const k of STUDIO_TILE_KEYS) {
    assert.ok(!STUDIO_TILES[k].reads.some((r) => r === 'seating' || r === 'march'), `the ${k} tile still reads the seat plan or the march`);
  }
  console.log(`  studio: ${drawn.length} cards — ${drawn.join(' · ')}`);
});

test('2 · the old Maker address lands on the Guests view — before anything is read; inside the Maker each is a door', () => {
  assert.equal(makerItemMovedToViewHref(EID, 'seating'), `${GUESTS}?gview=seats`);
  assert.equal(makerItemMovedToViewHref(EID, 'seating', '3d'), `${GUESTS}?gview=seats&seat=3d`);
  assert.equal(makerItemMovedToViewHref(EID, 'seating', 'map'), `${GUESTS}?gview=seats&seat=map`);
  assert.equal(makerItemMovedToViewHref(EID, 'seating', 'nonsense'), `${GUESTS}?gview=seats`, 'an unknown seat view rode along');
  assert.equal(makerItemMovedToViewHref(EID, 'march', '3d'), `${GUESTS}?gview=march`, 'a seat view rode along on the March');
  for (const item of [undefined, '', 'names', 'rsvp', 'gifts', 'love-story', 'constructor', 'toString']) {
    assert.equal(makerItemMovedToViewHref(EID, item), null, `item=${String(item)} forwards, but it never moved here`);
  }
  for (const view of Object.values(MAKER_ITEMS_MOVED_TO_GUESTS_VIEWS)) {
    assert.ok((GUESTS_MAKER_VIEWS as readonly string[]).includes(view), `${view} is not one of R4's Guests views`);
  }
  const page = read('app/dashboard/[eventId]/launch/page.tsx');
  const body = bodyOf(page, 'export default async function LaunchHubPage');
  const fwd = body.indexOf('const movedView = makerItemMovedToViewHref(eventId, one(search.item), one(search.seat));');
  assert.ok(fwd > 0, 'the launch page does not forward the seat plan and the march');
  assert.match(body.slice(fwd, fwd + 160), /if \(movedView\) redirect\(movedView\);/);
  for (const later of ['await getUser', 'getCurrentUser()', 'createClient(', '.from(']) {
    const at = body.indexOf(later);
    if (at >= 0) assert.ok(at > fwd, `the launch page reads (${later}) before it forwards a moved item`);
  }
  // A pick of either item still inside the Maker (All items, a print's "Open Seat plan") draws the door to Guests —
  // never a second copy of either maker.
  assert.doesNotMatch(page, /<CoupleSeatingPage\b|from '\.\.\/seating\/page'/, 'the Maker renders the seat plan again');
  assert.match(page, /page: <GuestsViewDoor eventId=\{eventId\} view="seats" \/>/);
  const parts = read('app/dashboard/[eventId]/launch/_components/details-your-event-parts.tsx');
  assert.match(parts, /march: input\.march\.lab \? \([\s\S]{0,400}?\) : \(\s*<GuestsViewDoor eventId=\{eventId\} view="march" \/>/, 'the Maker draws the march maker for a real event');
});

test('3 · the old pages forward to their Guests view — by the address alone', async () => {
  assert.deepEqual(SEAT_PAGES_MOVED_TO_SEATS, { seating: null, plan3d: '3d', 'studio/indoor-blueprint': 'map' });
  // /plan3d — run it.
  const { default: Plan3d } = await import('../app/dashboard/[eventId]/plan3d/page');
  assert.equal(await landsOn(() => Plan3d({ params: Promise.resolve({ eventId: EID }) })), guestsViewHref(EID, 'seats', { seat: '3d' }));
  // /seating — run it, with and without its List view: it leaves before it asks who is signed in.
  const { default: Seating } = await import('../app/dashboard/[eventId]/seating/page');
  assert.equal(await landsOn(() => Seating({ params: Promise.resolve({ eventId: EID }), searchParams: Promise.resolve({}) })), `${GUESTS}?gview=seats`);
  assert.equal(await landsOn(() => Seating({ params: Promise.resolve({ eventId: EID }), searchParams: Promise.resolve({ view: 'list' }) })), `${GUESTS}?gview=seats&seat=list`);
  const seating = read('app/dashboard/[eventId]/seating/page.tsx');
  const sBody = bodyOf(seating, 'export default async function SeatingPage');
  const sFwd = sBody.indexOf("if (!inMaker) redirect(guestsViewHref(eventId, 'seats', { seat: viewParam === 'list' ? 'list' : null }));");
  assert.ok(sFwd > 0 && sFwd < sBody.indexOf('getCurrentUser()'), '/seating reads before it forwards');
  assert.match(sBody, /const inMaker = makerParam === '1' \|\| inGuests;/, 'Guests › Seats is not this page drawn in place');
  // /studio/indoor-blueprint — its one read is the type's seat rule; then the guests' map.
  const ib = bodyOf(read('app/dashboard/[eventId]/studio/indoor-blueprint/page.tsx'), 'export default async function IndoorBlueprintPage');
  assert.match(ib, /redirect\(guestsViewHref\(eventId, 'seats', \{ seat: 'map' \}\)\);/);
  assert.doesNotMatch(ib, /createClient\(|getCurrentUser\(|\.from\(/, 'the Indoor Blueprint reads more than the type before it forwards');
  // The Guest list's own march view (`?gview=walk`, `?view=march`) — Guests › March, before the page reads.
  assert.equal(parseGuestsView('walk'), 'march');
  const guests = bodyOf(read('app/dashboard/[eventId]/guests/page.tsx'), 'export default async function GuestsPage');
  const gFwd = guests.indexOf("redirect(guestsViewHref(eventId, 'march'));");
  assert.ok(gFwd > 0 && gFwd < guests.indexOf('await createClient()'), 'the Guest list’s old march link reads before it forwards');
  // Their pages go back to Guests › Seats (`lib/page-home.ts`) — never the stub `/seating`.
  for (const r of ['/dashboard/[eventId]/seating/chart', '/dashboard/[eventId]/seating/walkthrough', '/dashboard/[eventId]/seating/lab']) {
    assert.deepEqual(pageHome(r), { kind: 'home', home: '/dashboard/[eventId]/guests?gview=seats', label: 'Seats' }, r);
  }
});

test('4 · the guided flow (Home’s count, What’s left) opens the march and the seat plan in Guests — counted as before', () => {
  const byKey = new Map(GUIDED_STEPS.map((d) => [d.key, d]));
  assert.equal(byKey.get('march')?.view, 'march', 'the guided march is not a door to Guests › March');
  assert.equal(byKey.get('seat-plan')?.view, 'seats', 'the guided seat plan is not a door to Guests › Seats');
  for (const v of GUIDED_VIEWS) assert.ok((GUESTS_MAKER_VIEWS as readonly string[]).includes(v));
  const items = (done: { march: boolean | undefined; seating: boolean | undefined }): GuidedItem[] =>
    (['names', 'date', 'theme', 'logo', 'hero', 'march', 'seating', 'schedule', 'venues'] as const).map((k) => ({
      key: k as GuidedItem['key'],
      label: k === 'march' ? 'Wedding March' : k,
      done: k === 'march' ? done.march : k === 'seating' ? done.seating : true,
    }));
  // Done → counted done, from its new home; no guided step opens the Maker's item.
  const plan = buildGuidedPlan(items({ march: true, seating: true }), { solemn: false, parentsOffered: false });
  assert.equal(plan.steps.some((s) => s.items.includes('march') || s.items.includes('seating')), false, 'a guided step still opens the Maker’s march or seat plan');
  const views = plan.links.filter((l) => l.view);
  assert.deepEqual(views.map((l) => [l.key, l.view, l.state]), [['march', 'march', 'done'], ['seat-plan', 'seats', 'done']]);
  const whole = setupProgress(plan);
  assert.equal(whole.total, plan.steps.length + plan.links.length, 'Home does not count every fact once');
  assert.equal(whole.done, whole.total, 'Home reads a finished march or seat plan as not done');
  // Not done → still counted, still left (the work is real); not read → no claim (never "Missing").
  const left = buildGuidedPlan(items({ march: false, seating: false }), { solemn: false, parentsOffered: false });
  assert.deepEqual(left.links.filter((l) => l.view).map((l) => l.state), ['left', 'left']);
  assert.equal(setupProgress(left).total, whole.total, 'an unfinished march changes how many facts Home counts');
  const unread = buildGuidedPlan(items({ march: undefined, seating: undefined }), { solemn: false, parentsOffered: false });
  assert.ok(unread.links.filter((l) => l.view).every((l) => l.state !== 'left'), 'a march or plan nobody measured reads as Missing');
  // Its door: the Guests view; with no door handed in, no link at all.
  for (const l of views) assert.equal(guidedLinkHref(l, { guestsViewsHref: GUESTS }), `${GUESTS}?gview=${l.view}`);
  assert.equal(guidedLinkHref(views[0]!, { guestsHref: `${GUESTS}/import` }), null, 'a link to nowhere');
  assert.match(read('app/dashboard/[eventId]/launch/_components/maker-details.tsx'), /guestsViewsHref: `\$\{base\}\/guests`,/);
  // Home's card reads the SAME plan (`readGuidedPlan` → `setupProgress`), so the count above is Home's.
  const home = read('app/dashboard/[eventId]/_components/details-guide-home-card.tsx');
  assert.match(home, /const whole = setupProgress\(plan\);/);
});

test('5 · the Hub’s march, a guest’s role and their seat open Guests › March / Seats — never Studio', () => {
  for (const [k, view] of [['march', 'march'], ['myrole', 'march'], ['seats', 'seats']] as const) {
    assert.equal(MAKER_PARTS[k as MakerPartKey].source, `guests-view:${view}`);
    const q = makerPartQuietRow(k as MakerPartKey);
    assert.ok(q && 'guestsView' in q.to, `${k}: its door is not a Guests view`);
    assert.equal((q.to as { guestsView: string }).guestsView, view);
    assert.doesNotMatch(q.words, /Studio/, `${k}: its door still says Studio`);
    assert.equal(makerPartStudioDoor(k as MakerPartKey), null, `${k}: a Style-bar jump would open a Studio tile`);
  }
  for (const v of PART_VIEWS) assert.ok((GUESTS_MAKER_VIEWS as readonly string[]).includes(v));
  const sources = (Object.keys(MAKER_PARTS) as MakerPartKey[]).map((k) => MAKER_PARTS[k].source);
  assert.deepEqual(sources.filter((s) => s === 'studio:march' || s === 'studio:seats'), [], 'a part still names a moved Studio tile');
  const tools = read('app/dashboard/[eventId]/launch/_components/stage-tools.tsx');
  assert.match(tools, /else if \('guestsView' in q\.to\) quiet = makerEventId \? \{ kind: 'guests', words: q\.words, href: guestsViewHref\(makerEventId, q\.to\.guestsView\) \} : null;/);
});

test('6 · Guests draws List · Map · Seats · March — the shipped maker under the row, the Map still the guest tree', async () => {
  const { renderGuestsScreen, guestRow } = await import('../app/dashboard/[eventId]/guests/_components/render-guests-screen');
  const guests = [guestRow(), guestRow({ rsvp_status: 'attending' } as never)];
  const list = await renderGuestsScreen({ guests, views: GUESTS_VIEWS });
  // (A segment's class carries `[&>b]:…`, so an attribute run is "no `<`", never "no `>`".)
  const segs = [...list.matchAll(/<a [^<]*?data-guests-seg="([a-z]+)"[^<]*?href="([^"]+)"/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(
    segs,
    GUESTS_VIEWS.map((v) => [v, guestsViewHref('e1', v)]),
    'the view row is not List · Map · Seats · March, each a link to its address',
  );
  assert.match(list, /data-guests-segmented=""/, 'the view row is not the shipped pill selector');
  assert.match(list, /data-guest-rows=""/, 'anti-vacuity: the List drew no rows');
  for (const view of GUESTS_MAKER_VIEWS) {
    const bodies = { seats: React.createElement('div', { 'data-shipped-maker': 'seats' }), march: React.createElement('div', { 'data-shipped-maker': 'march' }) };
    const html = await renderGuestsScreen({ guests, views: GUESTS_VIEWS, gview: view, bodies });
    // Only the view asked for is mounted on arrival — the other maker waits for its first switch (then is kept).
    const other = view === 'seats' ? 'march' : 'seats';
    assert.doesNotMatch(html, new RegExp(`data-shipped-maker="${other}"`), `${view}: the other maker is mounted before it is opened`);
    assert.match(html, new RegExp(`data-guests-view-body="${view}"[^>]*><div data-shipped-maker="${view}"`), `${view}: the page's maker is not drawn`);
    assert.match(html, new RegExp(`aria-current="page"[^<]*?data-guests-seg="${view}"`), `${view}: the row does not mark it`);
    assert.doesNotMatch(html, /data-guest-rows=""/, `${view}: the list is drawn under the maker`);
    assert.doesNotMatch(html, /data-guests-thumb=""/, `${view}: the List's thumb row is drawn under the maker`);
    assert.doesNotMatch(html, /data-guests-carousel=""/, `${view}: the summary carousel is drawn over the maker`);
  }
  const map = await renderGuestsScreen({ guests, views: GUESTS_VIEWS, gview: 'map' });
  assert.match(map, /data-guests-screen="map"/);
  assert.doesNotMatch(map, /data-guests-view-body=/, 'the Map draws a maker — it is the guest tree');
  // The page offers Seats by the type's seat rule and March by its entourage rule — and hands the shipped makers in.
  const page = read('app/dashboard/[eventId]/guests/page.tsx');
  assert.match(page, /v === 'seats'\s*\? surfaceEnabled\(eventProfile, 'seating'\)/);
  assert.match(page, /viewer\.isCouple && marchOffered\(/);
  assert.match(page, /<SeatingPage params=\{Promise\.resolve\(\{ eventId \}\)\} searchParams=\{Promise\.resolve\(\{ host: 'guests', seat: gview === 'seats' \? search\.seat : undefined \}\)\} \/>/);
  // 🗂 Both makers are streamed with the page (one load, no request on a switch) — handed in as `bodies`.
  assert.match(page, /bodies=\{bodies\}/);
  // …and a switch is a client switch: the view row's press is handled in place, the address follows (`replaceState`).
  const screen = read('app/dashboard/[eventId]/guests/_components/guests-screen.tsx');
  assert.match(screen, /onClick=\{onViewPress\(key\)\}\s*data-guests-seg=\{key\}/, 'a view press navigates (a server round trip) again');
  assert.match(screen, /window\.history\.replaceState\(window\.history\.state, '', guestsViewHref\(eventId, v\)\);/);
  assert.match(page, /<GuestsMarch eventId=\{eventId\} \/>/);
});

test('7 · Seats and March follow the Guests screen: the summary row, ONE mode dropdown, the thumb row, faces that open the card', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  // The summary row is the Guests carousel's own cards — and a count nobody could read is said, never a 0.
  const { ViewSummaryCards } = await import('../app/dashboard/[eventId]/guests/_components/view-summary-cards');
  const row = renderToStaticMarkup(
    React.createElement(ViewSummaryCards, {
      view: 'march',
      label: 'March summary',
      cards: [{ key: 'counts', label: 'Counts', tip: 'x', counts: [{ key: 'walks', word: 'Walks', value: 20 }, { key: 'out', word: 'Not walking', value: null, onPress: () => {} }] }],
    }),
  );
  assert.match(row, /data-snap-carousel=""/, 'the summary row is not the shared carousel');
  assert.match(row, /data-view-count="walks"[\s\S]*?20/);
  assert.match(row, /data-view-count="out"[\s\S]*?—[\s\S]*?couldn’t read/, 'an unread count reads as a number');
  assert.doesNotMatch(row, /<button[^>]*data-view-count="out"/, 'an unread count is still a door');
  // The march and the seat plan draw it (never the old plain line), from their own counts.
  const march = read('app/dashboard/[eventId]/launch/_components/details-march.tsx');
  assert.match(march, /\{guests \? \([\s\S]{0,300}?<ViewCountRow\s+view="march"/);
  assert.match(march, /value: outUnread \? null : shownOut\.length/, 'Not walking reads 0 over an unread tray');
  const ed = read('app/dashboard/[eventId]/seating/_components/seating-editor.tsx');
  assert.match(ed, /const seatSummary = inGuests \? \(\s*<ViewCountRow\s+view="seats"/);
  // ONE mode dropdown (List · 2D · 3D) in the head — the shared PickMenu, never a pill row; no desk segment in Guests.
  const phone = read('app/dashboard/[eventId]/seating/_components/seat-plan-phone.tsx');
  const pick = phone.slice(phone.indexOf('export function SeatPlanModePick('), phone.indexOf('export function GuestsSeatThumbRow('));
  assert.match(pick, /<PickMenu label="View"/);
  assert.match(ed, /view=\{inGuests \? <SeatPlanModePick view=\{studioView\} onView=\{onSelectView\} show3D=\{show3D\} \/> : undefined\}/);
  assert.match(ed, /\{isPhone \|\| inGuests \? null : \(\s*<CommandBar>/, 'the desk command bar (its pill segment) is drawn in Guests');
  // The thumb row holds the verbs — Auto arrange · Rules · + Table (and, on a phone, the people's door).
  const { GuestsSeatThumbRow } = await import('../app/dashboard/[eventId]/seating/_components/seat-plan-phone');
  const thumb = renderToStaticMarkup(
    React.createElement(GuestsSeatThumbRow, { onAutoArrange: () => {}, autoDisabled: false, autoBusy: false, rules: null, onAddTable: () => {}, addDisabled: false, people: { unseated: 9, onOpen: () => {} }, toast: null }),
  );
  for (const w of ['Auto arrange', 'Rules', 'Add a table', '9 to seat — open the people']) assert.ok(thumb.includes(w), `the thumb row lost “${w}”`);
  assert.match(thumb, /data-seat-plan-thumb=""[^>]*bottom-0/, 'the verbs are not at the foot');
  // List mode: each table a foldable header with its faces and one blank per free seat.
  const { SeatFacesList } = await import('../app/dashboard/[eventId]/seating/_components/seat-faces-list');
  const g = (id: string) => ({ id, name: `Guest ${id}`, initials: id.toUpperCase(), photo: null, color: '#999' });
  const list = renderToStaticMarkup(
    React.createElement(SeatFacesList, {
      units: [{ key: 't1', label: 'Table 1', sub: 'Round', seated: 2, capacity: 4, slots: [{ kind: 'face', guest: g('a'), tableId: 't1', seat: 0 }, { kind: 'face', guest: g('b'), tableId: 't1', seat: 1 }, { kind: 'blank', tableId: 't1', seat: 2 }, { kind: 'blank', tableId: 't1', seat: 3 }] }],
      unseated: [g('c')],
      pickedId: null,
      onFace: () => {},
      onBlank: () => {},
    }),
  );
  assert.match(list, /class="sn-acc-head"/, 'the list is not the house foldable header');
  assert.match(list, />Table 1<[\s\S]*?>2 of 4</);
  assert.equal((list.match(/data-seat-face="/g) ?? []).length, 3, 'a face is missing');
  assert.equal((list.match(/data-seat-blank=""/g) ?? []).length, 2, '"2 of 4" does not draw two blanks');
  assert.match(list, /aria-label="Guest a, Table 1, seat 1"/, 'a face is not named for a screen reader');
  // A face — on the plan AND in the list — opens the ONE guest card (the shipped sheet), with Remove · Swap.
  assert.match(ed, /else if \(inGuests\) tapFace\(occupant\.guest_id\);/, 'a face on the 2D plan does not open the card');
  assert.match(ed, /<SeatFacesList units=\{faceUnits\}[^>]*onFace=\{tapFace\}/, 'a face in the list does not open the card');
  assert.match(ed, /<GuestCardSheet\s+eventId=\{eventId\}\s+person=\{\{ id: faceCard\.id, name: faceCard\.name \}\}\s+open=\{SHIPPED_GUEST_CARD\.seats\}/);
  assert.match(ed, /label="Remove"/);
  assert.match(ed, /label=\{faceCard\.seated \? 'Swap' : 'Seat'\}/);
});

test('8 · Seats and March count in ONE fixed row (no swipe) — the view’s forward step is its last tile', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ViewCountRow } = await import('../app/dashboard/[eventId]/guests/_components/view-summary-cards');
  const row = renderToStaticMarkup(
    React.createElement(ViewCountRow, {
      view: 'march',
      tiles: [
        { key: 'walks', word: 'walks', value: 20 },
        { key: 'walking', word: 'walking', value: 34 },
        { key: 'out', word: 'not walking', value: null, onPress: () => {} },
        { key: 'preview', word: 'Preview', main: true, icon: React.createElement('svg'), disabled: true, about: 'coming' },
      ],
    }),
  );
  assert.doesNotMatch(row, /data-snap-carousel/, 'the counts swipe again');
  assert.equal((row.match(/data-view-tile="/g) ?? []).length, 4, 'not four tiles in one row');
  assert.match(row, /grid-template-columns:repeat\(4, minmax\(0, 1fr\)\)/, 'the tiles are not one row of equal widths');
  assert.match(row, /data-view-tile="out"[^>]*>[\s\S]*?—[\s\S]*?couldn’t read/, 'an unread count reads as a number');
  assert.match(row, /disabled=""[^>]*data-view-tile="preview"|data-view-tile="preview"[^>]*disabled/, 'Preview claims to work before it ships');
  // The views draw it: March's four, Seats' four with ✨ Auto arrange as the forward tile (and no second one in the thumb row).
  const march = read('app/dashboard/[eventId]/launch/_components/details-march.tsx');
  for (const k of ['walks', 'walking', 'out', 'preview']) assert.match(march, new RegExp(`key: '${k}'`), `March lost its ${k} tile`);
  // No walk preview ships yet: the tile stays, disabled, saying so — never a button that does nothing.
  assert.match(march, /key: 'preview', word: 'Preview', main: true, icon: <Play[^>]*\/>, disabled: true, about: 'The walk preview is coming'/);
  const ed = read('app/dashboard/[eventId]/seating/_components/seating-editor.tsx');
  for (const k of ['seated', 'unseated', 'tables', 'auto']) assert.match(ed, new RegExp(`key: '${k}'`), `Seats lost its ${k} tile`);
  assert.match(ed, /onPress: runAutoArrange,/);
  assert.match(ed, /<GuestsSeatThumbRow\s+pop=\{seatPop\}\s+showAuto=\{false\}/, 'Auto arrange is drawn twice');
});
