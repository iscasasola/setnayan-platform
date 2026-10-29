/**
 * the-seat-plan-moves-into-details.test.ts — Details part 4 (owner 2026-09-28/29):
 *
 *   · DECISION_LOG "THE SEAT PLAN MOVES INTO DETAILS AND WEARS THE THREE
 *     COLUMNS": the place's elements LEFT, the plan MIDDLE, the guests RIGHT —
 *     the seating editor's logic reused whole ("extract the shell, don't fork
 *     the logic");
 *   · "THE SEAT PLAN IS LIVE BEHIND ONE DOOR — GUESTS SEE THIS NOW": one
 *     switch, on = `publishSeating`, off = hide the seats again (owner answer
 *     8, "yes add it"); faster seating — "Seat at… ▾", tap an empty seat, "+
 *     Seat next unseated";
 *   · "3D SEAT PLANNING STAYS FREE" — the lab in the middle part, never a page away;
 *   · "THE GUEST LIST KEEPS PEOPLE…" — Arrange the room leaves the Guest list.
 *
 * 🗂 R4 (owner 2026-10-27/28, DECISION_LOG "GUESTS = LIST · MAP · SEATS · MARCH"; *"3D plan: yes, inside Seats"*): the
 * three parts and every rule below MOVED WHOLE to Guests › Seats (`host: 'guests'`, `seat-plan-in-guests.tsx` holds the
 * two side columns); the Maker keeps only a door. The column rules are unchanged; the wiring tests say the new home.
 *
 * The RULES (what each column lists) are executed; the WIRING (which shell the
 * one editor draws, which actions the door calls) is read from the source with
 * comments stripped, so a docblock can never satisfy it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { GENERIC_PROFILE, TRAVEL_PROFILE, WAKE_PROFILE, WEDDING_PROFILE, type EventTypeProfile } from '@/lib/event-type-profile';
import {
  DETAILS_ITEM_GROUPS,
  detailsDoorHref,
  detailsItemApplies,
  detailsItemLayout,
  isDetailsItemKey,
} from '@/lib/maker-details-items';
import {
  nextUnseatedGuest,
  parseSeatPlanPiece,
  seatAtChoices,
  seatPlanGuestSections,
  seatPlanPieceKey,
  seatPlanPlaceRows,
  type SeatPlanGuest,
} from '@/lib/seat-plan-details';

const APP = join(process.cwd(), 'app', 'dashboard', '[eventId]');
const code = (...p: string[]) => stripComments(readFileSync(join(APP, ...p), 'utf8'));
const ctx = (profile: EventTypeProfile) => ({ profile, solemn: false });

/* ── the item ─────────────────────────────────────────────────────────────── */

test('Seat plan is the last item of Story & plans, drawn as a filled middle part', () => {
  assert.ok(isDetailsItemKey('seating'));
  /* 🗂 2026-10-06 ("EVENT DETAILS IS REBUILT"): an item with an editor of its own — Story & plans' last. */
  const story = DETAILS_ITEM_GROUPS.find((g) => g.group === 'story')!;
  assert.equal(story.keys.at(-1), 'seating', 'the Seat plan is not the last item of Story & plans');
  assert.equal(detailsItemLayout('seating'), 'fill', 'the plan must fill the middle part (its guests are the right one)');
  assert.equal(detailsDoorHref('E', 'seating', { seat: 'list' }), '/dashboard/E/launch?tool=details&item=seating&seat=list');
});

test('only a type WITH a seat plan gets the item — the seat rooms’ own rule', () => {
  assert.equal(detailsItemApplies('seating', ctx(WEDDING_PROFILE)), true);
  assert.equal(detailsItemApplies('seating', ctx(WAKE_PROFILE)), WAKE_PROFILE.enabledSurfaces.includes('seating'));
  assert.equal(detailsItemApplies('seating', ctx(GENERIC_PROFILE)), true);
  // Travel has no seat plan (its profile drops 'seating') — so no item.
  assert.equal(TRAVEL_PROFILE.enabledSurfaces.includes('seating'), false);
  assert.equal(detailsItemApplies('seating', ctx(TRAVEL_PROFILE)), false);
});

/* ── LEFT: the place ──────────────────────────────────────────────────────── */

const placeInput = {
  tables: [
    { id: 't1', label: 'Sponsors 1', shape: 'Long banquet', seated: 6, seats: 8 },
    { id: 't2', label: 'Table 2', shape: 'Round', seated: 0, seats: 1 },
  ],
  dance: true,
  entrance: { enabled: true, walkThrough: false },
  service: false,
  cocktail: { enabled: false, label: 'Cocktail area' },
  booths: [{ id: 'b1', label: 'Photo Booth' }],
  signs: [{ id: 's1', label: 'Restrooms' }],
};

