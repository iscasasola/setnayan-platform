/**
 * one-door-to-event-details.test.ts — the event's Home + rail offer ONE door to
 * Event Details, and it is the Home cover's button.
 *
 * Owner, 2026-10-23, comparing the Home cover's "ⓘ Event Details" button with the
 * rail's "⚙ Event settings" line under the event's name: *"same? If yes, only keep
 * the Event Details button and remove the event settings"*. Both opened
 * `/dashboard/[eventId]/details`; two names for one page tell a person there are
 * two places. The rail's line went; the event's name in the rail is plain text.
 *
 * Held here, as properties (not phrasings):
 *   1 · the rail draws NO link to `/details` and no row of the `event` group —
 *       so `/details` can never light a rail row that is no longer drawn;
 *   2 · the Home cover band RENDERS exactly one link to `/details`, and it names
 *       "Event Details";
 *   3 · nothing the event's Home or rail draws still says "Event settings".
 *
 * The Details page's own "Event settings" section heading lives under
 * `details/` and is out of this guard's reach on purpose.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from '@/lib/strip-comments';
import { buildCustomerNavGroups } from './customer-nav-config';
import { buildCustomerMenuTree } from '@/lib/customer-menu';
import { HomeCoverBand } from './home-cover-band';

// The components are compiled with the classic JSX runtime under tsx.
(globalThis as unknown as { React: unknown }).React = React;

const HERE = dirname(fileURLToPath(import.meta.url));
const code = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));

const RAIL = 'event-rail-context.tsx';
/** Every file that draws the event's Home or its rail. */
const HOME_AND_RAIL = [RAIL, 'home-first-screen.tsx', 'home-cover-band.tsx', 'home-loading-cover.tsx', '../layout.tsx'];

/** `/dashboard/<id>/details` exactly — not a sub-page such as `/details/change`. */
const DETAILS_HREF = /\/details(?:[`'"?#]|$)/;

test('1 · the rail draws no door to Event Details, and no row it could light for it', () => {
  const rail = code(RAIL);
  const linkTargets = [...rail.matchAll(/href=\{([^}]*)\}/g)].map((m) => m[1] ?? '');
  assert.ok(linkTargets.length > 0, 'no href in the rail at all — this check would pass vacuously');
  const toDetails = linkTargets.filter((h) => DETAILS_HREF.test(h) || /detailsRow|personalization/.test(h));
  assert.deepEqual(toDetails, [], `the rail links to Event Details again: ${toDetails.join(' · ')}`);
  assert.doesNotMatch(rail, /personalization/, 'the rail reaches for the `personalization` (Event Details) row again');

  // The name is drawn as plain text — the element, not a link around it.
  assert.match(rail, /<div className="fd-rctx">\{eventName\}<\/div>/, 'the event name in the rail is no longer plain text');

  // The rail drops the `event` group, and what it draws then holds no /details row —
  // so the lit-row resolver's `personalization` answer on /details lights nothing.
  assert.ok(rail.includes("groupsWithHub.filter((g) => g.key !== 'event')"), 'the rail draws the `event` group again');
  const all = buildCustomerNavGroups('EVT123', { websiteEnabled: true });
  assert.ok(all.some((g) => g.key === 'event'), 'the `event` group left the tree — re-read what the rail filters');
  const drawn = all.filter((g) => g.key !== 'event').flatMap((g) => g.items);
  // The floor is the ruled bar itself (owner 22 Oct 2026, "Yes remove more" — Home · Guests · Suppliers · Hub): the
  // rail draws exactly the bar's rows, so a rail that lost one — or this check over nothing — goes red.
  const bar = buildCustomerMenuTree('EVT123', { websiteEnabled: true }).map((m) => m.key);
  assert.ok(bar.length >= 4, 'the bar lost a ruled tab — this check would pass vacuously');
  assert.deepEqual(drawn.map((i) => i.key), bar, 'the rail draws other rows than the bar — this check would not see them');
  const drawnDetails = drawn.filter((i) => i.key === 'personalization' || DETAILS_HREF.test(i.href));
  assert.deepEqual(drawnDetails.map((i) => i.key), [], 'a drawn rail row opens Event Details');
});

test('2 · the Home cover renders exactly one door to Event Details — ⚙ Settings (owner 23 Oct 2026)', () => {
  const html = renderToStaticMarkup(
    React.createElement(HomeCoverBand, {
      eventId: 'EVT123',
      cover: { name: 'Cale & Ice', eyebrow: 'Wedding · 14 Feb 2027' },
    }),
  );
  const anchors = [...html.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)];
  assert.ok(anchors.length > 0, 'the cover band rendered no link at all');
  const doors = anchors.filter((a) => a[1] === '/dashboard/EVT123/details').map((a) => a[2] ?? '');
  assert.equal(doors.length, 1, `the cover band renders ${doors.length} doors to Event Details (want exactly 1)`);
  // The header image's one button says "Settings" (owner 2026-10-23, prototypes/event_bar_memories_tab_2026-10-23.html:
  // "the header image carries one 'Settings' button (the Event Details door)") — still the ONE door to /details.
  assert.match((doors[0] ?? '').replace(/<[^>]+>/g, ''), /^\s*Settings\s*$/, 'the one door no longer says "Settings"');
});

test('3 · nothing on the Home or the rail says "Event settings" any more', () => {
  const said = HOME_AND_RAIL.filter((f) => /Event settings/i.test(code(f)));
  assert.deepEqual(said, [], `"Event settings" is a second name for Event Details, drawn in: ${said.join(', ')}`);
});
