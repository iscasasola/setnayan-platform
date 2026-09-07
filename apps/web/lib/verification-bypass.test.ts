/**
 * verification-bypass.test.ts
 *
 * The owner ruled that a vouched-for shop wears the SAME badge as a
 * document-verified one, and that there is NO CAP on how many may be live.
 * Both were his calls, made explicitly. The consequence is that **the deadline
 * is the only thing holding the badge honest** — so these tests are mostly
 * about the deadline being impossible to soften by accident.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BYPASS_URGENT_DAYS,
  BYPASS_WINDOW_DAYS,
  bypassExpiryFrom,
  bypassNoticeForVendor,
  bypassState,
  mustWithdraw,
} from './verification-bypass';

const NOW = new Date('2026-09-07T00:00:00.000Z');
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

test('a shop with no bypass has no state to report', () => {
  assert.deepEqual(bypassState({ expiresAt: null, documentsApproved: false }, NOW), { kind: 'none' });
});

test('the window is six months, and a grant today expires then', () => {
  assert.equal(BYPASS_WINDOW_DAYS, 182);
  const iso = bypassExpiryFrom(NOW);
  const days = Math.round((Date.parse(iso) - NOW.getTime()) / 86_400_000);
  assert.equal(days, 182);
});

test('an active bypass counts down, and turns urgent inside 30 days', () => {
  const far = bypassState({ expiresAt: inDays(100), documentsApproved: false }, NOW);
  assert.equal(far.kind === 'active' && far.urgent, false);
  const near = bypassState({ expiresAt: inDays(BYPASS_URGENT_DAYS - 1), documentsApproved: false }, NOW);
  assert.equal(near.kind === 'active' && near.urgent, true);
});

test('🔑 documents approved WINS over the clock — a bridge crossed is not a bridge failed', () => {
  // A supplier who completed verification inside the window must never be
  // withdrawn because a stale expires_at was left on the row.
  const past = { expiresAt: inDays(-40), documentsApproved: true };
  assert.equal(bypassState(past, NOW).kind, 'satisfied');
  assert.equal(mustWithdraw(past, NOW), false);
});

test('🔑 the deadline passes and the listing must be withdrawn', () => {
  const facts = { expiresAt: inDays(-1), documentsApproved: false };
  const s = bypassState(facts, NOW);
  assert.equal(s.kind, 'expired');
  assert.equal(mustWithdraw(facts, NOW), true);
});

test('an unparseable deadline never withdraws a live listing', () => {
  // Absence of a usable date is absence of a deadline. Reading garbage as
  // "expired" would take a real shop off the marketplace over a bad string.
  const facts = { expiresAt: 'not-a-date', documentsApproved: false };
  assert.equal(bypassState(facts, NOW).kind, 'none');
  assert.equal(mustWithdraw(facts, NOW), false);
});

test('the vendor is told from day one, not at day 175', () => {
  const early = bypassNoticeForVendor(bypassState({ expiresAt: inDays(170), documentsApproved: false }, NOW));
  assert.ok(early && /170 days left/.test(early), `day-one notice missing: ${early}`);
  const late = bypassNoticeForVendor(bypassState({ expiresAt: inDays(5), documentsApproved: false }, NOW));
  assert.ok(late && /due in 5 days/.test(late), `urgent notice missing: ${late}`);
  assert.ok(late && /stops showing to couples/.test(late), 'the consequence is not stated');
});

test('a satisfied or absent bypass says nothing to the vendor', () => {
  assert.equal(bypassNoticeForVendor({ kind: 'satisfied' }), null);
  assert.equal(bypassNoticeForVendor({ kind: 'none' }), null);
});

test('🔑 nothing here produces a COUPLE-facing label — the badge is the same', () => {
  // Owner, asked directly whether a couple should see a difference: "just same."
  // If a public label ever appears in this module, that ruling has been quietly
  // reversed in code rather than by a decision.
  // ⚠ `stripComments` from lib/strip-comments.ts — NOT a two-replace regex of
  // this file's own. A private stripper takes BLOCK comments first, so a line
  // comment containing `*/`-adjacent text opens a comment that closes at the
  // next real `*/` and blanks everything between; the guard then asserts
  // against a blank and passes. `lint-one-comment-stripper.mjs` fails on any
  // new one, and it failed on this one.
  const text = stripComments(
    readFileSync(resolve(HERE2, 'verification-bypass.ts'), 'utf8'),
  );
  assert.ok(
    !/(Vouched|Provisional|Pending documents|Trial|Unverified badge)/i.test(text),
    'a couple-facing distinction crept into the bypass module',
  );
});

/* ── THE SOURCE HALF ─────────────────────────────────────────────────────────
   The pure rules above pass whether or not anything calls them. These read the
   action file, which is where the two owner rulings could quietly be undone. */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE2 = dirname(fileURLToPath(import.meta.url));
const ACTIONS = stripComments(
  readFileSync(resolve(HERE2, '../app/admin/vendors/verification-bypass-actions.ts'), 'utf8'),
);
const MIGRATION = (() => {
  const dir = resolve(HERE2, '../../../supabase/migrations');
  const fs = require('node:fs') as typeof import('node:fs');
  const f = fs.readdirSync(dir).find((n: string) => n.includes('vendor_verification_bypass'));
  assert.ok(f, 'the bypass migration is gone');
  return fs.readFileSync(resolve(dir, f!), 'utf8');
})();

/**
 * SQL with `--` comments removed. The first draft of the no-grant guard below
 * matched the migration's OWN comment — the line explaining that these columns
 * must not be granted — and passed while asserting nothing. Fifth time in one
 * day a guard here read prose instead of code.
 */
const MIGRATION_SQL = MIGRATION.replace(/--[^\n]*/g, '');

test('source · a grant sets verification AND visibility together', () => {
  // Setting one without the other recreates the verified-but-hidden dead end
  // this feature exists to close.
  const i = ACTIONS.indexOf('grantVerificationBypass');
  const body = ACTIONS.slice(i, ACTIONS.indexOf('export async function revokeVerificationBypass'));
  assert.match(body, /verification_state: 'verified'/, 'the grant does not verify');
  assert.match(body, /public_visibility: 'verified'/, 'the grant does not list — the shop stays hidden');
});

test('source · a grant demands a stated reason', () => {
  assert.match(ACTIONS, /reason\.length < 8/, 'a bypass can be granted with no reason');
});

test('source · every path writes an audit row', () => {
  const actions = ACTIONS.match(/admin_audit_log/g) ?? [];
  assert.ok(actions.length >= 3, `grant, revoke and expiry must each audit — found ${actions.length}`);
});

test('🔑 source · the sweep asks the SAME pure rule the vendor countdown reads', () => {
  assert.match(ACTIONS, /mustWithdraw\(/, 'the sweep hand-rolls its own expiry test');
  assert.ok(
    !/new Date\(\)\s*>\s*new Date\(/.test(ACTIONS),
    'the sweep compares dates itself — it can then disagree with what the vendor was shown',
  );
});

test('🔑 source · no cron. The sweep is a function, not a schedule', () => {
  assert.ok(
    !/(cron|schedule|setInterval)/i.test(ACTIONS),
    'a scheduler crept in — owner-locked 2026-05-14: DB state + on-access checks only',
  );
});

test('🔑 migration · the vouch lives in its OWN table, granted to nobody', () => {
  // The first draft added five columns to `vendor_profiles`. exposure-freeze
  // refused it and was right: a NEW COLUMN INHERITS THE TABLE'S GRANTS, and
  // vendor_profiles grants SELECT+INSERT+UPDATE to `authenticated` — so a
  // vendor could have pushed their own deadline into the future and never lost
  // the badge. A column-level REVOKE against a table grant is a no-op, so the
  // columns could not be closed where they stood.
  assert.match(MIGRATION_SQL, /CREATE TABLE IF NOT EXISTS public\.vendor_verification_bypasses/i);
  assert.match(MIGRATION_SQL, /ENABLE ROW LEVEL SECURITY/i, 'RLS is not enabled at create time');
  assert.ok(
    !/ALTER TABLE public\.vendor_profiles[\s\S]{0,200}verification_bypass/i.test(MIGRATION_SQL),
    'the bypass fields are back on vendor_profiles, where they inherit its UPDATE grant',
  );
  assert.ok(
    !/CREATE POLICY[\s\S]{0,200}vendor_verification_bypasses/i.test(MIGRATION_SQL),
    'a policy was added — this table is service-role only by design',
  );
});

test('🔑 migration · nothing is granted on the bypass table', () => {
  // A couple must not be able to tell a vouched-for shop from a verified one —
  // that is the owner's "same badge" ruling, and a stray GRANT would leak it.
  // Real GRANT *statements* only. `/GRANT/i` also matches the substring inside
  // `verification_bypass_GRANTed_at`, so the first two drafts of this guard
  // asserted nothing — once against a comment, once against a column name.
  const grants = MIGRATION_SQL.split(';')
    .map((st) => st.trim())
    .filter((st) => /^GRANT\s+[A-Z]/i.test(st));
  const leaky = grants.filter((st) => /vendor_verification_bypasses|verification_bypass/i.test(st));
  assert.deepEqual(
    leaky,
    [],
    'the migration grants a bypass column — a couple could then tell a ' +
      'vouched-for shop from a verified one, reversing the owner ruling in code',
  );
  assert.match(MIGRATION_SQL, /expires_at/, 'the deadline column is gone');
});

test('migration · the deadline is indexed, because the sweep runs on live traffic', () => {
  assert.match(MIGRATION_SQL, /CREATE INDEX[\s\S]{0,200}expires_at/i);
});

test('🔑 migration · the table is explicitly REVOKED — "no grant" is not closed', () => {
  // A new table in `public` does NOT arrive closed: Supabase's default
  // privileges hand anon and authenticated SELECT+INSERT+UPDATE on creation.
  // Measured: with no REVOKE, exposure-freeze reported `anon=SIU
  // authenticated=SIU` on all five columns of a table this very migration
  // described as "granted to nobody". Writing no GRANT is not the same as
  // granting nothing.
  assert.match(
    MIGRATION_SQL,
    /REVOKE ALL ON public\.vendor_verification_bypasses FROM[^;]*anon[^;]*authenticated/i,
    'the bypass table is not explicitly revoked — it is therefore world-writable',
  );
});
