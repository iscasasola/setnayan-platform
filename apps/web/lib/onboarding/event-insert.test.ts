/**
 * Unit suite for buildGenericEventInsert (0053 Phase 3). The load-bearing
 * invariant: a non-wedding onboarding row sets EVERY wedding-only CHECK column to
 * NULL/false, so events_wedding_fields_consistency is satisfied exactly the way
 * createWeddingEvent's non-wedding branch does. Also locks the flag-guard on the
 * experience_* columns + the anon held-inquiry stash.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGenericEventInsert, type GenericInsertOpts } from './event-insert';
import type { GenericOnboardingPayload } from './types';

function payload(over: Partial<GenericOnboardingPayload> = {}): GenericOnboardingPayload {
  return {
    eventType: 'birthday',
    displayName: "Maria's 18th",
    region: 'NCR',
    venueLatitude: 14.5,
    venueLongitude: 121.0,
    pax: 120,
    budgetBand: 'mid',
    budgetAmountCentavos: 15000000,
    dateMode: 'specific',
    dateCandidates: ['2026-09-01', ''],
    windowStart: null,
    windowEnd: null,
    moodFeelKey: 'romantic',
    experiencePersona: 'big_celebration',
    experienceForWhom: 'guests',
    experienceAxes: { for_whom: 'guests', feel: 'grand' },
    picks: ['catering', 'photo_video'],
    interestedServices: ['panood'],
    refinements: { catering: ['plated'] },
    basicMoodboard: ['#FFF', '#000'],
    places: ['Makati'],
    guidanceOptIn: true,
    sendTopInquiries: false,
    inquiriesPerCategory: 3,
    role: 'host',
    ...over,
  };
}

const OPTS: GenericInsertOpts = {
  slug: 'marias-18th',
  now: '2026-06-24T00:00:00.000Z',
  userId: 'user-1',
  isAnonymous: false,
  experienceEnabled: false,
};

test('every wedding-only CHECK column is NULL/false (CHECK-safe for a non-wedding type)', () => {
  const row = buildGenericEventInsert(payload(), OPTS);
  assert.equal(row.ceremony_type, null);
  assert.equal(row.venue_setting, null);
  assert.equal(row.ceremony_sub_type, null);
  assert.equal(row.is_mixed_ceremony, false);
  assert.equal(row.secondary_ceremony_type, null);
  assert.equal(row.ceremony_type_locked_at, null);
  assert.equal(row.ceremony_type_locked_by, null);
  assert.equal(row.bride_name, null);
  assert.equal(row.groom_name, null);
});

test('generic columns map straight through', () => {
  const row = buildGenericEventInsert(payload(), OPTS);
  assert.equal(row.event_type, 'birthday');
  assert.equal(row.display_name, "Maria's 18th");
  assert.equal(row.slug, 'marias-18th');
  assert.equal(row.is_primary, true);
  assert.equal(row.region, 'NCR');
  assert.equal(row.estimated_pax, 120);
  assert.equal(row.mood_feel_key, 'romantic');
  assert.equal(row.date_mode, 'specific');
  assert.deepEqual(row.date_candidates, ['2026-09-01']); // empty string filtered
  assert.equal(row.estimated_budget_centavos, 15000000);
});

test('budget "nolimit" normalizes to "no_limit"; window mode nulls candidates', () => {
  const row = buildGenericEventInsert(
    payload({ budgetBand: 'nolimit', dateMode: 'window', windowStart: '2026-09', windowEnd: '2026-10' }),
    OPTS,
  );
  assert.equal(row.budget_band, 'no_limit');
  assert.equal(row.date_mode, 'window');
  assert.equal(row.date_candidates, null);
  assert.equal(row.date_window_start, '2026-09');
  assert.equal(row.date_window_end, '2026-10');
});

test('experience_* columns are ABSENT when the flag is off, PRESENT when on', () => {
  const off = buildGenericEventInsert(payload(), { ...OPTS, experienceEnabled: false });
  assert.ok(!('experience_persona' in off));
  assert.ok(!('experience_for_whom' in off));
  assert.ok(!('experience_axes' in off));

  const on = buildGenericEventInsert(payload(), { ...OPTS, experienceEnabled: true });
  assert.equal(on.experience_persona, 'big_celebration');
  assert.equal(on.experience_for_whom, 'guests');
  assert.deepEqual(on.experience_axes, { for_whom: 'guests', feel: 'grand' });
});

test('style_preferences carries the derived plan; pending inquiry stash only for anon + opted-in', () => {
  const row = buildGenericEventInsert(payload(), OPTS);
  const sp = row.style_preferences as Record<string, unknown>;
  assert.deepEqual(sp.interested_categories, ['catering', 'photo_video']);
  assert.deepEqual(sp.interested_services, ['panood']);
  assert.deepEqual(sp.search_areas, ['Makati']);
  assert.equal(sp.guidance_opt_in, true);
  assert.ok(!('pending_inquiry_dispatch' in sp), 'no stash when not anon');

  // Anon + opted-in → stash held for replay on secure.
  const anon = buildGenericEventInsert(
    payload({ sendTopInquiries: true, inquiriesPerCategory: 4 }),
    { ...OPTS, isAnonymous: true },
  );
  const anonSp = anon.style_preferences as Record<string, { perCategory: number }>;
  assert.deepEqual(anonSp.pending_inquiry_dispatch, { perCategory: 4 });

  // Authenticated + opted-in → NO stash (fired immediately by the route, PR3).
  const authed = buildGenericEventInsert(payload({ sendTopInquiries: true }), OPTS);
  assert.ok(!('pending_inquiry_dispatch' in (authed.style_preferences as object)));
});

// ── signature_details (per-type specialty payload) ───────────────────────────

test('signature_details: persists the collected per-type answers', () => {
  const row = buildGenericEventInsert(
    payload({ signatureDetails: { who: 'milestone', food: 'catered' } }),
    OPTS,
  );
  assert.deepEqual(row.signature_details, { who: 'milestone', food: 'catered' });
});

test('signature_details: NULL when omitted', () => {
  const row = buildGenericEventInsert(payload(), OPTS); // helper omits signatureDetails
  assert.equal(row.signature_details, null);
});

test('signature_details: NULL when empty object (so the Brief reads "not captured")', () => {
  const row = buildGenericEventInsert(payload({ signatureDetails: {} }), OPTS);
  assert.equal(row.signature_details, null);
});
