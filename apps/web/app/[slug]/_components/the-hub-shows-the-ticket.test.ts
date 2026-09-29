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
 *   4 · the QR on the ticket DECODES at the size a phone shows it (300 CSS px,
 *       read at 1× — no retina help — and at 2×), every design, and the
 *       pending ticket too.
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
  assert.match(ticket, /<TicketPicture\s+src=\{PASS_CARD_ROUTE\}/, 'the picture is not the saved file');
  assert.match(ticket, /passCardHref=\{PASS_CARD_ROUTE\}/, 'Save is not the same file as the picture');
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
  assert.equal(page.split('<GuestTicket').length - 1, 1, 'one mount, one #site-pass');
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

test('the ticket’s QR DECODES at phone size — 300 × 400 read at 1× and 2×, every design, and pending', async () => {
  const url = 'https://setnayan.com/cale-ice?invite=tok-abc123';
  const qr = await renderInvitationQrPng({
    appUrl: 'https://setnayan.com',
    slug: 'cale-ice',
    qrToken: 'tok-abc123',
    look: { ...FREE_QR_LOOK, dark: '#111111', light: '#FFFFFF' },
    ownerSlug: null,
    width: 720,
  });
  const images = { 'qr-g-1': { bytes: new Uint8Array(qr), mime: 'image/png' } };
  const cases: Array<[string, PrintPass, (typeof PASS_CARD_DESIGNS)[number]]> = [
    ...PASS_CARD_DESIGNS.map((d) => [d, PASS, d] as [string, PrintPass, (typeof PASS_CARD_DESIGNS)[number]]),
    ['pending', { ...PASS, arrive: null, party: 0, pending: 'waiting for Indalecio & Claire' }, 'classic'],
  ];
  for (const [name, pass, design] of cases) {
    const doc = layoutPassCard({ look: printLookFor('house'), data: DATA, mode: 'screen', foil: false }, pass, design);
    const png = Buffer.from(await renderPassCardPng(doc, images));
    for (const scale of [1, 2]) {
      // What the phone's screen holds: the 1080 × 1440 file drawn into a
      // 300 × 400 CSS box, at `scale` device pixels per CSS pixel.
      const shown = await sharp(png)
        .resize({ width: 300 * scale, height: 400 * scale, fit: 'fill' })
        .flatten({ background: '#ffffff' })
        .png()
        .toBuffer();
      assert.equal(await decodeQrPayloadFromImage(shown), url, `${name} at ${scale}×: the code on screen does not scan`);
    }
  }
});
