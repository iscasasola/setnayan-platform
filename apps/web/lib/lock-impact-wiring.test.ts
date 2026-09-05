/**
 * lock-impact-wiring.test.ts — the announcement actually REACHES the couple.
 *
 * `computeLockImpact` shipped correct and unwired on 2026-09-06: the module was
 * right, and no surface rendered it, so a couple lost a saved plan to a lock
 * without being told. The bug class this file guards is exactly that — the
 * computation stays green while the wire between it and the screen is cut.
 *
 * ── WHY SOURCE ASSERTIONS ────────────────────────────────────────────────────
 * There is no DOM in this runner (`tsx --test`, no jsdom, no testing-library in
 * the workspace), and the two files below cannot be imported here at all:
 * `actions.ts` is `'use server'` and reaches the Supabase server client, and
 * `accordion-lock.tsx` is a 1100-line client component. Same shape as
 * `bench-deep-link-anchor.test.ts` / `live-studio-wave8-layout.test.ts`.
 *
 * Each assertion names ONE regression that would put the couple back in front
 * of a silent lock.
 *
 * MUTATION-CHECKED, both directions — see the changelog fragment for counts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(HERE, '..', rel), 'utf8');

const ACTIONS = read('app/dashboard/[eventId]/vendors/actions.ts');
const ACCORDION = read('app/dashboard/[eventId]/vendors/_components/accordion-lock.tsx');
const MODAL = read('app/dashboard/[eventId]/vendors/_components/lock-milestone.tsx');

// ── The server gate ─────────────────────────────────────────────────────────

test('finalizeVendor returns the impact with its gate result', () => {
  // Without this the client would have to re-fetch every saved plan and every
  // vendor calendar to answer a question the server just answered.
  assert.match(ACTIONS, /status: 'lock_will_cost';/, 'the non-date gate exists');
  assert.match(ACTIONS, /impact: LockImpact;/, 'and it carries the impact');
  assert.match(
    ACTIONS,
    /status: 'date_will_lock';[\s\S]{0,900}?impact: LockImpact \| null;/,
    'the date gate carries the same lists — one modal, not two',
  );
});

test('the announcement fires ONLY when the lock actually costs something', () => {
  // Rule 1 of lock-impact.ts. A confirm that always fires gets clicked through
  // unread, and then the one that mattered is clicked through too.
  assert.match(
    ACTIONS,
    /if \(lockImpact && !lockImpact\.isEmpty\) \{\s*return \{\s*status: 'lock_will_cost'/,
    'the isEmpty guard stands between the impact and the modal',
  );
});

test('the gate is decided BEFORE any write — the couple can still say no', () => {
  const gateAt = ACTIONS.indexOf("status: 'lock_will_cost',\n      vendorId,");
  const writeAt = ACTIONS.indexOf('const lockPayload = handshakeAsk');
  assert.ok(gateAt > 0 && writeAt > 0);
  assert.ok(gateAt < writeAt, 'the announcement must precede the status flip');
});

test('a handshake ASK announces nothing — it has settled nothing', () => {
  // A marketplace press under the handshake writes lock_request_state='pending'
  // and NOT status='contracted', so no category is locked, no plan becomes
  // un-loadable and the date window does not move. Warning at request time is
  // the §6.1 defect the date gate already refuses to make.
  assert.match(
    ACTIONS,
    /if \(args\.handshakeAsk \|\| args\.alreadyConfirmed \|\| !args\.groupId\) return null;/,
  );
});

test('confirming once is confirming — the modal cannot re-fire on the re-call', () => {
  assert.match(ACTIONS, /formData\.get\('confirm_lock_impact'\)/);
  assert.match(
    ACTIONS,
    /alreadyConfirmed: confirmLockImpact \|\| confirmDateLock,/,
    'the date modal carries the same lists, so answering it answers this',
  );
});

test('the announcement rides isExploreReplanEnabled — a correctness gate, not a rollout habit', () => {
  // With the flag OFF, build-compare.tsx loads every pick a snapshot holds
  // (it only calls planPicksToApply when `replan`), so a lock costs a saved
  // plan NOTHING; and the convergence tier never runs, so no vendor is sunk.
  // Announcing either would describe a product the couple is not using.
  assert.match(
    ACTIONS,
    /if \(!isExploreReplanEnabled\(\) \|\| !isBudgetBuildEnabled\(\)\) return null;/,
  );
});

test('the services half is computed with the bench’s own module, never a second rule', () => {
  for (const symbol of ['resolveProbeWindow', 'sunkVendors', 'lockImpactTeams']) {
    assert.ok(ACTIONS.includes(symbol), `${symbol} must be what finalizeVendor calls`);
  }
  assert.match(
    ACTIONS,
    /sunkBefore = sunkVendors\(\{ probe, members: membersBefore, bench \}\);\s*sunkAfter = sunkVendors\(\{ probe, members: membersAfter, bench \}\);/,
    'both verdict sets, so lock-impact can diff rather than guess',
  );
});

// ── The client ──────────────────────────────────────────────────────────────

test('the lock button opens the confirm on BOTH gate results', () => {
  assert.match(ACCORDION, /case 'lock_will_cost':/);
  assert.match(ACCORDION, /kind: 'impact_confirm',/);
  assert.match(
    ACCORDION,
    /kind: 'date_confirm',\s*dateLabel: result\.dateLabel,\s*impact: result\.impact,/,
    'the date confirm must show what else the lock closes',
  );
});

test('there is ONE confirm component, extended — not a second modal', () => {
  assert.equal(
    (ACCORDION.match(/<LockConfirmModal/g) ?? []).length,
    2,
    'both states render the same component',
  );
  assert.ok(
    !/export function LockDateConfirmModal/.test(MODAL),
    'the date-only component is gone, not forked (the docblock still explains the rename)',
  );
  assert.equal(
    (MODAL.match(/export function LockConfirmModal/g) ?? []).length,
    1,
    'exactly one pre-lock confirm exists',
  );
  assert.ok(
    !/function\s+LockImpactModal|function\s+LockCostModal/.test(MODAL),
    'no rival confirm was introduced',
  );
});

test('the confirmed re-call carries the consent, and no later gate can drop it', () => {
  assert.match(ACCORDION, /impactConfirmedRef\.current = true;/);
  assert.match(
    ACCORDION,
    /if \(impactConfirmedRef\.current\) fd\.set\('confirm_lock_impact', '1'\);/,
    'set from the ref inside performLock, so every gate re-entry keeps it',
  );
  // A ref, not a threaded field: reservation-terms and downpayment both
  // re-enter performLock, and a threaded flag is one forgotten field away from
  // re-opening a modal the couple already answered.
  assert.ok(
    !/confirmLockImpact: boolean;/.test(ACCORDION),
    'consent is not threaded through each gate state',
  );
});

test('dismissing is not consenting', () => {
  // "Not yet" returns to idle and never sets the ref, so the next press asks
  // again — the whole point of a pre-lock confirm.
  assert.match(
    ACCORDION,
    /state\.kind === 'impact_confirm' \? \([\s\S]{0,700}?onDismiss=\{\(\) => setState\(\{ kind: 'idle' \}\)\}/,
  );
});

// ── The words ───────────────────────────────────────────────────────────────

test('the modal renders lockImpactCopy, not its own sentences', () => {
  // The two bans — never "held/reserved", never "deleted" — are pinned by
  // lock-impact.test.ts against that function. Re-writing the prose in JSX
  // would move the words out from under the test that guards them.
  assert.match(MODAL, /import \{ lockImpactCopy, type LockImpact \} from '@\/lib\/lock-impact';/);
  assert.match(MODAL, /const copy = impact \? lockImpactCopy\(impact, vendorName\) : null;/);
  assert.match(MODAL, /copy\.lines\.map\(/, 'the casualty lines come from the copy function');
  assert.match(MODAL, /copy\?\.confirmLabel/, 'so does the confirm label');
});

test('the modal never claims a day is held, and never says a plan is deleted', () => {
  const prose = MODAL.split('\n')
    .filter((l) => !l.trimStart().startsWith('*') && !l.trimStart().startsWith('//'))
    .join('\n');
  assert.ok(
    !/\bis (held|reserved)\b|\bwe(?:'| wi)ll hold\b|\bholds? (?:the|your) (?:day|date)\b/i.test(prose),
    'build-date-window.ts rule 3 — nothing is held until a vendor accepts payment',
  );
  assert.ok(!/\bdeleted\b|\bdeletes your\b/i.test(prose), 'a lock un-loads a plan; it does not destroy it');
});

test('a date-setting lock still says exactly what it always said', () => {
  // The wiring must not have rewritten the shipped date sentence out from under
  // a couple mid-flow.
  assert.match(MODAL, /This locks your wedding date\./);
  assert.match(MODAL, /leaves only one of your\s+candidate dates open/);
  assert.match(MODAL, /Lock \$\{dateLabel\}/, 'the date confirm keeps its own label');
});
