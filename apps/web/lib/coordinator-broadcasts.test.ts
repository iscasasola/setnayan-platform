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
    { block_id: 'prep', label: 'Hair & makeup', start_at: '2026-12-12T00:00:00.000Z', location: 'Bridal suite' },
    { block_id: 'ceremony', label: 'Ceremony', start_at: '2026-12-12T06:00:00.000Z', location: 'San Agustin Church' },
    { block_id: 'reception', label: 'Reception', start_at: '2026-12-12T10:00:00.000Z', location: null },
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
  assert.equal(first.callTimeAt, '2026-12-12T00:00:00.000Z');
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

test('formatCallTimePh renders Asia/Manila wall-clock time', () => {
  // 2026-12-12T00:00Z = 08:00 AM Saturday Dec 12 in Manila (UTC+8, no DST).
  const formatted = formatCallTimePh('2026-12-12T00:00:00.000Z');
  assert.match(formatted, /Saturday/);
  assert.match(formatted, /December 12/);
  assert.match(formatted, /8:00/);
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
