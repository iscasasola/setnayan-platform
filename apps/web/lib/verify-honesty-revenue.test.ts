/**
 * verify-honesty-revenue.test.ts — register rows L3, C6 and M16.
 *
 * Three different silences:
 *   · **L3** every signup is auto-confirmed; nothing checks the signer owns the
 *     address, so a typo hands the account to a stranger;
 *   · **C6** seven writes behind two couple actions discarded their errors, so
 *     "removed from your list" could mean nothing happened;
 *   · **M16** the page called Money could not say what had been earned.
 *
 * 🛡 Mutation-checked; every sabotage verified to apply.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { isEmailVerificationRequired } from '@/lib/email-verification';
import { revenueStatement, revenueScopeNote } from '@/lib/admin/revenue-statement';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const readCode = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const count = (s: string, re: RegExp) => (s.match(new RegExp(re.source, 'g')) ?? []).length;

// ── L3 ─────────────────────────────────────────────────────────────────────

// SABOTAGE: gate only one of the two doors → RED.
test('L3 · BOTH auto-confirm doors are gated, not just the obvious one', () => {
  const src = readCode('app/signup/actions.ts');
  assert.equal(
    count(src, /email_confirm: true/),
    2,
    'there are exactly two auto-confirm sites — the main signup and the anon→customer conversion',
  );
  assert.equal(
    count(src, /isEmailVerificationRequired\(\)/),
    2,
    'a bypass left on EITHER door confirms the address just as completely — the one that is missed becomes the way in',
  );
});

// SABOTAGE: default the flag to true → RED.
test('L3 · it ships OFF, so merging changes nothing', () => {
  assert.equal(
    isEmailVerificationRequired(),
    false,
    'the auto-confirm is a DOCUMENTED workaround for Supabase’s spam-foldering auth sender — requiring verification before that sender points at Resend breaks every new signup on the platform',
  );
  const src = readCode('lib/email-verification.ts');
  assert.match(src, /NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION/, 'one named flag, the owner’s to flip');
  // 🪤 THIS ONE READS RAW, AND THAT IS THE POINT. Everywhere else in this work
  // a guard strips comments so it cannot convict the documentation of a fix.
  // Here the subject IS the documentation: the warning that Setnayan's own
  // RESEND_API_KEY is not Supabase Auth's sender is the thing standing between
  // this flag and being flipped early, and it lives in a docblock. Stripping
  // would delete the very evidence being asserted.
  const raw = readFileSync(join(WEB, 'lib/email-verification.ts'), 'utf8');
  assert.match(
    raw,
    /RESEND_API_KEY[\s\S]{0,400}NOT the same thing/i,
    'the docs must keep Setnayan’s own transactional key apart from Supabase Auth’s sender — conflating them is how this gets flipped early',
  );
});

// ── C6 ─────────────────────────────────────────────────────────────────────

// SABOTAGE: drop the error capture from any one write → RED.
test('C6 · no write in the claims actions discards its error', () => {
  const raw = readFileSync(join(WEB, 'app/dashboard/[eventId]/guests/claims/actions.ts'), 'utf8');
  const lines = raw.split('\n');
  const discarded: number[] = [];
  lines.forEach((l, i) => {
    if (!/^\s*await admin(\.from\(|\s*$)/.test(l)) return;
    const w = lines.slice(i, i + 8).join('\n');
    if (/\.(update|delete|insert|upsert)\(/.test(w)) discarded.push(i + 1);
  });
  assert.deepEqual(
    discarded,
    [],
    `writes at line(s) ${discarded.join(', ')} throw their error away — a couple presses "not on our list", the write fails, and the screen says it worked. On this path that leaves a stranger with access to the celebration`,
  );
});

// SABOTAGE: make one failure message generic → RED.
test('C6 · each failure says what DID happen, not just that something did not', () => {
  const src = readCode('app/dashboard/[eventId]/guests/claims/actions.ts');
  for (const phrase of [
    'could not revoke their access',
    'seat could not be released',
    'could not remove them from your list',
  ]) {
    assert.ok(
      src.includes(phrase),
      `missing "${phrase}" — "removal failed" after two of three writes succeeded sends the couple looking for a guest who is half-gone`,
    );
  }
});

// ── M16 ────────────────────────────────────────────────────────────────────

// SABOTAGE: add receiptPhp into netPhp → RED.
test('M16 · receipts are never summed into revenue', () => {
  const s = revenueStatement({
    softwarePhp: 1000, bookingFeePhp: 837.5, refundedPhp: 100,
    receiptCount: 2, receiptPhp: 5000, paidOrderCount: 3, paidFeeCount: 1,
  });
  assert.equal(s.grossPhp, 1837.5, 'gross is software + fees');
  assert.equal(
    s.netPhp,
    1737.5,
    'a receipt is a DOCUMENT about money, not a second receipt of it — summing both double-counts every peso',
  );
  assert.equal(s.unreceiptedOrderCount, 1, 'the gap an accountant asks about');
});

// SABOTAGE: round to the peso → RED.
test('M16 · ₱837.50 never reads ₱838', () => {
  const s = revenueStatement({
    softwarePhp: 0, bookingFeePhp: 837.5, refundedPhp: 0,
    receiptCount: 0, receiptPhp: 0, paidOrderCount: 0, paidFeeCount: 1,
  });
  assert.equal(s.netPhp, 837.5, 'the class of defect that already cost a fix here');
});

// SABOTAGE: return a total with no scope sentence → RED.
test('M16 · the total says what is NOT in it', () => {
  const s = revenueStatement({
    softwarePhp: 10, bookingFeePhp: 0, refundedPhp: 0,
    receiptCount: 0, receiptPhp: 0, paidOrderCount: 2, paidFeeCount: 0,
  });
  const note = revenueScopeNote(s);
  assert.match(note, /NOT added in/i, 'a total with no scope is what sends somebody to the database');
  assert.match(note, /VAT/i, 'VAT 0 is correct and must be stated, not assumed');
  assert.match(note, /2 paid orders? ha(s|ve) no receipt/, 'and the receipt gap is named when it exists');
});

// SABOTAGE: render ₱0 on an unreadable read → RED.
test('M16 · an unreadable figure renders an em-dash, never ₱0', () => {
  const src = readCode('app/admin/money/_components/revenue-summary.tsx');
  assert.match(
    src,
    /unreadable[\s\S]{0,900}mdash/,
    'printing ₱0 when the read failed tells an owner "we have earned nothing" — the most alarming possible false statement on this page',
  );
  assert.match(src, /logQueryError/, 'and the reason must reach the logs');
  assert.match(readCode('app/admin/money/page.tsx'), /<RevenueSummary \/>/, 'it must actually be mounted');
});
