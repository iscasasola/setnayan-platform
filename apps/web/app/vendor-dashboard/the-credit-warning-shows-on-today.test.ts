/**
 * ⏳ THE CREDIT WARNING SHOWS ON TODAY (owner 2026-10-02, tracker d5: "warn a
 * supplier 7 days before a balance expires — one notice on their Today page +
 * email").
 *
 * The email + tray half ships already (`maybeSweepVendorCreditWarnings`, once
 * per term, `credit-warning-emails.test.ts` holds the allowlist). This pins the
 * Today half: the same rule, the same window, the same words, on the page.
 *
 * SABOTAGE (run 2026-10-02): deleting the `{creditNotice ? (` block from
 * page.tsx turns test 3 red ("Today does not draw the credit warning").
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CREDIT_WARNING_WINDOW_DAYS, creditWarningCopy, todayCreditNotice } from '@/lib/vendor-credit-warning';
import { stripComments } from '@/lib/strip-comments';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-10-02T04:00:00Z');
const at = (days: number) => new Date(NOW + days * DAY).toISOString();

test('1 · seven days, the same window as the email', () => {
  assert.equal(CREDIT_WARNING_WINDOW_DAYS, 7);
  assert.ok(todayCreditNotice({ creditPhp: 2500, tierExpiresAt: at(7) }, NOW), 'day 7 is inside');
  assert.ok(todayCreditNotice({ creditPhp: 2500, tierExpiresAt: at(1) }, NOW), 'day 1 is inside');
  assert.equal(todayCreditNotice({ creditPhp: 2500, tierExpiresAt: at(7.5) }, NOW), null, 'too early');
  assert.equal(todayCreditNotice({ creditPhp: 2500, tierExpiresAt: at(-1) }, NOW), null, 'already gone — not "about to"');
  assert.equal(todayCreditNotice({ creditPhp: 0, tierExpiresAt: at(3) }, NOW), null, 'no balance, nothing to say');
  assert.equal(todayCreditNotice({ creditPhp: 2500, tierExpiresAt: null }, NOW), null, 'nothing ends');
});

test('2 · the same words as the email, and a way to act', () => {
  const n = todayCreditNotice({ creditPhp: 2500, tierExpiresAt: at(3) }, NOW)!;
  const copy = creditWarningCopy({ creditPhp: 2500, tierExpiresAt: at(3) });
  assert.equal(n.title, copy.title);
  assert.equal(n.body, copy.body);
  assert.equal(n.href, '/vendor-dashboard/subscription');
  assert.ok(!/vendor/i.test(n.title + n.body), 'the words say "vendor"');
});

test('3 · Today reads the two columns and draws the notice — as a row, in the simpler Today’s words', async () => {
  const page = stripComments(readFileSync(join(import.meta.dirname, 'page.tsx'), 'utf8'));
  const server = stripComments(readFileSync(join(import.meta.dirname, '..', '..', 'lib', 'supplier-today.server.ts'), 'utf8'));
  const view = stripComments(readFileSync(join(import.meta.dirname, '..', '..', 'lib', 'supplier-today-view.ts'), 'utf8'));
  // 🧮 THE SIMPLER TODAY MUST NOT GROW (2026-10-14): the two columns ride ONE shop-row read with the other two
  // single-column reads of the same row (first steps' state · the milestone's date) — every column measured in the
  // production snapshot. A refused read is LOGGED and degrades to "no notice", never to "no credit".
  assert.match(
    server,
    /\.select\('verification_state, in_business_since_date, subscription_credit_php, tier_expires_at'\)/,
    'the credit columns left the one shop-row read',
  );
  assert.match(server, /logQueryError\('supplier-today: shop row'/, 'a failed read is silent');
  assert.match(page, /todayCreditNotice\(\{ creditPhp: shopRow\.creditPhp, tierExpiresAt: shopRow\.tierExpiresAt \}, Date\.now\(\)\)/, 'Today no longer asks the rule');
  // The notice is a ROW under "Also waiting" (S-PR1) — `pickSupplierNext` has no rule for an expiring credit, so it
  // is handed to `supplierWaiting` as a door, drawn whenever it applies, in the prototype's words.
  assert.match(page, /credit: creditNotice && shopRow \? \{ creditPhp: shopRow\.creditPhp, tierExpiresAt: shopRow\.tierExpiresAt, href: creditNotice\.href \} : null,/, 'Today does not hand the credit warning on');
  assert.match(view, /credit: input\.credit \? \{ \.\.\.creditDoorWords\(input\.credit\.creditPhp, input\.credit\.tierExpiresAt\), href: input\.credit\.href \} : null,/, 'the credit warning is not handed to the Also-waiting rows');
  assert.match(view, /doors: waiting\.doors,/, 'the Also-waiting doors are computed and never drawn');
  // …and the row really comes out the other end, whatever the Next card is.
  // SABOTAGE: `if (args.credit)` → `if (args.credit && next.kind === 'clear')` → RED.
  const { supplierWaiting, pickSupplierNext, creditDoorWords } = await import('@/lib/supplier-today');
  const n = todayCreditNotice({ creditPhp: 2500, tierExpiresAt: at(3) }, NOW)!;
  const words = creditDoorWords(2500, at(3));
  assert.equal(words.title, 'Credits expiring');
  assert.match(words.body, /^₱2,500 · \w{3} \d{1,2} \w{3}$/, `the row does not name the amount and the day: ${words.body}`);
  const input = { answer: null, answerSince: null, deskIncomplete: true, upcoming: [], setupStep: null, findability: null, fee: null, owedPhp: null, now: NOW };
  const w = supplierWaiting({
    next: pickSupplierNext(input),
    needsAnswer: [],
    since: () => null,
    setupStep: null,
    findability: null,
    credit: { ...words, href: n.href },
    payout: null,
    now: NOW,
  });
  assert.deepEqual(
    w.doors.map((d) => [d.id, d.label, d.target]),
    [['credit', 'Credits expiring', { to: 'given', href: '/vendor-dashboard/subscription' }]],
    'the credit warning is not a row on Today',
  );
});
