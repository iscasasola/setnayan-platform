/**
 * story-room.test.ts — the lens tells the truth about the room, and never a
 * name.
 *
 * `08` step 2.3's acceptance criteria, in full: a ceremony minute shows rows, a
 * roaming event shows no plan, and no name appears in the seating markup at
 * all. The markup half lives in `the-room-never-names-anyone.test.ts` (it has
 * to read the components); this file is the arithmetic.
 *
 * ── WHAT THESE GUARDS HAD TO AVOID BEING ───────────────────────────────────
 * A cheaper proxy would be to assert "the reception state exists" or "the file
 * mentions the schedule". Both go green while the rule is broken — the trap
 * this repo has now paid for twice (a threshold guard passed when a sabotage
 * DELETED one of four arms; a mentions-the-day-window guard passed when a
 * sabotage removed one query's lower bound). So every state is DERIVED from a
 * real schedule and asserted by name, and the two rules that matter most —
 * owner lock 6 and the no-names blocker — are checked by sabotaging the input
 * and confirming the answer changes.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';

import type { VenueBlock } from './story-spine';
import {
  EMPTY_ROOM,
  SMALL_COUNTS_ARE_A_VERDICT,
  heatClassOf,
  heatWorthShowing,
  lensNote,
  lensStateAt,
  lensStateLabel,
  loudestTable,
  readRoomSnapshot,
  roomSnapshotOf,
  seatsAreShown,
  type LensState,
  type RoomTable,
  type StoryRoom,
} from './story-room';

/* A real Manila wedding day, as `event_schedule_blocks` stores it. */
const DAY = Date.UTC(2026, 1, 14); // 2026-02-14
const at = (h: number, m = 0) => DAY + (h - 8) * 3_600_000 + m * 60_000; // Manila → UTC

const BLOCKS: VenueBlock[] = [
  {
    label: 'Getting ready',
    blockType: 'pre',
    startMs: at(11),
    endMs: at(12, 30),
    location: 'the suite',
    vendorNames: [],
  },
  {
    label: 'Ceremony',
    blockType: 'ceremony',
    startMs: at(14),
    endMs: at(15, 30),
    location: 'on the lawn',
    vendorNames: [],
  },
  {
    label: 'Golden hour',
    blockType: 'cocktails',
    startMs: at(15, 30),
    endMs: at(17, 30),
    location: 'the lawn',
    vendorNames: [],
  },
  {
    label: 'Reception',
    blockType: 'reception',
    startMs: at(17, 30),
    endMs: at(22, 30),
    location: 'the long tables',
    vendorNames: [],
  },
];

const TABLES: RoomTable[] = [
  { id: 't1', label: '1', xPct: 20, yPct: 30, shape: 'round' },
  { id: 't7', label: '7', xPct: 20, yPct: 70, shape: 'round' },
  { id: 't12', label: 'Crew', xPct: 50, yPct: 88, shape: 'long_banquet' },
];

const ROOM: StoryRoom = {
  seatingSurface: true,
  roaming: false,
  tables: TABLES,
  seatsAssigned: true,
  drawnAtMs: DAY - 33 * 86_400_000, // drawn 33 days out, as the road entry says
  dance: { xPct: 40, yPct: 45, wPct: 22, hPct: 14 },
  stage: { xPct: 33, yPct: 8, wPct: 34, hPct: 6 },
};

/* ══════════════════════════════════════════════════════════════════════════
   THE FIVE STATES
   ══════════════════════════════════════════════════════════════════════════ */

test('each of the five states is reached by the thing that actually causes it', () => {
  const cases: Array<[string, number, StoryRoom, LensState]> = [
    [
      'a kind of day with no seating surface — a date, a hangout',
      at(19),
      { ...ROOM, seatingSurface: false },
      'no_venue',
    ],
    [
      'a celebration that moves — travel is roaming',
      at(19),
      { ...ROOM, roaming: true },
      'no_venue',
    ],
    ['nobody ever drew a room', at(19), { ...ROOM, tables: [] }, 'not_built'],
    ['a road minute, before the room was drawn', DAY - 90 * 86_400_000, ROOM, 'not_built'],
    ['getting ready — the room exists, nobody is in it', at(11, 30), ROOM, 'designed'],
    ['the ceremony', at(14, 45), ROOM, 'ceremony'],
    ['golden hour, between the two', at(16), ROOM, 'designed'],
    ['the reception', at(19, 12), ROOM, 'reception'],
    [
      'the reception, but nobody was ever seated',
      at(19, 12),
      { ...ROOM, seatsAssigned: false },
      'designed',
    ],
    ['after the last block', at(23, 30), ROOM, 'designed'],
  ];
  for (const [label, ms, room, expected] of cases) {
    assert.equal(lensStateAt(ms, BLOCKS, room), expected, label);
  }
});

