/**
 * admin-area-gates-hold.test.ts — final check area 8, batch 7 (checker 8-1).
 *
 * The Team grid on /admin/team promises area limits (lib/admin/areas.ts,
 * DECISION_LOG 2026-11-13). Each test below holds ONE of those promises on the
 * server, or one guard that must refuse when its own read fails. Every check
 * is ORDERED: the gate must come before the first read or write it protects,
 * because a gate that runs after the write is the defect itself (A8·D-1).
 *
 *   A8·D-1  approving / rejecting a deletion request asks Deletions · Escalated
 *           and the self + internal guards BEFORE the request is marked.
 *   A8·D-2  the internal-account guard on erasure fails closed.
 *   A8·D-3  removing an event asks Deletions · Escalated (3 doors).
 *   A8·D-4  a supplier invite that carries a free paid plan asks Plans · Escalated.
 *   A8·D-5  a refused cancel of unpaid bills stops the event removal.
 *   A8·B-2  every price write asks Prices & promos · Escalated.
 *   A8·L-8  Catalogue · Escalated, and the six money desks, are enforced.
 *   A8·E-2  a resolved force-majeure flag cannot be re-resolved.
 *   A8·F-17 "don't disconnect a checked-out channel" fails closed.
 *   A8·E-13 (force-majeure part) a refused resolution is said on the flag's page.
 *   A8·A-6  a founder seat goes to an exact email match; failed reads are said.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** The body of `function <name>(` (exported or not) up to the next top-level function. */
function body(src: string, name: string, file: string): string {
  const at = src.search(new RegExp(`(?:^|\\n)(?:export )?async function ${name}\\(`));
  assert.ok(at >= 0, `${name} not found in ${file}`);
  const rest = src.slice(at + 1);
  const next = rest.search(/\n(?:export )?(?:async )?function /);
  return next < 0 ? src.slice(at) : src.slice(at, at + 1 + next);
}

/** `first` occurs in `b`, and before `later` (when `later` occurs at all). */
function before(b: string, first: string | RegExp, later: string, what: string) {
  const i = typeof first === 'string' ? b.indexOf(first) : b.search(first);
  assert.ok(i >= 0, `${what}: missing ${String(first)}`);
  const j = b.indexOf(later);
  if (j >= 0) assert.ok(i < j, `${what}: ${String(first)} must come before ${later}`);
}

const gateFor = (area: string, level: string) =>
  new RegExp(`(?:requireAdminCan|adminCanRefusal)\\('${area}', '${level}'\\)`);

test('A8·D-1 · a deletion request is only marked after every check the delete would run', () => {
  const f = 'app/admin/account-deletions/actions.ts';
  const s = read(f);
  const approve = body(s, 'approveRequest', f);
  before(approve, gateFor('deletions', 'escalated'), "status: 'approved'", 'approveRequest');
  before(approve, 'await assertErasable(', "status: 'approved'", 'approveRequest');
  before(approve, /mode === 'blacklist'\) await requireAdminCan\('fraud', 'escalated'\)/, "status: 'approved'", 'approveRequest (blacklist)');
  const erasable = body(s, 'assertErasable', f);
  before(erasable, 'targetUserId === adminUserId', '.from(', 'assertErasable self guard');
  assert.match(erasable, /is_internal\)\s*\{\s*throw/, 'assertErasable refuses an internal account');
  const reject = body(s, 'rejectRequest', f);
  before(reject, gateFor('deletions', 'escalated'), "status: 'rejected'", 'rejectRequest');
  const rerun = body(s, 'rerunErasure', f);
  before(rerun, gateFor('deletions', 'escalated'), 'loadPendingRequest(', 'rerunErasure');
});

