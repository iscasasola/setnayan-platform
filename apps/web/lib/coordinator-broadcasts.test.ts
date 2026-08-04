/**
 * Unit suite for the Coordinator P3 pure core — broadcast body validation
 * (mirrors the table CHECK) and the per-vendor call-time derivation + email
 * shaping. The derivation is the behavior the spec pins: a vendor's call time
 * is the EARLIEST run-of-show block they're tagged responsible on (P2's
 * responsible_vendor_ids lens); untagged or email-less vendors get nothing —
 * tagging is the opt-in, no invented call times.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BROADCAST_MAX_LENGTH,
  validateBroadcastBody,
  deriveVendorCallTimes,
  formatCallTimePh,
  buildCallTimeEmail,
  type CallTimeBlock,
  type CallTimeVendor,
} from './coordinator-broadcasts';
import type { RosMetaMap } from './schedule-ros';

const VENDOR_HMUA = 'vendor-hmua';
const VENDOR_PHOTO = 'vendor-photo';
const VENDOR_CATER = 'vendor-cater';

/** 08:00 / 14:00 / 18:00 UTC = 16:00 / 22:00 / 02:00(+1) in Asia/Manila. */
function blocks(): CallTimeBlock[] {
  return [
    // ⚠ WALL CLOCKS, as the app actually stores them: 8 AM, 2 PM, 6 PM AT THE
    // VENUE. These fixtures previously used the instant convention (06:00Z
    // commented as "2 PM Manila"), which is why a live eight-hour error in the
    // call-time EMAIL sat under a green suite for months — the fixture and the
    // bug cancelled each other out.
    { block_id: 'prep', label: 'Hair & makeup', start_at: '2026-12-12T08:00:00.000Z', location: 'Bridal suite' },
    { block_id: 'ceremony', label: 'Ceremony', start_at: '2026-12-12T14:00:00.000Z', location: 'San Agustin Church' },
    { block_id: 'reception', label: 'Reception', start_at: '2026-12-12T18:00:00.000Z', location: null },
  ];
}

function meta(entries: Record<string, string[]>): RosMetaMap {
  const map: RosMetaMap = new Map();
  for (const [blockId, vendorIds] of Object.entries(entries)) {
    map.set(blockId, { responsible_party: null, responsible_vendor_ids: vendorIds });
  }
  return map;
}

function vendors(): CallTimeVendor[] {
  return [
    { vendor_id: VENDOR_HMUA, vendor_name: 'Glam Studio', contact_email: 'glam@example.com' },
    { vendor_id: VENDOR_PHOTO, vendor_name: 'Aperture Co', contact_email: 'shoot@example.com' },
    { vendor_id: VENDOR_CATER, vendor_name: 'Kusina Events', contact_email: 'eat@example.com' },
  ];
}

// ─────────────────────── validateBroadcastBody ───────────────────────

test('validateBroadcastBody — trims and accepts a normal message', () => {
  const result = validateBroadcastBody('  Dinner is moving up 15 minutes.  ');
  assert.deepEqual(result, { ok: true, body: 'Dinner is moving up 15 minutes.' });
});

test('validateBroadcastBody — rejects empty, whitespace-only, and non-string', () => {
  assert.equal(validateBroadcastBody('').ok, false);
  assert.equal(validateBroadcastBody('   ').ok, false);
  assert.equal(validateBroadcastBody(null).ok, false);
  assert.equal(validateBroadcastBody(undefined).ok, false);
});

test('validateBroadcastBody — enforces the 500-char CHECK boundary', () => {
  assert.equal(validateBroadcastBody('x'.repeat(BROADCAST_MAX_LENGTH)).ok, true);
  assert.equal(validateBroadcastBody('x'.repeat(BROADCAST_MAX_LENGTH + 1)).ok, false);
});

// ─────────────────────── deriveVendorCallTimes ───────────────────────

test('call time = earliest tagged block, not the first in array order', () => {
  // Photo is tagged on reception AND prep (listed later) — prep must win.
  const result = deriveVendorCallTimes(
    blocks(),
    meta({ reception: [VENDOR_PHOTO], prep: [VENDOR_PHOTO] }),
    vendors(),
  );
  assert.equal(result.length, 1);
  const first = result[0];
  assert.ok(first);
  assert.equal(first.vendorId, VENDOR_PHOTO);
  assert.equal(first.callTimeAt, '2026-12-12T08:00:00.000Z'); // 8 AM at the venue
  assert.equal(first.blockLabel, 'Hair & makeup');
  assert.equal(first.location, 'Bridal suite');
});

test('untagged vendors are excluded — tagging is the opt-in', () => {
  const result = deriveVendorCallTimes(
    blocks(),
    meta({ prep: [VENDOR_HMUA] }),
    vendors(),
  );
  assert.deepEqual(
    result.map((r) => r.vendorId),
    [VENDOR_HMUA],
  );
});