test('a room with no run of show at all is designed, never a reception', () => {
  // `05` §4: the venue's phases come from the schedule block in use. With no
  // blocks there IS no block in use, and inventing a reception from the hour
  // would be exactly the clock threshold owner lock 6 forbids.
  assert.equal(lensStateAt(at(19, 12), [], ROOM), 'designed');
});

/* ══════════════════════════════════════════════════════════════════════════
   OWNER LOCK 6 — SABOTAGED, THEN CONFIRMED
   ══════════════════════════════════════════════════════════════════════════ */

test('tables are shown ONLY while the reception venue is in use', () => {
  /*
    The lock, stated as arithmetic over the whole day rather than at a couple of
    sampled instants — a two-point check would pass an implementation that
    lights the tables from noon.

    Every ten minutes from 8 AM to midnight: a table may appear if and ONLY if
    the couple's own run of show has a seated block running.
  */
  let shown = 0;
  let hidden = 0;
  for (let h = 8; h < 24; h += 1) {
    for (let m = 0; m < 60; m += 10) {
      const ms = at(h, m);
      const inReception = ms >= at(17, 30) && ms < at(22, 30);
      const state = lensStateAt(ms, BLOCKS, ROOM);
      assert.equal(
        seatsAreShown(state),
        inReception,
        `${h}:${String(m).padStart(2, '0')} — the run of show says ${inReception ? 'reception' : 'no seated block'}, the lens says ${state}`,
      );
      if (seatsAreShown(state)) shown += 1;
      else hidden += 1;
    }
  }
  assert.ok(shown > 0 && hidden > 0, `measured ${shown} seated and ${hidden} unseated minutes`);
});

test('SABOTAGE — moving the seated block moves the seats with it', () => {
  /*
    The check above could pass an implementation that ignores the schedule and
    hard-codes 5:30 PM, because the fixture's reception happens to start then.
    So the block is MOVED and the answer must move with it. Counts printed in
    the failure message; if this ever passes with the two counts equal, the lens
    is reading a clock and not the couple's day.
  */
  const moved: VenueBlock[] = BLOCKS.map((b) =>
    b.blockType === 'reception' ? { ...b, startMs: at(20), endMs: at(23) } : b,
  );

  const before = lensStateAt(at(18), BLOCKS, ROOM);
  const after = lensStateAt(at(18), moved, ROOM);
  assert.equal(before, 'reception', '6 PM is inside the original reception');
  assert.equal(
    after,
    'designed',
    'with the reception moved to 8 PM, 6 PM must no longer show seats — the lens is reading a clock, not the schedule',
  );

  const lateBefore = lensStateAt(at(22, 45), BLOCKS, ROOM);
  const lateAfter = lensStateAt(at(22, 45), moved, ROOM);
  assert.equal(lateBefore, 'designed', 'the original reception has ended by 10:45 PM');
  assert.equal(lateAfter, 'reception', 'the moved one is still running at 10:45 PM');
});

/* ══════════════════════════════════════════════════════════════════════════
   THE HEAT
   ══════════════════════════════════════════════════════════════════════════ */

test('the loudest table is the loudest table, and an empty minute has none', () => {
  assert.equal(
    loudestTable([
      { tableId: 't1', captures: 12 },
      { tableId: 't7', captures: 88 },
      { tableId: 't12', captures: 3 },
    ]),
    't7',
  );
  assert.equal(loudestTable([]), null);
  assert.equal(
    loudestTable([
      { tableId: 't1', captures: 0 },
      { tableId: 't7', captures: 0 },
    ]),
    null,
    'a table that shot nothing is not the loudest table — it is not a table that shot',
  );
});

