import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  boothMissionPrompt,
  isMissionLive,
  MISSION_TYPE_LABELS,
  missionProgress,
  sortGuestMissions,
  vendorChallengeStatus,
  resolveChallengeBoard,
  isChallengePromptBlocked,
  displayChallengePrompt,
  CHALLENGE_SIDE_TOKEN,
  CHALLENGE_SIDE_NEUTRAL,
  BOARD_SIZE,
  VENDOR_SLOTS,
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
// Ranks 1..10 = the §9.4 Top-10 heroes. Ranks 11..14 = the four STORY
// challenges (library 41–44, owner 2026-08-10) — see LIBRARY_SIZE below for why
// their rank is the whole point.
/**
 * The fixture's running order, mirroring PRODUCTION's shape for a board of ten.
 *
 * ⚠ IT USED TO BE 14 RANKS WITH EVERY STORY AT 11-14, and that modelled the real
 * library exactly — while the board was 20. When the owner moved the board to 10
 * ("we keep the 600+ challenges but the user only picks 10"), that shape meant
 * ranks 1-10 were all photo errands and NOT ONE story or greeting could reach a
 * default board. The real ranks were rebalanced; so is this.
 *
 * Six doing, three telling, one greeting — id 4 stands in for the greeting and
 * 41/42/43 for the stories, exactly as production's ten is built.
 */
const RANK: Record<number, number> = {
  1: 1, 41: 2, 4: 3, 2: 4, 40: 5, 43: 6, 18: 7, 22: 8, 42: 9, 6: 10,
};
const CLIPS = new Set([1, 4, 12, 15, 16, 17, 19, 20, 21, 25, 32, 37, 38, 40, 41, 42, 43, 44]);

// 🔑 44, NOT 40 — AND THE STORY IDS MUST CARRY A RANK.
// The board is 20 slots and the Setnayan lane backfills by (rank NULLS LAST,
// library_id). With 40 ranked-or-low-id rows ahead of them, story rows added at
// 41–44 with a NULL rank would sort dead last and NEVER be placed — and no other
// surface reads the library (the couple's manager has no picker), so they would
// be unreachable by any human. Drop the four RANK entries above and T-STORY-1
// goes red: that is the whole guard.
const STORY_IDS = [41, 42, 43, 44] as const;
const LIBRARY_SIZE = 44;

/**
 * WHAT THE SETNAYAN LANE SHOULD CONTAIN, worked out from the documented rule
 * rather than from the resolver.
 *
 * 🔑 THIS IS NOT THE RESOLVER RE-CALLED. It is a second, deliberately naive
 * reading of the ONE sentence the rule is: "by priority_rank NULLS LAST, then
 * library_id, skipping taken / vetoed / inactive / Pabati-when-off". Every test
 * below used to hard-code the resulting list for a 20-slot board, so moving the
 * board broke ten of them at once and each had to be re-derived by hand — which
 * is how a test ends up asserting whatever the code happens to do.
 */
function expectedSetnayan(
  lib: ChallengeLibraryItem[],
  opts: { slots: number; taken?: number[]; vetoed?: number[]; pabatiActive?: boolean },
): number[] {
  const taken = new Set(opts.taken ?? []);
  const vetoed = new Set(opts.vetoed ?? []);
  return lib
    .filter(
      (l) =>
        l.isActive &&
        l.missionType !== 'face_verified' &&
        (l.captureKind !== 'pabati' || opts.pabatiActive) &&
        !taken.has(l.libraryId) &&
        !vetoed.has(l.libraryId),
    )
    .sort(
      (a, b) =>
        (a.priorityRank ?? Number.POSITIVE_INFINITY) - (b.priorityRank ?? Number.POSITIVE_INFINITY) ||
        a.libraryId - b.libraryId,
    )
    .slice(0, Math.max(0, opts.slots))
    .map((l) => l.libraryId);
}

function makeLibrary(): ChallengeLibraryItem[] {
  const lib: ChallengeLibraryItem[] = [];
  for (let id = 1; id <= LIBRARY_SIZE; id++) {
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
  assert.deepEqual(
    setnayanIds(board),
    expectedSetnayan(makeLibrary(), { slots: BOARD_SIZE, pabatiActive: true }),
  );
  // board_slot is 1..BOARD_SIZE, contiguous and ordered.
  assert.deepEqual(board.map((b) => b.slot), Array.from({ length: BOARD_SIZE }, (_, i) => i + 1));
});

