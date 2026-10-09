/**
 * the-maker-lower-third-holds-every-tool.test.ts — THE MAKER'S LOWER THIRD
 * (owner 2026-10-05: *"we only maximize the height on the lower third. and all
 * tools can only reside on the thumb area / lower third"* → *"approve"* of
 * `prototypes/maker_lower_third_interactive_2026-10-05_fable.html`; then *"each
 * scene and setting must be there and not links. editing should be on the
 * actual tool thirds"*).
 *
 *   1 · THE ORDER IS FIXED — top nav · the page · the lower third, in the
 *       shell's flow; inside it, "where you are" above the navigator. Nothing
 *       of the lower third is `fixed` or floats, so it can never jump above
 *       the page or below anything.
 *   2 · THE MENU HAS EXACTLY TWO GROUPS — Global settings (Theme · Settings ·
 *       Details) and Stages (Save the Date · RSVP · Invitation · The Day ·
 *       Post Event) — a sheet INSIDE the lower third, never over the page.
 *   3 · A TOOL OPEN FOLDS THE NAVIGATOR INTO THE LEFT COLUMN — the tool's name,
 *       ‹ ›, × — and the tool takes the rest: ≥ 300 px at 375.
 *   4 · EVERY OLD DOOR IS REACHABLE — each control the bottom bar, Page ▾ and
 *       the floating Event Bar held has its home in the lower third.
 *   5 · NO TOOL OF THE LOWER THIRD LINKS OUT — no `href` to another page and no
 *       router push from the lower third, a scene's sheet or a tile's note.
 *
 * Each was broken once by hand and seen RED before it was trusted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from './strip-comments';
import { MAKER_LT_COLUMN_PX, MAKER_LT_TOOL, MAKER_LT_TOOL_MIN_PX } from './maker-phone-room';
import { makerDoorOf, MAKER_PAGE_STAGES, makerStageLabel } from '../app/dashboard/[eventId]/launch/_components/maker-bar';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const E = 'app/dashboard/[eventId]/website/editor/_components';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const ROUTER = { refresh() {}, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} };

async function shell(): Promise<string> {
  const { MakerShell } = await import(`../${L}/maker-shell`);
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  return renderToStaticMarkup(
    React.createElement(
      AppRouterContext.Provider,
      { value: ROUTER as never },
      React.createElement(
        MakerShell,
        {
          eventId: 'e1',
          slug: 'maria-and-jose',
          liveStage: 'rsvp',
          initialStage: 'rsvp',
          storeShell: false,
          tourSlides: [],
          firstVisit: false,
          completeTourAction: async () => {},
          renderStamp: '1',
          more: null,
          hasWork: true,
        },
        React.createElement('i', { 'data-probe-work': '' }),
      ),
    ),
  );
}

async function lowerThird(props: Record<string, unknown>): Promise<string> {
  const { MakerLowerThird } = await import(`../${L}/maker-lower-third`);
  return renderToStaticMarkup(
    React.createElement(MakerLowerThird, {
      pick: 'rsvp-stage',
      pickLabel: 'RSVP',
      where: 'RSVP form',
      global: [
        { key: 'theme', label: 'Theme' },
        { key: 'settings', label: 'Settings' },
        { key: 'details', label: 'Details' },
      ],
      stages: MAKER_PAGE_STAGES.map((s) => ({ key: s, label: makerStageLabel(s) })),
      onPick: () => {},
      parts: [],
      tool: null,
      setNav: () => {},
      stepTiles: true,
      ...props,
    }),
  );
}

/* ══ 1 · THE ORDER IS FIXED ═════════════════════════════════════════════════ */

