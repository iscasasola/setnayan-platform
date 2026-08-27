/**
 * The night-before supplier email's pure half. The one rule that matters most
 * here: `formatVenueClock` must read the stored wall-clock digits back out
 * WITHOUT re-zoning them — `event_schedule_blocks.start_at` (and therefore
 * `deriveCallTime`'s output) stores the venue's own local time in a column
 * typed TIMESTAMPTZ, so a 2 PM ceremony is literally `14:00Z`, not a real UTC
 * instant. Formatting it with `timeZone: 'Asia/Manila'` is the exact mistake
 * that once emailed a 2 PM ceremony as 10 PM
 * ([[project_setnayan_wall_clock_vs_instant]]).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSupplierNightBeforeEmail,
  formatVenueClock,
  manilaTodayIso,
} from './supplier-night-before-email-core';

test('formatVenueClock reads the stored digits, never re-zones them', () => {
  // Stored as "14:00Z" meaning "2 PM venue time" — must print 2:00 PM, not
  // 10:00 PM (what forcing Asia/Manila onto an already-local value produces).
  assert.equal(formatVenueClock('2026-12-16T14:00:00.000Z'), '2:00 PM');
  assert.equal(formatVenueClock('2026-12-16T09:30:00.000Z'), '9:30 AM');
});

test('formatVenueClock returns null for an unparseable value', () => {
  assert.equal(formatVenueClock('not-a-date'), null);
});

test('manilaTodayIso is a plain YYYY-MM-DD calendar day', () => {
  assert.match(manilaTodayIso(), /^\d{4}-\d{2}-\d{2}$/);
});

test('buildSupplierNightBeforeEmail names the event and the day, and links to the CTA', () => {
  const built = buildSupplierNightBeforeEmail({
    businessName: 'Maria Photography',
    eventDisplayName: 'Ana & Jose',
    eventDayLabel: 'December 16, 2026',
    callTimeLabel: '2:00 PM',
    ctaHref: 'https://www.setnayan.com/vendor-dashboard/clients/abc-123',
  });
  assert.match(built.subject, /Ana & Jose/);
  assert.match(built.text, /Ana & Jose/);
  assert.match(built.text, /December 16, 2026/);
  assert.match(built.text, /2:00 PM/);
  assert.match(built.text, /https:\/\/www\.setnayan\.com\/vendor-dashboard\/clients\/abc-123/);
  assert.match(built.html, /href="https:\/\/www\.setnayan\.com\/vendor-dashboard\/clients\/abc-123"/);
});

test('a missing call time falls back to a generic line, not a blank or a lie', () => {
  const built = buildSupplierNightBeforeEmail({
    businessName: 'Maria Photography',
    eventDisplayName: 'Ana & Jose',
    eventDayLabel: 'December 16, 2026',
    callTimeLabel: null,
    ctaHref: 'https://www.setnayan.com/vendor-dashboard/clients/abc-123',
  });
  assert.doesNotMatch(built.text, /Your suggested call time/);
  assert.match(built.text, /Check your call time/);
});

test('HTML output escapes a hostile business name — never raw-interpolated', () => {
  const built = buildSupplierNightBeforeEmail({
    businessName: '<script>alert(1)</script>',
    eventDisplayName: 'Ana & Jose',
    eventDayLabel: 'December 16, 2026',
    callTimeLabel: null,
    ctaHref: 'https://www.setnayan.com/vendor-dashboard/clients/abc-123',
  });
  assert.doesNotMatch(built.html, /<script>/);
  assert.match(built.html, /&lt;script&gt;/);
});
