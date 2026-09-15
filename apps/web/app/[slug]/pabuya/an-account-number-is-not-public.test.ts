/**
 * A BANK ACCOUNT NUMBER IS SHOWN TO INVITED GUESTS, NOT TO THE INTERNET.
 *
 * ── 🔴 WHAT WAS PUBLIC ─────────────────────────────────────────────────────
 * The gifts page is reachable by anyone holding the link — deliberately, so a
 * relative abroad can send a gift. On 2026-09-15 a fetch with **no session at
 * all** returned a live couple's bank account name and number in the page body.
 * The owner, shown that: **"gate the account number."**
 *
 * ── WHAT THIS PINS ─────────────────────────────────────────────────────────
 * 1. The number is withheld from an unrecognised reader — and so is the QR,
 *    because a bank QR ENCODES the account it stands for. Gating the digits and
 *    printing the code beside them is a gate with a window next to it.
 * 2. Recognition is a guest session FOR THIS EVENT, or a host asked through
 *    `isHostMemberType` — never a bare `Boolean(row)`, which once waved a
 *    `guest`-typed member into a private site.
 * 3. The page SAYS something is withheld. A bank card with no number, no QR and
 *    no sentence reads as a couple who filled the form in wrong; that sentence
 *    is the difference between a gate and a bug.
 *
 * ⛔ WALLETS ARE DELIBERATELY NOT COVERED. The ruling was about the account
 * number, and a bank account is the case that cannot be undone — a couple can
 * change a GCash number in an app and cannot rotate a bank account. Widening a
 * disclosure rule past what was asked is how the next person inherits a decision
 * nobody made. If that changes, this test changes with it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

function pageBody(): string {
  const whole = stripComments(
    readFileSync(join(process.cwd(), 'app/[slug]/pabuya/page.tsx'), 'utf8'),
  );
  /* 🪤 Collapse whitespace: this repo's stripComments pads comments with SPACES
     of the same length, so a character-measured window lands on blanks. */
  const start = whole.indexOf('export default async function');
  assert.ok(start > 0, 'the gifts page has no default export — this guard points at nothing');
  return whole.slice(start).replace(/\s+/g, ' ');
}

test('🔒 the bank number and its QR are withheld from an unrecognised reader', () => {
  const src = pageBody();
  assert.match(
    src,
    /withhold\s*\?\s*null\s*:\s*m\.handle/,
    'the account number is no longer withheld — it is readable by anyone with the link',
  );
  assert.match(
    src,
    /withhold\s*\?\s*null\s*:\s*m\.qrDisplayUrl/,
    'the QR is no longer withheld — a bank QR encodes the very account the number was hidden to protect',
  );
  assert.match(
    src,
    /const withhold = isBank && !viewerIsRecognised/,
    'the withholding condition changed shape — re-read it before assuming it still holds',
  );
});

test('recognition is a session for THIS event, or a real host', () => {
  const src = pageBody();
  assert.ok(src.includes('readGuestSession'), 'no guest session is read, so an invited guest cannot be recognised');
  assert.match(
    src,
    /guestSession\?\.event_id === event\.event_id/,
    'the session is not compared to THIS event — a session for another wedding would pass',
  );
  assert.ok(
    src.includes('isHostMemberType'),
    'host membership is not asked through isHostMemberType — existence was once mistaken for authority here',
  );
});

test('🔑 the page says something is withheld, so a gate cannot read as a bug', () => {
  const src = pageBody();
  assert.ok(src.includes('bankWithheld'), 'nothing tracks whether anything was withheld');
  const whole = readFileSync(join(process.cwd(), 'app/[slug]/pabuya/page.tsx'), 'utf8');
  assert.match(
    whole,
    /Bank details are shown to invited guests/,
    'the explanation is gone — a bank card with no number and no sentence reads as a couple who filled the form in wrong',
  );
});
