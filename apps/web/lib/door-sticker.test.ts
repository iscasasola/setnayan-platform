/**
 * 🚪 THE DOOR STICKER — "We are part of SETNAYAN" (owner 2026-11-05, *"add them to the marketing tools"*).
 *
 * Not "the file exists": the sticker is RENDERED by the shipped layout, rasterised, and its code read back by `jsqr` —
 * a detector that never saw the input — to the exact address the QR card shows. The rest pins what the owner ruled:
 * the code is one of the shop's own (no new public page), the badges are read at print time, every mark is a shape,
 * and the two sizes are real millimetres.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { PDFDocument } from 'pdf-lib';
import { checkADateUrl } from './check-a-date';
import { ownPageUrl, SUPPLIER_QR_MODES, SUPPLIER_QR_MODE_LABEL } from './supplier-qr-codes';
import { badgesForPrint, type ShopBadgeFacts } from './shop-badges';
import { stripComments } from './strip-comments';
import {
  DOOR_STICKER_CODES,
  DOOR_STICKER_CODE_LABEL,
  DOOR_STICKER_SIZES,
  doorStickerCodeFor,
  doorStickerFileName,
  doorStickerHref,
} from './door-sticker';
import { doorStickerPdf, doorStickerSidePt, doorStickerSvg, layoutDoorSticker } from './door-sticker-print';

const FACTS: ShopBadgeFacts = {
  verified: true,
  completedEvents: 57,
  trusted: { trusted_avg_rating: 4.8, trusted_review_count: 12 },
  inBusinessSinceYear: 2015,
  awards: [],
  nowYear: 2026,
};
const ORIGIN = 'https://www.setnayan.com';
const SLUG = 'tita-nenas-catering';
// 💳 The door sticker is the supplier's own code: ?src=own (owner 2026-11-13, F-W1-58).
const URLS = { page: ownPageUrl(ORIGIN, SLUG), dates: checkADateUrl(ORIGIN, SLUG) } as const;

async function scan(svg: string): Promise<string | null> {
  const { data, info } = await sharp(Buffer.from(svg), { density: 72 }).resize(1000, 1000).flatten({ background: '#ffffff' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info.width, info.height)?.data ?? null;
}

test('every code × size scans back to the SAME address the QR card shows', async () => {
  for (const code of DOOR_STICKER_CODES) {
    for (const size of DOOR_STICKER_SIZES) {
      const svg = doorStickerSvg({ shopName: 'Tita Nena’s Catering', url: URLS[code], code, size, badges: badgesForPrint(FACTS) });
      assert.equal(await scan(svg), URLS[code], `${code} · ${size} did not scan to ${URLS[code]}`);
    }
  }
});

test('the code is one of the shop’s own — My page or Check a date — named as the QR dropdown names it', () => {
  for (const c of DOOR_STICKER_CODES) {
    assert.ok((SUPPLIER_QR_MODES as readonly string[]).includes(c), `${c} is not one of the shop’s QR codes`);
    assert.equal(DOOR_STICKER_CODE_LABEL[c], SUPPLIER_QR_MODE_LABEL[c], `${c} is called two things`);
  }
  assert.deepEqual([...DOOR_STICKER_CODES], ['page', 'dates']);
  // On the QR page the sticker starts on the code being shown, else My page.
  assert.equal(doorStickerCodeFor('dates'), 'dates');
  for (const m of SUPPLIER_QR_MODES.filter((m) => m !== 'dates')) assert.equal(doorStickerCodeFor(m), 'page');
  // The route builds the address with the same two helpers the QR card uses — no sticker page.
  const route = stripComments(fs.readFileSync(path.join(__dirname, '../app/api/vendor/door-sticker/route.ts'), 'utf8'));
  assert.match(route, /checkADateUrl\(siteOrigin\(\), slug\)/);
  assert.match(route, /ownPageUrl\(siteOrigin\(\), slug\)/);
  assert.equal(fs.existsSync(path.join(__dirname, '../app/v/[slug]/sticker')), false, 'a sticker must not get its own public page');
});

test('the badges are READ AT PRINT TIME — the route reads the facts now and passes them through badgesForPrint', () => {
  const route = stripComments(fs.readFileSync(path.join(__dirname, '../app/api/vendor/door-sticker/route.ts'), 'utf8'));
  assert.match(route, /readShopBadgeFacts\(createAdminClient\(\), /);
  assert.match(route, /badges: badgesForPrint\(facts\)/);
  assert.match(route, /fetchOwnVendorProfile\(supabase, user\.id\)/, 'own shop only');
  // A shop with no badges prints without the row; one with badges prints one pill per badge.
  const bare = layoutDoorSticker({ shopName: 'Bago', url: URLS.page, code: 'page', size: 'door', badges: [] });
  const worn = layoutDoorSticker({ shopName: 'Bago', url: URLS.page, code: 'page', size: 'door', badges: badgesForPrint(FACTS) });
  const pills = (d: typeof bare) => d.ops.filter((o) => o.t === 'circle').length;
  assert.equal(pills(bare), 0);
  assert.equal(pills(worn), badgesForPrint(FACTS).length, 'one pill (one circle) per badge worn today');
});

test('every word is outlined, the sizes are real millimetres, and the window is the door twice as large', () => {
  const input = { shopName: 'Tita Nena’s Catering', url: URLS.dates, code: 'dates' as const, badges: badgesForPrint(FACTS) };
  const door = doorStickerSvg({ ...input, size: 'door' });
  const window = doorStickerSvg({ ...input, size: 'window' });
  for (const svg of [door, window]) {
    assert.doesNotMatch(svg, /<text\b/, 'no <text> a print shop could lack the font for');
    assert.doesNotMatch(svg, /<image\b/, 'the code and the mark are shapes, not pictures');
    assert.match(svg, /^<\?xml/);
  }
  assert.match(door, /width="200mm" height="200mm"/);
  assert.match(window, /width="400mm" height="400mm"/);
  assert.equal(doorStickerSidePt('window'), doorStickerSidePt('door') * 2);
  const words = layoutDoorSticker({ ...input, size: 'door' }).ops.flatMap((o) => (o.t === 'path' && o.text ? [o.text.s] : []));
  assert.deepEqual(words.slice(0, 2), ['WE ARE PART OF', 'SETNAYAN']);
  assert.ok(words.includes('Tita Nena’s Catering'), 'the shop’s name is on it');
  assert.ok(words.includes('Scan to check your date'));
});

test('a long shop name is shrunk to fit inside the frame, never cut', () => {
  const doc = layoutDoorSticker({ shopName: 'The Grand Ballroom Events Place and Catering Services of Quezon City', url: URLS.page, code: 'page', size: 'door', badges: [] });
  const name = doc.ops.find((o) => o.t === 'path' && o.text?.s.startsWith('The Grand'));
  assert.ok(name && name.t === 'path' && name.text);
  assert.ok(name.text.width <= (name.text.maxWidth ?? 0) + 0.5, `the name is ${name.text.width} wide in a ${name.text.maxWidth} line`);
  assert.ok(name.text.size < name.text.asked, 'it was set smaller than asked');
});

test('the PDF is print-ready through the house pipeline: 20 cm trim, 3 mm bleed, crop marks', async () => {
  const pdf = Buffer.from(await doorStickerPdf({ shopName: 'Tita Nena’s Catering', url: URLS.page, code: 'page', size: 'door', badges: badgesForPrint(FACTS) }));
  const head = pdf.subarray(0, 5).toString('latin1');
  assert.equal(head, '%PDF-');
  const page = (await PDFDocument.load(pdf)).getPage(0);
  const trim = page.getTrimBox();
  const bleed = page.getBleedBox();
  const side = doorStickerSidePt('door');
  assert.ok(Math.abs(trim.width - side) < 0.01 && Math.abs(trim.height - side) < 0.01, `trim is ${trim.width} × ${trim.height}, not 20 cm`);
  assert.ok(Math.abs(bleed.width - (side + 2 * 3 * (72 / 25.4))) < 0.01, 'a 3 mm bleed on every side');
  assert.ok(page.getWidth() > bleed.width, 'room for crop marks outside the bleed');
  // Drawn by the shared print renderer, never a second PDF writer.
  const lib = stripComments(fs.readFileSync(path.join(__dirname, 'door-sticker-print.ts'), 'utf8'));
  assert.match(lib, /renderPrintPdf\(\[layoutDoorSticker\(input\)\]/);
  assert.match(lib, /renderPrintSvg\(doc, /);
  assert.doesNotMatch(lib, /from 'pdf-lib'/);
});

test('the sticker is a SHOP piece — never one of the couple’s Prints & Tickets', async () => {
  const { PRINT_PIECES, SHOP_PRINT_PIECES, isPrintPieceKey } = await import('./print-pieces');
  assert.ok('door-sticker' in SHOP_PRINT_PIECES);
  assert.equal('door-sticker' in PRINT_PIECES, false);
  assert.equal(isPrintPieceKey('door-sticker'), false, '/api/hub-print/door-sticker must stay a 404');
});

test('downloads go through the route with the picked code and size, and are named for them', () => {
  assert.equal(doorStickerHref('dates', 'window', 'pdf'), '/api/vendor/door-sticker?code=dates&size=window&format=pdf');
  assert.equal(doorStickerFileName('page', 'door', 'svg'), 'setnayan-door-sticker-my-page-20cm.svg');
  assert.equal(doorStickerFileName('dates', 'window', 'pdf'), 'setnayan-door-sticker-check-a-date-40cm.pdf');
});