test('every table is hot, warm or cold, and only one is hot', () => {
  const heat = [
    { tableId: 't1', captures: 12 },
    { tableId: 't7', captures: 88 },
    { tableId: 't12', captures: 0 },
  ];
  assert.equal(heatClassOf('t7', heat), 'hot');
  assert.equal(heatClassOf('t1', heat), 'warm');
  assert.equal(heatClassOf('t12', heat), 'cold');
  // A table with no row at all is cold, not a crash.
  assert.equal(heatClassOf('t-nobody', heat), 'cold');
  assert.equal(TABLES.filter((t) => heatClassOf(t.id, heat) === 'hot').length, 1);
});

/* ══════════════════════════════════════════════════════════════════════════
   THE STORY NEVER PASSES JUDGEMENT ON THE DAY IT IS TELLING
   ══════════════════════════════════════════════════════════════════════════ */

test('a table with one or two photographs shows a reader nothing at all', () => {
  /*
    ⚖ Owner, 2026-09-09: withhold it — "this will subconsciously tell them they
    did not create enough memories for the story".

    Checked at the boundary and on both sides of it, not at one sampled value:
    everything under the floor leaves the room, everything at or over it stays.
  */
  const heat = [
    { tableId: 't1', captures: 1 },
    { tableId: 't7', captures: 2 },
    { tableId: 't12', captures: SMALL_COUNTS_ARE_A_VERDICT },
  ];
  const shown = heatWorthShowing(heat);
  assert.deepEqual(
    shown.map((h) => h.tableId),
    ['t12'],
    'only the table that clears the floor may be shown',
  );
  for (let n = 0; n < SMALL_COUNTS_ARE_A_VERDICT; n += 1) {
    assert.deepEqual(
      heatWorthShowing([{ tableId: 'x', captures: n }]),
      [],
      `${n} photographs must show nothing`,
    );
  }
  assert.equal(
    heatWorthShowing([{ tableId: 'x', captures: SMALL_COUNTS_ARE_A_VERDICT }]).length,
    1,
    'the floor itself is shown — it is a floor, not a threshold to exceed',
  );
});

test('a table under the floor is not drawn faintly — it is not drawn', () => {
  // Rounding a small count down, or drawing the table warm with its number
  // suppressed, still says "this table barely shot anything". That IS the
  // verdict. The only safe rendering is absence.
  const shown = heatWorthShowing([
    { tableId: 't1', captures: 2 },
    { tableId: 't7', captures: 40 },
  ]);
  assert.equal(heatClassOf('t7', shown), 'hot');
  assert.equal(heatClassOf('t1', shown), 'cold', 'a withheld table is cold, not warm');
  assert.equal(loudestTable(shown), 't7');
});

test('a quiet minute is not reported as an empty one', () => {
  /*
    The two silences. Photographs DID come from seats — there were just too few
    to say which table was loudest. Telling the host "no photograph of this
    minute came from a seat" would be untrue AND the exact verdict the ruling
    exists to prevent.
  */
  const quiet = lensNote({
    state: 'reception',
    opensAt: '5:30 PM',
    loudestLabel: null,
    alsoShooting: 0,
    sawSomething: true,
    heatWithheld: false,
  });
  assert.doesNotMatch(
    quiet,
    /No photograph/,
    `a quiet minute must not be called empty: "${quiet}"`,
  );
  assert.doesNotMatch(quiet, /\d/, 'and it must carry no figure');

  const empty = lensNote({
    state: 'reception',
    opensAt: '5:30 PM',
    loudestLabel: null,
    alsoShooting: 0,
    sawSomething: false,
    heatWithheld: false,
  });
  assert.match(empty, /No photograph/, 'a genuinely empty minute may say so');
});

/* ══════════════════════════════════════════════════════════════════════════
   WHAT IT SAYS — no names, and no invented clock
   ══════════════════════════════════════════════════════════════════════════ */

test('no note the lens can produce contains a person', () => {
  /*
    `04` rules 2 and 7. The module has no name field, so this asserts the shape
    of what it CAN say: every branch, with a label deliberately shaped like a
    person's name, and the output must still read as a table.
  */
  const states: LensState[] = ['no_venue', 'not_built', 'designed', 'ceremony', 'reception'];
  for (const state of states) {
    for (const withheld of [true, false]) {
      for (const opensAt of [null, '5:30 PM']) {
        const note = lensNote({
          state,
          opensAt,
          loudestLabel: '7',
          alsoShooting: 4,
          heatWithheld: withheld,
        });
        assert.ok(note.length > 0, `${state}: the lens must always say something`);
        assert.ok(
          !/\bwith\s+[A-Z][a-z]+/.test(note),
          `${state}: "${note}" reads as if it names somebody`,
        );
      }
    }
  }
});

