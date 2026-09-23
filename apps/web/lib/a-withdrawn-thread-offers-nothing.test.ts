/**
 * a-withdrawn-thread-offers-nothing.test.ts — A CLOSED CONVERSATION MUST NOT
 * OFFER THE ACTIONS OF A LIVE ONE.
 *
 * ── THE DEFECT (owner, 2026-09-23: "fix the withdrawn wording now") ─────────
 * `withdrawInquiry` writes ONLY `archived_at` and never touches
 * `inquiry_status`, so a withdrawn thread is still `pending`. Both pages
 * branched on the status alone and therefore reached their PENDING arm on a
 * conversation the couple had already closed:
 *
 *   · the couple kept a **working composer** (`pending && canFollowUpWhilePending`),
 *     or was shown "Waiting for {vendor} to accept" with a **Withdraw inquiry**
 *     button for an inquiry already withdrawn;
 *   · the supplier was shown **Accept inquiry** — an action on an inquiry that
 *     no longer exists.
 *
 * 🔑 **The wording was the symptom. The screens were offering the wrong ACTS.**
 *
 * ── TWO TESTS, TWO QUESTIONS ────────────────────────────────────────────────
 * `thread-closing-copy.test.ts` proves the rule decides correctly. It cannot
 * prove the pages ASK it — a guard on the call cannot see the argument, and a
 * page that imports `isThreadClosed` and never gates on it keeps every test
 * green. This file executes the rule AND pins the gating in both pages.
 *
 * Sabotages watched red before commit:
 *   1. drop `!threadClosed` from the couple's `composerOpen`
 *   2. drop `&& !threadClosed` from the couple's pending arm
 *   3. drop `&& !isThreadClosed(thread)` from the supplier's pending arm
 *   4. make `isThreadClosed` always return false
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isThreadClosed, resolveClosingKind } from '@/lib/thread-closing-copy';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const COUPLE = 'app/dashboard/[eventId]/messages/[threadId]/page.tsx';
const SUPPLIER = 'app/vendor-dashboard/messages/[threadId]/page.tsx';
const src = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

const WITHDRAWN_PENDING = { inquiry_status: 'pending', archived_at: '2026-09-23T01:00:00Z' };
const LIVE_PENDING = { inquiry_status: 'pending', archived_at: null };

test('the rule itself: a withdrawn thread is closed even though it is still "pending"', () => {
  assert.equal(resolveClosingKind(WITHDRAWN_PENDING), 'withdrawn');
  assert.equal(isThreadClosed(WITHDRAWN_PENDING), true, 'this is the whole bug');
  assert.equal(isThreadClosed(LIVE_PENDING), false);
  assert.equal(isThreadClosed({ inquiry_status: 'accepted', archived_at: null }), false);
  // A withdrawal after acceptance closes it too.
  assert.equal(isThreadClosed({ inquiry_status: 'accepted', archived_at: '2026-09-23T01:00:00Z' }), true);
});

test('the couple never gets a composer on a thread they withdrew', () => {
  const s = src(COUPLE);
  // The gate is computed once and named, so both uses read the same fact.
  assert.match(s, /const threadClosed = isThreadClosed\(thread\)/, 'couple: no named closed gate');
  // composerOpen must consult it.
  const at = s.indexOf('const composerOpen =');
  assert.ok(at !== -1, 'couple: composerOpen not found');
  const gate = s.slice(at, s.indexOf(';', at));
  assert.match(gate, /!threadClosed/, 'couple: composerOpen ignores whether the thread is closed');
});

test('the couple is not told to wait, or offered Withdraw, on a withdrawn thread', () => {
  const s = src(COUPLE);
  // Every `inquiry_status === 'pending' ?` BRANCH must also require not-closed.
  // Scan every occurrence — a guard anchored on the first faces the wrong cell.
  const arms: string[] = [];
  let from = 0;
  for (;;) {
    const at = s.indexOf("thread.inquiry_status === 'pending' ?", from);
    if (at === -1) break;
    arms.push(s.slice(Math.max(0, at - 40), at + 40));
    from = at + 1;
  }
  assert.equal(arms.length, 0,
    'couple: a `pending ?` branch with no closed-check would show "Waiting for them to accept" ' +
    'on a thread the couple withdrew. Found:\n' + arms.join('\n---\n'));
  assert.match(s, /inquiry_status === 'pending' && !threadClosed \?/,
    'couple: the pending arm must require !threadClosed');
});

test('the supplier is never offered Accept on an inquiry the couple withdrew', () => {
  const s = src(SUPPLIER);
  const bare: string[] = [];
  let from = 0;
  for (;;) {
    const at = s.indexOf("thread.inquiry_status === 'pending' ?", from);
    if (at === -1) break;
    bare.push(s.slice(Math.max(0, at - 60), at + 40));
    from = at + 1;
  }
  assert.equal(bare.length, 0,
    'supplier: an ungated `pending ?` branch renders Accept inquiry on a withdrawn thread — ' +
    'and acceptInquiry does not check archived_at, so the accept would SUCCEED. Found:\n' +
    bare.join('\n---\n'));
  assert.match(s, /inquiry_status === 'pending' && !isThreadClosed\(thread\) \?/,
    'supplier: the pending arm must require the thread to be open');
  assert.match(s, /inquiry_status === 'accepted' && !isThreadClosed\(thread\) \?/,
    'supplier: the accepted arm must require the thread to be open — a couple may withdraw after accepting');
});

test('both pages ask the SAME rule — no second spelling of "closed"', () => {
  for (const [name, rel] of [['couple', COUPLE], ['supplier', SUPPLIER]] as const) {
    const s = src(rel);
    assert.match(s, /from '@\/lib\/thread-closing-copy'/, `${name}: must import the one module`);
    assert.doesNotMatch(
      s,
      /archived_at != null \?|archived_at !== null \?/,
      `${name}: re-derives "closed" from archived_at instead of asking the module`,
    );
  }
});
