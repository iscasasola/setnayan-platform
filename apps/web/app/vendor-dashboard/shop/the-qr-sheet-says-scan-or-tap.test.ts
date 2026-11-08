/**
 * 🔒 SHOP › QR = "SCAN OR TAP" (THE ONE BUILD, lane C4 — A3 §5 guard 5, as cut by spec §4: NFC status is this device's
 * write/tap test only — NO `shop_nfc_tags` table).
 *   1 · The QR sheet is Promote's ONE body (`part="qr"`) with the Tap test on the shop code's own link.
 *   2 · The Tap test reads with the shipped readers and answers with `readBackMatches`; status is this phone's only.
 *   3 · iPhone Safari gets the instruction, never a fake test; no table, no write of a status anywhere but this browser.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const BODY = stripComments(readFileSync(join(HERE, 'promote/_components/promote-body.tsx'), 'utf8'));
const TAP = stripComments(readFileSync(join(HERE, '../../_components/nfc-tap-test.tsx'), 'utf8'));
const PAGE = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));

test('1 · the QR sheet is the one body, with the Tap test on the shop code’s link', () => {
  assert.match(PAGE, /<PromoteBody search=\{qrSearch\} part="qr" \/>/);
  assert.match(BODY, /Scan or tap/);
  assert.match(BODY, /<NfcTapTest url=\{pageLink\} \/>/);
});

test('2 · the Tap test answers with the shipped read-back rule', () => {
  assert.match(TAP, /readBackMatches\(found, url\)/);
  assert.match(TAP, /decodeNdefUriRecords\(/);
  assert.match(TAP, /useNfcEnabled\(\)/, 'the Tap test is not gated like the writer');
  assert.match(TAP, /Checked on this phone/);
});

test('3 · iPhone Safari is told, not tested; no table', () => {
  assert.match(TAP, /Hold the top of any iPhone to the tag/);
  assert.doesNotMatch(TAP + BODY + PAGE, /shop_nfc_tags|shop_nfc_tag_confirm/, 'an NFC table is back — spec §4: device status only');
  assert.doesNotMatch(TAP, /\.from\(|supabase/i, 'the Tap test writes its status somewhere but this browser');
});
