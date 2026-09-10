/**
 * A HOST CAN SHARE, AND TAKE BACK, A COORDINATOR'S ACCESS.
 *
 * 🔴 WHAT WAS WRONG, measured in production by the object on 2026-09-09:
 * `event_moderators` had RLS enabled, FIVE LIVE ROWS, and exactly ONE policy —
 * `event_moderators_select_own_events` [r], SELECT only — while `authenticated`
 * held INSERT, UPDATE and DELETE grants with nothing behind them. Granting threw
 * 42501 at the host as a raw Postgres sentence; REVOKING matched zero rows and
 * returned `error: null`, so the action's `if (error)` never fired and it
 * reported success. A host who took the guest list back kept handing it over.
 *
 * 🔑 A REFUSED WRITE IS NOT A THROWN ERROR. An UPDATE with no matching policy is
 * an update of nothing, not a failure. Same family as the phantom column, the
 * phantom enum value, the phantom RPC argument and the blocked iframe — refused,
 * not thrown, and the only symptom is an absence. Both halves are pinned here:
 * the policies that let the write land, and the app no longer believing
 * `error === null` means it changed something.
 *
 * ⚠ WHAT THIS FILE DOES **NOT** PROVE. It reads the migration TEXT and the
 * action SOURCE. It does not execute a policy against a real session, so it
 * cannot prove the runtime outcome — only that the rule written down is the
 * right rule and that the app stops trusting silence. A runtime proof needs a
 * session-scoped role in the replay; it is NOT done here and is named in the PR.
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const WEB = join(import.meta.dirname, '..');
const REPO = join(WEB, '..', '..');
const ACTIONS = join(WEB, 'app', 'dashboard', '[eventId]', 'access-requests', 'actions.ts');
const read = (p: string) => readFileSync(p, 'utf8');

function migration(): string {
  const dir = join(REPO, 'supabase', 'migrations');
  const hits = readdirSync(dir).filter((f) => f.endsWith('_a_host_can_take_access_back.sql'));
  assert.equal(hits.length, 1, `expected one migration, found ${hits.length}`);
  return read(join(dir, hits[0] as string));
}

/**
 * Strip SQL comments before matching. This migration EXPLAINS the wrong helper
 * by name, in prose, as the thing not to use — so a raw-source match would
 * report the very defect it exists to prevent. This repo has been bitten by a
 * guard going red on the comment explaining its own fix.
 */
const body = (src: string) =>
  src.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n');

test('the host gets all three writes back, and each is scoped', () => {
  const sql = body(migration());
  for (const cmd of ['INSERT', 'UPDATE', 'DELETE']) {
    assert.match(sql, new RegExp(`FOR ${cmd}\\b`), `no ${cmd} policy — that write is still refused`);
  }
  // An UPDATE needs BOTH: USING says which rows it may touch, WITH CHECK says
  // what they may become. USING alone lets a host move a row onto a celebration
  // they do not host.
  const upd = sql.slice(sql.indexOf('FOR UPDATE'));
  assert.match(upd, /USING\s*\(/, 'the UPDATE policy has no USING');
  assert.match(upd, /WITH CHECK\s*\(/, 'the UPDATE policy has no WITH CHECK — a row could be moved to another celebration');
});

test('⛔ the scope is the COUPLE-only helper, never the one that admits a guest', () => {
  const sql = body(migration());
  assert.match(
    sql,
    /current_couple_event_ids\(\)/,
    'the policies stopped using the couple-scoped helper',
  );
  // 🔴 THE LOAD-BEARING ASSERTION. `current_event_ids()` is
  // `SELECT event_id FROM event_members WHERE user_id = auth.uid()` with NO
  // member_type filter — it admits a GUEST who merely scanned the event QR.
  // Using it here would let any guest grant themselves the guest list. The
  // action file's own docblock named it while describing the right intent,
  // which is exactly how it would get copied in.
  const withoutCouple = sql.replace(/current_couple_event_ids/g, '');
  assert.ok(
    !/current_event_ids\(\)/.test(withoutCouple),
    'a policy uses current_event_ids() — that admits every event member, including a guest',
  );
  // …and a coordinator must not be able to widen their own grant.
  assert.ok(
    !/HOST_MEMBER_TYPES/.test(sql) && !/'coordinator'/.test(sql),
    'the write scope admits coordinators — a coordinator could widen their own grant',
  );
});

test('the revoke path refuses to report success when it changed nothing', () => {
  const src = read(ACTIONS);
  const revoke = src.slice(src.indexOf('export async function revokeArea'));
  assert.match(
    revoke,
    /\.update\(\{ permissions_json: merged \}\)[\s\S]{0,200}?\.select\(/,
    'the revoke no longer asks for the rows it changed — a zero-row write reads as success again',
  );
  assert.match(
    revoke,
    /length === 0[\s\S]{0,300}?ok: false/,
    'a zero-row revoke no longer returns ok:false',
  );
  // The sentence a person actually reads must say the access is still shared.
  assert.match(
    revoke,
    /they still have it/i,
    'the refusal stopped telling the host that the coordinator still has access',
  );
});

test('the grant path does the same', () => {
  const src = read(ACTIONS);
  const grant = src.slice(src.indexOf('export async function answerAccessRequest'), src.indexOf('export async function revokeArea'));
  assert.match(grant, /\.select\(/, 'the upsert stopped asking for the rows it wrote');
  assert.match(grant, /length === 0[\s\S]{0,300}?ok: false/, 'a zero-row grant reads as success');
});

test('the docblock no longer names the guest-admitting helper as the safe one', () => {
  const src = read(ACTIONS);
  const head = src.slice(0, src.indexOf('import '));
  // It may still MENTION current_event_ids — the correction has to name what was
  // wrong — but it must no longer present it as what the sibling policy uses.
  assert.ok(
    !/scoped to\s*\n?\s*\*?\s*`current_event_ids\(\)`/.test(head),
    'the docblock still claims the sibling policy is scoped to current_event_ids()',
  );
  assert.match(head, /current_couple_event_ids/, 'the correction does not name the helper that is actually used');
});
