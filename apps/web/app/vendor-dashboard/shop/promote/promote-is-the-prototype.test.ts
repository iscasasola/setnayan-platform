/**
 * 📐 SHOP › PROMOTE IS THE APPROVED PROTOTYPES (owner 2026-11-06: *"why do you build but not create the actual look of
 * the prototypes … what is the use of our prototype?"*).
 *
 * Pins the SHAPE the two approved designs fixed, so the build cannot drift back to the shapes they replaced:
 *
 *   1. QR codes — Option B (`qr-list-proto`, owner "B"): ONE LIST, a row per code, in the prototype's order —
 *      Promote: Check a date · Shortlist · My page · Reviews; Customers: Booked · Crew (per event). No "Which code ▾".
 *      A row is name · what a scan does · small QR · ›, and opens its sheet; Promote's sheets end in "Put it on…" ›
 *      Door print · Prints.
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
import { CUSTOMERS_QR_MODES, PROMOTE_QR_MODES } from '@/lib/supplier-qr-codes';

const WEB = path.join(__dirname, '..', '..', '..', '..');
const read = (rel: string) => stripComments(fs.readFileSync(path.join(WEB, rel), 'utf8'));

const CODES = 'app/vendor-dashboard/invite/_components/qr-codes.tsx';
const LIST = 'app/vendor-dashboard/invite/_components/qr-code-list.tsx';
const PRINTS = 'app/vendor-dashboard/shop/promote/_components/shop-prints-section.tsx';

test('1 · the codes are ONE list in the prototype’s order — no one-code dropdown', () => {
  assert.deepEqual([...PROMOTE_QR_MODES], ['dates', 'shortlist', 'page', 'reviews'], 'Promote’s rows are not the prototype’s four, in order');
  assert.deepEqual([...CUSTOMERS_QR_MODES], ['locked', 'crew'], 'Customers’ rows are not Booked · Crew');
  const src = read(CODES);
  const promote = src.slice(src.indexOf("place === 'promote'\n      ? ["), src.indexOf(': [\n          row(\'locked\''));
  const order = [...promote.matchAll(/row\(\s*'(\w+)'/g)].map((m) => m[1]);
  const customers = [...src.slice(src.indexOf(": [\n          row('locked'")).matchAll(/row\('(\w+)'/g)].map((m) => m[1]).slice(0, 2);
  console.log(`Promote rows: ${order.join(' · ')} · Customers rows: ${customers.join(' · ')}`);
  assert.deepEqual(order, ['dates', 'shortlist', 'page', 'reviews']);
  assert.deepEqual(customers, ['locked', 'crew']);
  assert.match(src, /<QrCodeList rows=\{rows\} openKey=\{open\} \/>/);
  assert.doesNotMatch(src, /label="Which code"|modeOptions/, 'the one-code dropdown is back');
});

test('1 · a row is name · what a scan does · small QR · › — and opens its sheet with the shipped QR card inside', () => {
  const list = read(LIST);
  for (const anchor of ['data-qr-row={r.key}', '<QrThumb', '<ChevronRight', 'r.line', "'per event'"]) {
    assert.ok(list.includes(anchor) || (anchor === "'per event'" && /per event/.test(list)), `a row lost ${anchor}`);
  }
  assert.match(list, /<Sheet[\s\S]{0,200}head=\{/, 'a code’s sheet lost its head (name · ⓘ · Done)');
  assert.match(list, /data-qr-sheet-done/);
  const cards = (read(CODES).match(/<QrCard\b/g) ?? []).length;
  console.log(`QrCards behind the rows: ${cards}`);
  assert.equal(cards, 6, 'every code’s sheet draws the shipped QR card (Share · Copy link · Download · Write to NFC)');
});

test('1 · Promote’s sheets end in “Put it on…” › Door print · Prints — Customers’ never do', () => {
  const list = read(LIST);
  const src = read(CODES);
  assert.match(list, /Put it on…/);
  assert.match(list, /title="Door print"/);
  assert.match(list, /title="Prints"/);
  assert.match(src, /putOn: place === 'promote' &&/, '“Put it on…” must be Promote’s only');
  // The hand-off waits for this sheet's own Back entry to go (useBackCloses steps back a tick after the close) — opening
  // the Prints sheet first let that late step back shut it at once (caught in this PR's own 390 px walk).
  const hand = list.slice(list.indexOf('const handOff'), list.indexOf('const handOff') + 900);
  assert.match(hand, /addEventListener\('popstate', go\)/, 'the hand-off no longer waits for the QR sheet’s Back');
  assert.ok(hand.indexOf("addEventListener('popstate'") < hand.indexOf('setOpen(null)'), 'listen before closing');
});

test('2 · one door piece — the cream door-sticker fold is gone, the door print lives in Prints', () => {
  assert.equal(fs.existsSync(path.join(WEB, 'app/vendor-dashboard/invite/_components/door-sticker.tsx')), false);
  assert.doesNotMatch(read(CODES) + read(LIST) + read('app/vendor-dashboard/shop/promote/page.tsx'), /DoorSticker|door-sticker/);
  assert.match(read(PRINTS), /ask\.piece === 'door'/);
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
