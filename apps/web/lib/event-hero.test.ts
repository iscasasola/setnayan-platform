/**
 * event-hero.test.ts — THE ONE HERO resolves one way, and the poster and the
 * hub cannot disagree about it (Maker Phase 6).
 *
 * The build plan's acceptance line: "the poster and the hero resolve to the same
 * ref for ten fixture events". Held here as a property over ten fixtures, and
 * against the two pure poster resolvers that decide from it — the celebration
 * poster's sheet and the celebration card's identity.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveHero, HERO_EVENT_COLUMNS, HERO_STAGES } from './event-hero';
import { GUEST_HERO_VIDEO_PLAYBACK } from './guest-hero-video';
import { resolvePoster } from './celebration-poster';
import { resolveCelebrationIdentity } from './celebration-card-identity';
import { PUBLIC_STAGE_ORDER } from './public-site-stage-labels';

const OWN = (id: string) => `r2://setnayan-media/events/${id}/landing-page-hero/a-photo.jpg`;

/** Ten events the way prod stores them: a photo, none, blank, a private-bucket
 *  ref (refused), a legacy https URL, and clips with and without a photo. */
const FIXTURES = [
  { id: 'e1', landing_page_hero_image_url: OWN('e1'), landing_page_hero_video_r2_key: null },
  { id: 'e2', landing_page_hero_image_url: null, landing_page_hero_video_r2_key: null },
  { id: 'e3', landing_page_hero_image_url: '   ', landing_page_hero_video_r2_key: null },
  { id: 'e4', landing_page_hero_image_url: 'r2://payment-proofs/events/e4/receipt.jpg', landing_page_hero_video_r2_key: null },
  { id: 'e5', landing_page_hero_image_url: 'https://cdn.example/legacy-hero.jpg', landing_page_hero_video_r2_key: null },
  { id: 'e6', landing_page_hero_image_url: OWN('e6'), landing_page_hero_video_r2_key: 'r2://setnayan-media/events/e6/hero.mp4' },
  { id: 'e7', landing_page_hero_image_url: null, landing_page_hero_video_r2_key: 'r2://setnayan-media/events/e7/hero.mp4' },
  { id: 'e8', landing_page_hero_image_url: `  ${OWN('e8')}  `, landing_page_hero_video_r2_key: null },
  { id: 'e9', landing_page_hero_image_url: 42 as unknown as string, landing_page_hero_video_r2_key: null },
  { id: 'e10', landing_page_hero_image_url: 'r2://setnayan-media/', landing_page_hero_video_r2_key: null },
];

test('the hero is a photo exactly when a public-bucket photo is stored, else the written card', () => {
  const kinds = FIXTURES.map((e) => resolveHero(e).kind);
  console.log(`  kinds: ${kinds.join(' ')}`);
  assert.deepEqual(kinds, ['photo', 'card', 'card', 'card', 'photo', 'photo', 'card', 'photo', 'card', 'card']);
  assert.equal(resolveHero(FIXTURES[3]).photoRef, null, 'a private-bucket ref must never become the hero');
});

test('ten fixtures: the poster sheet and the card identity read the SAME hero the hub reads', () => {
  let photos = 0;
  for (const e of FIXTURES) {
    const hero = resolveHero(e);
    const poster = resolvePoster({ landing_page_hero_image_url: e.landing_page_hero_image_url, std_film_accent_hex: '#8a6a2b' });
    const identity = resolveCelebrationIdentity({ landing_page_hero_image_url: e.landing_page_hero_image_url });
    assert.equal(poster.sheet === 'photograph', hero.kind === 'photo', `${e.id}: poster and hub disagree`);
    assert.equal(identity.heroUrl, hero.photoRef, `${e.id}: the card's hero is not the hub's hero`);
    if (hero.kind === 'photo') photos += 1;
  }
  // anti-vacuity: both branches were exercised
  assert.ok(photos > 0 && photos < FIXTURES.length);
});

test('a guest never gets the unscreened hero clip while guest playback is closed; the couple always does', () => {
  const clip = resolveHero(FIXTURES[5]);
  assert.ok(clip.videoRef, 'the couple sees their own clip in their editors');
  assert.equal(clip.guestVideoRef, GUEST_HERO_VIDEO_PLAYBACK ? clip.videoRef : null);
});

test('the hero is made of two columns and shows on three stages before Post Event', () => {
  assert.deepEqual([...HERO_EVENT_COLUMNS], ['landing_page_hero_image_url', 'landing_page_hero_video_r2_key']);
  assert.deepEqual([...HERO_STAGES], PUBLIC_STAGE_ORDER.filter((p) => p !== 'editorial'));
});
