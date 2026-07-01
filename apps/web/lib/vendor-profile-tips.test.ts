import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProfileTips,
  MAX_PROFILE_TIPS,
  type ProfileTipStats,
} from './vendor-profile-tips';

const STRONG: ProfileTipStats = {
  avg_response_minutes: 30,
  response_rate_pct: 98,
  review_count: 12,
  profile_completeness_pct: 100,
  booking_completion_rate_pct: 100,
  inquiry_to_booking_pct: 40,
  finalized_booking_count: 20,
};

test('a strong profile yields no tips (card hides)', () => {
  assert.equal(buildProfileTips(STRONG).length, 0);
});

test('a weak profile yields ranked tips, capped and sorted by weight', () => {
  const weak: ProfileTipStats = {
    avg_response_minutes: 600,
    response_rate_pct: 40,
    review_count: 0,
    profile_completeness_pct: 20,
    booking_completion_rate_pct: 50,
    inquiry_to_booking_pct: 5,
    finalized_booking_count: 3,
  };
  const tips = buildProfileTips(weak);
  assert.ok(tips.length > 0 && tips.length <= MAX_PROFILE_TIPS);
  for (let i = 1; i < tips.length; i++) {
    assert.ok(tips[i - 1].weight >= tips[i].weight, 'tips must be ranked high→low');
  }
});

test('avg_response_minutes === 0 is "no data" — no reply-time tip', () => {
  const tips = buildProfileTips({ ...STRONG, avg_response_minutes: 0, profile_completeness_pct: 50 });
  assert.ok(!tips.some((t) => t.key === 'reply_time'));
});

test('no bookings yet → reviews tip uses the no-bookings message', () => {
  const tips = buildProfileTips({ ...STRONG, review_count: 0, finalized_booking_count: 0, inquiry_to_booking_pct: 0 });
  const rv = tips.find((t) => t.key === 'reviews');
  assert.ok(rv && /No reviews yet/.test(rv.message));
});

test('completion/conversion tips only fire once there are bookings', () => {
  const noBookings: ProfileTipStats = { ...STRONG, finalized_booking_count: 0, booking_completion_rate_pct: 0, inquiry_to_booking_pct: 0 };
  const tips = buildProfileTips(noBookings);
  assert.ok(!tips.some((t) => t.key === 'completion' || t.key === 'conversion'));
});
