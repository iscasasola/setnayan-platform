/**
 * THE FALLBACK PIN — the most load-bearing suite in the guest-avatar build.
 *
 * The defect this feature could ship is not "the avatar looks wrong". It is
 * SILENTLY CHANGING THE ROOM FOR EVERYONE WHO NEVER OPTED IN: every guest in
 * production today has `avatar_config IS NULL`, and if the new branch shifts
 * even one of them out of the instanced crowd, every wedding's 3D walk changes
 * for people who asked for nothing.
 *
 * So this file does not test the avatar. It tests the ABSENCE of one, against a
 * VERBATIM COPY of the rule that shipped before this change (`legacyKind`
 * below, transcribed from guest-venue-3d.tsx's two seat loops as they stood at
 * origin/main d1db86d4f). Over the entire seat matrix, with no avatar present,
 * the new rule must agree with the old one on EVERY seat. A reference
 * implementation rather than a golden list, because a list only pins the cases
 * somebody thought to write down.
 *
 * Run via `test:unit` (tsx --test "lib/**\/*.test.ts").
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  seatRenderKind,
  seatIsIndividual,
  seatJoinsCrowd,
  avatarsBySeat,
  type SeatRenderKind,
} from './venue-avatars';
import { defaultChibiConfig, type ChibiAvatarConfig } from './chibi-config';

// ─────────────────────────────────────────────────────────────────────────────
// The shipped rule, transcribed
// ─────────────────────────────────────────────────────────────────────────────

/**
 * guest-venue-3d.tsx BEFORE this change, both loops folded into one function.
 *
 * GuestTable's chair loop:
 *     const taken = occupied?.has(i);
 *     const mine  = yourSeat === i;
 *     if (!taken && !mine) return null;                    // → nothing drawn
 *     const photoUrl = taken ? photoBySeat?.get(i) ?? null : null;
 *     if (!mine && !photoUrl) return null;                 // → the crowd batch
 *     ...individual <SeatedFigure>
 *
 * crowdSeats' loop:
 *     if (!occupied.has(i) || yourSeat === i || photoBySeat?.get(i)) continue;
 *     ...push into InstancedSeatedCrowd
 *
 * Note the `taken ? … : null` above: on the viewer's OWN unoccupied seat the
 * old code never even looked the photo up. Transcribed faithfully — this is a
 * reference, not a tidy-up.
 */
function legacyKind(seat: {
  occupied: boolean;
  mine: boolean;
  photoUrl?: string | null;
}): SeatRenderKind {
  const taken = seat.occupied;
  const mine = seat.mine;
  if (!taken && !mine) return 'empty';
  const photoUrl = taken ? seat.photoUrl ?? null : null;
  if (!mine && !photoUrl) return 'crowd';
  return mine ? 'self' : 'photo';
}

const OCCUPIED = [true, false];
const MINE = [true, false];
const PHOTOS = [null, undefined, '', 'https://example.test/a.jpg'];