test('1 · top nav · the page · the lower third — in the shell’s flow, in that order; nothing of the lower third floats', async () => {
  const html = await shell();
  const top = html.indexOf('<header data-maker-toolbar=""');
  const page = html.indexOf('data-probe-work=""');
  const lt = html.indexOf('data-maker-lower-third=""');
  assert.ok(top >= 0 && page >= 0 && lt >= 0, 'a zone was not drawn');
  assert.ok(top < page && page < lt, `the zones are out of order: top ${top} · page ${page} · lower third ${lt}`);
  const tag = /<section\b[^>]*data-maker-lower-third=""[^>]*>/.exec(html)![0];
  const cls = /\bclass="([^"]*)"/.exec(tag)![1]!.split(/\s+/);
  for (const bad of ['fixed', 'absolute', 'sticky']) assert.ok(!cls.includes(bad), `the lower third is ${bad} — it can leave its place`);
  assert.ok(cls.includes('shrink-0') && cls.includes('relative'), 'the lower third is not a block of the shell’s flow');
  // Inside: "where you are" above the navigator.
  const where = html.indexOf('data-lt-where=""');
  const nav = html.indexOf('data-lt-navigator=""');
  assert.ok(where > lt && nav > where, '"where you are" is not above the navigator');
  // The old bottom bar is gone, not hidden.
  assert.doesNotMatch(html, /data-maker-bottom-bar|aria-label="Maker tools"/, 'the old bottom bar is back');
});

/* ══ 2 · THE MENU: EXACTLY TWO GROUPS ═══════════════════════════════════════ */

