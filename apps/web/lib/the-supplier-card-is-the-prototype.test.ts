/**
 * THE SUPPLIER'S DIGITAL CARD IS THE APPROVED PROTOTYPE (DECISION_LOG 2026-10-30; corpus
 * `prototypes/build-contracts-2026-10-30/supplier-digital-card/index.html`).
 *
 * A REAL render, measured: 3 : 4 portrait at 1080 × 1440, the facts the owner listed (shop name · contact · covers ·
 * invited by · event · date) as drawn type, a missing fact LEFT OFF (never "TBA"), and the QR decoded back to the
 * claim link — a card whose code does not scan is not a card.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { layoutSupplierCard, supplierCardDate, supplierCardEventLabel, supplierCardFileName, SUPPLIER_CARD_PX, type SupplierCardFacts } from './supplier-card';
import { renderSupplierCardPng } from './supplier-card-render';
import { decodeQrPayloadFromImage } from './qr-decode';

const FACTS: SupplierCardFacts = {
  shopName: 'Bloom & Ribbon Styling',
  contactPerson: 'Liza Mendoza',
  services: ['Stylist / Decorator', 'Flowers'],
  invitedBy: 'Indalecio & Claire',
  eventLabel: 'Wedding',
  dateLabel: 'Fri, Dec 18, 2026',
};
const URL_ = 'https://www.setnayan.com/vendor/claim/x7k2qp-sample';

const words = (facts: SupplierCardFacts) =>
  layoutSupplierCard(facts).ops.flatMap((o) => (o.t === 'path' && o.text ? [o.text.s] : []));

test('it is a 1080 × 1440 picture whose code scans to their claim link', async () => {
  const png = await renderSupplierCardPng(FACTS, URL_);
  const meta = await sharp(Buffer.from(png)).metadata();
  assert.equal(meta.width, SUPPLIER_CARD_PX.w);
  assert.equal(meta.height, SUPPLIER_CARD_PX.h);
  assert.equal(SUPPLIER_CARD_PX.w * 4, SUPPLIER_CARD_PX.h * 3, '3 : 4 portrait');
  assert.equal(await decodeQrPayloadFromImage(png), URL_);
});

test('it says what the owner listed, in the prototype’s order', () => {
  const said = words(FACTS);
  const order = ['SETNAYAN', 'SUPPLIER CARD', 'Bloom & Ribbon Styling', 'CONTACT', 'Liza Mendoza', 'COVERS', 'Stylist / Decorator', 'Flowers', 'INVITED BY', 'Indalecio & Claire', 'EVENT', 'Wedding', 'DATE', 'Fri, Dec 18, 2026', 'Scan to join our event'];
  let at = -1;
  for (const w of order) {
    const i = said.indexOf(w, at + 1);
    assert.ok(i > at, `"${w}" is missing or out of order: ${JSON.stringify(said)}`);
    at = i;
  }
  assert.ok(said.includes('Free for you · made just for this event'));
  assert.ok(said.includes('setnayan.com'));
});

test('a missing fact is left off — never "TBA"', () => {
  const said = words({ ...FACTS, contactPerson: '', dateLabel: null, invitedBy: null });
  assert.ok(!said.includes('CONTACT'), 'no contact → no Contact row');
  assert.ok(!said.includes('DATE'));
  assert.ok(!said.includes('INVITED BY'));
  assert.ok(said.includes('COVERS') && said.includes('EVENT'));
  assert.ok(!said.some((s) => /\bTBA\b/i.test(s)));
});

test('a long name steps down a size; the code never meets the words above it', () => {
  const doc = layoutSupplierCard({ ...FACTS, shopName: 'Sampaguita Table Events & Catering Co.', services: ['Catering', 'Lechon station', 'Dessert bar', 'Grazing table', 'Coffee cart'] });
  const shop = doc.ops.filter((o) => o.t === 'path' && o.text && /Sampaguita|Catering Co/.test(o.text.s));
  assert.ok(shop.length >= 2, 'the name wraps');
  for (const o of shop) if (o.t === 'path') assert.ok(o.text!.asked < 90, 'the long name is set at 7cqw, not 8.6cqw');
  const qr = doc.ops.find((o) => o.t === 'image');
  const lowest = Math.max(...doc.ops.flatMap((o) => (o.t === 'path' && o.text?.box && !/Scan|Free for you|setnayan\.com|Set na/.test(o.text.s) ? [o.text.box.y + o.text.box.h] : [])));
  assert.ok(qr && qr.t === 'image' && qr.y > lowest, 'the QR overlaps the rows');
});

test('its file name, date and event label', () => {
  assert.equal(supplierCardFileName('Bloom & Ribbon Styling'), 'bloom-ribbon-styling-setnayan-card.png');
  assert.equal(supplierCardFileName("Tita Baby's Catering"), 'tita-baby-s-catering-setnayan-card.png');
  assert.equal(supplierCardFileName('  '), 'supplier-setnayan-card.png');
  assert.equal(supplierCardDate('2026-12-18', 'day'), 'Fri, Dec 18, 2026');
  assert.equal(supplierCardDate('2026-12-01', 'month'), null);
  assert.equal(supplierCardDate('nope'), null);
  assert.equal(supplierCardEventLabel('wedding'), 'Wedding');
});
