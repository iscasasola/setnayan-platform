/**
 * the-people-pinned-row.test.ts — 🔒 PEOPLE WEARS THE 27 OCT PINNED ROW, AND ITS GROUP ROWS READ LIKE CHATS.
 *
 * Owner 2026-10-28, verbatim: *"People and Groups approved. Send it to the build screen"* (DECISION_LOG "USER DASHBOARD
 * PART 1 — PEOPLE & GROUPS — APPROVED"; prototype `prototypes/user_dash_2026-10-28/` frames B–D). Held as properties:
 *
 *   1 · ONE PINNED ROW — each face's sticky block (`data-people-head`) holds exactly one `<PeoplePinnedRow>` and nothing
 *       else pressable; the row is the app's shared `PinnedRow`, its ⚙ the People `MenuSettingsButton`, mounted once;
 *   2 · ONE ACTION — the rendered row holds exactly one action, after the doors and before the ⚙ (the ⚙ is last);
 *       People's is Invite (the invite sheet), Groups' is ＋ New (the page that creates a group);
 *   3 · COUNTS ARE FILTERS — every door is a `aria-pressed` button whose tap sets the face's filter; a note replaces the
 *       doors (a refusal never shows a 0);
 *   4 · ROWS LINK TO THE GROUP — every group row opens `/dashboard/samahan/<id>`; the ring is drawn only with live
 *       stories; UNREAD (owner 2026-10-28) = a bold last line + a count badge on exactly the unread rows (none on a 0 or
 *       a refused count); the Groups row's one door is "N unread" and a refusal says "Couldn't load";
 *   5 · OPENING A GROUP MARKS IT READ — the group route's layout mounts `MarkGroupRead`, whose ONE `mark_samahan_read`
 *       call runs in an effect (never during render, so a link prefetch cannot mark a group read), no live connection.
 * (No second "New group": the-buttons-live-together.test.ts. One batched read: lib/people-group-rows.test.ts. One line
 * at 390: lib/the-pinned-row-is-one-row.test.ts + the Playwright walk.)
 *
 * Sabotage (2026-10-28, each reverted): a second `<PeoplePinnedRow` in the roster's head → 1 red; an Invite `<button>`
 * added beside the row in the Groups head → 1 red; a second action rendered by `PinnedRow` → 2 red; the ⚙ moved before
 * the action → 2 red; a door's `onTap` made a no-op `() => {}` → 3 red; the group row's href changed to
 * `/dashboard/samahan` → 4 red. Unread (2026-10-28): the badge drawn on `unread !== null` (so 0 shows) → 4 red; the
 * "Couldn't load" note dropped → 3 red; the rpc moved out of the effect into the body → 5 red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request.endsWith('.css') || request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const HERE = __dirname;
const read = (...p: string[]) => stripComments(readFileSync(join(HERE, ...p), 'utf8'));
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

/** The sticky block's JSX — from `data-people-head` to its closing `</div>`. */
function head(src: string): string {
  const at = src.indexOf('<div className={gs.stick} data-people-head="">');
  assert.ok(at > -1, 'the sticky block is gone');
  return src.slice(at, src.indexOf('</div>', src.indexOf('/>', src.indexOf('<PeoplePinnedRow', at))) + 6);
}

test('1 · each face has ONE pinned row, alone in its sticky block, and People mounts ONE ⚙', () => {
  for (const [file, face, view] of [
    ['people-roster-view.tsx', 'people', 'connected'],
    ['people-groups-view.tsx', 'groups', 'samahan'],
  ] as const) {
    const src = read('_components', file);
    assert.equal(count(src, /<PeoplePinnedRow\b/g), 1, `${file}: not exactly one pinned row`);
    const block = head(src);
    assert.equal(count(block, /<PeoplePinnedRow\b/g), 1, `${file}: the pinned row is not in the sticky block`);
    assert.match(block, new RegExp(`face="${face}"[\\s\\S]*view="${view}"`), `${file}: the row shows the wrong face`);
    const outside = block.replace(/<PeoplePinnedRow\b[\s\S]*?\/>\s*<\/div>$/, '');
    assert.equal(count(outside, /<(button|a|Link|PickMenu|ActionButton)\b/g), 0, `${file}: something pressable sits in the sticky block beside the row — two rows`);
  }
  const row = read('_components', 'people-pinned-row.tsx');
  assert.match(row, /<PinnedRow\b/, 'People draws its own row instead of the shared PinnedRow');
  assert.equal(count(row, /<MenuSettingsButton\b[^>]*\bmenu="people"/g), 1, 'People does not mount exactly one ⚙');
  assert.match(row, /buttonText: PINNED_FACE_LABEL\[face\]/, 'the picker does not show "People ▾" / "Groups ▾"');
});

