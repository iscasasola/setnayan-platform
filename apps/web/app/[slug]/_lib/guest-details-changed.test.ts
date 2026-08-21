/**
 * The comparison that decides whether a couple is told — or spammed.
 *
 * A grep can see that a comparison EXISTS; only real values can show it says
 * the right thing. Each case below is a way the shipped write path produces a
 * value that differs from what was stored while nothing actually changed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guestDetailsChanged } from './guest-details-changed';

const same = { meal: 'no_preference', dietary: null, guestNote: null };

test('an idle Save reports nothing', () => {
  assert.deepEqual(
    guestDetailsChanged({ meal_preference: 'chicken', dietary_restrictions: 'nut allergy', guest_note: 'thanks!' },
      { meal: 'chicken', dietary: 'nut allergy', guestNote: 'thanks!' }),
    [],
  );
});

test('🪤 a NULL meal is not a change — the write coerces it to no_preference', () => {
  // The column is nullable with no default; the action stores
  // `meal_raw || 'no_preference'`. Comparing raw would email the couple on the
  // first save of every guest who never opened the dropdown.
  assert.deepEqual(guestDetailsChanged({ meal_preference: null }, same), []);
});

test("🪤 '' → null is not a change on dietary or note", () => {
  // `clean(...) || null` turns '' into null on the way in, so a stored empty
  // string would otherwise read as a change on every submit, forever.
  assert.deepEqual(
    guestDetailsChanged({ meal_preference: 'no_preference', dietary_restrictions: '', guest_note: '' }, same),
    [],
  );
});

test('🪤 whitespace-only differences are not changes', () => {
  assert.deepEqual(
    guestDetailsChanged({ meal_preference: 'no_preference', dietary_restrictions: '  nut allergy  ', guest_note: ' hi ' },
      { meal: 'no_preference', dietary: 'nut allergy', guestNote: 'hi' }),
    [],
  );
});

test('🔴 an allergy arriving IS a change', () => {
  assert.deepEqual(
    guestDetailsChanged({ meal_preference: 'no_preference', dietary_restrictions: null, guest_note: null },
      { meal: 'no_preference', dietary: 'severe nut allergy', guestNote: null }),
    ['dietary'],
  );
});

test('clearing an allergy is a change too — the caterer must be told', () => {
  assert.deepEqual(
    guestDetailsChanged({ meal_preference: 'no_preference', dietary_restrictions: 'nut allergy', guest_note: null }, same),
    ['dietary'],
  );
});

test('each field is reported independently', () => {
  assert.deepEqual(
    guestDetailsChanged({ meal_preference: 'beef', dietary_restrictions: null, guest_note: null },
      { meal: 'vegan', dietary: 'halal', guestNote: 'see you there' }),
    ['meal', 'dietary', 'note'],
  );
});

test('a vanished row is safe, not a crash', () => {
  // `before` is null when the row could not be read. It must not throw, and it
  // must not silently report "nothing changed" for a real allergy.
  assert.deepEqual(guestDetailsChanged(null, same), []);
  assert.deepEqual(
    guestDetailsChanged(null, { meal: 'no_preference', dietary: 'nut allergy', guestNote: null }),
    ['dietary'],
  );
});
