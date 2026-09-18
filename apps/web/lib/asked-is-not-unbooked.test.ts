/**
 * SUP-69 (CPL-5) · A COUPLE WHO HAS ASKED A SUPPLIER TO LOCK IS NOT TOLD,
 * ELSEWHERE, TO "GO BOOK" THAT CATEGORY.
 *
 * ── WHAT WAS MEASURED (2026-09-19) ─────────────────────────────────────────
 * The register blamed `askedCount` being "always 0 while isExploreReplanEnabled
 * is off". Both halves were wrong: `askedCount` is gated by the LOCK HANDSHAKE
 * flag, not explore-replan, and both flags are ON in production
 * (`vercel env pull`: NEXT_PUBLIC_LOCK_HANDSHAKE_ENABLED="true"). The bench's
 * coverage strip, the plan accordion and "Your team" already said "asked,
 * waiting". The Overview did not: its event_vendors read never selected
 * `lock_request_state`, so the decisions board said "Pick your caterer · 1
 * option saved · none locked yet · Compare & lock", and "today's one thing"
 * could say "Book your caterer", to a couple waiting on that caterer's yes.
 *
 * The rule lives in ONE place — `hasOutstandingAsk` over `lockRequestStateOf` —
 * and both pure cores take the flag as a parameter, so flag-off is asserted
 * byte-identical here in the same process.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { buildCockpitModel, type CockpitInput } from '@/lib/setnayan-ai-cockpit';
import { pickTodaysOneThing, type ResolvedTask } from '@/lib/todays-one-thing';
import { PLAN_GROUPS, type EventVendorRowInput } from '@/lib/wedding-plan-groups';

const NOW = new Date('2026-03-01T00:00:00Z');
const WEB = join(import.meta.dirname, '..');

const asked: EventVendorRowInput = {
  vendor_id: 'S89V-1111111111',
  vendor_name: 'Kusina Catering',
  category: 'catering',
  status: 'considering',
  lock_request_state: 'pending',
};
const declined: EventVendorRowInput = { ...asked, lock_request_state: 'declined' };
const stalePendingOnBooking: EventVendorRowInput = { ...asked, status: 'deposit_paid' };

const cateringTask: ResolvedTask = {
  id: 'catering',
  category: 'Catering',
  status: 'next_up',
  title: 'Book your caterer',
  whyItMatters: '…',
  ctaLabel: 'Browse caterers',
  ctaHref: '/explore?folder=food#catering',
  daysContextual: 10,
};

function cockpit(over: Partial<CockpitInput>) {
  return buildCockpitModel(
    {
      eventId: 'S89E-ABCDEFGHJK',
      daysOut: null,
      lockedVendorCount: 0,
      totalLockableCategories: 20,
      vendors: [],
      sponsors: [],
      topPriorityTask: null,
      paperwork: [],
      ...over,
    },
    NOW,
  );
}

test('the fixture group exists — a missing group would make every case below vacuous', () => {
  assert.ok(PLAN_GROUPS.some((g) => g.id === 'catering'));
});

test('🔑 1 · the decisions board does not say "Compare & lock" to a couple who asked', () => {
  const on = cockpit({ vendors: [asked], lockHandshakeEnabled: true });
  assert.equal(on.decisions.some((d) => d.id === 'pick:catering'), false);
  // …and "today's one thing" for the same category cannot sneak back in as
  // "Nothing booked · lock by …".
  const onWithTask = cockpit({ vendors: [asked], topPriorityTask: cateringTask, lockHandshakeEnabled: true });
  assert.equal(onWithTask.decisions.some((d) => d.id === 'start:catering'), false);
  assert.match(onWithTask.briefing.sentence, /nothing needs a decision/i);
});

test('🔑 2 · flag OFF is byte-identical to before (no row can reach "asked")', () => {
  const before = cockpit({ vendors: [asked] });
  const off = cockpit({ vendors: [asked], lockHandshakeEnabled: false });
  assert.deepEqual(off, before);
  assert.ok(off.decisions.some((d) => d.id === 'pick:catering'));
});

test('🔑 3 · only an OUTSTANDING ask quiets it', () => {
  // The supplier said no: the decision is the couple's again.
  assert.ok(cockpit({ vendors: [declined], lockHandshakeEnabled: true }).decisions.some((d) => d.id === 'pick:catering'));
  // A stale 'pending' on a real booking reads as the booking (no decision at
  // all), decided by the shared core — not as "asked".
  assert.equal(
    cockpit({ vendors: [stalePendingOnBooking], lockHandshakeEnabled: true }).decisions.some((d) => d.id === 'pick:catering'),
    false,
  );
});

test("🔑 4 · today's one thing skips a category waiting on the supplier", () => {
  const onlyCatering = PLAN_GROUPS.filter((g) => g.id === 'catering');
  const off = pickTodaysOneThing([asked], '2026-12-12', NOW, onlyCatering, false);
  assert.equal(off?.id, 'catering', 'flag off must still nag exactly as before');
  assert.equal(pickTodaysOneThing([asked], '2026-12-12', NOW, onlyCatering, true), null);
  // Declined → back on the list.
  assert.equal(pickTodaysOneThing([declined], '2026-12-12', NOW, onlyCatering, true)?.id, 'catering');
  // And across the whole ladder, the winner is never the asked category.
  assert.notEqual(pickTodaysOneThing([asked], '2026-12-12', NOW, PLAN_GROUPS, true)?.id, 'catering');
});

test('🔑 5 · both Overview readers select the column the rule needs', () => {
  // Without `lock_request_state` in the SELECT every row reads as un-asked and
  // the flag is asked for nothing — the defect as shipped.
  for (const rel of ['app/dashboard/[eventId]/_components/event-dashboard.tsx', 'lib/setnayan-ai-activity.ts']) {
    const src = stripComments(readFileSync(join(WEB, rel), 'utf8'));
    const reads = src.match(/from\('event_vendors'\)\s*\.select\(\s*[`'][^`']*[`']/g) ?? [];
    assert.ok(reads.length >= 1, `${rel}: no event_vendors read found — this window faces nothing`);
    assert.ok(
      reads.some((r) => r.includes('lock_request_state')),
      `${rel} reads event_vendors without lock_request_state`,
    );
    assert.ok(/lockHandshakeEnabled: isLockHandshakeEnabled\(\)/.test(src), `${rel} stopped handing the flag to the cockpit`);
  }
});
