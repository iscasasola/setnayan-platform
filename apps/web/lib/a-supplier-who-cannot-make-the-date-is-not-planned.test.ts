/**
 * a-supplier-who-cannot-make-the-date-is-not-planned.test.ts
 *
 * Owner, 2026-09-11 (register question 10), verbatim:
 *   "hide lock, say why. but technically, they shouldn't even be shown as
 *    planned based on their schedule availability."
 *
 * Two rulings in one sentence, and this file holds both:
 *   1. A supplier who DECLINED the couple's inquiry — or whose slot another
 *      booking took — loses Lock, and the card says why. After a declined LOCK
 *      REQUEST, Lock stays (they may be asked again).
 *   2. A supplier whose own calendar shows the couple's committed day taken is
 *      not presented as a planned pick: Add and Lock stand down, the card sinks
 *      behind a "Not available on your date" divider, dimmed — and is NEVER
 *      removed (Explore Replan PR-G2, specced 2026-07-27, gate resolved the same
 *      day, never built until now).
 *
 * 🛡 The two invariants at the bottom are swept over EVERY combination of the
 * facts the resolver reads, because each guards a failure that shipped:
 *   • `buildGroupId` ⇔ `build` — the card drew its build slot off `lockGroupId`,
 *     which this resolver nulls on a clash, so the soft tier's reason note could
 *     never render. A test on the resolver alone never saw it.
 *   • Lock is never offered alongside a reason not to lock.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  blockedLockReason,
  isUnavailableOnDate,
  resolveBenchCardActions,
  type BenchCardVendor,
} from '@/lib/bench-card-actions';
import { sinkUnavailable, partitionByBuildFit } from '@/lib/build-date-window';
import type { LockRequestState } from '@/lib/lock-request-state';
import { stripComments } from '@/lib/strip-comments';

function vendor(p: Partial<BenchCardVendor> = {}): BenchCardVendor {
  return {
    status: 'considering',
    marketplaceVendorId: 'vp-1',
    threadId: 't-1',
    inquiryStatus: 'accepted',
    planGroupId: 'catering',
    priceBasisPhp: 50_000,
    ...p,
  };
}
const act = (v: Partial<BenchCardVendor>, inBuild = false, enabled = true) =>
  resolveBenchCardActions({ enabled, vendor: vendor(v), inBuild });

/* ── 1 · "hide lock, say why" ─────────────────────────────────────────────── */

test('an inquiry the supplier declined hides Lock and says so', () => {
  const a = act({ inquiryStatus: 'declined' });
  assert.equal(a.lockGroupId, null, 'Lock still offered on a supplier who said no');
  assert.equal(a.lockWithheld, 'inquiry_declined');
  // The ruling hid LOCK. Add-to-build is untouched — a declined supplier can
  // still stand in the couple's plan as a price.
  assert.deepEqual(a.build, { kind: 'add' });
  // And the couple can still reach them (a declined thread re-opens as Inquire).
  assert.deepEqual(a.inquiry, { kind: 'inquire' });
});

test('a slot another booking took hides Lock with its own reason', () => {
  const a = act({ inquiryStatus: 'displaced' });
  assert.equal(a.lockGroupId, null);
  assert.equal(a.lockWithheld, 'slot_taken');
});

test('after a declined LOCK REQUEST, Lock stays — they may be asked again', () => {
  const a = act({ lockRequestState: 'declined' });
  assert.equal(a.lockGroupId, 'catering');
  assert.equal(a.lockWithheld, null);
});

test('an ordinary live inquiry is untouched', () => {
  for (const inquiryStatus of ['pending', 'accepted', null]) {
    const a = act({ inquiryStatus });
    assert.equal(a.lockGroupId, 'catering', `${inquiryStatus}`);
    assert.equal(a.lockWithheld, null, `${inquiryStatus}`);
  }
});

/* ── 2 · not shown as planned when the date is taken ──────────────────────── */

test('a supplier whose calendar shows the day taken is NOT AVAILABLE, not a pick', () => {
  const a = act({ dateFit: 'booked' });
  assert.deepEqual(a.build, { kind: 'not_available', inBuild: false });
  assert.equal(a.lockGroupId, null, 'Lock offered on a supplier who cannot make the day');
  // "Ask anyway" — the conversation leg survives (decision #3).
  assert.ok(a.inquiry, 'the conversation was taken away too');
});

