import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { guestListParts, partHref, yourTeamBudgetHref, yourTeamParts } from './pillar-parts';

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

// ⚖ The Hosts fold (owner 2026-09-30): Hosts is no longer OFFERED — its pieces
// moved and `?gview=hosts` redirects to the list. A door that only bounces you
// back to where you stood is a dead door.
test('the Guest list holds Guests always, Check-in from the day onward, and no longer offers Hosts', () => {
  assert.deepEqual(keys(guestListParts({ eventId: 'E', phase: 'plan', current: 'roster' })), ['roster']);
  assert.deepEqual(keys(guestListParts({ eventId: 'E', phase: 'dayof', current: 'roster' })), ['roster', 'checkin']);
  assert.deepEqual(keys(guestListParts({ eventId: 'E', phase: 'after', current: 'roster' })), ['roster', 'checkin']);
});

test('a part on screen is always offered — the picker never shows a value it lacks', () => {
  assert.deepEqual(keys(guestListParts({ eventId: 'E', phase: 'plan', current: 'checkin' })), ['roster', 'checkin']);
  assert.deepEqual(keys(guestListParts({ eventId: 'E', phase: 'plan', current: 'hosts' })), ['roster', 'hosts']);
});

test('every Guest list part stays on the guest list page', () => {
  const hrefs = guestListParts({ eventId: 'E', phase: 'after', current: 'roster' }).map((p) => p.href);
  assert.deepEqual(hrefs, ['/dashboard/E/guests', '/dashboard/E/guests?gview=checkin']);
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

test('the guest list MOUNTS its parts: the picker, the shipped Hosts page and the shipped desk', () => {
  const page = read('guests', 'page.tsx');
  assert.equal((page.match(/<PillarPartPicker[\s/>]/g) ?? []).length, 2, 'the picker is missing from a guest list part');
  assert.match(page, /import EventHostsPage from '\.\.\/hosts\/page'/, 'Hosts is no longer the shipped page');
  assert.match(page, /import CheckinDeskPage from '\.\/checkin\/page'/, 'Check-in is no longer the shipped desk');
  assert.match(page, /<EventHostsPage[\s\S]*?gview: GUEST_LIST_PART_VIEW\.hosts/, 'the Hosts part does not tell the page it is embedded — it would redirect into itself');
  assert.match(page, /<CheckinDeskPage[\s\S]*?gview: GUEST_LIST_PART_VIEW\.checkin/, 'the desk does not know it is inside the guest list');
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

test('Your Team MOUNTS the shipped Budget page as its part, and the picker on the team', () => {
  const page = read('vendors', 'page.tsx');
  assert.match(page, /import BudgetPage from '\.\.\/budget\/page'/, 'Budget is no longer the shipped page');
  assert.match(page, /if \(sp\.part === YOUR_TEAM_BUDGET_PART\)[\s\S]*?<BudgetPage[\s\S]*?part: YOUR_TEAM_BUDGET_PART/, 'the Budget part is not rendered, or does not tell the page it is embedded');
  assert.match(page, /partPicker=\{teamPartPicker\}/, 'the takeover lost the part picker');
  assert.match(read('vendors', '_components', 'services-takeover.tsx'), /\{partPicker \?/, 'the takeover no longer places the picker');
});

test('/budget lands in Your Team only where Your Team exists', () => {
  const page = read('budget', 'page.tsx');
  assert.match(
    page,
    /if \(YOUR_TEAM_BUDGET_PART !== \(await searchParams\)\?\.part && profile\.marketplaceEnabled === true\)/,
    'the budget redirect is not gated on the embedded marker and on Your Team existing',
  );
});
