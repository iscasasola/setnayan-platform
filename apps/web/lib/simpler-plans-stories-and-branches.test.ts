/**
 * SIMPLER SUPPLIER PLANS (owner-approved 2026-11-14) — items (8) · (9) · (10), the pure rules and the wiring.
 *
 * Fails if:
 *   (8)  a Free · Plus · Pro shop's story card stops reading "Read their story" and going to the couple's page; an Ultra
 *        card stops opening the shop's OWN page on the shop's address ("Our story of this day"); the shop page stops
 *        asking `featuredStoryLink` with the EFFECTIVE tier; the story page stops reading through the published-story
 *        gate (paid bookings · unlisted events left out · `loadVendorFeaturedStories`) or the host's accepted media.
 *   (9)  "Whole branch" shows with one location; services stop being named by card title or grouped by branch; the
 *        Team save stops dropping a key that is not this shop's.
 *   (10) "Copy to another branch" offers the card's own location, or an unpaid branch; the create gate or the plan
 *        picker counts a branch copy as a card.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { featuredStoryLink, hasStoryPages, OUR_STORY_LINK, READ_THEIR_STORY_LINK, cleanStoryNote, STORY_NOTE_MAX } from '@/lib/ultra-story-pages';
import {
  branchCopyTargets,
  groupByLocation,
  hasManyLocations,
  parseBranchCopyPrice,
  shopLocations,
  whoWorksWhatLine,
  MAIN_BRANCH_KEY,
  type BranchLite,
} from '@/lib/branch-copy';
import { keptFits, type PlanCard } from '@/lib/service-plan-hold';

const WEB = join(__dirname, '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

const CEBU: BranchLite = { id: 'b-cebu', label: 'Cebu', status: 'active' };
const UNPAID: BranchLite = { id: 'b-davao', label: 'Davao', status: 'pending_payment' };

// ── (8) ───────────────────────────────────────────────────────────────────────────────────────────────────────────

test('(8) only Ultra opens the shop’s own story page; every other plan keeps "Read their story"', () => {
  for (const tier of ['free', 'verified', 'solo', 'pro']) {
    assert.equal(hasStoryPages(tier), false, tier);
    assert.deepEqual(featuredStoryLink({ tier, shopSlug: 'lumen', eventSlug: 'ana-marco' }), {
      href: '/ana-marco',
      label: READ_THEIR_STORY_LINK,
      own: false,
    });
  }
  assert.deepEqual(featuredStoryLink({ tier: 'enterprise', shopSlug: 'lumen', eventSlug: 'ana-marco' }), {
    href: '/v/lumen/story/ana-marco',
    label: OUR_STORY_LINK,
    own: true,
  });
  // No shop address → the couple's page, never a broken own page.
  assert.equal(featuredStoryLink({ tier: 'enterprise', shopSlug: null, eventSlug: 'x' }).own, false);
  assert.equal(OUR_STORY_LINK, 'Our story of this day');
});

test('(8) the note is trimmed, capped and blank means none', () => {
  assert.equal(cleanStoryNote('   '), '');
  assert.equal(cleanStoryNote('  Rain cleared.\r\n\r\n\r\n\r\nThen light. '), 'Rain cleared.\n\nThen light.');
  assert.equal(cleanStoryNote('x'.repeat(900)).length, STORY_NOTE_MAX);
  assert.equal(cleanStoryNote(42), '');
  const migration = readFileSync(join(WEB, '..', '..', 'supabase', 'migrations', '20271346029832_ultra_story_notes_whole_branch_and_branch_copies.sql'), 'utf8');
  assert.match(migration, new RegExp(`BETWEEN 1 AND ${STORY_NOTE_MAX}`), 'the table and the form must cap the note at the same length');
});

test('(8) the shop page asks with the EFFECTIVE tier; the story page reads only through the published-story gate', () => {
  const page = read('app/v/[slug]/page.tsx');
  assert.match(page, /featuredStoryLink\(\{ tier: effectiveTierState,/);
  const server = read('lib/ultra-story-pages.server.ts');
  assert.match(server, /fetchVendorPoolBookings\(admin, vendorProfileId\)/, 'paid bookings only — never the agreed-but-unpaid room read');
  assert.doesNotMatch(server, /fetchVendorRoomEvents/);
  assert.match(server, /readOverdueTopUpEventIds/, 'unlisted events stay unlisted');
  assert.match(server, /loadVendorFeaturedStories\(/, 'the consent · slug · 30-day gate');
  assert.match(server, /\.eq\('status', 'approved'\)[\s\S]*\.eq\('hidden_by_couple', false\)/, 'only media the host accepted');
  assert.match(server, /\.eq\('selection_match_rank', 1\)/);
  assert.match(server, /hasStoryPages\(effectiveSeoTier\(/);
});

// ── (9) ───────────────────────────────────────────────────────────────────────────────────────────────────────────

test('(9) Whole branch only with two or more USABLE locations', () => {
  assert.equal(hasManyLocations([]), false);
  assert.equal(hasManyLocations([UNPAID]), false, 'an unpaid branch is not a location yet');
  assert.equal(hasManyLocations([CEBU]), true);
  assert.deepEqual(shopLocations([CEBU, UNPAID], 'Makati'), [
    { key: MAIN_BRANCH_KEY, label: 'Main · Makati' },
    { key: 'b-cebu', label: 'Cebu' },
  ]);
});

test('(9) services are grouped under their branch, named by title, and the summary says "all of Cebu"', () => {
  const locations = shopLocations([CEBU], 'Makati');
  const services = [
    { id: 's1', name: 'Wedding Day', key: MAIN_BRANCH_KEY, active: true },
    { id: 's2', name: 'Debut Coverage', key: MAIN_BRANCH_KEY, active: true },
    { id: 's3', name: 'Wedding Day', key: 'b-cebu', active: true },
    { id: 's4', name: 'Christening', key: 'b-cebu', active: true },
  ];
  const groups = groupByLocation(services, locations);
  assert.deepEqual(groups.map((g) => [g.label, g.services.map((s) => s.name)]), [
    ['Main · Makati', ['Wedding Day', 'Debut Coverage']],
    ['Cebu', ['Wedding Day', 'Christening']],
  ]);
  assert.equal(whoWorksWhatLine('Rina', ['s3', 's4'], ['b-cebu'], services, locations), 'Rina · all of Cebu');
  assert.equal(whoWorksWhatLine('Rina', ['s2', 's3', 's4'], ['b-cebu'], services, locations), 'Rina · all of Cebu + 1 service');
  assert.equal(whoWorksWhatLine('Paolo', ['s1', 's2'], [], services, locations), 'Paolo · 2 services');
});

test('(9) the Team save keeps only this shop’s keys and adds the branch’s services', () => {
  const src = read('app/vendor-dashboard/team/actions.ts');
  const at = src.indexOf('export async function setVendorAgentServices');
  const body = src.slice(at, src.indexOf('\nexport ', at + 10));
  assert.match(body, /validKeys\.has\(v\)/, 'a forged branch key is dropped');
  assert.match(body, /\.eq\('parent_vendor_profile_id', ctx\.vendorProfileId\)/);
  assert.match(body, /whole_branch_keys: wholeKeys/);
  assert.match(body, /wholeSet\.has\(keyOfBranchId\(r\.branch_id\)\)/);
});

// ── (10) ──────────────────────────────────────────────────────────────────────────────────────────────────────────

test('(10) a card copies to every usable location but its own', () => {
  assert.deepEqual(branchCopyTargets([CEBU, UNPAID], null).map((t) => t.key), ['b-cebu']);
  assert.deepEqual(branchCopyTargets([CEBU], 'b-cebu').map((t) => t.key), [MAIN_BRANCH_KEY]);
  assert.deepEqual(branchCopyTargets([], null), [], 'one location → no button');
});

test('(10) "Price there" is whole positive pesos', () => {
  assert.equal(parseBranchCopyPrice('38,000'), 38000);
  assert.equal(parseBranchCopyPrice('₱ 45000'), 45000);
  assert.equal(parseBranchCopyPrice('0'), null);
  assert.equal(parseBranchCopyPrice('12.5'), null);
  assert.equal(parseBranchCopyPrice(''), null);
});

test('(10) a branch copy never uses up a card — in the plan picker and at the create gate', () => {
  const card = (id: string, branchCopy = false): PlanCard => ({
    id,
    name: 'Wedding Day',
    kind: 'photographer',
    families: ['photo_video'],
    live: true,
    hold: null,
    holdStartsOn: null,
    branchCopy,
  });
  const caps = { parentCategories: 1, servicesPerLeaf: 1 };
  assert.deepEqual(keptFits([card('a'), card('b', true)], caps), { ok: true });
  assert.equal(keptFits([card('a'), card('b')], caps).ok, false, 'a NEW service of the same kind still uses a card');
  const gate = read('app/vendor-dashboard/services/actions.ts');
  const gates = gate.match(/\.select\('category'\)\s*\.eq\('vendor_profile_id', profile\.vendor_profile_id\)\s*\.is\('branch_copy_of', null\)/g) ?? [];
  assert.equal(gates.length, 2, 'both per-category create gates skip branch copies');
  assert.match(read('lib/service-plan-hold.server.ts'), /branchCopy: Boolean\(r\.branch_copy_of\)/);
});
