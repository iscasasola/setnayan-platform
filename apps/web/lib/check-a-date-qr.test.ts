/**
 * 🔳 THE "CHECK A DATE" CODE SCANS TO ITS PAGE (owner 2026-10-28, DECISION_LOG "CHECK A DATE … Every QR in the build
 * uses the app's `qrcode` library (never a drawn pattern) and is machine-scanned (`jsqr`) in a test").
 *
 * Not "the url string is right": the code is RENDERED by the same function the QR codes page calls (`checkADateQr`),
 * rasterised, and read back by `jsqr` — a detector that never saw the input — to the exact address.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { checkADateQr } from './check-a-date-qr';
import { stripComments } from './strip-comments';

async function scan(svg: string): Promise<string | null> {
  const size = 400;
  const { data, info } = await sharp(Buffer.from(svg)).resize(size, size).flatten({ background: '#ffffff' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const hit = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info.width, info.height);
  return hit?.data ?? null;
}

test('the Check-a-date code scans back to https://<site>/v/<slug>/dates exactly', async () => {
  for (const [origin, slug] of [
    ['https://www.setnayan.com', 'tita-nenas-catering'],
    ['https://setnayan.com/', 'setnaprod'],
  ] as const) {
    const { url, svg } = await checkADateQr(slug, origin);
    assert.equal(url, `${origin.replace(/\/+$/, '')}/v/${slug}/dates`);
    assert.ok(svg && svg.startsWith('<svg'), 'no code was drawn');
    assert.equal(await scan(svg), url, `the code for ${slug} did not scan to its page`);
  }
});

test('it is drawn by the qrcode library through the shared renderer, and the QR codes page shows it', () => {
  const lib = stripComments(fs.readFileSync(path.join(__dirname, 'check-a-date-qr.ts'), 'utf8'));
  assert.match(lib, /renderUrlQrSvg\(/);
  assert.match(stripComments(fs.readFileSync(path.join(__dirname, 'qr.ts'), 'utf8')), /from 'qrcode'/);
  const page = stripComments(fs.readFileSync(path.join(__dirname, '../app/vendor-dashboard/invite/page.tsx'), 'utf8'));
  assert.match(page, /checkADateQr\(slug!\)/, "the shop's QR codes page no longer draws the Check-a-date code");
});
