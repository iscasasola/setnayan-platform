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
  movedNotice,
  packLine,
  remedyRefusalCopy,
} from '@/lib/admin/service-remedies';

const WEB = join(__dirname, '..', '..');
const REPO = join(WEB, '..', '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

const MIGRATION = 'supabase/migrations/20271309226989_a_service_they_cannot_use_becomes_credits_or_moves.sql';

test('the pack line names the pack the figure was priced at, and nothing when there is none', () => {
  assert.equal(packLine(3000, 999), '₱999 = 3,000 credits');
  assert.equal(packLine(null, 999), null);
  assert.equal(packLine(3000, 0), null);
});

test('every refusal the SQL can return has plain words, and an unknown one is never shown raw', () => {
  const sql = readFileSync(join(REPO, MIGRATION), 'utf8');
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
  assert.match(c.body, /switched it off/);
  assert.doesNotMatch(c.body, /₱/);
  const m = movedNotice('S89O-ABCDEFGHJK', 'Our wedding');
  assert.match(m.body, /Our wedding/);
  assert.match(movedNotice('S89O-ABCDEFGHJK', null).body, /your next event/);
});

test('the credit figure has ONE home — the SQL, reading the live catalogue — and no box to type it', () => {
  // Owner 2026-11-05: what they paid, at the best-value Papic pack on sale.
  const sql = readFileSync(join(REPO, MIGRATION), 'utf8');
  const fn = sql.slice(sql.indexOf('FUNCTION public.orders_papic_credit_value'), sql.indexOf('REVOKE ALL ON FUNCTION public.orders_papic_credit_value'));
  assert.match(fn, /platform_retail_catalog_v2/, 'priced from the admin-managed catalogue');
  assert.match(fn, /papic_pass_tiers/);
  assert.match(fn, /ORDER BY \(t\.points::NUMERIC \/ c\.retail_price_php\) DESC/, 'the best-value pack: most credits per peso');
  assert.doesNotMatch(fn.replace(/--[^\n]*/g, ''), /\b(999|3000|3,000)\b/, 'no pack price or size is typed into the rule');

  const page = read('app/admin/payments/page.tsx');
  const block = page.slice(page.indexOf('function ServiceRemedyForms'), page.indexOf('function RefundForm'));
  assert.ok(block.length > 200, 'ServiceRemedyForms is gone');
  assert.doesNotMatch(block, /name="papic_credits"/, 'the admin types no number');
  assert.match(block, /name="expected_credits"/, 'the page posts the figure it showed, so a moved price is refused');

  const server = read('lib/admin/service-remedies.server.ts');
  assert.match(server, /orders_papic_credit_value/, 'the desk reads the SAME function the conversion grants from');
});

test('converting switches the service off — the order becomes lapsed, and the stored flags are re-derived', () => {
  const sql = readFileSync(join(REPO, MIGRATION), 'utf8');
  const fn = sql.slice(sql.indexOf('FUNCTION public.admin_convert_order_to_papic_credits'), sql.indexOf('REVOKE ALL ON FUNCTION public.admin_convert_order_to_papic_credits'));
  assert.match(fn, /SET status = 'lapsed'/);
  const server = read('lib/admin/service-remedies.server.ts');
  const convert = server.slice(server.indexOf('export async function convertOrderToPapicCredits'), server.indexOf('export async function moveOrderToNextEvent'));
  assert.match(convert, /rederiveStoredEventFlags\(/, 'Setnayan AI is a stored flag; the status alone does not clear it');
});

test('the Money page still counts a switched-off (lapsed) order as revenue — nothing was sent back', () => {
  const src = read('app/admin/money/_components/revenue-summary.tsx');
  assert.match(src, /\.in\('status', \['paid', 'fulfilled', 'lapsed'\]\)/);
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
  assert.match(server, /rederiveStoredEventFlags/);
});
