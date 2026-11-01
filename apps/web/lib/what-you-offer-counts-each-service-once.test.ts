/**
 * 🔢 "WHAT YOU OFFER" COUNTS EACH REAL SERVICE ONCE (owner 2026-10-29: "fix her shop and service card").
 *
 * A shop opened through /open-shop carries `services = [coarse, leaf]` (`app/open-shop/actions.ts`: "BOTH the coarse
 * category and the specific leaf go in, coarse FIRST"), and `syncProfileFromCoverages` keeps the coarse keys beside the
 * covered leaves. The maker files every card under its LEAF. Today's `offerProgress` used to count the coarse key as a
 * service of its own — so a one-service stylist was told "6 to go", three of them for a service no card can be filed
 * under, and "Get your shop live" could never tick.
 *
 * Properties: the coarse key beside a leaf is not a service; a coarse key WITH a card of its own is (legacy cards are
 * real); an all-coarse shop keeps its services; a refused card read is "Couldn’t load", never 0 (unchanged); and the
 * server read hands in the coarse set the coverage sync preserves.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { offerProgress, type SetupCard } from './supplier-setup';
import { VENDOR_CATEGORIES } from './vendors';

const COARSE: ReadonlySet<string> = new Set<string>(VENDOR_CATEGORIES);
const WEB = join(import.meta.dirname, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const card = (id: string, service: string, pricePhp: number | null = null): SetupCard => ({ id, service, title: id, pricePhp });

test('an /open-shop shop ([coarse, leaf]) is ONE service — three cards, not six', () => {
  assert.ok(COARSE.has('makeup_artist'), 'the fixture’s coarse key is no longer coarse');
  const none = offerProgress(['makeup_artist', 'bridal_hmua'], [], COARSE);
  assert.deepEqual(none.services.map((s) => s.service), ['bridal_hmua']);
  assert.equal(none.toGo, 3, 'a one-service shop is asked for more than three cards');
  const done = offerProgress(['makeup_artist', 'bridal_hmua'], [card('a', 'bridal_hmua', 1), card('b', 'bridal_hmua', 2), card('c', 'bridal_hmua', 3)], COARSE);
  assert.equal(done.toGo, 0, 'three cards under the leaf still leave the coarse key "to go"');
});

test('two real services are two — and a coarse key with a card of its own is real', () => {
  const two = offerProgress(['makeup_artist', 'bridal_hmua', 'hair_styling_bridal'], [], COARSE);
  assert.deepEqual(two.services.map((s) => s.service), ['bridal_hmua', 'hair_styling_bridal']);
  assert.equal(two.toGo, 6);
  const legacy = offerProgress(['catering', 'grazing_table'], [card('x', 'catering', 450)], COARSE);
  assert.deepEqual(legacy.services.map((s) => [s.service, s.toGo]), [['catering', 2], ['grazing_table', 3]]);
});

test('an all-coarse shop keeps its services (nothing finer chosen yet), and each is counted once', () => {
  const p = offerProgress(['photographer', 'photographer'], [], COARSE);
  assert.deepEqual(p.services.map((s) => s.service), ['photographer']);
  assert.equal(p.toGo, 3);
  assert.equal(offerProgress([], [], COARSE).toGo, 3, 'a shop with no service has one whole service to go');
});

test('the server read hands in the coarse set; a refused card read stays "Couldn’t load", never 0', () => {
  const server = src('lib/vendor-first-steps.server.ts');
  assert.match(server, /const COARSE_SERVICE_KEYS: ReadonlySet<string> = new Set<string>\(VENDOR_CATEGORIES\);/);
  assert.match(
    server,
    /offer: serviceRead\.cards\s*\?\s*offerProgress\(\(profile as \{ services\?: string\[\] \| null \}\)\.services \?\? \[\], serviceRead\.cards, COARSE_SERVICE_KEYS\)\s*:\s*null,/,
    'the rail counts services without the coarse set, or reads a refused card list as a measured one',
  );
  assert.match(server, /return \{ count: 0, cards: null \};/, 'a refused card read must stay unmeasured');
  // The coverage sync preserves exactly this set beside the leaves — the two must name the same thing.
  assert.match(src('lib/vendor-coverage-write.ts'), /const coarse = new Set<string>\(VENDOR_CATEGORIES\);/);
  assert.match(src('lib/supplier-setup.ts'), /badge: offer === null \? \{ word: 'Couldn’t load', tone: 'no' \}/);
});
