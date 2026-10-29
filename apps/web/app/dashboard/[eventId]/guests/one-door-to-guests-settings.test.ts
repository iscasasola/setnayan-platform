/**
 * one-door-to-guests-settings.test.ts — GUESTS' SETTINGS HAVE ONE DOOR: the ⚙ at the right end of the List · Map row.
 *
 * Owner 2026-10-27 (settings per menu, call 1, "yes"): *"Guests' 'Settings' segment becomes the ⚙; the pill is
 * List · Map"*; PLAN § 3 · § 5 row B. And 2026-10-26: *"each menu has their own settings"* — How guests get in, the
 * RSVP asks and Reply by live in Guests ⚙ only, not also on Event Details.
 *
 * Held, measured on what RENDERS (the real `GuestsScreen`, `render-guests-screen.ts`) where it can be:
 *   1 · the pill draws exactly List · Map — no third "Settings" segment, no `gview=share` link;
 *   2 · with the couple's rows handed in, ONE ⚙ draws — inside the first row, as its last child — and the rows do
 *       not draw on the page while the sheet is shut (the ⚙ is the only way in); without them, no ⚙;
 *   3 · the page hands the rows to the couple only, and an old `?gview=share` / `?view=share` forwards to the ⚙;
 *   4 · Event Details no longer draws How guests get in · What to ask · Guests reply by · Guest list closes;
 *   5 · the rows sit under the three clusters, in order: Getting in · Replies · Closing the list.
 *
 * Sabotage (2026-10-27, each red then reverted): `{seg('share', 'Settings')}` restored → 1; the ⚙ moved before the
 * pill → 2; `{setup}` drawn under the pill as well → 2; `viewer.isCouple ?` dropped from the page → 3; the
 * "Guest list closes" row put back on Event Details → 4; the Replies head moved above Getting in → 5.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { guestRow, renderGuestsScreen } from './_components/render-guests-screen';
import { renderSetup } from '../_components/guest-setup/render-setup';
import { GUESTS_SETTINGS_CLUSTERS } from '@/lib/event-settings-record';

const HERE = dirname(fileURLToPath(import.meta.url));
const code = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const count = (s: string, re: RegExp) => [...s.matchAll(re)].length;

/** The element that starts at `at`, cut out by tag depth. */
function elementAround(html: string, at: number): string {
  const start = html.lastIndexOf('<', at);
  const tag = /^<([a-z0-9]+)/.exec(html.slice(start))?.[1];
  assert.ok(tag, 'no element around the marker');
  const re = new RegExp(`<${tag}\\b|</${tag}>`, 'g');
  re.lastIndex = start;
  let depth = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return html.slice(start, m.index + m[0].length);
  }
  throw new Error('unclosed element');
}

const ROWS = React.createElement('div', { 'data-guest-setup-marker': '' }, 'the rows');

/* 🎚 ONE TOP ROW (owner 2026-10-30, *"The menu does not work properly"*, superseding slice 2's segmented row): the row's
   ONE ▾ ("Guests · List") lists every view; List · Map are Guests' two. The property is unchanged — Settings is never a
   view (it is the ⚙), and List and Map are both still reachable from the row. */
test('1 · the row is ONE ▾ (Guests · List — List · Map in it) — no Settings view', async () => {
  const html = await renderGuestsScreen({ guests: [guestRow()], setup: ROWS });
  assert.doesNotMatch(html, /data-guests-seg=/, 'the segmented pill is back — the row is ONE ▾');
  assert.doesNotMatch(html, /gview=share/, 'a link still opens the old Settings segment');
  assert.match(html, /data-guests-pin-menu=""[^]*?>Guests · List</, 'the row’s ▾ does not say where you are');
  const screen = code('_components/guests-screen.tsx');
  assert.match(screen, /const guestModes: PickOption\[\] = guestsViews\.filter\(\(v\) => v === 'list' \|\| v === 'map'\)/, 'Guests ▾ no longer lists List · Map');
});

test('2 · one ⚙, last in the first row; the rows only behind it', async () => {
  const html = await renderGuestsScreen({ guests: [guestRow()], setup: ROWS });
  assert.equal(count(html, /data-menu-settings="guests"/g), 1, 'Guests does not draw exactly one ⚙');
  assert.equal(count(html, /data-first-row=""/g), 1, 'Guests does not mark exactly one first row');
  const row = elementAround(html, html.indexOf('data-first-row=""'));
  assert.match(row, /data-guests-pin-menu=""/, 'the first row is not the view row (its ▾)');
  const door = elementAround(row, row.indexOf('data-menu-settings="guests"'));
  assert.ok(row.endsWith(`${door}</div>`), 'something is drawn after the ⚙ — it is not at the row’s right end');
  assert.doesNotMatch(html, /data-guest-setup-marker/, 'the settings rows draw on the page with the sheet shut — a second door');
  const none = await renderGuestsScreen({ guests: [guestRow()] });
  assert.equal(count(none, /data-menu-settings=/g), 0, 'a ⚙ draws with no rows to open');
});

test('3 · the page hands the rows to the couple only, and the old segment forwards to the ⚙', () => {
  const page = code('page.tsx');
  assert.match(page, /setup=\{\s*viewer\.isCouple \?/, 'the settings rows reach someone who is not the couple');
  assert.match(
    page,
    /if \(search\.gview === 'share' \|\| search\.view === 'share'\) redirect\(guestsSettingsHref\(eventId\)\);/,
    'an old ?gview=share link no longer lands on Guests ⚙',
  );
  assert.ok(page.indexOf("search.gview === 'share'") < page.indexOf('await createClient()'), 'the forward waits for reads');
});

test('4 · Event Details no longer draws the four guest rows', () => {
  const details = code('../details/page.tsx');
  for (const [row, label] of [
    ['guests-get-in', 'How guests get in'],
    ['rsvp-questions', 'What to ask'],
    ['reply-by', 'Guests reply by'],
    ['list-closes', 'Guest list closes'],
  ]) {
    assert.doesNotMatch(details, new RegExp(`row="${row}"`), `Event Details draws "${row}" again`);
    assert.doesNotMatch(details, new RegExp(`label="${label}"`), `Event Details says "${label}" again`);
  }
});

test('5 · the rows sit under Getting in · Replies · Closing the list, in order', async () => {
  const html = await renderSetup({ getIn: 'list' });
  const heads = [...html.matchAll(/data-settings-cluster="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(heads, [...GUESTS_SETTINGS_CLUSTERS], `the clusters read ${heads.join(' · ')}`);
  const at = (k: string) => html.indexOf(`data-setup-row="${k}"`);
  const head = (n: string) => html.indexOf(`data-settings-cluster="${n}"`);
  for (const [k, cluster, next] of [
    ['get-in', 'Getting in', 'Replies'],
    ['asks', 'Replies', 'Closing the list'],
    ['reply-by', 'Replies', 'Closing the list'],
    ['requests', 'Replies', 'Closing the list'],
  ] as const) {
    assert.ok(at(k) > head(cluster) && at(k) < head(next), `"${k}" is not under ${cluster}`);
  }
  assert.ok(at('finalize') > head('Closing the list'), '"finalize" is not under Closing the list');
});
