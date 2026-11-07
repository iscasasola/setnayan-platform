/**
 * 🔳 THE QR DROPDOWN IS EXTENDED, NOT REDRAWN (owner 2026-10-29, DECISION_LOG "🔳 CORRECTS THE QR ROW ABOVE — THE QR
 * DROPDOWN ALREADY EXISTS; EXTEND IT, DON'T REDRAW IT"): the live "Which code ▾" keeps Shortlist · Booked and gains
 * Check a date · My page · Crew for an event — one code under it, never a stack.
 *
 * Behaviour (the pure choices) + source (the page wires every choice, the My page code scans back to `/v/<slug>`, the
 * crew code is only SHOWN here — no crew write on this page — and every refused crew read is said).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { renderUrlQrSvg } from './qr';
import { stripComments } from './strip-comments';
import {
  CUSTOMERS_QR_MODES,
  PROMOTE_HREF,
  PROMOTE_QR_MODES,
  SUPPLIER_QR_MODES,
  SUPPLIER_QR_MODE_LABEL,
  crewQrEvents,
  isPromoteQrMode,
  myPageUrl,
  pickCrewQrEvent,
  promoteQrModeOf,
  supplierQrHref,
  supplierQrModeOf,
} from './supplier-qr-codes';
import { SHOP_SEGMENT_HREF } from '../app/vendor-dashboard/shop/_components/shop-sections';

const ROOT = path.resolve(__dirname, '..');
const PAGE = stripComments(fs.readFileSync(path.join(ROOT, 'app/vendor-dashboard/invite/page.tsx'), 'utf8'));
// 📣 Shop › Promote (owner 2026-11-05): the marketing codes' home.
const PROMOTE = stripComments(fs.readFileSync(path.join(ROOT, 'app/vendor-dashboard/shop/promote/page.tsx'), 'utf8'));
const VIEW = stripComments(fs.readFileSync(path.join(ROOT, 'app/vendor-dashboard/invite/_components/qr-codes.tsx'), 'utf8'));

// Retargeted 2026-11-06 (QR codes Option B, owner "B"): the dropdown became ONE LIST, a row per code, and Reviews joined
// it (the prototype's fourth Promote row) — the six codes, the two live ones still first.
test('the one list holds the six codes, the two live ones first', () => {
  assert.deepEqual([...SUPPLIER_QR_MODES], ['shortlist', 'locked', 'dates', 'page', 'crew', 'reviews']);
  assert.equal(SUPPLIER_QR_MODE_LABEL.page, 'My page');
  assert.equal(SUPPLIER_QR_MODE_LABEL.reviews, 'Reviews');
  assert.equal(SUPPLIER_QR_MODE_LABEL.crew, 'Crew for an event');
  for (const m of SUPPLIER_QR_MODES) assert.equal(supplierQrModeOf(m), m);
  assert.equal(supplierQrModeOf('nope'), 'shortlist', 'an unknown ?mode= is the Shortlist code, as before');
  assert.equal(supplierQrModeOf(undefined), 'shortlist');
});

test('📣 every code has ONE home: Shop › Promote markets the shop, Customers › QR codes holds Booked and Crew', () => {
  // The two homes split the one list exactly — no code in both, none in neither.
  assert.deepEqual([...PROMOTE_QR_MODES, ...CUSTOMERS_QR_MODES].sort(), [...SUPPLIER_QR_MODES].sort());
  // Option B's Promote rows, in the prototype's order: Check a date · Shortlist · My page · Reviews.
  assert.deepEqual([...PROMOTE_QR_MODES], ['dates', 'shortlist', 'page', 'reviews']);
  assert.deepEqual([...CUSTOMERS_QR_MODES], ['locked', 'crew']);
  for (const m of SUPPLIER_QR_MODES) assert.equal(isPromoteQrMode(m), (PROMOTE_QR_MODES as readonly string[]).includes(m));
  // Promote is Shop's own section, and every link to a code is built for its home.
  assert.equal(PROMOTE_HREF, SHOP_SEGMENT_HREF.promote);
  assert.equal(supplierQrHref('shortlist'), '/vendor-dashboard/shop/promote?mode=shortlist');
  assert.equal(supplierQrHref('page'), '/vendor-dashboard/shop/promote?mode=page');
  assert.equal(supplierQrHref('reviews'), '/vendor-dashboard/shop/promote?mode=reviews');
  assert.equal(supplierQrHref('locked'), '/vendor-dashboard/invite?mode=locked');
  assert.equal(supplierQrHref('crew'), '/vendor-dashboard/invite?mode=crew');
  assert.equal(promoteQrModeOf('locked'), 'shortlist', 'Promote must not draw the Booked code');
  assert.equal(promoteQrModeOf('dates'), 'dates');
});

test('📣 Customers › QR codes forwards a moved code to Shop › Promote — never draws it, never an "Edit in X" link', () => {
  // The forward runs before any read, keeps a Shortlist link's picks, and covers a bare /invite (always the Shortlist).
  const fwd = PAGE.indexOf('if (isPromoteQrMode(asked))');
  assert.ok(fwd > 0, 'the old home no longer forwards the moved codes');
  assert.ok(fwd < PAGE.indexOf('createClient()'), 'the forward must run before the page reads anything');
  assert.match(PAGE.slice(fwd, fwd + 400), /q\.set\('et'[\s\S]*q\.set\('cat'[\s\S]*redirect\(`\$\{PROMOTE_HREF\}\?/);
  assert.doesNotMatch(PAGE, /checkADateQr\(|myPage=\{|buildVendorInviteUrl\(|mode === 'shortlist'|mode === 'dates'|mode === 'page'/, 'Customers still draws a moved code');
  assert.doesNotMatch(PROMOTE, /mode === 'locked'|mode === 'crew'|LockedQrGenerator|readCrewQr/, 'Promote draws a code that stays with Customers');
  assert.doesNotMatch(PAGE + PROMOTE + VIEW, /Edit in |↗/, 'a go-edit-elsewhere link');
  assert.match(PROMOTE, /<QrCodes[\s\S]{0,40}place: 'promote'|place: 'promote' as const/, 'Promote does not draw the shared view as its section');
});

// Retargeted 2026-11-06 (Option B): each home builds its ROWS from its slice — Promote draws all four codes on one visit
// (every row shows its own small code), Customers draws Booked or Crew per visit and links the other row.
test('each home builds its rows from its slice of the one list and draws each code', () => {
  assert.match(PAGE, /CUSTOMERS_QR_MODES\.map\(/, 'the Customers rows are not built from CUSTOMERS_QR_MODES');
  assert.match(PROMOTE, /PROMOTE_QR_MODES as readonly string\[\]\)\.includes\(/, 'Promote opens a sheet for a code outside PROMOTE_QR_MODES');
  for (const prop of ['checkADate=', 'shortlist=', 'myPage=', 'reviews=']) assert.ok(PROMOTE.includes(prop), `Promote does not draw ${prop.slice(0, -1)}`);
  assert.match(PAGE, /mode === 'crew'[\s\S]{0,600}crew=\{await readCrewQr\(/, 'Crew for an event is not drawn');
  assert.match(VIEW, /row\(\s*'page',\s*myPage\?\.svg \?\? null,\s*myPage \?/);
  assert.match(VIEW, /row\('crew',[^\n]*crew \? <CrewCode crew=\{crew\} \/> : null\)/);
  // One code per sheet: each choice draws exactly one QrCard.
  assert.equal((VIEW.match(/data="my-page"/g) ?? []).length, 1);
  assert.equal((VIEW.match(/data="crew"/g) ?? []).length, 1);
});

test('the My page code scans back to https://<site>/v/<slug> exactly', async () => {
  for (const [origin, slug] of [
    ['https://www.setnayan.com', 'tita-nenas-catering'],
    ['https://setnayan.com/', 'setnaprod'],
  ] as const) {
    const url = myPageUrl(origin, slug);
    assert.equal(url, `${origin.replace(/\/+$/, '')}/v/${slug}`);
    const svg = await renderUrlQrSvg(url, 220);
    const { data, info } = await sharp(Buffer.from(svg)).resize(400, 400).flatten({ background: '#ffffff' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const hit = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info.width, info.height);
    assert.equal(hit?.data, url);
  }
});

test('a crew code is offered for each event today or ahead — once per event, nearest first', () => {
  const words = (iso: string) => `D${iso.slice(8)}`;
  const list = crewQrEvents(
    [
      { eventId: 'b', eventName: 'Ana & Leo', bookedDate: '2026-12-20' },
      { eventId: 'past', eventName: 'Old', bookedDate: '2026-10-01' },
      { eventId: 'a', eventName: 'Mia', bookedDate: '2026-11-01' },
      { eventId: 'b', eventName: 'Ana & Leo', bookedDate: '2026-12-19' },
    ],
    '2026-11-01',
    words,
  );
  assert.deepEqual(list, [
    { eventId: 'a', label: 'Mia · Today' },
    { eventId: 'b', label: 'Ana & Leo · D19' },
  ]);
  assert.equal(pickCrewQrEvent(list, 'b')?.eventId, 'b');
  assert.equal(pickCrewQrEvent(list, 'past')?.eventId, 'a', 'an event not offered falls to the nearest');
  assert.equal(pickCrewQrEvent([], null), null);
});

test('the crew code is only SHOWN here: made, replaced and allowed in Hub › Crew', () => {
  assert.doesNotMatch(PAGE + VIEW, /changeCrew|crew-writes|\.insert\(|\.update\(|\.delete\(/, 'the QR page must not write the crew');
  assert.match(PAGE, /hubHref\(picked\.eventId, 'crew'\)/, 'the crew row does not lead to Hub › Crew');
});

test('every refused crew read is said — never "no code yet"', () => {
  assert.match(PAGE, /if \(days === null\) return \{ eventPick: null/, 'a refused events read must not read as no events');
  assert.match(PAGE, /if \(codeRes\.error\) \{[\s\S]{0,200}state: 'unread'/, 'a refused code read must not read as no code');
  assert.match(PAGE, /canManageVendor\(/, 'a non-admin (RLS reads nothing) must not be told there is no code');
  assert.match(VIEW, /crew\.eventPick === null[\s\S]{0,300}role="alert"/);
  assert.match(VIEW, /code\?\.state === 'unread'[\s\S]{0,200}role="alert"/);
  assert.match(VIEW, /code\.waiting === null\s*\?\s*'Couldn’t count/);
});

// 📣 Your QR codes (owner 2026-11-06, DECISION_LOG "ONE HOME FOR EVERY PROMOTE TOOL"): Which code ▾ · Share · Copy link ·
// Save · Write to NFC. Copy link is a button in the card's own row, beside Share — and the strip under the card no longer
// carries a second one.
test('📣 the QR card reads Share · Copy link · Download, and the strip under it carries no second Copy link', () => {
  const CARD = stripComments(fs.readFileSync(path.join(ROOT, 'app/_components/qr-card.tsx'), 'utf8'));
  const share = CARD.indexOf('data-qr-share=""');
  const copy = CARD.indexOf('data-qr-copy=""');
  const save = CARD.indexOf('data-qr-download=""');
  const strip = CARD.indexOf('<QrActions');
  assert.ok(share > 0 && copy > share && save > copy && strip > save, `order was share ${share} · copy ${copy} · save ${save} · strip ${strip}`);
  assert.equal(CARD.split('data-qr-copy=""').length - 1, 1, 'exactly one Copy link button');
  assert.match(CARD, /onClick=\{copy\}[^>]*data-qr-copy=""/, 'the Copy link button does not run the copy');
  assert.match(CARD, /const copy = async \(\) => \{[\s\S]{0,120}navigator\.clipboard\.writeText\(url\)/, 'Copy link copies the code’s own address');
  assert.match(CARD, /'Copy link'/);
  assert.match(CARD, /<QrActions url=\{url\} hideCopy\b/, 'the strip still draws its own Copy link — two on one card');
  // Every Promote code is a QrCard, so each gets it: Shortlist · Check a date · My page.
  for (const d of ['shortlist', 'check-a-date', 'my-page']) assert.match(VIEW, new RegExp(`data="${d}"`), `${d} is not a QR card`);
});