/** Every seat the walk can present, as the two loops see it. */
function everySeat(): { occupied: boolean; mine: boolean; photoUrl?: string | null }[] {
  const out: { occupied: boolean; mine: boolean; photoUrl?: string | null }[] = [];
  for (const occupied of OCCUPIED) {
    for (const mine of MINE) {
      for (const photoUrl of PHOTOS) out.push({ occupied, mine, photoUrl });
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// THE guarantee
// ─────────────────────────────────────────────────────────────────────────────

test('NO AVATAR → byte-identical routing to the rule that shipped, on every seat', () => {
  const seats = everySeat();
  assert.equal(seats.length, 16, 'the seat matrix must actually be enumerated');
  let checked = 0;
  for (const seat of seats) {
    // Both spellings of "this guest has no avatar" — the field absent, and the
    // field explicitly null. A payload with no `avatars` block gives the first;
    // a guest row with avatar_config NULL gives the second.
    for (const avatarConfig of [undefined, null] as const) {
      const now = seatRenderKind({ ...seat, avatarConfig });
      const before = legacyKind(seat);
      assert.equal(
        now,
        before,
        `seat ${JSON.stringify(seat)} avatarConfig=${String(avatarConfig)}: ` +
          `routed '${now}', shipped rule says '${before}'`,
      );
      checked++;
    }
  }
  assert.equal(checked, 32);
});

test('NO AVATAR → the two loops still partition the room exactly as before', () => {
  // Individual and crowd must stay disjoint (nobody drawn twice) and must
  // together cover every seat the old rule drew (nobody vanishes).
  for (const seat of everySeat()) {
    const kind = seatRenderKind({ ...seat, avatarConfig: null });
    assert.equal(
      seatIsIndividual(kind) && seatJoinsCrowd(kind),
      false,
      'a seat may never be both individual and batched',
    );
    const drawn = seatIsIndividual(kind) || seatJoinsCrowd(kind);
    assert.equal(drawn, legacyKind(seat) !== 'empty', 'drawn-ness must not change');
  }
});

test('WITH avatars, the two loops STILL partition the room — nobody drawn twice', () => {
  // The gap a mutation run found: the byte-identical suite above only ever
  // exercises seats with NO avatar, so widening `seatJoinsCrowd` to also claim
  // 'avatar' seats — which would draw an avatar guest individually AND batch a
  // neutral mannequin into the same chair, two figures in one seat — passed
  // every assertion. This closes it over the full matrix in BOTH avatar states.
  const cfg = defaultChibiConfig('T1:0');
  let sawAvatar = 0;
  for (const seat of everySeat()) {
    for (const avatarConfig of [cfg, null] as const) {
      const kind = seatRenderKind({ ...seat, avatarConfig });
      if (kind === 'avatar') sawAvatar++;
      assert.equal(
        seatIsIndividual(kind) && seatJoinsCrowd(kind),
        false,
        `seat ${JSON.stringify(seat)} kind='${kind}' is claimed by BOTH loops`,
      );
      assert.equal(
        seatIsIndividual(kind) || seatJoinsCrowd(kind),
        kind !== 'empty',
        `seat ${JSON.stringify(seat)} kind='${kind}' is claimed by NEITHER loop`,
      );
    }
  }
  // Guard the guard: if no seat in the matrix ever reached 'avatar', the
  // disjointness assertion above would be vacuous for the new branch.
  assert.ok(sawAvatar > 0, 'the matrix must actually produce avatar seats');
});

test('FLAG OFF → a payload full of avatars still resolves to nothing', () => {
  // The other half of the fallback: even if the RPC starts returning avatars
  // (a payload change deploys ahead of the flag), an unflagged room must not
  // see one. `avatarsBySeat(..., false)` is the whole gate.
  const rows = [
    { table: 'T1', seatNumber: 0, config: defaultChibiConfig('T1:0') },
    { table: 'T1', seatNumber: 3, config: defaultChibiConfig('T1:3') },
    { table: 'T2', seatNumber: 1, config: defaultChibiConfig('T2:1') },
  ];
  const off = avatarsBySeat(rows, false);
  assert.equal(off.size, 0, 'flag off must yield an empty index');
  const on = avatarsBySeat(rows, true);
  assert.equal(on.size, 2);
  assert.equal(on.get('T1')?.size, 2);
  // And with the index empty, every occupied stranger seat is still 'crowd'.
  assert.equal(
    seatRenderKind({ occupied: true, mine: false, avatarConfig: off.get('T1')?.get(0) ?? null }),
    'crowd',
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// The new branch, and where it may NOT reach
// ─────────────────────────────────────────────────────────────────────────────

test('an avatar ONLY ever converts a seat the old rule sent to the crowd', () => {
  const cfg = defaultChibiConfig('T1:0');
  for (const seat of everySeat()) {
    const before = legacyKind(seat);
    const withAvatar = seatRenderKind({ ...seat, avatarConfig: cfg });
    if (before === 'crowd') {
      assert.equal(withAvatar, 'avatar', `crowd seat ${JSON.stringify(seat)} should become avatar`);
    } else {
      assert.equal(
        withAvatar,
        before,
        `seat ${JSON.stringify(seat)} was '${before}' and must stay '${before}'`,
      );
    }
  }
});

test('a real selfie beats a cartoon — a photo seat never downgrades to an avatar', () => {
  const cfg = defaultChibiConfig('T1:0');
  assert.equal(
    seatRenderKind({ occupied: true, mine: false, photoUrl: 'https://x.test/p.jpg', avatarConfig: cfg }),
    'photo',
  );
  // …and the viewer's own seat keeps its 'self' semantics (accent + gold ring)
  // whatever else it carries.
  assert.equal(
    seatRenderKind({ occupied: true, mine: true, photoUrl: 'https://x.test/p.jpg', avatarConfig: cfg }),
    'self',
  );
  assert.equal(seatRenderKind({ occupied: true, mine: true, avatarConfig: cfg }), 'self');
});

test('an unoccupied stranger seat stays empty even when an avatar row exists', () => {
  // A stale avatar row for a guest who was since unseated must not resurrect a
  // figure at an empty chair.
  assert.equal(
    seatRenderKind({ occupied: false, mine: false, avatarConfig: defaultChibiConfig('T1:0') }),
    'empty',
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// avatarsBySeat: junk in, room still stands
// ─────────────────────────────────────────────────────────────────────────────

test('avatarsBySeat skips rows with no config rather than hash-rolling one', () => {
  // THE trap: resolveChibiConfig(id, null) happily returns a full hash-default
  // config. If a null-config row were indexed anyway, EVERY seated guest would
  // sprout an avatar the moment the RPC started returning a row per seat.
  const m = avatarsBySeat(
    [
      { table: 'T1', seatNumber: 0, config: null },
      { table: 'T1', seatNumber: 1 },
      { table: 'T1', seatNumber: 2, config: undefined },
    ],
    true,
  );
  assert.equal(m.size, 0);
});

test('avatarsBySeat never throws on junk and repairs to a valid config', () => {
  const m = avatarsBySeat(
    [
      { table: 'T1', seatNumber: 0, config: { hairStyle: 'buns', outfit: 'not-a-real-outfit' } },
      { table: 'T1', seatNumber: 1, config: 'a string' },
      { table: 'T1', seatNumber: 2, config: 42 },
      // Malformed keys are dropped, not indexed under a bogus key.
      { table: 'T1', seatNumber: 1.5, config: { hairStyle: 'bob' } },
      { table: 7 as unknown as string, seatNumber: 0, config: { hairStyle: 'bob' } },
    ],
    true,
  );
  const t1 = m.get('T1');
  assert.ok(t1);
  assert.deepEqual([...t1.keys()].sort((a, b) => a - b), [0, 1, 2]);
  const zero = t1.get(0) as ChibiAvatarConfig;
  assert.equal(zero.hairStyle, 'buns', 'a valid stored field wins');
  assert.equal(
    zero.outfit,
    defaultChibiConfig('T1:0').outfit,
    'an out-of-catalog field falls back to that seat\'s hash default',
  );
  assert.equal(m.size, 1, 'a non-string table key must not create an entry');
});

test('avatarsBySeat is stable — same rows, same configs, every call', () => {
  const rows = [{ table: 'T9', seatNumber: 4, config: { hairStyle: 'pony' } }];
  const a = avatarsBySeat(rows, true).get('T9')?.get(4);
  const b = avatarsBySeat(rows, true).get('T9')?.get(4);
  assert.deepEqual(a, b);
  // The hash id is the SEAT key, so two seats resolve independently.
  const other = avatarsBySeat([{ table: 'T9', seatNumber: 5, config: {} }], true).get('T9')?.get(5);
  assert.notDeepEqual(a, other);
});

test('a null/absent avatars block yields an empty index', () => {
  assert.equal(avatarsBySeat(null, true).size, 0);
  assert.equal(avatarsBySeat(undefined, true).size, 0);
  assert.equal(avatarsBySeat([], true).size, 0);
});
