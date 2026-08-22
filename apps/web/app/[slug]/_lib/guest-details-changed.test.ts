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

// ⚠ ALL SIX ARE REQUIRED on `next`, on purpose. Making the three contact fields
// optional would mean an omitted field reads as CLEARED — so a caller that
// forgot one would silently report the guest had deleted their phone number.
const NONE = { email: null, mobile: null, displayName: null };
const same = { meal: 'no_preference', dietary: null, guestNote: null, ...NONE, ...NONE };

test('an idle Save reports nothing', () => {
  assert.deepEqual(
    guestDetailsChanged({ meal_preference: 'chicken', dietary_restrictions: 'nut allergy', guest_note: 'thanks!' },
      { meal: 'chicken', dietary: 'nut allergy', guestNote: 'thanks!', ...NONE }),
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
      { meal: 'no_preference', dietary: 'nut allergy', guestNote: 'hi', ...NONE }),
    [],
  );
});

test('🔴 an allergy arriving IS a change', () => {
  assert.deepEqual(
    guestDetailsChanged({ meal_preference: 'no_preference', dietary_restrictions: null, guest_note: null },
      { meal: 'no_preference', dietary: 'severe nut allergy', guestNote: null, ...NONE }),
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
      { meal: 'vegan', dietary: 'halal', guestNote: 'see you there', ...NONE }),
    ['meal', 'dietary', 'note'],
  );
});

test('a vanished row is safe, not a crash', () => {
  // `before` is null when the row could not be read. It must not throw, and it
  // must not silently report "nothing changed" for a real allergy.
  assert.deepEqual(guestDetailsChanged(null, same), []);
  assert.deepEqual(
    guestDetailsChanged(null, { meal: 'no_preference', dietary: 'nut allergy', guestNote: null, ...NONE }),
    ['dietary'],
  );
});

// ── The three a guest could never give ──────────────────────────────────────

test('adding an email, a mobile or a name is reported', () => {
  const before = { meal_preference: 'beef', email: null, mobile: null, display_name: null };
  const out = guestDetailsChanged(before, {
    meal: 'beef', dietary: null, guestNote: null,
    email: 'ana@example.com', mobile: '+63 917 000 0000', displayName: 'Tita Baby',
  });
  assert.deepEqual(out.sort(), ['email', 'mobile', 'name']);
});

test('clearing one is reported too — a removed number is news', () => {
  const before = { meal_preference: 'beef', email: 'a@b.co', mobile: '+63 917', display_name: 'Tita' };
  const out = guestDetailsChanged(before, {
    meal: 'beef', dietary: null, guestNote: null, email: null, mobile: null, displayName: null,
  });
  assert.deepEqual(out.sort(), ['email', 'mobile', 'name']);
});

test('🪤 re-saving the same details is NOT a change', () => {
  const before = {
    meal_preference: 'beef', dietary_restrictions: 'nuts', guest_note: 'hi',
    email: 'ana@example.com', mobile: '+63 917 000 0000', display_name: 'Tita Baby',
  };
  assert.deepEqual(
    guestDetailsChanged(before, {
      meal: 'beef', dietary: 'nuts', guestNote: 'hi',
      email: 'ana@example.com', mobile: '+63 917 000 0000', displayName: 'Tita Baby',
    }),
    [],
    'every field is defaultValue= — opening the card and pressing Save must tell the couple nothing',
  );
});

test('🪤 an email that only changed CASE is not a change', () => {
  // A phone keyboard capitalises the first letter. Without this, that guest
  // tells the couple their email "changed" every time they open their own card.
  assert.deepEqual(
    guestDetailsChanged(
      { meal_preference: 'no_preference', email: 'ana@example.com' },
      { meal: 'no_preference', dietary: null, guestNote: null,
        email: 'Ana@Example.com', mobile: null, displayName: null },
    ),
    [],
  );
});

test('🪤 whitespace around a number is not a change', () => {
  assert.deepEqual(
    guestDetailsChanged(
      { meal_preference: 'no_preference', mobile: '+63 917 000 0000' },
      { meal: 'no_preference', dietary: null, guestNote: null,
        email: null, mobile: '  +63 917 000 0000  ', displayName: null },
    ),
    [],
  );
});

test("a blank stored value and a blank submission agree", () => {
  // '' -> null on the way in, so a stored '' must not report a change forever.
  assert.deepEqual(
    guestDetailsChanged(
      { meal_preference: 'no_preference', email: '', mobile: '', display_name: '' },
      { meal: 'no_preference', dietary: null, guestNote: null,
        email: null, mobile: null, displayName: null },
    ),
    [],
  );
});
