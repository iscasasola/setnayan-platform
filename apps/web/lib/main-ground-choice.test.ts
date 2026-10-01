/**
 * main-ground-choice.test.ts — PRESSING "UPLOAD MEDIA" OPENS THE PICTURES,
 * WHATEVER IS STORED.
 *
 * The owner pressed Behind every scene → "Upload media" on his own event
 * (stored `{ ground: 'none' }`) and nothing happened: the stored choice was read
 * before the press, so the picker never drew (2026-10-01). `mainGroundChoice`
 * is the panel's one rule; these run it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mainGroundChoice } from './main-ground-choice';
import type { HubMainGround } from './hub-canvas';

const base = { followsHero: false, heroPhotoRef: null as string | null };

test('a press of Upload media wins over a stored "None" and a stored theme', () => {
  for (const ground of ['none', 'theme'] as const) {
    const current: HubMainGround = { ground };
    assert.equal(mainGroundChoice({ ...base, current, choosingMedia: false }), ground, `${ground} before the press`);
    assert.equal(mainGroundChoice({ ...base, current, choosingMedia: true }), 'media', `${ground} after the press`);
  }
});

test('the press wins with no hero photo and nothing stored', () => {
  assert.equal(mainGroundChoice({ ...base, current: null, choosingMedia: true }), 'media');
});

test('the stored value still decides when nobody pressed', () => {
  const own: HubMainGround = { kind: 'photo', media: 'events/x/main-background/a.jpg' };
  assert.equal(mainGroundChoice({ ...base, current: own, choosingMedia: false }), 'media');
  assert.equal(mainGroundChoice({ ...base, current: null, choosingMedia: false }), 'theme');
  assert.equal(mainGroundChoice({ ...base, heroPhotoRef: 'h.jpg', current: null, choosingMedia: false }), 'hero');
  assert.equal(
    mainGroundChoice({ followsHero: true, heroPhotoRef: 'h.jpg', current: { follow: 'hero', of: 'h.jpg', tint: { match: true, frame: [] } } as unknown as HubMainGround, choosingMedia: false }),
    'hero',
  );
});
