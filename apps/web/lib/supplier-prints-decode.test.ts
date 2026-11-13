/**
 * 🖨🔳 EVERY PRINTED QR SCANS TO THE SHOP'S REAL ADDRESS — the supplier prints (Shop › Promote part 3).
 *
 * The pattern of `lib/every-qr-look-decodes.test.ts` / `lib/check-a-date-qr.test.ts`: draw the REAL artefact with the
 * one renderer (`renderPrint`), rasterise it with sharp, and scan it back with jsQR — never assert that a flag was set.
 * A tarp that prints a code which does not scan is a wasted print run, and nothing else would notice.
 *
 *   · all 15 looks × every piece that carries the code (the card's back, the standee, the door print, the backdrop,
 *     the tarp, the roll-up, the table-front) — with the Check a date code, the default;
 *   · all 3 codes (Check a date · Shortlist · My page) on every piece — each address built by the SAME helper the
 *     Promote codes use (`printQrUrl` → `checkADateUrl` / `buildVendorInviteUrl` / `myPageUrl`);
 *   · the Save files themselves (exact size + bleed), not only the screen drawing;
 *   · with a long name, seal, rating and badges on — the busiest the layout gets.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { renderPrint, type PrintShop } from '@/lib/supplier-prints-svg';
import { printQrUrl } from '@/lib/supplier-prints-shop';
import { PRINT_DESIGNS, PRINT_PIECES, PRINT_QR_ORDER, pieceHasQr, type PrintPiece, type PrintSide } from '@/lib/supplier-prints';
import { shopBadges } from '@/lib/shop-badges';
import { checkADateUrl } from '@/lib/check-a-date';
import { myPageUrl, ownPageUrl } from '@/lib/supplier-qr-codes';
import { buildVendorInviteUrl } from '@/lib/vendor-couple-invite';
import { reviewDoorPath } from '@/lib/shop-review-door';

const ORIGIN = 'https://www.setnayan.com';
const SLUG = 'casa-buenaventura';

const facts = { verified: true, completedEvents: 100, trusted: { trusted_avg_rating: 4.9, trusted_review_count: 32 }, inBusinessSinceYear: 2014, awards: ['Setnayan’s Top Pick'], nowYear: 2026 };
const BUSY: PrintShop = {
  name: 'Casa Buenaventura Catering & Events Services',
  line: 'Catering · Buffets · Grazing tables',
  ini: 'CB',
  handle: `setnayan.com/v/${SLUG}`,
  verified: true,
  rating: { avg: 4.9, count: 32 },
  badges: shopBadges(facts),
};
const PLAIN: PrintShop = { name: 'Setnayan Productions', line: 'Weddings & Events', ini: 'SP', handle: 'setnayan.com/v/setnaprod', verified: false, rating: null, badges: [] };

async function scan(svg: string, width: number, density = 144): Promise<string | null> {
  const { data, info } = await sharp(Buffer.from(svg), { density })
    .resize({ width })
    .flatten({ background: '#ffffff' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const hit = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info.width, info.height);
  return hit?.data ?? null;
}

/** A width that gives the code ~6 px a module on every piece (the card's code is a quarter of its width). */
const widthFor = (p: PrintPiece) => (p.id === 'card' ? 1400 : p.id === 'table' || p.id === 'tarp' ? 1600 : 900);

const SIDES: Array<[PrintPiece, PrintSide]> = PRINT_PIECES.flatMap((p) => (p.sides === 2 ? (['f', 'b'] as const) : (['f'] as const)).map((s) => [p, s] as [PrintPiece, PrintSide])).filter(([p, s]) => pieceHasQr(p.id, s));

test('seven sides carry the code — every piece but the card’s front', () => {
  assert.deepEqual(SIDES.map(([p, s]) => `${p.id}:${s}`), ['card:b', 'standee:f', 'door:f', 'backdrop:f', 'tarp:f', 'rollup:f', 'table:f']);
});

