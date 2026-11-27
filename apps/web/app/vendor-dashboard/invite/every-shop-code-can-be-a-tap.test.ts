/**
 * 📶 EVERY CODE THE SHOP CAN SAVE CAN ALSO BE A TAP (owner 2026-11-05, *"add them to the marketing tools"* — the NFC
 * tap at events and expo booths is a supplier marketing tool).
 *
 * The writer already exists and is not rebuilt here: `QrCard` mounts the one strip (`QrActions` → `NfcWriteButton`)
 * under every code it draws, with the code's own `url` — so the tag writes the SAME address the QR does, and the
 * device explanation (iPhone browser → the Setnayan app or an Android phone) is the shared sheet's own words. This file
 * pins the two halves that make that true for the supplier's QR codes page, with the COUNT printed:
 *
 *   1. every code the pages can show is drawn by `QrCard` — Booked · Crew on Customers › QR codes, and Your page ·
 *      Reviews · Shortlist · Check a date on their own My QRs page (`shop/qrs/`, owner 23 Nov 2026);
 *   2. `QrCard` hands the strip the card's own `url`.
 *
 * And the one place the owner kept NFC OFF stays off: the couple's supplier-connect panel (build plan 2026-10-07).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { MY_QR_WORDS, SUPPLIER_QR_MODES, isPromoteQrMode } from '@/lib/supplier-qr-codes';

const WEB = path.join(__dirname, '..', '..', '..');
const read = (rel: string) => stripComments(fs.readFileSync(path.join(WEB, rel), 'utf8'));

/** The card each mode draws, by its `data` — one per mode. */
const CARD_OF_MODE: Record<(typeof SUPPLIER_QR_MODES)[number], string> = {
  shortlist: 'shortlist',
  locked: 'booked',
  dates: 'check-a-date',
  page: 'my-page',
  crew: 'crew',
  reviews: 'reviews',
  gown: 'gown',
};

test('every shop code is drawn by QrCard — so each carries Write to NFC', () => {
  const src = read('app/vendor-dashboard/invite/_components/qr-codes.tsx');
  const opened = read('app/vendor-dashboard/shop/qrs/_components/my-qr-code.tsx');
  assert.match(src, /from '@\/app\/_components\/qr-card'/);
  assert.match(opened, /from '@\/app\/_components\/qr-card'/);
  const cards = [...src.matchAll(/<QrCard\b[\s\S]*?\/>/g)].map((m) => m[0]);
  const openedCards = [...opened.matchAll(/<QrCard\b[\s\S]*?\/>/g)].map((m) => m[0]);
  // My QRs' one card draws whichever shop code is opened: its `data` is that code's own (`MY_QR_WORDS`).
  assert.equal(openedCards.length, 1);
  const openedCard = openedCards[0] ?? '';
  assert.match(openedCard, /\bdata=\{w\.data\}/);
  assert.match(openedCard, /\burl=\{d\.url\}/, 'the opened card must hand its own url');
  const report = SUPPLIER_QR_MODES.map((mode) => {
    if (isPromoteQrMode(mode)) return { mode, card: MY_QR_WORDS[mode].data === CARD_OF_MODE[mode] ? openedCard : undefined };
    return { mode, card: cards.find((c) => c.includes(`data="${CARD_OF_MODE[mode]}"`)) };
  });
  console.log(report.map((r) => `${r.mode}: ${r.card ? 'QrCard' : 'MISSING'}`).join(' · '));
  for (const { mode, card } of report) {
    assert.ok(card, `the ${mode} code is not drawn by QrCard — it would lose Write to NFC`);
    assert.match(card, /\burl=\{/, `the ${mode} card must hand its own url`);
  }
  // 👗 26 Nov 2026: the Gown design code (a Gown Maker share) joined Booked and Crew.
  assert.equal(cards.length, 3, `${cards.length} QrCards on Customers › QR codes for Booked · Crew · Gown design`);
});

test('QrCard hands the strip the SAME url the code encodes', () => {
  const src = read('app/_components/qr-card.tsx');
  assert.match(src, /<QrActions url=\{url\}/);
  const strip = read('app/_components/qr-actions.tsx');
  assert.match(strip, /<NfcWriteButton url=\{url\} \/>/);
});

test('the couple’s supplier-connect panel stays without Write to NFC (2026-10-07)', () => {
  const src = read('app/dashboard/[eventId]/_components/supplier-connect-panel.tsx');
  assert.doesNotMatch(src, /NfcWriteButton|<QrActions|<QrCard/);
});

test('the door piece has ONE home — Prints, reached from a shop code’s “Print it › Door print” (My QRs, 23 Nov 2026)', () => {
  // Retargeted from Option B's “Put it on… › Door print” (2026-11-06): the shop's codes moved to My QRs, where a code's
  // page hands its code to Promote's Prints by the address (`printWithQrHref(code, 'door')` → `?print=…&piece=door`).
  const codes = read('app/vendor-dashboard/invite/_components/qr-codes.tsx');
  const list = read('app/vendor-dashboard/invite/_components/qr-code-list.tsx');
  const opened = read('app/vendor-dashboard/shop/qrs/_components/my-qr-code.tsx');
  const mounts = [...(codes + list + opened).matchAll(/<DoorSticker\b/g)].length;
  const toDoor = [...opened.matchAll(/printWithQrHref\(d\.code, 'door'\)/g)].length;
  console.log(`door sticker mounts: ${mounts} · “Print it › Door print” doors: ${toDoor}`);
  assert.equal(mounts, 0, 'the door sticker fold is back — the door piece lives in Prints');
  assert.equal(fs.existsSync(path.join(WEB, 'app/vendor-dashboard/invite/_components/door-sticker.tsx')), false, 'the old door-sticker fold component is back');
  assert.equal(toDoor, 1, 'a shop code’s page must offer “Print it › Door print” exactly once');
  const prints = read('app/vendor-dashboard/shop/promote/_components/shop-prints-section.tsx');
  assert.match(prints, /initialAsk\?\.piece === 'door'/, 'the Prints sheet must open its door piece when a code is handed to it');
});
