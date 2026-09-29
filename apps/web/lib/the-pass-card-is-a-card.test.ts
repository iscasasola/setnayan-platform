/**
 * THE PASS CARD A GUEST SAVES — owner 2026-09-29: *"make sure the file they
 * save the QR Card with the information of the guest … this should be a 4:3
 * portrait digital image. which can also be added on the prints"* · *"only
 * accepted accounts get their images"* · *"no pass for those who cannot
 * come"* · *"can we also create a zip file to download all? (PRO feature)"* ·
 * *"downloading them individually is free"* · *"print outs are PDF. digital
 * versions are png"*.
 *
 * Every claim below is EXECUTED where it can be (the rule, the gate, the file
 * names, a real render decoded back to its URL) and read from source only
 * where the thing is wiring (which gate runs before which render).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { stripComments } from './strip-comments';
import {
  PASS_CARD_AWAITING_LINE,
  PASS_CARD_CANNOT_COME_LINE,
  PASS_CARD_DESIGNS,
  PASS_CARD_PX,
  PASS_CARD_REFUSED,
  PASS_CARD_WORDS,
  decidePassCardAccess,
  filterPassCardRows,
  passCardEligibility,
  passCardFileName,
  passCardLine,
  passCardsZipFileName,
  seatLabelsFrom,
  uniqueFileNames,
  type PassCardRow,
} from './pass-card';
import { layoutPassCard, layoutPieceDocs, passCardFacts, safeContainsBox, type PrintOp, type PrintPass, type PrintSetData } from './print-layout';
import { INVITE_THEME_IDS } from './invite-themes';
import { PRINT_FORMATS, printLookFor } from './print-pieces';
import { renderPassCardPng } from './pass-card-render';
import { renderInvitationQrPng } from './qr';
import { decodeQrPayloadFromImage } from './qr-decode';
import { FREE_QR_LOOK } from './qr-look';
import { buildChecklist } from './guest-checklist';

const WEB = join(__dirname, '..');
const src = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

// ─── Who gets a card ────────────────────────────────────────────────────────

const row = (over: Partial<PassCardRow> = {}): PassCardRow => ({
  guest_id: 'g-1',
  event_id: 'e-1',
  deleted_at: null,
  entry_source: 'host_seeded',
  passed_away: false,
  rsvp_status: 'pending',
  plus_one_of_guest_id: null,
  qr_token: 'tok',
  ...over,
});

test('ACCEPTED gets a card; PENDING (a request not yet kept or linked) does not', () => {
  assert.equal(passCardEligibility(row()), 'pass', 'on the list, not replied yet → still a card');
  assert.equal(passCardEligibility(row({ rsvp_status: 'attending' })), 'pass');
  assert.equal(passCardEligibility(row({ entry_source: 'self_added_unlisted' })), 'awaiting');
  assert.equal(passCardLine('awaiting'), PASS_CARD_AWAITING_LINE);
});

test('DECLINED or REMOVED by the couple (the row is soft-deleted) gets none', () => {
  assert.equal(passCardEligibility(row({ deleted_at: '2026-09-29T00:00:00Z' })), 'none');
  assert.equal(passCardEligibility(row({ passed_away: true })), 'none');
  assert.equal(passCardEligibility(row({ qr_token: null })), 'none');
  assert.equal(passCardEligibility(null), 'none');
});

test("CAN'T COME gets none — and changing the reply to coming brings it back, nothing stored", () => {
  const declined = row({ rsvp_status: 'declined' });
  assert.equal(passCardEligibility(declined), 'cannotCome');
  assert.equal(passCardLine('cannotCome'), PASS_CARD_CANNOT_COME_LINE);
  assert.equal(passCardEligibility({ ...declined, rsvp_status: 'attending' }), 'pass', 'flip to attending → the card is back');
  assert.equal(passCardEligibility(row({ rsvp_status: 'maybe' })), 'pass');
});

test('a plus-one follows their own reply, else the bringer’s; an accepted bringer’s plus-ones are accepted', () => {
  const bringer = row({ guest_id: 'b-1', rsvp_status: 'attending' });
  const p1 = row({ guest_id: 'p-1', plus_one_of_guest_id: 'b-1', rsvp_status: 'pending' });
  assert.equal(passCardEligibility(p1, bringer), 'pass', 'minted by an accepted bringer');
  assert.equal(passCardEligibility(p1, { ...bringer, entry_source: 'self_added_unlisted' }), 'awaiting', 'a pending bringer’s plus-one waits too');
  assert.equal(passCardEligibility(p1, { ...bringer, rsvp_status: 'declined' }), 'cannotCome', 'no own reply → the bringer’s "can’t come"');
  assert.equal(passCardEligibility({ ...p1, rsvp_status: 'attending' }, { ...bringer, rsvp_status: 'declined' }), 'pass', 'their own "coming" stands');
  assert.equal(passCardEligibility({ ...p1, rsvp_status: 'declined' }, bringer), 'cannotCome', 'their own "can’t come" stands');
  assert.equal(passCardEligibility(p1, null), 'none', 'no bringer read → no card, never a guess');
  assert.equal(passCardEligibility(p1, { ...bringer, deleted_at: 'x' }), 'none');
  assert.equal(passCardEligibility({ ...p1, tba: true }, bringer), 'none', 'a "+ TBA" seat has nobody to put on a card');
});

// ─── Who may fetch one ──────────────────────────────────────────────────────

test('the card route: that guest, the guest who brought them, or a host — and only for a card that exists', () => {
  const me = row({ guest_id: 'g-1', rsvp_status: 'attending' });
  const session = { guest_id: 'g-1', event_id: 'e-1' };
  const allow = (v: ReturnType<typeof decidePassCardAccess>) => v.allow;
  assert.deepEqual(decidePassCardAccess({ session, isHost: false, target: me, bringer: null, readFailed: false }), { allow: true, as: 'guest' });
  const mine = row({ guest_id: 'p-1', plus_one_of_guest_id: 'g-1' });
  assert.deepEqual(decidePassCardAccess({ session, isHost: false, target: mine, bringer: me, readFailed: false }), { allow: true, as: 'guest' });
  assert.deepEqual(decidePassCardAccess({ session: null, isHost: true, target: me, bringer: null, readFailed: false }), { allow: true, as: 'host' });
  const nobody = decidePassCardAccess({ session: null, isHost: false, target: me, bringer: null, readFailed: false });
  assert.equal(!allow(nobody) && nobody.status, 401);
  assert.equal(allow(decidePassCardAccess({ session, isHost: false, target: me, bringer: null, readFailed: true })), false);
});

test('every refusal after sign-in is the SAME 404 and the same words — no name, no reply, no existence leaks', () => {
  const session = { guest_id: 'g-1', event_id: 'e-1' };
  const cases = [
    { target: row({ guest_id: 'g-2' }), bringer: null, isHost: false, why: 'someone else’s card' },
    { target: row({ guest_id: 'g-9', event_id: 'e-2' }), bringer: null, isHost: false, why: 'another event' },
    { target: row({ entry_source: 'self_added_unlisted' }), bringer: null, isHost: false, why: 'my own, pending' },
    { target: row({ rsvp_status: 'declined' }), bringer: null, isHost: false, why: 'my own, can’t come' },
    { target: row({ guest_id: 'g-3', entry_source: 'self_added_unlisted' }), bringer: null, isHost: true, why: 'a host asking for a pending guest' },
    { target: row({ guest_id: 'g-3', rsvp_status: 'declined' }), bringer: null, isHost: true, why: 'a host asking for a declined guest' },
    { target: null, bringer: null, isHost: false, why: 'no such guest' },
  ];
  for (const c of cases) {
    const v = decidePassCardAccess({ session, isHost: c.isHost, target: c.target, bringer: c.bringer, readFailed: false });
    assert.deepEqual(v, { allow: false, status: 404, message: PASS_CARD_REFUSED }, c.why);
  }
});

// ─── What the file is called ────────────────────────────────────────────────

test('the file is named for the PERSON, then the couple and the day — safe characters only', () => {
  assert.equal(
    passCardFileName({ guestName: 'Maria Santos', eventName: 'Indalecio & Claire', eventDate: '2026-12-18' }),
    'Maria-Santos-ticket-Indalecio-Claire-2026-12-18.png',
  );
  assert.equal(
    passCardFileName({ guestName: 'Lola Nena Peñafiel', eventName: 'José and Ñiña', eventDate: '2026-12-18' }),
    'Lola-Nena-Penafiel-ticket-Jose-Nina-2026-12-18.png',
    'accents folded',
  );
  const evil = passCardFileName({ guestName: 'A"\r\nSet-Cookie: x=1', eventName: '../../etc', eventDate: 'not a date' });
  assert.match(evil, /^[A-Za-z0-9-]+\.png$/, 'nothing that can end a header or a path survives');
  assert.equal(passCardsZipFileName('Indalecio & Claire', '2026-12-18'), 'Indalecio-Claire-2026-12-18-tickets.zip');
  assert.deepEqual(uniqueFileNames(['A-pass.png', 'B-pass.png', 'a-pass.png']), ['A-pass.png', 'B-pass.png', 'a-pass-2.png'], 'two guests of one name never overwrite each other');
});

// ─── The drawing ────────────────────────────────────────────────────────────

function data(over: Partial<PrintSetData> = {}): PrintSetData {
  return {
    names: { first: 'Indalecio', second: 'Claire' },
    eyebrow: 'The wedding of',
    eventWord: 'Wedding',
    dateLabel: 'Friday · December 18, 2026',
    ceremonyTime: '2:00 PM',
    ceremonyVenue: 'San Agustin Church',
    receptionTime: null,
    receptionVenue: null,
    monogram: null,
    initials: 'I & C',
    details: { parents: [], openingLine: null, rsvpContact: null, giftLines: [], setnayanMark: true },
    entourage: [],
    attire: [],
    swatches: [],
    hubAddress: null,
    hasStill: false,
    hasEventQr: false,
    ...over,
  };
}
const PASS: PrintPass = { name: 'Maria Santos', seat: 'Table 7', qrRef: 'qr-g-1', serial: null, arrive: '3:30 PM', party: 1 };

test('an unknown table is OMITTED — never "Table TBA"', () => {
  assert.deepEqual(passCardFacts(PASS).map((f) => [f.label, f.value]), [['Table', '7'], ['Arrive', '3:30 PM']]);
  assert.deepEqual(passCardFacts({ ...PASS, seat: null }).map((f) => f.label), ['Arrive']);
  assert.deepEqual(passCardFacts({ ...PASS, seat: null, arrive: null }), []);
  for (const design of PASS_CARD_DESIGNS) {
    const look = printLookFor('house');
    const withTable = layoutPassCard({ look, data: data(), mode: 'screen', foil: false }, PASS, design);
    const without = layoutPassCard({ look, data: data(), mode: 'screen', foil: false }, { ...PASS, seat: null }, design);
    assert.equal(withTable.ops.length - without.ops.length, 2, `${design}: the TABLE label and value are the only ink that goes`);
  }
});

test('the Phone card PRINT format is the SAME drawing as the saved picture (one layout, never two)', () => {
  const f = PRINT_FORMATS['phone-card'];
  assert.deepEqual([f.wMm, f.hMm, f.style, f.for], [90, 120, 'phone', 'pass'], '3 : 4 portrait, a pass format');
  assert.ok(f.sheet && f.sheet.cols * f.sheet.rows === 4, 'four to an A4 with cut lines');
  for (const design of PASS_CARD_DESIGNS) {
    for (const mode of ['screen', 'print'] as const) {
      const d = data({ details: { ...data().details, passDesign: design } });
      const look = printLookFor('vintage');
      const printed = layoutPieceDocs('pass', { look, data: d, mode, foil: false, format: 'phone-card', pass: PASS })[0]!;
      const saved = layoutPassCard({ look, data: d, mode, foil: false }, PASS);
      assert.deepEqual(printed.ops, saved.ops, `${design} · ${mode}: the print and the picture are one drawing`);
      assert.equal(printed.diePath, saved.diePath);
    }
  }
});

test('"As of <date>" stamps the PRINTED card only — the PNG never carries it', () => {
  const d = data({ asOf: 'As of September 29, 2026' });
  for (const design of PASS_CARD_DESIGNS) {
    const look = printLookFor('house');
    const onPaper = layoutPassCard({ look, data: d, mode: 'print', foil: false }, PASS, design);
    const onScreen = layoutPassCard({ look, data: d, mode: 'screen', foil: false }, PASS, design);
    const plain = layoutPassCard({ look, data: data(), mode: 'print', foil: false }, PASS, design);
    assert.equal(onPaper.ops.length - plain.ops.length, 1, `${design}: paper gains one line`);
    assert.equal(onScreen.ops.length, layoutPassCard({ look, data: data(), mode: 'screen', foil: false }, PASS, design).ops.length, `${design}: the picture gains nothing`);
  }
});

test('EVERY design × EVERY theme fits: nothing inked leaves the safe area, nothing touches the code', () => {
  const box = (o: PrintOp) => {
    if (o.t === 'rect' || o.t === 'image') return { x: o.x, y: o.y, w: o.w, h: o.h };
    if (o.t === 'circle') return { x: o.cx - o.r, y: o.cy - o.r, w: o.r * 2, h: o.r * 2 };
    const n = (o.d.match(/-?\d*\.?\d+(?:e-?\d+)?/g) ?? []).map(Number);
    const xs = n.filter((_, i) => i % 2 === 0);
    const ys = n.filter((_, i) => i % 2 === 1);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  };
  const hit = (a: { x: number; y: number; w: number; h: number }, b: typeof a) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const bad: string[] = [];
  const longNames = data({ names: { first: 'Maximiliano Bartolome', second: 'Anastasia Concepcion' }, asOf: 'As of September 29, 2026' });
  for (const design of PASS_CARD_DESIGNS) {
    for (const theme of INVITE_THEME_IDS) {
      for (const mode of ['screen', 'print'] as const) {
        const doc = layoutPassCard({ look: printLookFor(theme), data: longNames, mode, foil: false }, { ...PASS, name: 'Maria Concepcion Santos-Villanueva' }, design);
        const qrs = doc.ops.filter((o): o is Extract<PrintOp, { t: 'image' }> => o.t === 'image' && o.ref.startsWith('qr-')).map((o) => ({ x: o.x - 3, y: o.y - 3, w: o.w + 6, h: o.h + 6 }));
        for (const o of doc.ops) {
          const bg = (o.t === 'image' && o.ref === 'still') || (o.t === 'rect' && (o.x <= 0.01 || o.y <= 0.01 || o.x + o.w >= doc.w - 0.01 || o.y + o.h >= doc.h - 0.01));
          if (bg) continue;
          const b = box(o);
          if (!safeContainsBox(doc.die, doc.w, doc.h, b)) bad.push(`${design} · ${theme} · ${mode}: ${o.t} at ${b.x.toFixed(1)},${b.y.toFixed(1)} ${b.w.toFixed(1)}×${b.h.toFixed(1)} leaves the safe area`);
          if (o.t === 'path' && o.fill) for (const q of qrs) if (hit(b, q)) bad.push(`${design} · ${theme} · ${mode}: ink touches the code`);
        }
      }
    }
  }
  assert.deepEqual(bad, []);
});

test('RENDERS 1080 × 1440 and the QR DECODES from the PNG — every design, a light and a dark theme', async () => {
  const url = 'https://setnayan.com/cale-ice?invite=tok-abc123';
  const qr = await renderInvitationQrPng({ appUrl: 'https://setnayan.com', slug: 'cale-ice', qrToken: 'tok-abc123', look: { ...FREE_QR_LOOK, dark: '#111111', light: '#FFFFFF' }, ownerSlug: null, width: 720 });
  for (const design of PASS_CARD_DESIGNS) {
    for (const theme of ['house', 'cyber'] as const) {
      const doc = layoutPassCard({ look: printLookFor(theme), data: data(), mode: 'screen', foil: false }, PASS, design);
      const png = await renderPassCardPng(doc, { 'qr-g-1': { bytes: new Uint8Array(qr), mime: 'image/png' } });
      const meta = await sharp(Buffer.from(png)).metadata();
      assert.deepEqual([meta.width, meta.height, meta.format], [PASS_CARD_PX.w, PASS_CARD_PX.h, 'png'], `${design} · ${theme}`);
      assert.equal(await decodeQrPayloadFromImage(png), url, `${design} · ${theme}: the code scans`);
      if (design === 'ticket') {
        // The notch at the perforation is CUT: transparent in the picture.
        const { data: px } = await sharp(Buffer.from(png)).extract({ left: 2, top: Math.round((228 / 480) * 1440), width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
        assert.equal(px[3], 0, 'the ticket’s notch is transparent');
      }
    }
  }
});

// ─── Wiring ─────────────────────────────────────────────────────────────────

test('the card route decides access BEFORE it draws, and needs the guest’s key or a host', () => {
  const r = src('app/api/guest/pass-card/route.ts');
  assert.match(r, /readGuestSession\(\)/, 'the guest key is the signed session cookie');
  assert.match(r, /getHostUserId\(/, 'or a host of the event');
  const gate = r.indexOf('decidePassCardAccess(');
  const refuse = r.indexOf('if (!verdict.allow)');
  const draw = r.indexOf('renderPassCardFor(');
  assert.ok(gate > 0 && refuse > gate && draw > refuse, 'gate → refuse → draw, in that order');
  assert.doesNotMatch(r, /qr_token=|searchParams\.get\('(token|slug|name)'\)/, 'nothing in the address is a credential or a name');
  assert.match(r, /private, no-cache/, 'drawn live from today’s data; a repeat is a 304 on the same version, never a stale table');
});

test('one guest’s card is FREE for the couple — no Pro question on the single route or its button', () => {
  const r = src('app/api/guest/pass-card/route.ts');
  assert.doesNotMatch(r, /printOwnsPro|ownsPro|EventHubPro|makerProMark/, 'the single card never asks about Pro');
  // Its own file since train m (the Maker loads it lazily — guest-pass-card-link.tsx).
  const links = src('app/dashboard/[eventId]/guests/_components/guest-pass-card-link.tsx');
  const at = links.indexOf('export function GuestPassCardLink');
  assert.ok(at > -1, 'the per-guest pass-card link moved — follow it');
  const fn = links.slice(at);
  assert.doesNotMatch(fn, /PaidMark|makerProMark|ownsPro/, 'no ◆ on the per-guest download');
});

test('the zip: hosts only, Event Hub Pro only — both on the SERVER, before a single card is drawn', () => {
  const r = src('app/api/guest/pass-card/all/route.ts');
  const host = r.indexOf('getHostUserId(eventId)');
  const pro = r.indexOf('printOwnsPro(eventId)');
  const list = r.indexOf('eligiblePassCardGuests(');
  const draw = r.indexOf('renderPassCardFor(');
  assert.ok(host > 0 && pro > host && list > pro && draw > list, 'member → Pro → the eligible list → draw');
  assert.match(r, /PASS_CARD_ZIP_PRO_MESSAGE, \{ status: 403 \}/);
  assert.match(r, /archiver\('zip', \{ store: true \}\)/, 'the shipped streaming zip');
  assert.match(r, /uniqueFileNames\(guests\.map\(\(g\) => passCardFileNameFor\(kit, g\)\)\)/, 'the same names as a guest’s own save');
  assert.match(r, /PASS_CARD_ZIP_MAX[\s\S]{0,400}status: 413/, 'too many → said plainly, never a short zip');
  assert.match(r, /archive\.destroy\(/, 'a card that cannot be drawn breaks the download loudly');
});

test('the zip holds exactly the guests who HAVE a card — named plus-ones in, pending / declined / TBA out', () => {
  const list: PassCardRow[] = [
    row({ guest_id: 'maria', rsvp_status: 'attending' }),
    row({ guest_id: 'ben', plus_one_of_guest_id: 'maria' }),
    row({ guest_id: 'tba', plus_one_of_guest_id: 'maria', tba: true }),
    row({ guest_id: 'req', entry_source: 'self_added_unlisted' }),
    row({ guest_id: 'no', rsvp_status: 'declined' }),
    row({ guest_id: 'orphan', plus_one_of_guest_id: 'gone' }),
    row({ guest_id: 'waits', plus_one_of_guest_id: 'req' }),
  ];
  assert.deepEqual(filterPassCardRows(list).map((r) => r.guest_id), ['maria', 'ben']);
  const s = src('lib/pass-card.server.ts');
  assert.match(s, /return \{ guests: filterEligible\(/, 'the zip’s list goes through that rule');
  assert.match(s, /filterPassCardRows\(rows, asPassCardRow\)/);
});

test('the TABLE prints only once the seat plan is PUBLISHED — the one flag Find your seat reads', () => {
  const seats = [{ guest_id: 'maria', table_id: 't7' }, { guest_id: 'ben', table_id: 'vip' }];
  const tables = [{ table_id: 't7', table_label: '7' }, { table_id: 'vip', table_label: '1', link_group_label: 'VIP Section' }];
  assert.equal(seatLabelsFrom(false, seats, tables).size, 0, 'unpublished → no table on any card');
  assert.deepEqual([...seatLabelsFrom(true, seats, tables)], [['maria', 'Table 7'], ['ben', 'VIP Section']], 'published → the table appears');
  const s = src('lib/pass-card.server.ts');
  const fn = s.slice(s.indexOf('async function readSeatLabels'), s.indexOf('// ─── One card'));
  assert.match(fn, /const published = await eventSeatingPublished\(admin, eventId\);/, 'the published flag is the seat plan’s own');
  assert.match(fn, /return seatLabelsFrom\(\s*published,/, 'and it decides');
  const layout = layoutPassCard({ look: printLookFor('house'), data: data(), mode: 'screen', foil: false }, { ...PASS, seat: seatLabelsFrom(false, seats, tables).get('maria') ?? null });
  const facts = passCardFacts({ ...PASS, seat: seatLabelsFrom(false, seats, tables).get('maria') ?? null });
  assert.deepEqual(facts.map((f) => f.label), ['Arrive'], 'the unpublished card carries no Table');
  assert.ok(layout.ops.length > 0);
});

test('the page withholds the card for pending / can’t come, and says the plain line in its place', () => {
  const body = src('app/[slug]/_components/site-body.tsx');
  assert.match(body, /g\.passCard === 'awaiting' \|\| g\.passCard === 'cannotCome' \? passCardLine\(g\.passCard\)/);
  assert.match(body, /passCardHref=\{g\.passCard === 'pass' \? PASS_CARD_ROUTE : null\}/, 'Save only for a guest with a card');
  const items = buildChecklist({ wear: null, wearNote: null, motif: [], arriveBy: null, venueName: null, mapsHref: null, tableLabel: null, passHref: null });
  assert.equal(items.find((i) => i.key === 'pass'), undefined, 'no "Save to Photos" in the checklist without a card');
});

test('every user-facing word for the card comes from ONE constant (a rename is one line)', () => {
  for (const f of ['app/[slug]/_components/your-guests.tsx', 'app/[slug]/_components/guest-code-keepers.tsx', 'app/dashboard/[eventId]/guests/_components/guest-pass-card-link.tsx']) {
    const s = src(f);
    assert.doesNotMatch(s, /'Save all (passes|tickets)'|"Save all (passes|tickets)"|>Save all (passes|tickets)<|label="Save (to Photos|my ticket)"/, `${f} spells the words itself`);
  }
  // 🎫 IT IS A TICKET (owner 2026-09-29, "OWNER ANSWERS — TEN OPEN QUESTIONS" (4)).
  assert.equal(PASS_CARD_WORDS.digital, 'Digital ticket (PNG)');
  assert.equal(PASS_CARD_WORDS.print, 'Printed ticket (PDF)');
  assert.equal(PASS_CARD_WORDS.saveOwn, 'Save my ticket');
  assert.equal(PASS_CARD_WORDS.saveAll, 'Save all tickets');
  assert.equal(PASS_CARD_WORDS.yours, 'Your ticket');
  assert.equal(PASS_CARD_WORDS.downloadAll, 'Download all tickets (.zip)');
  // …and no guest-facing "pass" is spelt by hand where the card is meant.
  for (const f of ['app/[slug]/_components/your-guests.tsx', 'app/[slug]/welcome/_components/plus-one-door.tsx']) {
    const s = src(f);
    assert.doesNotMatch(s, />[^<{]*\b(Y|y)our pass\b|just show my pass|’s pass\b/, `${f} still calls the ticket a pass`);
  }
});
