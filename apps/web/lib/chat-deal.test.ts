/**
 * 🤝 THE DEAL, IN NUMBERS (owner 19 Nov 2026, DECISION_LOG "THE CLIENT PAGE IS ONE CHAT THAT HOLDS EVERYTHING" — the
 * negotiation tools; drawing S9ScH2Ps v3, screens 7 · 9).
 *
 * What would silently undo it:
 *   1. "their ask" picks the wrong ask — an expired one, the supplier's own, a plan, an answered one, or one whose
 *      amount this reader may not see;
 *   2. the gap says a figure when there is none (their total at or above yours);
 *   3. the lowest warns when no lowest is set, when no price is typed, or AT the lowest (only UNDER it);
 *   4. the private lowest becomes readable by the hosts (a host policy on its table), or a default sneaks in.
 *
 * SABOTAGE (19 Nov 2026, each seen RED then restored): the expiry filter removed (1) · `gap <= 0` → `gap < 0` (2) ·
 * `totalCentavos < lowestCentavos` → `<=` (3) · a `…_host_read` policy added to the migration (4).
 *
 * Run: cd apps/web && npx tsx --test lib/chat-deal.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gapWords, theirOpenAsk, type DealAsk } from './chat-deal';
import { isUnderLowest } from '@/app/_components/chat/cards/lowest-calls';
import { stripComments } from './strip-comments';

const ask = (o: Partial<DealAsk> & { askedAt: string }): DealAsk => ({ status: 'open', raisedBy: 'host', kind: 'counter', amountCentavos: 4_000_000, goodUntil: null, ...o });

test('1 · their ask is the hosts’ newest OPEN counter that has not expired', () => {
  const today = '2026-11-23';
  const a = ask({ askedAt: '2026-11-20T01:00:00Z', amountCentavos: 3_900_000 });
  const b = ask({ askedAt: '2026-11-22T01:00:00Z', amountCentavos: 4_000_000, goodUntil: '2026-11-24' });
  assert.equal(theirOpenAsk([a, b], today), b);
  assert.equal(theirOpenAsk([a, { ...b, goodUntil: '2026-11-22' }], today), a, 'an expired ask is not their ask');
  assert.equal(theirOpenAsk([{ ...b, status: 'declined' }], today), null);
  assert.equal(theirOpenAsk([{ ...b, status: 'countered' }], today), null);
  assert.equal(theirOpenAsk([{ ...b, raisedBy: 'supplier' }], today), null, 'the supplier’s own counter is not THEIR ask');
  assert.equal(theirOpenAsk([{ ...b, kind: 'plan', amountCentavos: null }], today), null);
  assert.equal(theirOpenAsk([{ ...b, kind: 'words', amountCentavos: null }], today), null);
  assert.equal(theirOpenAsk([{ ...b, moneyHidden: true }], today), null, 'a reader who may not see the amount is not shown one');
  assert.equal(theirOpenAsk([], today), null);
});

test('2 · "You are ₱5,000 apart · 11%" — and no gap when there is none', () => {
  assert.deepEqual(gapWords(4_500_000, 4_000_000), { amount: '₱5,000', percent: '11%' });
  assert.equal(gapWords(4_500_000, 4_500_000), null);
  assert.equal(gapWords(4_500_000, 4_600_000), null);
  assert.equal(gapWords(0, 0), null);
});

test('3 · the lowest warns only UNDER it — never unset, never unread, never at it', () => {
  assert.equal(isUnderLowest(4_250_000, 4_200_000), true);
  assert.equal(isUnderLowest(4_250_000, 4_250_000), false, 'AT the lowest is not under it');
  assert.equal(isUnderLowest(4_250_000, 4_500_000), false);
  assert.equal(isUnderLowest(null, 4_200_000), false, 'no lowest set — no line');
  assert.equal(isUnderLowest(4_250_000, 0), false, 'no price typed — no line');
});

test('3 · the line is one quiet line: it never disables Send, and the hosts’ counter is never checked against it', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const cards = (f: string) => stripComments(readFileSync(join(here, '..', 'app/_components/chat/cards', f), 'utf8'));
  const nego = cards('negotiate-cards.tsx');
  assert.match(nego, /\{viewer === 'vendor' && cents > 0 \? <UnderLowestLine threadId=\{threadId\} totalCentavos=\{out\.newTotalCentavos\} \/> : null\}/, 'the counter does not check the supplier’s lowest — or checks it for the hosts');
  assert.match(nego, /<SendRow label="Send counter" busy=\{busy\} ok=\{cents > 0 && !out\.refusal\}/, 'Send counter now depends on something else — the lowest must never block');
  const line = cards('lowest-price.tsx');
  assert.doesNotMatch(line, /disabled|ConfirmDialog|window\.confirm|Sheet\b/, 'the lowest line grew a block or a pop-up');
  assert.match(line, /if \(state\.at !== 'ok' \|\| !isUnderLowest\(state\.centavos, totalCentavos\)\) return null;/, 'an unread lowest draws a line (or a set one does not)');
  for (const f of ['quote-step-card.tsx', 'make-quote-card.tsx']) assert.match(cards(f), /<UnderLowestLine threadId=\{threadId\} totalCentavos=\{/, `${f}: a new quote under the lowest says nothing`);
});

test('4 · the lowest is private by the DATABASE: shop team only, no host policy, no default, nothing for the signed-out', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const sql = readFileSync(join(here, '..', '..', '..', 'supabase/migrations/20271351728770_the_suppliers_lowest_price_is_private.sql'), 'utf8')
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n');
  assert.match(sql, /ALTER TABLE public\.vendor_proposal_lowest ENABLE ROW LEVEL SECURITY;/);
  const policies = [...sql.matchAll(/CREATE POLICY (\w+)/g)].map((m) => m[1]);
  assert.deepEqual(policies, ['vendor_proposal_lowest_org_all'], 'a second policy on the private lowest — who else can read it?');
  assert.match(sql, /USING \(vendor_profile_id IN \(SELECT public\.current_vendor_profile_ids\(\)\)\)\s+WITH CHECK \(vendor_profile_id IN \(SELECT public\.current_vendor_profile_ids\(\)\)\);/);
  assert.doesNotMatch(sql, /current_couple_event_ids|current_moderator_event_ids|is_admin\(/, 'the hosts or an admin gained a way to the supplier’s lowest');
  assert.match(sql, /REVOKE ALL ON public\.vendor_proposal_lowest FROM anon;/);
  assert.match(sql, /lowest_centavos\s+BIGINT NOT NULL CHECK \(lowest_centavos > 0\)/, 'the number lost its "typed, positive" rule');
  assert.doesNotMatch(sql, /lowest_centavos[^,\n]*DEFAULT/, 'the lowest gained a default — it is the supplier’s own number, never guessed');
  assert.match(sql, /updated_by\s+UUID REFERENCES auth\.users\(id\) ON DELETE SET NULL/);
});

test('5 · ONE rule for their ask, both places (review F6): a one-line counter is shown as the TOTAL it makes', async () => {
  const { theirAskTotalCentavos, dealAskOf } = await import('./chat-deal');
  const quote = { totalCentavos: 4_500_000, lines: [
    { key: 'l0', label: 'Grazing table', detail: null, amountCentavos: 3_800_000 },
    { key: 'l1', label: 'Dessert bar', detail: null, amountCentavos: 700_000 },
  ] };
  const total = ask({ askedAt: '2026-11-20T00:00:00Z', amountCentavos: 4_000_000 });
  assert.equal(theirAskTotalCentavos(total, quote), 4_000_000);
  const line = ask({ askedAt: '2026-11-20T00:00:00Z', amountCentavos: 500_000, scopeLabel: 'dessert bar' });
  assert.equal(theirAskTotalCentavos(line, quote), 4_300_000, 'a counter on one line is not the total');
  assert.equal(theirAskTotalCentavos({ ...line, scopeLabel: 'Lights' }, quote), null, 'a line no longer on the quote makes no total');
  const row = dealAskOf({ asked_at: 'x', status: 'open', amount_centavos: '4000000', scope_label: null, good_until: null, raised_by: null, proposed_plan: null });
  assert.equal(row.kind, 'counter');
  assert.equal(row.raisedBy, 'host');
  // The client page picks with the shared rule — no second, inline picker.
  const PAGE = stripComments(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'app/vendor-dashboard/clients/[eventId]/page.tsx'), 'utf8'));
  assert.match(PAGE, /theirOpenAsk\(stripAsks, stripToday\)/);
  assert.doesNotMatch(PAGE, /stripAsks\?\.find\(/, 'a second picker for their ask is back on the client page');
});
