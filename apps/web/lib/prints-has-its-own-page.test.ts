/**
 * 🖨 PRINTS HAS ITS OWN PAGE — R8 (owner 2026-10-27, verbatim: *"Prints leaves Studio. It keeps its own page (the approved
 * swipe carousel) and Home gets a Prints line that opens it. No new bottom tab."* — DECISION_LOG "PRINTS LEAVES STUDIO …",
 * corpus 6bc60ed4; 2026-10-28 *"all mapping will be kept"* — every old door forwards; build plan step 7b).
 *
 * One guard per move, each a property (never a phrasing), each sabotaged once (see the PR):
 *
 *   1 · THE TILE MOVED — Studio has no Prints tile, card, mark or Pro line; the Maker has no Prints door (Page ▾,
 *       Settings, the menu's parts).
 *   2 · THE PAGE IS THE SHIPPED WORKSPACE — `/dashboard/<id>/prints` renders the Maker's own page (`LaunchHubPage`) told
 *       by a key no address can carry; the shell names it "Prints" where Stages | Studio stood, covers the stage, and
 *       draws no Studio home and no lower third. Nothing is redrawn.
 *   3 · HOME HOLDS THE DOOR — Home draws the Prints line (it opens the page) only where Prints has work; never a tab.
 *   4 · EVERY OLD DOOR FORWARDS — each old address resolves to the page at the same piece with its query; the Maker's
 *       page forwards before it reads anything; every link into a print (`detailsItemHref`) is the page's; a print
 *       opened inside the Maker loads the page, and anything else opened on the page loads the Maker.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import {
  PRINTS_PAGE_CARRY,
  PRINTS_PAGE_SURFACE,
  isPrintsPageSurface,
  printsForward,
  printsForwardHref,
  printsPageHref,
  printsPageItem,
} from './prints-page';
import { DETAILS_ITEM_KEYS, EVERY_PRINT_ITEM, detailsItemHref, isPrintsItem, PRINTS_ITEM_KEYS } from './maker-details-items';
import { STUDIO_TILE_ITEM, STUDIO_TILE_KEYS } from './studio-tile-defs';
import { STUDIO_TILES, STUDIO_TILE_PARTS } from './studio-tiles';
import { STUDIO_PAGE_CARDS } from './studio-page-cards';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/* ══ 1 · THE TILE MOVED ═══════════════════════════════════════════════════════════════════════════════════════════════ */

test('1 · Studio has no Prints tile — no key, no editor, no words, no card, no mark, no Pro line', async () => {
  assert.ok(STUDIO_TILE_KEYS.length > 0, 'anti-vacuity: no tiles read');
  const has = (o: object) => Object.prototype.hasOwnProperty.call(o, 'prints');
  assert.ok(!(STUDIO_TILE_KEYS as readonly string[]).includes('prints'), 'Prints is a Studio tile again');
  for (const [name, table] of [['STUDIO_TILE_ITEM', STUDIO_TILE_ITEM], ['STUDIO_TILES', STUDIO_TILES], ['STUDIO_TILE_PARTS', STUDIO_TILE_PARTS], ['STUDIO_PAGE_CARDS', STUDIO_PAGE_CARDS]] as const) {
    assert.equal(has(table), false, `${name} keeps a Prints entry`);
  }
  /* No tile opens a print — the page is the print's one home. */
  for (const k of STUDIO_TILE_KEYS) assert.equal(isPrintsItem(STUDIO_TILE_ITEM[k]), false, `the ${k} tile opens a print`);
  const { TILE_ICON } = await import(`../${L}/_components/studio-home`);
  assert.equal(has(TILE_ICON as object), false, 'the Studio home keeps a Prints mark');
});

