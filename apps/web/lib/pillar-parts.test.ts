import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { partHref, yourTeamBudgetHref, yourTeamParts } from './pillar-parts';
import * as pillarParts from './pillar-parts';

/**
 * ⚖ The pillars' parts, pinned (owner 2026-09-29: "this is what an event
 * needs. Guestlist · Your Team · Event Hub Maker · Our Services" — Hosts and
 * Check-in inside the Guest list, Budget inside Your Team).
 *
 * The event menu's Hosts, Check-in and Budget rows are removed LAST (Stage D),
 * on the strength of these parts being the screens' new home. A part that
 * silently stops rendering would make that removal delete a feature — so the
 * list is executed, and each pillar page is checked to MOUNT what it lists.
 */

const read = (...p: string[]) =>
  stripComments(readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', ...p), 'utf8'));
const keys = (parts: { key: string }[]) => parts.map((p) => p.key);

// ⚖ F2 (owner 2026-09-30, "GUEST LIST: ACCESS + CHECK-IN BECOME COLUMNS; HOSTS
// FOLDS INTO THE GUEST LIST" (6)): the Guest list's parts row was cut LAST, once
// Access and Check-in were columns and Hosts' pieces had moved. No part list is
// left to offer, and every old part address still lands somewhere true.
test('the Guest list has no parts row — and its old part addresses land', () => {
  assert.ok(!('guestListParts' in pillarParts), 'the Guest list parts list is back');
  assert.ok(!('GUEST_LIST_PART_VIEW' in pillarParts), 'the Guest list part views are back');
  const page = read('guests', 'page.tsx');
  assert.doesNotMatch(page, /<PillarPartPicker\b|EventHostsPage|CheckinDeskPage/, 'the Guest list draws a part again');
  assert.match(page, /if \(search\.gview === 'hosts'\) redirect\(`\/dashboard\/\$\{eventId\}\/hosts`\);/, 'an old Hosts part link dead-ends');
  assert.match(page, /if \(search\.gview === 'checkin'\) redirect\(`\/dashboard\/\$\{eventId\}\/guests\/checkin`\);/, 'an old Check-in part link does not reach the desk');
  // The desk is the door crew's own page again, with its own <h1>.
  const desk = read('guests', 'checkin', 'page.tsx');
  assert.doesNotMatch(desk, /embedded/, 'the desk still expects to be drawn inside the Guest list');
  assert.match(desk, /<h1\b/);
});

test('Your Team holds the team and the Budget, both on the Your Team page', () => {
  assert.deepEqual(
    yourTeamParts({ eventId: 'E', budgetEnabled: true }).map((p) => [p.key, p.label, p.href]),
    [
      ['team', 'Suppliers', '/dashboard/E/vendors'],
      ['budget', 'Budget', '/dashboard/E/vendors?part=budget'],
    ],
  );
  assert.equal(yourTeamBudgetHref('E'), '/dashboard/E/vendors?part=budget');
});

test('an event type without the budget surface is never offered a Budget that sends it home', () => {
  assert.deepEqual(keys(yourTeamParts({ eventId: 'E', budgetEnabled: false })), ['team']);
  assert.match(read('vendors', 'page.tsx'), /yourTeamParts\(\{ eventId, budgetEnabled: surfaceEnabled\(profile, 'budget'\) \}\)/, 'Your Team no longer asks the budget surface');
});

test('an old route lands in its part with every param it carried', () => {
  // hosts/actions.ts redirects to /hosts?invite_sent=1&token=… — the share
  // link banner reads that token. Dropping it would hide the link just sent.
  assert.equal(
    partHref('/dashboard/E/guests', { invite_sent: '1', token: 'abc', gview: 'list' }, { gview: 'hosts' }),
    '/dashboard/E/guests?invite_sent=1&token=abc&gview=hosts',
  );
  assert.equal(partHref('/dashboard/E/guests', {}, { gview: 'hosts' }), '/dashboard/E/guests?gview=hosts');
});

test('/hosts lands on the Guest list for anybody who can see it, and keeps a helper without it', () => {
  const page = read('hosts', 'page.tsx');
  const gate = page.slice(page.indexOf('fetchEventViewer(supabase'), page.indexOf('createAdminClient()'));
  assert.match(
    gate,
    /if \(!isDelegateWithoutArea\(viewer, 'guest_list'\)\) redirect\(`\/dashboard\/\$\{eventId\}\/guests`\);/,
    'the couple / a guest-list holder is no longer sent to the Guest list',
  );
  assert.ok(
    gate.indexOf("redirect('/dashboard')") < gate.indexOf('isDelegateWithoutArea'),
    'a stranger must be turned away before the guest-list redirect is asked',
  );
  assert.match(page, /data-own-access/, 'a helper without the guest list lost their own access view');
  assert.doesNotMatch(page, /<form|action=\{/, '/hosts grew a control again — its controls moved (the Hosts fold)');
});

test('Your Team MOUNTS the shipped Budget page as its part, and offers it from the team', () => {
  const page = read('vendors', 'page.tsx');
  assert.match(page, /import BudgetPage from '\.\.\/budget\/page'/, 'Budget is no longer the shipped page');
  assert.match(page, /if \(sp\.part === YOUR_TEAM_BUDGET_PART\)[\s\S]*?<BudgetPage[\s\S]*?part: YOUR_TEAM_BUDGET_PART/, 'the Budget part is not rendered, or does not tell the page it is embedded');
  // ⚖ Owner 2026-10-03: Budget is a visible row of "Your planning" (it was
  // behind ⋯ from 2026-10-01). Still the part from `yourTeamParts`, still a
  // link to its own URL — only its place moved.
  assert.match(page, /teamParts=\{teamParts\}/, 'the takeover lost the Your Team parts');
  const takeover = read('vendors', '_components', 'services-takeover.tsx');
  assert.match(takeover, /<PlanningList budgetHref=\{teamParts\?\.find\(\(p\) => p\.key === 'budget'\)\?\.href\}/, 'the takeover no longer offers the Budget part');
  const list = read('vendors', '_components', 'planning-list.tsx');
  assert.match(list, /<Link href=\{budgetHref\}/, 'the Your planning list no longer links Budget');
});

test('/budget lands in Your Team only where Your Team exists', () => {
  const page = read('budget', 'page.tsx');
  assert.match(
    page,
    /if \(YOUR_TEAM_BUDGET_PART !== \(await searchParams\)\?\.part && profile\.marketplaceEnabled === true\)/,
    'the budget redirect is not gated on the embedded marker and on Your Team existing',
  );
});
