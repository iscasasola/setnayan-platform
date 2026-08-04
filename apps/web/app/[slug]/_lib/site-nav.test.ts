/**
 * Every owner ruling about the event-site bar, pinned.
 *
 * These are not layout tests. Each one is a DECISION the owner made on
 * 2026-08-03, and decisions are what regress — someone "tidies" a branch and
 * quietly reverses a product rule nobody remembers. The failure message names
 * the ruling so the next person knows they are changing a decision.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSiteNav, type NavInput, type NavSlot, type VendorKit } from './site-nav';

const base: NavInput = {
  viewer: { kind: 'guest' },
  phase: 'day',
  hostAllowsCamera: true,
  anyChapterPublic: true,
  liveBroadcast: false,
  // A real caller always resolves these — it knows the slug and the guest's
  // token. Absent, a slot correctly LOCKS rather than pointing nowhere, which
  // is its own assertion below.
  destinations: { camera: '/papic/guest', watch: '/maria-and-jose/hub' },
};
const at = (o: Partial<NavInput>) => resolveSiteNav({ ...base, ...o });
const keys = (s: NavSlot[]) => s.map((x) => x.key);
const cam = (s: NavSlot[]) => s.find((x) => x.key === 'camera');

test('nav · a slot with no destination LOCKS rather than pointing nowhere', () => {
  // The caller resolves destinations; if it cannot build one (no token, no
  // stream), the slot must not render as a live link to "#". A link that goes
  // nowhere is the dead button this whole bar exists to avoid.
  const noDest = at({ viewer: { kind: 'couple' }, destinations: {} });
  const cameraSlot = cam(noDest);
  assert.equal(cameraSlot?.state, 'locked');
  assert.ok(cameraSlot?.lockedReason);
});

test('nav · every slot carries a destination, and no live slot points at "#"', () => {
  for (const viewer of [
    { kind: 'public' as const },
    { kind: 'guest' as const },
    { kind: 'couple' as const },
    { kind: 'vendor' as const, kits: [] as VendorKit[] },
  ])
    for (const phase of ['before', 'day', 'after'] as const)
      for (const liveBroadcast of [true, false])
        for (const slot of at({ viewer, phase, liveBroadcast })) {
          assert.ok(slot.href, `${slot.key} has no destination`);
          if (slot.state === 'live') {
            assert.notEqual(slot.href, '#', `${slot.key} is live but points at "#"`);
          }
        }
});

test('nav · the bar never exceeds five slots, for anyone, in any phase', () => {
  const viewers = [
    { kind: 'public' as const },
    { kind: 'guest' as const },
    { kind: 'couple' as const },
    { kind: 'vendor' as const, kits: ['stage_script', 'floor_command'] as VendorKit[] },
  ];
  for (const viewer of viewers)
    for (const phase of ['before', 'day', 'after'] as const)
      for (const hostAllowsCamera of [true, false])
        for (const anyChapterPublic of [true, false])
          for (const liveBroadcast of [true, false]) {
            const s = at({ viewer, phase, hostAllowsCamera, anyChapterPublic, liveBroadcast });
            assert.ok(
              s.length <= 5,
              `${viewer.kind}/${phase} produced ${s.length} slots — the bar holds five`,
            );
            // Home and Me bracket every bar, always.
            assert.equal(s[0]?.key, 'home');
            assert.equal(s[s.length - 1]?.key, 'me');
            // A locked slot must always say why.
            for (const slot of s) {
              if (slot.state === 'locked') assert.ok(slot.lockedReason, `${slot.key} locked with no reason`);
            }
          }
});

test('nav · RULING: the couple always have their Papic — no switch, no phase removes it', () => {
  for (const phase of ['before', 'day', 'after'] as const)
    for (const hostAllowsCamera of [true, false]) {
      const c = cam(at({ viewer: { kind: 'couple' }, phase, hostAllowsCamera }));
      assert.ok(c, `couple lost their camera at ${phase}, hostAllows=${hostAllowsCamera}`);
      assert.equal(c.state, 'live', 'the couple’s own camera must never be locked');
    }
});

test('nav · RULING: for everyone else the HOST’S SWITCH is the gate — and a closed camera is LOCKED, never absent', () => {
  for (const kind of ['public', 'guest'] as const) {
    const open = cam(at({ viewer: { kind }, hostAllowsCamera: true }));
    assert.equal(open?.state, 'live');

    const shut = cam(at({ viewer: { kind }, hostAllowsCamera: false }));
    assert.ok(shut, `${kind} lost the camera slot entirely — it must be DRAWN and locked, because ` +
      `the camera is part of what the invitation promises`);
    assert.equal(shut.state, 'locked');
    assert.match(shut.lockedReason ?? '', /host/i);
  }
});

test('nav · RULING: a private gallery is NOT DRAWN — announce features, hide content', () => {
  // The asymmetry with the locked camera is the point. A locked camera reveals
  // a FEATURE that is coming. A greyed gallery would reveal that PHOTOGRAPHS
  // EXIST AND ARE WITHHELD — the very thing the couple asked to keep private.
  for (const kind of ['public', 'guest'] as const)
    for (const phase of ['day', 'after'] as const) {
      const s = at({ viewer: { kind }, phase, anyChapterPublic: false });
      assert.ok(
        !keys(s).includes('gallery'),
        `${kind}/${phase} still shows a Gallery slot with nothing public — a dimmed gallery ` +
          `leaks the fact that withheld photos exist`,
      );
      // …and no locked stand-in either.
      assert.ok(!s.some((x) => x.key === 'gallery' && x.state === 'locked'));
    }
  // The couple always keeps it — they see what they have not shared.
  const couple = at({ viewer: { kind: 'couple' }, phase: 'day', anyChapterPublic: false });
  assert.ok(keys(couple).includes('gallery'));
});

test('nav · RULING: "papic button as well" — a live broadcast must not cost the gallery', () => {
  const s = at({ viewer: { kind: 'guest' }, phase: 'day', liveBroadcast: true });
  const k = keys(s);
  assert.ok(k.includes('watch'), 'no Watch slot during a live broadcast');
  assert.ok(k.includes('camera'), 'Watch displaced the camera');
  assert.ok(
    k.includes('gallery'),
    'Watch took the Gallery slot — an earlier draft did exactly this, and the gallery ' +
      'vanished the moment the livestream began',
  );
});

test('nav · RULING: a supplier’s kit follows what they were booked for, and it is a SET', () => {
  const label = (kits: VendorKit[]) =>
    at({ viewer: { kind: 'vendor', kits } }).at(-1)?.label;

  assert.equal(label(['song_desk']), 'Songs');
  assert.equal(label(['stage_script']), 'Script');
  assert.equal(label(['floor_command']), 'Floor');
  // One person, two roles — "there is a stylist and an emcee both in 1 service".
  assert.equal(label(['stage_script', 'floor_command']), 'Kits');
  // A caterer maps to none. Not a failure: the ordinary kit is their whole kit.
  assert.equal(label([]), 'Tools');
});

test('nav · suppliers get no camera — Papic is a guest product', () => {
  for (const phase of ['before', 'day', 'after'] as const) {
    const s = at({ viewer: { kind: 'vendor', kits: [] }, phase, hostAllowsCamera: true });
    assert.ok(
      !keys(s).includes('camera'),
      'a supplier was offered Papic — it is friends-and-family candids, not their trade',
    );
  }
});

test('nav · NAMING LOCK: the photo slot is "Gallery", never "Photos"', () => {
  // site-menu.ts carries the owner rename. A prototype used "Photos" and would
  // have shipped the wrong word.
  const s = at({ viewer: { kind: 'guest' }, phase: 'after' });
  const g = s.find((x) => x.key === 'gallery');
  assert.equal(g?.label, 'Gallery');
  assert.ok(!s.some((x) => x.label === 'Photos'));
});

test('nav · every label is one word — a wrapped label tilts the whole bar', () => {
  const viewers = [
    { kind: 'public' as const },
    { kind: 'guest' as const },
    { kind: 'couple' as const },
    { kind: 'vendor' as const, kits: ['stage_script'] as VendorKit[] },
    { kind: 'vendor' as const, kits: [] as VendorKit[] },
  ];
  for (const viewer of viewers)
    for (const phase of ['before', 'day', 'after'] as const)
      for (const liveBroadcast of [true, false])
        for (const slot of at({ viewer, phase, liveBroadcast })) {
          assert.ok(
            !slot.label.includes(' '),
            `"${slot.label}" contains a space — at ~70px a two-word label wraps, grows its ` +
              `slot, and tilts the bar`,
          );
          assert.ok(slot.label.length <= 9, `"${slot.label}" is too long for a 70px slot`);
        }
});