test('a pick ALREADY in the build is sunk too — and keeps its Remove', () => {
  // Unlike the soft tier, it did not DEFINE the date; it just cannot make it.
  const a = act({ dateFit: 'booked' }, true);
  assert.deepEqual(a.build, { kind: 'not_available', inBuild: true });
  assert.equal(a.buildGroupId, 'catering', 'Remove would have nothing to act on');
});

test('the couple\'s OWN booked supplier is never "not available" on their own day', () => {
  // A paid deposit auto-blocks the supplier's calendar — BY THIS COUPLE.
  const a = act({ status: 'locked', dateFit: 'booked' });
  assert.equal(a.build, null);
  assert.equal(isUnavailableOnDate(true, vendor({ status: 'locked', dateFit: 'booked' })), false);
});

test('an outstanding ask keeps its own answer (take it back), not the sink', () => {
  const a = act({ lockRequestState: 'requested', dateFit: 'booked' });
  assert.deepEqual(a.withdraw, { kind: 'withdraw' });
  assert.equal(a.build, null);
});

test('the hard tier beats the soft one — "cannot make it" outranks "narrow window"', () => {
  const a = act({ dateFit: 'booked', buildFit: 'clash', buildClashWith: 'Hiraya' });
  assert.equal(a.build?.kind, 'not_available');
});

test('no committed day, or no calendar signal, is no verdict', () => {
  for (const dateFit of ['free', null, undefined] as const) {
    assert.equal(act({ dateFit }).build?.kind, 'add', `${dateFit}`);
  }
});

test('flag OFF: nothing changes — no sink, no reasons', () => {
  const a = act({ dateFit: 'booked', inquiryStatus: 'declined' }, false, false);
  assert.equal(a.build, null);
  assert.equal(a.lockWithheld, null);
  assert.equal(isUnavailableOnDate(false, vendor({ dateFit: 'booked' })), false);
});

/* ── the rail's sink agrees with the card ─────────────────────────────────── */

test('the sink moves the unavailable to the end, keeps everyone, and keeps the order', () => {
  const rows = ['a', 'B', 'c', 'D', 'e'].map((id) => ({ id, taken: id === id.toUpperCase() }));
  const { available, unavailable } = sinkUnavailable(rows, (r) => r.taken);
  assert.deepEqual(available.map((r) => r.id), ['a', 'c', 'e']);
  assert.deepEqual(unavailable.map((r) => r.id), ['B', 'D']);
  assert.equal(available.length + unavailable.length, rows.length, 'a card was dropped');
});

test('rail order: fits · "Doesn\'t fit your build" · "Not available"', () => {
  const rows = [
    { id: 'hard', v: vendor({ dateFit: 'booked' }) },
    { id: 'soft', v: vendor({ buildFit: 'clash' }) },
    { id: 'fits', v: vendor() },
  ];
  const avail = sinkUnavailable(rows, (r) => isUnavailableOnDate(true, r.v));
  const soft = partitionByBuildFit(avail.available, (r) =>
    r.v.buildFit === 'clash' ? { fits: false, clashWith: null } : null,
  );
  assert.deepEqual(
    [...soft.fits, ...soft.clashes, ...avail.unavailable].map((r) => r.id),
    ['fits', 'soft', 'hard'],
  );
});

/* ── the invariants, swept ─────────────────────────────────────────────────── */

const STATUSES = ['considering', 'locked'] as const;
const LOCK_REQ: (LockRequestState | undefined)[] = [undefined, 'none', 'requested', 'declined', 'cancelled', 'expired', 'locked'];
const INQ = [null, 'pending', 'accepted', 'declined', 'withdrawn', 'expired', 'displaced'];
const DATE = ['free', 'booked', null, undefined] as const;
const FIT = ['fits', 'clash', null] as const;
const GROUP = ['catering', null];
const PRICE = [50_000, null];

