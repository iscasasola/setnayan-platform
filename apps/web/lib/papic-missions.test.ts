import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  boothMissionPrompt,
  isMissionLive,
  MISSION_TYPE_LABELS,
  missionProgress,
  sortGuestMissions,
  vendorChallengeStatus,
  resolveChallengeBoard,
  isChallengePromptBlocked,
  BOARD_SIZE,
} from './papic-missions';
import type {
  GuestMissionRow,
  PapicMissionType,
  ChallengeLibraryItem,
  CouplePick,
  VendorLaneMission,
  BoardEntry,
} from './papic-missions';

function guestMission(over: Partial<GuestMissionRow>): GuestMissionRow {
  return {
    mission_id: 'm',
    mission_type: 'prompt',
    prompt: 'do a thing',
    vendor_id: null,
    vendor_name: null,
    target_guest_id: null,
    target_role: null,
    completed: false,
    consent_shared: false,
    source: 'auto',
    capture_kind: null,
    library_id: null,
    board_slot: null,
    ...over,
  };
}

test('boothMissionPrompt matches the auto-gen wording', () => {
  assert.equal(boothMissionPrompt('Salt & Lime'), "Get a photo at Salt & Lime's booth");
});

test('isMissionLive requires active AND approved', () => {
  assert.equal(isMissionLive({ is_active: true, approved: true }), true);
  assert.equal(isMissionLive({ is_active: true, approved: false }), false);
  assert.equal(isMissionLive({ is_active: false, approved: true }), false);
});

test('every mission type has a label', () => {
  const types: PapicMissionType[] = [
    'prompt',
    'roster',
    'video_greeting',
    'toast_or_dance',
    'vendor_booth',
    'face_verified',
  ];
  for (const t of types) assert.ok(MISSION_TYPE_LABELS[t], `missing label for ${t}`);
});

test('missionProgress counts completed and flags all-done', () => {
  assert.deepEqual(missionProgress([]), { done: 0, total: 0, allDone: false });
  assert.deepEqual(
    missionProgress([{ completed: true }, { completed: false }, { completed: true }]),
    { done: 2, total: 3, allDone: false },
  );
  assert.deepEqual(missionProgress([{ completed: true }, { completed: true }]), {
    done: 2,
    total: 2,
    allDone: true,
  });
  // an empty set is not "all done" — nothing to celebrate.
  assert.equal(missionProgress([]).allDone, false);
});

test('sortGuestMissions puts not-yet-done first, stable within group', () => {
  const a = guestMission({ mission_id: 'a', completed: false });
  const b = guestMission({ mission_id: 'b', completed: true });
  const c = guestMission({ mission_id: 'c', completed: false });
  const d = guestMission({ mission_id: 'd', completed: true });
  const sorted = sortGuestMissions([b, a, d, c]);
  assert.deepEqual(
    sorted.map((m) => m.mission_id),
    ['a', 'c', 'b', 'd'],
  );
  // pure — input is not mutated.
  assert.deepEqual([b, a, d, c].map((m) => m.mission_id), ['b', 'a', 'd', 'c']);
});

test('vendorChallengeStatus maps approved/active to a lifecycle', () => {
  // inactive always reads rejected, regardless of approved.
  assert.equal(vendorChallengeStatus({ approved: false, is_active: false }), 'rejected');
  assert.equal(vendorChallengeStatus({ approved: true, is_active: false }), 'rejected');
  // active + approved = live; active + not-yet-approved = pending the couple.
  assert.equal(vendorChallengeStatus({ approved: true, is_active: true }), 'live');
  assert.equal(vendorChallengeStatus({ approved: false, is_active: true }), 'pending');
});

// ---------------------------------------------------------------------------
// §9 board resolver — mirrors ensure_papic_board. Fixture = the migration seed
// (priority_rank 1..10; library #5 = Pabati). NOTE: this validates the ALGORITHM,
// not the SQL — the SQL applies against a real DB.
// ---------------------------------------------------------------------------
const RANK: Record<number, number> = { 1: 1, 40: 2, 5: 3, 2: 4, 15: 5, 38: 6, 4: 7, 18: 8, 6: 9, 22: 10 };
const CLIPS = new Set([1, 4, 12, 15, 16, 17, 19, 20, 21, 25, 32, 37, 38, 40]);

function makeLibrary(): ChallengeLibraryItem[] {
  const lib: ChallengeLibraryItem[] = [];
  for (let id = 1; id <= 40; id++) {
    lib.push({
      libraryId: id,
      priorityRank: RANK[id] ?? null,
      captureKind: id === 5 ? 'pabati' : CLIPS.has(id) ? 'clip' : 'photo',
      missionType: id === 5 ? 'video_greeting' : 'prompt',
      isActive: true,
    });
  }
  return lib;
}

