/**
 * 🔒 PORTFOLIO'S PLACES ARE READ OR SAID (the re-review hold on #7998, 19 Nov).
 *
 * Supabase RESOLVES with `{ error }` instead of throwing. `readTagEventLines` turned that into an empty Map, so the
 * loader's `.catch` never fired, `placesUnread` stayed false, and a search by place silently missed its matches.
 *
 *   1 · FED AN RPC `{ error }`, the read answers `null` (unread) — never an empty Map; a read with rows answers a Map;
 *       the shared `readTagEventLines` keeps its old promise (a Map) for its other three callers;
 *   2 · the loader maps that `null` to 'unread', and an unread CARDS read makes the event facts unread too;
 *   3 · RENDERED: with the places unread and words typed, the list says "Couldn't load places"; without words, or with
 *       the places read, it does not.
 * 🛡 SABOTAGE (each seen RED, then restored — 2026-11-19): `return null;` → `return out;` in the read (red: 1) ·
 *   `if (lines === null) return 'unread'` removed (red: 2) · `if (c === null) return null;` removed (red: 2) ·
 *   `{placesUnread && needle ?` → `{false ?` (red: 3).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stripComments } from '@/lib/strip-comments';
import { PLACES_UNREAD_LINE } from '@/lib/portfolio-albums';

(globalThis as unknown as { React: unknown }).React = React;
{
  type ModT = { _load: (request: string, ...rest: unknown[]) => unknown };
  const Mod = (createRequire(import.meta.url)('node:module') as { Module: ModT }).Module;
  const load = Mod._load;
  Mod._load = function (this: unknown, request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const fake = (answer: { data: unknown; error: unknown }) => ({ rpc: async () => answer }) as unknown as SupabaseClient;

test('1 · an RPC that answers { error } is UNREAD (null) — never an empty Map', async () => {
  const { readTagEventLines, readTagEventLinesOrUnread } = await import('./inspiration-tags.server');
  const refused = fake({ data: null, error: { message: 'permission denied for function inspiration_tag_event_lines', code: '42501' } });
  assert.equal(await readTagEventLinesOrUnread(refused, ['a1']), null, 'a refused read came back as "no lines"');
  // The shared read keeps its promise to its other callers: a Map, never null.
  const shared = await readTagEventLines(refused, ['a1']);
  assert.ok(shared instanceof Map && shared.size === 0);
  // Anti-vacuity: nothing asked is a real, read "none" — not unread.
  const none = await readTagEventLinesOrUnread(refused, []);
  assert.ok(none instanceof Map && none.size === 0, 'asking about no looks is not a refused read');
});

test('2 · the loader carries the refusal: null → unread → placesUnread; unread cards → unread facts', () => {
  const data = stripComments(readFileSync(join(process.cwd(), 'app/vendor-dashboard/collections/collections-data.ts'), 'utf8'));
  assert.match(data, /const lines = await readTagEventLinesOrUnread\(supabase, looks\.map\(\(l\) => l\.id\)\);\s*if \(lines === null\) return 'unread' as const;/, 'a refused tag-lines read is not mapped to unread');
  assert.doesNotMatch(data, /readTagEventLines\(/, 'the loader went back to the read that hides a refusal');
  assert.match(data, /\.then\(async \(\[c, a\]\) => \{\s*if \(c === null\) return null;/, 'an unread cards read still yields "facts read"');
  assert.match(data, /placesUnread: eventFacts === null \|\| lookLines === 'unread',/);
});

test('3 · rendered: unread places are said while searching — and only then', async () => {
  const { CollectionsList } = await import('../app/vendor-dashboard/collections/_components/collections-list');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const album = { key: 'e1', title: 'Santos wedding', line: '12 photos', urls: ['/a.jpg'], total: 12, href: null };
  const draw = (props: Record<string, unknown>) =>
    renderToStaticMarkup(
      React.createElement(CollectionsList, {
        vendorId: 'lab',
        input: { page: { photos: 0, videos: 0, shown: true }, cards: null, albums: null, own: null, delivered: null, instagram: null, moodboard: null },
        gallery: null,
        groups: { events: [album], services: [], inspiration: 'off', stories: [] },
        ...props,
      } as never),
    );
  const said = draw({ placesUnread: true, words: 'tagaytay' });
  assert.ok(said.includes('data-portfolio-places-unread'), 'a place search misses its matches without a word');
  assert.ok(said.includes(PLACES_UNREAD_LINE.replace('’', '’')), 'the line is not the one sentence');
  assert.ok(!draw({ placesUnread: true, words: '' }).includes('data-portfolio-places-unread'), 'the note shows when nobody is searching');
  assert.ok(!draw({ placesUnread: false, words: 'tagaytay' }).includes('data-portfolio-places-unread'), 'the note shows when the places WERE read');
});