test('1 · the Maker has no Prints door — Page ▾, Settings and the menu’s parts lead nowhere near a print', async () => {
  const shell = read(`${L}/_components/maker-shell.tsx`);
  const settings = shell.slice(shell.indexOf("ltPick === 'settings'"), shell.indexOf(': isStagePhase(ltPick)'));
  assert.ok(settings.length > 400, 'anti-vacuity: Settings’ rows were not found');
  assert.doesNotMatch(settings, /key: 'prints'/, 'Settings › Prints is back');
  const menu = shell.slice(shell.indexOf('const ltGlobal = ['), shell.indexOf('const openSection'));
  assert.ok(menu.includes("key: 'details', label: 'Your event'"), 'anti-vacuity: the menu’s parts were not found');
  assert.doesNotMatch(menu, /key: 'prints'/, 'Prints is a part of the Maker’s menu again');
  assert.doesNotMatch(shell, /pressDoor\('prints'\)|openSection\('prints'\)|act === 'prints'/, 'a Maker control opens Prints in the Maker again');
  const { MAKER_PAGE_ACTIONS, makerPageActions } = await import(`../${L}/_components/maker-bar`);
  assert.equal(Object.prototype.hasOwnProperty.call(MAKER_PAGE_ACTIONS, 'prints'), false, 'Page ▾ has a Prints act again');
  const rows = (makerPageActions as (o: unknown[], i: unknown) => Array<{ label: string }>)([], { stage: 'rsvp', addScene: null, hasWork: true, canRestore: true });
  assert.ok(rows.length >= 3, 'anti-vacuity: Page ▾’s rows were not built');
  assert.ok(!rows.some((r) => r.label === 'Prints'), 'Page ▾ lists Prints again');
});

/* ══ 2 · THE PAGE IS THE SHIPPED WORKSPACE ═══════════════════════════════════════════════════════════════════════════ */

