import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { budgetPageHref, partHref, schedulePageHref } from './pillar-parts';
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

test('no pillar holds parts any more — Budget and Schedule are each ONE address, Home\'s own pages', () => {
  // 🧹 Owner 2026-11-02 ("BOOKED IS JUST THE TEAM"): Your Team's Budget part and Booked's Team · Budget · Schedule are gone.
  for (const gone of ['yourTeamParts', 'bookedParts', 'bookedScheduleHref', 'bookedTeamHref', 'yourTeamBudgetHref']) {
    assert.ok(!(gone in pillarParts), `${gone} is back — a pillar offers parts again`);
  }
  assert.equal(budgetPageHref('E'), '/dashboard/E/budget');
  assert.equal(budgetPageHref('E', { pay: 'li 1' }), '/dashboard/E/budget?pay=li%201');
  assert.equal(schedulePageHref('E'), '/dashboard/E/schedule');
  assert.equal(schedulePageHref('E', { view: 'preparation', sheet: '', note: null }), '/dashboard/E/schedule?view=preparation');
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

test('Suppliers draws neither the Budget nor the Schedule — it forwards their old addresses, and keeps the team', () => {
  const page = read('vendors', 'page.tsx');
  assert.doesNotMatch(page, /import BudgetPage from|import CoupleSchedulePage from|<BookedPartPage\b/, 'Suppliers draws a Home page again — two places');
  assert.match(
    page,
    /if \(sp\.part === YOUR_TEAM_BUDGET_PART\) redirect\(budgetPageHref\(eventId, \{ pay: sp\.pay \}\)\);/,
    'the old Budget part address no longer forwards to the Budget page with its ?pay=',
  );
  assert.match(page, /bookedSlot=\{teamSlot\}/, 'the Suppliers screen lost its Booked body');
  const takeover = read('vendors', '_components', 'services-takeover.tsx');
  assert.match(takeover, /data-suppliers-body="booked"[\s\S]*?\{bookedSlot\}/, 'the Booked body is no longer mounted');
  // The Budget block under the team (a lab's) still links the one Budget page.
  const section = read('vendors', '_components', 'booked-budget.tsx');
  assert.match(section, /const budgetHref = budgetPageHref\(eventId\);/, 'the Budget block builds the Budget page\'s address by hand');
  assert.ok((section.match(/href=\{budgetHref\}/g) ?? []).length >= 1, 'the Budget section no longer links the Budget page');
});

test('/budget is its own page — it no longer lands in Suppliers (owner 2026-11-01, "Okay place it in home")', () => {
  // The property itself is held by `the-budget-page-is-one-place.test.ts`; this keeps the old pin's slot honest.
  const page = read('budget', 'page.tsx');
  assert.doesNotMatch(page, /YOUR_TEAM_BUDGET_PART|yourTeamBudgetHref/, 'the Budget page asks for the Suppliers part again');
});
