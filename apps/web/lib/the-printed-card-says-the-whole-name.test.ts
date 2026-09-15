/**
 * A PRINTED CARD CARRIES THE FORMAL NAME — and this file is where that
 * judgement is EXECUTED rather than remembered.
 *
 * ── 🔴 WHAT WAS SHIPPING ────────────────────────────────────────────────────
 * `dashboard/[eventId]/invitation/print/page.tsx` renders one card per guest —
 * a QR, a name, a role — and it printed `guestDisplayName`, the COMPACT name.
 * Measured against a real event on 2026-09-16: **73 of 77 guests carry a title
 * or a suffix**. So the sheet dropped a title for 95% of the people about to be
 * handed a physical card, and principal sponsors — whose titles carry the most
 * weight at a Filipino wedding — are exactly who receives one.
 *
 * ⚠ **A PRINTED CARD IS THE ONE SURFACE THAT CANNOT BE CORRECTED AFTERWARDS.**
 * A wrong name on a screen is an edit; a wrong name on 77 cards is a reprint.
 *
 * ── ⚖ AND THE NARROWING IS PART OF THE DECISION ─────────────────────────────
 * The dashboard table at `../invitation/page.tsx` keeps the COMPACT name in all
 * of its call sites. It is a management row, not a card: a title there is noise
 * on every line. 🔑 **Widening the compact name would move every name in the
 * product at once, which is the whole reason the two functions exist apart.**
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { printedCardName, guestDisplayName, guestFullName } from './guests';

/** A row shaped like the ones `fetchGuestsByEvent` returns. */
function row(over: Record<string, unknown> = {}) {
  return {
    guest_id: 'g1',
    first_name: 'Indalecio',
    last_name: 'Casasola',
    name_prefix: null,
    middle_name: null,
    name_suffix: null,
    display_name: null,
    role: 'principal_sponsor_ninong',
    ...over,
  } as Parameters<typeof printedCardName>[0];
}

test('🔑 the printed card keeps the title and the suffix', () => {
  const g = row({ name_prefix: 'Atty.', middle_name: 'Subia', name_suffix: 'II' });
  assert.equal(printedCardName(g), 'Atty. Indalecio Subia Casasola II');
  /* The defect this file exists for: the compact name drops both ends. If this
     ever stops being true, the two functions have converged and the split is
     no longer doing anything. */
  assert.notEqual(guestDisplayName(g), printedCardName(g));
});

test('🔒 a nameless row prints SOMETHING — never a blank card beside a QR', () => {
  /* `guestFullName` returns null when every part is empty. Without the
     fallback that null would render as an empty <p> next to a QR code: a card
     nobody can hand to anybody, which is worse than the compact name. */
  const empty = row({ first_name: '', last_name: '' });
  assert.equal(guestFullName(empty), null);
  assert.equal(typeof printedCardName(empty), 'string');
});

test('🔑 a display_name the couple typed WINS over the assembled parts', () => {
  /* Both helpers honour it, so a couple who wrote "Tita Baby" gets "Tita Baby"
     on the card rather than a title they never asked for. */
  const g = row({ display_name: 'Tita Baby', name_prefix: 'Atty.' });
  assert.equal(printedCardName(g), 'Tita Baby');
});

test('🔒 the print sheet calls printedCardName, and the dashboard table does NOT', () => {
  /* ⚠ stripComments PADS WITH SPACES — collapse whitespace or every window is
     blank. And the prose above deliberately names both functions, which is
     exactly why the source must be stripped before it is matched. */
  const read = (p: string) =>
    stripComments(readFileSync(join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'invitation', p), 'utf8'))
      .replace(/\s+/g, ' ');

  const sheet = read(join('print', 'page.tsx'));
  const table = read('page.tsx');

  assert.equal((sheet.match(/printedCardName\(/g) ?? []).length, 1,
    'the print sheet must render the formal name exactly once — per card');
  assert.doesNotMatch(sheet, /guestDisplayName\(/,
    'no compact name may survive on the printed sheet');

  /* The narrowing, asserted rather than trusted: the management table stays
     compact. A future sweep that "fixes" it will fail here and have to argue. */
  assert.doesNotMatch(table, /printedCardName\(/,
    'the dashboard table is a management row — a title there is noise on every line');
  assert.ok((table.match(/guestDisplayName\(/g) ?? []).length >= 4,
    'the table still uses the compact name');
});