function couple(...libraryIds: (number | null)[]): CouplePick[] {
  return libraryIds.map((lid, i) => ({ key: `c${i}`, libraryId: lid }));
}
function vend(...specs: VendorLaneMission[]): VendorLaneMission[] {
  return specs;
}
function setnayanIds(board: BoardEntry[]): number[] {
  return board
    .filter((b): b is Extract<BoardEntry, { lane: 'setnayan' }> => b.lane === 'setnayan')
    .map((b) => b.libraryId);
}
function laneKeys(board: BoardEntry[], lane: 'couple' | 'vendor'): string[] {
  return board.filter((b) => b.lane === lane).map((b) => (b as { key: string }).key);
}

test('T1 — empty event, Pabati active → 20 Setnayan by rank then library order', () => {
  const board = resolveChallengeBoard({ couplePicks: [], vendorMissions: [], library: makeLibrary(), pabatiActive: true });
  assert.equal(board.length, BOARD_SIZE);
  assert.deepEqual(setnayanIds(board), [1, 40, 5, 2, 15, 38, 4, 18, 6, 22, 3, 7, 8, 9, 10, 11, 12, 13, 14, 16]);
  // board_slot is 1..20, contiguous and ordered.
  assert.deepEqual(board.map((b) => b.slot), Array.from({ length: 20 }, (_, i) => i + 1));
});

test('T2 — Pabati INACTIVE → #5 skipped, backfilled, board still 20', () => {
  const board = resolveChallengeBoard({ couplePicks: [], vendorMissions: [], library: makeLibrary(), pabatiActive: false });
  const ids = setnayanIds(board);
  assert.equal(board.length, BOARD_SIZE);
  assert.ok(!ids.includes(5), 'Pabati must be absent when its SKU is inactive');
  assert.deepEqual(ids.slice(0, 9), [1, 40, 2, 15, 38, 4, 18, 6, 22]);
});

test('T3 — couple 10 + vendor 5 → exactly the Top-5 Setnayan', () => {
  const board = resolveChallengeBoard({
    couplePicks: couple(null, null, null, null, null, null, null, null, null, null),
    vendorMissions: vend(
      { key: 'v1', paid: true }, { key: 'v2', paid: true }, { key: 'v3', paid: false },
      { key: 'v4', paid: false }, { key: 'v5', paid: false },
    ),
    library: makeLibrary(),
    pabatiActive: true,
  });
  assert.equal(board.length, BOARD_SIZE);
  assert.deepEqual(setnayanIds(board), [1, 40, 5, 2, 15]);
});

test('T4 — couple picks the Top-5 as library items → no duplication, backfill from #6', () => {
  const board = resolveChallengeBoard({
    couplePicks: couple(1, 40, 5, 2, 15, null, null, null, null, null),
    vendorMissions: [],
    library: makeLibrary(),
    pabatiActive: true,
  });
  const ids = setnayanIds(board);
  for (const hero of [1, 40, 5, 2, 15]) assert.ok(!ids.includes(hero), `#${hero} must not appear twice`);
  assert.deepEqual(ids, [38, 4, 18, 6, 22, 3, 7, 8, 9, 10]);
  assert.equal(board.length, BOARD_SIZE);
});

test('T5 — couple picks all Top-10 → Setnayan is pure library-order backfill', () => {
  const board = resolveChallengeBoard({
    couplePicks: couple(1, 40, 5, 2, 15, 38, 4, 18, 6, 22),
    vendorMissions: [],
    library: makeLibrary(),
    pabatiActive: true,
  });
  assert.deepEqual(setnayanIds(board), [3, 7, 8, 9, 10, 11, 12, 13, 14, 16]);
});

test('T6 — 8 vendor missions → capped at 5, PAID before booth', () => {
  const board = resolveChallengeBoard({
    couplePicks: [],
    vendorMissions: vend(
      { key: 'a', paid: true }, { key: 'b', paid: true }, { key: 'c', paid: false },
      { key: 'd', paid: false }, { key: 'e', paid: false }, { key: 'f', paid: false },
      { key: 'g', paid: false }, { key: 'h', paid: true },
    ),
    library: makeLibrary(),
    pabatiActive: true,
  });
  assert.deepEqual(laneKeys(board, 'vendor'), ['a', 'b', 'h', 'c', 'd']); // 3 paid first, then booth by order
});

test('T7 — no vendor availed → Setnayan fills the vendor slots up to 20 (no holes)', () => {
  const board = resolveChallengeBoard({
    couplePicks: couple(null, null, null),
    vendorMissions: [],
    library: makeLibrary(),
    pabatiActive: true,
  });
  assert.equal(board.length, BOARD_SIZE); // 3 couple + 17 Setnayan
  assert.equal(laneKeys(board, 'couple').length, 3);
  assert.equal(setnayanIds(board).length, 17);
  assert.ok(board.every((b) => b.slot >= 1 && b.slot <= 20));
});

