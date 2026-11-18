/**
 * 🔒 THE SEALS, EXECUTED — one test per claim lib/shop-seals.ts makes (owner-approved prototypes 15 Nov; DECISION_LOG
 * 6373 Top 10 / No. 1 · 4b8cc3a3 seals replace Spotlight · 3077c9b3 Verified Partner · 6451 the year and the gaps).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  FIRST_SEAL_YEAR,
  IMPORT_SOURCES,
  NO1_PLAN_GIFT,
  PARTNER_RULES_9_AND_10,
  RETIRED_SPOTLIGHT_AWARDS,
  SEAL_LABEL,
  STORED_SEALS,
  VERIFIED_PARTNER_RULES,
  displayedSeals,
  judgeVerifiedPartner,
  manilaYear,
  pickClientsChoice,
  pickMostInDemand,
  pickNo1,
  pickTop10,
  pickYearlySeals,
  sealWindow,
  top10PlaqueLine,
  yearlySealsMayRun,
  type PartnerFacts,
  type SealYearCandidate,
} from './shop-seals';
import { topPickScore } from './vendor-badges';

const shop = (id: string, over: Partial<SealYearCandidate> = {}): SealYearCandidate => ({
  vendorProfileId: id,
  verified: true,
  completedEvents: 12,
  refundedEvents: 0,
  shopCancellations: 0,
  inquiries: 40,
  secondBookings: 0,
  trustedAvgRating: 4.8,
  trustedReviewCount: 20,
  ...over,
});

// ── Top 10 / No. 1 (6373: "loved AND reliable") ───────────────────────────────────────────────────────────────

test('Top 10 needs at least 10 events completed that year', () => {
  assert.deepEqual(pickTop10([shop('nine', { completedEvents: 9 })]), []);
  assert.equal(pickTop10([shop('ten', { completedEvents: 10 })]).length, 1);
});

test('Top 10 never takes a shop that cancelled on a client that year', () => {
  assert.deepEqual(pickTop10([shop('a', { shopCancellations: 1 })]), []);
});

test('Top 10 never takes a shop with no trusted reviews, nor an unverified or unread one', () => {
  assert.deepEqual(pickTop10([shop('a', { trustedReviewCount: 0 })]), []);
  assert.deepEqual(pickTop10([shop('b', { verified: false })]), []);
  assert.deepEqual(pickTop10([shop('c', { trustedReviewCount: null })]), []);
});

test('Top 10 ranks by the monthly Top Pick\'s own review score, ten at most', () => {
  const pool = Array.from({ length: 13 }, (_, i) => shop(`s${String(i).padStart(2, '0')}`, { trustedReviewCount: 5 + i }));
  const top = pickTop10(pool);
  assert.equal(top.length, 10);
  assert.equal(top[0]!.vendorProfileId, 's12', 'most trusted reviews at the same rating ranks first');
  assert.equal(top[0]!.score, topPickScore(4.8, 17), 'the score IS vendor-badges\' topPickScore');
  assert.deepEqual(top.map((t) => t.rank), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('ties rank by more events, then a stable id — never by chance', () => {
  const top = pickTop10([shop('b'), shop('a'), shop('c', { completedEvents: 30 })]);
  assert.deepEqual(top.map((t) => t.vendorProfileId), ['c', 'a', 'b']);
});

test('No. 1 is the first of the Top 10, and there is none without a Top 10', () => {
  const top = pickTop10([shop('a', { trustedAvgRating: 4.9 }), shop('b')]);
  assert.equal(pickNo1(top)!.vendorProfileId, 'a');
  assert.equal(pickNo1([]), null);
});

// ── Most In-Demand (v86 crest: top 10% by completed bookings; cancelled or refunded do not count) ─────────────

test('Most In-Demand is the top 10% by completed bookings, refunded ones not counted', () => {
  // Counts 1…10: the value at index ceil(0.9·10)−1 is 9 — exactly how the monthly Most Booked draws its line.
  const pool = Array.from({ length: 10 }, (_, i) => shop(`s${i}`, { completedEvents: i + 1 }));
  assert.deepEqual(pickMostInDemand(pool), ['s8', 's9']);
  // Refunds take s9 back to 5: counts 1…9 and 5 → the threshold (Most Booked's own percentile rule) is 8.
  pool[9] = shop('s9', { completedEvents: 10, refundedEvents: 5 });
  assert.deepEqual(pickMostInDemand(pool), ['s7', 's8']);
});

test('Most In-Demand never goes to zero bookings, an unverified shop, or nobody at all', () => {
  assert.deepEqual(pickMostInDemand([shop('a', { completedEvents: 0 })]), []);
  assert.deepEqual(pickMostInDemand([shop('a', { verified: false })]), []);
  assert.deepEqual(pickMostInDemand([]), []);
});

test('Clients\' Choice = the most second bookings among shops with ≥ 10 completed events; ties to the higher rating', () => {
  assert.equal(pickClientsChoice([shop('a', { secondBookings: 3 }), shop('b', { secondBookings: 5 })]), 'b');
  assert.equal(pickClientsChoice([shop('a', { secondBookings: 9, completedEvents: 9 }), shop('b', { secondBookings: 2 })]), 'b', 'nine events is not eligible');
  assert.equal(
    pickClientsChoice([shop('a', { secondBookings: 4, trustedAvgRating: 4.6 }), shop('b', { secondBookings: 4, trustedAvgRating: 4.9 })]),
    'b',
    'a tie goes to the higher rating',
  );
  assert.equal(pickClientsChoice([shop('b', { secondBookings: 4 }), shop('a', { secondBookings: 4 })]), 'a', 'a full tie never goes to chance');
  assert.equal(pickClientsChoice([shop('a')]), null, 'no second booking, no seal');
  assert.equal(pickClientsChoice([shop('a', { secondBookings: 4, verified: false })]), null);
  assert.equal(pickYearlySeals([shop('a', { secondBookings: 2 })]).clientsChoice, 'a');
});

test('the Top 10 plaque shows the exact rank', () => {
  assert.equal(top10PlaqueLine(4, 2026), 'No. 4 of the Top 10 Suppliers of 2026');
});

// ── When the yearly run may give anything ─────────────────────────────────────────────────────────────────────

test('the seal year runs 18 Dec → 17 Dec; the first year runs from launch to 17 Dec 2026', () => {
  assert.equal(FIRST_SEAL_YEAR, 2026);
  assert.deepEqual(sealWindow(2026), { from: null, to: '2026-12-18' });
  assert.deepEqual(sealWindow(2027), { from: '2026-12-18', to: '2027-12-18' });
});

test('a seal year is given from its 18 Dec in Manila, never before, never for a year before the first', () => {
  // 17 Dec 2026 23:30 Manila = 15:30 UTC — the year is still running.
  assert.equal(yearlySealsMayRun(2026, new Date('2026-12-17T15:30:00Z')).ok, false);
  // 18 Dec 2026 00:30 Manila = 17 Dec 16:30 UTC — given today.
  assert.equal(yearlySealsMayRun(2026, new Date('2026-12-17T16:30:00Z')).ok, true);
  assert.equal(yearlySealsMayRun(2025, new Date('2027-06-01T00:00:00Z')).ok, false);
  assert.equal(manilaYear(new Date('2026-12-31T16:30:00Z')), 2027);
});

// ── Verified Partner — ten rules, for life (3077c9b3) ─────────────────────────────────────────────────────────

const partner = (over: Partial<PartnerFacts> = {}): PartnerFacts => ({
  verified: true,
  bookedTotalPhp: 1_000_000,
  findBookings: 10,
  websiteBookings: 10,
  qrImportBookings: 10,
  bookingQrEvents: 10,
  trustedAvgRating: 4.7,
  trustedReviewCount: 30,
  recommenders: 10,
  invites: 10,
  ...over,
});

test('the ten rules are the owner\'s ten, in his order; "no cancellations" is dropped', () => {
  assert.deepEqual(VERIFIED_PARTNER_RULES.map((r) => r.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(!VERIFIED_PARTNER_RULES.some((r) => /cancel/i.test(r.label)));
});

test('every rule met at its exact floor earns it', () => {
  assert.equal(judgeVerifiedPartner(partner()).earned, true);
});

test('each rule alone, one short, withholds it', () => {
  const short: Array<[string, Partial<PartnerFacts>]> = [
    ['verified', { verified: false }],
    ['booked_total', { bookedTotalPhp: 999_999.99 }],
    ['find', { findBookings: 9 }],
    ['website', { websiteBookings: 9 }],
    ['qr_import', { qrImportBookings: 9 }],
    ['booking_qr', { bookingQrEvents: 9 }],
    ['rating', { trustedAvgRating: 4.69 }],
    ['rating', { trustedReviewCount: 0 }],
    ['recommend', { recommenders: 9 }],
    ['invite', { invites: 9 }],
  ];
  for (const [key, over] of short) {
    const v = judgeVerifiedPartner(partner(over));
    assert.equal(v.earned, false, `${key} one short must withhold the seal`);
    assert.equal(v.rules.find((r) => r.key === key)!.state, 'unmet');
  }
});

test('a rule that could not be read is "unread" — it never earns and never reads as "not met"', () => {
  for (const k of ['verified', 'bookedTotalPhp', 'findBookings', 'websiteBookings', 'qrImportBookings', 'bookingQrEvents', 'trustedAvgRating', 'recommenders'] as const) {
    const v = judgeVerifiedPartner(partner({ [k]: null }));
    assert.equal(v.earned, false);
    assert.ok(v.rules.some((r) => r.state === 'unread'), `${k} null must be unread`);
    assert.ok(!v.rules.some((r) => r.state === 'unmet'), `${k} null must not read as unmet`);
  }
});

test('rules 9 and 10, as ruled (7fbff0cd), come from ONE place', () => {
  assert.deepEqual(PARTNER_RULES_9_AND_10.map((r) => r.n), [9, 10]);
  for (const r of PARTNER_RULES_9_AND_10) assert.ok(VERIFIED_PARTNER_RULES.includes(r), `rule ${r.n} is read from the one list`);
});

test('No. 1 is owed one free year of its plan, through G3 — recorded, never paid here', () => {
  assert.deepEqual(NO1_PLAN_GIFT, { months: 12, via: 'G3 gift-to-shop flow (#7674)', recordedAs: 'owed' });
});

test('today rule 10 has no source, so no shop can be given Verified Partner yet', () => {
  const v = judgeVerifiedPartner(partner({ invites: null }));
  assert.equal(v.earned, false);
  assert.equal(v.rules.find((r) => r.n === 10)!.state, 'unread');
});

// ── What a shop wears ─────────────────────────────────────────────────────────────────────────────────────────

test('Setnayan Verified shows live and is never stored', () => {
  assert.ok(!(STORED_SEALS as readonly string[]).includes('verified'));
  assert.deepEqual(displayedSeals([], true), ['verified']);
  assert.deepEqual(displayedSeals([], false), []);
});

test('Verified Partner permanently replaces Setnayan Verified — even after verification lapses', () => {
  assert.deepEqual(displayedSeals(['verified_partner'], true), ['verified_partner']);
  assert.deepEqual(displayedSeals(['verified_partner'], false), ['verified_partner']);
});

test('several seals list No. 1 first, each once', () => {
  assert.deepEqual(displayedSeals(['most_in_demand', 'top10', 'no1', 'top10'], true), ['no1', 'top10', 'most_in_demand', 'verified']);
});

test('the names are the prototype\'s, and the retired monthly awards are the three Spotlight ones', () => {
  assert.equal(SEAL_LABEL.no1, 'No. 1 Supplier of the Year');
  assert.equal(SEAL_LABEL.top10, 'Top 10 Supplier');
  assert.equal(SEAL_LABEL.most_in_demand, 'Most In-Demand');
  assert.equal(SEAL_LABEL.verified_partner, 'Verified Partner');
  assert.deepEqual([...RETIRED_SPOTLIGHT_AWARDS], ['top_pick', 'most_booked', 'rising']);
});

test('the retired Spotlight awards keep their data: no seal migration writes or drops vendor_spotlight_awards', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const dir = join(process.cwd(), '..', '..', 'supabase', 'migrations');
  for (const f of ['20271349936814_shop_seals_the_yearly_and_lifetime_seals.sql', '20271348269771_notification_type_seal_awarded.sql']) {
    const sql = readFileSync(join(dir, f), 'utf8').replace(/--.*$/gm, '');
    assert.doesNotMatch(sql, /(INSERT\s+INTO|UPDATE|DELETE\s+FROM|DROP\s+TABLE|TRUNCATE|ALTER\s+TABLE)\s+(IF\s+EXISTS\s+)?(public\.)?vendor_spotlight_awards/i, f);
  }
});

test('the import list here is exactly the SQL definition shop_booking_is_import reads (fd5814dc)', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const sql = readFileSync(
    join(process.cwd(), '..', '..', 'supabase', 'migrations', '20271349936814_shop_seals_the_yearly_and_lifetime_seals.sql'),
    'utf8',
  );
  // ONE definition (controller, 16 Nov): it lives in the badge ladder's migration; the seals engine only calls it.
  const def = readFileSync(
    join(process.cwd(), '..', '..', 'supabase', 'migrations', '20271349129379_award_flow_gift_points_and_auto_claim.sql'),
    'utf8',
  );
  assert.doesNotMatch(sql, /FUNCTION public\.shop_booking_is_import/, 'the seals engine redefined shop_booking_is_import');
  const m = /FUNCTION public\.shop_booking_is_import\(\s*p_vendor_profile_id UUID,\s*p_event_id UUID,\s*p_source TEXT\s*\)[\s\S]*?p_source IN \(([^)]*)\)/.exec(def);
  assert.ok(m, 'shop_booking_is_import lost its source list');
  const inSql = m![1]!.split(',').map((x) => x.trim().replace(/'/g, ''));
  assert.deepEqual(inSql, [...IMPORT_SOURCES]);
  assert.match(sql, /AND NOT n\.is_import/, 'completed events leave imports out');
  assert.match(sql, /FROM real_booking WHERE NOT is_import\) b/, 'second bookings leave imports out');
});
