/**
 * A FREE-FEE WINDOW NEEDS ITS REASON TO OPEN — NOT TO CLOSE.
 *
 * ⚖ DECISION_LOG 2026-09-23, money switch #3, verbatim: *"A PROMOTION CARRIES A
 * REASON, AND IT IS REQUIRED TO OPEN A WINDOW (not to close one). In a year the
 * audit row shows money was waived for three weeks; without it, not why."*
 *
 * Two halves, both checked:
 *   1. the rule — `freeFeeWindowReason` refuses an open window with no reason,
 *      lets a closing save through and clears the reason to null;
 *   2. the wiring — `saveLaunchOffer`'s `window` intent runs that rule BEFORE
 *      the write and records the reason in `admin_audit_log.reason` (admins
 *      alone can read it); a reason that failed to record is said, not hidden;
 *      the page reads it back from the audit log; the form posts it;
 *   3. the reason never becomes a `platform_settings` column, which every
 *      signed-in user can read (review 2026-10-23).
 *
 * SABOTAGE (2026-10-23): make the rule return `{ ok: true, reason: null }` for
 * every input → RED (3 cases); pass no reason to the window's audit call → RED
 * (wiring); add `booking_fee_free_reason: why.reason` to the update → RED (🔒).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FREE_FEE_REASON_MAX, freeFeeWindowReason } from './launch-offer';

const OPEN = { from: '2026-11-01T00:00:00.000Z', until: '2026-11-21T15:59:00.000Z' };

test('opening a window with no reason is refused', () => {
  for (const raw of ['', '   ', '\n\t']) {
    const r = freeFeeWindowReason(OPEN, raw);
    assert.equal(r.ok, false, `blank reason ${JSON.stringify(raw)} must be refused`);
  }
  // Either date alone opens a window too.
  assert.equal(freeFeeWindowReason({ from: OPEN.from, until: null }, '').ok, false);
  assert.equal(freeFeeWindowReason({ from: null, until: OPEN.until }, '').ok, false);
});

test('opening a window with a reason stores it, trimmed', () => {
  const r = freeFeeWindowReason(OPEN, '  Sinulog week — nudge Cebu suppliers  ');
  assert.deepEqual(r, { ok: true, reason: 'Sinulog week — nudge Cebu suppliers' });
});

test('a reason longer than the SQL check allows is refused, not cut', () => {
  assert.equal(freeFeeWindowReason(OPEN, 'x'.repeat(FREE_FEE_REASON_MAX)).ok, true);
  assert.equal(freeFeeWindowReason(OPEN, 'x'.repeat(FREE_FEE_REASON_MAX + 1)).ok, false);
});

test('closing a window needs no reason and clears it', () => {
  assert.deepEqual(freeFeeWindowReason({ from: null, until: null }, ''), { ok: true, reason: null });
  assert.deepEqual(freeFeeWindowReason({ from: null, until: null }, 'left over'), { ok: true, reason: null });
});

test('the admin door runs the rule before it writes, and records the reason in the audit row', () => {
  const dir = join(process.cwd(), 'app/admin/launch-offer');
  const actions = readFileSync(join(dir, 'actions.ts'), 'utf8');
  const windowArm = actions.slice(actions.indexOf("intent === 'window'"));
  assert.ok(windowArm.length < actions.length, "saveLaunchOffer has no `intent === 'window'` arm");
  const ruleAt = windowArm.indexOf('freeFeeWindowReason(');
  const writeAt = windowArm.indexOf(".from('platform_settings').update(");
  assert.ok(ruleAt > 0, 'the window arm does not call freeFeeWindowReason');
  assert.ok(writeAt > ruleAt, 'the reason rule must run BEFORE the platform_settings write');
  assert.match(windowArm.slice(0, writeAt), /if \(!why\.ok\) return/, 'a refused reason must stop the save');
  assert.match(
    windowArm,
    /audit\('booking_fee_free_window_edit', update, why\.reason\)/,
    'the reason must reach the admin_audit_log row',
  );
  assert.match(actions, /\.from\('admin_audit_log'\)\.insert\(\{[^}]*\breason,/, 'the audit insert does not store the reason');
  assert.match(windowArm, /if \(!recorded && why\.reason\)/, 'a reason that failed to record must not read as "saved"');

  const page = readFileSync(join(dir, 'page.tsx'), 'utf8');
  assert.match(page, /from\('admin_audit_log'\)\s*\.select\('reason'\)/, 'the page must read the reason back from the audit log');
  const form = readFileSync(join(dir, 'launch-offer-form.tsx'), 'utf8');
  assert.match(form, /name="booking_fee_free_reason"/, 'the form must post the reason');
});

test('🔒 signed-in users cannot read the reason — it is never a platform_settings column', () => {
  /*
    Review 2026-10-23: `platform_settings` is SELECT-able by every signed-in user
    (table-level grant, re-stated by every migration that touches it), so the
    reason must not live there. Its only home is `admin_audit_log.reason`, whose
    read policy admits admins alone.
  */
  const actions = readFileSync(join(process.cwd(), 'app/admin/launch-offer/actions.ts'), 'utf8');
  assert.doesNotMatch(actions, /booking_fee_free_reason:/, 'the action writes the reason into platform_settings');
  const migrations = join(process.cwd(), '../../supabase/migrations');
  const adds = readdirSync(migrations)
    .filter((f) => f.endsWith('.sql'))
    .filter((f) => /booking_fee_free_reason/.test(readFileSync(join(migrations, f), 'utf8')));
  assert.deepEqual(adds, [], 'a migration puts the reason on platform_settings, where every signed-in user can read it');
});