test('T2 — Pabati INACTIVE → #5 skipped, backfilled, board still full', () => {
  const board = resolveChallengeBoard({ couplePicks: [], vendorMissions: [], library: makeLibrary(), pabatiActive: false });
  const ids = setnayanIds(board);
  assert.equal(board.length, BOARD_SIZE);
  assert.ok(!ids.includes(5), 'Pabati must be absent when its SKU is inactive');
  assert.deepEqual(ids, expectedSetnayan(makeLibrary(), { slots: BOARD_SIZE, pabatiActive: false }));
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
  // A full couple lane plus the vendor share leaves the Setnayan lane whatever
  // is left — the point is that it is exactly the remainder, never a hole.
  const left = BOARD_SIZE - laneKeys(board, 'couple').length - laneKeys(board, 'vendor').length;
  assert.deepEqual(
    setnayanIds(board),
    expectedSetnayan(makeLibrary(), { slots: left, pabatiActive: true }),
  );
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
  assert.deepEqual(
    ids,
    expectedSetnayan(makeLibrary(), {
      slots: BOARD_SIZE - laneKeys(board, 'couple').length,
      taken: [1, 40, 5, 2, 15],
      pabatiActive: true,
    }),
  );
  assert.equal(board.length, BOARD_SIZE);
});

test('T5 — couple picks all Top-10 → stories lead, then library-order backfill', () => {
  const board = resolveChallengeBoard({
    couplePicks: couple(1, 40, 5, 2, 15, 38, 4, 18, 6, 22),
    vendorMissions: [],
    library: makeLibrary(),
    pabatiActive: true,
  });
  // Taking heroes as their OWN picks removes them from the Setnayan remainder.
  assert.deepEqual(
    setnayanIds(board),
    expectedSetnayan(makeLibrary(), {
      slots: BOARD_SIZE - laneKeys(board, 'couple').length,
      taken: [1, 40, 5, 2, 15, 38, 4, 18, 6, 22],
      pabatiActive: true,
    }),
  );
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
  // PAID first (in order), then booth (in order), capped at the vendor share.
  assert.deepEqual(
    laneKeys(board, 'vendor'),
    ['a', 'b', 'h', 'c', 'd', 'e', 'f', 'g'].slice(0, VENDOR_SLOTS),
  );
});

