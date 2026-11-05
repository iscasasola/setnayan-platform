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

test('the one dropdown holds the five codes, the two live ones first', () => {
  assert.deepEqual([...SUPPLIER_QR_MODES], ['shortlist', 'locked', 'dates', 'page', 'crew']);
  assert.equal(SUPPLIER_QR_MODE_LABEL.page, 'My page');
  assert.equal(SUPPLIER_QR_MODE_LABEL.crew, 'Crew for an event');
  for (const m of SUPPLIER_QR_MODES) assert.equal(supplierQrModeOf(m), m);
  assert.equal(supplierQrModeOf('nope'), 'shortlist', 'an unknown ?mode= is the Shortlist code, as before');
  assert.equal(supplierQrModeOf(undefined), 'shortlist');
});

test('📣 every code has ONE home: Shop › Promote markets the shop, Customers › QR codes holds Booked and Crew', () => {
  // The two homes split the one list exactly — no code in both, none in neither.
  assert.deepEqual([...PROMOTE_QR_MODES, ...CUSTOMERS_QR_MODES].sort(), [...SUPPLIER_QR_MODES].sort());
  assert.deepEqual([...PROMOTE_QR_MODES], ['shortlist', 'dates', 'page']);
  assert.deepEqual([...CUSTOMERS_QR_MODES], ['locked', 'crew']);
  for (const m of SUPPLIER_QR_MODES) assert.equal(isPromoteQrMode(m), (PROMOTE_QR_MODES as readonly string[]).includes(m));
  // Promote is Shop's own section, and every link to a code is built for its home.
  assert.equal(PROMOTE_HREF, SHOP_SEGMENT_HREF.promote);
  assert.equal(supplierQrHref('shortlist'), '/vendor-dashboard/shop/promote?mode=shortlist');
  assert.equal(supplierQrHref('page'), '/vendor-dashboard/shop/promote?mode=page');
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

test('each home builds its dropdown from its slice of the one list and draws each code', () => {
  assert.match(PAGE, /CUSTOMERS_QR_MODES\.map\(/, 'the Customers dropdown is not built from CUSTOMERS_QR_MODES');
  assert.match(PROMOTE, /PROMOTE_QR_MODES\.map\(/, 'the Promote dropdown is not built from PROMOTE_QR_MODES');
  assert.match(PROMOTE, /mode === 'page'[\s\S]{0,600}myPage=\{/, 'My page is not drawn');
  assert.match(PAGE, /mode === 'crew'[\s\S]{0,600}crew=\{await readCrewQr\(/, 'Crew for an event is not drawn');
  assert.match(VIEW, /mode === 'page' && myPage \?/);
  assert.match(VIEW, /mode === 'crew' && crew \?/);
  // One code under the dropdown: each new choice draws exactly one QrCard.
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