test('the reception line names a table by its own label, never a time it invented', () => {
  const note = lensNote({
    state: 'reception',
    opensAt: '5:30 PM',
    loudestLabel: 'Crew',
    alsoShooting: 2,
    heatWithheld: false,
  });
  assert.match(note, /Table Crew/);
  assert.match(note, /2 other tables were shooting/);
  assert.doesNotMatch(note, /5:30/, 'the reception line has no business quoting a start time');

  const one = lensNote({
    state: 'reception',
    opensAt: null,
    loudestLabel: '7',
    alsoShooting: 1,
    heatWithheld: false,
  });
  assert.match(one, /1 other table was shooting/, 'one table is singular');
});

test('a withheld guests layer produces a line that says so, and no number', () => {
  const note = lensNote({
    state: 'reception',
    opensAt: '5:30 PM',
    loudestLabel: '7',
    alsoShooting: 4,
    heatWithheld: true,
  });
  assert.doesNotMatch(note, /\d/, `a withheld minute must publish no figure — got "${note}"`);
  assert.doesNotMatch(note, /Table/, 'and must not name the loudest table either');
});

test('the ceremony and designed lines quote the block’s own opening time when there is one', () => {
  assert.match(
    lensNote({
      state: 'ceremony',
      opensAt: '6:15 PM',
      loudestLabel: null,
      alsoShooting: 0,
      heatWithheld: false,
    }),
    /6:15 PM/,
  );
  // …and never invent one when the couple has not said.
  assert.doesNotMatch(
    lensNote({
      state: 'ceremony',
      opensAt: null,
      loudestLabel: null,
      alsoShooting: 0,
      heatWithheld: false,
    }),
    /\d/,
  );
});

test('an empty room resolves to no venue rather than to a crash', () => {
  assert.equal(lensStateAt(Date.now(), [], EMPTY_ROOM), 'no_venue');
  assert.equal(seatsAreShown('no_venue'), false);
  assert.equal(lensStateLabel('no_venue'), 'no venue');
});

/* ─── THE ROOM IS FROZEN AT PUBLISH (`03` §2.8 · 08 step 1.6) ─────────────── */

const A_REAL_ROOM: StoryRoom = {
  seatingSurface: true,
  roaming: false,
  seatsAssigned: true,
  drawnAtMs: 1_770_000_000_000,
  tables: [
    { id: 't1', label: '7', xPct: 20, yPct: 30, shape: 'round' },
    { id: 't2', label: 'Long table', xPct: 60.5, yPct: 12.25, shape: 'long_banquet' },
  ],
  stage: { xPct: 40, yPct: 5, wPct: 20, hPct: 8 },
  dance: { xPct: 40, yPct: 60, wPct: 20, hPct: 15 },
};

test('a frozen room comes back exactly as it was written', () => {
  // The whole promise: the plan on a published story is a record of the night,
  // not a live view of a document the host is still editing.
  const back = readRoomSnapshot(roomSnapshotOf(A_REAL_ROOM));
  assert.deepEqual(back, A_REAL_ROOM);
});

test('an unreadable snapshot costs the FREEZE, never the room', () => {
  /*
    🔑 `null` MEANS "NOT FROZEN", which falls back to the live plan — the same
    behaviour every story has today. A snapshot reader that returned an EMPTY
    room on junk would blank a floor plan that exists, on the one press that is
    supposed to preserve it.
  */
  for (const junk of [null, undefined, 0, '', 'a room', [], {}, { v: 2, room: A_REAL_ROOM }, { v: 1 }, { v: 1, room: 'x' }]) {
    assert.equal(readRoomSnapshot(junk), null, `${JSON.stringify(junk)} produced a room`);
  }
});

test('a table with no position is DROPPED, not parked at the origin', () => {
  // Where it would sit on top of the stage and read as a table that was really
  // there — the same rule the live read applies.
  const back = readRoomSnapshot({
    v: 1,
    room: {
      ...A_REAL_ROOM,
      tables: [
        { id: 't1', label: '7', xPct: 20, yPct: 30, shape: 'round' },
        { id: 't2', label: 'no position', shape: 'round' },
        { id: 't3', label: 'bad shape', xPct: 1, yPct: 1, shape: 'hexagon' },
        { id: '', label: 'no id', xPct: 1, yPct: 1, shape: 'round' },
        { id: 't5', label: '', xPct: 1, yPct: 1, shape: 'round' },
      ],
    },
  });
  assert.deepEqual(back?.tables.map((t) => t.id), ['t1']);
});