test('the navigator lists the tables first, then only the elements that are ON the plan', () => {
  const rows = seatPlanPlaceRows(placeInput);
  assert.deepEqual(
    rows.map((r) => r.key),
    ['table:t1', 'table:t2', 'place:stage', 'place:dance', 'place:entrance', 'booth:b1', 'sign:s1'],
  );
  assert.equal(rows[0]!.sub, '6/8 seats · Long banquet');
  assert.equal(rows[1]!.sub, '0/1 seat · Round');
  // An element that is not on the floor would select nothing — so it is not a row.
  assert.ok(!rows.some((r) => r.key === 'place:service' || r.key === 'place:cocktail'));
  const walk = seatPlanPlaceRows({ ...placeInput, entrance: { enabled: true, walkThrough: true } });
  assert.equal(walk.find((r) => r.key === 'place:entrance')!.label, 'Walk-through');
});

test('a row and a selection on the plan are one key, both ways', () => {
  for (const sel of [
    { table: 't9', marker: null },
    { table: null, marker: { kind: 'dance' as const, id: null } },
    { table: null, marker: { kind: 'booth' as const, id: 'b1' } },
    { table: null, marker: { kind: 'sign' as const, id: 's1' } },
  ]) {
    assert.deepEqual(parseSeatPlanPiece(seatPlanPieceKey(sel)), sel);
  }
  assert.equal(seatPlanPieceKey({ table: null, marker: null }), null);
  assert.deepEqual(parseSeatPlanPiece('place:ballroom'), { table: null, marker: null });
  assert.deepEqual(parseSeatPlanPiece('guests'), { table: null, marker: null });
});

/* ── RIGHT: the guests ────────────────────────────────────────────────────── */

const g = (id: string, over: Partial<SeatPlanGuest> = {}): SeatPlanGuest => ({
  guest_id: id,
  name: id,
  side: 'both',
  group_id: null,
  rsvp_status: 'attending',
  seated_table_id: null,
  ...over,
});
const GUESTS: SeatPlanGuest[] = [
  g('Ana', { side: 'bride', seated_table_id: 't1', group_id: 'fam' }),
  g('Ben', { side: 'groom' }),
  g('Cora', { side: 'groom', seated_table_id: 't1' }),
  g('Dan', { rsvp_status: 'declined' }),
  g('Ella', { side: 'bride', rsvp_status: 'pending' }),
];
const SIDES = [
  { side: 'groom' as const, label: "Groom's side" },
  { side: 'bride' as const, label: "Bride's side" },
  { side: 'both' as const, label: 'Both sides' },
];

test('Unseated FIRST, then the seated by side — a guest who declined is never work left', () => {
  const { sections, notComing } = seatPlanGuestSections(GUESTS, { query: '', onlyUnseated: false, sides: SIDES, groups: [] });
  assert.deepEqual(
    sections.map((s) => [s.key, s.guestIds]),
    [
      ['unseated', ['Ben', 'Ella']],
      ['side:groom', ['Cora']],
      ['side:bride', ['Ana']],
    ],
  );
  assert.equal(sections[0]!.unseated, true);
  assert.equal(notComing, 1, 'the guest who declined is counted, not listed as unseated');
});

test('no two named people: the seated are listed by GROUP (no side words at all)', () => {
  const { sections } = seatPlanGuestSections(GUESTS, {
    query: '',
    onlyUnseated: false,
    sides: null,
    groups: [{ group_id: 'fam', label: 'Family' }],
  });
  assert.deepEqual(sections.map((s) => s.label), ['Unseated', 'Family', 'No group']);
  assert.ok(!sections.some((s) => /side|bride|groom/i.test(s.label)));
});

test('the search filters every section; "Only unseated" drops the seated', () => {
  const only = seatPlanGuestSections(GUESTS, { query: '', onlyUnseated: true, sides: SIDES, groups: [] });
  assert.deepEqual(only.sections.map((s) => s.key), ['unseated']);
  const q = seatPlanGuestSections(GUESTS, { query: 'an', onlyUnseated: false, sides: SIDES, groups: [] });
  assert.deepEqual(q.sections.map((s) => [s.key, s.guestIds]), [['unseated', []], ['side:bride', ['Ana']]]);
});

