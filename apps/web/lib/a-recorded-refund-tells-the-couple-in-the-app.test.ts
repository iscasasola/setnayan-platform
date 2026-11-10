/**
 * a-recorded-refund-tells-the-couple-in-the-app.test.ts — Supplier Build 2 leftover (b), 2026-11-09.
 *
 * When a supplier records a refund (Clients › event › Payment › Record a refund), the couple is TOLD — in the app,
 * never by email (owner 2026-10-11: no new emails without his word). Three halves, each pinned:
 *   · the action emits `client_refund_recorded` only for a NEW row (a double tap's repeat tells nobody twice);
 *   · the type exists in the database (the migration that adds the enum value);
 *   · it is declared app_only and is NOT on the email allowlist.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { COUPLE_SUPPLIER_NOTICES } from '@/lib/couple-supplier-notices';

const WEB = join(import.meta.dirname, '..');
const action = stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/messages/[threadId]/pay-confirm-actions.ts'), 'utf8'));

test('the refund action tells the couple only for a new row', () => {
  const body = action.slice(action.indexOf('export async function recordClientRefund('));
  assert.match(body, /if \(!env\.repeat && env\.event_id\) \{\s*await tellTheCoupleOfARefund\(/, 'the couple notice is not gated on a NEW row');
  const tell = action.slice(action.indexOf('async function tellTheCoupleOfARefund('));
  assert.match(tell, /type: 'client_refund_recorded'/);
  assert.match(tell, /\.eq\('member_type', 'couple'\)/, 'the notice must go to the couple');
});

test('the notice type exists in the database', () => {
  const dir = join(WEB, '..', '..', 'supabase', 'migrations');
  const hit = readdirSync(dir).some((f) => f.endsWith('.sql') && /ADD VALUE IF NOT EXISTS 'client_refund_recorded'/.test(readFileSync(join(dir, f), 'utf8')));
  assert.ok(hit, 'no migration adds client_refund_recorded to notification_type — the INSERT would be refused in silence');
});

test('it is in-app only — not on the email allowlist', () => {
  assert.equal(COUPLE_SUPPLIER_NOTICES.client_refund_recorded.reach, 'app_only');
  const emit = stripComments(readFileSync(join(WEB, 'lib/notification-emit.ts'), 'utf8'));
  const allow = emit.slice(emit.indexOf('const EMAIL_ENABLED_TYPES'), emit.indexOf(']);', emit.indexOf('const EMAIL_ENABLED_TYPES')));
  assert.ok(allow.length > 100, 'could not find the email allowlist');
  assert.doesNotMatch(allow, /'client_refund_recorded'/, 'the refund notice was put on the email allowlist');
});
