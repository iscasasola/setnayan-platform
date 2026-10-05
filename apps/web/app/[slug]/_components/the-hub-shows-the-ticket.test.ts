/**
 * THE GUEST'S EVENT HUB SHOWS THEIR DIGITAL TICKET — ON ME, AND ONLY THERE.
 *
 * Owner, verbatim 2026-09-30, pointing at the pass section (`#site-pass`: a
 * GUEST / ARRIVE grid over a round QR): *"i thought this will be the digital
 * ticket"* — then, the same day: the ticket belongs on the guest's Me page
 * only, not on Home/Details. And: *"no seat plan on the digital ticket for the
 * moment"*.
 *
 * What this pins, each by RENDERING or by the one source that decides it:
 *   1 · every state renders what the owner asked, via `passCardEligibility`
 *       (reused): pass → the ticket; awaiting → the pending ticket; can't
 *       come → the one line, no ticket; none → nothing;
 *   2 · ONE SOURCE — the picture shown and the file saved are the same route;
 *   3 · the ticket is mounted on Me (page.tsx's `meSlot`), and Home has no
 *       pass, no QR block and no second `#site-pass`;
 *   4 · the QR on the ticket DECODES at the size a phone shows it (300 CSS px
 *       at 2× and 3×; the free square look at 1× too), every design, square
 *       and circle looks, the pending ticket too — and it opens THAT guest.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { stripComments } from '@/lib/strip-comments';
import {
  PASS_CARD_CANNOT_COME_LINE,
  PASS_CARD_DESIGNS,
  PASS_CARD_ROUTE,
  PASS_CARD_WORDS,
} from '@/lib/pass-card';
import { REQUEST_WORDS } from '@/lib/request-key';
import { layoutPassCard, type PrintPass, type PrintSetData } from '@/lib/print-layout';
import { printLookFor } from '@/lib/print-pieces';
import { renderPassCardPng } from '@/lib/pass-card-render';
import { renderInvitationQrPng } from '@/lib/qr';
import { decodeQrPayloadFromImage } from '@/lib/qr-decode';
import { FREE_QR_LOOK } from '@/lib/qr-look';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = __dirname;
const read = (p: string) => stripComments(readFileSync(join(HERE, p), 'utf8'));

async function render(state: 'pass' | 'awaiting' | 'cannotCome' | 'none'): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { GuestTicket } = await import('./guest-ticket');
  const el = GuestTicket({ state, name: 'Maria Santos', invitationUrl: 'https://setnayan.com/x?invite=t' });
  return el ? renderToStaticMarkup(el) : '';
}

// ─── 1 · The states ─────────────────────────────────────────────────────────

test('an accepted, coming guest sees their ticket — the route’s picture, Save my ticket, "Show this at the door."', async () => {
  const html = await render('pass');
  assert.match(html, /id="site-pass"/, 'the day-of "Show your ticket" link has nowhere to land');
  assert.match(html, new RegExp(`<img[^>]*src="${PASS_CARD_ROUTE}"`), 'the ticket picture is not the ticket route');
  assert.match(html, /width="300" height="400"/, 'the 3:4 box is not reserved — the page jumps when it lands');
  assert.ok(html.includes(PASS_CARD_WORDS.saveOwn), 'no "Save my ticket"');
  assert.ok(html.includes('Show this at the door.'), 'the door line is gone');
  assert.ok(!html.includes('finds your table'), 'the ticket carries no table — the page must not promise one');
  assert.ok(html.includes('Copy link'), 'the second action is gone');
});

test('a guest waiting in the couple’s Requests sees the "Request pending" ticket', async () => {
  const html = await render('awaiting');
  assert.match(html, /data-guest-ticket="awaiting"/);
  assert.match(html, new RegExp(`<img[^>]*src="${PASS_CARD_ROUTE}"`), 'the pending ticket is not drawn');
  assert.ok(html.includes(REQUEST_WORDS.sentUnlocks), 'the pending line is not the prototype’s');
  assert.ok(!html.includes('Show this at the door.'), 'a pending ticket is not valid at the door — it must not say so');
});

test('a guest who cannot come gets NO ticket — the one line in its place', async () => {
  const html = await render('cannotCome');
  assert.doesNotMatch(html, /<img/, 'a ticket for someone who cannot come');
  assert.ok(html.includes(PASS_CARD_CANNOT_COME_LINE));
  assert.match(html, /id="site-pass"/, 'the anchor still lands on the line that explains');
});

test('no seat, no ticket — nothing renders (Me then offers "My QR", as it always did)', async () => {
  assert.equal(await render('none'), '');
});

// ─── 2 · One source ─────────────────────────────────────────────────────────

test('ONE SOURCE — the card shown and the file saved are the same route, the same drawing', () => {
  const ticket = read('guest-ticket.tsx');
  // 👁 PR-10: the source is a prop that DEFAULTS to the ticket route — only the
  // Maker's See as sample passes another (page.tsx, held below) — and the
  // picture and the save still read the one value.
  assert.match(ticket, /\bsrc = PASS_CARD_ROUTE,/, 'a real guest’s picture is not the ticket route');
  assert.match(ticket, /<TicketPicture\s+src=\{src\}/, 'the picture is not the saved file');
  assert.match(ticket, /passCardHref=\{src\}/, 'Save is not the same file as the picture');
  // …and the route itself serves the pending ticket from the same renderer the
  // request-ticket route uses, so the Event Hub and Send agree.
  const route = stripComments(readFileSync(join(HERE, '..', '..', 'api', 'guest', 'pass-card', 'route.ts'), 'utf8'));
  assert.match(route, /if \(verdict\.pending\)/);
  // The couple's look, not a hard-coded Classic, unless a design is asked for.
  assert.match(route, /passCardDesignFor\(kit, url\.searchParams\.get\('design'\)\)/, 'the couple’s ticket style is ignored');
});

test('a failed picture is never an empty box: it swaps to the plain code and says so', () => {
  const pic = read('ticket-picture.tsx');
  assert.match(pic, /onError=\{\(\) => setState\('failed'\)\}/);
  assert.match(pic, /img\.complete[\s\S]{0,80}naturalWidth > 0 \? 'shown' : 'failed'/, 'an error before hydration is missed');
  assert.match(pic, /if \(state === 'failed'\) return <>\{fallback\}<\/>;/);
  assert.match(read('guest-ticket.tsx'), /src="\/api\/guest\/qr"/, 'the fallback has no code to show at the door');
});

// ─── 3 · Where it is mounted ────────────────────────────────────────────────

test('the ticket is on Me — mounted into the Me section, first', () => {
  const page = stripComments(readFileSync(join(HERE, '..', 'page.tsx'), 'utf8'));
  const me = page.slice(page.indexOf('const meSlot'), page.indexOf('<GuestMe', page.indexOf('const meSlot')));
  assert.match(me, /<GuestTicket\b/, 'the ticket is not on Me');
  assert.match(me, /state=\{passCard\}/, 'the ticket does not read passCardEligibility');
  assert.match(me, /widgetShouldRender\(widgetByType\(widgets, 'qr_card'\)\)/, 'the couple’s QR-card switch is not honoured');
  // One mount per render, one #site-pass: the real guest's Me, and — in another
  // return of the page — the Maker's See as sample (PR-10), the ONLY mount that
  // hands in a picture of its own.
  assert.equal(page.split('<GuestTicket').length - 1, 2, 'a third ticket mount appeared');
  assert.doesNotMatch(me, /\bsrc=/, 'a real guest’s ticket was handed another picture');
  const sample = page.slice(page.indexOf('const seeAs = resolveSampleViewer('), page.indexOf("if (guestViewer.kind === 'anonymous')"));
  assert.match(sample, /<GuestTicket[\s\S]*?src=\{sampleTicketSrc\(event\.event_id\)\}/, 'the second mount is not the See as sample');
});

test('Home has no pass: no QR block, no facts grid, no second #site-pass', () => {
  const body = read('site-body.tsx');
  assert.doesNotMatch(body, /PASS_ANCHOR|site-pass/, 'a pass is back on Home');
  assert.doesNotMatch(body, /passCardLine|guestPassFacts|It finds your table/, 'the old pass block is back');
  assert.doesNotMatch(body, /<GuestCodeKeepers/, 'the pass’s save controls are back on Home');
});

// ─── 4 · The on-screen QR scans ─────────────────────────────────────────────

const DATA: PrintSetData = {
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
} as unknown as PrintSetData;
const PASS: PrintPass = { name: 'Maria Santos', seat: null, qrRef: 'qr-g-1', serial: null, arrive: '3:30 PM', party: 1 };

// 🔑 OWNER 2026-09-30: "the QR for each guest must be ready also". Every guest
// row is BORN with its code — `guests.qr_token TEXT NOT NULL UNIQUE DEFAULT
// encode(gen_random_bytes(16),'hex')` (iteration 0001) — and no insert in the
// app or in SQL supplies its own, so plus-ones, requesters (keyed on Send) and
// bulk imports all get one from the column. The ticket draws THAT code in the
// event's own QR look (shape · pattern · centre; ink forced black on white so
// it scans), and the code opens THAT guest's page (`?invite=` → redeem →
// `.eq('qr_token', token)` in this event).

const TOKEN = '0123456789abcdef0123456789abcdef';
const APP = 'https://setnayan.com';

test('the ticket draws THIS guest’s code, in the event’s own look', () => {
  const kit = stripComments(readFileSync(join(HERE, '..', '..', '..', 'lib', 'pass-card.server.ts'), 'utf8'));
  const draw = kit.slice(kit.indexOf('export async function renderPassCardFor'), kit.indexOf('export async function eligiblePassCardGuests'));
  assert.match(draw, /qrToken: g\.qr_token,/, 'the ticket is not drawn from this guest’s own code');
  assert.match(draw, /look: set\.qrLook,/, 'the ticket ignores the event’s QR look');
  assert.match(kit, /qrLook: \{ \.\.\.set\.qrLook, dark: '#111111', light: '#FFFFFF' \}/, 'shape, pattern and centre must survive; only the ink is forced');
  // The event's look is the couple's own (free → Setnayan centre, Pro → theirs).
  const set = stripComments(readFileSync(join(HERE, '..', '..', '..', 'lib', 'print-set.server.ts'), 'utf8'));
  // A drafted QR look is drawn only when a DRAFT is handed in (the Maker's preview,
  // `qrLookForHostDraft`); the guest's ticket kit never hands one in.
  assert.match(set, /const qrLook = qrLookForHostDraft\(liveEvent, draft\) \?\? \(await resolveEventQrLook\(admin, eventId, event\)\);/);
  assert.doesNotMatch(kit, /loadPrintSet\(eventId, \{[^}]*\}\s*,/, 'the guest’s ticket was drawn from the host’s draft');
  // …and the code opens that guest: the page hands `?invite=` to redeem, which
  // finds the ONE row holding that token, in this event.
  const page = stripComments(readFileSync(join(HERE, '..', 'page.tsx'), 'utf8'));
  assert.match(page, /const invite = \(search\.invite \?\? ''\)\.trim\(\);/);
  assert.match(page, /\/redeem\?slug=\$\{encodeURIComponent\(slug\)\}&token=\$\{encodeURIComponent\(invite\)\}/);
  const redeem = stripComments(readFileSync(join(HERE, '..', 'redeem', 'route.ts'), 'utf8'));
  assert.match(redeem, /\.eq\('qr_token', token\)/);
  assert.match(redeem, /keyRow\.event_id !== event\.event_id/, 'a code from another event must not open this one');
});

test('every guest row is born with a code — the column, not the caller, supplies it', () => {
  const mig = readFileSync(join(HERE, '..', '..', '..', '..', '..', 'supabase', 'migrations', '20260513010000_iteration_0001_guests.sql'), 'utf8');
  assert.match(mig, /qr_token\s+TEXT NOT NULL UNIQUE DEFAULT encode\(gen_random_bytes\(16\), 'hex'\)/);
});

test('the ticket’s QR DECODES at phone size and opens THAT guest — square and circle looks, every design, and pending', async () => {
  const { buildInvitationUrl } = await import('@/lib/qr');
  const url = buildInvitationUrl({ appUrl: APP, slug: 'cale-ice', qrToken: TOKEN, ownerSlug: null });
  assert.equal(new URL(url).searchParams.get('invite'), TOKEN, 'precondition: the code carries this guest’s token');
  for (const shape of ['square', 'circle'] as const) {
    const qr = await renderInvitationQrPng({
      appUrl: APP,
      slug: 'cale-ice',
      qrToken: TOKEN,
      look: { ...FREE_QR_LOOK, shape, dark: '#111111', light: '#FFFFFF' },
      ownerSlug: null,
      width: 720,
    });
    const images = { 'qr-g-1': { bytes: new Uint8Array(qr), mime: 'image/png' as const } };
    const cases: Array<[string, PrintPass, (typeof PASS_CARD_DESIGNS)[number]]> = [
      ...PASS_CARD_DESIGNS.map((d) => [d, PASS, d] as [string, PrintPass, (typeof PASS_CARD_DESIGNS)[number]]),
      ['pending', { ...PASS, arrive: null, party: 0, pending: 'waiting for Indalecio & Claire' }, 'classic'],
    ];
    for (const [name, pass, design] of cases) {
      const doc = layoutPassCard({ look: printLookFor('house'), data: DATA, mode: 'screen', foil: false }, pass, design);
      const png = Buffer.from(await renderPassCardPng(doc, images));
      // The saved file itself…
      assert.equal(await decodeQrPayloadFromImage(png), url, `${shape} · ${name}: the saved ticket does not scan`);
      // 📱 2× and 3× — the densities of the phones this is shown on (every
      // iPhone is 3×; Android phones 2–3.5×). MEASURED 2026-09-30: a CIRCLE code
      // on the Photo-poster design does NOT decode at 1× (300 × 400 device px —
      // a desktop monitor), every other look × design does; all decode at 2×
      // and 3×, and in the saved file. Round codes in round slots are the
      // round-slot builder's; if they enlarge the poster's code, add 1× here.
      for (const scale of [2, 3]) {
        // …and what the phone's screen holds: the file drawn into a 300 × 400
        // CSS box, at `scale` device pixels per CSS pixel.
        const shown = await sharp(png)
          .resize({ width: 300 * scale, height: 400 * scale, fit: 'fill' })
          .flatten({ background: '#ffffff' })
          .png()
          .toBuffer();
        assert.equal(await decodeQrPayloadFromImage(shown), url, `${shape} · ${name} at ${scale}×: the code on screen does not scan`);
      }
    }
  }
});
