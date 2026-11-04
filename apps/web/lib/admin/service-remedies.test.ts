/**
 * The pure half of "Convert to Papic credits" / "Move to their next event"
 * (lib/admin/service-remedies.ts) — and the wiring that keeps the money rules
 * honest: no rate anywhere, the intents ride the existing refund export, every
 * SQL refusal has words, and the notices are in-app only.
 *
 * Run: cd apps/web && npx tsx --test lib/admin/service-remedies.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  REMEDY_REFUSAL_COPY,
  creditsNotice,
  maxCreditsForPaid,
  movedNotice,
  packsLine,
  parseCredits,
  remedyRefusalCopy,
} from '@/lib/admin/service-remedies';

const WEB = join(__dirname, '..', '..');
const REPO = join(WEB, '..', '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

// The three packs on the 2026-11-04 price sheet, as the live ladder returns them.
const LADDER = [
  { credits: 150, priceCentavos: 9_900 },
  { credits: 1_000, priceCentavos: 49_900 },
  { credits: 3_000, priceCentavos: 99_900 },
];

test('parseCredits takes a whole number above zero and nothing else', () => {
  assert.equal(parseCredits('1500'), 1500);
  assert.equal(parseCredits(' 1,500 '), 1500);
  for (const bad of ['0', '-5', '1.5', 'abc', '', '1e3', null, undefined, 12]) {
    assert.equal(parseCredits(bad), null, `accepted ${String(bad)}`);
  }
});

test('the bound is what the payment buys at the cheapest per-credit pack, never more', () => {
  // ₱999 buys exactly the 3,000 pack.
  assert.equal(maxCreditsForPaid(99_900, LADDER), 3_000);
  // ₱3,360 at the 3,000-pack rate.
  assert.equal(maxCreditsForPaid(336_000, LADDER), Math.floor((336_000 * 3_000) / 99_900));
  assert.equal(maxCreditsForPaid(0, LADDER), 0);
  // An unreadable catalogue gives NO bound, so the action refuses.
  assert.equal(maxCreditsForPaid(99_900, []), null);
  assert.equal(maxCreditsForPaid(99_900, null), null);
});

test('the packs line reads the live ladder, and is null when there is none', () => {
  assert.equal(packsLine(LADDER), '₱99 = 150 · ₱499 = 1,000 · ₱999 = 3,000');
  assert.equal(packsLine([]), null);
});

test('every refusal the SQL can return has plain words, and an unknown one is never shown raw', () => {
  const sql = readFileSync(
    join(REPO, 'supabase/migrations/20271309226989_a_service_they_cannot_use_becomes_credits_or_moves.sql'),
    'utf8',
  );
  const codes = new Set([...sql.matchAll(/'refusal', '([a-z_]+)'/g)].map((m) => m[1]!));
  for (const c of sql.matchAll(/THEN '([a-z_]+)'/g)) codes.add(c[1]!);
  assert.ok(codes.size >= 10, `found only ${codes.size} refusal codes — the scan went blind`);
  for (const c of codes) {
    assert.ok(c in REMEDY_REFUSAL_COPY, `SQL refusal '${c}' has no words in REMEDY_REFUSAL_COPY`);
  }
  assert.equal(remedyRefusalCopy('not_owner'), REMEDY_REFUSAL_COPY.not_owner);
  assert.doesNotMatch(remedyRefusalCopy('some_new_code'), /some_new_code/);
});

test('the couple\'s notices name what happened, never a rate or a peso figure', () => {
  const c = creditsNotice('S89O-ABCDEFGHJK', 1500);
  assert.match(c.title, /1,500 Papic credits/);
  assert.doesNotMatch(c.body, /₱/);
  const m = movedNotice('S89O-ABCDEFGHJK', 'Our wedding');
  assert.match(m.body, /Our wedding/);
  assert.match(movedNotice('S89O-ABCDEFGHJK', null).body, /your next event/);
});

test('no conversion rate is written in the code — the admin types the number', () => {
  const page = read('app/admin/payments/page.tsx');
  const block = page.slice(page.indexOf('function ServiceRemedyForms'), page.indexOf('function RefundForm'));
  assert.ok(block.length > 200, 'ServiceRemedyForms is gone');
  const creditBox = block.slice(block.indexOf('name="papic_credits"'), block.indexOf('/>', block.indexOf('name="papic_credits"')));
  assert.doesNotMatch(creditBox, /defaultValue|value=/, 'the credit box must not be pre-filled — no rate is ruled');
});

test('both intents ride the existing refundOrder export (the server-action budget is at its ceiling)', () => {
  const actions = read('app/admin/payments/actions.ts');
  assert.match(actions, /intent === 'convert_to_papic_credits' \|\| intent === 'move_to_next_event'/);
  assert.doesNotMatch(actions, /export async function (convert|move)\w*/);
  const page = read('app/admin/payments/page.tsx');
  assert.match(page, /name="intent" value="convert_to_papic_credits"/);
  assert.match(page, /name="intent" value="move_to_next_event"/);
});

test('the two notices are in-app only — not on the email allowlist', () => {
  const emit = read('lib/notification-emit.ts');
  assert.doesNotMatch(emit, /service_became_credits|service_moved_to_event/);
});

test('a move never runs the REVERSAL path, which would delete the moved Papic credits', () => {
  const server = read('lib/admin/service-remedies.server.ts');
  assert.doesNotMatch(server, /deactivateOrderSku/);
  assert.match(server, /rederiveEventFlagsAfterMove/);
});