test('2 · the menu is a sheet INSIDE the lower third with exactly two groups — Global settings · Stages', async () => {
  const html = await lowerThird({});
  const groups = [...html.matchAll(/data-lt-menu-group="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(groups, ['global', 'stages'], `the menu's groups are ${groups.join(' · ')}`);
  const rowsOf = (g: string) => {
    const at = html.indexOf(`data-lt-menu-group="${g}"`);
    const seg = html.slice(at, html.indexOf('</ul>', at));
    return [...seg.matchAll(/data-lt-menu-row="([^"]+)"/g)].map((m) => m[1]);
  };
  assert.deepEqual(rowsOf('global'), ['theme', 'settings', 'details']);
  assert.deepEqual(rowsOf('stages'), ['save_the_date', 'rsvp-stage', 'rsvp', 'event', 'editorial']);
  assert.deepEqual(MAKER_PAGE_STAGES.map(makerStageLabel), ['Save the Date', 'RSVP', 'Invitation', 'The Day', 'Post Event']);
  // Inside the lower third: absolutely placed in it, shut by sliding down — never `fixed` over the page.
  const menu = /<div\b[^>]*data-lt-menu=""[^>]*>/.exec(html)![0];
  assert.match(menu, /class="absolute inset-0 /, 'the menu is not a sheet inside the lower third');
  assert.doesNotMatch(menu, /\bfixed\b/, 'the menu floats over the page');
  assert.match(menu, /aria-hidden="true"/, 'a shut menu is not hidden from a screen reader');
  // One open at a time (`lib/one-open.ts`).
  assert.match(read(`${L}/maker-lower-third.tsx`), /const menuId = useOneOpen\(menuOpen, setMenuOpen\);/);
});

/* ══ 3 · A TOOL OPEN: THE LEFT COLUMN AND ≥ 300 PX ══════════════════════════ */

test('3 · a tool open folds the menu and the navigator into the left column — name · ‹ › · × — and the tool takes ≥ 300 px', async () => {
  let closed = 0;
  const html = await lowerThird({ tool: { key: 'part:f:hero:names', name: 'Names', close: () => (closed += 1), step: { prev: null, next: () => {} } } });
  const col = /<div\b[^>]*data-lt-column=""[^>]*>/.exec(html)![0];
  assert.match(col, /\bw-\[52px\]/, 'the column is not 52 px');
  assert.doesNotMatch(col, /aria-hidden/, 'the column is hidden while a tool is open');
  assert.match(html, /data-lt-column-name=""[\s\S]*?>Names</, 'the column does not name the tool');
  assert.match(html, /data-lt-step="prev"[^>]*disabled=""/, '‹ is offered with nothing before');
  assert.doesNotMatch(/<button\b[^>]*data-lt-step="next"[^>]*>/.exec(html)![0], /\sdisabled=""/, '› is not offered');
  assert.match(html, /data-lt-close=""/, 'the column has no ×');
  // The rows step aside — out of reach of a tap and of a screen reader.
  const rows = /<div\b[^>]*data-lt-rows=""[^>]*>/.exec(html)![0];
  assert.match(rows, /aria-hidden="true"/);
  assert.match(rows, /\binert=""/);
  assert.match(rows, /-translate-x-6 opacity-0/, 'the navigator does not fold sideways');
  // …and at rest the rows carry NO transform (a transformed box would hold every fixed child).
  const rest = /<div\b[^>]*data-lt-rows=""[^>]*>/.exec(await lowerThird({}))![0];
  assert.doesNotMatch(rest, /translate-x/, 'the navigator wears a transform at rest');
  // The tool's width at 375, READ from its classes: right of the column (its left
  // offset clears the column's 52 px), 4 px from the right edge.
  const left = Number(/max-lg:left-\[(\d+)px\]/.exec(MAKER_LT_TOOL)?.[1]);
  const right = /max-lg:right-1\b/.test(MAKER_LT_TOOL) ? 4 : NaN;
  assert.ok(left >= MAKER_LT_COLUMN_PX + 4, `the tool (left ${left}) sits over the column (${MAKER_LT_COLUMN_PX} px)`);
  assert.ok(375 - left - right >= MAKER_LT_TOOL_MIN_PX, `the tool is ${375 - left - right} px at 375 — under ${MAKER_LT_TOOL_MIN_PX}`);
  // 200–280 ms, instant under Reduce Motion.
  const src = read(`${L}/maker-lower-third.tsx`);
  for (const m of src.matchAll(/duration-\[(\d+)ms\]/g)) assert.ok(Number(m[1]) >= 200 && Number(m[1]) <= 280, `a ${m[1]} ms move`);
  assert.ok((src.match(/motion-reduce:transition-none/g) ?? []).length >= 3, 'a move is not instant under Reduce Motion');
  assert.equal(closed, 0, 'drawing the column closed the tool');
});

test('3 · ‹ › step within the tile’s own group — scene to scene, never into the stage’s pages; off tiles skipped (behaviour)', async () => {
  const { stepTileIn } = await import(`../${L}/maker-lower-third`);
  const row = [
    { group: 'parts', on: true, off: false }, // Welcome — the page on screen stays on while a scene is open
    { group: 'parts', on: false, off: false }, // Details
    { group: 'scenes', on: true, off: false }, // Names & date — open
    { group: 'scenes', on: false, off: true }, // a scene that is off
    { group: 'scenes', on: false, off: false }, // Personal greeting
  ];
  assert.equal(stepTileIn(row, 1), 4, '› did not skip the off scene to the next one');
  assert.equal(stepTileIn(row, -1), null, '‹ from the first scene stepped into the stage’s pages');
  assert.equal(stepTileIn(row.map((t) => ({ ...t, on: false })), 1), null, 'a step with nothing open moved');
  // With only a part on (a page's own tool), ‹ › walk the parts.
  assert.equal(stepTileIn(row.map((t, i) => ({ ...t, on: i === 0 })), 1), 1);
  // Every layer's tiles say their group — the scene strip's included, so a scene sheet’s ‹ › work.
  const work = read(`${E}/editor-shell.tsx`);
  assert.match(work, /data-lt-tile=\{tile\.key\}\s*data-lt-group="scenes"/, 'a scene tile is not a tile of the navigator — the scene sheet’s ‹ › do nothing');
  /* 🗂 2026-10-06: Look's sections are Event Details items (one 'details' group of tiles), no 'look' parts. */
  for (const [file, group] of [[`${L}/details-workspace.tsx`, 'details'], [`${L}/maker-rsvp-stage.tsx`, 'rsvp']] as const) {
    assert.match(read(file), new RegExp(`data-lt-group="${group}"`), `${file}: its tiles have no group`);
  }
  assert.match(read(`${L}/maker-lower-third.tsx`), /data-lt-group=\{group\}/);
});

test('3 · the part tapped on the page is a tool: the part sheet registers, and ‹ › step to its scene’s other parts', () => {
  const sheet = read(`${E}/element-sheet.tsx`);
  assert.match(sheet, /useMakerTool\(true, \{\s*key: `part:\$\{target\.key\}:\$\{target\.el\}`,\s*name: HUB_ELEMENT_LABEL\[target\.el\],\s*close: onClose,\s*step: \{ prev: prevPart && onPart \? \(\) => onPart\(prevPart\) : null, next: nextPart && onPart \? \(\) => onPart\(nextPart\) : null \},/);
  assert.match(sheet, /\$\{MAKER_LT_TOOL\}/, 'the part sheet is not in the lower third');
  assert.match(sheet, /<ISegmented label="Edit this part">/, 'the part sheet lost Text · Motion · Arrange');
});

/* ══ 4 · EVERY OLD DOOR IS REACHABLE ════════════════════════════════════════ */

test('4 · every control the bottom bar, Page ▾ and the floating Event Bar held has its home in the lower third', () => {
  const shellSrc = read(`${L}/maker-shell.tsx`);
  // Page ▾'s stages → the menu's Stages; its pages → a stage's PARTS (`pickPage`).
  assert.match(shellSrc, /const ltStages = MAKER_PAGE_STAGES\.filter/);
  assert.match(shellSrc, /\(\) => pickPage\(o\.key\),/, 'a stage’s pages are not its parts');
  // 🗂 Global settings MIRRORS Event Details (owner 2026-10-06): Look · Story & plans ·
  // Your event · Prints — each opens Event Details on that part, on the navigator.
  assert.match(shellSrc, /const sec = SECTION_OF_LT_PICK\[key\];\s*if \(sec\) return openSection\(sec\);/);
  assert.match(shellSrc, /const SECTION_OF_LT_PICK: Record<string, DetailsLtSection \| undefined> = \{ theme: 'look', story: 'story', details: 'event', prints: 'prints' \};/);
  // Page ▾'s other rows and the canvas's Event Bar → Settings.
  const settings = shellSrc.slice(shellSrc.indexOf("ltPick === 'settings'"), shellSrc.indexOf(': isStagePhase(ltPick)'));
  const DOORS: Array<[string, RegExp]> = [
    ['Event Bar', /key: 'event-bar'[\s\S]*?toggle: true, on: eventBar\.on, onPick: eventBar\.toggle/],
    ['Who can view', /key: 'who'[\s\S]*?onPick: \(\) => setMoreOpen\(true\)/],
    ['Prints', /key: 'prints'[\s\S]*?openSection\('prints'\)/],
    ['Restore what guests see', /key: 'restore'[\s\S]*?draft\.restore\(\)/],
    ['Reset this stage…', /key: 'reset'[\s\S]*?new Event\(MAKER_OPEN_RESET_EVENT\)/],
    ['About the Maker', /key: 'about'[\s\S]*?setTour\(true\)/],
  ];
  for (const [door, re] of DOORS) assert.match(settings, re, `${door} has no home in Settings`);
  // The address is Details › Your Event Hub (a Details item, on the Details door).
  assert.equal(makerDoorOf('address'), 'details');
  // ＋ Add a scene stays the strip's last tile — the strip IS the stage's navigator on a phone.
  const work = read(`${E}/editor-shell.tsx`);
  assert.match(work, /<IntoLowerThird to=\{ltNav\}>[\s\S]*triggerLabel="\+ Add a scene"[\s\S]*<\/IntoLowerThird>/, 'Add a scene is not in the navigator');
  // The canvas's floating Event Bar switch is a desktop's only; a phone's is Settings' tile.
  assert.match(work, /setEventBar\?\.\(publicLandingUrl \? \{ on: guestBars, toggle: \(\) => toggleRef\.current\(\) \} : null\);/);
  assert.match(work, /<div className="flex w-full shrink-0 items-center justify-end gap-1 pt-1\.5 max-lg:hidden">\s*<button\s+type="button"\s+role="switch"/);
  // The RSVP's three screens and Details' items draw THEIR tiles into the navigator. (The Logo's
  // panels are its own, under the logo — never navigator tiles: `the-logo-maker-opens-ready-to-edit.test.ts`.)
  assert.match(read(`${L}/maker-rsvp-stage.tsx`), /<IntoLowerThird to=\{maker\.ltNav\}>/);
  assert.match(read(`${L}/details-workspace.tsx`), /<IntoLowerThird to=\{ltNav\}>/);
});

test('4 · a jump to another item (Look → the address, the Mood Board, the love story) moves the pick with it — never snaps back', () => {
  // The door IS the item's (`makerDoorOf`) — on the navigator and on the menu alike.
  // 🗂 ONE door since 2026-10-06: a Look item is Event Details'.
  assert.equal(makerDoorOf('theme'), 'details');
  assert.equal(makerDoorOf('mood-board'), 'details');
  assert.equal(makerDoorOf('pass'), 'prints');
  assert.equal(makerDoorOf('address'), 'details');
  assert.equal(makerDoorOf('love-story'), 'details');
  const ws = read(`${L}/details-workspace.tsx`);
  assert.match(ws, /const here = ltSection\(selected\);/, 'the navigator lists another part’s items than the picked one’s');
  assert.doesNotMatch(ws, /firstOfDoor|select\(firstOf/, 'a jump is snapped back to the first item of the old door');
  const shellSrc = read(`${L}/maker-shell.tsx`);
  assert.match(shellSrc, /const doorShown: MakerDoor \| null =\s*selection\?\.kind === 'tool' && selection\.key === 'details' && \(openDoor === 'look' \|\| openDoor === 'details' \|\| openDoor === 'prints'\)\s*\? openDoor/, 'the menu’s pick does not follow the item on screen');
  assert.doesNotMatch(shellSrc, /detailsDoorKind/, 'a remembered door overrides the item on screen again');
});

/* ══ 5 · NO TOOL OF THE LOWER THIRD LINKS OUT ═══════════════════════════════ */

/**
 * The links out of the Maker that are still in its tools — each owner-listed
 * (DECISION_LOG 2026-10-05 "BUILT — THE MAKER'S THREE ZONES": "NOT YET IN THE
 * LOWER THIRD"). A NEW one fails this; moving one into the lower third means
 * lowering its count here.
 */
const KNOWN_LINK_OUTS: Record<string, { count: number; why: string }> = {
  [`${L}/details-guide.tsx`]: { count: 3, why: 'the guided step "Your guests’ names" (→ guest list import), Send, a link step’s one way in' },
  [`${L}/maker-prints.tsx`]: { count: 3, why: '#print-menu (in page) · the Pro unlock · the 3D seat plan' },
  /* maker-details.tsx: its one link out (Prints › Set up E-Gifts → /pabuya) became E-Gifts' own editor IN PLACE (owner 2026-10-08). */
  [`${L}/details-date-clash.tsx`]: { count: 1, why: 'a clashing supplier’s thread' },
};
const TOOL_FILES = [
  `${L}/maker-lower-third.tsx`,
  `${L}/maker-shell.tsx`,
  `${L}/details-workspace.tsx`,
  `${L}/details-look-pages.tsx`,
  `${L}/maker-logo.tsx`,
  `${L}/maker-page.tsx`,
  `${L}/maker-sheet.tsx`,
  `${L}/maker-rsvp-stage.tsx`,
  `${L}/maker-rsvp-ask.tsx`,
  `${L}/details-your-event.tsx`,
  `${L}/details-your-event-parts.tsx`,
  `${E}/element-sheet.tsx`,
  `${E}/part-inspector.tsx`,
  `${E}/scene-inspector.tsx`,
  `${E}/scene-animate-tab.tsx`,
  `${E}/media-panels.tsx`,
  ...Object.keys(KNOWN_LINK_OUTS),
];
/** Links to another page: a <Link>, an <a href> that is not a download, a router push or a location write. */
function linkOuts(src: string): number {
  const links = (src.match(/<Link\b/g) ?? []).length;
  const anchors = [...src.matchAll(/<a\b[^>]*>/g)].filter((m) => /\bhref=/.test(m[0]) && !/\bdownload\b/.test(m[0])).length;
  const pushes = (src.match(/router\.(?:push|replace)\(|location\.(?:href\s*=|assign\()|window\.open\(/g) ?? []).length;
  return links + anchors + pushes;
}

test('5 · no tool of the lower third links out of the Maker — the known few are listed, a new one fails', () => {
  let scanned = 0;
  for (const file of TOOL_FILES) {
    const src = read(file);
    assert.ok(src.length > 400, `${file} scanned nearly empty`);
    scanned += 1;
    const known = KNOWN_LINK_OUTS[file]?.count ?? 0;
    /* 🚪 AMENDED 08 Oct (owner: *"why can't i go back to events?"* → *"Okay, fix the three step."*): ✕ no longer
       links out by itself — it opens the way-out sheet — so the shell is allowed NO link out at all now (it was
       allowed its one ✕). The Maker's way out is counted below, in the sheet: exactly its two doors. */
    const seen = linkOuts(src);
    assert.equal(seen, known, `${file}: ${seen} link(s) out of the Maker, ${known} known${KNOWN_LINK_OUTS[file] ? ` (${KNOWN_LINK_OUTS[file]!.why})` : ''}`);
  }
  assert.ok(scanned >= 15, 'the scan is blind');
  // The Maker's way out: ✕ → the sheet's two doors (Back to this event · All events), and nothing else.
  const way = read('app/dashboard/[eventId]/launch/_components/maker-exit-sheet.tsx');
  assert.equal((way.match(/<ActionButton\b[^>]*\bhref=/g) ?? []).length, 1, 'the way-out sheet draws its doors from one list');
  assert.equal((way.match(/href: [`']\/dashboard/g) ?? []).length, 2, 'the way out is exactly two doors');
  assert.equal(linkOuts(way), 0, 'the way-out sheet navigates some other way');
  // The scene sheet and the navigator's notes — in the work area.
  const work = read(`${E}/editor-shell.tsx`);
  const inspector = work.slice(work.indexOf('function Inspector('), work.indexOf('function makerSelectionKey('));
  assert.ok(inspector.length > 2000, 'the scene sheet was not found — this scan is blind');
  assert.equal(linkOuts(inspector), 0, 'a scene sheet links out of the Maker');
  assert.doesNotMatch(inspector, /onOpenTool/);
  const nav = work.slice(work.indexOf('aria-label="Scenes"'), work.indexOf('aria-label="Preview"'));
  assert.ok(nav.length > 2000, 'the navigator was not found — this scan is blind');
  assert.equal(linkOuts(nav), 0, 'a tile’s note links out of the Maker');
  // Settings › Who can view (the "Your Event Hub" tool): its rows, portalled from the work area — the Pro unlock only.
  const more = work.slice(work.indexOf('function MoreExtras('), work.indexOf('\n}\n', work.indexOf('function MoreExtras(')));
  assert.ok(more.length > 400, 'the Your Event Hub rows were not found — this scan is blind');
  assert.equal(linkOuts(more), 1, 'the Your Event Hub tool links out beyond its Pro unlock');
  // The fixed scenes' "where it comes from" is said, never linked.
  assert.match(inspector, /data-maker-fixed-source=\{fixed\}>\s*\{f\.source\.text\}\s*<\/p>/);
});

/* ── 6 · a door used once never opens the next Details mount (review round 2) ── */

test('🔑 6 · after Settings › Prints, a later Theme/Details mount lands on its navigator — the tool stays shut', async () => {
  // The sequence: Settings › Prints (the Maker's door count moved), × the tool, a stage, then
  // Theme. Details mounts FRESH with that count > 0 — and once opened its editor straight away.
  const { renderSettled } = await import('./render-settled.test-helper');
  const { DetailsWorkspace } = await import(`../${L}/details-workspace`);
  const { MakerContext } = await import(`../${L}/maker-context`);
  const NAV = ['names', 'date', 'theme', 'hero', 'address'];
  const items = NAV.map((k) => ({ key: k, group: 'g', label: k, icon: null, done: false }));
  const mount = (value: Record<string, unknown>) =>
    renderSettled(
      React.createElement(
        MakerContext.Provider,
        { value: { eventId: 'e1', ...value } as never },
        React.createElement(DetailsWorkspace, {
          groups: [{ key: 'g', label: 'G', items }],
          bodies: Object.fromEntries(NAV.map((k) => [k, 'B'])),
          editors: Object.fromEntries(NAV.map((k) => [k, React.createElement('i', { 'data-stub-editor': k })])),
          initial: 'theme',
        }),
      ),
    );
  const panelOpen = (html: string) => {
    const at = html.indexOf('data-details-editor-panel=""');
    assert.ok(at > 0, 'anti-vacuity: no editor panel drawn');
    return /^[^>]*data-open=""/.test(html.slice(at));
  };
  for (const door of [1, 3]) {
    assert.equal(panelOpen(await mount({ detailsDoor: door, lowerThird: true })), false, `a phone mount after ${door} door press(es) opened the tool`);
  }
  // Desktop unchanged: a door's mount still opens its column as before.
  assert.equal(panelOpen(await mount({ detailsDoor: 1, lowerThird: false })), true, 'anti-vacuity: the desktop door no longer opens');
  // …and the lower third's Prints tile opens on the NAVIGATOR (its print tiles), never as a door press.
  const shell = read(`${L}/maker-shell.tsx`);
  /* Settings' own Prints tile (the menu's Prints row, 2026-10-06, has no onPick of its own). */
  const settingsRows = shell.slice(shell.indexOf("ltPick === 'settings'"));
  const prints = settingsRows.slice(settingsRows.indexOf("key: 'prints', label: MAKER_PRINTS_LABEL"));
  assert.match(prints.slice(0, 300), /onPick: \(\) => openSection\('prints'\)/, 'the Prints tile presses a door again');
  const nav = shell.slice(shell.indexOf('const openSection'), shell.indexOf('const openSection') + 400);
  assert.ok(nav.includes("select({ kind: 'tool', key: 'details' })"), 'anti-vacuity: openSection was not found');
  assert.doesNotMatch(nav, /setDetailsDoor/, 'opening on the navigator moved the door count');
});

test('7 · a ‹ › step keeps focus on the stepper — the panel takes it only on the first open', () => {
  const lt = read(`${L}/maker-lower-third.tsx`);
  const fx = lt.slice(lt.indexOf('const lastKey'), lt.indexOf('}, [toolKey]);'));
  assert.match(fx, /else if \(document\.activeElement instanceof HTMLElement && document\.activeElement\.closest\('\[data-lt-step\]'\)\) return;/, 'a step pulls focus off ‹ ›');
  assert.ok(fx.indexOf("closest('[data-lt-step]')") < fx.indexOf('panel.focus('), 'the stepper check runs after the panel is focused');
});

test('the tool column never breaks a word mid-way ("Backgro / und", owner 2026-10-05)', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'app/dashboard/[eventId]/launch/_components/maker-lower-third.tsx'), 'utf8') as string;
  const at = src.indexOf('data-lt-column-name=""');
  const name = src.slice(at, src.indexOf('</button>', at));
  assert.ok(name.length > 0, 'anti-vacuity: the column name was not found');
  assert.doesNotMatch(name, /break-words|break-all|overflow-wrap:anywhere/, 'the column name may break a word mid-way again');
  assert.match(name, /\[word-break:keep-all\]/, 'the column name does not keep its words whole');
  assert.match(name, /longestWord\(tool\.name\) > 8 \? 'text-\[9px\]'/, 'a long single word is not set smaller to fit');
});

test('the shut menu is invisible, never only slid down ("Something is peeking from the bottom", owner 2026-10-06)', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'app/dashboard/[eventId]/launch/_components/maker-lower-third.tsx'), 'utf8') as string;
  const at = src.indexOf('data-lt-menu=""');
  const sheet = src.slice(at, src.indexOf('>', src.indexOf('}`}', at)));
  assert.ok(sheet.length > 0, 'anti-vacuity: the menu sheet was not found');
  // On the guided flow's short row, 104% of the sheet lands inside the iPhone home-bar padding.
  assert.match(sheet, /menuOpen \? 'visible translate-y-0' : 'invisible translate-y-\[104%\]'/, 'the shut menu can peek out under the Menu button again');
  assert.match(sheet, /transition-\[transform,visibility\]/, 'visibility does not wait for the slide, so the close no longer animates');
});
