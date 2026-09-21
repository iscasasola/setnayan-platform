import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { rosterDoors } from './roster-doors';

/**
 * ⚖ The guest list's doors, pinned. When the masthead's buttons moved into one
 * row of tabs (owner 2026-09-20), 32 CI guards and 2,826 tests stayed green —
 * because none of them looked. Every nearby test checks a DESTINATION page;
 * none checked that the guest list still had a way in. This one does.
 */

const doors = (o: Partial<Parameters<typeof rosterDoors>[0]> = {}) =>
  rosterDoors({ eventId: 'E', view: 'list', finished: false, hasProcessional: true, hasJoinLink: true, ...o });
const keys = (d: ReturnType<typeof doors>) => ({
  tabs: d.tabs.map((x) => x.key),
  trailing: d.trailing.map((x) => x.key),
});

test('before a wedding: Roster · Wedding March · Share the link, and Arrange the room', () => {
  assert.deepEqual(keys(doors()), { tabs: ['roster', 'walk', 'share'], trailing: ['arrange'] });
});

test('no processional, no Wedding March — a birthday walks down no aisle', () => {
  assert.deepEqual(keys(doors({ hasProcessional: false })).tabs, ['roster', 'share']);
});

test('after the event: inviting and arranging stop; Check-in and the quick Share remain', () => {
  // Inviting people to a celebration that already happened is "the one door
  // that stops making sense" (the page's own note). The quick copy survives,
  // because the link still lets guests into the event page afterwards.
  assert.deepEqual(keys(doors({ finished: true })), { tabs: ['roster'], trailing: ['checkin', 'share-menu'] });
  assert.deepEqual(keys(doors({ finished: true, hasJoinLink: false })).trailing, ['checkin']);
});

test('before the event there is ONE share door, not two', () => {
  // The move's only removal: "Invite guests" and the Share dropdown both handed
  // out the same link. Two again is the duplicate coming back.
  const d = doors();
  const shareish = [...d.tabs, ...d.trailing].filter((x) => x.key === 'share' || x.key === 'share-menu');
  assert.equal(shareish.length, 1, JSON.stringify(shareish));
});

test('each door goes where it always went', () => {
  const all = [...doors().tabs, ...doors().trailing, ...doors({ finished: true }).trailing];
  const href = (k: string) => (all.find((x) => x.key === k) as { href?: string } | undefined)?.href;
  assert.equal(href('roster'), '/dashboard/E/guests');
  assert.equal(href('walk'), '/dashboard/E/guests?gview=walk');
  assert.equal(href('share'), '/dashboard/E/guests/invite');
  assert.equal(href('arrange'), '/dashboard/E/seating');
  assert.equal(href('checkin'), '/dashboard/E/guests/checkin');
});

test('exactly one tab is current, and the mind map keeps Roster lit', () => {
  for (const view of ['list', 'map', 'walk'] as const) {
    const current = doors({ view }).tabs.filter((x) => x.kind === 'tab' && x.current).map((x) => x.key);
    assert.deepEqual(current, [view === 'walk' ? 'walk' : 'roster'], `view=${view}`);
  }
});

test('the page MOUNTS the row, and feeds it the real conditions', () => {
  // A correct rule that nothing renders protects nothing. Matched at a tag
  // boundary, comments stripped, so prose about <RosterTabs> cannot pass it.
  const page = stripComments(
    readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests', 'page.tsx'), 'utf8'),
  );
  const mounts = page.match(/<RosterTabs[\s/>]/g) ?? [];
  assert.equal(mounts.length, 1, `found ${mounts.length} <RosterTabs> mounts`);
  const tag = page.slice(page.indexOf('<RosterTabs'), page.indexOf('/>', page.indexOf('<RosterTabs')));
  for (const prop of ['finished={finished}', 'hasProcessional={hasProcessional}', 'view={gview}']) {
    assert.ok(tag.includes(prop), `<RosterTabs> is not given ${prop} — its doors would ignore the event's real state`);
  }
  // And the doors did not ALSO stay in the masthead, which would be every
  // door twice.
  const masthead = page.slice(page.indexOf('<PageMasthead'), page.indexOf('/>', page.indexOf('<PageMasthead')));
  assert.ok(!/actions=\{/.test(masthead), 'the masthead still carries actions — the doors are now on screen twice');
});
