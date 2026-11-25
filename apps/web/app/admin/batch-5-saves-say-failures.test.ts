/**
 * Final check 25 Nov, area 8, batch 5: an admin save that the database refused says so. It never tells the couple,
 * writes an audit row, or shows "Saved" over a write that did not land. Read from comment-stripped source; where a
 * side effect follows a write, the error check must come BEFORE it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const web = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const code = (p: string) => stripComments(readFileSync(resolve(web, p), 'utf8'));
const count = (s: string, n: string) => s.split(n).length - 1;
function before(src: string, a: string, b: string, why: string) {
  const i = src.indexOf(a);
  const j = src.indexOf(b, Math.max(i, 0));
  assert.ok(i >= 0, `missing: ${a}`);
  assert.ok(j > i, why);
}

test('F-6 · editorial review: flag, unlock and re-scan each check their write', () => {
  const src = code('app/admin/editorial-review/[editorialId]/actions.ts');
  for (const e of ['if (flagErr)', 'if (unlockErr)', 'if (rescanErr)']) assert.ok(src.includes(e), `missing ${e}`);
  before(src, 'if (unlockErr)', 'await notifyCoupleEditorialDecision(', 'the couple is told only after the unlock is saved');
});

test('D-9 · event deletions: "Keep it" is saved before the couple is told', () => {
  before(code('app/admin/event-deletions/actions.ts'), 'if (keepErr)', 'emitNotification', 'keepErr is checked first');
});

test('F-7 · user reports: a block with no uploader or a refused block fails, never stamps "blocked"', () => {
  const src = code('app/admin/user-reports/actions.ts');
  assert.ok(src.includes('if (!guestId) throw'), 'no uploader → failure');
  before(src, 'if (blockErr) throw', ".from('user_reports')\n    .update", 'the block is checked before the report closes');
});

test('H-10 · smoke test: a network failure is a failed test, not "fired ✓"', () => {
  const src = code('app/admin/operations-hiring/_components/smoke-test-panel.tsx');
  const sentry = src.slice(src.indexOf('async function runSentryTest'));
  const c = sentry.slice(sentry.indexOf('catch (err)'), sentry.indexOf('finally'));
  assert.ok(c.includes('ok: false'), 'the catch records a failure');
  assert.ok(!c.includes('ok: true'), 'the catch never records success');
});

test('D-10 · face mode: the accounts page shows the saved / refused notice', () => {
  const lib = code('lib/admin/face-mode-notices.ts');
  assert.ok(lib.includes('FACE_MODE_NOTICE') && lib.includes('FACE_MODE_ERROR'));
  const surf = code('app/admin/accounts/_surfaces/events-surface.tsx');
  assert.ok(surf.includes('FormFlash'), 'events surface draws the notice');
});

test('A-10 · payments: a receipt that did not issue is said on approval', () => {
  const src = code('app/admin/payments/actions.ts');
  assert.ok(src.includes("'failed'"), 'issueReceiptForOrder can report failure');
  assert.ok(src.includes('receiptFailed: true'), 'approvePaymentCore passes it on');
  assert.ok(src.includes('receipt did not issue'), 'the admin is told');
});

test('I-1 / I-2 · integrations: saves and clears check their result', () => {
  const src = code('app/admin/integrations/actions.ts');
  assert.ok(count(src, 'save_failed') >= 4, 'four saves redirect on failure');
  assert.ok(count(src, 'clear_failed') >= 4, 'four clears redirect on failure');
  const page = code('app/admin/integrations/page.tsx');
  assert.ok(page.includes('clear_failed') && page.includes('clearedNotice'), 'the page says both');
});

test('H-15 · menus: every nav_slot_override write is checked before its audit row', () => {
  const src = code('app/admin/menus/actions.ts');
  const writes = count(src, "from('nav_slot_override')");
  assert.ok(writes >= 6, `floor: ${writes}`);
  assert.equal(count(src, 'if (writeErr) throw'), writes, 'one check per write');
});

test('E-12 · fraud wipe-ban: a refusal comes back as words, success says it is waiting', () => {
  const act = code('app/admin/fraud/actions.ts');
  assert.ok(act.includes('WipeBanInitResult'));
  assert.ok(count(act, 'ok: false') >= 3, 'three refusals return a message');
  const dlg = code('app/admin/fraud/_components/wipe-ban-dialog.tsx');
  assert.ok(dlg.includes('waiting for a second admin'), 'success is said');
  assert.ok(dlg.includes('refusal'), 'a refusal is shown');
});

test('H-6 · connection logs: a refused resolve reverts and says so', () => {
  const src = code('app/admin/connection-logs/connection-logs-client.tsx');
  assert.ok(src.includes('useToast'));
  assert.ok(count(src, 'toast.error') >= 2, 'resolve and archive both speak on failure');
});

test('B-6 · budget planner: a typo is refused and every save says a failure', () => {
  const act = code('app/admin/budget-planner/actions.ts');
  assert.ok(act.includes('function isTypo'), 'typo detector exists');
  assert.ok(count(act, 'TYPO_ERROR') >= 3, 'used by both price saves');
  assert.ok(act.includes(".select('config_key')"), 'allocation save reads back what changed');
  const page = code('app/admin/budget-planner/page.tsx');
  assert.equal(count(page, 'if (!res.ok) redirect('), 3, 'all three wrappers redirect on failure');
  assert.ok(page.includes('<FormFlash tone="error">'), 'the page says the failure');
});
