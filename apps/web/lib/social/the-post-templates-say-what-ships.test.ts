/**
 * the-post-templates-say-what-ships.test.ts — content finalization 27 Nov 2026, section S (PR A).
 *
 * The drafted Facebook captions are public copy. They follow docs/brand.md: "supplier", never "vendor";
 * no promise words ("vetted", "trusted", "every single one"); "Logo Maker", never "Monogram"; event-neutral
 * ("hosts", not "couples"); and no retired product (the reel booth retired 20 Nov 2026).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  SHARE_ARTIFACT_LABEL,
  SHARE_ARTIFACT_TYPES,
  coupleCreationCaption,
  vendorFeatureCaption,
} from '@/lib/social-sharing';
import { MILESTONE_CAPTIONS, MILESTONE_METRICS, badgePostCopy } from '@/lib/social/lane-s';

const BANNED = /\bvendors?\b|vetted|trusting|trusted|every single one|monogram|\breel\b|marketplace,/i;

test('S1 · the verified-suppliers milestone reads the approved line', () => {
  assert.equal(
    MILESTONE_CAPTIONS.vendors_verified(120),
    "✅ 120+ verified suppliers on Setnayan. A person checks each one's business papers. Set na 'yan.\n\n#Setnayan #SetNaYan",
  );
});

test('S2 · the events milestone thanks hosts without a trust claim', () => {
  assert.match(MILESTONE_CAPTIONS.events_created(50), /Salamat for planning with us\. ✨/);
});

test('every milestone caption is free of banned words', () => {
  for (const metric of MILESTONE_METRICS) {
    assert.doesNotMatch(MILESTONE_CAPTIONS[metric](1000), BANNED, metric);
  }
});

test('S3 · a badge post links the supplier search, never /vendors', () => {
  for (const named of [true, false]) {
    const copy = badgePostCopy({
      rewardKey: 'reviews:25',
      named,
      businessName: 'Liwanag Studio',
      businessSlug: null,
      categoryLabel: 'Photographer',
      region: 'Cebu',
      origin: 'https://www.setnayan.com/',
    });
    assert.equal(copy.linkUrl, 'https://www.setnayan.com/suppliers');
    assert.doesNotMatch(copy.body, /\/vendors/);
  }
});

test('S5 · the named supplier welcome reads the approved line', () => {
  assert.equal(
    vendorFeatureCaption({ named: true, businessName: ' Liwanag Studio ', categoryLabel: 'Photographer', region: 'Cebu' }),
    "Welcome to Setnayan, Liwanag Studio! A newly verified photographer serving Cebu. Set na 'yan.\n\n#Setnayan #SetNaYan",
  );
  const unnamed = vendorFeatureCaption({ named: false, businessName: '', categoryLabel: 'Caterer', region: 'Iloilo' });
  assert.doesNotMatch(unnamed, BANNED);
});

test('S6 · the logo is called a logo, made with Logo Maker', () => {
  assert.equal(SHARE_ARTIFACT_LABEL.monogram, 'Logo');
  assert.match(
    coupleCreationCaption({ artifactType: 'monogram', creditMode: 'first_names', coupleName: 'Ana & Ben' }),
    /^This logo belongs to Ana & Ben, made with Logo Maker on Setnayan\./,
  );
});

test('S7 · the retired reel is not a share artifact any more', () => {
  assert.deepEqual([...SHARE_ARTIFACT_TYPES], ['monogram', 'save_the_date', 'website']);
  assert.equal((SHARE_ARTIFACT_TYPES as readonly string[]).includes('reel'), false);
  assert.equal('reel' in SHARE_ARTIFACT_LABEL, false);
});

test('S8 · an anonymous credit says hosts, not couples', () => {
  for (const artifactType of SHARE_ARTIFACT_TYPES) {
    const caption = coupleCreationCaption({ artifactType, creditMode: 'anonymous', coupleName: 'Ana & Ben' });
    assert.match(caption, /one of our Setnayan hosts/);
    assert.doesNotMatch(caption, BANNED, artifactType);
  }
  const recap = fs.readFileSync(path.join(__dirname, 'recap-post.ts'), 'utf8');
  assert.doesNotMatch(recap, /Setnayan couples?'/, 'the recap fallback names hosts or the event');
});

test('S9 · the Social-queue composer no longer offers CHANGELOG headlines', () => {
  assert.equal(fs.existsSync(path.join(__dirname, 'changelog-suggestions.ts')), false);
  const surface = fs.readFileSync(
    path.join(__dirname, '..', '..', 'app', 'admin', 'studio', '_surfaces', 'social-queue-surface.tsx'),
    'utf8',
  );
  assert.doesNotMatch(surface, /changelog/i);
});
