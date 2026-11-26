/**
 * 🔳 MY QRs REPLACES THE QR PAGE AND KEEPS EVERYTHING IT HAD (owner 23 Nov 2026, verbatim: *"this also means we have to
 * get cloud create a QR Page that will replace our current QR page."* · *"on their QR, they can also have their link
 * there to download QR templates for their business."*; DECISION_LOG "STORE DRAWING v13→v18 RULINGS" (1): it *"must keep
 * Shortlist's two picks, the own-link gift and the NFC test"*; drawing `supplier_store_graphs_badges_2026-11-23`, frames
 * "My QRs" and "One QR, opened").
 *
 *   1 · Every shipped shop code is on the list, in the drawing's order, each opening its own real page.
 *   2 · The opened code keeps every feature: the big code (QrCard: Download · Share · Copy link · Write to NFC), Print it,
 *       Shortlist's two picks, the own-link gift and the NFC Tap test.
 *   3 · "QR designs" has a real door (Promote's Prints, until the Toolkit's shelf ships) — never a dead link — and no empty
 *       "From your widgets" group is drawn.
 *   4 · Every old way in opens My QRs: the cover's QR sheet (and Promote's tab), the Promote page, `?mode=` links,
 *       Customers › QR codes' forward, Today's "Open QR".
 *   5 · A refused read is said with Try again — never an empty list.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  MY_QRS_HREF,
  MY_QRS_SHOP_ORDER,
  MY_QR_WORDS,
  PROMOTE_HREF,
  PROMOTE_QR_MODES,
  myQrHref,
  printWithQrHref,
  supplierQrHref,
} from '@/lib/supplier-qr-codes';
import { PAGE_QR_HREF, REVIEW_QR_HREF } from '@/lib/supplier-today-v2';

const WEB = path.join(__dirname, '..', '..', '..', '..');
const read = (rel: string) => stripComments(fs.readFileSync(path.join(WEB, rel), 'utf8'));
const LIST = read('app/vendor-dashboard/shop/qrs/_components/my-qrs-list.tsx');
const OPENED = read('app/vendor-dashboard/shop/qrs/_components/my-qr-code.tsx');
const DATA = read('app/vendor-dashboard/shop/qrs/_components/my-qrs-data.ts');
const PAGE = read('app/vendor-dashboard/shop/qrs/page.tsx');
const CODE_PAGE = read('app/vendor-dashboard/shop/qrs/[code]/page.tsx');

/** The app route file an internal href lands on (static segments, then a `[param]` folder). */
function routeFileOf(href: string): string | null {
  const segs = (href.split(/[?#]/)[0] ?? '').split('/').filter(Boolean);
  let dir = path.join(WEB, 'app');
  for (const seg of segs) {
    if (fs.existsSync(path.join(dir, seg))) dir = path.join(dir, seg);
    else {
      const param = fs.readdirSync(dir).find((d) => /^\[[^.\]]+\]$/.test(d));
      if (!param) return null;
      dir = path.join(dir, param);
    }
  }
  const file = path.join(dir, 'page.tsx');
  return fs.existsSync(file) ? path.relative(WEB, file) : null;
}

test('1 · every shipped shop code is on My QRs, in the drawing’s order, each opening its own real page', () => {
  assert.deepEqual([...MY_QRS_SHOP_ORDER], ['page', 'reviews', 'shortlist', 'dates']);
  assert.deepEqual([...MY_QRS_SHOP_ORDER].sort(), [...PROMOTE_QR_MODES].sort(), 'a shipped code is missing from My QRs');
  assert.deepEqual(MY_QRS_SHOP_ORDER.map((m) => MY_QR_WORDS[m].name), ['Your page', 'Reviews', 'Shortlist', 'Check a date']);
  assert.match(LIST, /label="Your shop"/);
  assert.match(LIST, /MY_QRS_SHOP_ORDER\.map\(\(code\) =>[\s\S]{0,700}href=\{myQrHref\(code\)\}/);
  const report = MY_QRS_SHOP_ORDER.map((m) => `${m} → ${routeFileOf(myQrHref(m)) ?? 'NO PAGE'}`);
  console.log(report.join(' · '));
  for (const m of MY_QRS_SHOP_ORDER) assert.equal(routeFileOf(myQrHref(m)), 'app/vendor-dashboard/shop/qrs/[code]/page.tsx', `${m} opens no page`);
  assert.equal(routeFileOf(MY_QRS_HREF), 'app/vendor-dashboard/shop/qrs/page.tsx');
});

test('2 · the opened code keeps every feature: QrCard · Print it · Shortlist’s two picks · the own-link gift · the NFC test', () => {
  // The big code with Download (filled, the drawing's) · Share · Copy link · Write to NFC — the shipped QrCard.
  assert.match(OPENED, /<QrCard[\s\S]{0,400}primary="download"/);
  assert.match(OPENED, /url=\{d\.url\}/);
  // Shortlist's two picks — For and Service — each a real address that keeps the other pick.
  assert.match(OPENED, /d\.shortlist \?[\s\S]{0,200}title="For"[\s\S]{0,400}dataAttr="data-qr-event"[\s\S]{0,300}title="Service"[\s\S]{0,400}dataAttr="data-qr-service"/);
  assert.match(DATA, /href: myQrHref\('shortlist', \{ et: t\.key, cat \}\)/, 'the For pick drops the Service pick');
  assert.match(DATA, /href: myQrHref\('shortlist', \{ et, cat: c \}\)/, 'the Service pick drops the For pick');
  // The own-link gift — read only for Your page, drawn there.
  assert.match(DATA, /code === 'page' \? loadShopGiftsSection\(/);
  assert.match(OPENED, /d\.ownGift \? <OwnLinkGift verified=\{d\.ownGift\.verified\} data=\{d\.ownGift\.data\} current=\{d\.ownGift\.current\} \/> : null/);
  // The NFC Tap test — on Your page, on its own link.
  assert.match(OPENED, /d\.code === 'page' \?[\s\S]{0,400}<NfcTapTest url=\{d\.url\} \/>/);
  // Print it — Door print · Prints, each a real address onto Promote's Prints with THIS code.
  assert.match(OPENED, /href=\{printWithQrHref\(d\.code, 'door'\)\}/);
  assert.match(OPENED, /href=\{printWithQrHref\(d\.code\)\}/);
  for (const m of PROMOTE_QR_MODES) assert.equal(routeFileOf(printWithQrHref(m, 'door')), 'app/vendor-dashboard/shop/promote/page.tsx');
  const body = read('app/vendor-dashboard/shop/promote/_components/promote-body.tsx');
  assert.match(body, /initialAsk=\{printAsk\}/, 'Promote’s Prints does not read the code handed to it');
});

test('3 · "QR designs" has a real door, and no empty "From your widgets" group is drawn', () => {
  assert.match(LIST, /label="QR designs"[\s\S]{0,400}href=\{printWithQrHref\(null\)\}/);
  assert.equal(printWithQrHref(null), `${PROMOTE_HREF}#prints`);
  assert.equal(routeFileOf(printWithQrHref(null)), 'app/vendor-dashboard/shop/promote/page.tsx', 'the QR designs door is dead');
  assert.match(read('app/vendor-dashboard/shop/promote/_components/shop-prints-section.tsx'), /id="prints"/, 'the #prints anchor is gone');
  assert.doesNotMatch(LIST + PAGE, /From your widgets/, 'an empty "From your widgets" group is drawn — Save to My QRs is not built');
});

test('4 · every old way in opens My QRs', () => {
  // The cover's QR sheet (Promote's "My QRs" tab where the tabs ship) is the one body, which IS the My QRs list.
  const cover = read('app/vendor-dashboard/shop/_components/shop-cover.tsx');
  assert.doesNotMatch(cover, /QR · scan or tap|label: 'QR codes'/, 'the QR entry no longer reads "My QRs"');
  if (/data="promote-tabs"/.test(cover)) assert.match(cover, /\{ key: 'qr', label: 'My QRs' \}/, 'Promote’s second tab must read "My QRs"');
  else assert.match(cover, /title="My QRs" body=\{qrBody\}/);
  assert.match(read('app/vendor-dashboard/shop/page.tsx'), /<PromoteBody search=\{qrSearch\} part="qr" \/>/);
  const body = read('app/vendor-dashboard/shop/promote/_components/promote-body.tsx');
  assert.match(body, /const withQr = part === 'all' \|\| part === 'qr';/);
  // Toolkit v19 (#8231): the list also takes the Toolkit's removed QR designs (`hide`), read beside the rest.
  // "Name your shop first" lands on the name (final check A5-G4-06), no longer back on the Shop tab.
  assert.match(body, /withQr \? <MyQrsList canShare=\{canShare\} setupHref=\{SHOP_NAME_SETUP_HREF\} embedded( hide=\{hide\})? \/>/);
  assert.match(LIST, /href=\{MY_QRS_HREF\}/, 'the embedded list has no door to the My QRs page');
  // Links that named a code.
  assert.match(read('app/vendor-dashboard/shop/promote/page.tsx'), /if \(asked\) redirect\(myQrHref\(asked, search\)\);/);
  assert.match(read('app/vendor-dashboard/invite/page.tsx'), /redirect\(myQrHref\(asked, \{ et: search\.et, cat: search\.cat \}\)\)/);
  assert.equal(PAGE_QR_HREF, myQrHref('page'));
  assert.equal(REVIEW_QR_HREF, myQrHref('reviews'));
  for (const m of PROMOTE_QR_MODES) assert.equal(supplierQrHref(m), myQrHref(m));
});

test('5 · a refused read is said with Try again — never an empty list', () => {
  for (const [name, src] of [['My QRs', PAGE], ['One QR, opened', CODE_PAGE]] as const) {
    assert.match(src, /fetchOwnVendorProfile\(supabase, user\.id\)\.catch\(\(\) => 'unread' as const\)/, `${name}: a refused shop read throws`);
    assert.match(src, /<ToolFail\b[\s\S]{0,200}retryHref=/, `${name}: a refused read is not said with Try again`);
  }
  assert.match(CODE_PAGE, /\.catch\(\(\) => 'unread' as const\)/);
  assert.match(CODE_PAGE, /d === 'unread' \?[\s\S]{0,80}<ToolFail/, 'a refused code read draws a code page anyway');
  // A refused gift or verified read is never "no gift" / "not verified".
  assert.match(DATA, /addGiftNotice: verified === true && ownLink === null,/);
});