test('2 · /dashboard/<id>/prints is the Maker’s own page, told by a key no address can carry — nothing redrawn', () => {
  const page = read('app/dashboard/[eventId]/prints/page.tsx');
  assert.match(page, /import LaunchHubPage from '\.\.\/launch\/page';/, 'the Prints page draws something other than the Maker’s page');
  assert.match(page, /<LaunchHubPage\s+params=\{params\}\s+searchParams=\{Promise\.resolve\(\{[\s\S]*?tool: 'details',[\s\S]*?item: printsPageItem\([\s\S]*?\[PRINTS_PAGE_SURFACE\]: true,/, 'the Prints page does not open the Maker’s Details on its print, as Prints');
  assert.match(page, /PRINTS_PAGE_CARRY\.map/, 'the page drops the query a print address carries');
  /* No component of its own: the page is ONE element, the Maker's page. */
  const drawn = page.slice(page.indexOf('return (', page.indexOf('export default async function PrintsPage(')));
  assert.equal((drawn.match(/<[A-Za-z][\w.]*[\s/>]/g) ?? []).length, 1, 'the Prints page draws something of its own beside the Maker’s page');
  /* The key is a Symbol — no address can set it; a query word could. */
  assert.equal(typeof PRINTS_PAGE_SURFACE, 'symbol');
  assert.equal(isPrintsPageSurface({ [PRINTS_PAGE_SURFACE]: true }), true);
  for (const fake of [{ surface: 'prints' }, { prints: '1' }, { [String(PRINTS_PAGE_SURFACE)]: true }, {}, null]) {
    assert.equal(isPrintsPageSurface(fake), false, `${JSON.stringify(fake)} opened the Prints page`);
  }
  /* The Maker's page reads it only through `isPrintsPageSurface`, from the object it was handed. */
  const launch = read(`${L}/page.tsx`);
  assert.match(launch, /const printsPage = isPrintsPageSurface\(search\);/);
  assert.equal((launch.match(/PRINTS_PAGE_SURFACE/g) ?? []).length, 2, 'the Maker’s page reads the Prints key some other way (its import and its type only)');
  /* The page opens where the tile opened: the head of the Prints form, or the print its address names. */
  assert.equal(printsPageItem({}), EVERY_PRINT_ITEM);
  for (const k of PRINTS_ITEM_KEYS) assert.equal(printsPageItem({ item: k }), k, `the page does not open ${k}`);
  for (const k of DETAILS_ITEM_KEYS.filter((x) => !isPrintsItem(x))) assert.equal(printsPageItem({ item: k }), EVERY_PRINT_ITEM, `the page opens ${k}, which is no print`);
  assert.equal(printsPageItem({ menuFlash: true }), 'menu', 'the Menu editor’s save does not come back to the Menu');
});

async function paintShell(props: Record<string, unknown>): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MakerShell } = await import(`../${L}/_components/maker-shell`);
  return renderToStaticMarkup(
    React.createElement(
      MakerShell as unknown as React.ComponentType<Record<string, unknown>>,
      {
        eventId: 'ev-1',
        slug: 'maria-and-jose',
        liveStage: 'rsvp',
        initialStage: 'rsvp',
        initialSelection: { kind: 'tool', key: 'details' },
        storeShell: false,
        tourSlides: [],
        firstVisit: false,
        completeTourAction: async () => {},
        renderStamp: '1',
        more: null,
        applySlot: React.createElement('i', { 'data-stub': 'draft-bar' }),
        details: { page: React.createElement('div', { 'data-stub': 'prints-workspace' }), controls: null },
        studio: { tiles: [] },
        hasWork: true,
        ...props,
      },
      React.createElement('div', { 'data-stub': 'work' }),
    ),
  );
}

test('2 · the shell draws Prints alone: "Prints" where Stages | Studio stood, ✕ · ↶ · ✓ kept, the workspace full screen', async () => {
  const prints = await paintShell({ printsPage: true });
  const maker = await paintShell({});
  assert.ok(prints.includes('data-maker-shell=""') && prints.length > 1500, 'anti-vacuity: the shell was not drawn');
  /* The top bar: the page's name, never the switch; Exit and the draft bar as ever. */
  assert.match(prints, /<h1 data-maker-tool="side" data-bar-item="Prints"[^>]*data-prints-page-title=""[^>]*>Prints<\/h1>/, 'the Prints page does not name itself where the switch stood');
  assert.doesNotMatch(prints, /data-bar-item="Stages or Studio"/, 'the Prints page draws Stages | Studio');
  for (const html of [prints, maker]) {
    assert.match(html, /data-maker-tool="exit"/, 'Exit is gone');
    assert.match(html, /data-stub="draft-bar"/, 'Undo · Apply is gone');
  }
  assert.match(maker, /data-bar-item="Stages or Studio"/, 'anti-vacuity: the Maker no longer draws its switch');
  assert.doesNotMatch(maker, /data-prints-page-title/, 'the Maker names itself Prints');
  /* The workspace, full screen — as the Studio tile drew it: no Studio home, no lower third, the editor's room kept. */
  assert.match(prints, /data-maker-details-layer=""[\s\S]*data-stub="prints-workspace"/, 'the Prints workspace is not drawn');
  assert.match(prints, /data-maker-studio-full=""/, 'the Prints page is not full screen');
  assert.match(prints, /data-maker-studio-room=""/, 'the editor’s room under the carousel is gone');
  assert.doesNotMatch(prints, /data-studio-home=|data-maker-lower-third=|data-lt-item-menu/, 'the Prints page draws the Studio home or the lower third');
  /* 🖥 …and on a desktop it wears the Maker's columns, as Studio › Prints did (the switch mounts them everywhere else). */
  const shell = read(`${L}/_components/maker-shell.tsx`);
  const title = shell.slice(shell.indexOf('data-prints-page-title'), shell.indexOf('</h1>', shell.indexOf('data-prints-page-title')));
  assert.match(title, /<PrintsPageDesk \/>/, 'the Prints page drops the desktop columns');
  assert.match(read(`${L}/_components/stages-studio-parts.tsx`), /export function PrintsPageDesk\(\) \{\s*const wide = useIsDesktop\('lg'\);\s*return useMaker\(\)\?\.stagesStudio === true && wide \? <MakerDesk \/> : null;/);
});

/* ══ 3 · HOME HOLDS THE DOOR ══════════════════════════════════════════════════════════════════════════════════════════ */

test('3 · Home draws one Prints line that opens the page — only where Prints has work; never a bottom tab', async () => {
  const H = await import('../app/dashboard/[eventId]/home-render.harness');
  await H.loadHome();
  const on = H.drawHome({ prints: true });
  const off = H.drawHome({ prints: false });
  const line = on.slice(on.indexOf('data-home-prints-line'), on.indexOf('</article>', on.indexOf('data-home-prints-line')));
  assert.ok(line.length > 100, 'Home draws no Prints line');
  assert.equal((on.match(/data-home-prints-line=""/g) ?? []).length, 1, 'Home draws the Prints line more than once');
  assert.ok(line.includes(`href="${printsPageHref('e1')}"`), 'the Prints line does not open the Prints page');
  assert.match(line, /aria-label="About Prints"/, 'the Prints line has no ⓘ');
  assert.ok(line.includes('Invitation set · for the day'), 'the Prints line says nothing about what it holds');
  /* Home holds the DOOR, never the tool: nothing of the workspace is on Home. */
  assert.doesNotMatch(on, /data-prints-track|data-prints-paper|data-details-workspace/, 'Home draws the Prints tool itself');
  assert.doesNotMatch(off, /data-home-prints-line/, 'Home draws the Prints line where Prints has no work');
  /* The page decides it from the Maker's own rule (`makerHasWork`) and what the event needs — as the tile was offered. */
  const home = read('app/dashboard/[eventId]/page.tsx');
  assert.match(home, /prints=\{makerHasWork\(viewerMemberType, surfaceEnabled\(needsProfile, 'website'\)\) && eventNeeds\.hubDetails\}/);
  /* No new bottom tab. */
  const nav = read('app/dashboard/[eventId]/_components/customer-nav-config.ts');
  assert.ok(nav.length > 400, 'anti-vacuity: the event bar was not read');
  assert.doesNotMatch(nav, /\/prints\b|['"]prints['"]/, 'Prints became a tab of the event bar');
});

/* ══ 4 · EVERY OLD DOOR FORWARDS ══════════════════════════════════════════════════════════════════════════════════════ */

test('4 · every old print address resolves to the page at the same piece — and nothing else is forwarded', () => {
  const cases: Array<[Parameters<typeof printsForward>[0], string | null]> = [
    // Prints & Tickets' old page, a size pick's return, a bookmark.
    [{ tool: 'prints' }, 'invitation'],
    [{ tool: 'prints', menuFlash: true }, 'menu'],
    // The Studio tile's own address, and each print named.
    [{ tool: 'details', item: 'every-print' }, 'every-print'],
    [{ item: 'every-print' }, 'every-print'],
    [{ tool: 'details', item: 'menu' }, 'menu'],
    [{ tool: 'details', item: 'pass' }, 'pass'],
    [{ tool: 'details', item: 'qr-codes' }, 'qr-codes'],
    [{ tool: 'details', item: 'download' }, 'download'],
    // Not a print — stays in the Maker.
    [{}, null],
    [{ tool: 'details' }, null],
    [{ tool: 'details', item: 'names' }, null],
    [{ tool: 'prints', printTheme: 'vintage' }, null],
    [{ tool: 'details', item: '<script>' }, null],
    [{ tool: 'logo' }, null],
  ];
  for (const [search, want] of cases) assert.equal(printsForward(search), want, `${JSON.stringify(search)} forwards to ${printsForward(search)}`);
  /* Every print, by name. */
  for (const k of PRINTS_ITEM_KEYS) assert.equal(printsForward({ tool: 'details', item: k }), k, `${k} is not forwarded`);
  /* The forward carries the query a print address carries — and only that. */
  assert.equal(
    printsForwardHref('e-1', 'pass', { tool: 'details', item: 'pass', pass_format: 'train', print_saved: '1', scene: 'w1', viewas: 'guest' }),
    '/dashboard/e-1/prints?item=pass&print_saved=1&pass_format=train&viewas=guest',
  );
  assert.ok(PRINTS_PAGE_CARRY.length >= 9, 'anti-vacuity');
});

test('4 · the Maker’s page forwards a print address BEFORE it reads anything, and never forwards the Prints page', () => {
  const launch = read(`${L}/page.tsx`);
  const body = launch.slice(launch.indexOf('export default async function LaunchHubPage('));
  const gate = body.indexOf("redirect(`/dashboard/${eventId}`);");
  const fwd = body.indexOf('if (print) redirect(printsForwardHref(eventId, print, search));');
  const firstRead = body.indexOf('void startAhead(');
  assert.ok(gate > 0 && fwd > 0 && firstRead > 0, 'anti-vacuity: the host gate, the forward or the first read was not found');
  assert.ok(gate < fwd && fwd < firstRead, 'the forward is not between the host gate and the Maker’s reads');
  assert.match(body.slice(gate, fwd), /if \(!printsPage\) \{\s*const print = printsForward\(\{\s*tool: one\(search\.tool\),\s*item: one\(search\.item\),/, 'the forward is not skipped on the Prints page, or reads another address');
  /* A viewer the Prints page has nothing for goes Home — never a Maker without work. */
  assert.match(body, /if \(printsPage && !hasWork\) redirect\(`\/dashboard\/\$\{eventId\}`\);/);
  assert.match(body, /if \(printsPage && !eventNeeds\.hubDetails\) redirect\(`\/dashboard\/\$\{eventId\}`\);/);
});

test('4 · every link into a print is the page’s — and the guest card’s return from the invitation too', () => {
  for (const k of DETAILS_ITEM_KEYS) {
    const href = detailsItemHref('e-1', k);
    if (isPrintsItem(k)) assert.equal(href, `/dashboard/e-1/prints?item=${k}`, `${k}’s address is not the Prints page`);
    else assert.equal(href, `/dashboard/e-1/launch?tool=details&item=${k}`, `${k}’s address left the Maker`);
  }
  assert.equal(detailsItemHref('e-1', 'pass', '&pass_format=boarding'), '/dashboard/e-1/prints?item=pass&pass_format=boarding');
  assert.match(read('app/dashboard/[eventId]/guests/open-guest-card.tsx'), /invitation: \(eventId: string\) => printsPageHref\(eventId, 'invitation'\),/);
  /* A print form posted without JavaScript comes back to the Prints page — never the Maker, whose print addresses only forward. */
  const route = read('app/api/hub-print/[piece]/route.ts');
  assert.match(route, /const back = new URL\(printsPageHref\(eventId, piece === 'menu' \? 'menu' : 'invitation'\), req\.url\);/);
  assert.doesNotMatch(route, /\/dashboard\/\$\{eventId\}\/launch/, 'a print save returns to the Maker again');
});

test('4 · one door each way inside the app: a print in the Maker loads the page; anything else on the page loads the Maker', () => {
  const shell = read(`${L}/_components/maker-shell.tsx`);
  assert.match(
    shell,
    /const itemElsewhere = hasWork && detailsOpen && detailsItem !== null && isPrintsItem\(detailsItem\) !== printsPage \? detailsItem : null;/,
    'the shell no longer tells a print in the Maker (or a non-print on the Prints page) apart',
  );
  assert.match(shell, /const to = detailsItemHref\(eventId, itemElsewhere\);\s*if \(printsPage\) window\.location\.assign\(to\);\s*else window\.location\.replace\(to\);/);
  /* A tab that came back puts a print back only on the Prints page — never the Maker on a print. */
  assert.match(shell, /if \(isDetailsItemKey\(back\.item\) && isPrintsItem\(back\.item\) === printsPage\) setDetailsItem\(back\.item\);/);
  /* …and the two pages keep separate memories. */
  assert.match(shell, /const memoryKey = printsPage \? `sn-maker-prints:\$\{eventId\}` : `sn-maker:\$\{eventId\}`;/);
});
