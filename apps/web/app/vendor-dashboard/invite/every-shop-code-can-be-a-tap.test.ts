/**
 * 📶 EVERY CODE THE SHOP CAN SAVE CAN ALSO BE A TAP (owner 2026-11-05, *"add them to the marketing tools"* — the NFC
 * tap at events and expo booths is a supplier marketing tool).
 *
 * The writer already exists and is not rebuilt here: `QrCard` mounts the one strip (`QrActions` → `NfcWriteButton`)
 * under every code it draws, with the code's own `url` — so the tag writes the SAME address the QR does, and the
 * device explanation (iPhone browser → the Setnayan app or an Android phone) is the shared sheet's own words. This file
 * pins the two halves that make that true for the supplier's QR codes page, with the COUNT printed:
 *
 *   1. every code the page can show (Shortlist · Booked · Check a date · My page · Crew) is drawn by `QrCard`;
 *   2. `QrCard` hands the strip the card's own `url`.
 *
 * And the one place the owner kept NFC OFF stays off: the couple's supplier-connect panel (build plan 2026-10-07).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { SUPPLIER_QR_MODES } from '@/lib/supplier-qr-codes';

const WEB = path.join(__dirname, '..', '..', '..');
const read = (rel: string) => stripComments(fs.readFileSync(path.join(WEB, rel), 'utf8'));

/** The card each mode draws, by its `data` — one per mode. */
const CARD_OF_MODE: Record<(typeof SUPPLIER_QR_MODES)[number], string> = {
  shortlist: 'shortlist',
  locked: 'booked',
  dates: 'check-a-date',
  page: 'my-page',
  crew: 'crew',
};

test('every shop code is drawn by QrCard — so each carries Write to NFC', () => {
  const src = read('app/vendor-dashboard/invite/_components/qr-codes.tsx');
  assert.match(src, /from '@\/app\/_components\/qr-card'/);
  const cards = [...src.matchAll(/<QrCard\b[\s\S]*?\/>/g)].map((m) => m[0]);
  const report = SUPPLIER_QR_MODES.map((mode) => {
    const card = cards.find((c) => c.includes(`data="${CARD_OF_MODE[mode]}"`));
    return { mode, card };
  });
  console.log(report.map((r) => `${r.mode}: ${r.card ? 'QrCard' : 'MISSING'}`).join(' · '));
  for (const { mode, card } of report) {
    assert.ok(card, `the ${mode} code is not drawn by QrCard — it would lose Write to NFC`);
    assert.match(card, /\burl=\{/, `the ${mode} card must hand its own url`);
  }
  assert.equal(cards.length, SUPPLIER_QR_MODES.length, `${cards.length} QrCards for ${SUPPLIER_QR_MODES.length} codes`);
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
