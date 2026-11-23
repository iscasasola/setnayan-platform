/**
 * 📐 SHOP › PROMOTE IS THE APPROVED PROTOTYPES (owner 2026-11-06: *"why do you build but not create the actual look of
 * the prototypes … what is the use of our prototype?"*).
 *
 * Pins the SHAPE the two approved designs fixed, so the build cannot drift back to the shapes they replaced:
 *
 *   1. QR codes — the shop's four now live on Shop › My QRs (owner 23 Nov 2026; drawing `supplier_store_graphs_badges_
 *      2026-11-23`, frames "My QRs" · "One QR, opened"): ONE list in the drawing's order — Your page · Reviews ·
 *      Shortlist · Check a date — each opening its own page, which ends in "Print it" › Door print · Prints (the old
 *      sheet's "Put it on…"). Customers keeps Option B's row + sheet for Booked · Crew (per event). No "Which code ▾".
 *   2. One door piece — the cream door-sticker fold is gone; the door piece is Prints' own.
 *   3. The Prints sheet — the 5 Nov prototype (`supplier_prints_2026-11-05/index.html`) + the 6 Nov content prototype:
 *      the head (‹ back · title · Save all), YOUR FACTS, HOW IT FITS, then the pieces; Design ▾ and QR ▾ in the THUMB
 *      DOCK at the sheet's foot, never at the top.
 *
 * Counts are printed so a pass says what it measured.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { CUSTOMERS_QR_MODES, MY_QRS_SHOP_ORDER, PROMOTE_QR_MODES, printWithQrHref } from '@/lib/supplier-qr-codes';

const WEB = path.join(__dirname, '..', '..', '..', '..');
const read = (rel: string) => stripComments(fs.readFileSync(path.join(WEB, rel), 'utf8'));

const CODES = 'app/vendor-dashboard/invite/_components/qr-codes.tsx';
const LIST = 'app/vendor-dashboard/invite/_components/qr-code-list.tsx';
const PRINTS = 'app/vendor-dashboard/shop/promote/_components/shop-prints-section.tsx';
const MINE = 'app/vendor-dashboard/shop/qrs/_components/my-qrs-list.tsx';
const OPENED = 'app/vendor-dashboard/shop/qrs/_components/my-qr-code.tsx';

test('1 · the codes are ONE list in the drawing’s order — no one-code dropdown', () => {
  assert.deepEqual([...MY_QRS_SHOP_ORDER], ['page', 'reviews', 'shortlist', 'dates'], 'My QRs’ "Your shop" rows are not the drawing’s four, in order');
  assert.deepEqual([...MY_QRS_SHOP_ORDER].sort(), [...PROMOTE_QR_MODES].sort(), 'My QRs lost (or gained) a shop code');
  assert.deepEqual([...CUSTOMERS_QR_MODES], ['locked', 'crew'], 'Customers’ rows are not Booked · Crew');
  const mine = read(MINE);
  assert.match(mine, /MY_QRS_SHOP_ORDER\.map\(/, 'the My QRs rows are not built from MY_QRS_SHOP_ORDER');
  const src = read(CODES);
  const customers = [...src.matchAll(/row\('(\w+)'/g)].map((m) => m[1]);
  console.log(`My QRs rows: ${MY_QRS_SHOP_ORDER.join(' · ')} · Customers rows: ${customers.join(' · ')}`);
  assert.deepEqual(customers, ['locked', 'crew']);
  assert.match(src, /<QrCodeList rows=\{rows\} openKey=\{open\} \/>/);
  assert.doesNotMatch(src + mine, /label="Which code"|modeOptions/, 'the one-code dropdown is back');
});

test('1 · a row is name · what it does · › — Customers’ opens its sheet, My QRs’ opens the code’s page — each with the shipped QR card', () => {
  const list = read(LIST);
  for (const anchor of ['data-qr-row={r.key}', '<QrThumb', '<ChevronRight', 'r.line', "'per event'"]) {
    assert.ok(list.includes(anchor) || (anchor === "'per event'" && /per event/.test(list)), `a row lost ${anchor}`);
  }
  assert.match(list, /<Sheet[\s\S]{0,200}head=\{/, 'a code’s sheet lost its head (name · ⓘ · Done)');
  assert.match(list, /data-qr-sheet-done/);
  assert.match(read(MINE), /href=\{myQrHref\(code\)\}/, 'a My QRs row does not open its code’s page');
  const cards = (read(CODES).match(/<QrCard\b/g) ?? []).length + (read(OPENED).match(/<QrCard\b/g) ?? []).length;
  console.log(`QrCards behind the rows: ${cards} (Booked · Crew · the one opened shop code)`);
  assert.equal(cards, 3, 'every code draws the shipped QR card (Share · Copy link · Download · Write to NFC)');
});

test('1 · a shop code’s page ends in “Print it” › Door print · Prints — Customers’ sheets never do', () => {
  const opened = read(OPENED);
  assert.match(opened, /label="Print it"/);
  assert.match(opened, /title="Door print"[^>]*href=\{printWithQrHref\(d\.code, 'door'\)\}/);
  assert.match(opened, /title="Prints"[^>]*href=\{printWithQrHref\(d\.code\)\}/);
  assert.doesNotMatch(read(LIST) + read(CODES), /Put it on…|printWithQrHref/, 'Booked or Crew can be put on the shop’s prints');
  // The address hands THIS code (and the door piece) to Promote's Prints, which opens on it.
  assert.equal(printWithQrHref('reviews', 'door'), '/vendor-dashboard/shop/promote?print=reviews&piece=door#prints');
  assert.equal(printWithQrHref('page'), '/vendor-dashboard/shop/promote?print=page#prints');
  const prints = read(PRINTS);
  assert.match(prints, /useState\(initialAsk !== null\)/, 'the Prints sheet does not open on a code handed in the address');
  assert.match(prints, /useState<PrintQrMode>\(initialAsk\?\.qr \?\? DEFAULT_PRINT_QR\)/, 'the Prints sheet does not carry the handed code');
});

test('2 · one door piece — the cream door-sticker fold is gone, the door print lives in Prints', () => {
  assert.equal(fs.existsSync(path.join(WEB, 'app/vendor-dashboard/invite/_components/door-sticker.tsx')), false);
  assert.doesNotMatch(read(CODES) + read(LIST) + read('app/vendor-dashboard/shop/promote/page.tsx'), /DoorSticker|door-sticker/);
  assert.match(read(PRINTS), /initialAsk\?\.piece === 'door'/);
});

test('3 · the Prints sheet is the prototype: head (‹ · title · Save all) · YOUR FACTS · HOW IT FITS · pieces; pickers in the dock', () => {
  const src = read(PRINTS);
  assert.match(src, /<Sheet[^>]*\bhead=\{head\}[^>]*\bfoot=\{dock\}/, 'the sheet must draw the head on top and the dock at its foot');
  const head = src.slice(src.indexOf('data-prints-head'), src.indexOf('data-prints-dock'));
  assert.match(head, /data-prints-back/, 'the head lost its ‹ back');
  assert.match(head, /<SaveAllButton/, 'the head lost Save all');
  const dock = src.slice(src.indexOf('data-prints-dock'), src.indexOf('<Sheet '));
  const pickers = [...dock.matchAll(/label="(Design|QR on your prints)"/g)].map((m) => m[1]);
  console.log(`dock pickers: ${pickers.join(' · ')}`);
  assert.deepEqual(pickers, ['Design', 'QR on your prints'], 'Design ▾ and QR ▾ must sit in the thumb dock, in that order');
  const body = src.slice(src.indexOf('data-prints-sheet='));
  const order = ['label="Your facts"', 'label="How it fits"', 'data-prints-list'].map((a) => body.indexOf(a));
  console.log(`body order: facts@${order[0]} · fits@${order[1]} · pieces@${order[2]}`);
  assert.ok(order.every((i) => i > 0) && order[0]! < order[1]! && order[1]! < order[2]!, 'YOUR FACTS → HOW IT FITS → the pieces');
  for (const fact of ['Shop name', 'Line', 'Verified seal', 'Rating', 'Badges']) assert.match(body, new RegExp(`"${fact}"`), `YOUR FACTS lost ${fact}`);
  assert.equal((body.match(/label="Design"|label="QR on your prints"/g) ?? []).length, 0, 'a picker is back at the top of the sheet');
});

test('3 · Save all saves the seven print files in one zip, from the same renderer as each Save', () => {
  const route = read('app/api/vendor/prints/route.ts');
  assert.match(route, /sp\.get\('piece'\) === PRINT_ALL/);
  assert.match(route, /PRINT_PIECES\.map\(\(p, i\) => \(\{ name: printFilename\(p, design\), body: renderPrint\(/);
  assert.match(read(PRINTS), /printAllHref\(/);
});