test('T9 — couple picks a library id a Setnayan fill would hold → appears once (couple)', () => {
  const board = resolveChallengeBoard({
    couplePicks: couple(1),
    vendorMissions: [],
    library: makeLibrary(),
    pabatiActive: true,
  });
  assert.ok(!setnayanIds(board).includes(1), 'Setnayan must not duplicate the couple pick');
  const oneCount =
    board.filter((b) => b.lane === 'couple' && b.libraryId === 1).length + setnayanIds(board).filter((x) => x === 1).length;
  assert.equal(oneCount, 1);
  assert.equal(board.length, BOARD_SIZE);
});

test('T10 — couple picks 12 → capped at 10, all 12 library ids stay untaken by Setnayan', () => {
  const board = resolveChallengeBoard({
    couplePicks: couple(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12),
    vendorMissions: [],
    library: makeLibrary(),
    pabatiActive: true,
  });
  assert.equal(laneKeys(board, 'couple').length, 10); // capped
  for (let id = 1; id <= 12; id++) assert.ok(!setnayanIds(board).includes(id), `#${id} taken by couple`);
  assert.equal(board.length, BOARD_SIZE);
});

test('order — a paid vendor always precedes a free booth', () => {
  const board = resolveChallengeBoard({
    couplePicks: [],
    vendorMissions: vend({ key: 'booth', paid: false }, { key: 'paid', paid: true }),
    library: makeLibrary(),
    pabatiActive: true,
  });
  assert.deepEqual(laneKeys(board, 'vendor'), ['paid', 'booth']);
});

test('order — couple lane preserves the caller ordering (created_at,id)', () => {
  const board = resolveChallengeBoard({
    couplePicks: [{ key: 'x', libraryId: null }, { key: 'y', libraryId: null }],
    vendorMissions: [],
    library: makeLibrary(),
    pabatiActive: true,
  });
  assert.deepEqual(laneKeys(board, 'couple'), ['x', 'y']);
});

test('veto — couple hides a Top-5 hero → excluded, board backfills the next rank', () => {
  const board = resolveChallengeBoard({
    couplePicks: [],
    vendorMissions: [],
    library: makeLibrary(),
    vetoedLibraryIds: [40], // Grand Finale, rank 2
    pabatiActive: true,
  });
  const ids = setnayanIds(board);
  assert.ok(!ids.includes(40), 'a vetoed hero is never resurrected');
  assert.equal(board.length, BOARD_SIZE, 'veto wins but the board still fills to 20');
  assert.ok(ids.includes(17), 'backfill pulls in the next item that would otherwise be off-board');
});

test('face_verified library items are never placed (dormant face model)', () => {
  const lib = makeLibrary();
  // `lib[2]!` — under noUncheckedIndexedAccess an index read is possibly
  // undefined, and spreading that widens every field to optional, which no
  // longer satisfies ChallengeLibraryItem. makeLibrary() always returns a full
  // library, so the assertion is safe. (This branch predates the stricter setting.)
  lib[2] = { ...lib[2]!, missionType: 'face_verified' as PapicMissionType }; // library id 3
  const board = resolveChallengeBoard({ couplePicks: [], vendorMissions: [], library: lib, pabatiActive: true });
  assert.ok(!setnayanIds(board).includes(3), 'face_verified stays gated out of the launch board');
  assert.equal(board.length, BOARD_SIZE);
});

test('sortGuestMissions orders by board_slot within the not-done group', () => {
  const m = (id: string, slot: number | null, completed = false) =>
    guestMission({ mission_id: id, board_slot: slot, completed });
  // slots out of order + a completed row + a null-slot row.
  const sorted = sortGuestMissions([m('b', 2), m('done', 1, true), m('a', 1), m('off', null)]);
  assert.deepEqual(
    sorted.map((x) => x.mission_id),
    ['a', 'b', 'off', 'done'], // not-done by slot (1,2) then null; completed last.
  );
});

test('minor-safety guard blocks drinking dares, allows a toast', () => {
  for (const bad of ['Take a shot of tequila', 'chug your beer', 'get drunk with the groom', 'kiss a stranger', 'body shot dare']) {
    assert.equal(isChallengePromptBlocked(bad), true, `should block: ${bad}`);
  }
  for (const ok of ['Toast with your drink — any drink counts', 'Dance with grandma', "Order the couple's signature mocktail"]) {
    assert.equal(isChallengePromptBlocked(ok), false, `should allow: ${ok}`);
  }
});
