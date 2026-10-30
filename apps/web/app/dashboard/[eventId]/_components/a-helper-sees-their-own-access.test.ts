/**
 * a-helper-sees-their-own-access.test.ts — a HELPER's ⚙ on Home opens the same Event Settings sheet, holding ONE row,
 * "Your access": their role and what they can open, read-only. The hosts' sheet is unchanged.
 *
 * Owner, 2026-10-31 (DECISION_LOG "A HELPER SEES THEIR OWN ACCESS AS THE FIRST ROW OF HOME ⚙ EVENT SETTINGS"): *"Yes"*
 * to — in the sheet where the hosts manage People with access (#7106), a helper (coordinator / limited helper) sees a
 * first row "Your access", read-only; hosts see their management rows as today.
 *
 * Held here, as properties:
 *   1 · the row is built from the hosts' own parts (`ownAccessOf` → `areaCells`, the hosts' role words, the access
 *       window's last day) — never a second rule;
 *   2 · "Your access" is the sheet's FIRST row, and it draws nothing pressable but its ⓘ (no toggle, no pill, no link);
 *   3 · the action hands a helper (a seat inside its window) "Your access" ALONE — their own seat, the session client,
 *       no host editor, no one else's row — and a stranger a refusal; both before the hosts' round;
 *   4 · Home gives a helper the ⚙ (a `coordinator` member — every non-host seat), never the Date Finder, and the sheet's
 *       line is the helper's; the couple's ⚙ is unchanged.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from '@/lib/strip-comments';
import { areaCells, ownAccessOf } from '@/lib/people-with-access';
import { COORDINATOR_AREAS, type ModeratorPermissions } from '@/lib/delegate-areas';
import { LIMITED_AREAS } from '@/lib/coordinator-access-level';
import { HOME_HELPER_SHEET, SETTINGS_ENTRY } from '@/lib/menu-settings';

// `"jsx": "preserve"` — the components' JSX reads a global React (the harness every render test here uses).
(globalThis as unknown as { React: unknown }).React = React;

const HERE = dirname(fileURLToPath(import.meta.url));
const code = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));
const perms = (areas: ModeratorPermissions['areas'], extra: Record<string, unknown> = {}): ModeratorPermissions =>
  ({ edit_all: false, checkout: false, invite_hosts: false, remove_hosts: false, areas, ...extra }) as ModeratorPermissions;
const DAY = { eventDate: '2026-12-18', eventEndDate: null, precision: 'day' } as const;

test('1 · Your access is the hosts’ own row for this person — role word, cells, last day', () => {
  const helper = ownAccessOf({ roleSubtype: 'viewer', permissions: perms({ ...LIMITED_AREAS }), window: DAY });
  assert.equal(helper.roleWord, 'Limited helper', 'a limited helper is not named as the hosts name them');
  assert.ok(helper.areas.length > 0 && helper.areas.every((c) => c.choice === 'view'), 'a limited helper’s grant is not every part View');

  const coordinatorGrant = perms({ ...COORDINATOR_AREAS });
  const coordinator = ownAccessOf({ roleSubtype: 'wedding_planner_external', permissions: coordinatorGrant, window: DAY });
  assert.equal(coordinator.roleWord, 'Coordinator');
  // The SAME cells the hosts' row draws for this seat — never a second reading of the grant.
  assert.deepEqual(coordinator.areas, areaCells(coordinatorGrant), 'Your access reads the grant differently from the hosts’ row');
  assert.equal(coordinator.areas.find((c) => c.area === 'guest_list')?.choice, 'edit');
  assert.equal(coordinator.areas.find((c) => c.area === 'budget')?.choice, 'off');

  const limited = ownAccessOf({
    roleSubtype: 'wedding_planner_external',
    permissions: perms({ ...LIMITED_AREAS }, { access_level: 'limited' }),
    window: DAY,
  });
  assert.equal(limited.roleWord, 'Coordinator · Limited', 'the hosts’ Limited answer is not said to the coordinator');

  // Seven days after the event (`delegateAccessLastDay`); no day-precise date → no "until".
  assert.equal(helper.lastDay, '2026-12-25');
  assert.equal(ownAccessOf({ roleSubtype: 'viewer', permissions: null, window: { ...DAY, precision: 'month' } }).lastDay, null);
});

test('2 · Your access is the FIRST row, and nothing in it is pressable but its ⓘ', async () => {
  const { YourAccess } = await import('../details/_components/your-access');
  const rows = code('event-settings-rows.tsx');
  assert.match(rows, /import \{ YourAccess \} from '\.\.\/details\/_components\/your-access'/, 'the sheet draws its own copy of Your access');
  assert.equal((rows.match(/<YourAccess\b/g) ?? []).length, 1, 'Your access is not mounted exactly once');
  const body = rows.slice(rows.indexOf('data-event-settings-body'));
  const first = body.indexOf('row="your-access"');
  assert.ok(first >= 0, 'the sheet has no Your access row');
  for (const later of ['data-event-settings-dock', 'row="names"', 'row="access"']) {
    assert.ok(body.indexOf(later) > first, `Your access is not before ${later}`);
  }
  assert.match(body, /\{yours \? \(\s*<FactRow row="your-access" title="Your access">/, 'Your access is drawn without a helper’s access (a host’s sheet would show it)');

  // Rendered: the role line, one row per part as WORDS, and exactly one pressable thing — the ⓘ.
  const html = renderToStaticMarkup(
    createElement(YourAccess, { access: ownAccessOf({ roleSubtype: 'wedding_planner_external', permissions: perms({ ...COORDINATOR_AREAS }), window: DAY }) }),
  );
  assert.match(html, /Coordinator · until Dec 25, 2026/, 'the role line does not say who they are and until when');
  assert.equal((html.match(/<li\b/g) ?? []).length, areaCells(null).length, 'a part is missing from Your access');
  assert.match(html, /data-area="guest_list" data-level="edit"/);
  assert.equal((html.match(/<button\b/g) ?? []).length, 1, 'Your access draws something pressable besides its ⓘ — it is read-only');
  assert.doesNotMatch(html, /<a\b|<select\b|<input\b|role="radio/, 'Your access draws a control — it is read-only');
  // Frames only on what is pressed: the parts are words between dividers, never pills or boxes.
  const view = code('../details/_components/your-access.tsx');
  const fn = view.slice(view.indexOf('export function YourAccess('));
  assert.ok(fn.length > 0, 'YourAccess is gone — this check would pass vacuously');
  assert.doesNotMatch(fn, /rounded|\bborder\b|\bbg-|shadow|PillTrack|AreaToggle|onClick/, 'Your access frames or wires a part that is only read');
});

test('3 · the action hands a helper Your access ALONE, from their own seat, before the hosts’ round', () => {
  const action = code('open-event-settings.tsx');
  const branch = action.slice(action.indexOf('if (!viewer.isCouple) {'), action.indexOf('const [draft, parents, people, claims, settings]'));
  assert.ok(branch.length > 0, 'the non-host branch is gone, or sits after the hosts’ round');
  assert.match(branch, /if \(viewer\.delegatePermissions\) return yourAccessSheet\(supabase, eventId, user\.id, viewer\.delegatePermissions\)/, 'a helper inside their window is not handed their own access');
  assert.match(branch, /return \{ ok: false, reason:/, 'a non-host who is not a helper is not refused');

  const sheet = action.slice(action.indexOf('async function yourAccessSheet('));
  assert.ok(sheet.length > 0, 'yourAccessSheet is gone — this check would pass vacuously');
  assert.doesNotMatch(sheet, /createAdminClient|admin\./, 'a helper’s sheet reads with the service role — RLS must scope it to their own seat');
  assert.match(sheet, /\.from\('event_moderators'\)[\s\S]*?\.eq\('user_id', userId\)/, 'the helper’s sheet reads a seat that is not their own');
  assert.doesNotMatch(sheet, /loadPeopleWithAccess|readClaimAccessAsks|loadYourEvent|loadEventSettings/, 'a helper’s sheet reads the hosts’ rows');
  assert.match(sheet, /<EventSettingsRows eventId=\{eventId\} input=\{null\} parents=\{null\} dock=\{null\} yours=\{yours\} \/>/, 'a helper’s sheet draws more than Your access');
  assert.match(sheet, /seatRes\.error \|\| datesRes\.error \|\| !seatRes\.data\) \{[\s\S]*?return \{ ok: false/, 'a refused read draws a made-up role instead of saying so');

  // The hosts' sheet is unchanged: it never carries `yours`.
  const hosts = action.slice(0, action.indexOf('async function yourAccessSheet('));
  assert.equal((hosts.match(/yours=/g) ?? []).length, 0, 'the hosts’ sheet draws a Your access row');
});

test('4 · Home gives a helper the ⚙ (their own line), never the Date Finder; the couple’s is unchanged', () => {
  const page = code('../page.tsx');
  assert.match(page, /eventSettings=\{viewerMemberType === 'couple'\}/, 'the couple’s ⚙ changed');
  assert.match(page, /helperSettings=\{viewerMemberType === 'coordinator'\}/, 'a helper (a `coordinator` member) gets no ⚙');

  const first = code('home-first-screen.tsx');
  assert.match(first, /settingsFor=\{eventSettings \|\| helperSettings \? eventId : undefined\}/, 'the helper’s ⚙ is not mounted');
  assert.match(first, /settingsHelper=\{!eventSettings && helperSettings\}/, 'a host’s ⚙ could be drawn as a helper’s');
  assert.match(first, /\{eventSettings \? <HomeDateFinder\b/, 'the Date Finder is offered to someone who cannot change the date');

  assert.match(code('home-cover-band.tsx'), /helper=\{settingsHelper\}/, 'the band does not say the ⚙ is a helper’s');
  const gear = code('home-settings-gear.tsx');
  assert.match(gear, /line=\{helper \? HOME_HELPER_SHEET : undefined\}/, 'a helper’s sheet says the hosts’ line');
  assert.match(code('../../../_components/menu-settings-button.tsx'), /label=\{line\?\.line \?\? entry\.line\}/, 'the sheet ignores its line');
  assert.doesNotMatch(HOME_HELPER_SHEET.line, /names|date|venues/i, 'the helper’s line names facts only the hosts change');
  assert.notEqual(HOME_HELPER_SHEET.line, SETTINGS_ENTRY.home.line);
});
