/**
 * ⋯ THE MORE MENU HOLDS PLACES TO GO, AND A PAGE OPENS BESIDE THE CHAT ON A COMPUTER (Unichat part G, owner 20 Nov
 * 2026 — *"build it now, I am happy with the design"*; drawing `build-sessions/UNICHAT-LIVE-2026-11-19.html`, plan row G
 * in `UNICHAT-BUILD-PLAN-2026-11-20.md`).
 *
 * What would silently undo it:
 *   1. a row drifts: Report a problem is no longer LAST, a strip page (Book & Budget · Schedule) comes back as a row
 *      (a duplicate of the strip), or a "Mute" row is drawn with nothing stored behind it;
 *   2. a trade page shows for a shop whose service does not have it — or greyed — or its gate becomes a new flag
 *      instead of the shipped desk entitlement (`holdsSpecialization`);
 *   3. Crew or the calendar file is offered where it leads nowhere (before booking · a day with no timed moment);
 *   4. on a computer the page covers the chat again (a full-screen rise), the tab row comes back, or the column loses
 *      its own ←;
 *   6. the HOST loses Report a problem under ⋯ (it left the (+) on both sides), or gains it by becoming a one-chat page
 *      before its own build;
 *   7. the head's search door is turned on while nothing listens (a dead magnifier), or stops firing inside the tap.
 *   5. Details stops drawing the six agreed facts as drawn, or draws an unread one as empty.
 *   8. (parity pass, 20 Nov) ⋯ turns back into a bottom sheet, regains a Details row, or Crew loses its day.
 *
 * SABOTAGE (20 Nov 2026, each seen RED then restored): `rows.push({ id: 'report'…` moved above `'details'` (1) ·
 * `if (songs)` → `if (true)` (2) · `'song_desk'` → `'stage_script'` in the page's `showSongs` (2) · `isBooked ?` dropped
 * from `crewHref` (3) · `&& !paneOn` dropped from the risen screen (4) · `if (Array.isArray(i.roster))` dropped (5).
 *
 * Run: cd apps/web && npx tsx --test "app/vendor-dashboard/clients/*\/the-more-menu-holds-places-to-go.test.ts"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '../../../../lib/strip-comments';
import { agreedEventFact, agreedFacts } from '../../../../lib/agreed-facts';
import { COORDINATOR_TRADE_SERVICES } from '../../../../lib/coordinator-trade';
import { clientMoreRows } from './_components/picked-client-more';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const SHELL = read('app/_components/picked/picked-shell.tsx');
const CLIENT_SHELL = read('app/vendor-dashboard/clients/[eventId]/_components/picked-client-shell.tsx');
const PAGE = read('app/vendor-dashboard/clients/[eventId]/page.tsx');
const AGREED = read('app/_components/chat/agreed-now.tsx');
const HOST_SHELL = read('app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/picked-supplier-shell.tsx');
const NAV = read('app/_components/picked/picked-nav.ts');

const idOf = (r: ReturnType<typeof clientMoreRows>[number]) => (typeof r === 'string' ? r : r.id);
const BODY = 'a page body';

test('1 · the rows, in the drawn order — Report a problem last, nothing the strip already opens, no Mute', () => {
  assert.deepEqual(clientMoreRows({}).map(idOf), ['files', 'hub', 'report']);
  const all = clientMoreRows({ songs: BODY, crewHref: '/hub', crewDay: '18 Dec', calendar: { href: '/c.ics', filename: 'c.ics' } });
  assert.deepEqual(all.map(idOf), ['songs', 'files', 'hub', 'crew', 'calendar', 'report']);
  // Details is the name in the head's door, never a second way in from ⋯ (the drawing draws none).
  assert.ok(!all.some((r) => (typeof r === 'string' ? r : 'page' in r ? r.page : null) === 'details'), '⋯ repeats the head’s name: Details');
  const crew = all.find((r) => idOf(r) === 'crew')!;
  assert.ok(typeof crew !== 'string' && crew.label === 'Crew for 18 Dec', 'the Crew row lost the event’s day');
  const last = all[all.length - 1]!;
  assert.ok(typeof last !== 'string' && last.label === 'Report a problem' && 'page' in last && last.page === 'report', 'Report a problem is not the last row, on the Report page');
  // The strip's four boxes open Book & Budget · Schedule · Forms · Decisions — never a second way in from ⋯.
  for (const r of all) {
    const page = typeof r === 'string' ? r : 'page' in r ? r.page : null;
    assert.ok(page === null || !['quote', 'schedule', 'payments', 'forms', 'chat'].includes(page), `⋯ repeats the strip: ${page}`);
  }
  assert.equal(new Set(all.map(idOf)).size, all.length, 'a row is drawn twice');
  assert.ok(!all.some((r) => /mute/i.test(typeof r === 'string' ? r : r.label)), 'a Mute row with nothing stored behind it');
  assert.match(CLIENT_SHELL, /more: clientMoreRows\(more\), titleTour: 'client-chat', pane: true \}/);
});

test('2 · a trade page shows only when the shop’s service has it — the shipped desk entitlement, never a new flag', () => {
  const none = clientMoreRows({ songs: null, script: null });
  assert.ok(!none.some((r) => ['songs', 'script'].includes(idOf(r))), 'a trade row with no page behind it');
  const act = clientMoreRows({ songs: BODY })[0]!;
  assert.ok(typeof act !== 'string' && act.label === 'Song list' && act.heading === 'For your trade' && 'body' in act);
  const emcee = clientMoreRows({ script: BODY })[0]!;
  assert.ok(typeof emcee !== 'string' && emcee.label === 'Script' && emcee.heading === 'For your trade' && 'body' in emcee);
  // The page's two gates are the desks' own (`song_desk` · `stage_script`), on the access it already resolved.
  assert.match(PAGE, /const showSongs = isBooked && feeUnlocked && holdsSpecialization\(scriptAccess, 'song_desk'\);/);
  assert.match(PAGE, /const showScript = holdsSpecialization\(scriptAccess, 'stage_script'\);/);
  assert.match(PAGE, /songs: songsNode,\s*script: showScript \? gated\(scriptNode\) : null,/, 'the Script page lost its fee gate or its entitlement');
  assert.match(PAGE, /const songsNode = showSongs \? \([\s\S]{0,400}<SongDesk eventId=\{eventId\} vendorProfileId=\{profile\.vendor_profile_id\} coupleName=\{eventName\} \/>/, 'the Song list is not the shipped desk');
  // A page of its own rises like any other on a phone, and closes onto the chat.
  assert.match(SHELL, /\{extra !== null && chatHome && !paneOn \? \(\s*<RiseScreen title=\{extra\.label\} line=\{chatHome\.line\} data="picked-more-page" onClose=\{\(\) => setExtraId\(null\)\}>/);
});

test('3 · Crew and the calendar file are offered only where they lead somewhere', () => {
  assert.match(PAGE, /crewHref: isBooked \? hubHref\(eventId, 'crew'\) : null,\s*crewDay: dayMonth\(brief\.event\.event_date\),/, 'Crew is offered before booking (the Hub has no such event yet)');
  assert.match(PAGE, /calendar: feeUnlocked && allBlocks\.length > 0 \? \{ href: `\/vendor-dashboard\/clients\/\$\{eventId\}\/calendar\.ics`/, 'the calendar file is offered while it would be a 404');
  assert.ok(!clientMoreRows({ crewHref: null, calendar: null }).some((r) => ['crew', 'calendar'].includes(idOf(r))));
  // A place is a link, a file is the app's one save — never a button that does nothing.
  assert.match(SHELL, /<Link href=\{m\.href\} role="menuitem" onClick=\{\(\) => setMoreOpen\(false\)\} className=\{row\} data-picked-more-row=\{m\.id\}>/);
  assert.match(SHELL, /<SaveFileLink href=\{m\.file\.href\} filename=\{m\.file\.filename\}/);
});

test('4 · on a computer a page opens in its own 420 px column beside the chat — never over it — with its own ←', () => {
  assert.match(SHELL, /const panes = chatHome\?\.pane === true;/);
  assert.match(SHELL, /const split = wide && sideChat !== null && !panes;/, 'the work column is back beside a side chat');
  assert.match(SHELL, /const paneOn = wide && panes;/);
  assert.match(SHELL, /\{risenPage !== null && chatHome && !paneOn \? \(\s*<RiseScreen/, 'a page covers the chat on a computer again');
  const pane = SHELL.slice(SHELL.indexOf('{paneKey !== null && chatHome ? ('));
  assert.match(pane, /<aside[\s\S]{0,200}className="absolute inset-y-0 right-0 hidden w-\[420px\] flex-col[^"]*lg:flex"/, 'the column is not 420 px on the right');
  assert.match(pane, /icon=\{ArrowLeft\} label="Back to chat" onClick=\{closePane\}/, 'the column lost its own ←');
  assert.match(pane, /\{extra \? extra\.body : risenPage !== null \? bodies\[risenPage\] : null\}/, 'the column draws a second copy of a page');
  // The chat narrows by exactly the column (and is on show, so it may mark itself read).
  assert.match(SHELL, /lg:data-\[picked-pane-open\]:pr-\[420px\]/);
  assert.match(SHELL, /<PickedCoveredContext\.Provider value=\{!paneOn && \(risenPage !== null \|\| extra !== null\)\}>/);
  // One page at a time: the key is ONE value, and a ⋯ page of its own takes the place of the page that was open.
  assert.match(SHELL, /const paneKey = !paneOn \? null : extra \? `more:\$\{extra\.id\}` : risenPage;/);
  assert.match(SHELL, /if \(homePage !== null && page !== homePage\) landHome\(\);\s*setExtraId\(id\);/);
  // No tab row at any width, and ⋯ shows on a computer too.
  assert.match(SHELL, /\$\{chatHome \? \(panes \? 'hidden' : 'hidden lg:flex'\) : 'flex'\}/);
  assert.match(SHELL, /className=\{panes \|\| !chatHome \? 'inline-flex shrink-0' : 'inline-flex shrink-0 lg:hidden'\} data-picked-more=""/);
  // The house motion: in at Move on the settle curve, out at 80 % of it; reduced motion moves nothing.
  assert.match(SHELL, /const PANE_OUT_MS = MOVE_MS \* 0\.8;/);
  assert.match(SHELL, /\{ duration: MOVE_MS, easing: EASE_SETTLE \}/);
});

test('5 · Details › Agreed now draws the six facts as drawn — and never an unread one as empty', () => {
  const rows = agreedFacts({
    venue: 'Fernwood Gardens, QC',
    hosts: ['Claire', 'Indalecio'],
    roster: [{ vendor_name: 'Liza Ramos Events', category: 'coordinator' }, { vendor_name: 'Kusina Grace', category: 'catering' }, { bad: 1 }],
    coordinatorTrade: COORDINATOR_TRADE_SERVICES,
    supplier: 'Lumina Lights & Sound',
    stage: 'Quoted',
  });
  assert.deepEqual([agreedEventFact('wedding', '2026-12-18'), ...rows], [
    { label: 'Event', value: 'Wedding · 18 Dec' },
    { label: 'Venue', value: 'Fernwood Gardens, QC' },
    { label: 'Hosts', value: 'Claire & Indalecio' },
    { label: 'Coordinator', value: 'Liza Ramos Events' },
    { label: 'Supplier', value: 'Lumina Lights & Sound' },
    { label: 'Stage', value: 'Quoted' },
  ]);
  // Unread is not empty: no hosts key, no roster (not booked yet), a refused quotes read → no row, never "None".
  const unread = agreedFacts({ venue: null, hosts: undefined, roster: undefined, coordinatorTrade: COORDINATOR_TRADE_SERVICES, supplier: 'Lumina', stage: null });
  assert.deepEqual(unread.map((r) => r.label), ['Venue', 'Supplier']);
  assert.equal(unread[0]!.value, 'Not set yet');
  // Read and none is said.
  const none = agreedFacts({ venue: 'X', hosts: [], roster: [], coordinatorTrade: COORDINATOR_TRADE_SERVICES, supplier: 'Lumina', stage: 'Booked' });
  assert.equal(none.find((r) => r.label === 'Coordinator')!.value, 'None booked');
  assert.equal(agreedEventFact(null, null).value, 'Event · no date yet');
  // The page hands only what it already read; the card adds the Event row from its own event read.
  assert.match(PAGE, /roster: isBooked \? \(brief as \{ vendor_roster\?: unknown \}\)\.vendor_roster : undefined,/);
  assert.match(PAGE, /proposalRowsError \? null : isQuoted \? 'Quoted' : 'Inquiry'/, 'a refused quotes read is worded "Inquiry"');
  assert.match(AGREED, /facts=\{facts \? \[agreedEventFact\(event\.event_type, event\.event_date\), \.\.\.facts\] : undefined\}/);
  assert.match(AGREED, /const EVENT_COLS = 'event_date, estimated_pax, final_pax\b[^']*\bevent_type';/);
});

test('6 · the host has Report a problem under ⋯ too — without becoming a one-chat page before its own build', () => {
  assert.match(HOST_SHELL, /const HOST_MORE: readonly PickedMoreRow<PickedSupplierPage>\[\] = \[\{ id: 'report', label: 'Report a problem', icon: TOPIC_ICON\.report, page: 'report' \}\];/);
  assert.match(HOST_SHELL, /more=\{HOST_MORE\}/);
  assert.doesNotMatch(HOST_SHELL, /chatHome/, 'the host’s picked supplier lost its tabs before its own build');
  // The shell draws ⋯ from either list, hides a row whose page the menu lacks, and never offers a page of its own
  // (`body`) where there is no chat-as-home for it to open over.
  assert.match(SHELL, /\(chatHome \? chatHome\.more : more\)\.flatMap\(/);
  assert.match(SHELL, /if \('body' in row && !chatHome\) return \[\];/);
  // ⋯ is a menu under its own button, as drawn (`.menu.top`, 232 px, top right) — not a sheet from the bottom.
  assert.match(SHELL, /\{moreOpen \? \([\s\S]{0,400}role="menu"[\s\S]{0,200}className="absolute right-2 top-full z-\[var\(--sn-z-nav\)\] mt-1 w-\[232px\]/, 'the ⋯ menu is no longer the drawn top-right menu');
  assert.doesNotMatch(SHELL, /<Sheet open=\{moreOpen\}/, 'the ⋯ menu went back to a bottom sheet');
  // Esc peels one layer: the menu, not the whole client under it.
  assert.match(SHELL, /const escClose = useCallback\(\(\) => \(moreOpen \? closeMore\(\) : close\(\)\)/);
});

test('7 · the head’s search door is a marked slot: it asks the chat inside the tap, and is off until the chat listens', () => {
  assert.match(NAV, /export const PICKED_CHAT_SEARCH_EVENT = 'sn:picked-chat-search';/);
  assert.match(SHELL, /\{headSearch && \(workPage === headSearch\.page \|\| split\) \? \(/, 'the magnifier shows while the chat is not on show');
  assert.match(SHELL, /onClick=\{\(\) => window\.dispatchEvent\(new CustomEvent\(PICKED_CHAT_SEARCH_EVENT, \{ detail: \{ pickedId \} \}\)\)\}/, 'the ask leaves the tap (a phone would not raise its keyboard)');
  assert.match(SHELL, /headSearch = null,/);
  // 🔌 Turn it on (and delete these two lines) in the SAME change that makes the chat listen for the event.
  const listens = read('app/_components/chat-message-stream.tsx').includes('PICKED_CHAT_SEARCH_EVENT');
  for (const [name, src] of [['supplier', CLIENT_SHELL], ['host', HOST_SHELL]] as const) assert.ok(listens || !/headSearch=/.test(src), `the ${name} side draws a magnifier nothing answers`);
});
