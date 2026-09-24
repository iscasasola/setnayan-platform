/**
 * a-background-kind-cannot-smuggle-a-ref.test.ts
 *
 * A section background is chosen by the couple and stored in
 * `invitation_widgets.config_json`, which is COUPLE-WRITABLE. That single fact
 * is why `media` has always been held to the public bucket by `hubMediaRef`:
 * a ref naming `setnayan-thread-files` or `setnayan-vendor-verification` must
 * never reach the signer from a field a customer can write.
 *
 * 🔑 ADDING A `kind` ADDS TWO WAYS TO GET THAT WRONG, and they pull in
 * opposite directions:
 *
 *   · a SNIPPET is a ref like any other, so it must pass the SAME allow-list.
 *     Giving video its own field would be a second door to check, and the
 *     second door is the one nobody checks.
 *   · a COLOUR is not a reference at all. If a colour could travel as a ref,
 *     it would be a doorway into the same field with no allow-list on it —
 *     smuggling a private bucket past the check by calling it a colour.
 *
 * Both directions are sabotaged below, because a fence only one side of which
 * has been pushed on is a fence nobody has tested.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HUB_BACKGROUND_KINDS,
  hubBackgroundColor,
  resolveHubBackground,
  sanitizeHubCanvas,
} from './hub-canvas';
import { PUBLIC_R2_BUCKET } from './r2-client-ref';

const PUBLIC_REF = `r2://${PUBLIC_R2_BUCKET}/events/E1/hero.jpg`;
const PRIVATE_REFS = [
  'r2://setnayan-thread-files/anything.mp4',
  'r2://setnayan-vendor-verification/id.png',
  'r2://some-bucket-we-never-heard-of/x.jpg',
];

test('⛔ a SNIPPET is held to exactly the same bucket as a photo', () => {
  for (const bad of PRIVATE_REFS) {
    const out = sanitizeHubCanvas({ kind: 'snippet', media: bad });
    assert.equal(out.media, undefined, `${bad} survived as a snippet's media`);
    // …and the KIND must not survive either. A snippet with no media left is
    // evidence to a later reader that the media was once valid.
    assert.equal(out.kind, undefined, `${bad} left a snippet kind with nothing to play`);
    assert.equal(resolveHubBackground(out), null);
  }
  const ok = sanitizeHubCanvas({ kind: 'snippet', media: PUBLIC_REF });
  assert.deepEqual(resolveHubBackground(ok), { kind: 'snippet', media: PUBLIC_REF });
});

test('⛔ a COLOUR never takes the ref path — it cannot carry r2:// at all', () => {
  for (const smuggled of [...PRIVATE_REFS, PUBLIC_REF, 'https://example.test/a.png', '1']) {
    assert.equal(
      hubBackgroundColor(smuggled),
      null,
      `${smuggled} was accepted as a colour — the ref path has a second door`,
    );
    const out = sanitizeHubCanvas({ kind: 'color', color: smuggled });
    assert.equal(out.color, undefined);
    assert.equal(out.kind, undefined, 'a colour kind survived with nothing to paint');
  }
  const ok = sanitizeHubCanvas({ kind: 'color', color: '#A9834B' });
  assert.deepEqual(resolveHubBackground(ok), { kind: 'color', color: '#a9834b' });
});

test('⛔ a colour cannot be smuggled through `media`, nor a ref through `color`', () => {
  // The two fields are separate BECAUSE they have different checks. Crossing
  // them must not produce a background.
  const a = sanitizeHubCanvas({ kind: 'color', media: PRIVATE_REFS[0] });
  assert.equal(a.media, undefined);
  assert.equal(resolveHubBackground(a), null, 'a colour kind rendered a private ref');

  const b = sanitizeHubCanvas({ kind: 'photo', color: '#a9834b' });
  assert.equal(b.color, undefined, 'a colour rode in on a photo');
});

test('🔑 an existing media-only row IS a photo — the rule, not a fallback', () => {
  // Every config_json written before `kind` existed looks exactly like this.
  const legacy = sanitizeHubCanvas({ media: PUBLIC_REF });
  assert.equal(legacy.kind, undefined, 'nothing is invented on the way in');
  assert.deepEqual(
    resolveHubBackground(legacy),
    { kind: 'photo', media: PUBLIC_REF },
    'a row from before this build must read as a photo, not as half-written',
  );
});

test('⛔ no background at all resolves to null, never an empty frame', () => {
  assert.equal(resolveHubBackground({}), null);
  assert.equal(resolveHubBackground({ kind: 'color' }), null, 'a colour with no colour');
  assert.equal(resolveHubBackground({ kind: 'snippet' }), null, 'a snippet with no media');
});

test('⛔ an unknown kind is DROPPED, never repaired', () => {
  for (const junk of ['video', 'Photo', 'film', '', null, 7, {}]) {
    const out = sanitizeHubCanvas({ kind: junk, media: PUBLIC_REF });
    assert.equal(out.kind, undefined, `${JSON.stringify(junk)} was accepted as a kind`);
    // The media is still good, so it still reads as a photo — the safe default.
    assert.deepEqual(resolveHubBackground(out), { kind: 'photo', media: PUBLIC_REF });
  }
  assert.equal(HUB_BACKGROUND_KINDS.length, 3, 'three kinds — a film is deliberately not one');
  assert.ok(!(HUB_BACKGROUND_KINDS as readonly string[]).includes('film'));
});
