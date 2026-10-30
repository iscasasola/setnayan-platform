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
 *       sheet in place); and since 2026-10-30 (owner: *"they were suppose to combine the event details and event
 *       settings together on the event settings"*) Home draws NO door to `/details` at either width — the Countdown,
 *       phone tile and desktop card alike, opens the Event Settings sheet on the date;
 *   3 · nothing the event's Home or rail draws still names a separate "Event Details".
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
import { HOME_CONTROL_PAGE, countdownDoor } from './home-control-faces';

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

test('2 · Home draws NO door to the Event Details page — at either width the Countdown opens the Date Finder', () => {
  // ⚙ RE-AIMED 2026-10-30 (owner, verbatim: *"event details showed on desktop view but not on mobile view. and it was
  // already supposed to be gone because the were suppose to combine the event details and event settings together on the
  // event settings"* — completing DECISION_LOG 2026-10-26 "FINAL STRUCTURE" (2) and "EACH MENU HAS ITS OWN SETTINGS").
  // Until today the Countdown was Home's one door to `/details` (owner-approved 2026-10-24), and on desktop it was a card
  // NAMED "Open Event Details" while the phone tile named nothing. Now both widths open the DATE FINDER in place (owner,
  // same day, verbatim: *"date finder. because we want them to find the date for their event"* — 2026-10-26 "FINAL
  // STRUCTURE" (3)): Suppliers' own date sheet on Help me choose (`home-date-finder.tsx`).
  const html = renderToStaticMarkup(React.createElement(HomeCoverBand, { cover: { name: 'Cale & Ice', eyebrow: 'Wedding · 14 Feb 2027' } }));
  assert.equal([...html.matchAll(/<a\b/g)].length, 0, 'the cover band draws a door again');
  // The couple's band ends with Home's ⚙ — a BUTTON that opens the Event Settings sheet in place, never a link.
  const withGear = renderToStaticMarkup(
    React.createElement(HomeCoverBand, { cover: { name: 'Cale & Ice', eyebrow: 'Wedding · 14 Feb 2027' }, settingsFor: 'EVT123' }),
  );
  assert.equal([...withGear.matchAll(/<a\b/g)].length, 0, 'the couple’s band draws a link');
  const buttons = [...withGear.matchAll(/<button\b[^>]*>/g)].map((m) => m[0]);
  assert.equal(buttons.length, 1, `the couple’s band draws ${buttons.length} buttons — it draws exactly its ⚙`);
  assert.match(buttons[0] ?? '', /aria-haspopup="dialog"/, 'Home’s ⚙ does not open a sheet in place');
  assert.match(buttons[0] ?? '', /aria-label="Event settings"/, 'Home’s ⚙ is not named for the sheet it opens');

  // 📱 THE PHONE (the compact tiles) — no tile, face or action opens the Event Details page; the Countdown opens the Date Finder.
  const { tiles } = homeControlTiles(fixtureControl('EVT123'));
  const toDetails = tiles.filter((t) => [t.door, ...t.faces.flatMap((f) => [f.href, f.action?.href ?? ''])].some((h) => DETAILS_HREF.test(h)));
  assert.deepEqual(toDetails.map((t) => t.key), [], 'a Home tile opens the Event Details page again');
  const count = tiles.find((t) => t.key === 'count');
  assert.ok(count, 'the Countdown left Home — this check would pass vacuously');
  assert.equal(count.door, countdownDoor('EVT123'), 'the phone’s Countdown does not open the Date Finder');
  assert.equal(countdownDoor('EVT123'), '/dashboard/EVT123?date=find');
  assert.ok(count.faces.every((f) => f.href === countdownDoor('EVT123') && (!f.action || f.action.href === countdownDoor('EVT123'))), 'a Countdown face opens another page');
  // 🖥 THE DESKTOP (the detail cards, `md:` up) — the Countdown card's door is the tile's own door, never a /details literal.
  const row = code('home-control-row.tsx');
  assert.match(row, /<Shell k="count" door=\{tile\.door\}/, 'the desktop Countdown card has a door of its own again');
  assert.doesNotMatch(row, /\/details[`'"]/, 'the desktop Home cards link to the Event Details page again');
  assert.equal(HOME_CONTROL_PAGE.count, 'Date Finder', 'the desktop Countdown card is named for something other than the Date Finder it opens');
  assert.match(row, /label="Set your date" href=\{tile\.faces\[0\]\?\.action\?\.href \?\? tile\.door\}/, 'the desktop card’s Set your date opens another page');
  // The Date Finder is THE sheet Suppliers' date chip opens — never a second one.
  const finder = code('home-date-finder.tsx');
  assert.match(finder, /import\('\.\.\/vendors\/_components\/fact-sheets'\)\.then\(\(m\) => m\.FactSheet\)/, 'Home draws its own date sheet');
  assert.match(finder, /which="date"\s+helpFirst/, 'the Date Finder does not open on Help me choose');
  assert.match(code('home-first-screen.tsx'), /\{eventSettings \? <HomeDateFinder eventId=\{eventId\}/, 'the Date Finder is not mounted on the couple’s Home');
});

test('3 · nothing on the Home or the rail names a separate "Event Details" any more', () => {
  // RE-AIMED 2026-10-30: this said "nothing says Event settings" while that was a second name for Event Details. Event
  // Details is now combined INTO Event Settings (owner, above) — so the second name is "Event Details".
  const said = HOME_AND_RAIL.filter((f) => /Event Details/i.test(code(f)));
  assert.deepEqual(said, [], `"Event Details" — a page combined into Event Settings — is still named in: ${said.join(', ')}`);
});
