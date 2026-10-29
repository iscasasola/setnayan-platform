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
 *   2 · the Home cover band draws NO link (its ⚙ — owner 2026-10-29 — is a button opening the Event Settings
 *       sheet in place); the Countdown widget is Home's one door to `/details`;
 *   3 · nothing the event's Home or rail draws still says "Event settings".
 *
 * The Details page's own "Event settings" section heading lives under
 * `details/` and is out of this guard's reach on purpose. So does the Event Settings SHEET's title (owner 2026-10-29,
 * Home's ⚙): it comes from `lib/menu-settings.ts`, and it names the sheet of the event's facts — not Event Details.
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
import { homeControlTiles } from './home-control-faces';
import { fixtureControl } from '@/lib/home-control-fixture';

// The components are compiled with the classic JSX runtime under tsx.
(globalThis as unknown as { React: unknown }).React = React;

const HERE = dirname(fileURLToPath(import.meta.url));
const code = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));

const RAIL = 'event-rail-context.tsx';
/** Every file that draws the event's Home or its rail. */
const HOME_AND_RAIL = [RAIL, 'home-first-screen.tsx', 'home-cover-band.tsx', 'home-loading-cover.tsx', 'home-control-faces.ts', 'home-control-row.tsx', 'home-tile.tsx', '../layout.tsx'];

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

test('2 · Home has exactly one door to Event Details — the Countdown widget (owner-approved 2026-10-24)', () => {
  // The cover's ⚙ Settings pill (23 Oct) opened the same page as the Countdown — two doors to one page. The approved
  // control center (`home_control_center_2026-10-24_fable.html`) draws the cover without it: the Countdown is the door.
  const html = renderToStaticMarkup(React.createElement(HomeCoverBand, { cover: { name: 'Cale & Ice', eyebrow: 'Wedding · 14 Feb 2027' } }));
  assert.equal([...html.matchAll(/<a\b/g)].length, 0, 'the cover band draws a door again — a second door to Event Details');
  // ⚙ AMENDED 2026-10-27 (owner, "EVERY MENU'S ⚙ RIDES ITS PINNED ROW TOO") and AGAIN 2026-10-29 (owner, verbatim: *"on
  // event dashboard> home the header does not show the settings icon like the other pages with settings icon. keep it
  // there"*): the couple's band ends with Home's ⚙, drawn AT REST — and it is no longer a door to Event Details. It is a
  // BUTTON that opens the Event Settings SHEET in place (names · date · venues · parents, `open-event-settings.tsx`), so
  // the band still draws NO link at all and the Countdown stays the one door to Event Details.
  const withGear = renderToStaticMarkup(
    React.createElement(HomeCoverBand, { cover: { name: 'Cale & Ice', eyebrow: 'Wedding · 14 Feb 2027' }, settingsFor: 'EVT123' }),
  );
  assert.equal([...withGear.matchAll(/<a\b/g)].length, 0, 'the couple’s band draws a link — a second door to Event Details');
  const buttons = [...withGear.matchAll(/<button\b[^>]*>/g)].map((m) => m[0]);
  assert.equal(buttons.length, 1, `the couple’s band draws ${buttons.length} buttons — it draws exactly its ⚙`);
  assert.match(buttons[0] ?? '', /aria-haspopup="dialog"/, 'Home’s ⚙ does not open a sheet in place');
  assert.match(buttons[0] ?? '', /aria-label="Event settings"/, 'Home’s ⚙ is not named for the sheet it opens');
  const { tiles } = homeControlTiles(fixtureControl('EVT123'));
  const toDetails = tiles.filter((t) => [t.door, ...t.faces.flatMap((f) => [f.href, f.action?.href ?? ''])].some((h) => DETAILS_HREF.test(h)));
  assert.deepEqual(toDetails.map((t) => t.key), ['count'], 'a widget other than the Countdown opens Event Details');
  const row = code('home-control-row.tsx');
  assert.match(row, /<Shell k="count" door=\{`\/dashboard\/\$\{e\}\/details`\}/, 'the Countdown card is not the door to Event Details');
});

test('3 · nothing on the Home or the rail says "Event settings" any more', () => {
  const said = HOME_AND_RAIL.filter((f) => /Event settings/i.test(code(f)));
  assert.deepEqual(said, [], `"Event settings" is a second name for Event Details, drawn in: ${said.join(', ')}`);
});
