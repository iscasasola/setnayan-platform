/**
 * Unit suite for the recurrence clone payload. Guards the owner-locked scope
 * ("Details, not the guest list"): identity + captured details + the recurring
 * anchor carry forward; date/venue/guests start fresh; wedding-CHECK columns are
 * null/false by construction; and recurs is always stamped true.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNextYearClonePayload,
  canPlanNextYear,
  RECURRENCE_CAPABLE_TYPES,
} from './event-recurrence';

test('canPlanNextYear: only recurrence-capable types', () => {
  assert.equal(canPlanNextYear('birthday'), true);
  assert.equal(canPlanNextYear('anniversary'), true);
  assert.equal(canPlanNextYear('reunion'), true);
  assert.equal(canPlanNextYear('corporate'), true);
  assert.equal(canPlanNextYear('wedding'), false);
  assert.equal(canPlanNextYear('debut'), false); // a debut happens once
  assert.equal(canPlanNextYear(null), false);
  assert.equal(canPlanNextYear(undefined), false);
});

test('the clone carries identity + captured details forward', () => {
  const p = buildNextYearClonePayload({
    event_type: 'birthday',
    display_name: "Lola's Birthday",
    signature_details: { celebrant_name: 'Lola', theme_peg: 'Vintage Rose' },
    anchor_kind: 'birthday',
    anchor_date: '1950-07-15',
    estimated_pax: 80,
    budget_band: 'mid',
    region: 'Cebu',
  });
  assert.equal(p.event_type, 'birthday');
  assert.equal(p.display_name, "Lola's Birthday");
  assert.deepEqual(p.signature_details, { celebrant_name: 'Lola', theme_peg: 'Vintage Rose' });
  assert.equal(p.anchor_kind, 'birthday');
  assert.equal(p.anchor_date, '1950-07-15'); // the recurring date is stable
  assert.equal(p.estimated_pax, 80);
  assert.equal(p.budget_band, 'mid');
  assert.equal(p.region, 'Cebu');
});

test('the clone always recurs and never carries a fixed date/venue', () => {
  const p = buildNextYearClonePayload({
    event_type: 'reunion',
    display_name: 'Casasola Reunion',
    event_type_ignored: true,
  } as never);
  assert.equal(p.recurs, true);
  assert.equal(p.event_date, null);
  assert.equal(p.date_candidates, null);
  assert.equal(p.venue_name, null);
  assert.equal(p.venue_address, null);
});

test('wedding-CHECK columns are null/false by construction', () => {
  const p = buildNextYearClonePayload({ event_type: 'anniversary', display_name: 'A' });
  assert.equal(p.ceremony_type, null);
  assert.equal(p.venue_setting, null);
  assert.equal(p.ceremony_sub_type, null);
  assert.equal(p.is_mixed_ceremony, false);
  assert.equal(p.secondary_ceremony_type, null);
});

test('the guest list is NOT part of the payload (fresh roster each year)', () => {
  const p = buildNextYearClonePayload({ event_type: 'reunion', display_name: 'R' });
  // No guest/member fields ever appear in the clone payload.
  assert.ok(!('guests' in p));
  assert.ok(!('event_members' in p));
  assert.ok(!('guest_list' in p));
});

test('style_preferences only present when the source had it', () => {
  const without = buildNextYearClonePayload({ event_type: 'birthday', display_name: 'B' });
  assert.ok(!('style_preferences' in without));
  const withPrefs = buildNextYearClonePayload({
    event_type: 'birthday',
    display_name: 'B',
    style_preferences: { search_areas: ['Makati'] },
  });
  assert.deepEqual(withPrefs.style_preferences, { search_areas: ['Makati'] });
});

test('a sparse (name-only) source clones cleanly with null details', () => {
  const p = buildNextYearClonePayload({ event_type: 'corporate', display_name: 'Gala' });
  assert.equal(p.signature_details, null);
  assert.equal(p.anchor_date, null);
  assert.equal(p.estimated_pax, null);
  assert.equal(p.recurs, true);
});

test('every capable type is non-wedding (clone never violates the wedding CHECK)', () => {
  assert.ok(!(RECURRENCE_CAPABLE_TYPES as readonly string[]).includes('wedding'));
});