test('"+ Seat next unseated" seats the name at the top of Unseated; "Seat at… ▾" offers only tables with room', () => {
  assert.equal(nextUnseatedGuest(GUESTS)?.guest_id, 'Ben');
  assert.equal(nextUnseatedGuest(GUESTS, 'Ben')?.guest_id, 'Ella', 'the picked guest is skipped');
  assert.equal(nextUnseatedGuest(GUESTS.filter((x) => x.seated_table_id || x.rsvp_status === 'declined')), null);
  assert.deepEqual(
    seatAtChoices([
      { id: 't1', label: 'Sponsors 1', free: 2 },
      { id: 't2', label: 'Table 2', free: 0 },
    ]),
    [{ id: 't1', label: 'Sponsors 1 · 2 free' }],
  );
});

/* ── the wiring — one editor, re-split ────────────────────────────────────── */

test('the seating page lands everyone on Guests › Seats (R4), and draws the SAME editor there', () => {
  const page = code('seating', 'page.tsx');
  assert.match(
    page,
    /if \(!inMaker\) redirect\(guestsViewHref\(eventId, 'seats', \{ seat: viewParam === 'list' \? 'list' : null \}\)\);/,
    '/seating no longer lands on Guests › Seats',
  );
  // ONE editor element for both shells — the props are never listed twice.
  assert.equal((page.match(/<SeatingEditor\b/g) ?? []).length, 1, 'a second <SeatingEditor> — the props now drift');
  assert.match(page, /editorFor\(seatParam === 'list' \? 'list' : 'plan', \{\s*lab,\s*sides,/);
  // 3D is the lab page itself, streamed in only while it is the view.
  assert.match(page, /seatParam === '3d'[\s\S]{0,260}<SeatingLabPage params=\{Promise\.resolve\(\{ eventId \}\)\} searchParams=\{Promise\.resolve\(\{ maker: '1' \}\)\}/);
});

test('in Details the editor draws no panel column, no fixed drawer, no fixed sheet — its lists go to the Maker’s parts', () => {
  const ed = code('seating', '_components', 'seating-editor.tsx');
  assert.match(ed, /\{isNarrow \|\| details \? null : \(/, 'the 320px panel is drawn inside Details');
  assert.match(ed, /\{isNarrow && !details \? \(/, 'the fixed bottom drawer is drawn inside Details');
  assert.match(ed, /const sheetVariant: 'sheet' \| 'inline' = details \? 'inline' : 'sheet';/, 'a fixed sheet over the Maker');
  assert.doesNotMatch(ed, /variant=\{isPhone \? 'sheet'/, 'a dock variant bypasses the Details rule');
  assert.match(ed, /<SeatPlanPortal name="place" on>\s*\{placeList\}/, 'the place is not drawn into the navigator');
  // The right part's JSX is named a NODE (\`guestsNode\`, train m): \`guestsPart\` read as a guest COUNT to T4.
  /* In the new Maker's Studio on a phone the guests are the pull-up sheet over the map instead (owner 2026-10-08). */
  assert.match(ed, /<SeatPlanPortal name="guests" on=\{!peopleInSheet\}>\s*\{guestsNode\}/, 'the guests are not drawn into the right part');
  assert.match(ed, /<SeatingFrame fill=\{details !== null\}>/);
  assert.match(ed, /<FrameBody single=\{details !== null\}>/);
  // Every existing verb stays in the ONE command bar (Add · Auto Arrange · Share & print).
  for (const verb of ['label="Add"', 'label="Share & print"', 'Auto Arrange']) {
    assert.ok(ed.includes(verb), `the command bar lost ${verb}`);
  }
  // Details puts the slots where those columns are.
  const md = code('launch', '_components', 'maker-details.tsx');
  assert.match(md, /editors\.seating = <SeatPlanSlot name="guests"/);
  assert.match(md, /seating: <SeatPlanSlot name="place"/);
});

test('"Show guests their seats early" opens with publishSeating and closes with the SHIPPED unpublishSeating (+0 actions)', () => {
  const ed = code('seating', '_components', 'seating-editor.tsx');
  const flip = ed.slice(ed.indexOf('const flipDoor = '), ed.indexOf('const doorStrip = '));
  assert.ok(flip.length > 0, 'the door switch is gone');
  assert.match(flip, /if \(open\) await publishSeating\(fd\);\s*else await unpublishSeating\(fd\);/);
  /* RE-AIMED 2026-10-09 (the Seat plan's chrome wears the templates): the switch is the Form row's `SwitchRow` — the same `flipDoor`, drawn by the template. */
  assert.match(ed, /<SwitchRow\s+name="Show guests their seats early"[\s\S]{0,1200}on=\{doorOpen\}\s+onChange=\{\(open\) => flipDoor\(open\)\}/);
  // The one gate guests' seats open on, and the only thing the closing half clears.
  const actions = code('seating', 'actions.ts');
  const un = actions.slice(actions.indexOf('export async function unpublishSeating'));
  assert.match(un.slice(0, 1200), /\.update\(\{ published_at: null,/);
  // 2026-09-30 (owner: "seatplan will show on the date of the event"): the door
  // is now "Show guests their seats early", and printing the table signs no
  // longer opens it — it stamps the signs alone (`stampTableSigns`).
  const print = ed.slice(ed.indexOf('const publishAndPrint = '), ed.indexOf('const renameTable = '));
  assert.match(print, /await stampTableSigns\(fd\);/);
  assert.doesNotMatch(stripComments(print), /setDoorOpen\(true\)|publishSeating\(/, 'printing signs must not open seats early');
});

test('3D is drawn IN the middle part and never leaves Details; it does not drop the 2D editor’s lock', () => {
  const ed = code('seating', '_components', 'seating-editor.tsx');
  /* 🗂 R4: in Guests the room is mounted when first opened and kept (hidden while 2D or List shows). */
  assert.match(ed, /\{details\?\.lab && \(!inGuests \|\| seen3d\) \? \([\s\S]{0,300}?<div data-seat-plan-3d="" hidden=\{!in3d\}/);
  const view = ed.slice(ed.indexOf('const onSelectView = '), ed.indexOf('const onSelectView = ') + 900);
  /* 🗂 R4: in Guests the 3D room is a client switch over the room streamed with the page (`go3d`), no new request. */
  assert.match(view, /if \(details\) go3d\(\);/);
  assert.match(ed, /const go3d = \(\) => \{\s*if \(inGuests\) \{\s*setShow3d\(true\);\s*setSeen3d\(true\);\s*window\.history\.replaceState/);
  const lab = stripComments(readFileSync(join(APP, 'seating', 'lab', '_components', 'seating-lab-3d.tsx'), 'utf8'));
  assert.match(lab, /useSeatingLock\(eventId, me\.name, null, \{ releaseOnUnmount: !inMaker \}\)/);
  /* 🗂 R4: inside Guests › Seats the room draws no mode switch of its own — the pinned row's ONE dropdown (List · 2D · 3D)
     is the way out, a client switch; standalone, its segment leaves for Guests › Seats. */
  assert.match(lab, /viewSegment=\{\s*inMaker \? null : \(/, 'the room draws a second mode switch inside Guests › Seats');
  assert.match(lab, /router\.push\(guestsViewHref\(eventId, 'seats'\)\)/);
});

test('the launch page draws only the door to Guests › Seats (R4), only where the type has a seat plan', () => {
  const launch = code('launch', 'page.tsx');
  assert.match(launch, /if \(detailsItemApplies\('seating', eventContext\)\) \{/);
  assert.match(launch, /page: <GuestsViewDoor eventId=\{eventId\} view="seats" \/>/);
  assert.doesNotMatch(launch, /<CoupleSeatingPage/, 'the Maker draws a second copy of the seat plan');
  assert.match(launch, /seatPlan=\{seatPlan\}/);
});

test('the Indoor Blueprint lives in the Seat plan — its shipped studio in the right part, its old page lands there', () => {
  // Owner-approved 2026-09-29 (via the controller): "it's the same room".
  const ed = code('seating', '_components', 'seating-editor.tsx');
  assert.match(ed, /onPick=\{\(\) => pickPlace\(SEAT_PLAN_MAP_PIECE\)\}/, 'the Guests’ map is not a piece of the Seat plan');
  const map = ed.slice(ed.indexOf("guestsMode === 'map' && !detailsTable ? ("), ed.indexOf(') : detailsTable ? ('));
  assert.match(map, /<BlueprintStudio[\s\S]*saveAction=\{async \(fd\) => \{\s*await saveEntrance\(fd\);/, 'not the shipped studio and its own save');
  assert.doesNotMatch(map, /href=/, 'the Guests’ map links out of the Maker');
  const page = code('studio', 'indoor-blueprint', 'page.tsx');
  assert.match(page, /redirect\(guestsViewHref\(eventId, 'seats', \{ seat: 'map' \}\)\)/);
  assert.match(code('seating', 'page.tsx'), /part: seatParam === 'map' \? 'map' : null/);
});
