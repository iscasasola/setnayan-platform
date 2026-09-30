/**
 * the-hosts-fold-moves-not-redraws.test.ts — build F1 of the Hosts fold.
 *
 * ⚖ Owner 2026-09-30 (DECISION_LOG "GUEST LIST: ACCESS + CHECK-IN BECOME
 * COLUMNS…" and "HOSTS FOLD — THREE OWNER ANSWERS"): Hosts folds into the Guest
 * list and its pieces MOVE, none re-invented. This pins the pieces F1 moved:
 *
 *   1. "Promote your booked coordinator" — with its RA 10173 consent step — is
 *      on the planner's supplier workspace, and ONLY a planner booking gets it;
 *   2. the Overview's Hosts card carries "What your helpers did", couple-only,
 *      from the same delegate stream, and its door goes to the guest list;
 *   3. old email co-hosts carry over ONLY when already linked to a guest row
 *      (the migration's predicate is the owner's definition, nothing looser).
 *
 * `/hosts` itself and the parts picker are pinned in `pillar-parts.test.ts`;
 * the seat rules in `the-hosts-part-speaks-the-cohost-model.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));
const WORKSPACE = read('app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx');
const CARD = read('app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/promote-coordinator-card.tsx');
const COLOUR_CARD = read('app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/colour-access-card.tsx');
const CONSENT = read('app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/consent-gated-invite-form.tsx');
const OVERVIEW = read('app/dashboard/[eventId]/_components/event-dashboard.tsx');

const MIGRATIONS = join(WEB, '..', '..', 'supabase', 'migrations');
const CARRY = (() => {
  const f = readdirSync(MIGRATIONS).find((n) => n.endsWith('_legacy_host_seats_join_their_linked_guest.sql'));
  assert.ok(f, 'the carry-over migration is gone');
  // SQL comments out, so a sentence ABOUT the rule can never satisfy it.
  return readFileSync(join(MIGRATIONS, f), 'utf8').replace(/--.*$/gm, '');
})();

test('a planner booking gets the Promote card, every other booking keeps its colour switch', () => {
  assert.match(
    WORKSPACE,
    /const colourAccessSection =\s*ev\.category === 'planner_coordinator' \? \(\s*<PromoteCoordinatorCard[\s\S]*?\) : \(\s*<ColourAccessCard/,
    'the workspace no longer routes a planner booking to the Promote card',
  );
  assert.doesNotMatch(COLOUR_CARD, /hosts|isCoordinatorBooking/, 'the colour card still points a planner at the Hosts page');
});

test('the invite still passes the RA 10173 consent step, and says where to come back', () => {
  assert.match(CARD, /const consentGateEnabled|, consentGateEnabled\]/, 'the card no longer reads the consent-gate flag');
  assert.match(CARD, /isCoordinatorConsentGateEnabled\(\)/);
  assert.match(
    CARD,
    /<ConsentGatedInviteForm enabled=\{consentGateEnabled\} forceCoordinator[\s\S]*?name="vendor_id" value=\{vendor\.vendor_id\}[\s\S]*?<\/ConsentGatedInviteForm>/,
    'the invite form lost its consent gate, or its way back to this workspace',
  );
  assert.match(CONSENT, /action=\{inviteHost\}/, 'the consent form no longer posts to the one invite action');
  assert.match(CONSENT, /from '@\/app\/dashboard\/\[eventId\]\/hosts\/actions'/, 'the invite action was copied instead of moved');
});

test('the Promote card is the couple’s only, like every action behind it', () => {
  assert.match(
    CARD,
    /\.from\('event_members'\)[\s\S]*?\.eq\('user_id', user\.id\)[\s\S]*?if \(\(member as \{ member_type\?: string \} \| null\)\?\.member_type !== 'couple'\) return null;/,
  );
  // Every seat form names this booking, so the action lands back here.
  const forms = CARD.match(/<form action=\{revokeHostInvite\}>[\s\S]*?<\/form>/g) ?? [];
  assert.equal(forms.length, 1, 'the waiting invite lost its Revoke');
  assert.match(forms[0] ?? '', /name="vendor_id"/);
  assert.match(CARD, /returnTo=\{\{ vendorId: vendor\.vendor_id \}\}/);
});

test('a waiting planner invite shows until it expires, then is gone', () => {
  assert.match(CARD, /!s\.invitation_expires_at \|\| new Date\(s\.invitation_expires_at\)\.getTime\(\) > now/);
});

test('the Overview carries "What your helpers did", couple-only, from the one stream', () => {
  assert.match(OVERVIEW, /return fetchDelegateActivity\(adminClient, eventId, 5\);/, 'the feed reads its own copy of the stream');
  const block = OVERVIEW.slice(OVERVIEW.lastIndexOf('(async () => {', OVERVIEW.indexOf('return fetchDelegateActivity(')));
  assert.match(
    block.slice(0, block.indexOf('return fetchDelegateActivity(')),
    /member_type !== 'couple'\) return null;/,
    'the feed is shown to a coordinator — "your coordinator did X" is the couple’s',
  );
  assert.match(OVERVIEW, /data-helper-activity/);
  assert.match(OVERVIEW, /What your helpers did/);
  // A refused read says so; an empty stream says nothing — never "nothing" for a refusal.
  assert.match(OVERVIEW, /helperActivity !== null && \(!helperActivity\.measured \|\| helperActivity\.lines\.length > 0\)/);
  assert.match(OVERVIEW, /fullHref=\{`\$\{base\}\/guests`\}\s*fullLabel="Set access on the guest list"/, 'the Hosts card still sends the couple to /hosts');
});

test('old email co-hosts carry over ONLY when already linked to a guest row on that event', () => {
  // The owner's definition: the seat's user has an event_members row on the
  // SAME event with a guest_id, and that guest is on this event's list.
  assert.match(CARRY, /JOIN public\.event_members AS em\s+ON em\.event_id = m\.event_id\s+AND em\.user_id\s+= m\.user_id/);
  assert.match(CARRY, /JOIN public\.guests AS g\s+ON g\.guest_id = em\.guest_id\s+AND g\.event_id = m\.event_id\s+AND g\.deleted_at IS NULL/);
  for (const clause of [
    /m\.guest_id IS NULL/,
    /m\.removed_at IS NULL/,
    /m\.user_id IS NOT NULL/,
    /em\.guest_id IS NOT NULL/,
    /m\.role_subtype <> 'wedding_planner_external'/,
    /em\.joined_via IS DISTINCT FROM 'created_event'/,
  ]) {
    assert.match(CARRY, clause, `the carry-over lost ${clause}`);
  }
  // Never matched on an email — a matching email is not a link.
  assert.doesNotMatch(CARRY, /email/i, 'the carry-over matches on email — that is not the owner’s "linked"');
  // It writes guest_id and nothing else about the seat: level, account and access stay as they are.
  const set = CARRY.slice(CARRY.indexOf('SET'), CARRY.indexOf('FROM candidate'));
  assert.match(set, /guest_id\s+= c\.guest_id/);
  assert.doesNotMatch(set, /role_subtype|user_id|removed_at|permissions_json|accepted_at/);
  assert.match(CARRY, /RAISE NOTICE/, 'the carry-over no longer reports how many it moved');
});
