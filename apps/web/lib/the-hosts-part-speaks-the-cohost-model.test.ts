/**
 * the-hosts-part-speaks-the-cohost-model.test.ts — every screen that shows a
 * host SEAT describes the seats the DATABASE holds, not the pre-2026-09-28
 * model.
 *
 * Owner 2026-09-28 ("CO-HOSTS COME FROM THE GUEST LIST — FINAL MODEL", migration
 * 20271251336140): a full co-host seat is a `couple` member equal to the creator;
 * a limited helper / hired planner is a `coordinator`; a seat picked from the
 * guest list WAITS (user_id null — never accepted_at null, which is DEFAULT
 * now()) until that guest has joined. On 2026-09-30 the owner found his Bride
 * listed as a coordinator.
 *
 * ⚖ THE HOSTS FOLD (owner 2026-09-30) moved the Hosts page's pieces; the rules
 * followed them rather than being dropped with the page:
 *
 *   1. live vs waiting is split on `user_id` — on the planner's workspace card
 *      and on the Overview's Hosts card (which had the same accepted_at bug);
 *   2. a seat is named by the guest list's Access word (Co-host · Limited
 *      helper), never "Viewer (read-only)" — the Overview and the own-access
 *      view both ask `seatAccessWord`;
 *   3. the per-area grants, budget / photo toggles and the coordinator removal
 *      reasons live in ONE component, drawn for coordinator seats only (the
 *      planner card lists planner seats, nothing else); the actions refuse a
 *      full co-host at the door too;
 *   4. /hosts itself offers no control at all any more.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { seatAccessWord, ACCESS_LEVEL_LABEL } from '@/lib/guest-access';
import { stripComments } from '@/lib/strip-comments';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => stripComments(readFileSync(join(here, '..', p), 'utf8'));
const HOSTS = read('app/dashboard/[eventId]/hosts/page.tsx');
const ACTIONS = read('app/dashboard/[eventId]/hosts/actions.ts');
const CONTROLS = read('app/dashboard/[eventId]/_components/coordinator-seat-controls.tsx');
const CARD = read('app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/promote-coordinator-card.tsx');
const OVERVIEW = read('app/dashboard/[eventId]/_components/event-dashboard.tsx');

/** The source of a top-level `function NAME(` up to the next top-level function. */
function fn(src: string, name: string): string {
  const at = src.indexOf(`function ${name}(`);
  assert.notEqual(at, -1, `${name} is gone — this guard is pinning a ghost`);
  const next = src.indexOf('\nfunction ', at + 1);
  const nextExport = src.indexOf('\nexport ', at + 1);
  const ends = [next, nextExport].filter((i) => i !== -1);
  return src.slice(at, ends.length ? Math.min(...ends) : undefined);
}

test('seatAccessWord says the guest list’s words, and keeps the planner’s own', () => {
  for (const k of ['co_host', 'host', 'bride', 'groom', 'partner1', 'partner2', 'celebrant']) {
    assert.equal(seatAccessWord(k), ACCESS_LEVEL_LABEL.co_host, k);
  }
  for (const k of ['viewer', 'family_helper', 'maid_of_honor', 'ninong']) {
    assert.equal(seatAccessWord(k), ACCESS_LEVEL_LABEL.limited_helper, k);
  }
  assert.equal(seatAccessWord('wedding_planner_external'), null, 'the hired planner is not a guest-list access');
  assert.deepEqual(Object.values(ACCESS_LEVEL_LABEL), ['None', 'Co-host', 'Limited helper'], 'the owner’s three words');
});

test('live and waiting are split on user_id wherever seats are listed', () => {
  assert.match(CARD, /const accepted = seats\.filter\(\(s\) => s\.user_id\);/, 'the planner card: live is not "has an account"');
  assert.match(CARD, /!s\.user_id &&\s*s\.invitation_token/, 'the planner card: a waiting invite is not "no account yet"');
  assert.match(OVERVIEW, /const acceptedMods = mods\.filter\(\(m\) => m\.user_id\);/, 'the Overview: live is not "has an account"');
  assert.match(
    OVERVIEW,
    /const pendingMods = mods\.filter\(\(m\) => !m\.user_id && \(m\.guest_id \|\| m\.invitation_token\)\);/,
    'the Overview: a waiting guest-list seat (no token) is not listed as waiting',
  );
  for (const [name, src] of [['card', CARD], ['Overview', OVERVIEW]] as const) {
    assert.doesNotMatch(src, /filter\(\(\w\) => \w\.accepted_at\)/, `${name}: the split is on accepted_at again — it is DEFAULT now()`);
  }
});

test('a seat is named by its Access word, never by role_subtype’s label first', () => {
  assert.match(OVERVIEW, /m\.display_label \?\?\s*seatAccessWord\(m\.role_subtype\) \?\?/, 'the Overview says "Bride" / "Viewer (read-only)" again');
  assert.match(HOSTS, /seatAccessWord\(s\.role_subtype\) \?\?/, 'the own-access view says the old label');
});

test('grants, toggles and coordinator removal reasons live in one component, for coordinator seats only', () => {
  const coordinator = fn(CONTROLS, 'CoordinatorSeatControls');
  for (const piece of ['action={setDelegateBudget}', 'action={setDelegatePhotos}', 'aria-label="Reason for removing this coordinator"']) {
    assert.ok(coordinator.includes(piece), `CoordinatorSeatControls lost ${piece}`);
    const esc = piece.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const [name, src] of [['/hosts', HOSTS], ['the planner card', CARD], ['the Overview', OVERVIEW]] as const) {
      assert.equal((src.match(new RegExp(esc, 'g')) ?? []).length, 0, `${piece} is drawn in ${name} too — one component holds it`);
    }
  }
  // The planner card only ever lists PLANNER seats — never a co-host's.
  assert.match(CARD, /\.eq\('role_subtype', PLANNER_SEAT_ROLE\)/, 'the planner card reads seats other than the planner’s');
  assert.match(CARD, /plannerSeatsForVendor\(/, 'the planner card no longer narrows seats to this booking');
});

test('the grant actions refuse a full co-host seat at the door', () => {
  for (const name of ['setDelegateBudget', 'setDelegatePhotos']) {
    const body = fn(ACTIONS, name);
    assert.match(body, /\.select\('permissions_json, role_subtype'\)/, `${name} does not read the seat’s kind`);
    assert.match(body, /seatIsFullCohost\(/, `${name} writes a grant on a co-host`);
  }
});

test('/hosts offers no control any more — its pieces moved', () => {
  assert.doesNotMatch(HOSTS, /<form\b|action=\{/, 'a control grew back on /hosts');
  assert.doesNotMatch(HOSTS, /inviteHost|revokeHostInvite|removeHost|setDelegate/, '/hosts reaches for a seat action again');
});