test('vendors without a contact email are excluded even when tagged', () => {
  const noEmail: CallTimeVendor[] = [
    { vendor_id: VENDOR_HMUA, vendor_name: 'Glam Studio', contact_email: null },
    { vendor_id: VENDOR_PHOTO, vendor_name: 'Aperture Co', contact_email: '   ' },
  ];
  const result = deriveVendorCallTimes(
    blocks(),
    meta({ prep: [VENDOR_HMUA, VENDOR_PHOTO] }),
    noEmail,
  );
  assert.equal(result.length, 0);
});

test('result is sorted by call time, then vendor name', () => {
  const result = deriveVendorCallTimes(
    blocks(),
    meta({
      ceremony: [VENDOR_PHOTO],
      prep: [VENDOR_HMUA],
      reception: [VENDOR_CATER],
    }),
    vendors(),
  );
  assert.deepEqual(
    result.map((r) => r.vendorId),
    [VENDOR_HMUA, VENDOR_PHOTO, VENDOR_CATER],
  );
});

test('empty meta (feature dark / pre-migration) derives nothing', () => {
  const result = deriveVendorCallTimes(blocks(), new Map(), vendors());
  assert.equal(result.length, 0);
});

test('a dangling tagged vendor id (removed from registry) is harmless', () => {
  const result = deriveVendorCallTimes(
    blocks(),
    meta({ prep: ['vendor-deleted'] }),
    vendors(),
  );
  assert.equal(result.length, 0);
});

// ─────────────────────── email shaping ───────────────────────

test('formatCallTimePh renders the time AS WRITTEN on the schedule', () => {
  // ⚠ THIS TEST ASSERTED THE BUG until 2026-08-04. It read `00:00Z` as an
  // INSTANT and expected "8:00 AM" — the Manila translation of midnight UTC.
  // But `start_at` holds the venue's WALL CLOCK, so `00:00Z` IS midnight at the
  // venue, and the old code's `timeZone: 'Asia/Manila'` added eight hours to a
  // value that was already Manila time.
  const formatted = formatCallTimePh('2026-12-12T14:00:00.000Z');
  assert.match(formatted, /Saturday/);
  assert.match(formatted, /December 12/);
  assert.match(formatted, /2:00/, 'a 2 PM ceremony must email as 2 PM');
  assert.ok(!/10:00/.test(formatted), 'not 10 PM — that is the eight-hour shift');
});

test('formatCallTimePh · a late send-off does not roll into the next day', () => {
  // The worst version of the old bug: 21:45 emailed as 5:45 AM the FOLLOWING
  // morning — wrong day as well as wrong hour, in a message nobody can recall.
  const formatted = formatCallTimePh('2026-12-12T21:45:00.000Z');
  assert.match(formatted, /December 12/, 'must stay on the wedding day');
  assert.match(formatted, /9:45/);
});

test('formatCallTimePh · the answer does not depend on where the code runs', () => {
  // Emails are built on a server whose TZ is UTC; the tests run there too,
  // which is precisely where this class of defect is invisible.
  const expected = formatCallTimePh('2026-12-12T14:00:00.000Z');
  for (const tz of ['UTC', 'Asia/Manila', 'America/New_York', 'Pacific/Kiritimati']) {
    const before = process.env.TZ;
    process.env.TZ = tz;
    assert.equal(formatCallTimePh('2026-12-12T14:00:00.000Z'), expected, `differs under TZ=${tz}`);
    process.env.TZ = before;
  }
});

test('formatCallTimePh · an unreadable value yields nothing, never a wrong time', () => {
  assert.equal(formatCallTimePh('not a time'), '');
});

test('buildCallTimeEmail — subject + body carry the when/what/where', () => {
  const [callTime] = deriveVendorCallTimes(
    blocks(),
    meta({ ceremony: [VENDOR_PHOTO] }),
    vendors(),
  );
  assert.ok(callTime);
  const email = buildCallTimeEmail({
    callTime,
    eventDisplayName: 'Maria & Jose',
  });
  assert.equal(email.to, 'shoot@example.com');
  assert.match(email.subject, /Maria & Jose/);
  assert.match(email.text, /Hi Aperture Co,/);
  assert.match(email.text, /Ceremony \(San Agustin Church\)/);
  // 06:00Z = 2:00 PM Manila.
  assert.match(email.text, /2:00/);
});

test('buildCallTimeEmail — no location renders without the parenthetical', () => {
  const [callTime] = deriveVendorCallTimes(
    blocks(),
    meta({ reception: [VENDOR_CATER] }),
    vendors(),
  );
  assert.ok(callTime);
  const email = buildCallTimeEmail({ callTime, eventDisplayName: 'Maria & Jose' });
  assert.match(email.text, /Your part of the day: Reception\n/);
  assert.doesNotMatch(email.text, /Reception \(/);
});