test('A8·D-2 · an unread target is refused, never erased as "not internal"', () => {
  const f = 'app/admin/users/actions.ts';
  const del = body(read(f), 'deleteUser', f);
  before(del, /if \(targetErr \|\| !target\) \{\s*throw/, 'eraseUserAccount(', 'deleteUser');
  assert.doesNotMatch(del, /target\?\.is_internal/, 'deleteUser must not pass a null target');
  const erasable = body(read('app/admin/account-deletions/actions.ts'), 'assertErasable', 'account-deletions');
  assert.match(erasable, /if \(error \|\| !target\) \{\s*throw/, 'assertErasable fails closed');
});

test('A8·D-3 · every way to remove an event asks Deletions · Escalated first', () => {
  const ed = 'app/admin/event-deletions/actions.ts';
  for (const fn of ['approveEventDeletion', 'rejectEventDeletion']) {
    before(body(read(ed), fn, ed), gateFor('deletions', 'escalated'), 'loadPending(', fn);
  }
  const ev = 'app/admin/events/actions.ts';
  before(body(read(ev), 'deleteEvent', ev), gateFor('deletions', 'escalated'), 'createAdminClient()', 'deleteEvent');
});

test('A8·D-4 · an invite carrying a free paid plan asks the same gate as setVendorTier', () => {
  const f = 'app/admin/vendors/actions.ts';
  const s = read(f);
  const invite = body(s, 'createAdminVendorInvite', f);
  before(invite, /if \(offer\.tier\) \{[\s\S]*?requireAdminCan\('plans', 'escalated'\)/, 'createAdminClient()', 'createAdminVendorInvite');
  assert.match(body(s, 'setVendorTier', f), gateFor('plans', 'escalated'), 'setVendorTier is the reference gate');
});

test('A8·D-5 · a refused cancel of unpaid bills stops the removal', () => {
  const f = 'app/admin/event-deletions/actions.ts';
  const b = body(read(f), 'approveEventDeletion', f);
  before(b, /if \(strandErr\) \{[^}]*throw new Error/, '.delete()', 'approveEventDeletion');
  assert.match(b, /if \(markErr\) \{[^}]*throw new Error/, 'the approved mark is checked');
});

const PRICE_WRITES = [
  'app/admin/pricing/actions.ts',
  'app/admin/pricing/price-control-actions.ts',
  'app/admin/pricing/_surfaces/free-windows-actions.ts',
];
/** Exported but not a press: called by the gated saveRetailRow and the approvals dispatcher with a client already in hand. */
const PRICE_HELPERS = new Set(['executeRetailPriceChange']);

test('A8·B-2 · every exported price write asks Prices & promos · Escalated before it reads', () => {
  let seen = 0;
  for (const f of PRICE_WRITES) {
    const s = read(f);
    assert.match(s, /^'use server';/, `${f} is a server-action file`);
    for (const m of s.matchAll(/^export async function (\w+)/gm)) {
      const name = m[1] ?? '';
      if (PRICE_HELPERS.has(name)) continue;
      const b = body(s, name, f);
      before(b, gateFor('prices_promos', 'escalated'), 'createAdminClient()', `${f} · ${name}`);
      seen++;
    }
  }
  assert.ok(seen >= 20, `expected every price write to be scanned, saw ${seen}`);
});

test('A8·L-8 · hide for everyone, combine and retire ask Catalogue · Escalated', () => {
  const f = 'app/admin/categories/actions.ts';
  const s = read(f);
  for (const fn of ['setCategoryHidden', 'retireLeafAttributeFieldAction', 'retireLeafAttributeOptionAction']) {
    before(body(s, fn, f), 'await requireCatalogueEscalated(formData)', 'createAdminClient()', fn);
  }
  assert.match(body(s, 'requireCatalogueEscalated', f), gateFor('catalogue', 'escalated'));
  before(body(s, 'deleteTileWithDestination', f), gateFor('catalogue', 'escalated'), 'createAdminClient()', 'deleteTileWithDestination');
  before(body(s, 'mergeCanonicalService', f), gateFor('catalogue', 'escalated'), 'createAdminClient()', 'mergeCanonicalService');
  const flag = body(s, 'setServiceFlag', f);
  before(flag, /=== 'marketplace_hidden'\) await requireCatalogueEscalated\(formData\)/, 'createAdminClient()', 'setServiceFlag (hide for everyone)');
  const status = body(s, 'setEventTypeStatus', f);
  before(status, /askedWord === 'retired' \|\| askedWord === 'hidden'\) await requireCatalogueEscalated\(formData\)/, 'answerEventTypeAsk(', 'setEventTypeStatus (retire / hide)');
  before(status, 'await requireCatalogueEscalated(formData)', 'createAdminClient()', 'setEventTypeStatus');
  const map = read('app/admin/categories/four-level-actions.ts');
  const hide = map.slice(map.indexOf("case 'hidePart':"), map.indexOf("case 'onePerEvent':"));
  before(hide, gateFor('catalogue', 'escalated'), 'setPartHiddenCore(', 'mapWrite hidePart');
});

/** Every exported action on the six money desks, and the area it must ask (lib/admin/areas.ts). */
const MONEY_DESKS: Record<string, Record<string, RegExp>> = {
  'app/admin/payouts/actions.ts': {
    markPayoutPaidAction: gateFor('payments', 'escalated'),
    holdPayoutAction: gateFor('payments', 'basic'),
  },
  'app/admin/subscriptions/actions.ts': {
    approveSubscription: gateFor('payments', 'basic'),
    rejectSubscription: gateFor('payments', 'basic'),
  },
  'app/admin/founder-seats/actions.ts': {
    grantFounderSeat: gateFor('gifts_comps', 'escalated'),
    revokeFounderSeat: gateFor('gifts_comps', 'escalated'),
  },
  'app/admin/launch-offer/actions.ts': { saveLaunchOffer: gateFor('prices_promos', 'escalated') },
  'app/admin/booking-fees/actions.ts': {
    saveFeeReviewMin: gateFor('prices_promos', 'escalated'),
    setBookingsOpen: gateFor('prices_promos', 'escalated'),
  },
  'app/admin/payment-options/actions.ts': {
    approvePaymentMethod: gateFor('verification', 'escalated'),
    holdPaymentMethod: gateFor('verification', 'escalated'),
    removePaymentMethod: gateFor('verification', 'escalated'),
  },
};

test('A8·L-8 · every money-desk action asks its area before it reads or writes', () => {
  for (const [f, gates] of Object.entries(MONEY_DESKS)) {
    const s = read(f);
    const exported = [...s.matchAll(/^export async function (\w+)/gm)].map((m) => m[1] ?? '');
    assert.deepEqual(exported.sort(), Object.keys(gates).sort(), `${f}: a new action needs its area gate listed here`);
    for (const [fn, gate] of Object.entries(gates)) {
      const b = body(s, fn, f);
      for (const later of ['createAdminClient()', '.rpc(', 'transitionModeration(', 'markPayoutPaid(', 'holdPayout(']) {
        before(b, gate, later, `${f} · ${fn}`);
      }
    }
  }
});

test('A8·E-2 · a resolved force-majeure flag is closed to re-resolution', () => {
  const f = 'app/admin/force-majeure/actions.ts';
  const b = body(read(f), 'resolveFlag', f);
  const update = b.slice(b.indexOf('.update({'), b.indexOf('.select('));
  assert.match(update, /\.is\('resolved_at', null\)/, 'the update only touches an unresolved flag');
  before(b, /if \(!updated\) refuse\(/, 'emitNotification(', 'resolveFlag');
});

test('A8·E-13 · a refused flag resolution is said on its page, never the crash page', () => {
  const f = 'app/admin/force-majeure/actions.ts';
  const b = body(read(f), 'resolveFlag', f);
  assert.match(b, /const refuse: \(msg: string\) => never = \(msg\) =>\s*redirect\(`\/admin\/force-majeure\/\$\{encodeURIComponent\(flagId\)\}\?error=1&msg=/);
  assert.doesNotMatch(b, /throw new Error\((?!'Invalid input')/, 'every refusal after the id check is said, not thrown');
});

test('A8·A-6 · a founder seat goes to an exact email match, and a failed read is said', () => {
  const f = 'app/admin/founder-seats/actions.ts';
  const s = read(f);
  const grant = body(s, 'grantFounderSeat', f);
  assert.match(grant, /\.ilike\('email', email\.replace\(\/\[\\\\%_\]\/g, \(c\) => `\\\\\$\{c\}`\)\)/, 'wildcards are escaped');
  before(grant, /if \(targetErr\) \{\s*fail\(/, 'if (!target)', 'grantFounderSeat');
  const revoke = body(s, 'revokeFounderSeat', f);
  before(revoke, /if \(seatErr\) fail\(/, 'is already empty', 'revokeFounderSeat');
});

test('A8·F-17 · an unread channel status refuses the disconnect', () => {
  const f = 'app/admin/live-studio-channels/actions.ts';
  const b = body(read(f), 'disconnectChannel', f);
  before(b, /if \(currentErr \|\| !current\) \{\s*redirect/, 'revokePoolChannelGrant(', 'disconnectChannel');
});
