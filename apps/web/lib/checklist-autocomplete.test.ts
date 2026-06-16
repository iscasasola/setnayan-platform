/**
 * Auto-completion mapping: structural signals → satisfied checklist tasks.
 * Deterministic; the load-bearing guard is the last test — every key the
 * reconcile can flip must be a real CHECKLIST_TEMPLATE key (catches typos that
 * would silently never auto-complete).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeSatisfiedChecklistKeys,
  AUTO_COMPLETABLE_KEYS,
  type ChecklistSignals,
} from './checklist-autocomplete';
import { CHECKLIST_TEMPLATE } from './checklist';

function signals(p: Partial<ChecklistSignals>): ChecklistSignals {
  return {
    confirmedCategories: new Set(),
    budgetSet: false,
    guestEstimateSet: false,
    hasGuests: false,
    seatingStarted: false,
    scheduleStarted: false,
    paletteFinalized: false,
    monogramSet: false,
    marriageLicenseReceived: false,
    psaReceived: false,
    ...p,
  };
}

test('a confirmed caterer satisfies book_caterer and nothing unrelated', () => {
  const s = computeSatisfiedChecklistKeys(signals({ confirmedCategories: new Set(['catering']) }));
  assert.ok(s.has('book_caterer'));
  assert.ok(!s.has('book_photo'));
  assert.ok(!s.has('book_florist'));
});

test('a confirmed venue satisfies both venue tasks', () => {
  const s = computeSatisfiedChecklistKeys(signals({ confirmedCategories: new Set(['venue']) }));
  assert.ok(s.has('book_venue'));
  assert.ok(s.has('shortlist_venues'));
});

test('photographer OR videographer satisfies book_photo', () => {
  assert.ok(
    computeSatisfiedChecklistKeys(
      signals({ confirmedCategories: new Set(['photographer']) }),
    ).has('book_photo'),
  );
  assert.ok(
    computeSatisfiedChecklistKeys(
      signals({ confirmedCategories: new Set(['videographer']) }),
    ).has('book_photo'),
  );
});

test('a CONSIDERING vendor does not count — only confirmed categories are passed in', () => {
  // The reconcile only ever puts confirmed-status categories in the set, so an
  // empty set (no confirmed bookings) satisfies no booking task.
  assert.equal(
    computeSatisfiedChecklistKeys(signals({ confirmedCategories: new Set() })).size,
    0,
  );
});

test('first-party milestone signals map to their tasks', () => {
  assert.ok(computeSatisfiedChecklistKeys(signals({ budgetSet: true })).has('set_budget'));
  assert.ok(computeSatisfiedChecklistKeys(signals({ seatingStarted: true })).has('seating'));
  assert.ok(computeSatisfiedChecklistKeys(signals({ scheduleStarted: true })).has('schedule'));
  assert.ok(computeSatisfiedChecklistKeys(signals({ monogramSet: true })).has('monogram'));
  assert.ok(
    computeSatisfiedChecklistKeys(signals({ marriageLicenseReceived: true })).has(
      'marriage_license',
    ),
  );
  assert.ok(computeSatisfiedChecklistKeys(signals({ psaReceived: true })).has('psa_cenomar'));

  const palette = computeSatisfiedChecklistKeys(signals({ paletteFinalized: true }));
  assert.ok(palette.has('mood_board') && palette.has('lock_theme'));

  const guests = computeSatisfiedChecklistKeys(signals({ hasGuests: true, guestEstimateSet: true }));
  assert.ok(guests.has('guest_list') && guests.has('draft_guest_list') && guests.has('guest_estimate'));
});

test('reception music is band/DJ only — a ceremony quartet/choir does NOT count', () => {
  // band_dj satisfies reception music…
  assert.ok(
    computeSatisfiedChecklistKeys(
      signals({ confirmedCategories: new Set(['band_dj']) }),
    ).has('book_reception_music'),
  );
  // …but a ceremony-only string quartet or choir must not (that's book_ceremony_music,
  // which is intentionally left manual).
  const quartet = computeSatisfiedChecklistKeys(
    signals({ confirmedCategories: new Set(['string_quartet']) }),
  );
  assert.ok(!quartet.has('book_reception_music'));
  assert.ok(!quartet.has('book_ceremony_music'));
  assert.ok(
    !computeSatisfiedChecklistKeys(
      signals({ confirmedCategories: new Set(['choir']) }),
    ).has('book_reception_music'),
  );
});

test('no signals → nothing satisfied (never auto-checks blindly)', () => {
  assert.equal(computeSatisfiedChecklistKeys(signals({})).size, 0);
});

test('every auto-completable key is a real CHECKLIST_TEMPLATE key', () => {
  const templateKeys = new Set(CHECKLIST_TEMPLATE.map((t) => t.key));
  for (const k of AUTO_COMPLETABLE_KEYS) {
    assert.ok(templateKeys.has(k), `auto-completable key "${k}" is not in CHECKLIST_TEMPLATE`);
  }
});
