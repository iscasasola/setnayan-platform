/**
 * samahan-chatroom.test.ts — 🎞 THE HOURLY COLLAGE IS DERIVED, AND IT GOES WITH ITS CLIPS (owner 2026-10-28: *"all
 * stories will run in a collage every hour"*; DECISION_LOG "GROUPS AS A CHATROOM").
 *
 *   1 · the collage groups by the hour of `created_at` — one item per ended hour, its clips oldest first, "3 PM";
 *   2 · an hour that has not ended has not posted; a clip past `expires_at` leaves its tile, and a collage whose clips
 *       are all gone is gone;
 *   3 · the chat interleaves messages, new-event cards (at the moment the event was planned) and collages (at the end
 *       of their hour), oldest first, with a day divider when the Manila day changes;
 *   4 · the pinned event is the next DATED one, today or later;
 *   5 · nothing is stored: the module reads no database and the page posts no collage row.
 *
 * 🛡 SABOTAGE (2026-10-28, each seen red, then restored): bucket by minute instead of hour → 1; drop the
 * `expires_at > now` filter → 2; drop the "hour has ended" filter → 2; post an event at its event_date instead of its
 * created_at → 3; let an undated event be "next" → 4.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chatTimeline, hourlyCollages, nextGroupEvent, storiesWord, HOUR_MS } from './samahan-chatroom';
import type { SamahanStory } from './samahan-stories';
import type { SamahanMessage } from './communities';
import { stripComments } from './strip-comments';

// 2026-10-28 15:00 Manila = 07:00Z. "now" is 18:20 Manila.
const T15 = Date.UTC(2026, 9, 28, 7, 0, 0);
const NOW = T15 + 3 * HOUR_MS + 20 * 60_000;

const clip = (id: string, at: number, life = 24 * HOUR_MS): SamahanStory => ({
  story_id: id,
  user_id: `u-${id}`,
  author_name: id,
  is_self: false,
  duration_ms: 3000,
  created_at: new Date(at).toISOString(),
  expires_at: new Date(at + life).toISOString(),
  clip_url: null,
  poster_url: null,
});

test('1 · one collage per ended hour, grouped by the hour of created_at, oldest first, labelled in Manila', () => {
  const stories = [
    clip('a', T15 + 50 * 60_000),
    clip('b', T15 + 5 * 60_000),
    clip('c', T15 + 59 * 60_000),
    clip('d', T15 + HOUR_MS + 1 * 60_000), // 4 PM
  ];
  const cs = hourlyCollages(stories, NOW);
  assert.equal(cs.length, 2, 'two hours, two collages');
  assert.equal(cs[0]!.label, '3 PM');
  assert.equal(cs[1]!.label, '4 PM');
  assert.deepEqual(cs[0]!.stories.map((s) => s.story_id), ['b', 'a', 'c'], 'the hour’s clips, the order they were taken');
  assert.equal(cs[0]!.postedAtMs, T15 + HOUR_MS, 'a collage posts when its hour ends');
  assert.equal(`${cs[0]!.label} · ${storiesWord(cs[0]!.stories.length)}`, '3 PM · 3 stories');
  assert.equal(storiesWord(1), '1 story');
});

test('2 · the current hour has not posted; an expired clip leaves; an all-expired hour is gone', () => {
  const thisHour = clip('now', NOW - 5 * 60_000);
  assert.deepEqual(hourlyCollages([thisHour], NOW), [], 'the hour that has not ended has not posted yet');

  const live = clip('live', T15 + 10 * 60_000);
  const dead = clip('dead', T15 + 20 * 60_000, 2 * HOUR_MS); // expired at 17:20, before now
  const cs = hourlyCollages([live, dead], NOW);
  assert.equal(cs.length, 1);
  assert.deepEqual(cs[0]!.stories.map((s) => s.story_id), ['live'], 'an expired clip left the collage');

  assert.deepEqual(hourlyCollages([dead], NOW), [], 'a collage whose clips are all gone is gone');
  // 24 hours after it posted, it goes with its clips.
  assert.deepEqual(hourlyCollages([live], T15 + 10 * 60_000 + 24 * HOUR_MS), []);
});

test('3 · the chat: messages, event cards at their planning, collages at their hour’s end, day dividers', () => {
  const msg = (id: string, at: number): SamahanMessage => ({
    message_id: id,
    author_name: 'M',
    is_self: false,
    body: id,
    created_at: new Date(at).toISOString(),
  });
  const yesterday = T15 - 20 * HOUR_MS;
  const items = chatTimeline({
    messages: [msg('m1', yesterday), msg('m2', T15 + 30 * 60_000), msg('m3', T15 + HOUR_MS + 5 * 60_000)],
    events: [
      {
        event_id: 'e1',
        display_name: 'Reunion',
        event_type: 'reunion',
        event_date: '2026-12-27',
        archived: false,
        slug: 'r',
        created_at: new Date(T15 + 40 * 60_000).toISOString(),
      },
      { event_id: 'e2', display_name: 'Undated', event_type: 'other', event_date: null, archived: false, slug: null },
    ],
    collages: hourlyCollages([clip('a', T15 + 10 * 60_000)], NOW),
    nowMs: NOW,
  });
  const shape = items.map((i) =>
    i.kind === 'day' ? `day:${i.label}` : i.kind === 'message' ? i.message.message_id : i.kind === 'event' ? `event:${i.event.event_id}` : `collage:${i.collage.label}`,
  );
  assert.deepEqual(shape, ['day:Yesterday', 'm1', 'day:Today', 'm2', 'event:e1', 'collage:3 PM', 'm3']);
});

test('4 · the pinned event is the next dated one, today or later', () => {
  const e = (id: string, d: string | null) => ({ event_id: id, event_date: d });
  assert.equal(nextGroupEvent([e('past', '2026-10-01'), e('later', '2026-12-27'), e('soon', '2026-11-15'), e('tbd', null)], '2026-10-28')?.event_id, 'soon');
  assert.equal(nextGroupEvent([e('today', '2026-10-28')], '2026-10-28')?.event_id, 'today');
  assert.equal(nextGroupEvent([e('tbd', null), e('past', '2026-01-01')], '2026-10-28'), null);
});

test('5 · nothing is stored — the derivation reads no database and writes no collage row', () => {
  const src = stripComments(readFileSync(join(__dirname, 'samahan-chatroom.ts'), 'utf8'));
  assert.doesNotMatch(src, /\.from\(|supabase|createClient|fetch\(/, 'the collage must be derived at read time, never read or stored');
});