async function renderRow(over: Record<string, unknown> = {}) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PinnedRow } = await import('@/app/_components/pinned-row/pinned-row');
  const props = {
    picker: { label: 'People — show', value: 'connected', buttonText: 'People', options: [{ key: 'connected', label: 'People 4' }, { key: 'samahan', label: 'Groups 3' }], onPick: () => {} },
    doors: [
      { key: 'connected', n: 4, word: 'connected', on: false, onTap: () => {} },
      { key: 'asking', n: 1, word: 'asking you', hot: true, on: true, onTap: () => {} },
    ],
    action: { label: 'Invite', icon: (await import('lucide-react')).UserPlus, mark: 'invite', onTap: () => {}, dialog: true },
    gear: React.createElement('span', { 'data-menu-settings': 'people' }, React.createElement('button', { type: 'button' }, '⚙')),
    ...over,
  };
  return renderToStaticMarkup(React.createElement(PinnedRow, props as never));
}

test('2 · the row holds ONE action, between the doors and the ⚙ — the ⚙ ends it', async () => {
  const html = await renderRow();
  assert.equal(count(html, /data-pinned-action="/g), 1, 'the pinned row holds more (or less) than one action');
  const doorsAt = html.indexOf('data-pinned-doors');
  const actAt = html.indexOf('data-pinned-action="invite"');
  const gearAt = html.indexOf('data-menu-settings="people"');
  assert.ok(html.indexOf('data-pinned-picker') < doorsAt && doorsAt < actAt && actAt < gearAt, 'the order is not picker · doors · action · ⚙');
  assert.ok(html.endsWith('</button></span></div>'), 'something is drawn after the ⚙');
  assert.equal(count(html, /data-first-row=""/g), 1, 'the row is not the menu’s first row');
  assert.match(html, /data-pinned-action="invite"[^>]*><button [^>]*class="ab ab-brand ab-main/, 'Invite is not the shared ActionButton (brand, main)');
  const link = await renderRow({ action: { label: 'New', icon: (await import('lucide-react')).Plus, mark: 'new-group', ariaLabel: 'New group', href: '/dashboard/samahan/new' } });
  const newTag = /data-pinned-action="new-group"[^>]*><a [^>]*>/.exec(link)?.[0] ?? '';
  assert.match(newTag, /class="ab ab-brand ab-main/, '＋ New is not the shared ActionButton (brand, main)');
  assert.match(newTag, /href="\/dashboard\/samahan\/new"/, '＋ New does not open the page that creates a group');
  const groups = read('_components', 'people-groups-view.tsx');
  assert.match(groups, /action=\{\{ kind: 'new-group' \}\}/);
  const roster = read('_components', 'people-roster-view.tsx');
  assert.match(head(roster), /action=\{\{ kind: 'invite', onTap: \(\) => setInviting\(true\) \}\}/, 'People’s action is not Invite (the shipped invite sheet)');
});

test('3 · the counts are filter doors — a tap filters; a note replaces them', async () => {
  const html = await renderRow();
  const doors = [...html.matchAll(/<button type="button" aria-pressed="(true|false)"[^>]*data-pinned-door="(\w+)"/g)].map((m) => `${m[2]}:${m[1]}`);
  assert.deepEqual(doors, ['connected:false', 'asking:true'], 'the doors are not pressable filters');
  const noted = await renderRow({ note: 'Not loaded just now' });
  assert.equal(count(noted, /data-pinned-door=/g), 0, 'a door is drawn beside a refusal note — a 0 could show');
  assert.match(noted, /role="status"[^>]*data-pinned-note="">Not loaded just now</);
  for (const [file, setter] of [
    ['people-roster-view.tsx', /onTap: \(\) => setFilter\(filter === '(connected|asking)' \? 'all' : '\1'\)/g],
    ['people-groups-view.tsx', /onTap: \(\) => setFilter\(filter === 'unread' \? 'all' : 'unread'\)/g],
  ] as const) {
    const block = head(read('_components', file));
    const doorsSrc = block.slice(block.indexOf('doors={['), block.indexOf('action={'));
    const n = count(doorsSrc, /\{ key: '/g);
    // People: connected · asking you. Groups: ONE door, "N unread" (owner 2026-10-28 — it replaced "with stories" and
    // the "N groups" count, so the row fits at 360).
    const want = file === 'people-roster-view.tsx' ? 2 : 1;
    assert.equal(n, want, `${file}: the row has ${n} doors, want ${want}`);
    assert.equal(count(doorsSrc, setter), n, `${file}: a door does not filter the list`);
  }
  // Groups: a refused unread count is said ("Couldn't load") — the note is set before any door can draw a 0.
  const groups = head(read('_components', 'people-groups-view.tsx'));
  assert.match(groups, /note=\{[^}]*unreadUnreadable \? 'Couldn’t load'/, 'a refused unread count can reach the row as a number');
  assert.match(groups, /\{ key: 'unread', n: unreadGroups, word: 'unread'/, 'the Groups door is not "N unread"');
});

test('4 · every group row opens its chatroom; the ring is live stories; unread = bold line + badge', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { GroupChatRows } = await import('./_components/group-chat-rows');
  const rows = [
    { communityId: 'g1', name: 'Barkada ni Ice', role: 'organizer', memberCount: 12, stories: 3, last: { who: 'Mika', body: 'Sino?', when: '2m' }, nextEvent: { label: '15 Nov · Liga' }, unread: 3 },
    { communityId: 'g2', name: 'Batch 14', role: 'member', memberCount: null, stories: 0, last: { who: 'Paolo', body: 'See you', when: 'Mon' }, nextEvent: null, unread: 0 },
    { communityId: 'g3', name: 'Refused', role: 'member', memberCount: 4, stories: 0, last: { who: 'Ana', body: 'Hi', when: '1h' }, nextEvent: null, unread: null },
    { communityId: 'g4', name: 'Busy', role: 'member', memberCount: 4, stories: 0, last: { who: 'Ana', body: 'Lots', when: '1m' }, nextEvent: null, unread: 140 },
  ];
  const html = renderToStaticMarkup(React.createElement(GroupChatRows, { rows } as never));
  const hrefs = [...html.matchAll(/<a [^>]*data-people-group-row[^>]*>/g)].map((m) => /href="([^"]+)"/.exec(m[0])?.[1]);
  assert.deepEqual(hrefs, ['/dashboard/samahan/g1', '/dashboard/samahan/g2', '/dashboard/samahan/g3', '/dashboard/samahan/g4'], 'a group row does not open its chatroom');
  assert.deepEqual([...html.matchAll(/data-group-ring="(\w+)"/g)].map((m) => m[1]), ['live', 'none', 'none', 'none'], 'the ring is not the live stories');
  // Unread: the badge (99+ past ninety-nine) and a bold line — on the unread rows only; a refused count (null) draws none.
  const badges = [...html.matchAll(/data-group-unread-badge=""[^>]*>([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(badges, ['3', '99+'], 'the unread badges are not exactly the unread rows (a 0 or a refusal drew one?)');
  const lines = [...html.matchAll(/<span class="([^"]*)" data-group-line="">/g)].map((m) => /font-semibold/.test(m[1]!));
  assert.deepEqual(lines, [true, false, false, true], 'the bold last line is not exactly the unread rows');
  assert.match(html, /Mika: Sino\?/);
  assert.match(html, /15 Nov · Liga/);
  const refused = renderToStaticMarkup(React.createElement(GroupChatRows, { rows, activityUnreadable: true } as never));
  assert.doesNotMatch(refused, /No messages yet/, 'a refused read says "No messages yet"');
  assert.match(refused, /data-group-activity="refused"/);
});

test('5 · opening a group marks it read — one RPC from an effect, mounted by the group route, never on a prefetch', () => {
  const GROUP = join(HERE, '..', 'samahan');
  const layout = stripComments(readFileSync(join(GROUP, '[communityId]', 'layout.tsx'), 'utf8'));
  assert.match(layout, /\{children\}\s*<MarkGroupRead communityId=\{communityId\} \/>/, 'the group route does not mount the read marker');
  const mark = stripComments(readFileSync(join(GROUP, '_components', 'mark-group-read.tsx'), 'utf8'));
  assert.match(mark, /^'use client';/, 'the marker is not a client component — a server render would write on a prefetch');
  const effect = mark.slice(mark.indexOf('useEffect('), mark.indexOf('}, [communityId]);'));
  assert.match(effect, /\.rpc\('mark_samahan_read', \{ p_community_id: communityId \}\)/, 'the marker does not call mark_samahan_read');
  assert.equal(count(mark, /\.rpc\(/g), 1, 'more than one write');
  assert.equal(count(mark.slice(0, mark.indexOf('useEffect(')), /\.rpc\(/g), 0, 'the write runs during render (a prefetch would mark the group read)');
  assert.doesNotMatch(mark, /\.channel\(|subscribe\(/, 'the marker opens a live connection');
});
