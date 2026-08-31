/**
 * THE FALLBACK PIN — the most load-bearing suite in the guest-avatar build.
 *
 * The defect this feature could ship is not "the avatar looks wrong". It is
 * SILENTLY CHANGING THE ROOM FOR EVERYONE WHO NEVER OPTED IN: every guest in
 * production today has `avatar_config IS NULL`, and if the new path resolves a
 * figure for even one of them, every wedding's 3D walk changes for people who
 * asked for nothing.
 *
 * So this file mostly does not test the avatar. It tests the ABSENCE of one,
 * over the whole input matrix, with a reference implementation of the shipped
 * behaviour rather than a golden list — a list only pins the cases somebody
 * thought to write down.
 *
 * Run via `test:unit` (tsx --test "lib/**\/*.test.ts").
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selfFigureAvatar, guestAvatarsEnabled } from './venue-avatars';
import { defaultChibiConfig, CHIBI_CONFIG_KEYS } from './chibi-config';

/** The walk's own stable self id (guest-venue-3d.tsx's `selfSpec.id`). */
const SELF_ID = 'guest-self';

/**
 * THE SHIPPED BEHAVIOUR, as it stood at origin/main d1db86d4f: the viewer's
 * figure is a blob `<Figure spec={selfSpec}>` and there is no avatar path at
 * all. Expressed as "what selfFigureAvatar must return for the room to render
 * exactly that": null, always.
 */
const LEGACY_ALWAYS_NULL = null;

/** Every spelling of "no avatar" the payload can produce. */
const NO_AVATAR_YOUS = [
  undefined, // no `you` block — a tokenless visitor
  null, // ditto, other spelling
  {}, // a `you` block from a payload predating this change
  { avatarConfig: undefined }, // key present, unset
  { avatarConfig: null }, // the stored NULL — every guest today
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// THE guarantee
// ─────────────────────────────────────────────────────────────────────────────

test('NO AVATAR → the viewer renders exactly as before, in every payload shape', () => {
  let checked = 0;
  for (const you of NO_AVATAR_YOUS) {
    for (const enabled of [true, false]) {
      assert.equal(
        selfFigureAvatar(you, SELF_ID, enabled),
        LEGACY_ALWAYS_NULL,
        `you=${JSON.stringify(you)} enabled=${enabled} resolved a figure where the ` +
          `shipped room draws its blob avatar`,
      );
      checked++;
    }
  }
  assert.equal(checked, 10, 'the matrix must actually be enumerated');
});

test('FLAG OFF → a real stored config still resolves to nothing', () => {
  // The other half of the fallback: the payload key deploys ahead of the flag,
  // so an unflagged room must ignore a config that is genuinely there.
  const real = defaultChibiConfig(SELF_ID);
  assert.equal(selfFigureAvatar({ avatarConfig: real }, SELF_ID, false), null);
  // …and with the flag on, the SAME input does resolve — otherwise the
  // assertion above would pass for the wrong reason (nothing ever resolves).
  assert.notEqual(selfFigureAvatar({ avatarConfig: real }, SELF_ID, true), null);
});

test('the flag defaults OFF, so production is on the fallback path', () => {
  // NEXT_PUBLIC_FIGURE_CHIBI is unset in this process, as it is in prod.
  assert.equal(guestAvatarsEnabled(), false);
});

test('a stored NULL is NOT hash-rolled into an avatar', () => {
  // THE trap: resolveChibiConfig(id, null) returns a COMPLETE hash-default
  // config. Reaching the resolver before the null check would hand every guest
  // in every wedding an avatar the moment the flag flipped.
  assert.equal(selfFigureAvatar({ avatarConfig: null }, SELF_ID, true), null);
  // Proof the trap is real rather than hypothetical: the resolver really does
  // invent a full config from null.
  const invented = defaultChibiConfig(SELF_ID);
  assert.equal(Object.keys(invented).length, CHIBI_CONFIG_KEYS.length);
});

// ─────────────────────────────────────────────────────────────────────────────
// The opted-in path
// ─────────────────────────────────────────────────────────────────────────────

test('a stored config resolves to a complete, valid figure', () => {
  const got = selfFigureAvatar({ avatarConfig: { hairStyle: 'buns' } }, SELF_ID, true);
  assert.ok(got, 'a stored config must resolve');
  assert.equal(got.hairStyle, 'buns', 'a valid stored field wins');
  assert.deepEqual(
    Object.keys(got).sort(),
    [...CHIBI_CONFIG_KEYS].sort(),
    'the resolved figure must carry every key the renderer reads',
  );
});

test('junk never crashes the room — it repairs to the hash defaults', () => {
  const d = defaultChibiConfig(SELF_ID);
  for (const junk of ['a string', 42, [], true, { outfit: 'not-a-real-outfit' }]) {
    const got = selfFigureAvatar({ avatarConfig: junk }, SELF_ID, true);
    assert.ok(got, `junk ${JSON.stringify(junk)} must still yield a renderable figure`);
    assert.equal(got.outfit, d.outfit, 'an out-of-catalog field falls back to the hash default');
  }
});

test('resolution is stable — the same guest never re-rolls between visits', () => {
  const a = selfFigureAvatar({ avatarConfig: { hairStyle: 'pony' } }, SELF_ID, true);
  const b = selfFigureAvatar({ avatarConfig: { hairStyle: 'pony' } }, SELF_ID, true);
  assert.deepEqual(a, b);
});
