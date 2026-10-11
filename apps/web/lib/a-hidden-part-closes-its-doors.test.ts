/**
 * 👁 A PART THE COUPLE HID ON A STAGE IS HIDDEN EVERYWHERE A GUEST COULD MEET IT ("What guests see", pass 2).
 *
 * `fixed-rows-are-real-boxes.test.ts` flips every box on the real page's BODY. A guest meets a part in more places than
 * the body, and each of them is drawn from facts the body never sees:
 *
 *   · the page's own frame — the Me slot's seat line, the Event Bar's camera and photos (`app/[slug]/page.tsx`);
 *   · the part's own page, for a guest who kept the address (`/pabuya`, `/find-seat`, `/find-my-table`, `/everyone`);
 *   · the Day hub, which draws its own seat, gift, live and camera doors (`/hub`);
 *   · the rail of doors every sub-page carries (`_lib/room-links.server.ts`), and the live wall's data (`/live-wall`).
 *
 * Every one of them asks the ONE reading (`partsHiddenOn`, lib/what-guests-see.ts) — through
 * `_lib/part-door.server.ts`, which reads the PUBLISHED hero row and nothing else — and takes the exit the page already
 * had for "this part is off". No page says anything new to a guest.
 *
 * ⚠ WHAT THIS FILE CAN AND CANNOT SEE. These pages are server routes that read a database; none can be rendered here,
 * and `server-only` keeps the helper from being imported at all. So tests 2–5 read SOURCE: they prove each door ASKS,
 * not that the page then draws nothing. Test 1 is the behaviour (the rail's pure half). The drawing itself is proven on
 * the body by the other file, and on these pages only by a walk in a browser.
 *
 * Each pin was run RED once by removing its gate (2026-10-11): the seat line → 2 · the gift page's exit → 3 ·
 * the hub's gift door → 4 · the rail's seat door → 1 and 5 · the helper reading the draft instead → 5.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveRoomLinks, type RoomLinksInput } from '../app/[slug]/_lib/room-links';
import { stripComments } from './strip-comments';

const src = (rel: string) => stripComments(readFileSync(join(__dirname, '..', rel), 'utf8'));

test('1 · the rail: a seat plan that is withheld, and a gift count of none, draw no door', () => {
  const open: RoomLinksInput = {
    slug: 'fx', current: null, guestToken: null, seatingSurfaceEnabled: true, seatingPublished: true,
    pabuyaRouteEnabled: true, enabledEgiftCount: 2, pabuyaViewerAllowed: true, recapPublished: false, liveHubOpen: false,
  };
  const keys = (i: RoomLinksInput) => resolveRoomLinks(i).map((l) => l.key);
  assert.ok(keys(open).includes('seat') && keys(open).includes('gifts'), 'anti-vacuity: the rail draws both doors to begin with');
  // What `loadRoomLinks` hands over when the couple hid them — the two facts below, and nothing else.
  assert.deepEqual(keys({ ...open, seatingPublished: false }).filter((k) => k === 'seat' || k === 'venue'), []);
  assert.ok(!keys({ ...open, enabledEgiftCount: 0 }).includes('gifts'));
  const RAIL = src('app/[slug]/_lib/room-links.server.ts');
  assert.match(RAIL, /seatingPublished: facts\.seatingPublished && !partsOff\.has\('seat'\)/);
  assert.match(RAIL, /enabledEgiftCount: partsOff\.has\('gifts'\) \? 0 : facts\.enabledEgiftCount/);
  // A failed read withholds both — it never draws a door the couple may have closed, and never throws the rail away.
  assert.match(RAIL, /hiddenPartDoors\(admin, event\.event_id\)\.catch\(\(\): ReadonlySet<FixedPart> => new Set<FixedPart>\(\['seat', 'gifts'\]\)\)/);
});

test("2 · the page's frame: the seat line, the bar's camera and the photos door ask the one reading", () => {
  const PAGE = src('app/[slug]/page.tsx');
  assert.match(PAGE, /const partsOffHere = partsHiddenOn\(widgets, lifecyclePhase, phasesEnabled\);/);
  // The seat fact is withheld where the page receives it, so Me's seat line and the body read one gated name.
  assert.match(PAGE, /seatPassActive: seatPassHeld,/);
  assert.match(PAGE, /const seatPassActive = seatPassHeld && !partsOffHere\.has\('seat'\);/);
  assert.equal((PAGE.match(/seatPassHeld/g) ?? []).length, 2, 'the ungated seat fact is read somewhere else');
  assert.match(PAGE, /\{seatPassActive \? \(\s*<SeatDoorLine/);
  assert.match(PAGE, /cameraReady=\{guestRollCameraReady && !partsOffHere\.has\('camera'\)\}/);
  assert.match(PAGE, /papicGuestActive=\{papicGuestActive && !partsOffHere\.has\('camera'\)\}/);
  assert.match(PAGE, /const galleryCountHere = partsOffHere\.has\('photosofyou'\) \? 0 : \(guestLiveGallery\?\.total \?\? 0\);/);
  // Both doors to the guest's own photos — the bar's and the Me section's.
  assert.match(PAGE, /const myPhotosDoor = partsOffHere\.has\('photosofyou'\) \? null : `\/papic\/me\/\$\{guest\.qr_token\}`;/);
  assert.equal((PAGE.match(/[pP]hotosHref=\{photosLeftThePage \? myPhotosDoor : null\}/g) ?? []).length, 2);
  assert.equal((PAGE.match(/`\/papic\/me\/\$\{guest\.qr_token\}`/g) ?? []).length, 1, 'a photos door that does not ask');
});

test("3 · the part's own page takes the exit it already had", () => {
  // E-Gifts: "there is no gift page" — the same answer as "Accept gifts? — No".
  assert.match(src('app/[slug]/pabuya/page.tsx'), /if \(await partDoorHidden\(createAdminClient\(\), event\.event_id, 'gifts'\)\) notFound\(\);/);
  // Find your seat: back to the event's page, before any table is read.
  const FIND = src('app/[slug]/find-seat/page.tsx');
  assert.match(FIND, /if \(await partDoorHidden\(admin, event\.event_id, 'seat'\)\) redirect\(`\/\$\{slug\}`\);/);
  const MINE = src('app/[slug]/find-my-table/page.tsx');
  assert.match(MINE, /if \(await partDoorHidden\(admin, event\.event_id, 'seat'\)\) redirect\(`\/\$\{slug\}`\);\s*if \(!\(await guestsMaySeeSeatsFor\(/);
  for (const [name, page] of [['find-seat', FIND], ['find-my-table', MINE]] as const) {
    const gate = page.indexOf("partDoorHidden(admin, event.event_id, 'seat')");
    const read = page.search(/\.from\('(seating_tables|event_tables|table_assignments|guests)'\)/);
    assert.ok(read === -1 || gate < read, `${name}: a table or a guest is read before the door is asked`);
  }
  // Entourage: the page keeps its own "hasn't been shared yet" line — its state for no entourage.
  const ALL = src('app/[slug]/everyone/page.tsx');
  assert.match(ALL, /const groups = \(await partDoorHidden\(admin, event\.event_id, 'entourage'\)\) \? \[\] : castGroups;/);
  assert.match(ALL, /\{groups\.length > 0 \? \(\s*<EntourageSection groups=\{groups\} \/>/);
  // Live: the wall's data closes with the block — and closes on a failed read.
  assert.match(src('app/[slug]/live-wall/route.ts'), /if \(await partDoorHidden\(admin, event\.event_id, 'live'\)\.catch\(\(\) => true\)\) \{\s*return NextResponse\.json\(\{ error: 'not_found' \}, \{ status: 404 \}\);/);
});

test('4 · the Day hub: its seat card, gift door, stream, wall and camera ask — at the stage the hub resolved', () => {
  const HUB = src('app/[slug]/hub/page.tsx');
  assert.match(HUB, /const partsOff = await hiddenPartDoors\(createAdminClient\(\), event\.event_id, lifecyclePhase\);/);
  assert.match(HUB, /const seatingPublished = seatingSurfaceOn && !partsOff\.has\('seat'\)/);
  assert.match(HUB, /\{guest && partsOff\.has\('seat'\) \? null : guest \? \(/);
  assert.match(HUB, /enabledEgiftCount: partsOff\.has\('gifts'\) \? 0 : enabledEgiftCount,/);
  assert.match(HUB, /if \(partsOff\.has\('live'\)\) watchEmbed = null;/);
  assert.match(HUB, /if \(partsOff\.has\('live'\)\) liveWall = null;/);
  assert.match(HUB, /const candidActive = !partsOff\.has\('camera'\) && \(guest \? papicGuestOwned : isLive && papicGuestOwned\);/);
  // The reading is taken before any of the facts it withholds is computed.
  const at = HUB.indexOf('const partsOff = await hiddenPartDoors(');
  for (const fact of ['let watchEmbed', 'const candidActive', 'const seatingPublished', 'const doorways = resolveGuestDoorways(']) {
    assert.ok(at > 0 && at < HUB.indexOf(fact), `the hub computes ${fact} before it asks`);
  }
});

test('5 · the door helper: the PUBLISHED hero row, the one reading, and a failed read is never an answer', () => {
  const DOOR = src('app/[slug]/_lib/part-door.server.ts');
  assert.match(DOOR, /guestRead\('part door \(hero row\)', \(\) =>\s*admin\s*\.from\('invitation_widgets'\)\s*\.select\('config_json'\)\s*\.eq\('event_id', eventId\)\s*\.eq\('widget_type', 'hero'\)/);
  assert.doesNotMatch(DOOR, /hub_draft|event_hub_drafts|overlayHubDraftWidgets|readHubDraft/, 'a draft never reaches a guest');
  assert.equal((DOOR.match(/return partsHiddenOn\(widgets, /g) ?? []).length, 2);
  // Both reads are the guest side's one read: retried through a blip, and a failure THROWS (lib/guest-read.ts) —
  // never a bare `const { data } = await admin…`, which answers a failed read as "nothing stored".
  assert.equal((DOOR.match(/guestRead\('part door \(/g) ?? []).length, 2, 'a read of the door that can fail silently');
  assert.equal((DOOR.match(/admin\s*\.from\(/g) ?? []).length, 2);
  // The stage is the event's: the couple's pin, else the clock, then the solemn adjustment — the page's composition.
  assert.match(DOOR, /solemnAdjustedPhase\(\s*manualLaunchPhase\(e\.launch_mode, e\.manual_phase\) \?\?\s*getLifecyclePhase\(/);
  // The common case costs one read: nothing stored returns before the event is asked for.
  assert.ok(DOOR.indexOf('return NO_PART;') < DOOR.indexOf(".from('events')"));
});
