/**
 * nfc-tag.test.ts — the pure half of "Write to NFC" answers every question the
 * sheet asks it, without a phone.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NFC_TAG_CAPACITY_BYTES,
  NFC_WRITE_TIMEOUT_MS,
  classifyNativeNfcError,
  classifyNfcError,
  decodeNdefUriRecords,
  guestTokenFromTag,
  ndefUriRecord,
  nfcReadFailureCopy,
  ndefUrlTagBytes,
  sessionEndReason,
  nfcFailureCopy,
  nfcTagEligibility,
  nfcWriteSupported,
  readBackMatches,
  smallestTagFor,
  tagSizeCopy,
  type NfcFailureReason,
} from './nfc-tag';

test('only an http(s) link may go on a tag', () => {
  assert.deepEqual(nfcTagEligibility('https://www.setnayan.com/vendor-invite/saysay'), {
    eligible: true,
    url: 'https://www.setnayan.com/vendor-invite/saysay',
  });
  assert.equal(nfcTagEligibility('http://localhost:3000/x').eligible, true);
  // The crew pairing QR — iPhone ignores a custom-scheme tag on a background read.
  assert.deepEqual(nfcTagEligibility('setnayan://crew-pair?event_id=1&token=abc'), {
    eligible: false,
    reason: 'custom-scheme',
  });
  // A QR Ph / GCash payment payload is not a link at all.
  assert.deepEqual(nfcTagEligibility('00020101021228530010A000000677010112011512345678901234'), {
    eligible: false,
    reason: 'not-a-link',
  });
  assert.deepEqual(nfcTagEligibility('   '), { eligible: false, reason: 'empty' });
  assert.deepEqual(nfcTagEligibility(null), { eligible: false, reason: 'empty' });
});

test('NDEF byte math: short record, abbreviated prefix, TLV wrapper', () => {
  // "https://www." is prefix 0x02 → 1 id byte + 18 bytes of the rest = 19 payload
  // → 4-byte short-record header = 23 → TLV 0x03 + len + 23 + 0xFE = 26.
  assert.equal(ndefUrlTagBytes('https://www.setnayan.com/v/abc'), 26);
  // Past 255 payload bytes the record header grows to 7 and the TLV length to 3.
  const long = `https://x.com/${'a'.repeat(300)}`;
  assert.equal(ndefUrlTagBytes(long), 4 + (7 + 1 + 6 + 300) + 1);
  // A multi-byte character costs its UTF-8 width, not 1.
  assert.equal(ndefUrlTagBytes('https://x.com/é') - ndefUrlTagBytes('https://x.com/e'), 1);
});

test('a real per-guest invitation link fits the cheapest sticker', () => {
  // guests.qr_token DEFAULT encode(gen_random_bytes(16), 'hex') → 32 hex chars;
  // nested /u/<owner>/<slug> is the longest public path form.
  const token = 'f'.repeat(32);
  const url = `https://www.setnayan.com/u/ana-and-miguel-wedding/ana-miguel-december-2026?invite=${token}`;
  assert.ok(ndefUrlTagBytes(url) <= NFC_TAG_CAPACITY_BYTES.NTAG213, `${ndefUrlTagBytes(url)} bytes`);
  assert.equal(smallestTagFor(url), 'NTAG213');
  assert.equal(tagSizeCopy(url), 'Fits any standard NFC sticker.');
});

test('a long link names the sticker it needs, and an impossible one says so', () => {
  const medium = `https://www.setnayan.com/${'p'.repeat(200)}`;
  assert.equal(smallestTagFor(medium), 'NTAG215');
  assert.match(tagSizeCopy(medium), /NTAG215/);
  const huge = `https://www.setnayan.com/${'p'.repeat(900)}`;
  assert.equal(smallestTagFor(huge), null);
  assert.match(tagSizeCopy(huge), /too long/);
});

test('every thrown error becomes one named reason', () => {
  const dom = (name: string, message = '') => ({ name, message });
  assert.equal(classifyNfcError(dom('NotAllowedError')), 'permission-denied');
  assert.equal(classifyNfcError(dom('NotReadableError')), 'nfc-off');
  assert.equal(classifyNfcError(dom('NetworkError', 'transfer failed')), 'tag-moved');
  assert.equal(classifyNfcError(dom('NotSupportedError')), 'unsupported-tag');
  assert.equal(classifyNfcError(dom('AbortError'), { timedOut: true }), 'timed-out');
  assert.equal(classifyNfcError(dom('AbortError'), { cancelled: true }), 'cancelled');
  assert.equal(classifyNfcError(dom('ReferenceError', 'NDEFReader is not defined')), 'unsupported-browser');
  assert.equal(classifyNfcError(dom('SecurityError')), 'unsupported-browser');
  assert.equal(classifyNfcError(undefined), 'unexpected');
  assert.equal(classifyNfcError(dom('SomethingNew')), 'unexpected');
  // Message text outranks the name for the two conditions the person can fix
  // by changing the sticker.
  assert.equal(classifyNfcError(dom('NotAllowedError', 'NFC tag is read-only')), 'tag-locked');
  assert.equal(classifyNfcError(dom('NetworkError', 'The tag is write-protected')), 'tag-locked');
  assert.equal(classifyNfcError(dom('NotSupportedError', 'Message exceeds tag capacity')), 'tag-too-small');
});

test('every reason has its own sentence, and none is generic', () => {
  const reasons: NfcFailureReason[] = [
    'permission-denied', 'nfc-off', 'tag-moved', 'tag-locked', 'tag-too-small',
    'unsupported-tag', 'timed-out', 'cancelled', 'unsupported-browser', 'no-nfc', 'mismatch', 'unexpected',
  ];
  const seen = new Set<string>();
  for (const r of reasons) {
    const copy = nfcFailureCopy(r);
    assert.ok(copy.length > 20, r);
    assert.ok(!/something went wrong/i.test(copy), r);
    assert.ok(!seen.has(copy), `duplicate copy for ${r}`);
    seen.add(copy);
  }
  assert.match(nfcFailureCopy('timed-out'), new RegExp(`${NFC_WRITE_TIMEOUT_MS / 1000} seconds`));
});

test('read-back is an exact match, never a near one', () => {
  const url = 'https://www.setnayan.com/v/saysay#reviews';
  assert.equal(readBackMatches([url], url), true);
  assert.equal(readBackMatches(['https://www.setnayan.com/v/other', url], url), true);
  assert.equal(readBackMatches([`${url}/`], url), false);
  assert.equal(readBackMatches([url.toUpperCase()], url), false);
  assert.equal(readBackMatches([], url), false);
});

test('support is decided by the global, so it can be asked without a DOM', () => {
  assert.equal(nfcWriteSupported(null), false);
  assert.equal(nfcWriteSupported({}), false);
  assert.equal(nfcWriteSupported({ NDEFReader: class {} }), true);
});

test('the app writes a real NDEF URI record, abbreviated per the spec table', () => {
  const r = ndefUriRecord('https://www.setnayan.com/v/abc');
  assert.equal(r.tnf, 1);
  assert.deepEqual(r.type, [0x55]);
  assert.deepEqual(r.id, []);
  assert.equal(r.payload[0], 0x02); // "https://www."
  assert.equal(new TextDecoder().decode(Uint8Array.from(r.payload.slice(1))), 'setnayan.com/v/abc');
  assert.equal(ndefUriRecord('https://setnayan-platform-web.vercel.app/x').payload[0], 0x04); // "https://"
  assert.equal(ndefUriRecord('http://localhost:3000/x').payload[0], 0x03); // "http://"
  // The byte budget and the record agree: payload + 4 header + 3 TLV bytes.
  const url = 'https://www.setnayan.com/vendor-invite/saysay-live-band-and-hosting-fix';
  assert.equal(ndefUrlTagBytes(url), ndefUriRecord(url).payload.length + 4 + 3);
});

test('what the app reads back decodes to the exact link it wrote', () => {
  const urls = [
    'https://www.setnayan.com/u/ana-miguel/ana-miguel-2026?invite=' + 'a1'.repeat(16),
    'https://www.setnayan.com/v/saysay#reviews',
    'http://localhost:3000/vendor/lock/tok_é',
  ];
  for (const url of urls) assert.deepEqual(decodeNdefUriRecords([ndefUriRecord(url)]), [url]);
  // Other records are skipped, not guessed at; an absolute-URI record is read.
  const text = { tnf: 1, type: [0x54], id: [], payload: [2, 101, 110, 104, 105] };
  const abs = { tnf: 3, type: [...new TextEncoder().encode('https://x.com/a')], id: [], payload: [] };
  const reserved = { tnf: 1, type: [0x55], id: [], payload: [0xfe, 97] };
  assert.deepEqual(decodeNdefUriRecords([text, abs, reserved]), ['https://x.com/a']);
  assert.deepEqual(decodeNdefUriRecords(null), []);
  assert.deepEqual(decodeNdefUriRecords([]), []);
});

test("the plugin's rejections name the same reasons as the web path", () => {
  assert.equal(classifyNativeNfcError({ code: 'NFC_DISABLED', message: 'NFC is currently disabled.' }), 'nfc-off');
  assert.equal(classifyNativeNfcError({ code: 'NO_NFC', message: 'NFC is not available on the simulator.' }), 'no-nfc');
  assert.equal(classifyNativeNfcError({ message: 'Tag is read only.' }), 'tag-locked');
  assert.equal(classifyNativeNfcError({ message: 'Tag capacity is insufficient for the provided message.' }), 'tag-too-small');
  assert.equal(classifyNativeNfcError({ message: 'Tag does not support NDEF.' }), 'unsupported-tag');
  assert.equal(classifyNativeNfcError({ message: 'Failed to connect to tag.' }), 'tag-moved');
  assert.equal(classifyNativeNfcError({ message: 'Tag connection lost.' }), 'tag-moved');
  assert.equal(classifyNativeNfcError({ code: 'CANCELLED', message: 'superseded' }), 'cancelled');
  assert.equal(classifyNativeNfcError({ message: 'Failed to write NDEF message.' }), 'unexpected');
  assert.equal(sessionEndReason('userCancelled'), 'cancelled');
  assert.equal(sessionEndReason('sessionTimeout'), 'timed-out');
  assert.equal(sessionEndReason('invalidated'), 'unexpected');
  assert.equal(sessionEndReason(undefined), 'unexpected');
});

test('a tag and a QR are judged by the one parser', async () => {
  const { parseGuestQrPayload } = await import('./checkin');
  const token = 'ab'.repeat(16);
  const invite = `https://www.setnayan.com/u/o/ana-miguel?invite=${token}`;
  assert.deepEqual(guestTokenFromTag([invite], parseGuestQrPayload), { token });
  // The first record that is a guest code wins; other records are ignored.
  assert.deepEqual(
    guestTokenFromTag(['https://www.setnayan.com/v/saysay', invite], parseGuestQrPayload),
    { token },
  );
  assert.deepEqual(guestTokenFromTag([], parseGuestQrPayload), { token: null, reason: 'empty' });
  assert.deepEqual(guestTokenFromTag(['https://www.setnayan.com/v/saysay'], parseGuestQrPayload), {
    token: null,
    reason: 'not-a-guest-code',
  });
  // A tag written by the strip round-trips to the same token the QR yields.
  assert.deepEqual(
    guestTokenFromTag(decodeNdefUriRecords([ndefUriRecord(invite)]), parseGuestQrPayload),
    { token },
  );
});

test('read failures are worded for a desk, and always offer the QR', () => {
  for (const r of ['permission-denied', 'nfc-off', 'no-nfc', 'unsupported-browser'] as const) {
    assert.match(nfcReadFailureCopy(r), /QR/, r);
  }
  assert.match(nfcReadFailureCopy('timed-out'), /Read a tag/);
  assert.doesNotMatch(nfcReadFailureCopy('tag-moved'), /write/i);
});