test('a position outside the venue is clamped, exactly as the live read clamps it', () => {
  const back = readRoomSnapshot({
    v: 1,
    room: { ...A_REAL_ROOM, tables: [{ id: 't1', label: '7', xPct: -40, yPct: 900, shape: 'round' }] },
  });
  assert.deepEqual(back?.tables[0], { id: 't1', label: '7', xPct: 0, yPct: 100, shape: 'round' });
});

test('a nonsense box is dropped rather than drawn inside out', () => {
  const back = readRoomSnapshot({
    v: 1,
    room: { ...A_REAL_ROOM, stage: { xPct: 1, yPct: 1, wPct: 0, hPct: 5 }, dance: 'nope' },
  });
  assert.equal(back?.stage, null);
  assert.equal(back?.dance, null);
});

test('THE FROZEN SHAPE HAS NOWHERE TO PUT A NAME', () => {
  /*
    🔒 `04` rule 2 is a review BLOCKER, and this is the version of it that
    survives a careless writer: the snapshot is a `StoryRoom`, whose whole field
    list is a label, two percentages and a shape. A field smuggled into the
    stored document does not come back out — so a future writer that reached for
    `guests` could not leak one through here even if nobody reviewed it.
  */
  const smuggled = {
    v: 1,
    room: {
      ...A_REAL_ROOM,
      tables: [
        {
          id: 't1',
          label: '7',
          xPct: 20,
          yPct: 30,
          shape: 'round',
          guestName: 'Bing Reyes',
          seatedGuestIds: ['g1', 'g2'],
        },
      ],
      hostName: 'Maria',
    },
  };
  const back = readRoomSnapshot(smuggled);
  assert.deepEqual(Object.keys(back?.tables[0] ?? {}).sort(), [
    'id',
    'label',
    'shape',
    'xPct',
    'yPct',
  ]);
  assert.doesNotMatch(JSON.stringify(back), /Bing|Maria|seatedGuestIds/);
});

test('THE PUBLIC READ PREFERS THE SNAPSHOT, AND IT IS THE ONLY ROOM READ', () => {
  /*
    The freeze is worth nothing if the reader still goes to `event_tables`. Two
    claims, each checked on its own rather than counted:

      1. `loadStoryRoom` consults `room_snapshot` and RETURNS it when it parses;
      2. it is the ONE place the story reads the plan — a second reader would be
         a second opinion, and only one of the two would be frozen.

    Read over the STRIPPED source, because this file's own docblocks describe
    both the defect and the fix and would otherwise satisfy the scan.
  */
  const src = stripComments(
    readFileSync(
      join(import.meta.dirname, '..', 'app', '[slug]', '_components', 'story', 'spine-data.ts'),
      'utf8',
    ),
  );
  const start = src.indexOf('export async function loadStoryRoom');
  assert.ok(start >= 0, 'loadStoryRoom is gone');
  const body = src.slice(start, src.indexOf('\nasync function ', start + 10) + 1 || undefined);

  assert.match(
    body,
    /readRoomSnapshot\([\s\S]{0,120}room_snapshot[\s\S]{0,200}?return frozen/,
    'loadStoryRoom no longer returns the frozen room — a published story is ' +
      'reading the live plan again, and a host who re-runs their seating ' +
      'silently redraws a story that was already told.',
  );
  // The snapshot is consulted BEFORE the live read, or it is not a freeze.
  assert.ok(
    body.indexOf('room_snapshot') < body.indexOf("from('event_tables')"),
    'the live plan is read before the snapshot is consulted.',
  );
  // And nowhere else in the story tree reads the plan.
  const others = readdirSync(join(import.meta.dirname, '..', 'app', '[slug]', '_components', 'story'))
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && f !== 'spine-data.ts')
    .filter((f) =>
      stripComments(
        readFileSync(
          join(import.meta.dirname, '..', 'app', '[slug]', '_components', 'story', f),
          'utf8',
        ),
      ).includes("from('event_tables')"),
    );
  assert.deepEqual(
    others,
    [],
    `these read the live floor plan as well as loadStoryRoom: ${others.join(', ')} — ` +
      `only one of the two readers is frozen.`,
  );
});
