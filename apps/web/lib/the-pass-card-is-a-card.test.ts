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
import { ticketShowsTable } from './guests-may-see-seats';

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

test('🔓 a guest’s OWN waiting seat draws the "Request pending" ticket — to that guest only', () => {
  // Owner 2026-09-29 ("IT IS THEIR DIGITAL TICKET, IN A 'REQUEST PENDING'
  // STATE") + 2026-09-30 (the Event Hub shows the ticket). The session that
  // holds the seat already knows it is waiting, so saying so discloses nothing.
  const session = { guest_id: 'g-1', event_id: 'e-1' };
  const pending = row({ entry_source: 'self_added_unlisted' });
  assert.deepEqual(
    decidePassCardAccess({ session, isHost: false, target: pending, bringer: null, readFailed: false }),
    { allow: true, as: 'guest', pending: true },
  );
  // A plus-one brought by a waiting guest waits with them — the bringer's session sees it pending.
  const bringer = row({ entry_source: 'self_added_unlisted' });
  const theirs = row({ guest_id: 'p-1', plus_one_of_guest_id: 'g-1' });
  assert.deepEqual(
    decidePassCardAccess({ session, isHost: false, target: theirs, bringer, readFailed: false }),
    { allow: true, as: 'guest', pending: true },
  );
  // Nobody else, and never a host (there is no real ticket to download yet).
  const other = row({ guest_id: 'g-2', entry_source: 'self_added_unlisted' });
  assert.equal(decidePassCardAccess({ session, isHost: false, target: other, bringer: null, readFailed: false }).allow, false);
  assert.equal(decidePassCardAccess({ session: null, isHost: true, target: pending, bringer: null, readFailed: false }).allow, false);
  // An accepted guest's verdict carries no `pending` at all.
  assert.deepEqual(decidePassCardAccess({ session, isHost: false, target: row(), bringer: null, readFailed: false }), { allow: true, as: 'guest' });
  // …and the route draws the pending ticket for that verdict, never the real one.
  const route = src('app/api/guest/pass-card/route.ts');
  const branch = route.slice(route.indexOf('if (verdict.pending)'), route.indexOf('const etag'));
  assert.match(branch, /renderPassCardFor\(kit, target, 'classic', \{ pending: REQUEST_WORDS\.bandSub\(couple\) \}\)/);
  assert.match(branch, /'Cache-Control': 'private, no-store'/, 'a pending picture is never reused');
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

test('🎟 THE TABLE ON THE DAY — owner 2026-09-30: "their digital Ticket will also update on the date of the event with the seat number"', () => {
  // The day rule: from 00:00 Manila on the event's date, and never before —
  // whatever the couple's "show early" switch says (lib/guests-may-see-seats.ts).
  const day = { eventDate: '2027-03-13', eventDatePrecision: 'day' };
  assert.equal(ticketShowsTable(day, new Date('2027-03-12T15:59:59Z')), false, '23:59 Manila the night before shows a table');
  assert.equal(ticketShowsTable(day, new Date('2027-03-12T16:00:00Z')), true, '00:00 Manila on the day shows no table');
  assert.equal(ticketShowsTable({ ...day, eventDatePrecision: 'month' }, new Date('2027-03-20T00:00:00Z')), false, 'a month-only date has no day to open on');
  // The drawing draws what the pass carries: a seated guest's card says Table,
  // then Arrive; an unseated one says Arrive alone.
  assert.deepEqual(passCardFacts(PASS).map((f) => [f.label, f.value]), [['Table', '7'], ['Arrive', '3:30 PM']]);
  assert.deepEqual(passCardFacts({ ...PASS, seat: null, arrive: null }), []);
  // …so the readers are the gate: the Digital ticket's kit and the Printed
  // batch fill `seat` only on the ticket's half of the rule.
  const kit = stripComments(readFileSync(join(__dirname, 'pass-card.server.ts'), 'utf8'));
  assert.match(kit, /guestsMaySeeSeatsFor\(admin, eventId, \{ ticket: true \}\)/, 'the Digital ticket reads the seat plan without the day rule');
  assert.match(kit, /seat: kit\.seats\.get\(g\.guest_id\)\?\.seat \?\? null/, 'the Digital ticket no longer carries the seat it read');
  const batch = stripComments(readFileSync(join(__dirname, 'print-set.server.ts'), 'utf8'));
  assert.match(batch, /guestsMaySeeSeatsFor\(admin, eventId, \{ ticket: true \}\)/, 'the Printed tickets read the seat plan on the switch, not the day');
  // A seat drawn is ink: every look and every printed pass format changes.
  const look = printLookFor('house');
  const noSeat: PrintPass = { ...PASS, seat: null, seatNumber: null };
  const seated: PrintPass = { ...PASS, seat: 'Table 7', seatNumber: '3' };
  for (const design of PASS_CARD_DESIGNS) {
    const a = layoutPassCard({ look, data: data(), mode: 'screen', foil: false }, seated, design);
    const b = layoutPassCard({ look, data: data(), mode: 'screen', foil: false }, noSeat, design);
    assert.notDeepEqual(a.ops, b.ops, `Digital ticket · ${design}: the table drew no ink on the day`);
  }
  const boarding = Object.values(PRINT_FORMATS).find((f) => f.for === 'pass' && f.style === 'boarding')!;
  const a = layoutPieceDocs('pass', { look, data: data(), mode: 'print', foil: false, format: boarding.id, pass: seated })[0]!;
  const b = layoutPieceDocs('pass', { look, data: data(), mode: 'print', foil: false, format: boarding.id, pass: noSeat })[0]!;
  assert.notDeepEqual(a.ops, b.ops, 'the boarding pass drew no Table · Seat on the day');
  // Before the day the fields GO — never "Table —".
  const layout = stripComments(readFileSync(join(__dirname, 'print-layout.ts'), 'utf8'));
  assert.match(layout, /\.filter\(\(\[label, value\]\) => \(label !== 'Table' && label !== 'Seat'\) \|\| value !== null\)/, 'an unseated boarding pass prints an empty Table field again');
});

test('an unknown table is OMITTED — never "Table TBA"', () => {
  assert.deepEqual(passCardFacts({ ...PASS, seat: null }).map((f) => f.label), ['Arrive']);
  assert.deepEqual(passCardFacts(PASS).map((f) => [f.label, f.value]), [['Table', '7'], ['Arrive', '3:30 PM']]);
  for (const design of PASS_CARD_DESIGNS) {
    const look = printLookFor('house');
    const withTable = layoutPassCard({ look, data: data(), mode: 'screen', foil: false }, PASS, design);
    const without = layoutPassCard({ look, data: data(), mode: 'screen', foil: false }, { ...PASS, seat: null }, design);
    // The Fable ticket (Classic) draws the day's seat as ONE pill in the party line's place.
    assert.equal(withTable.ops.length - without.ops.length, design === 'classic' ? 1 : 2, `${design}: the table's own ink is the only ink that goes`);
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

test('🪑 THE DIGITAL TICKET CARRIES THE TABLE ON THE DAY — never before (owner 2026-09-30)', () => {
  // Owner, verbatim: "their digital Ticket will also update on the date of the
  // event with the seat number" — superseding the same day's "no seat plan on
  // the digital ticket for the moment".
  const s = src('lib/pass-card.server.ts');
  const fn = s.slice(s.indexOf('export function passCardPass'), s.indexOf('export function passCardDesignFor'));
  assert.ok(fn.length > 40, 'precondition: found passCardPass — re-point this guard');
  assert.match(fn, /seat: kit\.seats\.get\(g\.guest_id\)\?\.seat \?\? null,/, 'the digital ticket no longer carries the day’s table');
  assert.doesNotMatch(s, /eventSeatingPublished/, 'the ticket follows the couple’s "show early" switch — it follows the day only');
  const facts = passCardFacts({ ...PASS, seat: null });
  assert.deepEqual(facts.map((f) => f.label), ['Arrive'], 'a ticket with no table draws no Table');
  const seats = [{ guest_id: 'maria', table_id: 't7' }];
  const tables = [{ table_id: 't7', table_label: '7' }];
  assert.equal(seatLabelsFrom(false, seats, tables).size, 0, 'unpublished → no table');
  assert.deepEqual([...seatLabelsFrom(true, seats, tables)], [['maria', 'Table 7']]);
});

test('the Event Hub shows the ticket on Me — pending shows the pending ticket, can’t come says the plain line', () => {
  // 2026-09-30: the page's own pass block is gone; `GuestTicket` decides by
  // `passCardEligibility` alone (reused, never re-decided) — guarded in full,
  // and rendered, by app/[slug]/_components/the-hub-shows-the-ticket.test.ts.
  const t = src('app/[slug]/_components/guest-ticket.tsx');
  assert.match(t, /if \(state === 'none'\) return null;/);
  assert.match(t, /state === 'cannotCome'[\s\S]{0,300}passCardLine\(state\)/, 'can’t come says the one line, no ticket');
  assert.match(t, /src=\{PASS_CARD_ROUTE\}/, 'the picture is the ticket route');
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
