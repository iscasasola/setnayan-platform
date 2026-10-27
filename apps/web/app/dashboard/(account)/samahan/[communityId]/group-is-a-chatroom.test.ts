/**
 * group-is-a-chatroom.test.ts — 💬 THE GROUP PAGE IS A CHATROOM (owner 2026-10-28, verbatim: *"groups should look like
 * a chatroom with stories and events. all stories will run in a collage every hour"* → *"Groups chatroom approved.
 * Send it to the build screen"*; DECISION_LOG "GROUPS AS A CHATROOM"; prototypes/groups_chatroom_2026-10-28).
 *
 * Replaces group-is-four-things.test.ts (members · events · stories · a chat row): the chat is no longer a row you tap
 * into, it IS the page. Rendered, not grepped, wherever a render can say it:
 *
 *   1 · top to bottom: the top (‹ People · name · count · ⋯) → the Stories strip → the next event pinned → the chat →
 *       the message bar (＋ · Message the group · 📷) — in that order, and nothing else;
 *   2 · ‹ People is People › Groups (`PEOPLE_GROUPS_HREF`), never the old index;
 *   3 · a new event's card in the chat opens THAT event (its `eventBoardHref` door), and Going? on the pinned one too;
 *       an event you may not open is no link and says why;
 *   4 · the hourly collage is in the chat ("3 PM · 6 stories" · ▶ Play) and its tiles are that hour's clips;
 *   5 · ⋯ holds the shipped lists, one tap in — Members · All events · Bring people in (organizers) · Notifications ·
 *       Leave — and every old `?tab=` address still lands: members/events are views, usapan opens the chatroom;
 *   6 · moved, not lost: the group's photo + rename sit at the top of Members; "Take it down" stays on your own
 *       message; the strip keeps "Play the day"; the 📷 and the collage tiles reach the strip's ONE camera and player.
 *
 * 🛡 SABOTAGE (2026-10-28, each seen red, then restored): the back link pointed at "/dashboard/samahan" → 2; the event
 * card's href set to the group page → 3; the collage dropped from the chat → 4; "?tab=usapan" put back as a view → 5;
 * SamahanIdentityHeader removed from Members → 6; stories moved under the chat → 1.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from '@/lib/strip-comments';
import type * as HomeMod from './_components/group-home';
import type { ChatEvent } from '@/lib/samahan-chatroom';
import type { SamahanStory } from '@/lib/samahan-stories';
import type { SamahanMessage } from '@/lib/communities';
import { PEOPLE_GROUPS_HREF } from '@/lib/people-views';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  Mod._extensions['.css'] = (m: { exports: unknown }) => {
    m.exports = new Proxy({}, { get: (_t, k) => (k === '__esModule' ? false : String(k)) });
  };
  // The chatroom binds the shipped server actions; their server-only imports are inert under a render.
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}
const { GroupHome } = require('./_components/group-home') as typeof HomeMod;
const { AppRouterContext } = require('next/dist/shared/lib/app-router-context.shared-runtime') as typeof import('next/dist/shared/lib/app-router-context.shared-runtime');
const noop = () => {};
const ROUTER = { push: noop, replace: noop, refresh: noop, prefetch: noop, back: noop, forward: noop };

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));
const ROOM = stripComments(readFileSync(join(HERE, '_components', 'group-chatroom.tsx'), 'utf8'));

const H = 3_600_000;
const NOW = Date.UTC(2026, 9, 28, 10, 20); // 18:20 Manila
const T15 = Date.UTC(2026, 9, 28, 7, 0); // 15:00 Manila

function fixture(memberType: 'couple' | 'guest' | null) {
  const stories: SamahanStory[] = [0, 1, 2, 3, 4, 5].map((i) => ({
    story_id: `st${i}`,
    user_id: `u${i}`,
    author_name: `P${i}`,
    is_self: false,
    duration_ms: 3000,
    created_at: new Date(T15 + i * 5 * 60_000).toISOString(),
    expires_at: new Date(T15 + i * 5 * 60_000 + 24 * H).toISOString(),
    clip_url: null,
    poster_url: null,
  }));
  const events: ChatEvent[] = [
    { event_id: 'ev-next', display_name: 'Liga ng Barangay', event_type: 'other', event_date: '2026-11-15', archived: false, slug: 'liga', created_at: new Date(T15 - 2 * H).toISOString() },
    { event_id: 'ev-new', display_name: 'Batch Reunion', event_type: 'reunion', event_date: '2026-12-27', archived: false, slug: 'reunion', created_at: new Date(T15 - H).toISOString() },
  ];
  const messages: SamahanMessage[] = [
    { message_id: 'm1', author_name: 'Mika', is_self: false, body: 'Sino may sasakyan?', created_at: new Date(T15 - 3 * H).toISOString() },
    { message_id: 'm2', author_name: 'Ice', is_self: true, body: 'Ako', created_at: new Date(T15 - 3 * H + 60_000).toISOString() },
  ];
  const m = new Map<string, HomeMod.EventMemberType>();
  if (memberType) for (const e of events) m.set(e.event_id, memberType as HomeMod.EventMemberType);
  return renderToStaticMarkup(
    React.createElement(AppRouterContext.Provider, { value: ROUTER as never }, React.createElement(GroupHome, {
      base: '/dashboard/samahan/c1',
      communityId: 'c1',
      name: 'Barkada ni Ice',
      photoDisplayUrl: null,
      initial: 'BI',
      isOrganizer: memberType === 'couple',
      memberCount: 12,
      events,
      viewerMemberships: m,
      stories,
      storiesUnreadable: false,
      messages,
      messagesUnreadable: false,
      nowMs: NOW,
    })),
  );
}

const ORGANIZER = fixture('couple');
const INVITED = fixture('guest');
const OUTSIDER = fixture(null);

test('1 · top to bottom: top → stories → next event → chat → the message bar', () => {
  const parts = [...ORGANIZER.matchAll(/data-group-part="([a-z-]+)"/g)].map((m) => m[1]);
  console.log(`# chatroom parts, in order: ${parts.join(' · ')}`);
  assert.deepEqual(parts, ['top', 'stories', 'next-event', 'chat']);
  const bar = ORGANIZER.indexOf('data-group-composer');
  assert.ok(bar > ORGANIZER.indexOf('data-group-part="chat"'), 'the message bar is not after the chat');
  for (const name of ['Add to the group', 'Message the group', 'Add a story']) {
    assert.ok(ORGANIZER.includes(`aria-label="${name}"`), `the message bar lost “${name}”`);
  }
  assert.match(ORGANIZER, /data-thumb-row="group-chat"/, 'the message bar is not the one thumb row');
  assert.match(ORGANIZER, /12 members/);
});

test('2 · ‹ People is People › Groups', () => {
  const back = /<a[^>]*data-group-back=""[^>]*>/.exec(ORGANIZER)?.[0] ?? '';
  assert.ok(back, 'the back link is gone');
  const href = /href="([^"]+)"/.exec(back)?.[1]?.replace(/&amp;/g, '&');
  assert.equal(href, PEOPLE_GROUPS_HREF, 'the back link does not land on People › Groups');
});

test('3 · an event card opens THAT event; Going? opens the pinned one; a closed one says why', () => {
  const card = (html: string, id: string) => {
    const at = html.indexOf(`data-chat-event="${id}"`);
    assert.ok(at > 0, `no card for ${id} in the chat`);
    return html.slice(at, html.indexOf('</li>', at));
  };
  assert.match(card(ORGANIZER, 'ev-new'), /href="\/dashboard\/ev-new"/, 'the organizer’s card does not open the event');
  assert.match(card(INVITED, 'ev-new'), /href="\/reunion"/, 'the invited card does not open the event’s page');
  assert.doesNotMatch(card(OUTSIDER, 'ev-new'), /href=/, 'an event you may not open is a link');
  assert.match(card(OUTSIDER, 'ev-new'), /Ask an organizer to add you/);
  const going = /<a[^>]*data-group-going=""[^>]*>([^<]*)</.exec(INVITED);
  assert.ok(going, 'Going? is gone');
  assert.match(going[0], /href="\/liga"/, 'Going? does not open the pinned event');
  assert.equal(going[1], 'Going?');
  assert.match(ORGANIZER, /Liga ng Barangay/);
});

test('4 · the hourly collage is in the chat with that hour’s clips', () => {
  const at = ORGANIZER.indexOf('data-collage="');
  assert.ok(at > ORGANIZER.indexOf('data-group-part="chat"'), 'the collage is not in the chat');
  assert.match(ORGANIZER, /3 PM · 6 stories/);
  const tiles = [...ORGANIZER.slice(at).matchAll(/data-collage-tile="(st\d)"/g)].map((m) => m[1]);
  assert.deepEqual(tiles, ['st0', 'st1', 'st2', 'st3', 'st4', 'st5']);
  assert.match(ORGANIZER, /data-collage-play=""/, '▶ Play is gone');
  assert.match(ROOM, /<CollagePlayer\b/, 'the full-screen player is gone');
  assert.match(ROOM, /storiesRef\.current\?\.play\(storyId\)/, 'a tile no longer opens that person’s story');
});

test('5 · ⋯ holds the shipped lists; every old ?tab= address lands', () => {
  for (const [label, href] of [
    ['Members', '${base}?tab=members'],
    ['All events', '${base}?tab=events'],
    ['Bring people in', '${base}?tab=members#bring-in'],
    ['Notifications', '/dashboard/notifications'],
  ] as const) {
    const row = new RegExp(`<SheetRow href=\\{?[\`"]${href.replace(/[$?{}#/]/g, (c) => `\\${c}`)}[\`"]\\}?[\\s\\S]{0,160}?label="${label}"`);
    assert.match(ROOM, row, `⋯ lost “${label}” → ${href}`);
  }
  assert.match(ROOM, /<form action=\{leaveCommunity\}/, '⋯ lost Leave');
  const views = PAGE.match(/const VIEWS = \[([^\]]*)\] as const/);
  assert.ok(views, 'the one-tap views list is gone');
  assert.ok(views![1]!.includes("'members'") && views![1]!.includes("'events'"), 'a one-tap list no longer resolves');
  assert.ok(!views![1]!.includes("'usapan'"), '?tab=usapan must open the chatroom, not a separate chat');
  assert.match(PAGE, /: 'home';/, 'an unknown ?tab= no longer falls back to the group page');
  assert.doesNotMatch(PAGE, /function UsapanTab\(/, 'the separate chat view came back');
});

test('6 · moved, not lost', () => {
  const members = PAGE.slice(PAGE.indexOf("if (view === 'members')"));
  assert.match(members.slice(0, 1200), /<SamahanIdentityHeader\b/, 'the group’s photo + rename are lost (they live on Members now)');
  assert.match(ROOM, /<form action=\{deleteSamahanMessage\}/, '“Take it down” is gone from your own message');
  assert.match(ROOM, /<form\s+action=\{postSamahanMessage\}/, 'the message bar does not post to Usapan');
  assert.match(ROOM, /<SamahanStories[\s\S]{0,200}strip[\s\S]{0,80}controlRef=\{storiesRef\}/, 'the strip is not the shipped one');
  assert.match(ROOM, /storiesRef\.current\?\.record\(\)/, '📷 does not open the strip’s camera');
  assert.match(ORGANIZER, /aria-label="Play the day"/, 'the strip lost Play the day');
  assert.match(ROOM, /href=\{planHref\}/, '“Plan an event” is gone');
});