test('T7 — no vendor availed → Setnayan fills the vendor slots up to 20 (no holes)', () => {
  const board = resolveChallengeBoard({
    couplePicks: couple(null, null, null),
    vendorMissions: [],
    library: makeLibrary(),
    pabatiActive: true,
  });
  assert.equal(board.length, BOARD_SIZE);
  assert.equal(laneKeys(board, 'couple').length, 3);
  assert.equal(setnayanIds(board).length, BOARD_SIZE - 3, 'Setnayan fills the unsold slots — no holes');
  assert.ok(board.every((b) => b.slot >= 1 && b.slot <= BOARD_SIZE));
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

test('T10 — the couple can fill the whole board with their own picks', () => {
  // ⚠ THIS TEST USED TO ASSERT `length === 10`, AND THAT WAS THE DEFECT.
  // Owner, 2026-08-21: "the need to have a real screen to pick their challenges
  // UP TO 20 CHALLENGES." A couple who chose twelve got ten; the other two had
  // no board position and nothing on any screen said so. The cap is now the
  // whole board minus whatever a supplier has paid for.
  // ⚠ DERIVED FROM BOARD_SIZE, NEVER RETYPED. This test asserted `=== 12`
  // against a 20-slot board; when the owner moved the board to 10 the literal
  // would have been the only thing standing between a silent behaviour change
  // and a red test — and it would have gone red for the wrong reason.
  const ids = Array.from({ length: BOARD_SIZE }, (_, i) => i + 1);
  const board = resolveChallengeBoard({
    couplePicks: couple(...ids),
    vendorMissions: [],
    library: makeLibrary(),
    pabatiActive: true,
  });
  assert.equal(laneKeys(board, 'couple').length, BOARD_SIZE);
  for (const id of ids) assert.ok(!setnayanIds(board).includes(id), `#${id} taken by couple`);
  assert.equal(board.length, BOARD_SIZE);
});

test('T10b — a full board of their own leaves Setnayan filling nothing', () => {
  const ids = Array.from({ length: BOARD_SIZE }, (_, i) => i + 1);
  const board = resolveChallengeBoard({
    couplePicks: couple(...ids),
    vendorMissions: [],
    library: makeLibrary(),
    pabatiActive: true,
  });
  assert.equal(laneKeys(board, 'couple').length, BOARD_SIZE);
  assert.equal(setnayanIds(board).length, 0, 'a board of their own picks is entirely theirs');
  assert.equal(board.length, BOARD_SIZE);
});

test('T10c — a PAID booth mission keeps its slot; the couple ceiling drops to match', () => {
  // 🔒 THE HALF THAT IS ABOUT SOMEBODY ELSE'S MONEY. A flat ceiling of 20 would
  // make the Setnayan target go negative the moment a sponsorship existed, and
  // — worse than the arithmetic — would delete a paid placement the instant the
  // couple added a twentieth of their own, with nothing anywhere saying so.
  const ids = Array.from({ length: BOARD_SIZE + 5 }, (_, i) => i + 1);
  const board = resolveChallengeBoard({
    couplePicks: couple(...ids),
    vendorMissions: vend({ key: 'paid-1', paid: true }, { key: 'paid-2', paid: true }),
    library: makeLibrary(),
    pabatiActive: true,
  });
  assert.deepEqual(laneKeys(board, 'vendor'), ['paid-1', 'paid-2'], 'a paid slot survives a greedy couple');
  assert.equal(laneKeys(board, 'couple').length, BOARD_SIZE - 2, 'the board minus what is sold');
  assert.equal(setnayanIds(board).length, 0);
  assert.equal(board.length, BOARD_SIZE, 'and the board never overflows');
});

test('T10d — the vendor lane can never take more than its quarter share', () => {
  // 🔒 THE GUARD AGAINST SELLING THE PARTY. Six suppliers all wanting a slot
  // must still only get VENDOR_SLOTS between them, and the couple keeps the
  // rest — never a negative target, never a board that is mostly advertising.
  const board = resolveChallengeBoard({
    couplePicks: couple(...Array.from({ length: BOARD_SIZE * 3 }, (_, i) => i + 1)),
    vendorMissions: vend(
      { key: 'v1', paid: true }, { key: 'v2', paid: true }, { key: 'v3', paid: true },
      { key: 'v4', paid: true }, { key: 'v5', paid: true }, { key: 'v6', paid: true },
    ),
    library: makeLibrary(),
    pabatiActive: true,
  });
  assert.equal(laneKeys(board, 'vendor').length, VENDOR_SLOTS);
  assert.equal(laneKeys(board, 'couple').length, BOARD_SIZE - VENDOR_SLOTS);
  assert.equal(board.length, BOARD_SIZE);
  assert.ok(VENDOR_SLOTS * 4 <= BOARD_SIZE, 'a supplier may never hold more than a quarter of a guest\'s board');
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
  assert.equal(board.length, BOARD_SIZE, 'veto wins but the board still fills');
  assert.deepEqual(
    ids,
    expectedSetnayan(makeLibrary(), { slots: BOARD_SIZE, vetoed: [40], pabatiActive: true }),
  );
  const withoutVeto = expectedSetnayan(makeLibrary(), { slots: BOARD_SIZE, pabatiActive: true });
  const pulledIn = ids.find((x) => !withoutVeto.includes(x));
  assert.ok(pulledIn !== undefined, 'a veto must pull in something that was off-board');
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

// ---------------------------------------------------------------------------
// Story challenges (library 41–44, owner 2026-08-10) — REACHABILITY.
//
// 🔑 The whole risk with these rows is that they ship INVISIBLE. Adding library
// rows changes nothing a guest can see unless the board actually places them,
// and the board is 20 slots deep over a 44-row library. These tests exist to
// fail the moment a story stops being placed — not to restate the algorithm.
// ---------------------------------------------------------------------------

test('T-STORY-1 — an ordinary event is asked for stories, not only errands', () => {
  // ⚠ THIS ASSERTED "ALL FOUR STORIES" AND THAT EXPIRED WITH THE BOARD SIZE.
  // With 20 slots every ranked story fitted, so "all four" and "stories reach a
  // guest" were the same sentence. At 10 they are not, and the one that matters
  // is the second: a default board must ASK SOMEBODY TO SPEAK, because the
  // couple's story column is built out of those answers. Pinning "all four"
  // again would just re-break the next time the number moves.
  const board = resolveChallengeBoard({
    couplePicks: [],
    vendorMissions: [],
    library: makeLibrary(),
    pabatiActive: true,
  });
  const ids = setnayanIds(board);
  const stories = STORY_IDS.filter((id) => ids.includes(id));
  assert.ok(
    stories.length >= 2,
    `only ${stories.length} story reached a board of ${BOARD_SIZE} — a story nobody is asked is not a feature, ` +
      `and the story column has nothing to fill it`,
  );
  // And the ranked ones specifically: an unranked story riding in on a low id is
  // luck, not design.
  for (const id of STORY_IDS.filter((x) => RANK[x] !== undefined)) {
    assert.ok(ids.includes(id), `ranked story #${id} must reach the board`);
  }
});

test('T-STORY-2 — a FULL couple lane + a FULL vendor lane still leaves no story room', () => {
  // The worst case: 10 couple picks + 5 vendor missions leaves the Setnayan lane
  // exactly 5 slots, and the Top-5 heroes take all of them. The stories rank
  // BELOW the heroes deliberately — a wedding that has curated its own board
  // keeps its own board. This asserts the documented trade-off rather than
  // pretending the stories are always present.
  const board = resolveChallengeBoard({
    couplePicks: couple(null, null, null, null, null, null, null, null, null, null),
    vendorMissions: vend(
      { key: 'v1', paid: true }, { key: 'v2', paid: true }, { key: 'v3', paid: false },
      { key: 'v4', paid: false }, { key: 'v5', paid: false },
    ),
    library: makeLibrary(),
    pabatiActive: true,
  });
  const ids = setnayanIds(board);
  assert.equal(
    ids.length,
    BOARD_SIZE - laneKeys(board, 'couple').length - laneKeys(board, 'vendor').length,
    'the Setnayan lane is exactly the remainder',
  );
  assert.deepEqual(
    ids,
    expectedSetnayan(makeLibrary(), { slots: ids.length, pabatiActive: true }),
    'and it is the highest-ranked remainder, not an arbitrary one',
  );
});

test('T-STORY-3 — an UNRANKED story would never be placed (why the rank is load-bearing)', () => {
  // Sabotage: strip the four ranks, exactly as "just add the rows" would have.
  // This is the failure the migration exists to prevent, asserted directly.
  const lib = makeLibrary().map((l) =>
    (STORY_IDS as readonly number[]).includes(l.libraryId) ? { ...l, priorityRank: null } : l,
  );
  const ids = setnayanIds(
    resolveChallengeBoard({ couplePicks: [], vendorMissions: [], library: lib, pabatiActive: true }),
  );
  for (const id of STORY_IDS) {
    assert.ok(!ids.includes(id), `#${id} unranked must fall off — proving the rank is what makes it reachable`);
  }
});

test('T-STORY-4 — the couple can veto a story like any other challenge', () => {
  const ids = setnayanIds(
    resolveChallengeBoard({
      couplePicks: [],
      vendorMissions: [],
      library: makeLibrary(),
      vetoedLibraryIds: [43], // "When It Mattered" — the heaviest of the four
      pabatiActive: true,
    }),
  );
  assert.ok(!ids.includes(43), 'a vetoed story stays off, same as a vetoed hero');
  // The other RANKED stories are untouched. #44 is unranked and may or may not
  // fit a board of ten — asserting it would be asserting the board size again.
  for (const id of STORY_IDS.filter((x) => x !== 43 && RANK[x] !== undefined)) {
    assert.ok(ids.includes(id), `story #${id} must be untouched by an unrelated veto`);
  }
});

// ---------------------------------------------------------------------------
// The {who} side token — the NON-guest render path.
// The per-guest substitution is SQL (papic_guest_missions) and is covered by the
// db test; this covers every screen that reads papic_missions.prompt directly.
// ---------------------------------------------------------------------------

test('side token — a story prompt never renders the raw token to the couple', () => {
  const stored = 'Share a story about the first time you met {who}. Ten seconds.';
  const shown = displayChallengePrompt(stored);
  assert.equal(shown, 'Share a story about the first time you met the couple. Ten seconds.');
  assert.ok(!shown.includes(CHALLENGE_SIDE_TOKEN), 'the raw token must never reach a screen');
});

test('side token — a prompt without the token is returned byte-identical', () => {
  // All 40 shipped challenges plus every couple/vendor free-text prompt take
  // this path. If this ever changes, the helper has become a rewriter.
  for (const p of [
    'Catch the newlyweds mid-kiss.',
    'Sneak onto the floor and dance with the bride or groom. Now. Go.',
    "Get a photo at Elena's Flowers's booth",
    '',
  ]) {
    assert.equal(displayChallengePrompt(p), p);
  }
});

test('side token — every occurrence is replaced, not just the first', () => {
  // A future prompt could name the side twice ("...with {who}, and what {who}
  // said"). A single-shot replace would leave a raw token mid-sentence.
  assert.equal(
    displayChallengePrompt(`A story about ${CHALLENGE_SIDE_TOKEN} and what ${CHALLENGE_SIDE_TOKEN} said.`),
    `A story about ${CHALLENGE_SIDE_NEUTRAL} and what ${CHALLENGE_SIDE_NEUTRAL} said.`,
  );
});

// ---------------------------------------------------------------------------
// The expanded story set (45–60, owner 2026-08-10 "make more") — SAFETY.
//
// The § 2.2 blocklist stops DARES. It does not stop tactlessness, and the
// owner's constraint was "safe enough to share" — a question whose honest
// answer embarrasses someone in front of both families is unsafe even though
// every word passes the filter. These assert the wording rules the migration
// commits to, so a future "fun" addition cannot quietly break them.
// ---------------------------------------------------------------------------

// Words that invite an answer nobody wants on a projector. Not a moderation
// layer — a constraint on what we AUTHOR.
const UNSAFE_STORY_ASKS = [
  /\bembarrass/i, /\bwildest\b/i, /\bsecret/i, /\bnever told\b/i, /\bworst\b/i,
  /\bregret/i, /\bex[- ]/i, /\bcheat/i, /\bdirt\b/i, /\bconfess/i,
];

test('story prompts ask for something good, never for dirt', () => {
  // The shipped set, kept in step with the migrations by the db test that reads
  // the real table; here they are the literals so a bad EDIT is caught too.
  const shipped = [
    'Share a story about your most memorable experience with {who}. Ten seconds.',
    'Brag about {who} for ten seconds. Go.',
    'What are you most proud of {who} for? Ten seconds.',
    'The kindest thing {who} has ever done for you. Ten seconds.',
    'The last time {who} made you laugh. Ten seconds — keep it kind.',
    'What did you think the first time you met {who}? Ten seconds. Be nice.',
    'When did you know these two were it? Ten seconds.',
    'What will you tell their kids about them one day? Ten seconds.',
  ];
  for (const p of shipped) {
    for (const bad of UNSAFE_STORY_ASKS) {
      assert.ok(!bad.test(p), `story prompt invites an unsafe answer (${bad}): ${p}`);
    }
    // And none may trip the existing dare blocklist either.
    assert.equal(isChallengePromptBlocked(p), false, `blocklist rejects: ${p}`);
  }
});

test('the two prompts that could tip carry their steer IN the prompt', () => {
  // "Funniest thing they did" and "first impression" are the two that can turn
  // unkind. The steer has to be where the GUEST reads it — a rule in a doc is
  // not a mechanism.
  assert.match('The last time {who} made you laugh. Ten seconds — keep it kind.', /keep it kind/i);
  assert.match('What did you think the first time you met {who}? Ten seconds. Be nice.', /be nice/i);
});

test('the couple picker writes library_id — the dedup identity, not just the words', () => {
  // ⚠ A SOURCE SCAN, and a narrow one. The action is a cookie-bound server
  // action, so the db test replicates the row it writes rather than invoking
  // it — which proves the SHAPE works and NOT that the action still writes it.
  // This closes that gap for the one field whose loss is silent: without
  // library_id the board resolver's dedup (which matches couple picks BY
  // library_id) cannot see the pick, and Setnayan's auto-fill puts the very
  // same question on the board a second time. Identical on screen, wrong
  // underneath — the failure shows up as a guest being asked twice.
  const src = readFileSync(
    new URL('../app/dashboard/[eventId]/studio/papic/actions.ts', import.meta.url),
    'utf8',
  );
  const start = src.indexOf('export async function addLibraryChallengeAction');
  assert.ok(start > 0, 'addLibraryChallengeAction must exist');
  const body = src.slice(start, src.indexOf('\nexport ', start + 10));
  assert.match(body, /\.from\('papic_missions'\)\s*\.insert\(/, 'it inserts a mission');
  assert.match(body, /library_id:\s*row\.library_id/, 'the insert must carry the library id');
  // And the prompt must come from the LIBRARY ROW, never from the posted form —
  // otherwise any string could be stamped with a library id and inherit its
  // dedup identity.
  assert.match(body, /prompt:\s*row\.prompt/, 'the prompt is read from the library, not the form');
  assert.ok(
    !/prompt:\s*(prompt|formData)/.test(body),
    'the prompt must never come from the submitted form',
  );
});