test('the printed address is the one the Promote codes already build — never typed here', () => {
  assert.equal(printQrUrl('dates', ORIGIN, SLUG), checkADateUrl(ORIGIN, SLUG));
  // 💳 A printed My page code is the supplier's own link: ?src=own (owner 2026-11-13, F-W1-58).
  assert.equal(printQrUrl('page', ORIGIN, SLUG), ownPageUrl(ORIGIN, SLUG));
  assert.equal(printQrUrl('shortlist', ORIGIN, SLUG), buildVendorInviteUrl(SLUG, { eventType: null, category: null }));
  assert.equal(printQrUrl('dates', ORIGIN, SLUG), `${ORIGIN}/v/${SLUG}/dates`);
  // Reviews opens the WRITE door (owner 2026-11-06 "Write a review"): /v/<slug>/review → the couple's "Leave a review",
  // or the shop page's reviews section (`<section id="reviews">` on /v/[slug]) for anyone without a booking ready for one.
  assert.equal(printQrUrl('reviews', ORIGIN, SLUG), `${myPageUrl(ORIGIN, SLUG)}/review`);
  assert.equal(printQrUrl('reviews', ORIGIN, SLUG), `${ORIGIN}${reviewDoorPath(SLUG)}`);
  assert.ok(existsSync(new URL('../app/v/[slug]/review/route.ts', import.meta.url)), 'the Reviews code prints an address with no route behind it');
  assert.match(readFileSync(new URL('../app/v/[slug]/page.tsx', import.meta.url), 'utf8'), /<section id="reviews"/, 'the shop page lost the #reviews section the Reviews door falls back to');
});

for (const d of PRINT_DESIGNS) {
  test(`${d.name}: the Check a date code scans on every piece that carries it`, async () => {
    const url = printQrUrl('dates', ORIGIN, SLUG);
    for (const [p, s] of SIDES) {
      const svg = renderPrint({ piece: p, design: d, shop: BUSY, qr: { mode: 'dates', url }, side: s });
      assert.equal(await scan(svg, widthFor(p)), url, `${d.name} · ${p.name}${s === 'b' ? ' (back)' : ''} does not scan to ${url}`);
    }
  });
}

test('every code scans on every piece (Check a date · Shortlist · My page · Reviews)', async () => {
  for (const mode of PRINT_QR_ORDER) {
    const url = printQrUrl(mode, ORIGIN, SLUG);
    for (const [p, s] of SIDES) {
      const svg = renderPrint({ piece: p, design: PRINT_DESIGNS[0]!, shop: PLAIN, qr: { mode, url }, side: s });
      assert.equal(await scan(svg, widthFor(p)), url, `${mode} on ${p.name} does not scan`);
    }
  }
});

test('the Save files scan too — exact size, bleed and all (Jet mono, Spotlight, Kraft: the darkest, the busiest grounds)', async () => {
  const url = printQrUrl('dates', ORIGIN, SLUG);
  for (const id of ['mono', 'spotlight', 'kraft'] as const) {
    const d = PRINT_DESIGNS.find((x) => x.id === id)!;
    for (const p of PRINT_PIECES) {
      const svg = renderPrint({ piece: p, design: d, shop: BUSY, qr: { mode: 'dates', url }, for: 'print' });
      // the card's file is front over back: the code is in its lower half
      // rasterised at a density that draws the file ~widthFor(p) px wide (an 8 ft backdrop at 144 dpi is 1.9 gigapixels)
      const density = Math.min(300, (widthFor(p) * 25.4) / (p.mm.w + 6));
      assert.equal(await scan(svg, widthFor(p), density), url, `the ${p.name} Save file in ${d.name} does not scan`);
    }
  }
});

test('the card’s FRONT carries no code (its code is on the back)', () => {
  const svg = renderPrint({ piece: PRINT_PIECES[0]!, design: PRINT_DESIGNS[0]!, shop: PLAIN, qr: { mode: 'dates', url: `${ORIGIN}/v/x/dates` }, side: 'f' });
  assert.ok(!svg.includes('data-print-qr'), 'the front drew a code');
});
