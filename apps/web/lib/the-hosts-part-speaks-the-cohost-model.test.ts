/**
 * the-hosts-part-speaks-the-cohost-model.test.ts — the Hosts part of the Guest
 * list describes the seats the DATABASE holds, not the pre-2026-09-28 model.
 *
 * Owner 2026-09-28 ("CO-HOSTS COME FROM THE GUEST LIST — FINAL MODEL", migration
 * 20271251336140): a full co-host seat is a `couple` member equal to the creator;
 * a limited helper / hired planner is a `coordinator`; a seat picked from the
 * guest list WAITS (user_id null — never accepted_at null, which is DEFAULT
 * now()) until that guest has joined. The page predated all of it, and on
 * 2026-09-30 the owner found his Bride listed as a coordinator. The colour card
 * was fixed first (colour-access-lists-only-coordinators.test.ts); this holds
 * the rest of the page to the same model:
 *
 *   1. live vs waiting is split on `user_id`, and a guest-list seat (no
 *      invitation token) is LISTED as waiting — the sentence above the list
 *      already described it;
 *   2. a seat is named by the guest list's Access word (Co-host · Limited
 *      helper), never "Viewer (read-only)" or the role subtype;
 *   3. the per-area grants, budget / photo toggles and the coordinator removal
 *      reasons are drawn for COORDINATOR seats only — a full co-host holds the
 *      same access as the creator and needs no grant; the actions refuse it too;
 *   4. the empty state no longer points at a form that is gone.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { seatAccessWord, ACCESS_LEVEL_LABEL } from '@/lib/guest-access';
import { stripComments } from '@/lib/strip-comments';

const here = dirname(fileURLToPath(import.meta.url));
const PAGE = stripComments(readFileSync(join(here, '../app/dashboard/[eventId]/hosts/page.tsx'), 'utf8'));
const ACTIONS = stripComments(readFileSync(join(here, '../app/dashboard/[eventId]/hosts/actions.ts'), 'utf8'));

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

test('live and waiting are split on user_id, and a guest-list seat is listed as waiting', () => {
  assert.match(PAGE, /const accepted = all\.filter\(\(r\) => r\.user_id\);/, 'live seats are not those with an account');
  assert.match(
    PAGE,
    /const pending = all\.filter\(\(r\) => !r\.user_id && \(r\.guest_id \|\| r\.invitation_token\)\);/,
    'a waiting guest-list seat (no token) is not listed',
  );
  assert.doesNotMatch(PAGE, /filter\(\(r\) => r\.accepted_at\)/, 'the split is on accepted_at again — it is DEFAULT now()');
  assert.match(PAGE, /'moderator_id, user_id, guest_id, role_subtype/, 'the seat read no longer carries guest_id');
  assert.match(PAGE, /\.from\('guests'\)\s*\.select\(ENTOURAGE_COLUMNS\)[\s\S]{0,120}\.in\('guest_id', seatGuestIds\)/, 'the seats’ guest rows are not read (through the canonical column list)');
  assert.match(PAGE, /data-waiting-guest-seat=""/, 'a waiting guest seat is not drawn');
});

test('a seat is named by its Access word, never by role_subtype’s label', () => {
  const list = PAGE.slice(PAGE.indexOf('Current hosts ·'), PAGE.indexOf('<CoordinatorColourDomains'));
  assert.match(list, /\{seatAccessWord\(row\.role_subtype\) \?\? ROLE_SUBTYPE_LABEL\[row\.role_subtype\]\}/);
  assert.doesNotMatch(list, /\{ROLE_SUBTYPE_LABEL\[row\.role_subtype\]\}/, 'a seat is labelled "Viewer (read-only)" / "Bride" again');
  const colour = PAGE.slice(PAGE.indexOf('colourGrantees = accepted'), PAGE.indexOf('const justSent'));
  assert.match(colour, /seatAccessWord\(r\.role_subtype\) \?\? ROLE_SUBTYPE_LABEL/, 'the colour card’s role line is the old label');
});

test('grants, toggles and coordinator removal reasons are drawn for coordinator seats only', () => {
  const list = PAGE.slice(PAGE.indexOf('Current hosts ·'), PAGE.indexOf('<CoordinatorColourDomains'));
  assert.match(list, /const fullCohost = seatIsFullCohost\(row\.role_subtype\);/);
  assert.match(
    list,
    /fullCohost \? \(\s*<CohostSeatControls[\s\S]*?\) : \(\s*<CoordinatorSeatControls/,
    'the two seat kinds no longer get their own controls',
  );
  assert.match(list, /fullCohost \? \(\s*<p[^>]*>The same access to this event as you\.<\/p>\s*\) : \(\s*<CoordinatorGrantChips/);
  // The grant and removal forms live ONLY inside the coordinator component.
  const coordinator = fn(PAGE, 'CoordinatorSeatControls');
  for (const piece of ['action={setDelegateBudget}', 'action={setDelegatePhotos}', 'aria-label="Reason for removing this coordinator"']) {
    assert.ok(coordinator.includes(piece), `CoordinatorSeatControls lost ${piece}`);
    assert.equal((PAGE.match(new RegExp(piece.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length, 1, `${piece} is drawn somewhere else too`);
  }
  const cohost = fn(PAGE, 'CohostSeatControls');
  assert.doesNotMatch(cohost, /setDelegateBudget|setDelegatePhotos|name="reason"/, 'a co-host is offered a coordinator’s grants or reasons');
  assert.match(cohost, /lock === 'celebrant'/, 'a celebrant co-host is offered a Remove the database refuses');
  assert.match(cohost, /guests\/\$\{guestId\}/, 'a guest-list seat is not sent to where its Access is set');
});

test('the grant actions refuse a full co-host seat at the door', () => {
  for (const name of ['setDelegateBudget', 'setDelegatePhotos']) {
    const body = fn(ACTIONS, name);
    assert.match(body, /\.select\('permissions_json, role_subtype'\)/, `${name} does not read the seat’s kind`);
    assert.match(body, /seatIsFullCohost\(/, `${name} writes a grant on a co-host`);
  }
});

test('the empty state sends the couple to the guest list, not to a form that is gone', () => {
  assert.doesNotMatch(PAGE, /Use the form below/);
  assert.match(PAGE, /You&apos;re the only host so far\. On the guest list, set a guest&apos;s Access to/);
});
