/**
 * Vendor inquiry anonymization-until-accept — mask primitives (Glass PR-6b ·
 * spec Vendor_Inquiry_Anonymization_Spec_2026-07-15). Node built-in runner via
 * tsx (`pnpm test:unit`).
 *
 * Locks:
 *   • the reveal predicate keys on the token-burn timestamp (accepted_at) with
 *     the enum as a fallback, and "revealed stays revealed" across later
 *     status transitions;
 *   • the neutral placeholder never carries a name/initials/title/contact,
 *     handles a/an, and degrades gracefully;
 *   • city labels resolve to city/area level, never a venue.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  isInquiryRevealed,
  inquiryPlaceholderLabel,
  GENERIC_HOST_NOUN,
  INQUIRY_MASK_UNKNOWN,
} from './inquiry-mask';

test('isInquiryRevealed: burned token (accepted_at set) reveals', () => {
  assert.equal(isInquiryRevealed({ accepted_at: '2026-07-15T00:00:00Z', inquiry_status: 'accepted' }), true);
});

test('isInquiryRevealed: enum accepted without timestamp still reveals', () => {
  assert.equal(isInquiryRevealed({ accepted_at: null, inquiry_status: 'accepted' }), true);
});

test('isInquiryRevealed: pending is masked', () => {
  assert.equal(isInquiryRevealed({ accepted_at: null, inquiry_status: 'pending' }), false);
});

test('isInquiryRevealed: declined (never accepted) is masked', () => {
  assert.equal(isInquiryRevealed({ accepted_at: null, inquiry_status: 'declined' }), false);
});

test('isInquiryRevealed: revealed stays revealed after transitioning to displaced', () => {
  // Token was burned (accepted_at stamped), then the thread later flipped to a
  // closed state — identity must NOT re-mask.
  assert.equal(isInquiryRevealed({ accepted_at: '2026-07-15T00:00:00Z', inquiry_status: 'displaced' }), true);
});

test('placeholder: type + city reads naturally with the right article', () => {
  // 🔒 THE WEDDING LITERAL. This exact string is what shipped before the noun
  // was threaded in, and it must not move — a wedding's host noun is 'couple'.
  assert.equal(
    inquiryPlaceholderLabel({ eventType: 'wedding', city: 'Cebu', hostNoun: 'couple' }),
    'A couple planning a wedding in Cebu',
  );
  assert.equal(
    inquiryPlaceholderLabel({ eventType: 'anniversary', city: 'Cebu', hostNoun: 'host' }),
    'A host planning an anniversary in Cebu',
  );
});

test('placeholder: type only', () => {
  assert.equal(
    inquiryPlaceholderLabel({ eventType: 'wedding', hostNoun: 'couple' }),
    'A couple planning a wedding',
  );
});

test('placeholder: city only', () => {
  assert.equal(
    inquiryPlaceholderLabel({ city: 'Davao', hostNoun: 'couple' }),
    'A couple planning an event in Davao',
  );
});

test('placeholder: neither known degrades to a fully generic label', () => {
  // ⚠ A DELIBERATE, VISIBLE CHANGE. This branch used to read "A couple planning
  // an event" — the wedding assumption in its purest form, applied at exactly
  // the moment we know nothing at all. Unknown now reads the generic noun.
  assert.equal(inquiryPlaceholderLabel({ hostNoun: null }), 'A host planning an event');
  assert.equal(
    inquiryPlaceholderLabel({ eventType: null, city: null, hostNoun: null }),
    'A host planning an event',
  );
  assert.equal(inquiryPlaceholderLabel(INQUIRY_MASK_UNKNOWN), 'A host planning an event');
  // A blank/whitespace noun is the same as absent — the column is admin-typed.
  assert.equal(inquiryPlaceholderLabel({ hostNoun: '   ' }), 'A host planning an event');
  assert.equal(GENERIC_HOST_NOUN, 'host');
});

test('placeholder: the ARTICLE follows the noun, not a hardcoded "A "', () => {
  // 'organizer' is the seeded noun for corporate · gala_night · tournament ·
  // travel. Before this, the opener was a hardcoded "A " and this read
  // "A organizer planning a corporate event".
  assert.equal(
    inquiryPlaceholderLabel({ eventType: 'corporate', city: 'Makati', hostNoun: 'organizer' }),
    'An organizer planning a corporate in Makati',
  );
  assert.equal(
    inquiryPlaceholderLabel({ hostNoun: 'organizer' }),
    'An organizer planning an event',
  );
  // …and a consonant noun keeps the bare article.
  assert.equal(
    inquiryPlaceholderLabel({ eventType: 'funeral', city: 'Manila', hostNoun: 'family' }),
    'A family planning a funeral in Manila',
  );
});

test('placeholder: the noun is lower-cased mid-sentence', () => {
  // The column is admin-editable; "A Couple planning" would be wrong English.
  assert.equal(
    inquiryPlaceholderLabel({ eventType: 'wedding', hostNoun: 'Couple' }),
    'A couple planning a wedding',
  );
});

test('placeholder: never leaks identity — no name/title/contact/venue can appear', () => {
  // The label is assembled ONLY from event_type + city + the type's noun. Feed
  // every identifying field this repo holds for an event as if a caller had
  // smuggled them in: none of them is a parameter, so none can reach the string.
  const IDENTITY = [
    'Ana & Marco',
    'Ana',
    'Marco',
    'A&M',
    'ana@example.com',
    '+63 917 555 0101',
    'Blue Leaf Events Pavilion',
    '12 Kalayaan Ave, Quezon City',
    'https://setnayan.com/ana-at-marco',
    'S89E-4KQ2X7M1AB',
  ];
  for (const hostNoun of ['couple', 'family', 'organizer', 'host', null]) {
    for (const branch of [
      { eventType: 'birthday', city: 'Metro Manila' },
      { eventType: 'funeral', city: null },
      { eventType: null, city: 'Cebu' },
      { eventType: null, city: null },
    ]) {
      const label = inquiryPlaceholderLabel({ ...branch, hostNoun });
      for (const secret of IDENTITY) {
        assert.ok(
          !label.toLowerCase().includes(secret.toLowerCase()),
          `placeholder leaked "${secret}": ${label}`,
        );
      }
      assert.ok(!/&|@|\bmr\b|\bmrs\b|https?:|\+63|S89[A-Z]-/i.test(label), label);
      assert.ok(/^An? [a-z]+ planning /.test(label), `bad opener: ${label}`);
    }
  }
});

