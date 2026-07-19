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

import { isInquiryRevealed, inquiryPlaceholderLabel } from './inquiry-mask';

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
  assert.equal(
    inquiryPlaceholderLabel({ eventType: 'wedding', city: 'Cebu' }),
    'A couple planning a wedding in Cebu',
  );
  assert.equal(
    inquiryPlaceholderLabel({ eventType: 'anniversary', city: 'Cebu' }),
    'A couple planning an anniversary in Cebu',
  );
});

test('placeholder: type only', () => {
  assert.equal(inquiryPlaceholderLabel({ eventType: 'wedding' }), 'A couple planning a wedding');
});

test('placeholder: city only', () => {
  assert.equal(inquiryPlaceholderLabel({ city: 'Davao' }), 'A couple planning an event in Davao');
});

test('placeholder: neither known degrades to a fully generic label', () => {
  assert.equal(inquiryPlaceholderLabel({}), 'A couple planning an event');
  assert.equal(inquiryPlaceholderLabel({ eventType: null, city: null }), 'A couple planning an event');
});

test('placeholder: never leaks identity — no couple name can appear', () => {
  // Even if callers somehow pass hostile-looking values, the label is assembled
  // only from event_type + city — it can never surface a display_name.
  const label = inquiryPlaceholderLabel({ eventType: 'birthday', city: 'Metro Manila' });
  assert.ok(label.startsWith('A couple planning'));
  assert.ok(!/&|@|\bmr\b|\bmrs\b/i.test(label));
});