function* everyCase() {
  for (const status of STATUSES)
    for (const lockRequestState of LOCK_REQ)
      for (const inquiryStatus of INQ)
        for (const dateFit of DATE)
          for (const buildFit of FIT)
            for (const planGroupId of GROUP)
              for (const priceBasisPhp of PRICE)
                for (const inBuild of [false, true])
                  for (const enabled of [true, false])
                    yield {
                      enabled,
                      inBuild,
                      v: vendor({ status, lockRequestState, inquiryStatus, dateFit, buildFit, planGroupId, priceBasisPhp }),
                      label: `${status}/${lockRequestState}/${inquiryStatus}/${dateFit}/${buildFit}/${planGroupId}/${priceBasisPhp}/inBuild=${inBuild}/on=${enabled}`,
                    };
}

test('🔑 the build slot always has a group to act on — and only when there is a build', () => {
  let n = 0;
  for (const c of everyCase()) {
    const a = resolveBenchCardActions({ enabled: c.enabled, vendor: c.v, inBuild: c.inBuild });
    assert.equal(a.buildGroupId !== null, a.build !== null, `${c.label}: build ${a.build?.kind} / group ${a.buildGroupId}`);
    n++;
  }
  assert.ok(n > 5000, `only ${n} cases swept`);
});

test('🔑 Lock is never offered next to a reason not to lock', () => {
  for (const c of everyCase()) {
    const a = resolveBenchCardActions({ enabled: c.enabled, vendor: c.v, inBuild: c.inBuild });
    if (a.lockGroupId !== null) {
      assert.equal(a.lockWithheld, null, c.label);
      assert.notEqual(a.build?.kind, 'not_available', c.label);
      assert.equal(a.withdraw, null, c.label);
    }
  }
});

test('🔑 the sink, the card and the Picks column read ONE predicate', () => {
  for (const c of everyCase()) {
    if (c.v.planGroupId == null) continue; // no build slot to compare
    const a = resolveBenchCardActions({ enabled: c.enabled, vendor: c.v, inBuild: c.inBuild });
    const sunk = isUnavailableOnDate(c.enabled, c.v);
    assert.equal(a.build?.kind === 'not_available', sunk, `${c.label}: card and sink disagree`);
    if (sunk) assert.equal(blockedLockReason(a), 'not_available', c.label);
  }
});

/* ── the card component draws what the resolver answers ───────────────────── */

const WEB = join(import.meta.dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('🔑 the card\'s build slot is keyed on buildGroupId, never on the lock id', () => {
  const src = read('app/dashboard/[eventId]/vendors/_components/bench-vendor-actions.tsx');
  assert.match(src, /\{actions\.build && buildGroupId \?/, 'the build slot lost its own group id');
  assert.doesNotMatch(
    src,
    /\{actions\.build && groupId \?/,
    'the build slot is gated on the LOCK id again — the clash and not-available notes can never render',
  );
  // Both notes, and the reason line, are drawn.
  for (const k of ["'not_available'", "'schedule_clash'", 'actions.lockWithheld']) {
    assert.ok(src.includes(k), `the card no longer handles ${k}`);
  }
});

test('🔑 the Picks column never offers "Lock to confirm" for a blocked pick', () => {
  const src = read('app/dashboard/[eventId]/vendors/_components/build-locked.tsx');
  const blocked = src.slice(src.indexOf('blockedRows.map('));
  const blockedBody = blocked.slice(0, blocked.indexOf('))}') + 3);
  assert.ok(blockedBody.length > 50, 'the blocked list is gone');
  assert.doesNotMatch(blockedBody, /AccordionLockButton/, 'a blocked pick got a Lock button');
  assert.match(src, /readyRows\.map\(/, 'the ready list no longer excludes blocked picks');
});

test('🔑 the rail sinks with the SAME predicate the card resolves with', () => {
  // A sink written as its own `v.dateFit === 'booked'` would pass every test
  // above while forgetting that a couple's OWN booked supplier is not "taken".
  const src = read('app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx');
  assert.match(
    src,
    /sinkUnavailable\(arrangedRail, \(\{ v \}\) =>\s*isUnavailableOnDate\(replan, v\),?\s*\)/,
    'the rail sinks by its own rule, not isUnavailableOnDate',
  );
  // …and the Picks column's verdicts come from the card's own resolver.
  const page = read('app/dashboard/[eventId]/vendors/page.tsx');
  assert.match(page, /blockedLockReason\(\s*resolveBenchCardActions\(/, 'the Picks verdicts stopped using the resolver');
});
