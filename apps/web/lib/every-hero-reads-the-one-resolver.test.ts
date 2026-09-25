/**
 * every-hero-reads-the-one-resolver.test.ts — "made once, used everywhere",
 * held as a property of the source (Maker Phase 6).
 *
 * Owner, 2026-09-24: *"hero widget applies to save the date, invitation, on the
 * day and the thumbnail poster"*. The hub and the poster disagreed before because
 * each read `landing_page_hero_image_url` for itself. So every surface named
 * below must ask `resolveHero(` (`lib/event-hero.ts`) and must not turn the raw
 * column into a picture on its own — not through a signer, not by trimming it.
 *
 * Anchored PER FILE with the count printed; the detector is proven to fire.
 * Prints & Tickets (Phase 9) joins this list when it lands.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const SURFACES = [
  'app/[slug]/_lib/loaders.ts', // the Event Hub's hero, every stage
  'app/dashboard/(launcher)/page.tsx', // the home board's poster + event card
  'lib/celebration-poster.ts', // the celebration poster's sheet
  'lib/celebration-card-identity.ts', // the celebration card
  'lib/story-cover.ts', // Post Event starts from the hero
  'app/dashboard/[eventId]/launch/_components/maker-made-once.tsx', // the Maker's Hero + poster preview
  'lib/print-set.server.ts', // Prints & Tickets — the hero on paper (Phase 9)
];

/** A raw hero column handed straight to a picture: signed, trimmed, or rendered. */
const RAW_HERO = /(?:displayUrlForStoredAsset|siteMediaServeRef|renderableImageSrc|trimmed)\s*\(\s*[\w.?]*landing_page_hero_(?:image_url|video_r2_key)|landing_page_hero_(?:image_url|video_r2_key)\s*\?\.\s*trim\s*\(/;

test('every hero surface asks resolveHero, and none reads the raw column into a picture', () => {
  for (const rel of SURFACES) {
    const code = read(rel);
    const calls = (code.match(/\bresolveHero\s*\(/g) ?? []).length;
    console.log(`[one-hero] ${rel}: resolveHero × ${calls}`);
    assert.ok(calls >= 1, `${rel} no longer asks resolveHero — the hero and the poster can disagree again`);
    const raw = code.match(RAW_HERO);
    assert.equal(raw, null, `${rel} reads the hero column for itself: "${raw?.[0]}"`);
  }
});

test('the detector can fire (anti-vacuity)', () => {
  for (const line of [
    'displayUrlForStoredAsset(siteMediaServeRef(event.landing_page_hero_image_url))',
    'siteMediaServeRef(r.landing_page_hero_image_url)',
    'const heroUrl = event.landing_page_hero_image_url?.trim() || null;',
    'const key = trimmed(event.landing_page_hero_image_url);',
  ]) {
    assert.match(line, RAW_HERO, `the detector missed: ${line}`);
  }
  assert.doesNotMatch('displayUrlForStoredAsset(resolveHero(r).photoRef)', RAW_HERO);
});
