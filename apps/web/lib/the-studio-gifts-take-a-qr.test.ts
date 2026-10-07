/**
 * 🔳 STUDIO › E-GIFTS TAKES THE METHOD'S QR (controller 2026-10-07; owner:
 * *"shouldn't we show the actual QR instead?"*).
 *
 * Holds: every QR-first way (`qrPrimary` — GCash, Maya) has its "Add your QR"
 * upload, on the E-Gifts manager's own shelf (`pabuya-qr/<event>`, the only
 * prefix `saveEgiftMethod` accepts — `pabuyaQrPolicy`), compressed on the phone,
 * and the ref is saved by the SHIPPED `saveEgiftMethod` (`qr_r2_key`) — no new
 * write. '' removes it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EGIFT_KIND_META } from './egift-kinds';
import { pabuyaQrPolicy } from './r2-client-ref';

const tools = readFileSync(join(__dirname, '../app/dashboard/[eventId]/launch/_components/studio-tools.tsx'), 'utf8');

test('GCash and Maya are the QR-first ways the Studio offers a QR for', () => {
  assert.equal(EGIFT_KIND_META.gcash.qrPrimary, true);
  assert.equal(EGIFT_KIND_META.maya.qrPrimary, true);
  assert.match(tools, /\{meta\.qrPrimary \? \(\s*<div data-studio-gift-qr=\{k\}>/);
});

test('the upload lands on the shelf the shipped writer accepts, compressed, and the shipped writer saves it', () => {
  assert.deepEqual(pabuyaQrPolicy('E1').prefixes, ['pabuya-qr/E1/']);
  const at = tools.indexOf('data-studio-gift-qr={k}');
  const block = tools.slice(at, at + 900);
  assert.match(block, /bucket="thread-files"\s*pathPrefix=\{`pabuya-qr\/\$\{eventId\}`\}/);
  assert.match(block, /compressImage/);
  assert.match(block, /onChange=\{\(v\) => saveQr\(k, typeof v === 'string' \? v : ''\)\}/);
  const fn = tools.slice(tools.indexOf('const saveQr ='), tools.indexOf('const saveQr =') + 1400);
  assert.match(fn, /saveEgiftMethod\(/);
  assert.match(fn, /qr_r2_key: ref,/);
});
